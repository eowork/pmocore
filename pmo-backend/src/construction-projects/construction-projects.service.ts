import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid4 } from 'uuid';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { FilterQuery } from '@mikro-orm/core';
import { EntityManager, EntityRepository, wrap } from '@mikro-orm/core';
import { createPaginatedResponse, PaginatedResponse } from '../common/dto';
import {
  BatchCreateMilestoneDto,
  BatchCreateTimelineEntryDto,
  CreateConstructionProjectDto,
  CreateDiaryEntryDto,
  CreateGalleryDto,
  CreateMilestoneDto,
  CreateMovEntryDto,
  CreateProgressReportDto,
  CreateRevisionOrderDto,
  CreateTimelineEntryDto,
  QueryConstructionProjectDto,
  QueryGalleryDto,
  UpdateConstructionProjectDto,
  UpdateDiaryEntryDto,
  UpdateDocumentChecklistDto,
  UpdateProgressReportDto,
  UpdateRevisionOrderDto,
  UpdateTimelineEntryDto,
  UploadDocumentDto,
} from './dto';
import { UploadsService } from '../uploads';
import { UploadProgressService } from '../uploads/upload-progress.service';
import { PRIMARY_FUNDING_SOURCE_LABELS } from '../common/enums';
import { JwtPayload } from '../common/interfaces';
import { PermissionResolverService } from '../common/services';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { ActivityAction } from '../activity-logs/activity-log.entity';
import {
  ConstructionDiaryEntry,
  ConstructionDocumentChecklist,
  ConstructionDocumentFolder,
  ConstructionDocumentSubmission,
  ConstructionDocumentType,
  ConstructionGallery,
  ConstructionMilestone,
  ConstructionMovEntry,
  ConstructionProgressReport,
  ConstructionProject,
  ConstructionRevisionOrder,
  ConstructionTimelineEntry,
  Document,
  Project,
  RecordAssignment,
} from '../database/entities';
import { ConstructionProjectRepository } from './repository/construction-project.repository';
import { ConstructionMilestoneRepository } from './repository/construction-milestone.repository';
import { ConstructionTimelineEntryRepository } from './repository/construction-timeline-entry.repository';
import { ConstructionRevisionOrderRepository } from './repository/construction-revision-order.repository';
import { ConstructionProgressReportRepository } from './repository/construction-progress-report.repository';
import { ConstructionDocumentTypeRepository } from './repository/construction-document-type.repository';
import { ConstructionDocumentChecklistRepository } from './repository/construction-document-checklist.repository';
import { ConstructionDiaryEntryRepository } from './repository/construction-diary-entry.repository';
import { ConstructionGalleryRepository } from './repository/construction-gallery.repository';
import { ConstructionMovEntryRepository } from './repository/construction-mov-entry.repository';
import { RecordAssignmentRepository } from './repository/record-assignment.repository';
import { ConstructionDocumentSubmissionRepository } from './repository/construction-document-submission.repository';
import { ConstructionDocumentFolderRepository } from './repository/construction-document-folder.repository';

// Publication status values matching database enum
export type PublicationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED';

@Injectable()
export class ConstructionProjectsService {
  private readonly logger = new Logger(ConstructionProjectsService.name);

  constructor(
    @InjectRepository(ConstructionProject)
    private readonly cpRepo: ConstructionProjectRepository,
    @InjectRepository(ConstructionMilestone)
    private readonly milestoneRepo: ConstructionMilestoneRepository,
    @InjectRepository(ConstructionTimelineEntry)
    private readonly timelineEntryRepo: ConstructionTimelineEntryRepository,
    @InjectRepository(ConstructionRevisionOrder)
    private readonly revisionOrderRepo: ConstructionRevisionOrderRepository,
    @InjectRepository(ConstructionProgressReport)
    private readonly progressReportRepo: ConstructionProgressReportRepository,
    @InjectRepository(ConstructionDocumentType)
    private readonly docTypeRepo: ConstructionDocumentTypeRepository,
    @InjectRepository(ConstructionDocumentChecklist)
    private readonly docChecklistRepo: ConstructionDocumentChecklistRepository,
    @InjectRepository(ConstructionDiaryEntry)
    private readonly diaryRepo: ConstructionDiaryEntryRepository,
    // NI: financialRepo removed
    @InjectRepository(ConstructionGallery)
    private readonly galleryRepo: ConstructionGalleryRepository,
    @InjectRepository(ConstructionMovEntry)
    private readonly movEntryRepo: ConstructionMovEntryRepository,
    @InjectRepository(RecordAssignment)
    private readonly assignmentRepo: RecordAssignmentRepository,
    @InjectRepository(Project)
    private readonly projectRepo: EntityRepository<Project>,
    @InjectRepository(Document)
    private readonly documentRepo: EntityRepository<Document>,
    @InjectRepository(ConstructionDocumentSubmission)
    private readonly docSubmissionRepo: ConstructionDocumentSubmissionRepository,
    @InjectRepository(ConstructionDocumentFolder)
    private readonly docFolderRepo: ConstructionDocumentFolderRepository,
    private readonly em: EntityManager,
    private readonly uploadsService: UploadsService,
    private readonly uploadProgress: UploadProgressService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // Phase JT-D-6 — fire-and-forget log helper. Never blocks the calling CUD operation.
  private fireLog(
    user: JwtPayload | null | undefined,
    action: ActivityAction,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!user) return;
    void this.activityLog
      .logAction(user, action, 'CONSTRUCTION_PROJECT', entityId, metadata)
      .catch(() => {});
  }

