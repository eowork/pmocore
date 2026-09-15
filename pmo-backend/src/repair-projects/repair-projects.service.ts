import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import type { FilterQuery } from '@mikro-orm/core';
import { createPaginatedResponse, PaginatedResponse } from '../common/dto';
import { ProjectStatus, RepairStatus } from '../common/enums';
import {
  CreateRepairProjectDto,
  UpdateRepairProjectDto,
  QueryRepairProjectDto,
  CreatePowItemDto,
  CreatePhaseDto,
  CreateTeamMemberDto,
} from './dto';
import { JwtPayload } from '../common/interfaces';
import { PermissionResolverService } from '../common/services';
import {
  RepairProject,
  RepairPowItem,
  RepairProjectPhase,
  RepairProjectTeamMember,
  RecordAssignment,
  Project,
} from '../database/entities';

// Publication status values matching database enum
export type PublicationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED';

@Injectable()
export class RepairProjectsService {
  private readonly logger = new Logger(RepairProjectsService.name);
  private readonly ALLOWED_SORTS = [
    'created_at',
    'title',
    'status',
    'urgency_level',
    'start_date',
    'reported_date',
    'physical_progress',
  ];

  constructor(
    @InjectRepository(RepairProject)
    private readonly rpRepo: EntityRepository<RepairProject>,
    @InjectRepository(RepairPowItem)
    private readonly powRepo: EntityRepository<RepairPowItem>,
    @InjectRepository(RepairProjectPhase)
    private readonly phaseRepo: EntityRepository<RepairProjectPhase>,
    @InjectRepository(RepairProjectTeamMember)
    private readonly teamRepo: EntityRepository<RepairProjectTeamMember>,
    @InjectRepository(RecordAssignment)
    private readonly assignmentRepo: EntityRepository<RecordAssignment>,
    @InjectRepository(Project)
    private readonly projectRepo: EntityRepository<Project>,
    private readonly em: EntityManager,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  private isAdmin(user: JwtPayload): boolean {
    return this.permissionResolver.isAdmin(user);
  }

  private normalizeUserCampusToRecordCampus(
    userCampus: string | null | undefined,
  ): string | null {
    if (!userCampus) return null;
    if (userCampus === 'Butuan Campus') return 'MAIN';
    if (userCampus === 'Cabadbaran') return 'CABADBARAN';
    return null;
  }

  private async updateRecordAssignments(
    recordId: string,
    userIds: string[],
  ): Promise<void> {
    await this.em.nativeDelete(RecordAssignment, {
      module: 'REPAIR',
      recordId,
    });
    for (const userId of userIds) {
      const assignment = this.assignmentRepo.create({
        module: 'REPAIR',
        recordId,
        userId,
      });
      this.em.persist(assignment);
    }
    await this.em.flush();
  }

  private async isUserAssigned(
    recordId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.assignmentRepo.count({
      module: 'REPAIR',
      recordId,
      userId,
    });
    return count > 0;
  }

  private mapRepairStatusToProjectStatus(
    repairStatus: RepairStatus,
  ): ProjectStatus {
    // MF (2026-05-21): legacy PLANNING / COMPLETED replaced by PROPOSAL / COMPLETE.
    switch (repairStatus) {
      case RepairStatus.REPORTED:
      case RepairStatus.INSPECTED:
      case RepairStatus.APPROVED:
        return ProjectStatus.PROPOSAL;
      case RepairStatus.IN_PROGRESS:
        return ProjectStatus.ONGOING;
      case RepairStatus.COMPLETED:
        return ProjectStatus.COMPLETE;
      case RepairStatus.CANCELLED:
        return ProjectStatus.CANCELLED;
      default:
        return ProjectStatus.PROPOSAL;
    }
  }

  // --- RAW SQL reads (complex JOINs preserved) ---

  async findAll(
    query: QueryRepairProjectDto,
    user?: JwtPayload,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = query;
    const offset = (page - 1) * limit;

    const sortColumn = this.ALLOWED_SORTS.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = ['rp.deleted_at IS NULL'];
    const params: any[] = [];

    const queryAny = query as any;
    if (queryAny.publication_status) {
      if (
        queryAny.publication_status !== 'PUBLISHED' &&
        user &&
        !this.isAdmin(user)
      ) {
        conditions.push(`(rp.publication_status = ? AND rp.created_by = ?)`);
        params.push(queryAny.publication_status, user.sub);
      } else {
        conditions.push(`rp.publication_status = ?`);
        params.push(queryAny.publication_status);
      }
    } else if (user && !this.isAdmin(user)) {
      const recordCampus = this.normalizeUserCampusToRecordCampus(user.campus);
      if (recordCampus) {
        conditions.push(
          `(rp.campus = ? OR rp.created_by = ? OR EXISTS (SELECT 1 FROM record_assignments ra WHERE ra.module = 'REPAIR' AND ra.record_id = rp.id AND ra.user_id = ?))`,
        );
        params.push(recordCampus, user.sub, user.sub);
      } else {
        conditions.push(
          `(rp.publication_status = 'PUBLISHED' OR rp.created_by = ? OR EXISTS (SELECT 1 FROM record_assignments ra WHERE ra.module = 'REPAIR' AND ra.record_id = rp.id AND ra.user_id = ?))`,
        );
        params.push(user.sub, user.sub);
      }
    }

    if (query.status) {
      conditions.push(`rp.status = ?`);
      params.push(query.status);
    }
    if (query.urgency) {
      conditions.push(`rp.urgency_level = ?`);
      params.push(query.urgency);
    }
    if (query.is_emergency !== undefined) {
      conditions.push(`rp.is_emergency = ?`);
      params.push(query.is_emergency);
    }
    if (query.campus) {
      conditions.push(`rp.campus = ?`);
      params.push(query.campus);
    }
    if (query.repair_type_id) {
      conditions.push(`rp.repair_type_id = ?`);
      params.push(query.repair_type_id);
    }

    const whereClause = conditions.join(' AND ');
    const conn = this.em.getConnection();

    const countResult = await conn.execute(
      `SELECT COUNT(*) FROM repair_projects rp WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult[0].count, 10);

    const dataResult = await conn.execute(
      `SELECT rp.id, rp.project_id, rp.project_code, rp.title, rp.building_name,
              rp.status, rp.urgency_level, rp.is_emergency, rp.campus,
              rp.start_date, rp.end_date, rp.budget, rp.reported_date, rp.created_at,
              rp.physical_progress, rp.financial_progress, rp.publication_status,
              rp.submitted_by, rp.submitted_at,
              submitter.first_name || ' ' || submitter.last_name as submitted_by_name,
              rt.name as repair_type_name,
              (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)), '[]'::json)
               FROM record_assignments ra JOIN users u ON ra.user_id = u.id
               WHERE ra.module = 'REPAIR' AND ra.record_id = rp.id) as assigned_users
       FROM repair_projects rp
       LEFT JOIN repair_types rt ON rp.repair_type_id = rt.id
       LEFT JOIN users submitter ON rp.submitted_by = submitter.id
       WHERE ${whereClause}
       ORDER BY rp.${sortColumn} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return createPaginatedResponse(dataResult, total, page, limit);
  }

  async findOne(id: string): Promise<any> {
    const conn = this.em.getConnection();
    const result = await conn.execute(
      `SELECT rp.*,
              p.title as project_title,
              rt.name as repair_type_name,
              c.name as contractor_name,
              f.building_name as facility_name,
              creator.first_name || ' ' || creator.last_name as created_by_name,
              submitter.first_name || ' ' || submitter.last_name as submitted_by_name,
              reviewer.first_name || ' ' || reviewer.last_name as reviewed_by_name,
              (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)), '[]'::json)
               FROM record_assignments ra JOIN users u ON ra.user_id = u.id
               WHERE ra.module = 'REPAIR' AND ra.record_id = rp.id) as assigned_users
       FROM repair_projects rp
       LEFT JOIN projects p ON rp.project_id = p.id
       LEFT JOIN repair_types rt ON rp.repair_type_id = rt.id
       LEFT JOIN contractors c ON rp.contractor_id = c.id
       LEFT JOIN facilities f ON rp.facility_id = f.id
       LEFT JOIN users creator ON rp.created_by = creator.id
       LEFT JOIN users submitter ON rp.submitted_by = submitter.id
       LEFT JOIN users reviewer ON rp.reviewed_by = reviewer.id
       WHERE rp.id = ? AND rp.deleted_at IS NULL`,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Repair project with ID ${id} not found`);
    }

    const project = result[0];

    const powItems = await this.powRepo.find(
      { repairProjectId: id },
      { orderBy: { itemNumber: 'asc' } },
    );

    const phases = await this.phaseRepo.find(
      { repairProjectId: id },
      { orderBy: { createdAt: 'asc' } },
    );

    const teamMembers = await this.teamRepo.find({ repairProjectId: id });

    return {
      ...project,
      pow_items: powItems,
      phases,
      team_members: teamMembers,
    };
  }

  async create(
    dto: CreateRepairProjectDto,
    userId: string,
    _user?: JwtPayload,
  ): Promise<any> {
    const conn = this.em.getConnection();
    const existing = await conn.execute(
      `SELECT id FROM repair_projects WHERE project_code = ? AND deleted_at IS NULL`,
      [dto.project_code],
    );
    if (existing.length > 0) {
      throw new ConflictException(
        `Project code ${dto.project_code} already exists`,
      );
    }

    const projectId = dto.project_id || uuidv4();
    const publicationStatus: PublicationStatus = 'DRAFT';
    const submittedBy = userId;
    const submittedAt = new Date();

    return await this.em.transactional(async (em) => {
      const conn = em.getConnection();

      if (!dto.project_id) {
        const projectStatus = this.mapRepairStatusToProjectStatus(dto.status);
        await conn.execute(
          `INSERT INTO projects (id, project_code, title, description, project_type, start_date, end_date, status, budget, campus, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            dto.project_code,
            dto.title,
            dto.description || null,
            'REPAIR',
            dto.start_date || null,
            dto.end_date || null,
            projectStatus,
            dto.budget || null,
            dto.campus,
            userId,
          ],
        );
      } else {
        const projectCheck = await this.projectRepo.findOne({
          id: dto.project_id,
        });
        if (!projectCheck) {
          throw new BadRequestException(
            `Project with ID ${dto.project_id} not found`,
          );
        }
      }

      const rpResult = await conn.execute(
        `INSERT INTO repair_projects
         (project_id, project_code, title, description, building_name, floor_number, room_number,
          specific_location, repair_type_id, urgency_level, is_emergency, campus, reported_by,
          inspection_date, inspector_id, inspection_findings, status, start_date, end_date,
          budget, actual_cost, project_manager_id, contractor_id, facility_id, assigned_technician, metadata, created_by,
          publication_status, submitted_by, submitted_at, assigned_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
        [
          projectId,
          dto.project_code,
          dto.title,
          dto.description,
          dto.building_name,
          dto.floor_number,
          dto.room_number,
          dto.specific_location,
          dto.repair_type_id,
          dto.urgency_level,
          dto.is_emergency || false,
          dto.campus,
          dto.reported_by,
          dto.inspection_date,
          dto.inspector_id,
          dto.inspection_findings,
          dto.status,
          dto.start_date,
          dto.end_date,
          dto.budget,
          dto.actual_cost || null,
          dto.project_manager_id,
          dto.contractor_id,
          dto.facility_id,
          dto.assigned_technician,
          dto.metadata ? JSON.stringify(dto.metadata) : null,
          userId,
          publicationStatus,
          submittedBy,
          submittedAt,
          dto.assigned_to || null,
        ],
      );

      const recordId = rpResult[0].id;

      if (dto.assigned_user_ids && dto.assigned_user_ids.length > 0) {
        for (const uid of dto.assigned_user_ids) {
          await conn.execute(
            `INSERT INTO record_assignments (module, record_id, user_id) VALUES ('REPAIR', ?, ?)
             ON CONFLICT (module, record_id, user_id) DO NOTHING`,
            [recordId, uid],
          );
        }
      } else if (dto.assigned_to) {
        await conn.execute(
          `INSERT INTO record_assignments (module, record_id, user_id) VALUES ('REPAIR', ?, ?)
           ON CONFLICT (module, record_id, user_id) DO NOTHING`,
          [recordId, dto.assigned_to],
        );
      }

      this.logger.log(
        `REPAIR_PROJECT_CREATED: id=${recordId}, status=${publicationStatus}, by=${userId}`,
      );
      return rpResult[0];
    });
  }

  async update(
    id: string,
    dto: UpdateRepairProjectDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<any> {
    const currentRecord = await this.findOne(id);

    if (user && !this.permissionResolver.isAdmin(user)) {
      const isOwner = currentRecord.created_by === userId;
      const isAssigned = await this.isUserAssigned(id, userId);
      if (!isOwner && !isAssigned) {
        throw new ForbiddenException(
          'Cannot edit records you do not own or are not assigned to',
        );
      }
    }

    const conn = this.em.getConnection();
    const dtoAny = dto as any;

    if (dtoAny.project_code) {
      const existing = await conn.execute(
        `SELECT id FROM repair_projects WHERE project_code = ? AND id != ? AND deleted_at IS NULL`,
        [dtoAny.project_code, id],
      );
      if (existing.length > 0) {
        throw new ConflictException(
          `Project code ${dtoAny.project_code} already exists`,
        );
      }
    }

    if (dtoAny.publication_status) {
      throw new BadRequestException(
        'Cannot change publication_status via update. ' +
          'Use POST /:id/submit-for-review (DRAFT → PENDING_REVIEW), ' +
          'POST /:id/publish (PENDING_REVIEW → PUBLISHED), or ' +
          'POST /:id/reject (PENDING_REVIEW → REJECTED).',
      );
    }

    const priorStatus = currentRecord.publication_status;
    const requiresStatusReset = [
      'PUBLISHED',
      'REJECTED',
      'PENDING_REVIEW',
    ].includes(priorStatus);
    if (requiresStatusReset) {
      this.logger.log(
        `STATUS_REVERTED: id=${id}, by=${userId}, was=${priorStatus}, now=DRAFT`,
      );
    }

    const fields = Object.keys(dto).filter(
      (k) => dto[k] !== undefined && k !== 'assigned_user_ids',
    );
    if (fields.length === 0) return this.findOne(id);

    let setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values: any[] = fields.map((f) =>
      f === 'metadata' ? JSON.stringify(dto[f]) : dto[f],
    );

    if (requiresStatusReset) {
      let resetFields: string[];
      if (priorStatus === 'PENDING_REVIEW') {
        resetFields = [
          `publication_status = 'DRAFT'`,
          `submitted_by = NULL`,
          `submitted_at = NULL`,
        ];
      } else {
        resetFields = [
          `publication_status = 'DRAFT'`,
          `reviewed_by = NULL`,
          `reviewed_at = NULL`,
          `review_notes = NULL`,
          `submitted_by = ?`,
          `submitted_at = NOW()`,
        ];
        values.push(userId);
      }
      setClause = setClause
        ? `${setClause}, ${resetFields.join(', ')}`
        : resetFields.join(', ');
    }

    await conn.execute(
      `UPDATE repair_projects SET ${setClause}, updated_by = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL RETURNING *`,
      [...values, userId, id],
    );

    if (dto.assigned_user_ids !== undefined) {
      await this.updateRecordAssignments(id, dto.assigned_user_ids || []);
    }

    this.logger.log(
      `REPAIR_PROJECT_UPDATED: id=${id}, by=${userId}, fields=[${fields.join(',')}]${requiresStatusReset ? `, status_reset=DRAFT (was=${priorStatus})` : ''}`,
    );
    return this.findOne(id);
  }

  async remove(id: string, userId: string): Promise<void> {
    const project = await this.findOne(id);

    await this.em.transactional(async (em) => {
      const conn = em.getConnection();
      await conn.execute(
        `UPDATE repair_projects SET deleted_at = NOW(), deleted_by = ? WHERE id = ?`,
        [userId, id],
      );
      await conn.execute(
        `UPDATE projects SET deleted_at = NOW(), deleted_by = ? WHERE id = ?`,
        [userId, project.project_id],
      );
    });

    this.logger.log(`REPAIR_PROJECT_DELETED: id=${id}, by=${userId}`);
  }

  // --- Draft Governance Workflow (ORM) ---

  async submitForReview(id: string, userId: string): Promise<any> {
    const project = await this.findOne(id);

    if (
      project.publication_status !== 'DRAFT' &&
      project.publication_status !== 'REJECTED'
    ) {
      throw new BadRequestException(
        `Only DRAFT or REJECTED records can be submitted for review. Current status: ${project.publication_status}`,
      );
    }

    const isOwner = project.created_by === userId;
    const isAssigned = await this.isUserAssigned(id, userId);
    if (!isOwner && !isAssigned) {
      throw new ForbiddenException(
        'Only the creator or assigned user can submit this draft for review',
      );
    }

    const entity = await this.rpRepo.findOne({ id });
    if (!entity)
      throw new NotFoundException(`Repair project with ID ${id} not found`);

    entity.publicationStatus = 'PENDING_REVIEW';
    entity.submittedBy = userId;
    entity.submittedAt = new Date();
    entity.reviewNotes = undefined;
    await this.em.flush();

    this.logger.log(
      `REPAIR_PROJECT_SUBMITTED_FOR_REVIEW: id=${id}, by=${userId}`,
    );
    return this.findOne(id);
  }

  async publish(id: string, adminId: string, user: JwtPayload): Promise<any> {
    // Phase BBCH (Track 1): Admin OR an Approver/Manager 'repairs' module-level grant.
    if (!(await this.permissionResolver.canApproveModule(user, 'repairs'))) {
      throw new ForbiddenException(
        'Insufficient module level to publish records',
      );
    }

    const project = await this.findOne(id);

    const approvalCheck = await this.permissionResolver.canApproveByRank(
      adminId,
      project.created_by,
      user.is_superadmin,
    );
    if (!approvalCheck.allowed) {
      throw new ForbiddenException(approvalCheck.reason);
    }

    if (project.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW records can be published. Current status: ${project.publication_status}. ` +
          `DRAFT records must first be submitted for review via POST /:id/submit-for-review.`,
      );
    }

    const entity = await this.rpRepo.findOne({ id });
    if (!entity)
      throw new NotFoundException(`Repair project with ID ${id} not found`);

    entity.publicationStatus = 'PUBLISHED';
    entity.reviewedBy = adminId;
    entity.reviewedAt = new Date();
    entity.reviewNotes = undefined;
    await this.em.flush();

    this.logger.log(`REPAIR_PROJECT_PUBLISHED: id=${id}, by=${adminId}`);
    return this.findOne(id);
  }

  async reject(
    id: string,
    adminId: string,
    notes: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase BBCH (Track 1): Admin OR an Approver/Manager 'repairs' module-level grant.
    if (!(await this.permissionResolver.canApproveModule(user, 'repairs'))) {
      throw new ForbiddenException(
        'Insufficient module level to reject records',
      );
    }

    const project = await this.findOne(id);

    if (project.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW records can be rejected. Current status: ${project.publication_status}`,
      );
    }

    if (!notes || notes.trim().length === 0) {
      throw new BadRequestException('Rejection notes are required');
    }

    const entity = await this.rpRepo.findOne({ id });
    if (!entity)
      throw new NotFoundException(`Repair project with ID ${id} not found`);

    entity.publicationStatus = 'REJECTED';
    entity.reviewedBy = adminId;
    entity.reviewedAt = new Date();
    entity.reviewNotes = notes.trim();
    await this.em.flush();

    this.logger.log(`REPAIR_PROJECT_REJECTED: id=${id}, by=${adminId}`);
    return this.findOne(id);
  }

  async withdraw(id: string, userId: string): Promise<any> {
    const project = await this.findOne(id);

    if (project.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW records can be withdrawn. Current status: ${project.publication_status}`,
      );
    }

    if (project.submitted_by !== userId) {
      throw new ForbiddenException(
        'Only the original submitter can withdraw this submission',
      );
    }

    const entity = await this.rpRepo.findOne({ id });
    if (!entity)
      throw new NotFoundException(`Repair project with ID ${id} not found`);

    entity.publicationStatus = 'DRAFT';
    entity.submittedBy = undefined;
    entity.submittedAt = undefined;
    await this.em.flush();

    this.logger.log(`REPAIR_PROJECT_WITHDRAWN: id=${id}, by=${userId}`);
    return this.findOne(id);
  }

  async findPendingReview(user: JwtPayload): Promise<any[]> {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view pending reviews');
    }

    const conn = this.em.getConnection();

    if (!user.is_superadmin) {
      const accessCheck = await conn.execute(
        `SELECT 1 FROM user_module_assignments
         WHERE user_id = ? AND (module = 'REPAIR' OR module = 'ALL')`,
        [user.sub],
      );
      if (accessCheck.length === 0) return [];
    }

    const result = await conn.execute(
      `SELECT rp.id, rp.project_code, rp.title, rp.campus, rp.publication_status,
              rp.submitted_by, rp.submitted_at, rp.created_at,
              u.first_name || ' ' || u.last_name as submitter_name
       FROM repair_projects rp
       LEFT JOIN users u ON rp.submitted_by = u.id
       WHERE rp.publication_status = 'PENDING_REVIEW'
         AND rp.deleted_at IS NULL
       ORDER BY rp.submitted_at ASC`,
    );

    return result;
  }

  async findMyDrafts(userId: string): Promise<RepairProject[]> {
    return this.rpRepo.find(
      {
        createdBy: userId,
        publicationStatus: { $in: ['DRAFT', 'PENDING_REVIEW', 'REJECTED'] },
      },
      { orderBy: { createdAt: 'desc' } },
    );
  }

  // --- POW Items (ORM) ---
  async findPowItems(
    projectId: string,
    category?: string,
    phase?: string,
  ): Promise<RepairPowItem[]> {
    await this.findOne(projectId);
    const where: FilterQuery<RepairPowItem> = { repairProjectId: projectId };
    if (category) where.category = category;
    if (phase) where.phase = phase;
    return this.powRepo.find(where, { orderBy: { itemNumber: 'asc' } });
  }

  async createPowItem(
    projectId: string,
    dto: CreatePowItemDto,
    userId: string,
  ): Promise<RepairPowItem> {
    await this.findOne(projectId);
    const entity = this.powRepo.create({
      repairProjectId: projectId,
      itemNumber: dto.item_number,
      description: dto.description,
      unit: dto.unit,
      quantity: String(dto.quantity),
      estimatedMaterialCost: String(dto.estimated_material_cost),
      estimatedLaborCost: String(dto.estimated_labor_cost),
      estimatedProjectCost: String(dto.estimated_project_cost),
      unitCost: String(dto.unit_cost),
      dateEntry: new Date(dto.date_entry),
      category: dto.category,
      phase: dto.phase,
      remarks: dto.remarks,
      metadata: dto.metadata,
    });
    await this.em.persist(entity).flush();
    this.logger.log(
      `POW_ITEM_CREATED: id=${entity.id}, project=${projectId}, by=${userId}`,
    );
    return entity;
  }

  async updatePowItem(
    projectId: string,
    itemId: string,
    dto: Partial<CreatePowItemDto>,
    userId: string,
  ): Promise<RepairPowItem> {
    await this.findOne(projectId);
    const entity = await this.powRepo.findOne({
      id: itemId,
      repairProjectId: projectId,
    });
    if (!entity) throw new NotFoundException(`POW item ${itemId} not found`);

    if (dto.item_number !== undefined) entity.itemNumber = dto.item_number;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.unit !== undefined) entity.unit = dto.unit;
    if (dto.quantity !== undefined) entity.quantity = String(dto.quantity);
    if (dto.estimated_material_cost !== undefined)
      entity.estimatedMaterialCost = String(dto.estimated_material_cost);
    if (dto.estimated_labor_cost !== undefined)
      entity.estimatedLaborCost = String(dto.estimated_labor_cost);
    if (dto.estimated_project_cost !== undefined)
      entity.estimatedProjectCost = String(dto.estimated_project_cost);
    if (dto.unit_cost !== undefined) entity.unitCost = String(dto.unit_cost);
    if (dto.date_entry !== undefined)
      entity.dateEntry = new Date(dto.date_entry);
    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.phase !== undefined) entity.phase = dto.phase;
    if (dto.remarks !== undefined) entity.remarks = dto.remarks;
    if (dto.metadata !== undefined) entity.metadata = dto.metadata;
    await this.em.flush();

    this.logger.log(`POW_ITEM_UPDATED: id=${itemId}, by=${userId}`);
    return entity;
  }

  async removePowItem(
    projectId: string,
    itemId: string,
    userId: string,
  ): Promise<void> {
    await this.findOne(projectId);
    const entity = await this.powRepo.findOne({
      id: itemId,
      repairProjectId: projectId,
    });
    if (!entity) throw new NotFoundException(`POW item ${itemId} not found`);

    entity.deletedAt = new Date();
    entity.deletedBy = userId;
    await this.em.flush();
    this.logger.log(`POW_ITEM_DELETED: id=${itemId}, by=${userId}`);
  }

  // --- Phases (ORM) ---
  async findPhases(projectId: string): Promise<RepairProjectPhase[]> {
    await this.findOne(projectId);
    return this.phaseRepo.find(
      { repairProjectId: projectId },
      { orderBy: { createdAt: 'asc' } },
    );
  }

  async createPhase(
    projectId: string,
    dto: CreatePhaseDto,
  ): Promise<RepairProjectPhase> {
    await this.findOne(projectId);
    const entity = this.phaseRepo.create({
      repairProjectId: projectId,
      phaseName: dto.phase_name,
      phaseDescription: dto.phase_description,
      targetProgress:
        dto.target_progress != null ? String(dto.target_progress) : undefined,
      actualProgress:
        dto.actual_progress != null ? String(dto.actual_progress) : undefined,
      status: dto.status,
      targetStartDate: dto.target_start_date
        ? new Date(dto.target_start_date)
        : undefined,
      targetEndDate: dto.target_end_date
        ? new Date(dto.target_end_date)
        : undefined,
      remarks: dto.remarks,
    });
    await this.em.persist(entity).flush();
    this.logger.log(`PHASE_CREATED: id=${entity.id}, project=${projectId}`);
    return entity;
  }

  async updatePhase(
    projectId: string,
    phaseId: string,
    dto: Partial<CreatePhaseDto>,
  ): Promise<RepairProjectPhase> {
    await this.findOne(projectId);
    const entity = await this.phaseRepo.findOne({
      id: phaseId,
      repairProjectId: projectId,
    });
    if (!entity) throw new NotFoundException(`Phase ${phaseId} not found`);

    if (dto.phase_name !== undefined) entity.phaseName = dto.phase_name;
    if (dto.phase_description !== undefined)
      entity.phaseDescription = dto.phase_description;
    if (dto.target_progress !== undefined)
      entity.targetProgress =
        dto.target_progress != null ? String(dto.target_progress) : undefined;
    if (dto.actual_progress !== undefined)
      entity.actualProgress =
        dto.actual_progress != null ? String(dto.actual_progress) : undefined;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.target_start_date !== undefined)
      entity.targetStartDate = dto.target_start_date
        ? new Date(dto.target_start_date)
        : undefined;
    if (dto.target_end_date !== undefined)
      entity.targetEndDate = dto.target_end_date
        ? new Date(dto.target_end_date)
        : undefined;
    if (dto.remarks !== undefined) entity.remarks = dto.remarks;
    await this.em.flush();

    this.logger.log(`PHASE_UPDATED: id=${phaseId}`);
    return entity;
  }

  // --- Team Members (ORM) ---
  async findTeamMembers(projectId: string): Promise<RepairProjectTeamMember[]> {
    await this.findOne(projectId);
    return this.teamRepo.find({ repairProjectId: projectId });
  }

  async createTeamMember(
    projectId: string,
    dto: CreateTeamMemberDto,
  ): Promise<RepairProjectTeamMember> {
    await this.findOne(projectId);
    const entity = this.teamRepo.create({
      repairProjectId: projectId,
      userId: dto.user_id,
      name: dto.name,
      role: dto.role,
      department: dto.department,
      responsibilities: dto.responsibilities,
      status: dto.status || 'Active',
    });
    await this.em.persist(entity).flush();
    this.logger.log(
      `TEAM_MEMBER_CREATED: id=${entity.id}, project=${projectId}`,
    );
    return entity;
  }

  async removeTeamMember(projectId: string, memberId: string): Promise<void> {
    await this.findOne(projectId);
    const entity = await this.teamRepo.findOne({
      id: memberId,
      repairProjectId: projectId,
    });
    if (!entity)
      throw new NotFoundException(`Team member ${memberId} not found`);

    entity.deletedAt = new Date();
    await this.em.flush();
    this.logger.log(`TEAM_MEMBER_DELETED: id=${memberId}`);
  }
}
