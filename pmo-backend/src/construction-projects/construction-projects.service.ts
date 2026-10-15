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
import { EntityManager, QueryOrder, wrap } from '@mikro-orm/core';
import { createPaginatedResponse, PaginatedResponse } from '../common/dto';
import {
  CreateConstructionProjectDto,
  QueryConstructionProjectDto,
  UpdateConstructionProjectDto,
  UploadDocumentDto,
} from './dto';
import { UploadsService } from '../uploads';
import { UploadProgressService } from '../uploads/upload-progress.service';
import { ModuleType, PRIMARY_FUNDING_SOURCE_LABELS } from '../common/enums';
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
  UserModuleAssignment,
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
import { UserModuleAssignmentRepository } from '../common/repository/user-module-assignment.repository';
import { ConstructionDocumentSubmissionRepository } from './repository/construction-document-submission.repository';
import { ConstructionDocumentFolderRepository } from './repository/construction-document-folder.repository';
import { ProjectRepository } from '../projects/repository/project.repository';
import { DocumentRepository } from '../documents/repository/document.repository';
import { ConstructionAccessService } from './service/construction-access.service';

// Publication status values matching database enum
export type PublicationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED';

// construction_projects.project_code and projects.project_code are both varchar(50), so a
// suggestion longer than this would be refused by the column it is meant for.
const PROJECT_CODE_MAX_LENGTH = 50;
const CODE_SUGGESTION_COUNT = 3;
const CODE_SUGGESTION_BATCH = 10;
// A ceiling on how far the suggestion search walks. Reaching it returns fewer suggestions
// rather than scanning the whole code space.
const MAX_CODE_SUGGESTION_PROBES = 200;

/** What is holding a project code that was asked about. */
export interface ProjectCodeConflict {
  // 'construction_project' — a COI project, which may be soft-deleted and still block the
  // code. 'project' — a live row in the shared projects table, typically another module's.
  scope: 'construction_project' | 'project';
  project_id: string;
  title: string;
  deleted: boolean;
}