  /**
   * Delegate to centralized permission resolver
   * @deprecated Use this.permissionResolver.isAdmin() directly
   */
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
      module: 'CONSTRUCTION',
      recordId,
    });
    for (const userId of userIds) {
      const assignment = this.assignmentRepo.create({
        module: 'CONSTRUCTION',
        recordId,
        userId,
      });
      this.em.persist(assignment);
    }
    await this.em.flush();
  }

  // VD-A: Deny-by-default for contractor assignments with null permissions JSONB.
  // Old rows (created before the permission system, or via legacy assigned_user_ids)
  // have permissions = null. Returning null would let the frontend fallback grant
  // access. Replace null with an all-false permission set so contractors are denied
  // every tab/action unless an admin has explicitly granted them.
  private applyContractorDenyDefault(project: any): any {
    if (!project || !Array.isArray(project.assigned_users)) return project;
    const denyAll = {
      tabProjectProfile: false,
      tabDatesDuration: false,
      tabTimeline: false,
      tabProgressReport: false,
      tabPersonnel: false,
      tabAttachments: false,
      tabOthers: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canUpload: false,
      canReview: false,
      canApprove: false,
      accessLevel: 'Viewer',
    };
    project.assigned_users = project.assigned_users.map((u: any) => {
      if (u.user_role === 'Contractor' && u.permissions == null) {
        return { ...u, permissions: { ...denyAll } };
      }
      return u;
    });
    return project;
  }

  /**
   * Phase JW-E: replace assignments with rich metadata (role/department/phone)
   * per user. Idempotent — wipes existing CONSTRUCTION assignments for the
   * record, then re-inserts the supplied set.
   */
  private async updateRecordAssignmentsWithMetadata(
    recordId: string,
    assignments: Array<{
      user_id: string;
      role?: string;
      department?: string;
      phone?: string;
      personnel_category?: string;
      project_role?: string;
      permissions?: Record<string, any> | null;
    }>,
  ): Promise<void> {
    await this.em.nativeDelete(RecordAssignment, {
      module: 'CONSTRUCTION',
      recordId,
    });
    for (const a of assignments) {
      const assignment = this.assignmentRepo.create({
        module: 'CONSTRUCTION',
        recordId,
        userId: a.user_id,
        role: a.role,
        department: a.department,
        phone: a.phone,
        personnelCategory: a.personnel_category,
        projectRole: a.project_role,
        permissions: a.permissions,
      });
      this.em.persist(assignment);
    }
    await this.em.flush();
  }

  private async getRecordAssignments(recordId: string): Promise<string[]> {
    const assignments = await this.assignmentRepo.find({
      module: 'CONSTRUCTION',
      recordId,
    });
    return assignments.map((a) => a.userId);
  }

  private async isUserAssigned(
    recordId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.assignmentRepo.count({
      module: 'CONSTRUCTION',
      recordId,
      userId,
    });
    return count > 0;
  }

  // PS-A: Enforce per-action project-level permissions for non-Admin assigned users.
  // Admin (system role) and project creator bypass all checks.
  // Called before every sub-resource CUD operation.
  private async assertProjectPermission(
    projectId: string,
    userId: string,
    user: JwtPayload | undefined,
    permission: 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload',
  ): Promise<void> {
    if (user && this.permissionResolver.isAdmin(user)) return; // Admin bypass
    const conn = this.em.getConnection();
    // Owner bypass
    const proj = await conn.execute(
      `SELECT created_by FROM construction_projects WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [projectId],
    );
    if (proj.length > 0 && proj[0].created_by === userId) return;
    // Check assignment permissions
    const rows = await conn.execute(
      `SELECT permissions FROM record_assignments WHERE module = 'CONSTRUCTION' AND record_id = ? AND user_id = ? LIMIT 1`,
      [projectId, userId],
    );
    if (rows.length === 0) {
      throw new ForbiddenException('You are not assigned to this project');
    }
    const perms = rows[0]?.permissions as Record<string, unknown> | null;
    if (!perms || !perms[permission]) {
      throw new ForbiddenException(
        `Permission denied: ${permission} is not granted for this project`,
      );
    }
  }

  // Approval authority for submit/publish/reject/withdraw: Admin, OR a module-level
  // Approver/Manager grant on 'coi' (Layer 3 — bypasses record scope org-wide), OR
  // this specific project's record_assignments.permissions.canApprove (Layer 4 —
  // a record-level Manager assigned to just this project, per the frontend's
  // FullPermissions shape / accessLevel: Manager). Deliberately NO owner bypass here
  // (unlike assertProjectPermission above) — owning a project isn't itself approval
  // authority; a Contributor/owner may edit but not approve/submit their own work.
  private async hasApprovalAuthority(
    projectId: string,
    userId: string,
    user: JwtPayload,
  ): Promise<boolean> {
    if (await this.permissionResolver.canApproveModule(user, 'coi'))
      return true;
    const conn = this.em.getConnection();
    const rows = await conn.execute(
      `SELECT permissions FROM record_assignments WHERE module = 'CONSTRUCTION' AND record_id = ? AND user_id = ? LIMIT 1`,
      [projectId, userId],
    );
    const perms = rows[0]?.permissions as Record<string, unknown> | null;
    return !!perms?.canApprove;
  }

  // --- RAW SQL reads (complex JOINs preserved) ---

  async findAll(
    query: QueryConstructionProjectDto,
    user?: JwtPayload,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20 } = query;

    // Visibility scope: the project list is a directory of the institution's portfolio, not a
    // personal work queue. Every authenticated user who holds 'coi' module access sees every
    // project, whether or not they created or were assigned to it. The previous owner/assigned
    // filter hid the portfolio from the very people expected to read it, and it bought no real
    // secrecy: findOne() has always served any project by id to an institutional user.
    //
    // Authority is deliberately unchanged. Every write still passes through
    // assertProjectPermission(), which admits exactly three parties — Admin, the project owner,
    // and a user whose record_assignments row carries the matching permission. Seeing a project
    // is not being able to act on it.
    //
    // Contractors stay record-scoped. That is external-personnel isolation (QD-C), enforced the
    // same way in findOne(), and is a separate rule from the institutional visibility policy
    // relaxed here. The policy decision belongs here; the repository only applies the
    // restriction it is handed, ANDed with the query's own filters.
    const restrictToAssignedUserId =
      user && this.permissionResolver.isContractor(user) ? user.sub : null;

    const { rows, total } = await this.cpRepo.findAllConstructionProject(
      query,
      {
        restrictToAssignedUserId,
      },
    );

    // VD-A: deny-by-default for contractor assignments with null permissions
    const transformed = rows.map((p: any) =>
      this.applyContractorDenyDefault(p),
    );
    return createPaginatedResponse(transformed, total, page, limit);
  }

  async findOne(id: string, user?: JwtPayload): Promise<any> {
    // QD-C: Contractors may only access records they are explicitly assigned to
    if (user && this.permissionResolver.isContractor(user)) {
      const conn = this.em.getConnection();
      const assignment = await conn.execute(
        `SELECT 1 FROM record_assignments WHERE module = 'CONSTRUCTION' AND record_id = ? AND user_id = ? LIMIT 1`,
        [id, user.sub],
      );
      if (assignment.length === 0) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }
    const conn = this.em.getConnection();
    const result = await conn.execute(
      `SELECT cp.*,
              p.title as project_title, p.project_type,
              c.name as contractor_name,
              fs.name as funding_source_name,
              creator.first_name || ' ' || creator.last_name as created_by_name,
              submitter.first_name || ' ' || submitter.last_name as submitted_by_name,
              reviewer.first_name || ' ' || reviewer.last_name as reviewed_by_name,
              (SELECT COALESCE(json_agg(json_build_object(
                  'id', u.id,
                  'name', u.first_name || ' ' || u.last_name,
                  'email', u.email,
                  'role', ra.role,
                  'department', ra.department,
                  'phone', ra.phone,
                  'personnel_category', ra.personnel_category,
                  'project_role', ra.project_role,
                  'permissions', ra.permissions,
                  'user_role', (SELECT r.name FROM user_roles ur
                                JOIN roles r ON ur.role_id = r.id
                                WHERE ur.user_id = u.id LIMIT 1)
                )), '[]'::json)
               FROM record_assignments ra JOIN users u ON ra.user_id = u.id
               WHERE ra.module = 'CONSTRUCTION' AND ra.record_id = cp.id) as assigned_users
       FROM construction_projects cp
       LEFT JOIN projects p ON cp.project_id = p.id
       LEFT JOIN contractors c ON cp.contractor_id = c.id
       LEFT JOIN funding_sources fs ON cp.funding_source_id = fs.id
       LEFT JOIN users creator ON cp.created_by = creator.id
       LEFT JOIN users submitter ON cp.submitted_by = submitter.id
       LEFT JOIN users reviewer ON cp.reviewed_by = reviewer.id
       WHERE cp.id = ? AND cp.deleted_at IS NULL`,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException(
        `Construction project with ID ${id} not found`,
      );
    }

    // VD-A: deny-by-default for contractor assignments with null permissions
    const project = this.applyContractorDenyDefault(result[0]);

    const milestones = await this.milestoneRepo.find(
      { projectId: id },
      { orderBy: { targetDate: 'asc' } },
    );

    // NI (2026-05-21): ConstructionProjectFinancial removed; chronological
    // history now lives in construction_progress_reports.
    const progressReports = await this.progressReportRepo.find(
      { projectId: id },
      { orderBy: { reportDate: 'desc' } },
    );

    return { ...project, milestones, progress_reports: progressReports };
  }

  // VE-A: Returns the current user's per-project permission map for CONSTRUCTION.
  // Loaded once at session start by the frontend store — makes contractor tab
  // permissions stateless at render time (parity with institutional role gates).
  // Null permissions resolve to deny-by-default.
  async getMyProjectPermissions(userId: string): Promise<Record<string, any>> {
    const conn = this.em.getConnection();
    const rows = await conn.execute(
      `SELECT ra.record_id as project_id, ra.permissions
       FROM record_assignments ra
       JOIN construction_projects cp ON cp.id = ra.record_id
       WHERE ra.module = 'CONSTRUCTION' AND ra.user_id = ? AND cp.deleted_at IS NULL`,
      [userId],
    );
    const denyAll = {
      tabProjectProfile: false,
      tabDatesDuration: false,
      tabTimeline: false,
      tabProgressReport: false,
      tabPersonnel: false,
      tabAttachments: false,
      tabOthers: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canUpload: false,
      canReview: false,
      canApprove: false,
      accessLevel: 'Viewer',
    };
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.project_id] = row.permissions ?? { ...denyAll };
    }
    return result;
  }

  // --- Analytics ---

  async getAnalyticsSummary(): Promise<any> {
    const conn = this.em.getConnection();
    const [
      statusRows,
      campusRows,
      pubRows,
      aggRow,
      fundingSourceRows,
      contractorRows,
    ] = await Promise.all([
      conn.execute(
        `SELECT status, COUNT(*) as count, COALESCE(SUM(contract_amount),0) as total_contract
         FROM construction_projects WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC`,
      ),
      conn.execute(
        `SELECT campus, COUNT(*) as count, COALESCE(SUM(contract_amount),0) as total_contract,
                COALESCE(AVG(physical_progress),0) as avg_progress
         FROM construction_projects WHERE deleted_at IS NULL GROUP BY campus ORDER BY count DESC`,
      ),
      conn.execute(
        `SELECT publication_status, COUNT(*) as count
         FROM construction_projects WHERE deleted_at IS NULL GROUP BY publication_status`,
      ),
      conn.execute(
        `SELECT COUNT(*) as total, COALESCE(SUM(contract_amount),0) as total_contract_value,
                COALESCE(AVG(physical_progress),0) as avg_progress,
                COUNT(*) FILTER (
                  WHERE status = 'ONGOING'
                    AND physical_progress::numeric < target_physical_progress::numeric
                ) as delayed_count
         FROM construction_projects WHERE deleted_at IS NULL`,
      ),
      conn.execute(
        // AAAK: Two-Level Funding — aggregate by the controlled Level-1 category
        // (primary_funding_source) directly on construction_projects. No JOIN to
        // funding_sources, so descriptive Level-2 variants (e.g. "GAA FY2025", "GAA Savings")
        // no longer fragment the analytics — they all roll up under their Level-1 category.
        `SELECT COALESCE(primary_funding_source, 'OTHER') as primary_funding_source,
                COUNT(*) as count,
                COALESCE(SUM(contract_amount),0) as total_contract
         FROM construction_projects
         WHERE deleted_at IS NULL
         GROUP BY COALESCE(primary_funding_source, 'OTHER')
         ORDER BY count DESC`,
      ),
      conn.execute(
        // MMM-A: column is `contractor` (varchar), not `contractor_name`.
        `SELECT contractor as contractor_name, COUNT(*) as count,
                COALESCE(SUM(contract_amount),0) as total_contract
         FROM construction_projects
         WHERE deleted_at IS NULL AND contractor IS NOT NULL
         GROUP BY contractor ORDER BY count DESC LIMIT 10`,
      ),
    ]);
    return {
      total: parseInt(aggRow[0].total, 10),
      total_contract_value: parseFloat(aggRow[0].total_contract_value),
      avg_progress: parseFloat(aggRow[0].avg_progress),
      delayed_count: parseInt(aggRow[0].delayed_count, 10),
      by_status: statusRows.map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10),
        total_contract: parseFloat(r.total_contract),
      })),
      by_campus: campusRows.map((r) => ({
        campus: r.campus,
        count: parseInt(r.count, 10),
        total_contract: parseFloat(r.total_contract),
        avg_progress: parseFloat(r.avg_progress),
      })),
      by_publication_status: pubRows.map((r) => ({
        publication_status: r.publication_status,
        count: parseInt(r.count, 10),
      })),
      by_funding_source: fundingSourceRows.map((r) => ({
        // AAAK: raw Level-1 category + human label. `funding_source_name` retained as the
        // label for backward-compat with existing frontend chart consumers.
        primary_funding_source: r.primary_funding_source,
        funding_source_name:
          PRIMARY_FUNDING_SOURCE_LABELS[r.primary_funding_source] ||
          r.primary_funding_source,
        count: parseInt(r.count, 10),
        total_contract: parseFloat(r.total_contract),
      })),
      by_contractor: contractorRows.map((r) => ({
        contractor_name: r.contractor_name,
        count: parseInt(r.count, 10),
        total_contract: parseFloat(r.total_contract),
      })),
    };
  }

  /**
   * NI (2026-05-21): Repointed to construction_progress_reports after
   * ConstructionProjectFinancial removal. Aggregates cost_incurred_to_date
   * across the LATEST report per project, plus project-level contract_amount
   * as a stand-in for appropriation context. Endpoint kept for KPI continuity.
   */
  async getFinancialSummary(): Promise<any> {
    const conn = this.em.getConnection();
    const rows = await conn.execute(
      `WITH latest_reports AS (
         SELECT DISTINCT ON (project_id) project_id, cost_incurred_to_date
         FROM construction_progress_reports
         ORDER BY project_id, report_date DESC
       )
       SELECT COALESCE(SUM(cp.contract_amount::numeric), 0) as total_contract_amount,
              COALESCE(SUM(lr.cost_incurred_to_date::numeric), 0) as total_cost_incurred,
              COUNT(DISTINCT lr.project_id) as projects_with_reports
       FROM construction_projects cp
       LEFT JOIN latest_reports lr ON lr.project_id = cp.id
       WHERE cp.deleted_at IS NULL`,
    );
    const r = rows[0];
    const contractAmount = parseFloat(r.total_contract_amount);
    const costIncurred = parseFloat(r.total_cost_incurred);
    return {
      total_appropriation: contractAmount, // back-compat key
      total_obligation: costIncurred, // back-compat key (closest semantic)
      total_disbursement: costIncurred, // back-compat key
      projects_with_financials: parseInt(r.projects_with_reports, 10),
      utilization_rate:
        contractAmount > 0 ? (costIncurred / contractAmount) * 100 : 0,
      disbursement_rate:
        contractAmount > 0 ? (costIncurred / contractAmount) * 100 : 0,
    };
  }

  // Phase JB-7: Public read — only returns PUBLISHED records
  async findPublicOne(id: string): Promise<any> {
    const result = await this.findOne(id);
    if (result.publication_status !== 'PUBLISHED') {
      throw new NotFoundException(
        `Construction project with ID ${id} not found`,
      );
    }
    return result;
  }

  async create(
    dto: CreateConstructionProjectDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<any> {
    const existing = await this.cpRepo.findOne(
      { projectCode: dto.project_code },
      { filters: false },
    );
    if (existing) {
      throw new ConflictException(
        `Project code ${dto.project_code} already exists`,
      );
    }

    const projectId = dto.project_id || uuid4();
    const publicationStatus: PublicationStatus = 'DRAFT';
    const submittedBy = userId;
    const submittedAt = new Date();

    return await this.em.transactional(async (em) => {
      const conn = em.getConnection();

      if (!dto.project_id) {
        // JP-A: Deployment-resilient duplicate detection.
        // The partial unique index projects_project_code_active_idx
        // (Migration20260502071146) enforces uniqueness for non-deleted rows.
        // We rely on the index itself instead of ON CONFLICT inference, so the
        // code works regardless of whether the partial index, a plain UNIQUE,
        // or a future renamed index is in place. PG SQLSTATE 23505 = unique_violation.
        try {
          await conn.execute(
            `INSERT INTO projects (id, project_code, title, description, project_type, start_date, end_date, status, budget, campus, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id`,
            [
              projectId,
              dto.project_code,
              dto.title,
              dto.description || null,
              'CONSTRUCTION',
              dto.start_date || null,
              dto.target_completion_date || null,
              dto.status,
              dto.contract_amount || null,
              dto.campus,
              userId,
            ],
          );
        } catch (err: any) {
          if (err?.code === '23505') {
            throw new ConflictException(
              `Project code ${dto.project_code} is already in use`,
            );
          }
          throw err;
        }
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

      // MB: cost_amount is alias for contract_amount (DB column unchanged)
      const effectiveContractAmount =
        dto.cost_amount ?? dto.contract_amount ?? null;

      // The insert goes through the ORM so the column list, the jsonb handling and the
      // decimal conversions all come from the entity rather than from a 70-placeholder
      // VALUES list that had to be kept in sync by eye.
      //
      // Note em.create / em.persist, not this.cpRepo: the repository is bound to the
      // request EntityManager, while em here is the transactional fork. Persisting through
      // the repository would run the insert outside this transaction.
      const project = this.cpRepo.create({
        projectId: projectId,
        projectCode: dto.project_code,
        title: dto.title,
        description: dto.description,
        idealInfrastructureImage: dto.ideal_infrastructure_image,
        beneficiaries: dto.beneficiaries,
        summary: dto.summary,
        scope: dto.scope,
        facilities: dto.facilities,
        objectives: dto.objectives,
        keyFeatures: dto.key_features,
        originalContractDuration: dto.original_contract_duration,
        implementationPeriod: dto.implementation_period,
        contractNumber: dto.contract_number,
        contractorId: dto.contractor_id,
        contractor: dto.contractor,
        contractAmount: toDecimal(effectiveContractAmount),
        startDate: toDate(dto.start_date),
        targetCompletionDate: toDate(dto.target_completion_date),
        actualCompletionDate: toDate(dto.actual_completion_date),
        projectDuration: dto.project_duration,
        projectEngineer: dto.project_engineer,
        projectManager: dto.project_manager,
        buildingType: dto.building_type,
        floorArea: toDecimal(dto.floor_area),
        numberOfFloors: dto.number_of_floors,
        fundingSourceId: dto.funding_source_id,
        subcategoryId: dto.subcategory_id,
        campus: dto.campus,
        status: dto.status,
        latitude: toDecimal(dto.latitude),
        longitude: toDecimal(dto.longitude),
        physicalProgress: toDecimal(dto.physical_progress ?? 0)!,
        financialProgress: toDecimal(dto.financial_progress ?? 0)!,
        targetPhysicalProgress: toDecimal(dto.target_physical_progress ?? 100)!,
        targetFinancialProgress: toDecimal(
          dto.target_financial_progress ?? 100,
        )!,
        metadata: dto.metadata,
        createdBy: userId,
        publicationStatus,
        submittedBy,
        submittedAt,
        assignedTo: dto.assigned_to || undefined,
        spatialCoverage: dto.spatial_coverage,
        municipality: dto.municipality,
        province: dto.province,
        coImplementingAgency: dto.co_implementing_agency,
        attachedAgency: dto.attached_agency,
        originalStartDate: toDate(dto.original_start_date),
        revisedStartDate: toDate(dto.revised_start_date),
        originalCompletionDate: toDate(dto.original_completion_date),
        revisedCompletionDate: toDate(dto.revised_completion_date),
        revisedProjectDuration: dto.revised_project_duration,
        asOfDate: toDate(dto.as_of_date),
        costIncurredToDate: toDecimal(dto.cost_incurred_to_date),
        rdpAlignment: dto.rdp_alignment,
        socioeconomicAgenda: dto.socioeconomic_agenda,
        csuLikhaGoals: dto.csu_likha_goals,
        sdgGoals: dto.sdg_goals,
        rdp2017Alignment: dto.rdp2017_alignment,
        pointAgenda10: dto.point_agenda_10,
        beneficiaryList: dto.beneficiary_list,
        fundingSourceType: dto.funding_source_type,
        additionalFundingSources: dto.additional_funding_sources,
        remarksLog: dto.remarks_log ?? [],
        personnelGroups: dto.personnel_groups,
        // FFF-B: Others-tab JSONB fields — persisted at creation so an edit reload shows
        // the correct data. They default to an empty array, never null.
        statusUpdates: dto.status_updates ?? [],
        readinessDocuments: dto.readiness_documents ?? [],
        signatories: dto.signatories ?? [],
        // AAAK: Two-Level Funding — Level 1 defaults to OTHER if omitted, Level 2 free text
        primaryFundingSource: dto.primary_funding_source ?? 'OTHER',
        fundingSourceDescription: dto.funding_source_description,
      });

      try {
        await this.cpRepo.getEntityManager().persist(project).flush();
      } catch (err: any) {
        if (err?.code === '23505') {
          throw new ConflictException(
            `Project code ${dto.project_code} is already in use`,
          );
        }
        throw err;
      }

      const recordId = project.id;

      // Phase JW-E: prefer rich `assignments[]` (with role/department/phone)
      // over legacy `assigned_user_ids[]` when both are present.
      if (dto.assignments && dto.assignments.length > 0) {
        for (const a of dto.assignments) {
          await conn.execute(
            `INSERT INTO record_assignments (module, record_id, user_id, role, department, phone, personnel_category, project_role, permissions)
             VALUES ('CONSTRUCTION', ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (module, record_id, user_id)
             DO UPDATE SET role = EXCLUDED.role, department = EXCLUDED.department, phone = EXCLUDED.phone,
               personnel_category = EXCLUDED.personnel_category, project_role = EXCLUDED.project_role,
               permissions = EXCLUDED.permissions`,
            [
              recordId,
              a.user_id,
              a.role ?? null,
              a.department ?? null,
              a.phone ?? null,
              a.personnel_category ?? null,
              a.project_role ?? null,
              a.permissions ? JSON.stringify(a.permissions) : null,
            ],
          );
        }
      } else if (dto.assigned_user_ids && dto.assigned_user_ids.length > 0) {
        for (const uid of dto.assigned_user_ids) {
          await conn.execute(
            `INSERT INTO record_assignments (module, record_id, user_id) VALUES ('CONSTRUCTION', ?, ?)
             ON CONFLICT (module, record_id, user_id) DO NOTHING`,
            [recordId, uid],
          );
        }
      } else if (dto.assigned_to) {
        await conn.execute(
          `INSERT INTO record_assignments (module, record_id, user_id) VALUES ('CONSTRUCTION', ?, ?)
           ON CONFLICT (module, record_id, user_id) DO NOTHING`,
          [recordId, dto.assigned_to],
        );
      }

      this.logger.log(
        `CONSTRUCTION_PROJECT_CREATED: id=${recordId}, status=${publicationStatus}, by=${userId}`,
      );
      this.fireLog(user, ActivityAction.CREATE, recordId, {
        projectCode: dto.project_code,
      });

      // The endpoint has always answered with the inserted row exactly as Postgres stores
      // it — snake_case keys, every column, including the ones the database filled in.
      // Reading it back keeps that response identical; serialising the entity instead would
      // hand callers camelCase keys and a different set of fields.
      const [created] = await conn.execute(
        `SELECT * FROM construction_projects WHERE id = ?`,
        [recordId],
      );
      return created;
    });
  }

  async update(
    id: string,
    dto: UpdateConstructionProjectDto,
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
      // PT-B: enforce project-level canEdit for non-owner assigned users
      if (!isOwner) {
        await this.assertProjectPermission(id, userId, user, 'canEdit');
      }
    }

    const conn = this.em.getConnection();
    const dtoAny = dto as any;

    if (dtoAny.project_code) {
      const existing = await conn.execute(
        `SELECT id FROM construction_projects WHERE project_code = ? AND id != ? AND deleted_at IS NULL`,
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

    // MB: cost_amount is a frontend alias — map to contract_amount column.
    if (
      (dto as any).cost_amount !== undefined &&
      (dto as any).contract_amount === undefined
    ) {
      (dto as any).contract_amount = (dto as any).cost_amount;
    }
    delete (dto as any).cost_amount;

    // OE-C: server-side author + timestamp stamping for remarks_log entries.
    // Any entry missing created_at gets NOW; any entry missing author gets resolved
    // from the authenticated user (email from JWT, since JWT does not carry full name).
    if (Array.isArray((dto as any).remarks_log)) {
      const authorLabel = user?.email ?? userId;
      const now = new Date().toISOString();
      (dto as any).remarks_log = ((dto as any).remarks_log as any[]).map(
        (r: any) => {
          const isNew = !r.created_at;
          return {
            ...r,
            created_at: r.created_at || now,
            author: r.author || (isNew ? authorLabel : undefined),
          };
        },
      );
    }

    // KY-B1: exclude undefined AND empty arrays — empty arrays must not overwrite
    // existing JSONB data (prevents [[]] double-wrapping corruption).
    // EEE-B: Others-tab scalar JSONB arrays (status_updates, etc.) CAN be
    // set to [] to clear all entries — they do not suffer from [[]] wrapping, so exempt them.
    const clearableArrayFields = new Set([
      'status_updates',
      'readiness_documents',
      'signatories',
    ]);
    const fields = Object.keys(dto).filter(
      (k) =>
        dto[k] !== undefined &&
        (clearableArrayFields.has(k) ||
          !(Array.isArray(dto[k]) && (dto[k] as any[]).length === 0)) &&
        k !== 'assigned_user_ids' &&
        k !== 'assignments',
    );
    if (fields.length === 0 && !requiresStatusReset) {
      // PV-A: process assignments even when no other project fields changed
      if (dto.assignments !== undefined) {
        await this.updateRecordAssignmentsWithMetadata(
          id,
          dto.assignments || [],
        );
        // PQ-F: log assignment-only saves
        this.fireLog(user, ActivityAction.UPDATE, id, {
          action: 'ASSIGNMENT_UPDATE',
          assignedCount: (dto.assignments || []).length,
        });
      } else if (dto.assigned_user_ids !== undefined) {
        await this.updateRecordAssignments(id, dto.assigned_user_ids || []);
        this.fireLog(user, ActivityAction.UPDATE, id, {
          action: 'ASSIGNMENT_UPDATE',
          assignedCount: (dto.assigned_user_ids || []).length,
        });
      }
      return this.findOne(id);
    }

    const jsonFields = [
      'objectives',
      'key_features',
      'metadata',
      'output_indicators',
      'outcome_indicators',
      'status_updates',
      'readiness_documents',
      'signatories',
      'incident_log',
      'document_checklist_remarks',
      // MC: new JSONB fields
      'rdp_alignment',
      'socioeconomic_agenda',
      'csu_likha_goals',
      'sdg_goals',
      // XXX-K: Historical Planning Frameworks (2017-2022)
      'rdp2017_alignment',
      'point_agenda_10',
      'beneficiary_list',
      'additional_funding_sources',
      'remarks_log',
      'personnel_groups',
      'project_notes_banking', // GGG-E
    ];
    let setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) =>
      jsonFields.includes(f) ? JSON.stringify(dto[f]) : dto[f],
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
      `UPDATE construction_projects
       SET ${setClause}, updated_by = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [...values, userId, id],
    );

    // Phase JW-E: prefer rich `assignments[]` over legacy `assigned_user_ids[]`.
    if (dto.assignments !== undefined) {
      await this.updateRecordAssignmentsWithMetadata(id, dto.assignments || []);
    } else if (dto.assigned_user_ids !== undefined) {
      await this.updateRecordAssignments(id, dto.assigned_user_ids || []);
    }

    this.logger.log(
      `CONSTRUCTION_PROJECT_UPDATED: id=${id}, by=${userId}, fields=[${fields.join(',')}]${requiresStatusReset ? `, status_reset=DRAFT (was=${priorStatus})` : ''}`,
    );
    this.fireLog(user, ActivityAction.UPDATE, id, { fields });
    return this.findOne(id);
  }

  async remove(id: string, userId: string, user?: JwtPayload): Promise<void> {
    const project = await this.findOne(id);

    // Admin, project owner, or this project's own record_assignments.permissions.canDelete.
    await this.assertProjectPermission(id, userId, user, 'canDelete');

    await this.em.transactional(async (em) => {
      const conn = em.getConnection();
      await conn.execute(
        `UPDATE construction_projects SET deleted_at = NOW(), deleted_by = ? WHERE id = ?`,
        [userId, id],
      );
      await conn.execute(
        `UPDATE projects SET deleted_at = NOW(), deleted_by = ? WHERE id = ?`,
        [userId, project.project_id],
      );
    });

    this.logger.log(`CONSTRUCTION_PROJECT_DELETED: id=${id}, by=${userId}`);
    this.fireLog(user, ActivityAction.DELETE, id);
  }

  // --- Draft Governance Workflow (ORM) ---

  async submitForReview(
    id: string,
    userId: string,
    user?: JwtPayload,
  ): Promise<any> {
    const project = await this.findOne(id);

    if (
      project.publication_status !== 'DRAFT' &&
      project.publication_status !== 'REJECTED'
    ) {
      throw new BadRequestException(
        `Only DRAFT or REJECTED records can be submitted for review. Current status: ${project.publication_status}`,
      );
    }

    // Submitting requires Approver/Manager authority — module-level 'coi' OR this
    // project's own record_assignments.permissions.canApprove. Deliberately NOT
    // owner/assigned alone (that was the prior rule; it let a Viewer/Contributor
    // submit their own draft, contradicting the frontend's Approver/Manager-only gate).
    if (user && !(await this.hasApprovalAuthority(id, userId, user))) {
      throw new ForbiddenException(
        'Insufficient approval authority to submit this project for review',
      );
    }

    const entity = await this.cpRepo.findOne({ id });
    if (!entity)
      throw new NotFoundException(
        `Construction project with ID ${id} not found`,
      );

    entity.publicationStatus = 'PENDING_REVIEW';
    entity.submittedBy = userId;
    entity.submittedAt = new Date();
    entity.reviewNotes = undefined;
    await this.em.flush();

    this.logger.log(
      `CONSTRUCTION_PROJECT_SUBMITTED_FOR_REVIEW: id=${id}, by=${userId}`,
    );
    this.fireLog(user, ActivityAction.SUBMIT, id);
    return this.findOne(id);
  }

  async publish(id: string, adminId: string, user: JwtPayload): Promise<any> {
    // Admin, OR module-level 'coi' Approver/Manager, OR this project's own
    // record_assignments.permissions.canApprove (record-level Manager).
    if (!(await this.hasApprovalAuthority(id, adminId, user))) {
      throw new ForbiddenException(
        'Insufficient approval authority to publish this project',
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

    const entity = await this.cpRepo.findOne({ id });
    if (!entity)
      throw new NotFoundException(
        `Construction project with ID ${id} not found`,
      );

    entity.publicationStatus = 'PUBLISHED';
    entity.reviewedBy = adminId;
    entity.reviewedAt = new Date();
    entity.reviewNotes = undefined;
    await this.em.flush();

    this.logger.log(`CONSTRUCTION_PROJECT_PUBLISHED: id=${id}, by=${adminId}`);
    this.fireLog(user, ActivityAction.PUBLISH, id);
    return this.findOne(id);
  }

  async reject(
    id: string,
    adminId: string,
    notes: string,
    user: JwtPayload,
  ): Promise<any> {
    // Admin, OR module-level 'coi' Approver/Manager, OR this project's own
    // record_assignments.permissions.canApprove (record-level Manager).
    if (!(await this.hasApprovalAuthority(id, adminId, user))) {
      throw new ForbiddenException(
        'Insufficient approval authority to reject this project',
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

    const entity = await this.cpRepo.findOne({ id });
    if (!entity)
      throw new NotFoundException(
        `Construction project with ID ${id} not found`,
      );

    entity.publicationStatus = 'REJECTED';
    entity.reviewedBy = adminId;
    entity.reviewedAt = new Date();
    entity.reviewNotes = notes.trim();
    await this.em.flush();

    this.logger.log(`CONSTRUCTION_PROJECT_REJECTED: id=${id}, by=${adminId}`);
    this.fireLog(user, ActivityAction.REJECT, id, { notes: notes.trim() });
    return this.findOne(id);
  }

  async withdraw(id: string, userId: string, user?: JwtPayload): Promise<any> {
    const project = await this.findOne(id);

    if (project.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW records can be withdrawn. Current status: ${project.publication_status}`,
      );
    }

    // Original submitter, OR Admin/module-level/record-level approval authority —
    // mirrors publish/reject/submitForReview's hasApprovalAuthority.
    if (
      project.submitted_by !== userId &&
      !(user && (await this.hasApprovalAuthority(id, userId, user)))
    ) {
      throw new ForbiddenException(
        'Only the original submitter or an Approver/Manager can withdraw this submission',
      );
    }

    const entity = await this.cpRepo.findOne({ id });
    if (!entity)
      throw new NotFoundException(
        `Construction project with ID ${id} not found`,
      );

    entity.publicationStatus = 'DRAFT';
    entity.submittedBy = undefined;
    entity.submittedAt = undefined;
    await this.em.flush();

    this.logger.log(`CONSTRUCTION_PROJECT_WITHDRAWN: id=${id}, by=${userId}`);
    this.fireLog(user, ActivityAction.WITHDRAW, id);
    return this.findOne(id);
  }

  async findPendingReview(user: JwtPayload): Promise<any[]> {
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view pending reviews');
    }

    const conn = this.em.getConnection();

    if (!user.is_superadmin) {
      const accessCheck = await conn.execute(
        `SELECT 1 FROM user_module_assignments
         WHERE user_id = ? AND (module = 'CONSTRUCTION' OR module = 'ALL')`,
        [user.sub],
      );
      if (accessCheck.length === 0) return [];
    }

    return await conn.execute(
      `SELECT cp.id,
              cp.project_code,
              cp.title,
              cp.campus,
              cp.publication_status,
              cp.submitted_by,
              cp.submitted_at,
              cp.created_at,
              u.first_name || ' ' || u.last_name as submitter_name
       FROM construction_projects cp
              LEFT JOIN users u ON cp.submitted_by = u.id
       WHERE cp.publication_status = 'PENDING_REVIEW'
         AND cp.deleted_at IS NULL
       ORDER BY cp.submitted_at `,
    );
  }

  async findMyDrafts(userId: string): Promise<ConstructionProject[]> {
    return this.cpRepo.find(
      {
        createdBy: userId,
        publicationStatus: { $in: ['DRAFT', 'PENDING_REVIEW', 'REJECTED'] },
      },
      { orderBy: { createdAt: 'desc' } },
    );
  }

  // --- Milestones (ORM) ---
  async findMilestones(projectId: string): Promise<ConstructionMilestone[]> {
    await this.findOne(projectId);
    return this.milestoneRepo.find(
      { projectId },
      { orderBy: { targetDate: 'asc' } },
    );
  }

  async createMilestone(
    projectId: string,
    dto: CreateMilestoneDto,
    user?: JwtPayload,
  ): Promise<ConstructionMilestone> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canCreate',
      );
    const entity = this.milestoneRepo.create({
      projectId,
      title: dto.title,
      description: dto.description,
      targetDate: dto.target_date ? new Date(dto.target_date) : undefined,
      status: dto.status || 'PENDING',
      remarks: dto.remarks,
      startDate: dto.start_date ? new Date(dto.start_date) : undefined,
      actualStartDate: dto.actual_start_date
        ? new Date(dto.actual_start_date)
        : undefined,
      progress: dto.progress != null ? String(dto.progress) : '0.00',
      category: dto.category,
      // LI-D: audit
      createdBy: user?.sub,
    });
    await this.em.persist(entity).flush();
    this.logger.log(`MILESTONE_CREATED: id=${entity.id}, project=${projectId}`);
    this.fireLog(user, ActivityAction.CREATE, projectId, {
      milestoneId: entity.id,
      title: dto.title,
    });
    return entity;
  }

  async updateMilestone(
    projectId: string,
    milestoneId: string,
    dto: Partial<CreateMilestoneDto>,
    user?: JwtPayload,
  ): Promise<ConstructionMilestone> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(projectId, user.sub, user, 'canEdit');
    const entity = await this.milestoneRepo.findOne({
      id: milestoneId,
      projectId,
    });
    if (!entity)
      throw new NotFoundException(`Milestone ${milestoneId} not found`);

    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.target_date !== undefined)
      entity.targetDate = dto.target_date
        ? new Date(dto.target_date)
        : undefined;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.remarks !== undefined) entity.remarks = dto.remarks;
    if (dto.start_date !== undefined)
      entity.startDate = dto.start_date ? new Date(dto.start_date) : undefined;
    if (dto.actual_start_date !== undefined)
      entity.actualStartDate = dto.actual_start_date
        ? new Date(dto.actual_start_date)
        : undefined;
    if (dto.progress !== undefined) entity.progress = String(dto.progress);
    if (dto.category !== undefined) entity.category = dto.category;
    // LI-D: audit
    entity.updatedBy = user?.sub;
    entity.updatedAt = new Date();
    await this.em.flush();

    this.logger.log(`MILESTONE_UPDATED: id=${milestoneId}`);
    this.fireLog(user, ActivityAction.UPDATE, projectId, {
      milestoneId,
      title: entity.title,
    });
    return entity;
  }

  async removeMilestone(
    projectId: string,
    milestoneId: string,
    user?: JwtPayload,
  ): Promise<void> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canDelete',
      );
    // LI-D: fetch title before delete for audit log
    const entity = await this.milestoneRepo.findOne({
      id: milestoneId,
      projectId,
    });
    if (!entity)
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    this.fireLog(user, ActivityAction.DELETE, projectId, {
      milestoneId,
      title: entity.title,
    });
    await this.em.remove(entity).flush();
    this.logger.log(`MILESTONE_DELETED: id=${milestoneId}`);
  }

  // LK-C: Batch create milestones — single transaction, max 50 rows
  async batchCreateMilestones(
    projectId: string,
    dto: BatchCreateMilestoneDto,
    user?: JwtPayload,
  ): Promise<ConstructionMilestone[]> {
    await this.findOne(projectId);
    // Record-scope guard. The single-create route above has always had one; the batch route
    // did not, and was reachable by anyone holding 'coi' module access.
    if (user)
      await this.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canCreate',
      );
    const entities = dto.items.map((item) =>
      this.milestoneRepo.create({
        projectId,
        title: item.title,
        description: item.description,
        targetDate: item.target_date ? new Date(item.target_date) : undefined,
        status: item.status || 'PENDING',
        remarks: item.remarks,
        startDate: item.start_date ? new Date(item.start_date) : undefined,
        actualStartDate: item.actual_start_date
          ? new Date(item.actual_start_date)
          : undefined,
        progress: item.progress != null ? String(item.progress) : '0.00',
        category: item.category,
        createdBy: user?.sub,
      }),
    );
    await this.em.persist(entities).flush();
    this.logger.log(
      `BATCH_MILESTONE_CREATED: ${entities.length} items, project=${projectId}`,
    );
    this.fireLog(user, ActivityAction.CREATE, projectId, {
      batch: true,
      count: entities.length,
    });
    return entities;
  }

  // LK-F: Batch create timeline entries — single transaction, max 50 rows
  async batchCreateTimelineEntries(
    projectId: string,
    dto: BatchCreateTimelineEntryDto,
    user?: JwtPayload,
  ): Promise<ConstructionTimelineEntry[]> {
    await this.findOne(projectId);
    // Record-scope guard — parity with the single-create timeline route.
    if (user)
      await this.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canCreate',
      );
    const entities = await this.timelineEntryRepo.createManyForProject(
      projectId,
      dto.items,
      user?.sub,
    );
    this.logger.log(
      `BATCH_TIMELINE_CREATED: ${entities.length} items, project=${projectId}`,
    );
    this.fireLog(user, ActivityAction.CREATE, projectId, {
      batch: true,
      count: entities.length,
    });
    return entities;
  }

  // --- Timeline Diary Entries (JW-G, ORM) ---
  async findTimelineEntries(
    projectId: string,
  ): Promise<ConstructionTimelineEntry[]> {
    await this.findOne(projectId);
    return this.timelineEntryRepo.findByProject(projectId);
  }

  async createTimelineEntry(
    projectId: string,
    dto: CreateTimelineEntryDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<ConstructionTimelineEntry> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canCreate');
    const entity = await this.timelineEntryRepo.createForProject(
      projectId,
      dto,
      userId,
    );
    this.logger.log(
      `TIMELINE_ENTRY_CREATED: id=${entity.id}, project=${projectId}, by=${userId}`,
    );
    this.fireLog(user, ActivityAction.CREATE, projectId, {
      timelineEntryId: entity.id,
      entryType: entity.entryType,
    });
    return entity;
  }

  async updateTimelineEntry(
    projectId: string,
    entryId: string,
    dto: UpdateTimelineEntryDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<ConstructionTimelineEntry> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canEdit');
    const entity = await this.timelineEntryRepo.findOneForProject(
      projectId,
      entryId,
    );
    if (!entity)
      throw new NotFoundException(`Timeline entry ${entryId} not found`);

    await this.timelineEntryRepo.updateFromDto(entity, dto);

    this.logger.log(
      `TIMELINE_ENTRY_UPDATED: id=${entryId}, project=${projectId}, by=${userId}`,
    );
    this.fireLog(user, ActivityAction.UPDATE, projectId, {
      timelineEntryId: entryId,
    });
    return entity;
  }

  async removeTimelineEntry(
    projectId: string,
    entryId: string,
    userId: string,
    user?: JwtPayload,
  ): Promise<void> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canDelete');
    const count = await this.timelineEntryRepo.deleteForProject(
      projectId,
      entryId,
    );
    if (count === 0)
      throw new NotFoundException(`Timeline entry ${entryId} not found`);
    this.logger.log(
      `TIMELINE_ENTRY_DELETED: id=${entryId}, project=${projectId}, by=${userId}`,
    );
    this.fireLog(user, ActivityAction.DELETE, projectId, {
      timelineEntryId: entryId,
    });
  }

  // --- MOV Evidence Entries (Phase KO, ORM) ---
  async listMovEntries(
    projectId: string,
    relatedEntityType?: 'MILESTONE' | 'TIMELINE_ENTRY',
    relatedEntityId?: string,
  ): Promise<ConstructionMovEntry[]> {
    await this.findOne(projectId);
    const where: FilterQuery<ConstructionMovEntry> = { projectId };
    if (relatedEntityType) where.relatedEntityType = relatedEntityType;
    if (relatedEntityId) where.relatedEntityId = relatedEntityId;
    return this.movEntryRepo.find(where, {
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMovEntry(
    projectId: string,
    dto: CreateMovEntryDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<ConstructionMovEntry> {
    await this.findOne(projectId);
    // Record-scope guard: a MOV entry is project evidence, so creating one is a write on the
    // project and needs the same assignment check as any other sub-resource.
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canCreate');

    // Validate the related entity exists and belongs to this project
    if (dto.related_entity_type === 'MILESTONE') {
      const m = await this.milestoneRepo.findOne({
        id: dto.related_entity_id,
        projectId,
      });
      if (!m)
        throw new NotFoundException(
          `Milestone ${dto.related_entity_id} not found in project ${projectId}`,
        );
    } else {
      const t = await this.timelineEntryRepo.findOneForProject(
        projectId,
        dto.related_entity_id,
      );
      if (!t)
        throw new NotFoundException(
          `Timeline entry ${dto.related_entity_id} not found in project ${projectId}`,
        );
    }

    const entity = this.movEntryRepo.create({
      projectId,
      relatedEntityType: dto.related_entity_type,
      relatedEntityId: dto.related_entity_id,
      movLink: dto.mov_link || undefined,
      movTitle: dto.mov_title,
      movDescription: dto.mov_description,
      evidenceCategory: dto.evidence_category || 'other',
      entryDate: dto.entry_date ? new Date(dto.entry_date) : undefined,
      uploadedBy: userId,
      remarks: dto.remarks,
    });
    await this.em.persist(entity).flush();
    this.logger.log(
      `MOV_ENTRY_CREATED: id=${entity.id}, project=${projectId}, by=${userId}`,
    );
    this.fireLog(user, ActivityAction.CREATE, projectId, {
      movEntryId: entity.id,
      relatedEntityType: dto.related_entity_type,
      relatedEntityId: dto.related_entity_id,
    });
    return entity;
  }

  async deleteMovEntry(
    projectId: string,
    movEntryId: string,
    userId: string,
    user?: JwtPayload,
  ): Promise<void> {
    await this.findOne(projectId);
    // Record-scope guard — deleting evidence is a write on the project.
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canDelete');
    const count = await this.movEntryRepo.nativeDelete({
      id: movEntryId,
      projectId,
    });
    if (count === 0)
      throw new NotFoundException(`MOV entry ${movEntryId} not found`);
    this.logger.log(
      `MOV_ENTRY_DELETED: id=${movEntryId}, project=${projectId}, by=${userId}`,
    );
    this.fireLog(user, ActivityAction.DELETE, projectId, {
      movEntryId,
    });
  }

  // LC-C: Upload a file as MOV evidence for an existing MOV entry
  /**
   * Attach a file to an existing MOV entry.
   *
   * Reports the same upload phases as the document and gallery paths, so every file a user
   * can send from the COI screens is tracked the same way.
   */
  async uploadMovFile(
    projectId: string,
    movEntryId: string,
    file: Express.Multer.File,
    userId: string,
    uploadId?: string,
    // Optional so existing call sites keep compiling; the controller always passes it, and
    // without it the record-scope guard below cannot run.
    user?: JwtPayload,
  ): Promise<ConstructionMovEntry> {
    // Record-scope guard, before any progress channel is opened — a caller with no claim on
    // the project should be refused rather than handed a live upload channel.
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canUpload');
    if (uploadId) this.uploadProgress.open(uploadId, userId);
    this.uploadProgress.emit(uploadId, userId, 'received', {
      fileName: file?.originalname,
    });
    try {
      const entry = await this.persistMovFile(
        projectId,
        movEntryId,
        file,
        userId,
        uploadId,
      );
      this.uploadProgress.finish(uploadId, userId, {
        fileName: file?.originalname,
      });
      return entry;
    } catch (err) {
      this.uploadProgress.fail(
        uploadId,
        userId,
        err instanceof HttpException ? err.message : 'Upload failed',
        { fileName: file?.originalname },
      );
      throw err;
    }
  }

  private async persistMovFile(
    projectId: string,
    movEntryId: string,
    file: Express.Multer.File,
    userId: string,
    uploadId?: string,
  ): Promise<ConstructionMovEntry> {
    await this.findOne(projectId);
    const entry = await this.movEntryRepo.findOne({
      id: movEntryId,
      projectId,
    });
    if (!entry)
      throw new NotFoundException(`MOV entry ${movEntryId} not found`);
    if (!file) throw new BadRequestException('File is required');

    this.uploadProgress.emit(uploadId, userId, 'validating', {
      fileName: file.originalname,
    });
    this.uploadsService.validateFile(file);
    this.uploadProgress.emit(uploadId, userId, 'storing', {
      fileName: file.originalname,
    });
    const uploadResult = await this.uploadsService.uploadFile(
      file,
      userId,
      'construction_mov',
      projectId,
    );
    this.uploadProgress.emit(uploadId, userId, 'stored', {
      fileName: uploadResult.originalName,
    });
    entry.filePath = uploadResult.filePath;
    entry.fileName = file.originalname;
    entry.fileSize = file.size;
    entry.mimeType = file.mimetype;
    this.uploadProgress.emit(uploadId, userId, 'persisting', {
      fileName: file.originalname,
    });
    await this.em.flush();
    this.logger.log(
      `MOV_FILE_UPLOADED: id=${movEntryId}, project=${projectId}, by=${userId}`,
    );
    return entry;
  }

  // --- POW Items REMOVED (Phase ME, 2026-05-21) ---
  // POW table archived via Migration20260521030000_ArchivePowItemsTable

  // --- Document Governance / Checklist (Phase KB-E) ---

  /**
   * KB-E: Returns admin-managed reference list of all CPES document types.
   * Used by frontend to render checklist categories and admin extension UI.
   */
  async findDocumentTypes(): Promise<ConstructionDocumentType[]> {
    return this.docTypeRepo.find(
      { isActive: true },
      { orderBy: { groupCode: 'asc', sortOrder: 'asc' } },
    );
  }

  /**
   * ZX-1: Returns document types grouped by group_code for the attachment hub.
   * Backward-compatible — flat `findDocumentTypes()` remains unchanged.
   */
  async findDocumentTypesGrouped(): Promise<
    {
      groupCode: string;
      groupLabel: string;
      types: ConstructionDocumentType[];
    }[]
  > {
    const all = await this.docTypeRepo.find(
      { isActive: true },
      { orderBy: { groupCode: 'asc', sortOrder: 'asc' } },
    );
    const groups = new Map<
      string,
      {
        groupCode: string;
        groupLabel: string;
        types: ConstructionDocumentType[];
      }
    >();
    for (const t of all) {
      if (!groups.has(t.groupCode)) {
        groups.set(t.groupCode, {
          groupCode: t.groupCode,
          groupLabel: t.groupLabel,
          types: [],
        });
      }
      groups.get(t.groupCode)!.types.push(t);
    }
    return Array.from(groups.values());
  }

  /**
   * ZX-2: Flat map of typeCode → templateUrl for all active document types.
   * Lets the hub show "template available" indicators without re-fetching
   * the full type list.
   */
  async getDocumentTypeTemplateStatus(): Promise<
    { typeCode: string; templateUrl: string | null }[]
  > {
    const conn = this.em.getConnection();
    const rows = await conn.execute(
      `SELECT type_code, template_url
         FROM construction_document_types
        WHERE is_active = true
        ORDER BY group_code ASC, sort_order ASC`,
    );
    return (
      rows as Array<{ type_code: string; template_url: string | null }>
    ).map((r) => ({
      typeCode: r.type_code,
      templateUrl: r.template_url ?? null,
    }));
  }

  /**
   * KB-E: Returns the per-project document checklist. On first call for a
   * project, lazily seeds checklist rows from the active type reference
   * (one row per active document type). Idempotent — re-call is safe.
   */
  async findDocumentChecklist(projectId: string): Promise<
    Array<
      ConstructionDocumentChecklist & {
        documentType?: ConstructionDocumentType;
      }
    >
  > {
    await this.findOne(projectId);

    const activeTypes = await this.docTypeRepo.find(
      { isActive: true },
      { orderBy: { groupCode: 'asc', sortOrder: 'asc' } },
    );

    // Lazy initialization: insert missing checklist items
    const existing = await this.docChecklistRepo.find({ projectId });
    const existingTypeIds = new Set(existing.map((c) => c.documentTypeId));
    const missing = activeTypes.filter((t) => !existingTypeIds.has(t.id));
    if (missing.length > 0) {
      for (const t of missing) {
        const item = this.docChecklistRepo.create({
          projectId,
          documentTypeId: t.id,
          submissionStatus: 'NOT_SUBMITTED',
          currentVersion: 0,
        });
        this.em.persist(item);
      }
      await this.em.flush();
    }

    // Re-fetch with fresh state and join document type info
    const rows = await this.docChecklistRepo.find({ projectId });
    const typeById = new Map(activeTypes.map((t) => [t.id, t]));
    return rows.map((r) => ({
      ...r,
      documentType: typeById.get(r.documentTypeId),
    }));
  }

  async updateDocumentChecklistItem(
    projectId: string,
    itemId: string,
    dto: UpdateDocumentChecklistDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<ConstructionDocumentChecklist> {
    await this.findOne(projectId);
    // Record-scope guard: the checklist records compliance status for this project, so
    // changing it is a project write.
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canEdit');
    const entity = await this.docChecklistRepo.findOne({
      id: itemId,
      projectId,
    });
    if (!entity)
      throw new NotFoundException(`Checklist item ${itemId} not found`);

    // KB-D: Snapshot for field-delta audit
    const before = {
      submissionStatus: entity.submissionStatus,
      reviewNotes: entity.reviewNotes,
      expiryDate: entity.expiryDate,
      linkedDocumentId: entity.linkedDocumentId,
      currentVersion: entity.currentVersion,
      remarks: entity.remarks,
    };

    if (dto.submission_status !== undefined) {
      entity.submissionStatus = dto.submission_status;
      // Auto-stamp submitted/reviewed identity based on status transition
      if (dto.submission_status === 'SUBMITTED' && !entity.submittedAt) {
        entity.submittedBy = userId;
        entity.submittedAt = new Date();
      }
      if (
        dto.submission_status === 'APPROVED' ||
        dto.submission_status === 'REJECTED'
      ) {
        entity.reviewedBy = userId;
        entity.reviewedAt = new Date();
      }
    }
    if (dto.review_notes !== undefined) entity.reviewNotes = dto.review_notes;
    if (dto.expiry_date !== undefined)
      entity.expiryDate = dto.expiry_date
        ? new Date(dto.expiry_date)
        : undefined;
    if (dto.linked_document_id !== undefined)
      entity.linkedDocumentId = dto.linked_document_id;
    if (dto.current_version !== undefined)
      entity.currentVersion = dto.current_version;
    if (dto.remarks !== undefined) entity.remarks = dto.remarks;
    await this.em.flush();

    const after = {
      submissionStatus: entity.submissionStatus,
      reviewNotes: entity.reviewNotes,
      expiryDate: entity.expiryDate,
      linkedDocumentId: entity.linkedDocumentId,
      currentVersion: entity.currentVersion,
      remarks: entity.remarks,
    };
    const changedFields = Object.keys(after).filter(
      (k) =>
        JSON.stringify((before as any)[k]) !==
        JSON.stringify((after as any)[k]),
    );
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    for (const k of changedFields) {
      previousValues[k] = (before as any)[k];
      newValues[k] = (after as any)[k];
    }

    this.logger.log(
      `DOC_CHECKLIST_UPDATED: id=${itemId}, project=${projectId}, by=${userId}, status=${entity.submissionStatus}`,
    );
    this.fireLog(user, ActivityAction.UPDATE, projectId, {
      section: 'CHECKLIST',
      entityType: 'CONSTRUCTION_DOCUMENT_CHECKLIST',
      checklistItemId: itemId,
      changedFields,
      previousValues,
      newValues,
    });
    return entity;
  }

  // KV-D2: per-group document checklist remarks
  async updateDocumentRemarks(
    projectId: string,
    groupCode: string,
    remarks: unknown,
    userId: string,
    user?: JwtPayload,
  ): Promise<void> {
    const entity = await this.cpRepo.findOne({ id: projectId });
    if (!entity) throw new NotFoundException(`Project ${projectId} not found`);
    // Record-scope guard — checklist remarks are stored on the project row itself.
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canEdit');
    const current: Record<
      string,
      string | Array<{ text: string; author: string; timestamp: string }>
    > = {};
    if (
      entity.documentChecklistRemarks &&
      typeof entity.documentChecklistRemarks === 'object'
    ) {
      Object.entries(entity.documentChecklistRemarks).forEach(
        ([key, value]) => {
          if (typeof value === 'string') {
            current[key] = value;
            return;
          }
          if (Array.isArray(value)) {
            const entries = value
              .map((entry: any) => ({
                text: String(entry?.text ?? '').trim(),
                author: String(entry?.author ?? ''),
                timestamp: String(entry?.timestamp ?? ''),
              }))
              .filter((entry) => entry.text.length > 0);
            current[key] = entries;
          }
        },
      );
    }
    const normalizedRemarks = Array.isArray(remarks)
      ? remarks
          .map((entry: any) => ({
            text: String(entry?.text ?? '').trim(),
            author: String(entry?.author ?? user?.email ?? userId),
            timestamp: String(entry?.timestamp ?? new Date().toISOString()),
          }))
          .filter((entry) => entry.text.length > 0)
      : String(remarks ?? '').trim();
    entity.documentChecklistRemarks = {
      ...current,
      [groupCode]: normalizedRemarks,
    };
    await this.em.flush();
    this.fireLog(user, ActivityAction.UPDATE, projectId, {
      section: 'CHECKLIST_REMARKS',
      action: 'update_document_remarks',
      groupCode,
    });
  }

  // AAA-F-3: per-project custom Key Document repository sections
  async updateCustomKeySections(
    projectId: string,
    sections: Array<{ id: string; label: string; typeCode: string }>,
    user?: JwtPayload,
  ): Promise<Array<{ id: string; label: string; typeCode: string }>> {
    const entity = await this.cpRepo.findOne({ id: projectId });
    if (!entity) throw new NotFoundException(`Project ${projectId} not found`);
    // Record-scope guard — custom Key Document sections are per-project configuration.
    if (user)
      await this.assertProjectPermission(projectId, user.sub, user, 'canEdit');
    entity.customKeySections = Array.isArray(sections) ? sections : [];
    await this.em.flush();
    this.fireLog(user, ActivityAction.UPDATE, projectId, {
      section: 'KEY_DOCUMENTS',
      action: 'update_custom_key_sections',
      count: entity.customKeySections.length,
    });
    return entity.customKeySections;
  }

  // SSS-B: per-project custom Supporting Document repository folders
  async updateCustomSupportingSections(
    projectId: string,
    sections: Array<{ id: string; label: string; typeCode: string }>,
    user?: JwtPayload,
  ): Promise<Array<{ id: string; label: string; typeCode: string }>> {
    const entity = await this.cpRepo.findOne({ id: projectId });
    if (!entity) throw new NotFoundException(`Project ${projectId} not found`);
    // Record-scope guard — custom Supporting Document folders are per-project configuration.
    if (user)
      await this.assertProjectPermission(projectId, user.sub, user, 'canEdit');
    entity.customSupportingSections = Array.isArray(sections) ? sections : [];
    await this.em.flush();
    this.fireLog(user, ActivityAction.UPDATE, projectId, {
      section: 'SUPPORTING_DOCUMENTS',
      action: 'update_custom_supporting_sections',
      count: entity.customSupportingSections.length,
    });
    return entity.customSupportingSections;
  }

  // NI (2026-05-21): Financials methods removed; data flows through
  // construction_progress_reports instead. Table archived via migration 030000.

  // --- Gallery (ORM) ---
  async findGallery(
    projectId: string,
    query: QueryGalleryDto,
  ): Promise<PaginatedResponse<ConstructionGallery>> {
    await this.findOne(projectId);

    const { page = 1, limit = 20, sort = 'uploadedAt', order = 'desc' } = query;
    const sortKey = ['uploadedAt', 'category'].includes(sort)
      ? sort
      : 'uploadedAt';
    const sortOrder = (order.toLowerCase() === 'asc' ? 'asc' : 'desc') as
      | 'asc'
      | 'desc';

    const where: FilterQuery<ConstructionGallery> = { projectId };
    if (query.category) where.category = query.category;

    const [items, total] = await this.galleryRepo.findAndCount(where, {
      limit,
      offset: (page - 1) * limit,
      orderBy: { [sortKey]: sortOrder },
    });

    return createPaginatedResponse(items, total, page, limit);
  }

  async findGalleryItem(
    projectId: string,
    galleryId: string,
  ): Promise<ConstructionGallery> {
    await this.findOne(projectId);
    const entity = await this.galleryRepo.findOne({ id: galleryId, projectId });
    if (!entity)
      throw new NotFoundException(`Gallery item ${galleryId} not found`);
    return entity;
  }

  /**
   * Upload a gallery image.
   *
   * Reports the same phases as a document upload over the caller's SSE channel, for the
   * same reason: once the browser has sent the last byte it cannot see the storage write
   * or the database commit, and a 10 MB photo spends real time in both.
   */
  async createGalleryItem(
    projectId: string,
    file: Express.Multer.File,
    dto: CreateGalleryDto,
    userId: string,
    user?: JwtPayload,
    uploadId?: string,
  ): Promise<ConstructionGallery> {
    if (uploadId) this.uploadProgress.open(uploadId, userId);
    this.uploadProgress.emit(uploadId, userId, 'received', {
      fileName: file?.originalname,
    });
    try {
      const entity = await this.persistGalleryItem(
        projectId,
        file,
        dto,
        userId,
        user,
        uploadId,
      );
      this.uploadProgress.finish(uploadId, userId, {
        fileName: file?.originalname,
      });
      return entity;
    } catch (err) {
      this.uploadProgress.fail(
        uploadId,
        userId,
        err instanceof HttpException ? err.message : 'Upload failed',
        { fileName: file?.originalname },
      );
      throw err;
    }
  }

  private async persistGalleryItem(
    projectId: string,
    file: Express.Multer.File,
    dto: CreateGalleryDto,
    userId: string,
    user?: JwtPayload,
    uploadId?: string,
  ): Promise<ConstructionGallery> {
    await this.findOne(projectId);
    // Record-scope guard, at the single choke point the upload route and any future caller
    // both pass through.
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canUpload');

    if (!file) throw new BadRequestException('Image file is required');

    // KF-AB: PROFILE category is limited to 3 images per project
    if (dto.category === 'PROFILE') {
      const profileCount = await this.galleryRepo.count({
        projectId,
        category: 'PROFILE',
      });
      if (profileCount >= 3) {
        throw new BadRequestException(
          'Maximum 3 PROFILE images allowed per project',
        );
      }
    }

    this.uploadProgress.emit(uploadId, userId, 'validating', {
      fileName: file.originalname,
    });
    // Reject an oversized or wrong-typed image before the storage write, so the failure is
    // reported against the phase that actually rejected it.
    this.uploadsService.validateFile(file);
    this.uploadProgress.emit(uploadId, userId, 'storing', {
      fileName: file.originalname,
    });
    const uploadResult = await this.uploadsService.uploadFile(
      file,
      userId,
      'construction_gallery',
      projectId,
    );
    this.uploadProgress.emit(uploadId, userId, 'stored', {
      fileName: uploadResult.originalName,
    });

    const entity = this.galleryRepo.create({
      projectId,
      imageUrl: uploadResult.filePath,
      caption: dto.caption,
      category: dto.category || 'IN_PROGRESS',
      isFeatured: dto.is_featured || false,
      // LB-C: persist user-supplied photo capture date when provided
      imageTakenDate: dto.image_taken_date
        ? new Date(dto.image_taken_date)
        : undefined,
    });
    this.uploadProgress.emit(uploadId, userId, 'persisting', {
      fileName: file.originalname,
    });
    await this.em.persist(entity).flush();

    this.logger.log(
      `GALLERY_CREATED: id=${entity.id}, project=${projectId}, by=${userId}`,
    );
    this.fireLog(user, ActivityAction.UPLOAD, projectId, {
      section: dto.category === 'PROFILE' ? 'GALLERY_PROFILE' : 'GALLERY',
      galleryId: entity.id,
      category: entity.category,
    });
    return entity;
  }

  async updateGalleryItem(
    projectId: string,
    galleryId: string,
    dto: Partial<CreateGalleryDto>,
    userId: string,
    // Optional so existing call sites keep compiling; the controller always passes it.
    user?: JwtPayload,
  ): Promise<ConstructionGallery> {
    const entity = await this.findGalleryItem(projectId, galleryId);
    // Record-scope guard — editing a caption or category is still a project write.
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canEdit');

    if (dto.caption !== undefined) entity.caption = dto.caption;
    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.is_featured !== undefined) entity.isFeatured = dto.is_featured;
    if (dto.image_taken_date !== undefined)
      entity.imageTakenDate = dto.image_taken_date
        ? new Date(dto.image_taken_date)
        : undefined;
    await this.em.flush();

    this.logger.log(`GALLERY_UPDATED: id=${galleryId}, by=${userId}`);
    return entity;
  }

  async removeGalleryItem(
    projectId: string,
    galleryId: string,
    userId: string,
    user?: JwtPayload,
  ): Promise<void> {
    if (user)
      await this.assertProjectPermission(projectId, userId, user, 'canDelete');
    const entity = await this.findGalleryItem(projectId, galleryId);

    if (entity.imageUrl) {
      await this.uploadsService.deleteFile(entity.imageUrl);
    }

    await this.galleryRepo.nativeDelete({ id: galleryId });
    this.logger.log(`GALLERY_DELETED: id=${galleryId}, by=${userId}`);
    this.fireLog(user, ActivityAction.REMOVE_ATTACHMENT, projectId, {
      section: 'GALLERY',
      galleryId,
    });
  }

  // ============================================================
  // Phase JN-D: Document / Attachment / External Link uploads
  // ============================================================

  /**
   * Upload a file, or register an external link, against a project.
   *
   * When an uploadId is supplied the caller is watching an SSE channel, and each stage
   * below is published to it. Those stages describe what happens AFTER the request body
   * has arrived: Multer has already buffered the whole file before this method runs, so
   * the transfer itself is not observable here. The browser measures that part with
   * XMLHttpRequest upload progress.
   */
  async addDocumentToProject(
    projectId: string,
    file: Express.Multer.File | undefined,
    dto: UploadDocumentDto,
    userId: string,
    user?: JwtPayload,
    uploadId?: string,
  ): Promise<Document> {
    if (uploadId) this.uploadProgress.open(uploadId, userId);
    this.uploadProgress.emit(uploadId, userId, 'received', {
      fileName: file?.originalname ?? dto.title,
    });
    try {
      const doc = await this.persistProjectDocument(
        projectId,
        file,
        dto,
        userId,
        user,
        uploadId,
      );
      this.uploadProgress.finish(uploadId, userId, {
        fileName: doc.fileName,
        document: wrap(doc).toJSON(),
      });
      return doc;
    } catch (err) {
      // Only an HttpException message is safe to republish: it is the same text the HTTP
      // response already carries. Anything else (a driver error, for instance) would make
      // the stream a second, less guarded disclosure path.
      this.uploadProgress.fail(
        uploadId,
        userId,
        err instanceof HttpException ? err.message : 'Upload failed',
        { fileName: file?.originalname },
      );
      throw err;
    }
  }

  private async persistProjectDocument(
    projectId: string,
    file: Express.Multer.File | undefined,
    dto: UploadDocumentDto,
    userId: string,
    user?: JwtPayload,
    uploadId?: string,
  ): Promise<Document> {
    await this.findOne(projectId);
    if (user) {
      await this.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canUpload',
      );
    }

    if (!file && !dto.externalLink) {
      throw new BadRequestException(
        'Either a file upload or an externalLink is required',
      );
    }
    if (file && dto.externalLink) {
      throw new BadRequestException(
        'Provide either a file OR an externalLink, not both',
      );
    }

    if (dto.folder_id) {
      const folder = await this.docFolderRepo.findOne({
        id: dto.folder_id,
        projectId,
      });
      if (!folder) {
        throw new BadRequestException(
          `Folder ${dto.folder_id} does not belong to project ${projectId}`,
        );
      }
    }

    let filePath: string;
    let fileName: string;
    let fileSize: number;
    let mimeType: string;

    if (file) {
      // uploadFile() validates the file and then writes it to storage. On a large document
      // the MinIO PUT is the slow step, and it is invisible to the browser, which is the
      // whole reason these two events exist.
      this.uploadProgress.emit(uploadId, userId, 'validating', {
        fileName: file.originalname,
      });
      // Run the size/type/extension checks here so a rejected file fails during the
      // 'validating' phase rather than appearing to fail mid-write. uploadFile() repeats
      // them, which keeps it safe to call directly from anywhere else.
      this.uploadsService.validateFile(file);
      this.uploadProgress.emit(uploadId, userId, 'storing', {
        fileName: file.originalname,
      });
      const upload = await this.uploadsService.uploadFile(file, userId);
      this.uploadProgress.emit(uploadId, userId, 'stored', {
        fileName: upload.originalName,
      });
      filePath = upload.filePath;
      fileName = upload.originalName;
      fileSize = upload.fileSize;
      mimeType = upload.mimeType;
    } else {
      filePath = dto.externalLink!;
      fileName = dto.title || 'External Link';
      fileSize = 0;
      const isGDriveLink = /drive\.google\.com|docs\.google\.com/i.test(
        dto.externalLink!,
      );
      mimeType = isGDriveLink
        ? 'application/x-google-drive-link'
        : 'application/x-external-link';
    }

    // OOO-A: version auto-increment for folder submissions. Each new upload into a
    // SUBMISSIONS/folder node gets version = (current max in folder) + 1, so the
    // submissions table doubles as version history. Non-folder uploads stay at v1.
    let version = 1;
    if (dto.folder_id) {
      const latest = await this.documentRepo.findOne(
        { folderId: dto.folder_id },
        { orderBy: { version: 'desc' } },
      );
      version = (latest?.version ?? 0) + 1;
    }

    const doc = this.documentRepo.create({
      documentableType: 'CONSTRUCTION_PROJECT',
      documentableId: projectId,
      documentType: dto.documentType,
      fileName,
      filePath,
      fileSize,
      mimeType,
      description: dto.description,
      category: dto.category,
      lifecycleStatus: dto.lifecycleStatus || 'ACTIVE',
      folderId: dto.folder_id ?? null,
      version,
      uploadedBy: userId,
      createdBy: userId,
    });
    this.uploadProgress.emit(uploadId, userId, 'persisting', {
      fileName,
    });
    await this.em.persistAndFlush(doc);

    // YYY-C: Auto-link checklist — fires on ANY upload whose documentType matches a
    // KB-E taxonomy typeCode. Removed NOT_SUBMITTED filter so re-uploads also update
    // the checklist (linkedDocumentId, submittedAt, currentVersion). This ensures the
    // Compliance Checklist always reflects the latest file without manual intervention.
    if (dto.documentType) {
      const docType = await this.docTypeRepo.findOne({
        typeCode: dto.documentType,
      });
      if (docType) {
        const checklistItem = await this.docChecklistRepo.findOne({
          projectId,
          documentTypeId: docType.id,
        });
        if (checklistItem) {
          const wasFirstSubmission =
            checklistItem.submissionStatus === 'NOT_SUBMITTED';
          checklistItem.linkedDocumentId = doc.id;
          checklistItem.submittedAt = new Date();
          checklistItem.submittedBy = userId;
          checklistItem.currentVersion =
            (checklistItem.currentVersion ?? 0) + 1;
          checklistItem.submissionStatus = 'SUBMITTED';
          await this.em.persistAndFlush(checklistItem);
          this.logger.log(
            wasFirstSubmission
              ? `CHECKLIST_AUTO_LINKED: project=${projectId}, checklist=${checklistItem.id}, doc=${doc.id}, typeCode=${dto.documentType}`
              : `CHECKLIST_AUTO_UPDATED: project=${projectId}, checklist=${checklistItem.id}, doc=${doc.id}, typeCode=${dto.documentType}, version=${checklistItem.currentVersion}`,
          );
        }
      }
    }

    const KEY_DOC_TYPECODES = [
      'PROJECT_PROFILE',
      'FEASIBILITY_STUDY',
      'HGDG_FORM',
      'FLOOR_PLAN',
      'POW',
    ];
    this.logger.log(
      `DOCUMENT_UPLOADED: project=${projectId}, doc=${doc.id}, type=${dto.documentType}, by=${userId}`,
    );
    this.fireLog(user, ActivityAction.UPLOAD, projectId, {
      section:
        dto.documentType && KEY_DOC_TYPECODES.includes(dto.documentType)
          ? 'KEY_DOC'
          : 'DOCUMENT',
      documentId: doc.id,
      fileName,
      documentType: dto.documentType,
    });
    return doc;
  }

  /**
   * Every document attached to the project: uploaded files and external links alike,
   * newest first. Soft-deleted rows are excluded by the entity's default notDeleted filter.
   *
   * Returns plain objects rather than entities. uploadedByName is joined in below, and an
   * entity only serialises its mapped @Property fields, so assigning the name onto the
   * entity silently dropped it before it ever reached the client: the query ran on every
   * request and the UI column was always blank.
   */
  async listProjectDocuments(
    projectId: string,
  ): Promise<Array<Record<string, unknown> & { uploadedByName?: string }>> {
    const docs = await this.documentRepo.find(
      { documentableType: 'CONSTRUCTION_PROJECT', documentableId: projectId },
      { orderBy: { createdAt: 'desc' } },
    );
    if (!docs.length) return [];
    const uploaderIds = [
      ...new Set(docs.map((d) => d.uploadedBy).filter(Boolean)),
    ];
    // VVV-A: MikroORM conn.execute uses Knex positional '?' placeholders, which
    // FLATTEN an array binding. `WHERE id = ANY(?)` therefore expanded to
    // `ANY($1, $2, ...)` (invalid SQL) → HTTP 500 whenever a project had documents.
    // Use the codebase-standard IN(placeholders) + flat params instead.
    if (!uploaderIds.length) {
      return docs.map((d) => ({
        ...wrap(d).toJSON(),
        uploadedByName: undefined,
      }));
    }
    const placeholders = uploaderIds.map(() => '?').join(', ');
    const userRows = (await this.em
      .getConnection()
      .execute(
        `SELECT id, COALESCE(display_name, first_name || ' ' || last_name, email) AS display_name FROM users WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
        uploaderIds,
      )) as Array<{ id: string; display_name: string }>;
    const nameMap = new Map(userRows.map((r) => [r.id, r.display_name]));
    return docs.map((d) => ({
      ...wrap(d).toJSON(),
      uploadedByName: nameMap.get(d.uploadedBy),
    }));
  }

  // UUU-C: Dynamic template discovery. Scans the static templates directory at
  // request time and returns a manifest of every available .docx — both the flat
  // type-code aliases (SD_ECO_001.docx ...) served at /templates and the original
  // files under the SHAREABLE SUPPORT DOCUMENTS subtree. No hardcoded paths.
  async getTemplateManifest(): Promise<{
    templates: Array<{
      typeCode: string;
      url: string;
      fileName: string;
      category: string;
    }>;
  }> {
    const templateDir = path.join(process.cwd(), 'public', 'templates');
    const entries: Array<{
      typeCode: string;
      url: string;
      fileName: string;
      category: string;
    }> = [];
    if (!fs.existsSync(templateDir)) return { templates: [] };

    // Flat type-code files (SD_ECO_001.docx, etc.)
    const flatFiles = fs
      .readdirSync(templateDir)
      .filter((f) => f.endsWith('.docx') && /^SD_ECO_\d{3}/.test(f));
    for (const file of flatFiles) {
      entries.push({
        typeCode: file.replace('.docx', ''),
        url: `/templates/${file}`,
        fileName: file,
        category: 'SD',
      });
    }

    // Subdirectory tree (authoritative source folders)
    const subdirBase = path.join(templateDir, 'SHAREABLE SUPPORT DOCUMENTS');
    if (fs.existsSync(subdirBase)) {
      for (const cat of fs.readdirSync(subdirBase)) {
        const catPath = path.join(subdirBase, cat);
        if (!fs.statSync(catPath).isDirectory()) continue;
        for (const file of fs
          .readdirSync(catPath)
          .filter((f) => f.endsWith('.docx'))) {
          entries.push({
            typeCode: file,
            url: `/templates/SHAREABLE SUPPORT DOCUMENTS/${cat}/${file}`,
            fileName: file,
            category: cat,
          });
        }
      }
    }
    return { templates: entries };
  }

  async listDocumentFolders(projectId: string): Promise<any[]> {
    await this.findOne(projectId);
    const folders = await this.docFolderRepo.find(
      { projectId },
      { orderBy: [{ sortOrder: 'asc' }, { folderName: 'asc' }] },
    );

    const nodes = new Map<string, any>();
    folders.forEach((folder) => {
      nodes.set(folder.id, {
        id: folder.id,
        projectId: folder.projectId,
        parentId: folder.parentId ?? null,
        folderName: folder.folderName,
        groupCode: folder.groupCode ?? null,
        nodeType: folder.nodeType,
        sortOrder: folder.sortOrder,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        children: [],
      });
    });

    const roots: any[] = [];
    nodes.forEach((node) => {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  async createDocumentFolder(
    projectId: string,
    dto: {
      folder_name: string;
      parent_id?: string;
      group_code?: string;
      node_type?: string;
      sort_order?: number;
    },
    user: JwtPayload,
  ): Promise<ConstructionDocumentFolder> {
    await this.findOne(projectId);
    await this.assertProjectPermission(projectId, user.sub, user, 'canCreate');

    if (dto.parent_id) {
      const parent = await this.docFolderRepo.findOne({
        id: dto.parent_id,
        projectId,
      });
      if (!parent) {
        throw new BadRequestException(
          `Parent folder ${dto.parent_id} does not belong to project ${projectId}`,
        );
      }
    }

    const entity = this.docFolderRepo.create({
      projectId,
      parentId: dto.parent_id ?? null,
      folderName: dto.folder_name.trim(),
      groupCode: dto.group_code?.trim() || undefined,
      nodeType: dto.node_type || 'CONTAINER',
      sortOrder: dto.sort_order ?? 0,
      createdBy: user.sub,
      updatedBy: user.sub,
    });
    await this.em.persistAndFlush(entity);
    this.fireLog(user, ActivityAction.CREATE, projectId, {
      section: 'DOCUMENT_FOLDER',
      folderId: entity.id,
      folderName: entity.folderName,
      parentId: entity.parentId,
    });
    return entity;
  }

  async updateDocumentFolder(
    projectId: string,
    folderId: string,
    dto: {
      folder_name?: string;
      parent_id?: string;
      group_code?: string;
      node_type?: string;
      sort_order?: number;
    },
    user: JwtPayload,
  ): Promise<ConstructionDocumentFolder> {
    await this.findOne(projectId);
    await this.assertProjectPermission(projectId, user.sub, user, 'canEdit');
    const entity = await this.docFolderRepo.findOne({
      id: folderId,
      projectId,
    });
    if (!entity) {
      throw new NotFoundException(
        `Folder ${folderId} not found for project ${projectId}`,
      );
    }

    if (dto.parent_id) {
      if (dto.parent_id === folderId) {
        throw new BadRequestException('Folder parent cannot reference itself');
      }
      const parent = await this.docFolderRepo.findOne({
        id: dto.parent_id,
        projectId,
      });
      if (!parent) {
        throw new BadRequestException(
          `Parent folder ${dto.parent_id} does not belong to project ${projectId}`,
        );
      }
      entity.parentId = dto.parent_id;
    }

    if (dto.folder_name !== undefined)
      entity.folderName = dto.folder_name.trim();
    if (dto.group_code !== undefined)
      entity.groupCode = dto.group_code?.trim() || undefined;
    if (dto.node_type !== undefined) entity.nodeType = dto.node_type;
    if (dto.sort_order !== undefined) entity.sortOrder = dto.sort_order;
    entity.updatedBy = user.sub;

    await this.em.flush();
    this.fireLog(user, ActivityAction.UPDATE, projectId, {
      section: 'DOCUMENT_FOLDER',
      folderId,
    });
    return entity;
  }

  async removeDocumentFolder(
    projectId: string,
    folderId: string,
    user: JwtPayload,
  ): Promise<void> {
    await this.findOne(projectId);
    await this.assertProjectPermission(projectId, user.sub, user, 'canDelete');
    const entity = await this.docFolderRepo.findOne({
      id: folderId,
      projectId,
    });
    if (!entity) {
      throw new NotFoundException(
        `Folder ${folderId} not found for project ${projectId}`,
      );
    }

    const childCount = await this.docFolderRepo.count({
      parentId: folderId,
      projectId,
    });
    if (childCount > 0) {
      throw new ConflictException(
        'Cannot delete a folder that still has child folders',
      );
    }

    const docCount = await this.documentRepo.count({
      folderId,
      documentableType: 'CONSTRUCTION_PROJECT',
      documentableId: projectId,
    });
    if (docCount > 0) {
      throw new ConflictException(
        'Cannot delete a folder that still contains documents',
      );
    }

    entity.deletedAt = new Date();
    entity.deletedBy = user.sub;
    await this.em.flush();
    this.fireLog(user, ActivityAction.REMOVE_ATTACHMENT, projectId, {
      section: 'DOCUMENT_FOLDER',
      folderId,
    });
  }

  // CCC-A: Stream a stored document with original filename + MIME, firing DOWNLOAD audit.
  async streamDocument(
    projectId: string,
    docId: string,
    user: JwtPayload,
    res: Response,
  ): Promise<StreamableFile> {
    const doc = await this.documentRepo.findOne({
      id: docId,
      documentableType: 'CONSTRUCTION_PROJECT',
      documentableId: projectId,
    });
    if (!doc) {
      throw new NotFoundException(
        `Document ${docId} not found for project ${projectId}`,
      );
    }
    if (doc.mimeType === 'application/x-google-drive-link') {
      throw new BadRequestException('External links are not downloadable');
    }
    // MINIO-4: storage-agnostic read. Opened before the headers and the audit
    // entry so a missing object still 404s without logging a DOWNLOAD that never
    // happened — every driver's getStream() throws NotFoundException carrying
    // the same 'Physical file is missing on the server' message the old
    // fileExists() guard produced, so this needs no separate existence probe.
    const stream = await this.uploadsService.getStream(doc.filePath);
    res.set({
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
    });
    this.fireLog(user, ActivityAction.DOWNLOAD, projectId, {
      section: 'DOCUMENT',
      docId,
      fileName: doc.fileName,
      documentType: doc.documentType,
    });
    return new StreamableFile(stream);
  }

  // ZT-3: Soft-delete activation — never hard-deletes; never destroys physical files.
  // Deletion guard: if the doc has submission history, the checklist link is preserved.
  async removeDocument(
    projectId: string,
    docId: string,
    user?: JwtPayload,
  ): Promise<void> {
    if (user)
      await this.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canDelete',
      );
    const doc = await this.documentRepo.findOne({
      id: docId,
      documentableType: 'CONSTRUCTION_PROJECT',
      documentableId: projectId,
    });
    if (!doc) {
      throw new NotFoundException(
        `Document ${docId} not found for project ${projectId}`,
      );
    }

    const conn = this.em.getConnection();
    const subRows = await conn.execute(
      'SELECT COUNT(*)::int AS n FROM construction_document_submissions WHERE document_id = ?',
      [docId],
    );
    const hasHistory = ((subRows[0] as any)?.n ?? 0) > 0;

    // Soft-delete: set deletedAt; do NOT call uploadsService.deleteFile()
    doc.deletedAt = new Date();
    doc.deletedBy = user?.sub;
    await this.em.flush();

    if (!hasHistory) {
      // No submission history — safe to clear the checklist pointer
      const staleItems = await this.docChecklistRepo.find({
        linkedDocumentId: docId,
      } as any);
      if (staleItems.length > 0) {
        for (const item of staleItems) {
          item.linkedDocumentId = undefined;
          item.submissionStatus = 'NOT_SUBMITTED';
          item.submittedAt = undefined;
          item.submittedBy = undefined;
        }
        await this.em.persistAndFlush(staleItems);
        this.logger.log(
          `CHECKLIST_DELINKED: project=${projectId}, doc=${docId}, cleared=${staleItems.length} checklist item(s)`,
        );
      }
    } else {
      this.logger.log(
        `DOC_SOFT_DELETED_WITH_HISTORY: project=${projectId}, doc=${docId} — checklist link preserved`,
      );
    }

    this.fireLog(user, ActivityAction.REMOVE_ATTACHMENT, projectId, {
      section: 'DOCUMENT',
      docId,
      softDeleted: true,
      historyPreserved: hasHistory,
    });
  }

  // ZT-5: List all submission versions for a checklist item (immutable ledger)
  async getDocumentSubmissions(
    projectId: string,
    checklistItemId: string,
  ): Promise<unknown[]> {
    await this.findOne(projectId);
    const conn = this.em.getConnection();
    return conn.execute(
      `SELECT s.id, s.checklist_item_id, s.project_id, s.document_id,
              s.version, s.submitted_by, s.submitted_at, s.submission_notes, s.created_at,
              d.file_name AS original_name, d.file_path, d.file_size,
              (u.first_name || ' ' || u.last_name) AS submitter_name
         FROM construction_document_submissions s
         JOIN documents d ON d.id = s.document_id
         JOIN users u ON u.id = s.submitted_by
        WHERE s.checklist_item_id = ?
          AND s.project_id = ?
        ORDER BY s.version DESC`,
      [checklistItemId, projectId],
    );
  }

  // ZT-4: Submit a new version for a checklist item (file upload + ledger row + checklist update)
  async submitDocumentVersion(
    projectId: string,
    checklistItemId: string,
    file: Express.Multer.File,
    notes: string | undefined,
    user: JwtPayload,
  ): Promise<{
    submission: ConstructionDocumentSubmission;
    document: Document;
  }> {
    await this.findOne(projectId);
    // Record-scope guard — submitting a document version writes to the project's checklist.
    await this.assertProjectPermission(projectId, user.sub, user, 'canUpload');
    const checklistItem = await this.docChecklistRepo.findOne({
      id: checklistItemId,
      projectId,
    });
    if (!checklistItem)
      throw new NotFoundException(
        `Checklist item ${checklistItemId} not found`,
      );

    const upload = await this.uploadsService.uploadFile(
      file,
      user.sub,
      'coi-submissions',
    );
    const doc = this.documentRepo.create({
      documentableType: 'CONSTRUCTION_PROJECT',
      documentableId: projectId,
      documentType: checklistItem.documentTypeId,
      fileName: upload.originalName,
      filePath: upload.filePath,
      fileSize: upload.fileSize,
      mimeType: upload.mimeType,
      lifecycleStatus: 'ACTIVE',
      uploadedBy: user.sub,
      createdBy: user.sub,
    });
    await this.em.persistAndFlush(doc);

    const conn = this.em.getConnection();
    const versionRows = await conn.execute(
      'SELECT COALESCE(MAX(version), 0) + 1 AS next FROM construction_document_submissions WHERE checklist_item_id = ?',
      [checklistItemId],
    );
    const nextVersion: number = (versionRows[0] as any)?.next ?? 1;

    const submission = this.docSubmissionRepo.create({
      checklistItemId,
      projectId,
      documentId: doc.id,
      version: nextVersion,
      submittedBy: user.sub,
      submittedAt: new Date(),
      submissionNotes: notes,
    });
    await this.em.persistAndFlush(submission);

    checklistItem.linkedDocumentId = doc.id;
    checklistItem.currentVersion = nextVersion;
    checklistItem.submissionStatus = 'SUBMITTED';
    checklistItem.submittedBy = user.sub;
    checklistItem.submittedAt = new Date();
    await this.em.flush();

    this.fireLog(user, ActivityAction.SUBMIT, projectId, {
      section: 'CHECKLIST',
      checklistItemId,
      documentId: doc.id,
      fileName: upload.originalName,
      version: nextVersion,
    });

    return { submission, document: doc };
  }

  // ZT-6: Admin uploads a blank template file for a document type
  async uploadDocumentTypeTemplate(
    typeId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<ConstructionDocumentType> {
    const docType = await this.docTypeRepo.findOne({ id: typeId });
    if (!docType)
      throw new NotFoundException(`Document type ${typeId} not found`);
    const upload = await this.uploadsService.uploadFile(
      file,
      userId,
      'coi-templates',
    );
    docType.templateUrl = upload.filePath;
    await this.em.flush();
    return docType;
  }

  // ============================================================
  // KD-E: Project Diary CRUD
  // ============================================================

  async findDiaryEntries(projectId: string): Promise<any[]> {
    const conn = this.em.getConnection();
    return conn.execute(
      `SELECT d.id, d.project_id, d.entry_date, d.title, d.content,
              d.author_id, d.created_at, d.updated_at,
              (u.first_name || ' ' || u.last_name) AS author_name
         FROM construction_diary_entries d
         LEFT JOIN users u ON u.id = d.author_id
        WHERE d.project_id = ?
        ORDER BY d.entry_date DESC, d.created_at DESC`,
      [projectId],
    );
  }

  async createDiaryEntry(
    projectId: string,
    dto: CreateDiaryEntryDto,
    user: JwtPayload,
  ): Promise<ConstructionDiaryEntry> {
    const project = await this.cpRepo.findOne({ id: projectId });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    // Record-scope guard — the delete counterpart already had one.
    await this.assertProjectPermission(projectId, user.sub, user, 'canCreate');

    const entry = this.diaryRepo.create({
      projectId,
      entryDate: dto.entry_date,
      title: dto.title,
      content: dto.content,
      authorId: user.sub,
    });
    await this.em.persistAndFlush(entry);

    this.fireLog(user, ActivityAction.CREATE, entry.id, {
      entityType: 'diary_entry',
      projectId,
      entryDate: dto.entry_date,
    });
    return entry;
  }

  async updateDiaryEntry(
    projectId: string,
    entryId: string,
    dto: UpdateDiaryEntryDto,
    user: JwtPayload,
  ): Promise<ConstructionDiaryEntry> {
    const entry = await this.diaryRepo.findOne({ id: entryId, projectId });
    if (!entry) {
      throw new NotFoundException(
        `Diary entry ${entryId} not found for project ${projectId}`,
      );
    }
    // Record-scope guard — the delete counterpart already had one.
    await this.assertProjectPermission(projectId, user.sub, user, 'canEdit');
    const before = {
      entryDate: entry.entryDate,
      title: entry.title,
      content: entry.content,
    };
    if (dto.entry_date !== undefined) entry.entryDate = dto.entry_date;
    if (dto.title !== undefined) entry.title = dto.title;
    if (dto.content !== undefined) entry.content = dto.content;
    await this.em.flush();

    const after = {
      entryDate: entry.entryDate,
      title: entry.title,
      content: entry.content,
    };
    const changedFields = Object.keys(after).filter(
      (k) =>
        JSON.stringify((before as any)[k]) !==
        JSON.stringify((after as any)[k]),
    );
    this.fireLog(user, ActivityAction.UPDATE, entryId, {
      entityType: 'diary_entry',
      projectId,
      changedFields,
      previousValues: before,
      newValues: after,
    });
    return entry;
  }

  async removeDiaryEntry(
    projectId: string,
    entryId: string,
    user: JwtPayload,
  ): Promise<void> {
    await this.assertProjectPermission(projectId, user.sub, user, 'canDelete');
    const entry = await this.diaryRepo.findOne({ id: entryId, projectId });
    if (!entry) {
      throw new NotFoundException(
        `Diary entry ${entryId} not found for project ${projectId}`,
      );
    }
    const snapshot = {
      entryDate: entry.entryDate,
      title: entry.title,
      content: entry.content,
    };
    await this.em.removeAndFlush(entry);
    this.fireLog(user, ActivityAction.DELETE, entryId, {
      entityType: 'diary_entry',
      projectId,
      previousValues: snapshot,
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Phase ND — Revision Orders (audit-tracked)
  // ────────────────────────────────────────────────────────────────────────

  async findRevisionOrders(
    projectId: string,
  ): Promise<ConstructionRevisionOrder[]> {
    await this.findOne(projectId);
    return this.revisionOrderRepo.find(
      { projectId },
      { orderBy: { revisionDate: 'desc', revisionNumber: 'desc' } },
    );
  }

  /** Re-derive project's revised_* mirror fields from latest APPROVED revision. */
  private async mirrorLatestApprovedRevisionToProject(
    projectId: string,
  ): Promise<void> {
    const latest = await this.revisionOrderRepo.findOne(
      { projectId, approvalStatus: 'APPROVED' },
      { orderBy: { revisionDate: 'desc', revisionNumber: 'desc' } },
    );
    const conn = this.em.getConnection();
    await conn.execute(
      `UPDATE construction_projects
       SET revised_start_date = ?, revised_completion_date = ?, revised_project_duration = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        latest?.newStartDate ?? null,
        latest?.newCompletionDate ?? null,
        latest?.newDuration ?? null,
        projectId,
      ],
    );
  }

  async createRevisionOrder(
    projectId: string,
    dto: CreateRevisionOrderDto,
    user?: JwtPayload,
  ): Promise<ConstructionRevisionOrder> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canCreate',
      );
    // Auto-increment revision_number per project
    const maxRow = await this.em
      .getConnection()
      .execute(
        `SELECT COALESCE(MAX(revision_number), 0) AS max FROM construction_revision_orders WHERE project_id = ?`,
        [projectId],
      );
    const nextNumber = Number(maxRow[0]?.max ?? 0) + 1;

    const entity = this.revisionOrderRepo.create({
      projectId,
      revisionNumber: nextNumber,
      revisionType: dto.revision_type,
      revisionDate: new Date(dto.revision_date),
      newStartDate: dto.new_start_date
        ? new Date(dto.new_start_date)
        : undefined,
      newCompletionDate: dto.new_completion_date
        ? new Date(dto.new_completion_date)
        : undefined,
      newDuration: dto.new_duration,
      costAdjustment:
        dto.cost_adjustment != null ? String(dto.cost_adjustment) : undefined,
      justification: dto.justification,
      approvalStatus: dto.approval_status ?? 'DRAFT',
      movDocumentId: dto.mov_document_id,
      movLink: dto.mov_link,
      createdBy: user?.sub,
    });
    await this.em.persist(entity).flush();
    await this.mirrorLatestApprovedRevisionToProject(projectId);
    this.fireLog(user, ActivityAction.CREATE, projectId, {
      entityType: 'revision_order',
      revisionOrderId: entity.id,
      revisionNumber: entity.revisionNumber,
    });
    return entity;
  }

  async updateRevisionOrder(
    projectId: string,
    roId: string,
    dto: UpdateRevisionOrderDto,
    user?: JwtPayload,
  ): Promise<ConstructionRevisionOrder> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(projectId, user.sub, user, 'canEdit');
    const entity = await this.revisionOrderRepo.findOne({
      id: roId,
      projectId,
    });
    if (!entity)
      throw new NotFoundException(`Revision order ${roId} not found`);

    if (dto.revision_type !== undefined)
      entity.revisionType = dto.revision_type;
    if (dto.revision_date !== undefined)
      entity.revisionDate = new Date(dto.revision_date);
    if (dto.new_start_date !== undefined)
      entity.newStartDate = dto.new_start_date
        ? new Date(dto.new_start_date)
        : undefined;
    if (dto.new_completion_date !== undefined)
      entity.newCompletionDate = dto.new_completion_date
        ? new Date(dto.new_completion_date)
        : undefined;
    if (dto.new_duration !== undefined) entity.newDuration = dto.new_duration;
    if (dto.cost_adjustment !== undefined)
      entity.costAdjustment =
        dto.cost_adjustment != null ? String(dto.cost_adjustment) : undefined;
    if (dto.justification !== undefined)
      entity.justification = dto.justification;
    if (dto.approval_status !== undefined)
      entity.approvalStatus = dto.approval_status;
    if (dto.mov_document_id !== undefined)
      entity.movDocumentId = dto.mov_document_id;
    if (dto.mov_link !== undefined) entity.movLink = dto.mov_link;
    entity.updatedBy = user?.sub;
    await this.em.flush();
    await this.mirrorLatestApprovedRevisionToProject(projectId);
    this.fireLog(user, ActivityAction.UPDATE, projectId, {
      entityType: 'revision_order',
      revisionOrderId: roId,
      changedFields: Object.keys(dto),
    });
    return entity;
  }

  async removeRevisionOrder(
    projectId: string,
    roId: string,
    user?: JwtPayload,
  ): Promise<void> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canDelete',
      );
    const entity = await this.revisionOrderRepo.findOne({
      id: roId,
      projectId,
    });
    if (!entity)
      throw new NotFoundException(`Revision order ${roId} not found`);
    await this.em.removeAndFlush(entity);
    await this.mirrorLatestApprovedRevisionToProject(projectId);
    this.fireLog(user, ActivityAction.DELETE, projectId, {
      entityType: 'revision_order',
      revisionOrderId: roId,
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Phase NE — Progress Reports (chronological, MPR/WAR-aligned)
  // ────────────────────────────────────────────────────────────────────────

  async findProgressReports(
    projectId: string,
  ): Promise<ConstructionProgressReport[]> {
    await this.findOne(projectId);
    return this.progressReportRepo.find(
      { projectId },
      { orderBy: { reportDate: 'desc' } },
    );
  }

  /** Re-derive project's physical_progress / cost_incurred_to_date / as_of_date from latest report. */
  private async mirrorLatestReportToProject(projectId: string): Promise<void> {
    const latest = await this.progressReportRepo.findOne(
      { projectId },
      { orderBy: { reportDate: 'desc' } },
    );
    const conn = this.em.getConnection();
    await conn.execute(
      `UPDATE construction_projects
       SET physical_progress = ?, cost_incurred_to_date = ?, as_of_date = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        latest?.percentageCompletion ?? 0,
        latest?.costIncurredToDate ?? null,
        latest?.reportDate ?? null,
        projectId,
      ],
    );
  }

  async createProgressReport(
    projectId: string,
    dto: CreateProgressReportDto,
    user?: JwtPayload,
  ): Promise<ConstructionProgressReport> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canCreate',
      );
    const entity = this.progressReportRepo.create({
      projectId,
      reportType: dto.report_type,
      reportDate: new Date(dto.report_date),
      reportNumber: dto.report_number,
      percentageCompletion:
        dto.percentage_completion != null
          ? String(dto.percentage_completion)
          : '0.00',
      plannedAccomplishment:
        dto.planned_accomplishment != null
          ? String(dto.planned_accomplishment)
          : undefined,
      slippage: dto.slippage != null ? String(dto.slippage) : undefined,
      costIncurredToDate:
        dto.cost_incurred_to_date != null
          ? String(dto.cost_incurred_to_date)
          : undefined,
      costIncurredThisPeriod:
        dto.cost_incurred_this_period != null
          ? String(dto.cost_incurred_this_period)
          : undefined,
      calendarDaysElapsed: dto.calendar_days_elapsed,
      percentTimeElapsed:
        dto.percent_time_elapsed != null
          ? String(dto.percent_time_elapsed)
          : undefined,
      remarks: dto.remarks,
      issuesEncountered: dto.issues_encountered,
      mitigationActions: dto.mitigation_actions,
      movDocumentId: dto.mov_document_id,
      movLink: dto.mov_link,
      createdBy: user?.sub,
    });
    // OS-D: stamp list fields with timestamp + author
    const now = new Date().toISOString();
    const stampList = (items: any[] | undefined) =>
      (items || []).map((e) => ({
        text: e.text || '',
        author: e.author || user?.email || 'System',
        createdAt: e.created_at || e.createdAt || now,
      }));
    entity.narrativeList = stampList(dto.narrative_list);
    entity.remarksList = stampList(dto.remarks_list);
    entity.issuesEncounteredList = stampList(dto.issues_encountered_list);
    entity.mitigationActionsList = stampList(dto.mitigation_actions_list);
    await this.em.persist(entity).flush();
    await this.mirrorLatestReportToProject(projectId);
    this.fireLog(user, ActivityAction.CREATE, projectId, {
      entityType: 'progress_report',
      progressReportId: entity.id,
      reportType: entity.reportType,
      reportDate: entity.reportDate,
    });
    return entity;
  }

  async updateProgressReport(
    projectId: string,
    reportId: string,
    dto: UpdateProgressReportDto,
    user?: JwtPayload,
  ): Promise<ConstructionProgressReport> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(projectId, user.sub, user, 'canEdit');
    const entity = await this.progressReportRepo.findOne({
      id: reportId,
      projectId,
    });
    if (!entity)
      throw new NotFoundException(`Progress report ${reportId} not found`);

    if (dto.report_type !== undefined) entity.reportType = dto.report_type;
    if (dto.report_date !== undefined)
      entity.reportDate = new Date(dto.report_date);
    if (dto.report_number !== undefined)
      entity.reportNumber = dto.report_number;
    // An explicit null clears the field. percentage_completion is NOT NULL in the
    // database, so it resets to zero instead of being written as the string "null",
    // which Postgres rejects with: invalid input syntax for type numeric: "null".
    if (dto.percentage_completion !== undefined)
      entity.percentageCompletion =
        dto.percentage_completion != null
          ? String(dto.percentage_completion)
          : '0.00';
    if (dto.planned_accomplishment !== undefined)
      entity.plannedAccomplishment =
        dto.planned_accomplishment != null
          ? String(dto.planned_accomplishment)
          : undefined;
    if (dto.slippage !== undefined)
      entity.slippage = dto.slippage != null ? String(dto.slippage) : undefined;
    if (dto.cost_incurred_to_date !== undefined)
      entity.costIncurredToDate =
        dto.cost_incurred_to_date != null
          ? String(dto.cost_incurred_to_date)
          : undefined;
    if (dto.cost_incurred_this_period !== undefined)
      entity.costIncurredThisPeriod =
        dto.cost_incurred_this_period != null
          ? String(dto.cost_incurred_this_period)
          : undefined;
    if (dto.calendar_days_elapsed !== undefined)
      entity.calendarDaysElapsed = dto.calendar_days_elapsed;
    if (dto.percent_time_elapsed !== undefined)
      entity.percentTimeElapsed =
        dto.percent_time_elapsed != null
          ? String(dto.percent_time_elapsed)
          : undefined;
    if (dto.remarks !== undefined) entity.remarks = dto.remarks;
    if (dto.issues_encountered !== undefined)
      entity.issuesEncountered = dto.issues_encountered;
    if (dto.mitigation_actions !== undefined)
      entity.mitigationActions = dto.mitigation_actions;
    if (dto.mov_document_id !== undefined)
      entity.movDocumentId = dto.mov_document_id;
    if (dto.mov_link !== undefined) entity.movLink = dto.mov_link;
    // OS-D: update list fields if provided. Each list is applied on its own so a PATCH
    // carrying only one of them does not silently wipe the other three, which the old
    // single 'if (narrative_list)' gate did.
    const now = new Date().toISOString();
    const stampList = (items: any[] | null | undefined) =>
      (items || []).map((e) => ({
        text: e.text || '',
        author: e.author || user?.email || 'System',
        createdAt: e.created_at || e.createdAt || now,
      }));
    if (dto.narrative_list !== undefined)
      entity.narrativeList = stampList(dto.narrative_list);
    if (dto.remarks_list !== undefined)
      entity.remarksList = stampList(dto.remarks_list);
    if (dto.issues_encountered_list !== undefined)
      entity.issuesEncounteredList = stampList(dto.issues_encountered_list);
    if (dto.mitigation_actions_list !== undefined)
      entity.mitigationActionsList = stampList(dto.mitigation_actions_list);
    entity.updatedBy = user?.sub;
    await this.em.flush();
    await this.mirrorLatestReportToProject(projectId);
    this.fireLog(user, ActivityAction.UPDATE, projectId, {
      entityType: 'progress_report',
      progressReportId: reportId,
      changedFields: Object.keys(dto),
    });
    return entity;
  }

  async removeProgressReport(
    projectId: string,
    reportId: string,
    user?: JwtPayload,
  ): Promise<void> {
    await this.findOne(projectId);
    if (user)
      await this.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canDelete',
      );
    const entity = await this.progressReportRepo.findOne({
      id: reportId,
      projectId,
    });
    if (!entity)
      throw new NotFoundException(`Progress report ${reportId} not found`);
    await this.em.removeAndFlush(entity);
    await this.mirrorLatestReportToProject(projectId);
    this.fireLog(user, ActivityAction.DELETE, projectId, {
      entityType: 'progress_report',
      progressReportId: reportId,
    });
  }
}

/**
 * Parse a DTO date field for a date/timestamp column. The DTOs carry dates as strings; an
 * empty string or null means "no date", which has to stay undefined rather than becoming an
 * Invalid Date.
 */
function toDate(value?: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

/**
 * Render a numeric DTO field for a decimal column. mikro-orm maps decimal/numeric columns to
 * string so the exact value survives the round trip — JavaScript numbers cannot hold every
 * decimal the database accepts. The DTOs declare these fields as numbers, so the conversion
 * happens here rather than being repeated at each assignment.
 */
function toDecimal(value?: number | null): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}