export interface ProjectCodeAvailability {
  // The code as it was checked, trimmed.
  code: string;
  available: boolean;
  conflict: ProjectCodeConflict | null;
  // The code itself when it is free, otherwise the first suggestion (null if none was found).
  recommended: string | null;
  // Free alternatives, nearest first. Empty when the code is available.
  suggestions: string[];
}

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
    @InjectRepository(UserModuleAssignment)
    private readonly moduleAssignmentRepo: UserModuleAssignmentRepository,
    @InjectRepository(Project)
    private readonly projectRepo: ProjectRepository,
    @InjectRepository(Document)
    private readonly documentRepo: DocumentRepository,
    @InjectRepository(ConstructionDocumentSubmission)
    private readonly docSubmissionRepo: ConstructionDocumentSubmissionRepository,
    @InjectRepository(ConstructionDocumentFolder)
    private readonly docFolderRepo: ConstructionDocumentFolderRepository,
    private readonly access: ConstructionAccessService,
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
    this.access.fireLog(user, action, entityId, metadata);
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
      this.assignmentRepo.getEntityManager().persist(assignment);
    }
    await this.assignmentRepo.getEntityManager().flush();
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
    return this.access.assertProjectPermission(
      projectId,
      userId,
      user,
      permission,
    );
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
    return this.access.hasApprovalAuthority(projectId, userId, user);
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
      const assigned = await this.assignmentRepo.isUserAssigned(
        ModuleType.CONSTRUCTION,
        id,
        user.sub,
      );
      if (!assigned) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }
    const detail = await this.cpRepo.findDetail(id);

    if (!detail) {
      throw new NotFoundException(
        `Construction project with ID ${id} not found`,
      );
    }

    // VD-A: deny-by-default for contractor assignments with null permissions
    const project = this.applyContractorDenyDefault(detail);

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
    // The join to construction_projects only existed to drop assignments whose project has
    // been deleted. record_assignments is polymorphic, so there is no relation to traverse;
    // the live project ids are fetched once and the assignments filtered against them.
    const assignments = await this.assignmentRepo.findAssignmentsForUser(
      ModuleType.CONSTRUCTION,
      userId,
    );
    const liveProjects = assignments.length
      ? await this.cpRepo.find(
          { id: { $in: assignments.map((a) => a.recordId) }, deletedAt: null },
          { fields: ['id'], filters: false },
        )
      : [];
    const liveIds = new Set(liveProjects.map((p) => p.id));
    const rows = assignments
      .filter((a) => liveIds.has(a.recordId))
      .map((a) => ({ project_id: a.recordId, permissions: a.permissions }));
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
    const [
      statusRows,
      campusRows,
      pubRows,
      aggRow,
      fundingSourceRows,
      contractorRows,
    ] = await (async () => {
      const a = await this.cpRepo.getAnalytics();
      return [
        a.byStatus,
        a.byCampus,
        a.byPublication,
        [a.totals],
        a.byFundingSource,
        a.byContractor,
      ];
    })();
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
    const r = await this.cpRepo.getFinancialTotals();
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

  /**
   * Whether a project code is free for a new construction project, and what to use instead
   * when it is not.
   *
   * Two tables have to agree before create() will accept a code. create() refuses one that any
   * construction_projects row carries, soft-deleted rows included, and it then inserts a
   * parent projects row whose partial unique index covers live rows only. Both are checked
   * here so the answer matches what creation will actually do — checking only the index would
   * call a soft-deleted project's code free and hand the user a 409 on submit.
   */
  async checkCodeAvailability(code: string): Promise<ProjectCodeAvailability> {
    const requested = (code ?? '').trim();
    if (!requested) {
      throw new BadRequestException('Query parameter "code" is required');
    }
    if (requested.length > PROJECT_CODE_MAX_LENGTH) {
      throw new BadRequestException(
        `Project code must be at most ${PROJECT_CODE_MAX_LENGTH} characters`,
      );
    }

    const conflict = await this.findCodeConflict(requested);
    if (!conflict) {
      return {
        code: requested,
        available: true,
        conflict: null,
        recommended: requested,
        suggestions: [],
      };
    }

    const suggestions = await this.suggestProjectCodes(
      requested,
      CODE_SUGGESTION_COUNT,
    );
    return {
      code: requested,
      available: false,
      conflict,
      recommended: suggestions[0] ?? null,
      suggestions,
    };
  }

  /** The row standing in the way of a project code, or null when nothing holds it. */
  private async findCodeConflict(
    code: string,
  ): Promise<ProjectCodeConflict | null> {
    const project = await this.cpRepo.findAnyByCode(code);
    if (project) {
      return {
        scope: 'construction_project',
        project_id: project.id,
        title: project.title,
        deleted: !!project.deletedAt,
      };
    }

    // No construction project holds it, but the parent projects table is shared with the other
    // modules, so a repair or operations project may have taken the code already.
    const parent = await this.projectRepo.findActiveByCode(code);
    if (parent) {
      return {
        scope: 'project',
        project_id: parent.id,
        title: parent.title,
        deleted: false,
      };
    }
    return null;
  }

  /**
   * Free codes near the requested one, in the order a user would try them. Candidates are
   * probed in batches rather than one query each, so a long run of taken codes costs a handful
   * of queries instead of dozens.
   */
  private async suggestProjectCodes(
    code: string,
    count: number,
  ): Promise<string[]> {
    const suggestions: string[] = [];
    let offset = 1;

    while (suggestions.length < count && offset <= MAX_CODE_SUGGESTION_PROBES) {
      const candidates: string[] = [];
      while (
        candidates.length < CODE_SUGGESTION_BATCH &&
        offset <= MAX_CODE_SUGGESTION_PROBES
      ) {
        const candidate = nextProjectCode(code, offset);
        offset += 1;
        if (candidate.length <= PROJECT_CODE_MAX_LENGTH) {
          candidates.push(candidate);
        }
      }
      if (candidates.length === 0) break;

      const taken = await this.cpRepo.findTakenCodes(candidates);
      for (const parentCode of await this.projectRepo.findTakenCodes(
        candidates,
      )) {
        taken.add(parentCode);
      }

      for (const candidate of candidates) {
        if (taken.has(candidate)) continue;
        suggestions.push(candidate);
        if (suggestions.length === count) break;
      }
    }

    return suggestions;
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
      // Every statement below carries the transaction context. Without it each one takes its
      // own connection from the pool, so it neither joins this transaction nor sees what the
      // transaction has already written — the read-back at the end returned no row and the
      // endpoint answered 201 with an empty body.
      const run = (sql: string, params?: unknown[]) =>
        conn.execute(sql, params as any[], 'all', em.getTransactionContext());

      if (!dto.project_id) {
        // JP-A: Deployment-resilient duplicate detection.
        // The partial unique index projects_project_code_active_idx
        // (Migration20260502071146) enforces uniqueness for non-deleted rows.
        // We rely on the index itself instead of ON CONFLICT inference, so the
        // code works regardless of whether the partial index, a plain UNIQUE,
        // or a future renamed index is in place. PG SQLSTATE 23505 = unique_violation.
        try {
          await this.projectRepo.createForConstruction({
            id: projectId,
            projectCode: dto.project_code,
            title: dto.title,
            description: dto.description,
            startDate: dto.start_date,
            endDate: dto.target_completion_date,
            status: dto.status,
            budget: dto.contract_amount,
            campus: dto.campus,
            createdBy: userId,
          });
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
          // permissions is jsonb: the value goes in as it stands. The statement this replaces
          // had to JSON.stringify it, which would store a quoted string here.
          await this.assignmentRepo.upsertAssignment(
            ModuleType.CONSTRUCTION,
            recordId,
            a.user_id,
            {
              role: a.role,
              department: a.department,
              phone: a.phone,
              personnelCategory: a.personnel_category,
              projectRole: a.project_role,
              permissions: a.permissions ?? null,
            },
          );
        }
      } else if (dto.assigned_user_ids && dto.assigned_user_ids.length > 0) {
        for (const uid of dto.assigned_user_ids) {
          await this.assignmentRepo.ensureAssignment(
            ModuleType.CONSTRUCTION,
            recordId,
            uid,
          );
        }
      } else if (dto.assigned_to) {
        await this.assignmentRepo.ensureAssignment(
          ModuleType.CONSTRUCTION,
          recordId,
          dto.assigned_to,
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
      const [created] = await run(
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

    const dtoAny = dto as any;

    if (
      dtoAny.project_code &&
      (await this.cpRepo.codeExists(dtoAny.project_code, id))
    ) {
      throw new ConflictException(
        `Project code ${dtoAny.project_code} already exists`,
      );
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

    // Only real columns of the entity can be written, so a key that slipped past validation
    // has nowhere to go instead of being interpolated into a SET clause. jsonb columns take
    // the value itself — the statement this replaces had to JSON.stringify each one, which
    // would store a quoted string.
    const payload = Object.fromEntries(fields.map((f) => [f, dto[f]]));
    await this.cpRepo.applyUpdate(
      id,
      payload,
      userId,
      requiresStatusReset
        ? priorStatus === 'PENDING_REVIEW'
          ? 'from-pending'
          : 'from-reviewed'
        : 'none',
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
      // Both repositories are bound to this fork, so the two soft-deletes commit or roll back
      // together.
      await this.cpRepo.softDelete(id, userId);
      await this.projectRepo.softDelete(project.project_id, userId);
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

    if (!user.is_superadmin) {
      const hasAccess = await this.moduleAssignmentRepo.hasModuleAccess(
        user.sub,
        ModuleType.CONSTRUCTION,
      );
      if (!hasAccess) return [];
    }

    return this.cpRepo.findPendingReview();
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

  // --- POW Items REMOVED (Phase ME, 2026-05-21) ---
  // POW table archived via Migration20260521030000_ArchivePowItemsTable

  // NI (2026-05-21): Financials methods removed; data flows through
  // construction_progress_reports instead. Table archived via migration 030000.

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
    // SUBMISSIONS/folder node gets a version = (current max in folder) + 1, so the
    // submission table doubles as version history. Non-folder uploads stay at v1.
    let version = 1;
    if (dto.folder_id) {
      const latest = await this.documentRepo.findOne(
        { folderId: dto.folder_id },
        { orderBy: { version: QueryOrder.DESC } },
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
    await this.documentRepo.getEntityManager().persist(doc).flush();

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

          await this.docChecklistRepo
            .getEntityManager()
            .persist(checklistItem)
            .flush();

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
    await this.docFolderRepo.getEntityManager().persist(entity).flush();
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

    const hasHistory =
      (await this.docSubmissionRepo.countForDocument(docId)) > 0;

    // Soft-delete: set deletedAt; do NOT call uploadsService.deleteFile()
    doc.deletedAt = new Date();
    doc.deletedBy = user?.sub;
    await this.documentRepo.getEntityManager().flush();

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

/**
 * The requested code with its trailing number advanced by `offset`, keeping the original zero
 * padding: CP-2026-001 with an offset of 1 becomes CP-2026-002.
 *
 * The number taken is the last run of digits in the code, so the year in CP-2026-001 is left
 * alone. A code ending in no digits has the offset appended as a new segment instead —
 * CP-ANNEX becomes CP-ANNEX-2 — which keeps the first suggestion readable rather than turning
 * it into CP-ANNEX1.
 */
function nextProjectCode(code: string, offset: number): string {
  const match = /^(.*?)(\d+)(\D*)$/.exec(code);
  if (!match) return `${code}-${offset + 1}`;
  const [, prefix, digits, suffix] = match;
  const next = String(Number(digits) + offset);
  return `${prefix}${next.padStart(digits.length, '0')}${suffix}`;
}
