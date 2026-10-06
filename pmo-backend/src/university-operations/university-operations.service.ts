import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { createPaginatedResponse, PaginatedResponse } from '../common/dto';
import {
  FiscalYear,
  OperationFinancial,
  OperationIndicator,
  OperationOrganizationalInfo,
  PillarIndicatorTaxonomy,
  QuarterlyReport,
  QuarterlyReportSubmission,
  RecordAssignment,
  UniversityOperation,
  UserModuleAssignment,
  UserPermissionOverride,
} from '../database/entities';
import {
  CreateFinancialDto,
  CreateIndicatorDto,
  CreateIndicatorQuarterlyDto,
  CreateOperationDto,
  FundType,
  QueryOperationDto,
  UpdateIndicatorQuarterlyDto,
  UpdateOperationDto,
} from './dto';
import { JwtPayload } from '../common/interfaces';
import { ModuleType } from '../common/enums';
import { PermissionResolverService } from '../common/services';
import { UserModuleAssignmentRepository } from '../common/repository/user-module-assignment.repository';
import { UserPermissionOverrideRepository } from '../common/repository/user-permission-override.repository';
import type { FindAllOperationsOptions } from './repository/university-operation.repository';
import { UniversityOperationRepository } from './repository/university-operation.repository';
import { OperationIndicatorRepository } from './repository/operation-indicator.repository';
import { OperationFinancialRepository } from './repository/operation-financial.repository';
import { QuarterlyReportRepository } from './repository/quarterly-report.repository';
import { QuarterlyReportSubmissionRepository } from './repository/quarterly-report-submission.repository';
import { FiscalYearRepository } from './repository/fiscal-year.repository';
import { PillarIndicatorTaxonomyRepository } from './repository/pillar-indicator-taxonomy.repository';
import { OperationOrganizationInfoRepository } from './repository/operation-organization-info.repository';
import { RecordAssignmentRepository } from '../construction-projects/repository/record-assignment.repository';
import { QueryOrder } from '@mikro-orm/core';

// Publication status values matching database enum
export type PublicationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED';

/**
 * DATA ACCESS ARCHITECTURE:
 *
 * This service issues no SQL and injects no EntityManager. Every database access goes through
 * the repository for the entity being touched, and each repository returns rows in the
 * snake_case shape this API has always answered with.
 *
 * Reads and writes use the ORM — repo.find / repo.findOne / repo.count / repo.create, and
 * repo.getEntityManager().persist(...).flush() to write. Aggregations that find() cannot
 * express are built with the query builder inside the repository (the financial GROUP BY
 * totals), and the four physical-indicator analytics remain SQL because they open with
 * DISTINCT ON inside a CTE — but that SQL lives in OperationIndicatorRepository, not here.
 *
 * Every value a caller supplies reaches the database as a bound parameter. No SET clause,
 * column name or WHERE fragment is assembled from a request body.
 *
 * Legacy DatabaseService consumers (post-Phase IU):
 *   health.service.ts  — permanent (DB ping/metrics, not ORM-appropriate)
 *   ldap.strategy.ts   — reserved for Phase IR transport migration (tied to LDAP activation)
 *   google.strategy.ts — ✅ migrated to em.getConnection().execute (Phase IU)
 */
@Injectable()
export class UniversityOperationsService {
  private readonly logger = new Logger(UniversityOperationsService.name);

  // Phase HU: the 3 module keys sharing one approval-authority family — the parent
  // 'university_operations' key plus its 2 independent per-pillar sub-modules. Passed
  // together to canApproveModule() so an Approver/Manager grant scoped to just one
  // pillar isn't ignored (mirrors ModuleAccessGuard's candidateKeys handling).
  private readonly UO_LEVEL_KEYS = [
    'university_operations',
    'university-operations-physical',
    'university-operations-financial',
  ];

  // The user_permission_overrides.module_key this service's write authority is granted under.
  private readonly UO_MODULE_KEY = 'university_operations';

  constructor(
    @InjectRepository(UniversityOperation)
    private readonly uoRepo: UniversityOperationRepository,
    @InjectRepository(OperationIndicator)
    private readonly indicatorRepo: OperationIndicatorRepository,
    @InjectRepository(OperationFinancial)
    private readonly financialRepo: OperationFinancialRepository,
    @InjectRepository(QuarterlyReport)
    private readonly qrRepo: QuarterlyReportRepository,
    @InjectRepository(QuarterlyReportSubmission)
    private readonly qrsRepo: QuarterlyReportSubmissionRepository,
    @InjectRepository(FiscalYear)
    private readonly fyRepo: FiscalYearRepository,
    @InjectRepository(PillarIndicatorTaxonomy)
    private readonly taxonomyRepo: PillarIndicatorTaxonomyRepository,
    @InjectRepository(OperationOrganizationalInfo)
    private readonly orgInfoRepo: OperationOrganizationInfoRepository,
    @InjectRepository(RecordAssignment)
    private readonly recordAssignmentRepo: RecordAssignmentRepository,
    @InjectRepository(UserModuleAssignment)
    private readonly moduleAssignmentRepo: UserModuleAssignmentRepository,
    @InjectRepository(UserPermissionOverride)
    private readonly permissionOverrideRepo: UserPermissionOverrideRepository,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  /**
   * Map user campus value to record campus value.
   * Phase AM: Users store 'Butuan Campus'/'Cabadbaran'; records store 'MAIN'/'CABADBARAN'.
   * Returns null when input is null/undefined/unmapped — caller falls back to no campus filter.
   */
  private normalizeUserCampusToRecordCampus(
    userCampus: string | null | undefined,
  ): string | null {
    if (!userCampus) return null;
    if (userCampus === 'Butuan Campus') return 'MAIN';
    if (userCampus === 'Cabadbaran') return 'CABADBARAN';
    return null;
  }

  /**
   * Phase AT: Update record assignments in the junction table
   * Replaces all existing assignments for a record with new user IDs
   */
  private updateRecordAssignments(
    recordId: string,
    userIds: string[],
  ): Promise<void> {
    return this.recordAssignmentRepo.replaceAssignments(
      ModuleType.OPERATIONS,
      recordId,
      userIds,
    );
  }

  // ─── Phase IJ: Assignment CRUD ──────────────────────────────────────────────

  getOperationAssignments(operationId: string): Promise<RecordAssignment[]> {
    return this.recordAssignmentRepo.findForRecord(
      ModuleType.OPERATIONS,
      operationId,
    );
  }

  async addOperationAssignment(
    operationId: string,
    userId: string,
    assignedBy: string,
  ): Promise<RecordAssignment> {
    // Throws when the operation does not exist, so an assignment can never be orphaned.
    await this.findOne(operationId);
    return this.recordAssignmentRepo.assignUser(
      ModuleType.OPERATIONS,
      operationId,
      userId,
      assignedBy,
    );
  }

  async removeOperationAssignment(
    operationId: string,
    userId: string,
  ): Promise<void> {
    const deleted = await this.recordAssignmentRepo.removeAssignment(
      ModuleType.OPERATIONS,
      operationId,
      userId,
    );
    if (deleted === 0) throw new NotFoundException('Assignment not found');
  }

  /**
   * Phase AT: Check if user is assigned to record via junction table
   */
  private isUserAssigned(recordId: string, userId: string): Promise<boolean> {
    return this.recordAssignmentRepo.isUserAssigned(
      ModuleType.OPERATIONS,
      recordId,
      userId,
    );
  }

  /**
   * Track T-SEC-IDOR: Object-level read authorization for a single operation (OWASP API1 BOLA).
   * Mirrors the non-admin visibility predicate in findAll() exactly, evaluated in-memory against
   * the already-hydrated row (uses the row's assigned_users array — no extra query).
   * Admin/SuperAdmin bypass. Returns true iff the user may view THIS record.
   */
  private userCanViewOperation(operation: any, user: JwtPayload): boolean {
    if (this.permissionResolver.isAdmin(user)) return true;
    const isCreator = operation.created_by === user.sub;
    const assigned = Array.isArray(operation.assigned_users)
      ? operation.assigned_users
      : [];
    const isAssigned = assigned.some((u: any) => u?.id === user.sub);
    const recordCampus = this.normalizeUserCampusToRecordCampus(user.campus);
    if (recordCampus) {
      return operation.campus === recordCampus || isCreator || isAssigned;
    }
    // Unmapped campus: fall back to PUBLISHED-or-own-or-assigned (mirrors findAll).
    return (
      operation.publication_status === 'PUBLISHED' || isCreator || isAssigned
    );
  }

  // ─── Phase CM/CN: Authorization Validation Helpers ───────────────────────────

  /**
   * Phase BBBG (Track 1): Level-aware operation ownership check. Resolves the user's UO
   * module level from user_permission_overrides so Approver/Manager get module-wide write
   * authority without being blocked by the record-ownership check. Contributor is still
   * scoped to records they created or are assigned to.
   */
  private async validateOperationOwnership(
    operationId: string,
    userId: string,
    user: JwtPayload,
  ): Promise<void> {
    if (this.permissionResolver.isAdmin(user)) {
      return;
    }

    // Resolve UO module level from the permission-override system (authoritative source).
    const grantedLevel = await this.permissionOverrideRepo.findGrantedLevel(
      userId,
      this.UO_MODULE_KEY,
    );

    // Approver and Manager have module-wide write authority — no record-ownership check needed.
    if (grantedLevel === 'Approver' || grantedLevel === 'Manager') {
      return;
    }

    // Viewer without a level grant cannot write (already blocked by ModuleAccessGuard, but
    // belt-and-suspenders: deny here too so the service is self-contained).
    if (!grantedLevel || grantedLevel === 'Viewer') {
      throw new ForbiddenException(
        'Insufficient module level to modify this operation.',
      );
    }

    // Contributor: must be the record creator or an assigned user.
    const createdBy = await this.uoRepo.findCreatedBy(operationId);

    if (createdBy === null) {
      throw new NotFoundException('Operation not found');
    }

    const isOwner = createdBy === userId;
    const isAssigned = await this.isUserAssigned(operationId, userId);

    if (!isOwner && !isAssigned) {
      throw new ForbiddenException(
        'You do not have permission to modify this operation. Only the owner or assigned users can make changes.',
      );
    }
  }

  /**
   * Phase HU: Returns the university operation record for a given pillar + fiscal year.
   * Used by Physical and Financial display pages to resolve the operation context.
   * Does NOT apply ownership/campus filter — access is controlled by module assignment only.
   * Directives 209, 210
   */
  async findOperationForDisplay(
    pillarType: string,
    fiscalYear: number,
    user: JwtPayload,
  ): Promise<any> {
    // Admins always have access
    if (!this.permissionResolver.isAdmin(user)) {
      const hasAccess = await this.moduleAssignmentRepo.hasModuleAccess(
        user.sub,
        ModuleType.OPERATIONS,
      );
      if (!hasAccess) {
        return null;
      }
    }

    return this.uoRepo.findForPillarYear(pillarType, fiscalYear);
  }

  /**
   * Phase BBBG (Track 1): Level-aware financial access. Replaces the legacy
   * user_module_assignments check so financial write authority is governed by
   * user_permission_overrides.granted_level (Contributor+ may write; Viewer denied),
   * consistent with validateOperationOwnership and the ModuleAccessGuard.
   */
  private async validateFinancialAccess(
    userId: string,
    user: JwtPayload,
  ): Promise<void> {
    if (this.permissionResolver.isAdmin(user)) {
      return;
    }

    const grantedLevel = await this.permissionOverrideRepo.findGrantedLevel(
      userId,
      this.UO_MODULE_KEY,
    );

    if (!grantedLevel || grantedLevel === 'Viewer') {
      throw new ForbiddenException(
        'You do not have permission to modify financial records. Contributor or higher UO module level required.',
      );
    }
  }

  /**
   * Phase FH-2: Validates financial CUD editability — only checks quarterly report publication,
   * NOT operation-level publication. Financial data entry is governed by the quarterly report
   * lifecycle, not the UO main page publish workflow.
   * Physical indicator CUD continues using validateOperationEditable() which checks both.
   */
  private async validateFinancialEditable(
    operationId: string,
    quarter: string,
    user?: JwtPayload,
  ): Promise<void> {
    const row = await this.uoRepo.findEditState(operationId, quarter);

    if (!row) {
      throw new NotFoundException('Operation not found');
    }

    // SuperAdmin bypasses all locks
    if (user && user.is_superadmin) {
      return;
    }
    if (user && this.permissionResolver.isAdmin(user)) {
      if (row.quarterly_status === 'PUBLISHED' && !row.unlocked_by) {
        throw new ForbiddenException(
          'This quarterly report is published. An unlock must be approved before editing.',
        );
      }
      return;
    }

    // Staff: blocked if quarterly report is PUBLISHED
    if (row.quarterly_status === 'PUBLISHED') {
      throw new ForbiddenException(
        'Cannot modify financial records: the quarterly report for this period has been published.',
      );
    }
  }

  /**
   * Phase CO: Validates that operation is in DRAFT or PENDING_REVIEW status.
   * Throws ForbiddenException if operation is PUBLISHED.
   * Published operations represent final, approved data submitted to COA/DBM.
   *
   * Phase ER-B: When quarter is provided, also checks that the quarterly report
   * for the operation's fiscal year + that quarter is not PUBLISHED.
   */
  private async validateOperationEditable(
    operationId: string,
    quarter?: string,
    user?: JwtPayload,
  ): Promise<void> {
    // Phase ER-B/GOV-C: when a quarter is supplied the quarterly report governing it is
    // resolved too, so a published quarter can block the edit and an approved unlock can
    // release it. Without a quarter only the operation's own status is read.
    const row = await this.uoRepo.findEditState(operationId, quarter);

    if (!row) {
      throw new NotFoundException('Operation not found');
    }

    if (row.publication_status === 'PUBLISHED') {
      throw new ForbiddenException(
        'Cannot modify indicators/financials on published operations. Withdraw to draft status first.',
      );
    }

    // Phase GOV-C: Strict unlock enforcement for Admin on PUBLISHED quarterly reports
    // SuperAdmin retains full bypass; Admin must have explicit unlock approval
    if (user && user.is_superadmin) {
      return; // SuperAdmin: full override, no unlock required
    }

    if (user && this.permissionResolver.isAdmin(user)) {
      if (quarter && row.quarterly_status === 'PUBLISHED' && !row.unlocked_by) {
        throw new ForbiddenException(
          'This quarterly report is published. An unlock must be approved before editing.',
        );
      }
      return; // Admin with unlock approval or non-PUBLISHED: allow edit
    }

    if (quarter && row.quarterly_status === 'PUBLISHED') {
      throw new ForbiddenException(
        'Cannot modify indicators/financials: the quarterly report for this period has been published.',
      );
    }
  }

  // ─── Phase CP: Financial Metrics Computation ─────────────────────────────────

  /**
   * Phase CP: Computes derived financial metrics based on BAR1 formulas.
   * These are calculated on-read (not stored) to ensure data integrity.
   *
   * @param record - Raw financial record from database
   * @returns Record with computed metrics added
   */
  private computeFinancialMetrics(record: any): any {
    const allotment = parseFloat(record.allotment) || 0;
    const target = parseFloat(record.target) || 0;
    const obligation = parseFloat(record.obligation) || 0;
    const disbursement = parseFloat(record.disbursement) || 0;

    // BAR1 Formula: Variance = Target - Obligation
    const variance = target > 0 && obligation > 0 ? target - obligation : null;

    // BAR1 Formula: Utilization Rate = (Obligation / Allotment) × 100
    const utilization_rate =
      allotment > 0 ? (obligation / allotment) * 100 : null;

    // Phase EV-C: DBM BAR No. 2 "Unobligated Balance" = Appropriation - Obligations
    const balance = allotment > 0 ? allotment - obligation : null;

    // BAR1 Formula: Disbursement Rate = (Disbursement / Obligation) × 100
    const disbursement_rate =
      obligation > 0 ? (disbursement / obligation) * 100 : null;

    return {
      ...record,
      variance: variance !== null ? parseFloat(variance.toFixed(2)) : null,
      utilization_rate:
        utilization_rate !== null
          ? parseFloat(utilization_rate.toFixed(2))
          : null,
      balance: balance !== null ? parseFloat(balance.toFixed(2)) : null,
      disbursement_rate:
        disbursement_rate !== null
          ? parseFloat(disbursement_rate.toFixed(2))
          : null,
    };
  }

  async findAll(
    query: QueryOperationDto,
    user?: JwtPayload,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20 } = query;

    // Phase X + Y + AM + AT: visibility is decided here and handed to the repository as a
    // scope. The repository applies it alongside every other filter, so no filter combination
    // can widen what this user was allowed to see.
    const queryAny = query as any;
    const isAdmin = user ? this.permissionResolver.isAdmin(user) : true;
    let options: FindAllOperationsOptions;

    if (queryAny.publication_status) {
      options =
        queryAny.publication_status !== 'PUBLISHED' && user && !isAdmin
          ? {
              scope: 'own-status',
              userId: user.sub,
              publicationStatus: queryAny.publication_status,
            }
          : { scope: 'all', publicationStatus: queryAny.publication_status };
    } else if (user && !isAdmin) {
      const recordCampus = this.normalizeUserCampusToRecordCampus(user.campus);
      options = recordCampus
        ? { scope: 'campus', userId: user.sub, recordCampus }
        : { scope: 'published', userId: user.sub };
    } else {
      options = { scope: 'all' };
    }

    const { rows, total } = await this.uoRepo.findAllOperations(query, options);
    return createPaginatedResponse(rows, total, page, limit);
  }

  async findOne(id: string, user?: JwtPayload): Promise<any> {
    const operation = await this.uoRepo.findDetail(id);

    if (!operation) {
      throw new NotFoundException(`Operation with ID ${id} not found`);
    }

    // Track T-SEC-IDOR: object-level read authorization (OWASP API1 BOLA). Enforced ONLY when a
    // user is supplied — internal write-path callers pass no user and run their own authz. An
    // out-of-scope record returns 404 (not 403) to avoid ID enumeration, matching findAll's
    // "invisible" visibility semantics.
    if (user && !this.userCanViewOperation(operation, user)) {
      throw new NotFoundException(`Operation with ID ${id} not found`);
    }

    // Get organizational info
    const orgInfo = await this.orgInfoRepo.findForOperation(id);

    // Get indicators
    const indicators = await this.indicatorRepo.findForOperation(id);

    // Get financials
    const financials = await this.financialRepo.findForOperation(id);

    return {
      ...operation,
      organizational_info: orgInfo,
      indicators: indicators,
      financials: financials,
    };
  }

  async create(
    dto: CreateOperationDto,
    userId: string,
    _user?: JwtPayload,
  ): Promise<any> {
    // Check for duplicate code
    if (dto.code && (await this.uoRepo.codeExists(dto.code))) {
      throw new ConflictException(`Operation code ${dto.code} already exists`);
    }

    // Universal Draft Governance: ALL users create DRAFT
    // Publishing requires explicit approval action via POST /:id/publish endpoint
    const publicationStatus: PublicationStatus = 'DRAFT';
    const submittedBy = userId; // Always track submitter for audit trail
    const submittedAt = new Date(); // Always track submission time

    // Phase AN: Include assigned_to for inline assignment during creation
    // Phase BD: Include fiscal_year for year-based filtering2
    const created = await this.uoRepo.createOperation(
      dto,
      userId,
      publicationStatus,
      submittedBy,
      submittedAt,
    );

    // Phase AT: Handle multi-select assignments via junction table
    const recordId = created.id;
    if (dto.assigned_user_ids && dto.assigned_user_ids.length > 0) {
      await this.updateRecordAssignments(recordId, dto.assigned_user_ids);
    } else if (dto.assigned_to) {
      // Backward compatibility: single assigned_to also creates junction entry
      await this.updateRecordAssignments(recordId, [dto.assigned_to]);
    }

    this.logger.log(
      `OPERATION_CREATED: id=${recordId}, status=${publicationStatus}, by=${userId}`,
    );
    return created;
  }

  async update(
    id: string,
    dto: UpdateOperationDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<any> {
    // Get current record to check publication_status and ownership
    const currentRecord = await this.findOne(id);

    // Phase AC + AT: Ownership Check — Non-admin users can edit if creator OR assigned (via junction table)
    if (user && !this.permissionResolver.isAdmin(user)) {
      const isOwner = currentRecord.created_by === userId;
      const isAssigned = await this.isUserAssigned(id, userId);
      if (!isOwner && !isAssigned) {
        throw new ForbiddenException(
          'Cannot edit records you do not own or are not assigned to',
        );
      }
    }

    // Check for duplicate code if updating
    const dtoAny = dto as any;
    if (dtoAny.code && (await this.uoRepo.codeExists(dtoAny.code, id))) {
      throw new ConflictException(
        `Operation code ${dtoAny.code} already exists`,
      );
    }

    // Phase E: State Machine Lockdown
    // Direct publication_status changes via PATCH are not allowed
    // Users must use workflow endpoints: /submit-for-review, /publish, /reject
    if (dtoAny.publication_status) {
      throw new BadRequestException(
        'Cannot change publication_status via update. ' +
          'Use POST /:id/submit-for-review (DRAFT → PENDING_REVIEW), ' +
          'POST /:id/publish (PENDING_REVIEW → PUBLISHED), or ' +
          'POST /:id/reject (PENDING_REVIEW → REJECTED).',
      );
    }

    // Phase V/W: Deterministic State Machine — edit reverts any non-DRAFT status to DRAFT
    // PUBLISHED      → DRAFT (revoke approval, clear reviewed metadata)
    // REJECTED       → DRAFT (clear rejection, enable resubmission)
    // PENDING_REVIEW → DRAFT (cancel submission, clear submitted metadata)
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
    if (fields.length === 0) {
      return this.findOne(id);
    }

    await this.uoRepo.applyUpdate(
      id,
      dto,
      userId,
      requiresStatusReset
        ? priorStatus === 'PENDING_REVIEW'
          ? 'from-pending'
          : 'from-reviewed'
        : 'none',
    );

    // Phase AT: Handle multi-select assignments via junction table
    if (dto.assigned_user_ids !== undefined) {
      await this.updateRecordAssignments(id, dto.assigned_user_ids || []);
    }

    this.logger.log(
      `OPERATION_UPDATED: id=${id}, by=${userId}, fields=[${fields.join(',')}]${requiresStatusReset ? `, status_reset=DRAFT (was=${priorStatus})` : ''}`,
    );
    return this.findOne(id); // Return fresh data with assigned_users
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id);

    await this.uoRepo.softDelete(id, userId);

    this.logger.log(`OPERATION_DELETED: id=${id}, by=${userId}`);
  }

  // --- Draft Governance Workflow ---

  async submitForReview(id: string, userId: string): Promise<any> {
    const operation = await this.findOne(id);

    if (
      operation.publication_status !== 'DRAFT' &&
      operation.publication_status !== 'REJECTED'
    ) {
      throw new BadRequestException(
        `Only DRAFT or REJECTED records can be submitted for review. Current status: ${operation.publication_status}`,
      );
    }

    // Phase BW: Creator OR assigned user (via junction table) can submit for review
    const isOwner = operation.created_by === userId;
    const isAssigned = await this.isUserAssigned(id, userId);
    if (!isOwner && !isAssigned) {
      throw new ForbiddenException(
        'Only the creator or assigned user can submit this draft for review',
      );
    }

    const updated = await this.uoRepo.markSubmittedForReview(id, userId);

    this.logger.log(`OPERATION_SUBMITTED_FOR_REVIEW: id=${id}, by=${userId}`);
    return updated;
  }

  async publish(id: string, adminId: string, user: JwtPayload): Promise<any> {
    // Phase BBCH (Track 1): Admin OR an Approver/Manager 'university_operations' module-level grant.
    if (
      !(await this.permissionResolver.canApproveModule(
        user,
        this.UO_LEVEL_KEYS,
      ))
    ) {
      throw new ForbiddenException(
        'Insufficient module level to publish records',
      );
    }

    const operation = await this.findOne(id);

    // Centralized rank-based approval check (includes self-approval prevention)
    const approvalCheck = await this.permissionResolver.canApproveByRank(
      adminId,
      operation.created_by,
      user.is_superadmin,
    );
    if (!approvalCheck.allowed) {
      throw new ForbiddenException(approvalCheck.reason);
    }

    // Universal Draft Governance: Only PENDING_REVIEW records can be published
    // DRAFT must first be submitted for review via POST /:id/submit-for-review
    if (operation.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW records can be published. Current status: ${operation.publication_status}. ` +
          `DRAFT records must first be submitted for review via POST /:id/submit-for-review.`,
      );
    }

    const updated = await this.uoRepo.markPublished(id, adminId);

    this.logger.log(`OPERATION_PUBLISHED: id=${id}, by=${adminId}`);
    return updated;
  }

  async reject(
    id: string,
    adminId: string,
    notes: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase BBCH (Track 1): Admin OR an Approver/Manager 'university_operations' module-level grant.
    if (
      !(await this.permissionResolver.canApproveModule(
        user,
        this.UO_LEVEL_KEYS,
      ))
    ) {
      throw new ForbiddenException(
        'Insufficient module level to reject records',
      );
    }

    const operation = await this.findOne(id);

    if (operation.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW records can be rejected. Current status: ${operation.publication_status}`,
      );
    }

    if (!notes || notes.trim().length === 0) {
      throw new BadRequestException('Rejection notes are required');
    }

    const updated = await this.uoRepo.markRejected(id, adminId, notes.trim());

    this.logger.log(`OPERATION_REJECTED: id=${id}, by=${adminId}`);
    return updated;
  }

  /**
   * Withdraw a pending submission (return to DRAFT)
   * Only the original submitter can withdraw their own submission
   */
  async withdraw(id: string, userId: string): Promise<any> {
    const operation = await this.findOne(id);

    // Can only withdraw PENDING_REVIEW records
    if (operation.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW records can be withdrawn. Current status: ${operation.publication_status}`,
      );
    }

    // Only the original submitter can withdraw
    if (operation.submitted_by !== userId) {
      throw new ForbiddenException(
        'Only the original submitter can withdraw this submission',
      );
    }

    const updated = await this.uoRepo.markWithdrawn(id);

    this.logger.log(`OPERATION_WITHDRAWN: id=${id}, by=${userId}`);
    return updated;
  }

  // ─── Phase DY-C: Per-Quarter Submission Workflow ───────────────────────────────

  /**
   * Phase DY-C: Submit a single quarter for review
   */
  async submitQuarterForReview(
    id: string,
    quarter: string,
    userId: string,
  ): Promise<any> {
    this.validateQuarterParam(quarter);
    const operation = await this.findOne(id);
    const statusCol = `status_${quarter.toLowerCase()}`;
    const currentStatus = operation[statusCol] || 'DRAFT';

    if (currentStatus !== 'DRAFT' && currentStatus !== 'REJECTED') {
      throw new BadRequestException(
        `${quarter} can only be submitted from DRAFT or REJECTED status. Current: ${currentStatus}`,
      );
    }

    const updated = await this.uoRepo.setQuarterStatus(
      id,
      quarter,
      'PENDING_REVIEW',
    );

    this.logger.log(
      `QUARTER_SUBMITTED: id=${id}, quarter=${quarter}, by=${userId}`,
    );
    return updated;
  }

  /**
   * Phase DY-C: Approve a single quarter (Admin only)
   */
  async approveQuarter(
    id: string,
    quarter: string,
    adminId: string,
    user: JwtPayload,
  ): Promise<any> {
    this.validateQuarterParam(quarter);
    // Phase BBCH (Track 1): Admin OR an Approver/Manager 'university_operations' module-level grant.
    if (
      !(await this.permissionResolver.canApproveModule(
        user,
        this.UO_LEVEL_KEYS,
      ))
    )
      throw new ForbiddenException(
        'Insufficient module level to approve quarters',
      );
    const operation = await this.findOne(id);

    // Prevent self-approval
    if (operation.created_by === adminId) {
      throw new ForbiddenException('Cannot approve your own submission');
    }

    const statusCol = `status_${quarter.toLowerCase()}`;
    const currentStatus = operation[statusCol] || 'DRAFT';
    if (currentStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `${quarter} can only be approved from PENDING_REVIEW status. Current: ${currentStatus}`,
      );
    }

    const updated = await this.uoRepo.setQuarterStatus(
      id,
      quarter,
      'PUBLISHED',
    );

    this.logger.log(
      `QUARTER_APPROVED: id=${id}, quarter=${quarter}, by=${adminId}`,
    );
    return updated;
  }

  /**
   * Phase DY-C: Reject a single quarter (Admin only)
   */
  async rejectQuarter(
    id: string,
    quarter: string,
    adminId: string,
    notes: string,
    user: JwtPayload,
  ): Promise<any> {
    this.validateQuarterParam(quarter);
    // Phase BBCH (Track 1): Admin OR an Approver/Manager 'university_operations' module-level grant.
    if (
      !(await this.permissionResolver.canApproveModule(
        user,
        this.UO_LEVEL_KEYS,
      ))
    )
      throw new ForbiddenException(
        'Insufficient module level to reject quarters',
      );

    const operation = await this.findOne(id);
    const statusCol = `status_${quarter.toLowerCase()}`;
    const currentStatus = operation[statusCol] || 'DRAFT';
    if (currentStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `${quarter} can only be rejected from PENDING_REVIEW status. Current: ${currentStatus}`,
      );
    }

    const updated = await this.uoRepo.setQuarterStatus(
      id,
      quarter,
      'REJECTED',
      notes || '',
    );

    this.logger.log(
      `QUARTER_REJECTED: id=${id}, quarter=${quarter}, by=${adminId}`,
    );
    return updated;
  }

  /**
   * Phase DY-C: Withdraw a quarter submission
   */
  async withdrawQuarter(
    id: string,
    quarter: string,
    userId: string,
  ): Promise<any> {
    this.validateQuarterParam(quarter);
    const operation = await this.findOne(id);
    const statusCol = `status_${quarter.toLowerCase()}`;
    const currentStatus = operation[statusCol] || 'DRAFT';
    if (currentStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `${quarter} can only be withdrawn from PENDING_REVIEW status. Current: ${currentStatus}`,
      );
    }

    const updated = await this.uoRepo.setQuarterStatus(id, quarter, 'DRAFT');

    this.logger.log(
      `QUARTER_WITHDRAWN: id=${id}, quarter=${quarter}, by=${userId}`,
    );
    return updated;
  }

  private validateQuarterParam(quarter: string): void {
    if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
      throw new BadRequestException(
        `Invalid quarter: ${quarter}. Must be Q1, Q2, Q3, or Q4.`,
      );
    }
  }

  /**
   * Get drafts pending review (Admin dashboard)
   * Filtered by admin's module assignments
   */
  async findPendingReview(user: JwtPayload): Promise<any[]> {
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view pending reviews');
    }

    // Check module access (SuperAdmin or user with OPERATIONS/ALL assignment)
    if (!user.is_superadmin) {
      const hasAccess = await this.moduleAssignmentRepo.hasModuleAccess(
        user.sub,
        ModuleType.OPERATIONS,
      );

      if (!hasAccess) {
        return []; // No access to this module
      }
    }

    return this.uoRepo.findPendingReview();
  }

  findMyDrafts(userId: string): Promise<any[]> {
    return this.uoRepo.findDraftsForUser(userId);
  }

  // --- Indicators ---

  /**
   * Phase CT: Fetch fixed indicator taxonomy for an operation's pillar type
   * Returns the 3 seeded indicators for the operation's pillar (e.g., HIGHER_EDUCATION)
   */
  async findIndicatorTaxonomy(operationId: string): Promise<any[]> {
    const operation = await this.findOne(operationId);

    const taxa = await this.taxonomyRepo.find(
      { pillarType: operation.operation_type, isActive: true },
      { orderBy: { indicatorOrder: QueryOrder.ASC } },
    );

    return taxa.map((t) => ({
      id: t.id,
      pillar_type: t.pillarType,
      indicator_name: t.indicatorName,
      indicator_code: t.indicatorCode,
      uacs_code: t.uacsCode,
      indicator_order: t.indicatorOrder,
      indicator_type: t.indicatorType,
      unit_type: t.unitType,
      description: t.description,
    }));
  }

  /**
   * Phase CX-B: Fetch taxonomy directly by pillar type (no operation ID needed)
   * Used by the main pillar-based interface
   */
  async findTaxonomyByPillarType(pillarType: string): Promise<any[]> {
    const validPillarTypes = [
      'HIGHER_EDUCATION',
      'ADVANCED_EDUCATION',
      'RESEARCH',
      'TECHNICAL_ADVISORY',
    ];
    if (!validPillarTypes.includes(pillarType)) {
      return [];
    }

    const taxa = await this.taxonomyRepo.find(
      { pillarType, isActive: true },
      {
        orderBy: {
          indicatorType: QueryOrder.ASC,
          indicatorOrder: QueryOrder.ASC,
        },
      },
    );

    return taxa.map((t) => ({
      id: t.id,
      pillar_type: t.pillarType,
      indicator_name: t.indicatorName,
      indicator_code: t.indicatorCode,
      uacs_code: t.uacsCode,
      indicator_order: t.indicatorOrder,
      indicator_type: t.indicatorType,
      unit_type: t.unitType,
      description: t.description,
    }));
  }

  /**
   * Phase CX-B: Fetch all indicators by pillar type and fiscal year (cross-operation)
   * Aggregates indicator data across all operations of the same pillar type
   * Phase DK-B: orphaned indicators (pillar_indicator_id = NULL) are included
   */
  async findIndicatorsByPillarAndYear(
    pillarType: string,
    fiscalYear: number,
    quarter?: string,
  ): Promise<any[]> {
    // Phase DJ-B: Debug logging for progress malfunction diagnosis
    this.logger.debug(
      `[findIndicatorsByPillarAndYear] pillar_type=${pillarType} (${typeof pillarType}), fiscal_year=${fiscalYear} (${typeof fiscalYear}), quarter=${quarter}`,
    );

    // Phase DK-B: an orphaned indicator has no taxonomy at all, so the repository's optional
    // taxonomy relation keeps it in the result — what the LEFT JOIN was for. An unknown pillar
    // type returns an empty list there, matching the guard this method used to apply itself.
    const result = await this.indicatorRepo.findByPillarAndYear(
      pillarType,
      fiscalYear,
      quarter,
    );

    // Phase DK-B: Log orphan count for admin awareness
    const orphanCount = result.filter((r) => !r.pillar_indicator_id).length;
    if (orphanCount > 0) {
      this.logger.warn(
        `[findIndicatorsByPillarAndYear] Found ${orphanCount} orphaned indicators for ${pillarType} FY${fiscalYear}`,
      );
    }

    this.logger.debug(
      `[findIndicatorsByPillarAndYear] Returned ${result.length} indicators (${orphanCount} orphaned) for ${pillarType} FY${fiscalYear}`,
    );

    return result.map((row) => this.computeIndicatorMetrics(row));
  }

  /**
   * Phase CT: Fetch indicators with taxonomy metadata joined
   * Returns indicator data with pillar_indicator_taxonomy fields (indicator_name, uacs_code, etc.)
   */
  async findIndicators(
    operationId: string,
    fiscalYear?: number,
  ): Promise<any[]> {
    await this.findOne(operationId);

    const result = await this.indicatorRepo.findForOperationWithTaxonomy(
      operationId,
      fiscalYear,
    );
    return result.map((row) => this.computeIndicatorMetrics(row));
  }

  /**
   * Phase CT + DN-A + DT: Compute indicator metrics (variance, accomplishment rate)
   * Called on read to ensure computed values are always accurate
   *
   * Phase DN-A: Unit-type-aware aggregation
   * - PERCENTAGE: use AVERAGE (quarterly rates should be averaged)
   * - COUNT/WEIGHTED_COUNT: use SUM (cumulative totals per BAR1 standard)
   *
   * Phase DT-A: PostgreSQL DECIMAL/NUMERIC columns are returned as strings
   * by node-postgres to preserve precision. All values must be converted
   * to numbers before arithmetic operations.
   */
  private computeIndicatorMetrics(record: any): any {
    // Phase DT-A: Convert PostgreSQL DECIMAL strings to numbers
    // node-postgres returns DECIMAL/NUMERIC columns as strings to preserve precision
    const toNumber = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      const num = typeof v === 'string' ? parseFloat(v) : Number(v);
      return isNaN(num) ? null : num;
    };

    // Phase DT-B: Safe formatting helper - prevents TypeError on non-numbers
    const formatDecimal = (
      v: number | null,
      decimals: number,
    ): number | null => {
      if (v === null || typeof v !== 'number' || isNaN(v)) return null;
      return parseFloat(v.toFixed(decimals));
    };

    // Phase FY-1: DBM BAR1 standard — COUNT/WEIGHTED_COUNT use SUM (Directive 211/212).
    // Phase AAAC-A: PERCENTAGE indicators with complete per-quarter numerator/denominator
    // data aggregate as ΣN/ΣD × 100 (denominator-weighted) rather than summing already-
    // computed percentages (which produced meaningless values like 91.3+66.7+84.5=242.52).
    // When any filled quarter lacks a valid fraction pair, fall back to the legacy SUM so
    // existing direct-% records (no N/D columns) are unaffected.
    const isPercentage = record.unit_type === 'PERCENTAGE';

    // Computes the total for one side (target or actual). Returns the numeric total
    // plus an optional "ΣN/ΣD" fraction string when the fraction-aggregate path applies.
    const computeSideTotal = (
      values: (number | null)[],
      numerators: (number | null)[],
      denominators: (number | null)[],
    ): { total: number | null; fraction: string | null } => {
      const filled = values.filter((v): v is number => v !== null);
      const legacySum =
        filled.length > 0 ? filled.reduce((a, b) => a + b, 0) : null;

      if (!isPercentage) {
        return { total: legacySum, fraction: null };
      }

      // Fraction-aggregate path: every quarter that has a value must also have a
      // valid numerator/denominator pair (denominator > 0).
      let sumNum = 0;
      let sumDen = 0;
      let allFilledHaveFraction = filled.length > 0;
      for (let i = 0; i < 4; i++) {
        if (values[i] === null) continue; // unfilled quarter — ignore
        const n = numerators[i];
        const d = denominators[i];
        if (n === null || d === null || d <= 0) {
          allFilledHaveFraction = false;
          break;
        }
        sumNum += n;
        sumDen += d;
      }

      if (allFilledHaveFraction && sumDen > 0) {
        const pct = Math.min((sumNum / sumDen) * 100, 9999.99);
        return {
          total: parseFloat(pct.toFixed(4)),
          fraction: `${sumNum}/${sumDen}`,
        };
      }

      return { total: legacySum, fraction: null };
    };

    const targetSide = computeSideTotal(
      [
        toNumber(record.target_q1),
        toNumber(record.target_q2),
        toNumber(record.target_q3),
        toNumber(record.target_q4),
      ],
      [
        toNumber(record.target_numerator_q1),
        toNumber(record.target_numerator_q2),
        toNumber(record.target_numerator_q3),
        toNumber(record.target_numerator_q4),
      ],
      [
        toNumber(record.target_denominator_q1),
        toNumber(record.target_denominator_q2),
        toNumber(record.target_denominator_q3),
        toNumber(record.target_denominator_q4),
      ],
    );
    const actualSide = computeSideTotal(
      [
        toNumber(record.accomplishment_q1),
        toNumber(record.accomplishment_q2),
        toNumber(record.accomplishment_q3),
        toNumber(record.accomplishment_q4),
      ],
      [
        toNumber(record.numerator_q1),
        toNumber(record.numerator_q2),
        toNumber(record.numerator_q3),
        toNumber(record.numerator_q4),
      ],
      [
        toNumber(record.denominator_q1),
        toNumber(record.denominator_q2),
        toNumber(record.denominator_q3),
        toNumber(record.denominator_q4),
      ],
    );

    const totalTarget = targetSide.total;
    const totalAccomplishment = actualSide.total;
    const totalTargetFraction = targetSide.fraction;
    const totalActualFraction = actualSide.fraction;

    // Phase HA: Override totals — when set, replace quarterly sums as base for variance/rate (Directive 369)
    const overrideTotalTarget =
      record.override_total_target != null
        ? toNumber(record.override_total_target)
        : null;
    const overrideTotalActual =
      record.override_total_actual != null
        ? toNumber(record.override_total_actual)
        : null;
    const effectiveTarget = overrideTotalTarget ?? totalTarget;
    const effectiveActual = overrideTotalActual ?? totalAccomplishment;

    // Phase DT-D: Variance with safe bounds
    // DECIMAL(10,4) max is 999999.9999
    const MAX_VARIANCE = 999999.9999;
    const MIN_VARIANCE = -999999.9999;
    let variance: number | null = null;
    if (effectiveTarget !== null && effectiveActual !== null) {
      const rawVariance = effectiveActual - effectiveTarget;
      variance = Math.max(MIN_VARIANCE, Math.min(rawVariance, MAX_VARIANCE));
    }

    // Phase DT-C: Accomplishment rate with safe bounds
    // Cap at 9999.99% to prevent numeric overflow in edge cases
    const MAX_RATE = 9999.99;
    let accomplishmentRate: number | null = null;
    if (
      effectiveTarget !== null &&
      effectiveTarget !== 0 &&
      effectiveActual !== null
    ) {
      const rawRate = (effectiveActual / effectiveTarget) * 100;
      accomplishmentRate = Math.min(rawRate, MAX_RATE);
    }

    // Phase FY-2: Rate override — if set, replaces displayed rate (Directive 213)
    const overrideRate =
      record.override_rate != null ? toNumber(record.override_rate) : null;

    // Phase GY/GZ: Annual variance override — when set, replaces computed variance display (Directives 356, 359)
    const overrideVarianceAnnual =
      record.override_variance != null
        ? toNumber(record.override_variance)
        : null;

    // An override rate is entered precisely because the auto-calculation is wrong for this
    // record, so the variance derived from the same quarterly totals is wrong too. When no
    // explicit variance override was given, restate the variance the override rate implies
    // (actual - target, where actual = target x rate) instead of publishing a figure the
    // encoder has already declared incorrect. An explicit override_variance still wins.
    let overrideRateVariance: number | null = null;
    // A zero target makes the rate meaningless, so there is nothing to derive from it and
    // the quarterly figures remain the better answer.
    if (
      overrideVarianceAnnual === null &&
      overrideRate !== null &&
      effectiveTarget !== null &&
      effectiveTarget !== 0
    ) {
      const rawRateVariance = effectiveTarget * (overrideRate / 100 - 1);
      overrideRateVariance = Math.max(
        MIN_VARIANCE,
        Math.min(rawRateVariance, MAX_VARIANCE),
      );
    }

    const effectiveVariance =
      overrideVarianceAnnual ?? overrideRateVariance ?? variance;

    return {
      ...record,
      // Phase HD: total_target/total_accomplishment return effective values (override ?? raw) — Directive 383
      total_target: formatDecimal(overrideTotalTarget ?? totalTarget, 4),
      total_accomplishment: formatDecimal(
        overrideTotalActual ?? totalAccomplishment,
        4,
      ),
      average_target: formatDecimal(overrideTotalTarget ?? totalTarget, 4),
      average_accomplishment: formatDecimal(
        overrideTotalActual ?? totalAccomplishment,
        4,
      ),
      computed_total_target: formatDecimal(totalTarget, 4),
      computed_total_accomplishment: formatDecimal(totalAccomplishment, 4),
      // Phase AAAC-A: fraction-aggregate caption ("ΣN/ΣD") for PERCENTAGE indicators
      // with complete per-quarter numerator/denominator data (null otherwise)
      total_target_fraction: totalTargetFraction,
      total_actual_fraction: totalActualFraction,
      // Phase HA: Override totals passthrough (Directive 369)
      override_total_target: formatDecimal(overrideTotalTarget, 4),
      override_total_actual: formatDecimal(overrideTotalActual, 4),
      // Phase GY/GZ: Annual override fields only (Directive 359)
      variance: formatDecimal(effectiveVariance, 4),
      override_variance: formatDecimal(overrideVarianceAnnual, 2),
      computed_variance: formatDecimal(variance, 4),
      // Lets the UI say why a variance differs from the quarterly sums, instead of leaving
      // the reader to guess whether an override is in play.
      variance_source:
        overrideVarianceAnnual !== null
          ? 'override_variance'
          : overrideRateVariance !== null
            ? 'override_rate'
            : 'computed',
      // Phase FY-2: computed_rate = auto-calculated, accomplishment_rate = override if set
      computed_rate: formatDecimal(accomplishmentRate, 2),
      accomplishment_rate: formatDecimal(overrideRate ?? accomplishmentRate, 2),
      override_rate: formatDecimal(overrideRate, 2),
    };
  }

  /**
   * Phase CT: Create quarterly indicator data linked to fixed taxonomy
   * This enforces the pillar-based model where indicator metadata comes from taxonomy
   */
  async createIndicatorQuarterlyData(
    operationId: string,
    dto: CreateIndicatorQuarterlyDto,
    userId: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase CM: Ownership validation
    await this.validateOperationOwnership(operationId, userId, user);
    // Phase CO: Publication status lock
    await this.validateOperationEditable(
      operationId,
      dto.reported_quarter,
      user,
    );

    // Verify pillar_indicator_id exists and matches operation's pillar type
    const operation = await this.findOne(operationId);
    const taxonomy = await this.taxonomyRepo.findActiveById(
      dto.pillar_indicator_id,
    );

    if (!taxonomy) {
      throw new BadRequestException(
        'Invalid pillar_indicator_id: Indicator not found in taxonomy',
      );
    }

    if (taxonomy.pillar_type !== operation.operation_type) {
      throw new BadRequestException(
        `Indicator taxonomy mismatch: Indicator belongs to ${taxonomy.pillar_type}, but operation is ${operation.operation_type}`,
      );
    }

    // Check if quarterly data already exists for this indicator + fiscal year + quarter
    // Phase DY-C: a missing reported_quarter is its own slot, distinct from any quarter's,
    // so it is matched as NULL rather than left out of the lookup.
    const duplicate = await this.indicatorRepo.quarterlyDataExists(
      dto.pillar_indicator_id,
      operationId,
      dto.fiscal_year,
      dto.reported_quarter,
    );

    if (duplicate) {
      throw new ConflictException(
        `Quarterly data already exists for indicator "${taxonomy.indicator_name}" in fiscal year ${dto.fiscal_year}. Use PATCH to update.`,
      );
    }

    // Phase DY-C: Include reported_quarter in INSERT
    // Phase FY-2: Include override_rate in INSERT
    // Phase GY/GZ: Include override_variance (annual-only override model — Directive 359)
    // Phase HA: Include override_total_target, override_total_actual (Directive 370)
    // Phase HE: Include catch_up_plan, facilitating_factors, ways_forward (Directive 386)
    // Phase TTT: Include numerator/denominator fraction fields for PERCENTAGE indicators
    // Phase DY-C/FY-2/GY/GZ/HA/HE/TTT: every quarterly, override, fraction and narrative
    // column comes straight off the DTO — the repository matches each key to a column on the
    // entity, so a new column needs no change here.
    const created = await this.indicatorRepo.createQuarterlyData(
      operationId,
      dto,
      taxonomy.indicator_name,
      userId,
    );

    this.logger.log(
      `INDICATOR_QUARTERLY_CREATED: id=${created.id}, taxonomy=${dto.pillar_indicator_id}, operation=${operationId}, by=${userId}`,
    );

    // Phase GOV-C: Auto-revert quarterly report to DRAFT when indicator data changes
    await this.autoRevertQuarterlyReport(
      dto.fiscal_year,
      dto.reported_quarter,
      userId,
    );

    return this.computeIndicatorMetrics(created);
  }

  /**
   * Phase DJ-A: Update quarterly indicator data with full validation
   * Enforces fiscal_year scope, taxonomy validation, and pillar type match
   * Unlike the generic updateIndicator, this validates quarterly-specific constraints
   */
  async updateIndicatorQuarterlyData(
    operationId: string,
    indicatorId: string,
    dto: UpdateIndicatorQuarterlyDto,
    userId: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase DL-A: Entry logging for diagnostic purposes
    this.logger.log(
      `[PATCH /indicators/quarterly] ENTRY: operationId=${operationId}, indicatorId=${indicatorId}, payload.fiscal_year=${dto.fiscal_year || 'not provided'}, userId=${userId}`,
    );

    // Ownership and publication status validation
    await this.validateOperationOwnership(operationId, userId, user);
    await this.validateOperationEditable(
      operationId,
      dto.reported_quarter,
      user,
    );

    // Phase DK-A: orphaned indicators (pillar_indicator_id NULL) are included — the
    // taxonomy relation is optional, so pillar_type simply comes back null for them.
    const indicator = await this.indicatorRepo.findContext(
      indicatorId,
      operationId,
    );

    // Phase DL-A: Diagnostic logging for lookup result
    this.logger.log(
      `[PATCH /indicators/quarterly] LOOKUP RESULT: found=${!!indicator}`,
    );

    if (indicator) {
      this.logger.log(
        `[PATCH /indicators/quarterly] FOUND INDICATOR: id=${indicator.id}, operation_id=${indicator.operation_id}, fiscal_year=${indicator.fiscal_year}, pillar_indicator_id=${indicator.pillar_indicator_id || 'NULL (orphan)'}`,
      );
    } else {
      // Phase DL-A: Enhanced 404 diagnostic logging
      this.logger.error(
        `[PATCH /indicators/quarterly] 404 TRIGGERED: Indicator ${indicatorId} not found in operation ${operationId}`,
      );

      // Log all indicators for this operation
      const allIndicators =
        await this.indicatorRepo.findSampleForOperation(operationId);
      this.logger.error(
        `[PATCH /indicators/quarterly] Available indicators in operation ${operationId}: ${JSON.stringify(
          allIndicators.map((r) => ({
            id: r.id,
            fiscal_year: r.fiscal_year,
            particular: r.particular,
          })),
        )}`,
      );

      // Check if indicator exists in OTHER operations
      const elsewhere = await this.indicatorRepo.findPlain(indicatorId);
      if (elsewhere && !elsewhere.deleted_at) {
        this.logger.error(
          `[PATCH /indicators/quarterly] MISMATCH CONFIRMED: Indicator ${indicatorId} belongs to operation ${elsewhere.operation_id} (FY ${elsewhere.fiscal_year}), but PATCH was sent to operation ${operationId}`,
        );
      } else {
        this.logger.error(
          `[PATCH /indicators/quarterly] Indicator ${indicatorId} does NOT exist in database (deleted or invalid UUID)`,
        );
      }
    }

    if (!indicator) {
      throw new NotFoundException(
        `Indicator ${indicatorId} not found in operation ${operationId}`,
      );
    }

    // Phase DK-A: Handle orphaned indicators (pillar_indicator_id = NULL)
    if (!indicator.pillar_indicator_id) {
      this.logger.warn(
        `[updateIndicatorQuarterlyData] Orphaned indicator detected: id=${indicatorId}, particular="${indicator.particular}"`,
      );
      // Allow update but skip pillar type validation for orphans
    } else {
      // Validate pillar type match only for linked indicators
      if (indicator.pillar_type !== indicator.operation_type) {
        this.logger.warn(
          `[updateIndicatorQuarterlyData] Pillar type mismatch: indicator pillar=${indicator.pillar_type}, operation type=${indicator.operation_type}`,
        );
      }
    }

    // Prevent fiscal_year changes (must create new record instead)
    if (dto.fiscal_year && dto.fiscal_year !== indicator.fiscal_year) {
      throw new BadRequestException(
        `Cannot change fiscal year from ${indicator.fiscal_year} to ${dto.fiscal_year}. Create new record for different year.`,
      );
    }

    // Prevent pillar_indicator_id changes only for linked indicators
    if (dto.pillar_indicator_id && indicator.pillar_indicator_id) {
      if (dto.pillar_indicator_id !== indicator.pillar_indicator_id) {
        const target = await this.taxonomyRepo.findActiveById(
          dto.pillar_indicator_id,
        );
        if (!target) {
          throw new BadRequestException(
            'Invalid pillar_indicator_id: not found in taxonomy',
          );
        }
        if (target.pillar_type !== indicator.pillar_type) {
          throw new BadRequestException(
            `Cannot change indicator to different pillar type (current: ${indicator.pillar_type}, new: ${target.pillar_type})`,
          );
        }
      }
    }

    // Perform dynamic field update (same logic as generic updateIndicator, excluding pillar_indicator_id)
    // reported_quarter is also excluded: it is an immutable partitioning key set at CREATE time;
    // mutating it via PATCH on a NULL-quarter row triggers the uq_oi_quarterly_per_quarter constraint.
    const fields = Object.keys(dto).filter(
      (k) =>
        dto[k] !== undefined &&
        k !== 'pillar_indicator_id' &&
        k !== 'reported_quarter',
    );
    if (fields.length === 0) {
      // No changes, return current state with metrics
      const current = await this.indicatorRepo.findEnriched(indicatorId);
      return this.computeIndicatorMetrics(current);
    }

    // pillar_indicator_id and reported_quarter are excluded above; every other key is matched
    // to a column on the entity, so a key that is not one is ignored rather than written.
    await this.indicatorRepo.applyUpdate(indicatorId, dto, userId, [
      'pillar_indicator_id',
      'reported_quarter',
    ]);

    this.logger.log(
      `INDICATOR_QUARTERLY_UPDATED: id=${indicatorId}, operation=${operationId}, fiscal_year=${indicator.fiscal_year}, orphan=${!indicator.pillar_indicator_id}, by=${userId}`,
    );

    // Phase GOV-C: Auto-revert quarterly report to DRAFT when indicator data changes
    await this.autoRevertQuarterlyReport(
      indicator.fiscal_year,
      dto.reported_quarter,
      userId,
    );

    const enriched = await this.indicatorRepo.findEnriched(indicatorId);

    return this.computeIndicatorMetrics(enriched);
  }

  async createIndicator(
    operationId: string,
    dto: CreateIndicatorDto,
    userId: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase CM: Ownership validation
    await this.validateOperationOwnership(operationId, userId, user);
    // Phase CO: Publication status lock
    // Physical indicators span all quarters (column-based: target_q1..q4).
    // Quarter-specific publication lock is intentionally bypassed — guarded by uo.publication_status instead.
    await this.validateOperationEditable(operationId, undefined, user);

    const created = await this.indicatorRepo.createIndicator(
      operationId,
      dto,
      userId,
    );

    this.logger.log(
      `INDICATOR_CREATED: id=${created.id}, operation=${operationId}, by=${userId}`,
    );
    return created;
  }

  async updateIndicator(
    operationId: string,
    indicatorId: string,
    dto: Partial<CreateIndicatorDto>,
    userId: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase CM: Ownership validation
    await this.validateOperationOwnership(operationId, userId, user);
    // Phase CO: Publication status lock
    // Physical indicators span all quarters (column-based: target_q1..q4).
    // Quarter-specific publication lock is intentionally bypassed — guarded by uo.publication_status instead.
    await this.validateOperationEditable(operationId, undefined, user);

    const exists = await this.indicatorRepo.existsInOperation(
      indicatorId,
      operationId,
    );
    if (!exists) {
      throw new NotFoundException(`Indicator ${indicatorId} not found`);
    }

    const fields = Object.keys(dto).filter((k) => dto[k] !== undefined);
    if (fields.length === 0) {
      return this.indicatorRepo.findPlain(indicatorId);
    }

    // Every key is matched to a column on the entity, so one that is not a column is ignored
    // instead of being interpolated into a SET clause.
    await this.indicatorRepo.applyUpdate(indicatorId, dto, userId);

    this.logger.log(`INDICATOR_UPDATED: id=${indicatorId}, by=${userId}`);
    return this.indicatorRepo.findPlain(indicatorId);
  }

  async removeIndicator(
    operationId: string,
    indicatorId: string,
    userId: string,
    user: JwtPayload,
  ): Promise<void> {
    // Phase CM: Ownership validation (Admin check at controller, but still verify ownership context)
    await this.validateOperationOwnership(operationId, userId, user);
    // Phase CO: Publication status lock
    // Physical indicators span all quarters (column-based: target_q1..q4).
    // Quarter-specific publication lock is intentionally bypassed — guarded by uo.publication_status instead.
    await this.validateOperationEditable(operationId, undefined, user);

    const deleted = await this.indicatorRepo.softDelete(
      indicatorId,
      operationId,
      userId,
    );

    if (deleted === 0) {
      throw new NotFoundException(`Indicator ${indicatorId} not found`);
    }

    this.logger.log(`INDICATOR_DELETED: id=${indicatorId}, by=${userId}`);
  }

  // --- Financials ---
  // Phase BC: Added fund_type filter for BAR1 tab-based categorization
  async findFinancials(
    operationId: string,
    fiscalYear?: number,
    quarter?: string,
    fundType?: FundType,
    expenseClass?: string,
  ): Promise<any[]> {
    await this.findOne(operationId);

    // Phase BC/ET-B: fiscal year, quarter, fund_type and expense_class are the BAR1 tab
    // filters; one that is not supplied is simply not applied.
    const result = await this.financialRepo.findFiltered(operationId, {
      fiscalYear,
      quarter,
      fundType,
      expenseClass,
    });
    // Phase CP: Apply computed metrics to each financial record
    return result.map((row) => this.computeFinancialMetrics(row));
  }

  async createFinancial(
    operationId: string,
    dto: CreateFinancialDto,
    userId: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase FG-1: Use module-assignment check for financial CUD (shared pillar operations)
    await this.validateFinancialAccess(userId, user);
    // Phase FH-2: Financial uses quarterly report lock only, not operation publication
    await this.validateFinancialEditable(operationId, dto.quarter, user);

    // Phase BC: Include fund_type and project_code in INSERT
    // Phase ET-B: Include expense_class for BAR No. 2 categorization
    // Phase BC/ET-B: fund_type, project_code and expense_class are included; every column
    // comes straight off the DTO, matched to a column on the entity.
    const created = await this.financialRepo.createFinancial(
      operationId,
      dto,
      userId,
    );

    this.logger.log(
      `FINANCIAL_CREATED: id=${created.id}, operation=${operationId}, by=${userId}`,
    );
    // Phase FA-C: Auto-revert quarterly report Published → Draft on financial create
    await this.autoRevertQuarterlyReport(dto.fiscal_year, dto.quarter, userId);
    // Phase CP: Return record with computed metrics
    return this.computeFinancialMetrics(created);
  }

  async updateFinancial(
    operationId: string,
    financialId: string,
    dto: Partial<CreateFinancialDto>,
    userId: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase FG-1: Use module-assignment check for financial CUD (shared pillar operations)
    await this.validateFinancialAccess(userId, user);

    // Phase FA-B: Fetch existing record to get its quarter for governance validation
    const existing = await this.financialRepo.findKey(financialId, operationId);
    if (!existing) {
      throw new NotFoundException(`Financial record ${financialId} not found`);
    }
    const recordQuarter = existing.quarter;
    const recordFiscalYear = existing.fiscal_year;

    // Phase FH-2: Financial uses quarterly report lock only, not operation publication
    await this.validateFinancialEditable(operationId, recordQuarter, user);

    const fields = Object.keys(dto).filter((k) => dto[k] !== undefined);
    if (fields.length === 0) {
      const current = await this.financialRepo.findPlain(financialId);
      // Phase CP: Return record with computed metrics
      return this.computeFinancialMetrics(current);
    }

    // Every key is matched to a column on the entity, so one that is not a column is ignored
    // instead of being interpolated into a SET clause.
    const updated = await this.financialRepo.applyUpdate(
      financialId,
      dto,
      userId,
    );

    this.logger.log(`FINANCIAL_UPDATED: id=${financialId}, by=${userId}`);
    // Phase FA-C: Auto-revert quarterly report Published → Draft on financial update
    const revertFiscalYear = dto.fiscal_year ?? recordFiscalYear;
    const revertQuarter = dto.quarter ?? recordQuarter;
    await this.autoRevertQuarterlyReport(
      revertFiscalYear,
      revertQuarter,
      userId,
    );
    // Phase CP: Return record with computed metrics
    return this.computeFinancialMetrics(updated);
  }

  async removeFinancial(
    operationId: string,
    financialId: string,
    userId: string,
    user: JwtPayload,
  ): Promise<void> {
    // Phase FG-1: Use module-assignment check for financial CUD (shared pillar operations)
    await this.validateFinancialAccess(userId, user);

    // Phase FA-B: Fetch existing record to get its quarter for governance validation
    const existing = await this.financialRepo.findKey(financialId, operationId);
    if (!existing) {
      throw new NotFoundException(`Financial record ${financialId} not found`);
    }
    const recordQuarter = existing.quarter;
    const recordFiscalYear = existing.fiscal_year;

    // Phase FH-2: Financial uses quarterly report lock only, not operation publication
    await this.validateFinancialEditable(operationId, recordQuarter, user);

    const deleted = await this.financialRepo.softDelete(
      financialId,
      operationId,
      userId,
    );

    if (deleted === 0) {
      throw new NotFoundException(`Financial record ${financialId} not found`);
    }

    this.logger.log(`FINANCIAL_DELETED: id=${financialId}, by=${userId}`);
    // Phase FA-C: Auto-revert quarterly report Published → Draft on financial delete
    await this.autoRevertQuarterlyReport(
      recordFiscalYear,
      recordQuarter,
      userId,
    );
  }

  // ─── Phase CH: Organizational Info CRUD ─────────────────────────────────

  /**
   * Phase CH: Update or create organizational info for a university operation.
   * Handles both INSERT (first time) and UPDATE (subsequent edits).
   */
  async updateOrganizationalInfo(
    operationId: string,
    dto: {
      department?: string;
      agency_entity?: string;
      operating_unit?: string;
      organization_code?: string;
    },
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    // Verify operation exists
    await this.findOne(operationId);

    const existing = await this.orgInfoRepo.findOne({
      operationId,
      deletedAt: null,
    });
    if (!existing) {
      const info = this.orgInfoRepo.create({
        operationId,
        department: dto.department || '',
        agencyEntity: dto.agency_entity || '',
        operatingUnit: dto.operating_unit || '',
        organizationCode: dto.organization_code || '',
      });
      await this.orgInfoRepo.getEntityManager().persist(info).flush();
      this.logger.log(
        `ORG_INFO_CREATED: operation=${operationId}, by=${userId}`,
      );
    } else {
      existing.department = dto.department || '';
      existing.agencyEntity = dto.agency_entity || '';
      existing.operatingUnit = dto.operating_unit || '';
      existing.organizationCode = dto.organization_code || '';
      await this.orgInfoRepo.getEntityManager().flush();
      this.logger.log(
        `ORG_INFO_UPDATED: operation=${operationId}, by=${userId}`,
      );
    }

    return {
      success: true,
      message: 'Organizational info updated successfully',
    };
  }

  /**
   * Phase CH: Fetch organizational info for a university operation.
   */
  async findOrganizationalInfo(operationId: string): Promise<any> {
    await this.findOne(operationId);

    const info = await this.orgInfoRepo.findOne({
      operationId,
      deletedAt: null,
    });
    if (!info) {
      return {
        department: '',
        agency_entity: '',
        operating_unit: '',
        organization_code: '',
      };
    }

    return {
      department: info.department || '',
      agency_entity: info.agencyEntity || '',
      operating_unit: info.operatingUnit || '',
      organization_code: info.organizationCode || '',
      created_at: info.createdAt,
      updated_at: info.updatedAt,
    };
  }

  /**
   * Phase CX-F: Diagnostic method to check orphan indicator status
   * Returns count of orphan indicators (those without pillar_indicator_id)
   */
  async getOrphanIndicatorDiagnostics(): Promise<{
    totalIndicators: number;
    linkedIndicators: number;
    orphanIndicators: number;
    orphansByPillar: { pillar_type: string; count: number }[];
  }> {
    // Both queries are issued before either is awaited, so they still run concurrently.
    // Promise.all is avoided deliberately: its two overloads are a tuple form and an Iterable
    // form, and an array holding two differently-typed promises can resolve to the Iterable
    // one, which collapses the results into a union and breaks the destructuring.
    const countsQuery = this.indicatorRepo.countTotalAndLinked();
    const orphansQuery = this.indicatorRepo.countOrphansByPillar();
    const { total, linked } = await countsQuery;
    const orphansByPillar = await orphansQuery;

    return {
      totalIndicators: total,
      linkedIndicators: linked,
      orphanIndicators: total - linked,
      orphansByPillar,
    };
  }

  /**
   * Phase DK-D: Get detailed list of orphaned indicators for admin review
   * Returns full orphan records with quarterly data status
   */
  async getOrphanedIndicatorsList(): Promise<any[]> {
    const result = await this.indicatorRepo.findOrphans();

    this.logger.log(
      `[getOrphanedIndicatorsList] Found ${result.length} orphaned indicators`,
    );
    return result;
  }

  // ─── Phase DE: Analytics Methods ─────────────────────────────────────────────

  /**
   * Phase DE-A: Get pillar summary analytics
   * Returns aggregated metrics for each pillar including:
   * - Total indicators in taxonomy
   * - Indicators with data for the fiscal year
   * - Average accomplishment rate across all indicators
   */
  async getPillarSummary(fiscalYear: number): Promise<{
    pillars: {
      pillar_type: string;
      pillar_label: string;
      organizational_outcome: string;
      total_taxonomy_indicators: number;
      indicators_with_data: number;
      completion_rate: number;
      total_target: number;
      total_accomplishment: number;
      count_target: number;
      count_accomplishment: number;
      pct_avg_target: number | null;
      pct_avg_accomplishment: number | null;
      pct_indicator_count: number;
      count_indicator_count: number;
      average_accomplishment_rate: number | null;
      // Phase DR-A: Rate-based fields
      indicator_target_rate: number;
      indicator_actual_rate: number | null;
      accomplishment_rate_pct: number | null;
      outcome_indicators: number;
      output_indicators: number;
    }[];
    fiscal_year: number;
  }> {
    const pillarLabels: Record<string, string> = {
      HIGHER_EDUCATION: 'Higher Education Program',
      ADVANCED_EDUCATION: 'Advanced Education Program',
      RESEARCH: 'Research Program',
      TECHNICAL_ADVISORY: 'Technical Advisory & Extension Program',
    };

    const pillarOO: Record<string, string> = {
      HIGHER_EDUCATION: 'OO1',
      ADVANCED_EDUCATION: 'OO1',
      RESEARCH: 'OO2',
      TECHNICAL_ADVISORY: 'OO3',
    };

    // Get taxonomy counts per pillar
    const taxonomyRes = await this.taxonomyRepo.countByPillar();

    // Phase GO-1: Two-stage CTE aggregation — fixes data loss from DISTINCT ON in row-per-quarter model.
    // Stage 1 (canonical_ops): DISTINCT ON picks ONE canonical operation per indicator (multi-operation dedup).
    // Stage 2 (merged): MAX-aggregates ALL rows of that operation across reported_quarter values (multi-row dedup).
    // Outer SELECT is unchanged — deduped alias exposes same column interface as before.
    const dataRes =
      await this.indicatorRepo.getPillarSummaryAggregate(fiscalYear);

    // Phase DQ-B: Build response with unit-type-aware fields
    const dataMap = new Map<string, any>(
      dataRes.map((r) => [r.pillar_type, r]),
    );

    const pillars = taxonomyRes.map((t) => {
      const data = dataMap.get(t.pillar_type);
      const totalTaxonomy = t.total;
      const withData = data ? parseInt(data.indicators_with_data, 10) : 0;

      const completionRate =
        totalTaxonomy > 0
          ? parseFloat(((withData / totalTaxonomy) * 100).toFixed(2))
          : 0;

      const countTarget = data?.count_target
        ? parseFloat(data.count_target)
        : 0;
      const countAccomplishment = data?.count_accomplishment
        ? parseFloat(data.count_accomplishment)
        : 0;
      const pctAvgTarget = data?.pct_avg_target
        ? parseFloat(parseFloat(data.pct_avg_target).toFixed(2))
        : null;
      const pctAvgAccomplishment = data?.pct_avg_accomplishment
        ? parseFloat(parseFloat(data.pct_avg_accomplishment).toFixed(2))
        : null;

      return {
        pillar_type: t.pillar_type,
        pillar_label: pillarLabels[t.pillar_type] || t.pillar_type,
        organizational_outcome: pillarOO[t.pillar_type] || '',
        total_taxonomy_indicators: totalTaxonomy,
        indicators_with_data: withData,
        completion_rate: completionRate,
        // Phase DQ-B: Unit-type-aware totals
        count_target: countTarget,
        count_accomplishment: countAccomplishment,
        pct_avg_target: pctAvgTarget,
        pct_avg_accomplishment: pctAvgAccomplishment,
        pct_indicator_count: data?.pct_indicator_count
          ? parseInt(data.pct_indicator_count, 10)
          : 0,
        count_indicator_count: data?.count_indicator_count
          ? parseInt(data.count_indicator_count, 10)
          : 0,
        // Backward-compat: total_target now = count totals + pct averages (meaningful composite)
        total_target: countTarget + (pctAvgTarget || 0),
        total_accomplishment: countAccomplishment + (pctAvgAccomplishment || 0),
        average_accomplishment_rate: data?.avg_accomplishment_rate
          ? parseFloat(parseFloat(data.avg_accomplishment_rate).toFixed(2))
          : null,
        // Phase DR-A: Rate-based fields
        indicator_target_rate: data?.indicator_target_rate
          ? parseFloat(data.indicator_target_rate)
          : 0,
        indicator_actual_rate: data?.indicator_actual_rate
          ? parseFloat(parseFloat(data.indicator_actual_rate).toFixed(4))
          : null,
        accomplishment_rate_pct: (() => {
          const targetRate = data?.indicator_target_rate
            ? parseFloat(data.indicator_target_rate)
            : 0;
          const actualRate = data?.indicator_actual_rate
            ? parseFloat(data.indicator_actual_rate)
            : null;
          if (targetRate > 0 && actualRate !== null) {
            return parseFloat(((actualRate / targetRate) * 100).toFixed(2));
          }
          return null;
        })(),
        outcome_indicators: t.outcome_count,
        output_indicators: t.output_count,
      };
    });

    return {
      pillars,
      fiscal_year: fiscalYear,
    };
  }

  /**
   * Phase DR-B: Get quarterly trend data (rate-based)
   * Returns Q1-Q4 rate data for trend visualization
   * Rate model: target_rate = COUNT(indicators with target), actual_rate = SUM(actual/target)
   */
  async getQuarterlyTrend(
    fiscalYear: number,
    pillarType?: string,
  ): Promise<{
    quarters: string[];
    pillars: {
      pillar_type: string;
      accomplishment_rate_pct: (number | null)[];
    }[];
    fiscal_year: number;
    pillar_type: string | null;
  }> {
    // Phase DR-B: Rate-based quarterly trend with cross-operation deduplication.
    // Per quarter: target_rate = count of indicators with target > 0
    //              actual_rate = SUM(accomplishment/target) for those indicators
    // Phase AAAG-A: grouped BY pillar so each program (pillar) is an independent series —
    // accomplishment rates of unlike indicators across pillars are no longer merged.
    // Phase GO-2: the two-stage deduplication and the pillar narrowing both live in the
    // repository; the formula below is unchanged.
    const result = await this.indicatorRepo.getQuarterlyTrendAggregate(
      fiscalYear,
      pillarType,
    );

    // Phase AAAG-A: build one per-quarter rate array per pillar (formula unchanged,
    // now scoped within a single pillar).
    const pillars = result.map((row: any) => {
      const accomplishment_rate_pct = [1, 2, 3, 4].map((qNum) => {
        const targetRate = parseFloat(row[`target_rate_q${qNum}`]) || 0;
        const actualRate =
          row[`actual_rate_q${qNum}`] != null
            ? parseFloat(row[`actual_rate_q${qNum}`])
            : null;
        return targetRate > 0 && actualRate !== null
          ? parseFloat(((actualRate / targetRate) * 100).toFixed(2))
          : null;
      });
      return {
        pillar_type: row.pillar_type as string,
        accomplishment_rate_pct,
      };
    });

    return {
      quarters: ['Q1', 'Q2', 'Q3', 'Q4'],
      pillars,
      fiscal_year: fiscalYear,
      pillar_type: pillarType || null,
    };
  }

  /**
   * Phase DE-A: Get year-over-year comparison
   * Returns comparison data across multiple fiscal years
   */
  async getYearlyComparison(years: number[]): Promise<{
    years: {
      fiscal_year: number;
      total_indicators: number;
      total_target: number;
      total_accomplishment: number;
      overall_accomplishment_rate: number | null;
      pillars: {
        pillar_type: string;
        accomplishment_rate: number | null;
      }[];
    }[];
  }> {
    if (years.length === 0) {
      return { years: [] };
    }

    // Phase GO-3: Two-stage CTE for both yearlyRes and pillarRes.
    // Composite key: (fiscal_year, pillar_indicator_id) — spans multiple years in one query.
    // GN-3 outer formula (unit-type-aware mean-of-rates) unchanged.
    const yearlyRes = await this.indicatorRepo.getYearlyTotals(years);

    // Phase GO-3: Pillar breakdown — the same two-stage shape, grouped by pillar as well.
    const pillarRes = await this.indicatorRepo.getYearlyByPillar(years);

    // Build pillar map per year
    const pillarMap = new Map<
      number,
      Map<
        string,
        {
          rate: number | null;
          pct_avg_target: number | null;
          pct_avg_accomplishment: number | null;
          count_target: number | null;
          count_accomplishment: number | null;
        }
      >
    >();
    for (const row of pillarRes) {
      if (!pillarMap.has(row.fiscal_year)) {
        pillarMap.set(row.fiscal_year, new Map());
      }
      pillarMap.get(row.fiscal_year)!.set(row.pillar_type, {
        rate:
          row.avg_accomplishment_rate != null
            ? parseFloat(parseFloat(row.avg_accomplishment_rate).toFixed(2))
            : null,
        pct_avg_target:
          row.pct_avg_target != null
            ? parseFloat(parseFloat(row.pct_avg_target).toFixed(2))
            : null,
        pct_avg_accomplishment:
          row.pct_avg_accomplishment != null
            ? parseFloat(parseFloat(row.pct_avg_accomplishment).toFixed(2))
            : null,
        count_target:
          row.count_target != null ? parseFloat(row.count_target) : null,
        count_accomplishment:
          row.count_accomplishment != null
            ? parseFloat(row.count_accomplishment)
            : null,
      });
    }

    const validPillarTypes = [
      'HIGHER_EDUCATION',
      'ADVANCED_EDUCATION',
      'RESEARCH',
      'TECHNICAL_ADVISORY',
    ];

    const yearsData = yearlyRes.map((row) => {
      const overallRate =
        row.avg_accomplishment_rate != null
          ? parseFloat(parseFloat(row.avg_accomplishment_rate).toFixed(2))
          : null;

      const yearPillars = pillarMap.get(row.fiscal_year) || new Map();
      const pillars = validPillarTypes.map((pt) => {
        const p = yearPillars.get(pt);
        return {
          pillar_type: pt,
          accomplishment_rate: p?.rate ?? null,
          pct_avg_target: p?.pct_avg_target ?? null,
          pct_avg_accomplishment: p?.pct_avg_accomplishment ?? null,
          count_target: p?.count_target ?? null,
          count_accomplishment: p?.count_accomplishment ?? null,
        };
      });

      return {
        fiscal_year: row.fiscal_year,
        total_indicators: parseInt(row.total_indicators, 10),
        total_target: 0,
        total_accomplishment: 0,
        overall_accomplishment_rate: overallRate,
        pillars,
      };
    });

    return { years: yearsData };
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase GP-2: Financial Campus Breakdown Analytics
  // ═══════════════════════════════════════════════════════════════

  async getFinancialCampusBreakdown(
    fiscalYear: number,
  ): Promise<{ breakdown: any[]; fiscal_year: number }> {
    const result = await this.financialRepo.getCampusBreakdown(fiscalYear);

    const breakdown = result.map((row) => ({
      pillar_type: row.pillar_type,
      campus: row.campus,
      total_appropriation: parseFloat(row.total_appropriation),
      total_obligations: parseFloat(row.total_obligations),
      total_disbursement: parseFloat(row.total_disbursement),
      utilization_rate: parseFloat(row.utilization_rate),
    }));

    return { breakdown, fiscal_year: Number(fiscalYear) };
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase GS-3: Financial Pillar × Expense Class Breakdown (Directive 313)
  // Returns per-pillar rows with PS/MOOE/CO obligation totals
  // ═══════════════════════════════════════════════════════════════

  async getFinancialPillarExpenseBreakdown(
    fiscalYear: number,
  ): Promise<{ rows: any[]; fiscal_year: number }> {
    const result =
      await this.financialRepo.getPillarExpenseBreakdown(fiscalYear);

    const rows = result.map((row) => ({
      pillar_type: row.pillar_type,
      expense_class: row.expense_class,
      total_appropriation: parseFloat(row.total_appropriation),
      total_obligations: parseFloat(row.total_obligations),
      total_disbursement: parseFloat(row.total_disbursement),
    }));

    return { rows, fiscal_year: Number(fiscalYear) };
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase DO-B: Fiscal Year Configuration (SuperAdmin only)
  // ═══════════════════════════════════════════════════════════════

  async getActiveFiscalYears(): Promise<{ year: number; label: string }[]> {
    const rows = await this.fyRepo.find(
      { isActive: true },
      { orderBy: { year: QueryOrder.DESC }, fields: ['year', 'label'] },
    );
    return rows.map((r) => ({
      year: r.year,
      label: r.label ?? `FY ${r.year}`,
    }));
  }

  async createFiscalYear(
    year: number,
    label?: string,
  ): Promise<{ year: number; label: string; is_active: boolean }> {
    const existing = await this.fyRepo.findOne({ year });
    if (existing) {
      throw new ConflictException(`Fiscal year ${year} already exists`);
    }
    const fy = this.fyRepo.create({
      year,
      label: label || `FY ${year}`,
      isActive: true,
    });
    await this.fyRepo.getEntityManager().persist(fy).flush();
    return {
      year: fy.year,
      label: fy.label ?? `FY ${year}`,
      is_active: fy.isActive,
    };
  }

  async toggleFiscalYear(
    year: number,
    isActive: boolean,
  ): Promise<{ year: number; label: string; is_active: boolean }> {
    const fy = await this.fyRepo.findOne({ year });
    if (!fy) {
      throw new NotFoundException(`Fiscal year ${year} not found`);
    }
    fy.isActive = isActive;
    await this.fyRepo.getEntityManager().flush();
    return {
      year: fy.year,
      label: fy.label ?? `FY ${year}`,
      is_active: fy.isActive,
    };
  }

  // ─── Phase EM-B: Quarterly Reports ─────────────────────────────────────────

  private readonly QUARTER_TITLES: Record<string, string> = {
    Q1: 'Quarter 1 (Jan–March)',
    Q2: 'Quarter 2 (Apr–June)',
    Q3: 'Quarter 3 (Jul–Sep)',
    Q4: 'Quarter 4 (Oct–Dec)',
  };

  async createQuarterlyReport(
    fiscalYear: number,
    quarter: string,
    userId: string,
  ): Promise<any> {
    this.validateQuarterParam(quarter);

    // Check for existing record (UNIQUE constraint backup)
    const existing = await this.qrRepo.findOne({
      fiscalYear,
      quarter,
      deletedAt: null,
    });
    if (existing) {
      return this.serializeQuarterlyReport(existing);
    }

    const title = `${this.QUARTER_TITLES[quarter]} FY ${fiscalYear}`;
    const qr = this.qrRepo.create({
      fiscalYear,
      quarter,
      title,
      publicationStatus: 'DRAFT',
      createdBy: userId,
    });
    await this.qrRepo.getEntityManager().persist(qr).flush();

    this.logger.log(
      `QUARTERLY_REPORT_CREATED: FY=${fiscalYear}, Q=${quarter}, by=${userId}`,
    );
    return this.serializeQuarterlyReport(qr);
  }

  private serializeQuarterlyReport(qr: QuarterlyReport): any {
    return {
      id: qr.id,
      fiscal_year: qr.fiscalYear,
      quarter: qr.quarter,
      title: qr.title,
      publication_status: qr.publicationStatus,
      created_by: qr.createdBy,
      submission_count: qr.submissionCount,
      submitted_at: qr.submittedAt,
      submitted_by: qr.submittedBy,
      reviewed_at: qr.reviewedAt,
      reviewed_by: qr.reviewedBy,
      review_notes: qr.reviewNotes,
      created_at: qr.createdAt,
      updated_at: qr.updatedAt,
    };
  }

  async findQuarterlyReports(
    fiscalYear?: number,
    quarter?: string,
  ): Promise<any[]> {
    return this.qrRepo.findReports(fiscalYear, quarter);
  }

  async findOneQuarterlyReport(id: string): Promise<any> {
    const report = await this.qrRepo.findDetail(id);
    if (!report) {
      throw new NotFoundException(`Quarterly report ${id} not found`);
    }
    return report;
  }

  async findQuarterlyReportsPendingReview(user: JwtPayload): Promise<any[]> {
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view pending reviews');
    }

    // Module access check (same pattern as findPendingReview)
    if (!user.is_superadmin) {
      const hasAccess = await this.moduleAssignmentRepo.hasModuleAccess(
        user.sub,
        ModuleType.OPERATIONS,
      );
      if (!hasAccess) {
        return [];
      }
    }

    // Phase EZ-B: has_physical / has_financial say whether the quarter's fiscal year holds
    // any indicator or financial data, which the UI uses to label the submission.
    return this.qrRepo.findPendingReview();
  }

  async submitQuarterlyReport(
    id: string,
    userId: string,
    user: JwtPayload,
  ): Promise<any> {
    const report = await this.findOneQuarterlyReport(id);

    if (
      report.publication_status !== 'DRAFT' &&
      report.publication_status !== 'REJECTED'
    ) {
      throw new BadRequestException(
        `Only DRAFT or REJECTED reports can be submitted. Current status: ${report.publication_status}`,
      );
    }

    // Phase HU/BBCH: submitting requires Approver/Manager module level (or Admin) —
    // matches physical/index.vue's canSubmitAllPillars and the COI equivalent.
    // Deliberately NO creator/owner exception: owning a report isn't itself approval
    // authority (established rule — Contributor may input data but not submit it).
    if (
      !(await this.permissionResolver.canApproveModule(
        user,
        this.UO_LEVEL_KEYS,
      ))
    ) {
      throw new ForbiddenException(
        'Insufficient module level to submit this report',
      );
    }

    // Phase GOV-D: Snapshot submission event and increment submission_count
    await this.snapshotSubmissionHistory(
      { ...report, submission_count: (report.submission_count || 0) + 1 },
      'SUBMITTED',
      userId,
    );

    const updated = await this.qrRepo.markSubmitted(id, userId);

    this.logger.log(`QUARTERLY_REPORT_SUBMITTED: id=${id}, by=${userId}`);
    return updated;
  }

  async approveQuarterlyReport(
    id: string,
    adminId: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase BBCH (Track 1): Admin OR an Approver/Manager 'university_operations' module-level grant.
    if (
      !(await this.permissionResolver.canApproveModule(
        user,
        this.UO_LEVEL_KEYS,
      ))
    ) {
      throw new ForbiddenException(
        'Insufficient module level to approve quarterly reports',
      );
    }

    const report = await this.findOneQuarterlyReport(id);

    if (report.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW reports can be approved. Current status: ${report.publication_status}`,
      );
    }

    // Rank-based approval check (includes self-approval prevention)
    const approvalCheck = await this.permissionResolver.canApproveByRank(
      adminId,
      report.created_by,
      user.is_superadmin,
    );
    if (!approvalCheck.allowed) {
      throw new ForbiddenException(approvalCheck.reason);
    }

    // Phase GOV-D: Snapshot approval event
    await this.snapshotSubmissionHistory(report, 'APPROVED', adminId);

    const updated = await this.qrRepo.markApproved(id, adminId);

    this.logger.log(`QUARTERLY_REPORT_APPROVED: id=${id}, by=${adminId}`);
    return updated;
  }

  async rejectQuarterlyReport(
    id: string,
    adminId: string,
    notes: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase BBCH (Track 1): Admin OR an Approver/Manager 'university_operations' module-level grant.
    if (
      !(await this.permissionResolver.canApproveModule(
        user,
        this.UO_LEVEL_KEYS,
      ))
    ) {
      throw new ForbiddenException(
        'Insufficient module level to reject quarterly reports',
      );
    }

    const report = await this.findOneQuarterlyReport(id);

    if (report.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW reports can be rejected. Current status: ${report.publication_status}`,
      );
    }

    if (!notes || notes.trim().length === 0) {
      throw new BadRequestException('Rejection notes are required');
    }

    // Phase GOV-D: Snapshot rejection event
    await this.snapshotSubmissionHistory(
      report,
      'REJECTED',
      adminId,
      notes.trim(),
    );

    const updated = await this.qrRepo.markRejected(id, adminId, notes.trim());

    this.logger.log(`QUARTERLY_REPORT_REJECTED: id=${id}, by=${adminId}`);
    return updated;
  }

  async withdrawQuarterlyReport(
    id: string,
    userId: string,
    user: JwtPayload,
  ): Promise<any> {
    const report = await this.findOneQuarterlyReport(id);

    if (report.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW reports can be withdrawn. Current status: ${report.publication_status}`,
      );
    }

    // Admin/SuperAdmin, or Approver/Manager module level (any pending submission in
    // this module), or the original submitter — mirrors the COI equivalent.
    if (
      report.submitted_by !== userId &&
      !(await this.permissionResolver.canApproveModule(
        user,
        this.UO_LEVEL_KEYS,
      ))
    ) {
      throw new ForbiddenException(
        'Only the original submitter or an Approver/Manager can withdraw this report',
      );
    }

    const updated = await this.qrRepo.markWithdrawn(id);

    this.logger.log(`QUARTERLY_REPORT_WITHDRAWN: id=${id}, by=${userId}`);
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase GOV: Post-Publication Governance — Unlock & Update Request Workflow
  // ═══════════════════════════════════════════════════════════════

  /**
   * Phase GOV-D: Insert an append-only submission history record.
   * Called before any destructive UPDATE to preserve review metadata.
   */
  private async snapshotSubmissionHistory(
    report: any,
    eventType: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REVERTED' | 'UNLOCKED',
    actorId: string,
    reason?: string,
  ): Promise<void> {
    try {
      await this.qrsRepo.recordEvent({
        quarterlyReportId: report.id,
        fiscalYear: report.fiscal_year,
        quarter: report.quarter,
        version: report.submission_count ?? 0,
        eventType,
        submittedBy: report.submitted_by ?? undefined,
        submittedAt: report.submitted_at ?? undefined,
        reviewedBy: report.reviewed_by ?? undefined,
        reviewedAt: report.reviewed_at ?? undefined,
        reviewNotes: report.review_notes ?? undefined,
        actionedBy: actorId,
        reason: reason ?? undefined,
      });
    } catch (err) {
      // Non-blocking: history insert failure must not break the primary operation
      this.logger.warn(
        `SNAPSHOT_FAILED: event=${eventType}, reportId=${report.id}, error=${(err as Error).message}`,
      );
    }
  }

  /**
   * Phase GOV-C: Auto-revert quarterly report to DRAFT when indicator data is modified.
   * Ensures any modified report must be re-submitted for review.
   */
  private async autoRevertQuarterlyReport(
    fiscalYear: number | undefined,
    quarter: string | undefined,
    userId: string,
  ): Promise<void> {
    if (!fiscalYear || !quarter) {
      this.logger.warn(
        `[autoRevertQuarterlyReport] Called without quarter param — skipping revert (operationId context only)`,
      );
      return;
    }

    const qr = await this.qrRepo.findForPeriod(fiscalYear, quarter);

    if (!qr) return;
    if (qr.publication_status === 'DRAFT') return;

    // Phase GOV-D: Snapshot review metadata before destroying it
    await this.snapshotSubmissionHistory(
      qr,
      'REVERTED',
      userId,
      'indicator_update',
    );

    await this.qrRepo.revertToDraft(qr.id);

    this.logger.log(
      `QUARTERLY_REPORT_AUTO_REVERTED: report_id=${qr.id}, was=${qr.publication_status}, by=${userId}, trigger=indicator_update`,
    );
  }

  /**
   * Phase GOV-A: Unlock a published quarterly report (Admin/SuperAdmin only).
   * Reverts PUBLISHED → DRAFT, clears review/submit metadata, records unlock audit.
   */
  async unlockQuarterlyReport(
    id: string,
    adminId: string,
    reason: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase BBCH (Track 1): Admin OR an Approver/Manager 'university_operations' module-level grant.
    if (
      !(await this.permissionResolver.canApproveModule(
        user,
        this.UO_LEVEL_KEYS,
      ))
    ) {
      throw new ForbiddenException(
        'Insufficient module level to unlock quarterly reports',
      );
    }

    const report = await this.findOneQuarterlyReport(id);

    if (report.publication_status !== 'PUBLISHED') {
      throw new BadRequestException(
        `Only PUBLISHED reports can be unlocked. Current status: ${report.publication_status}`,
      );
    }

    // Phase GOV-D: Snapshot review metadata before destroying it
    await this.snapshotSubmissionHistory(report, 'UNLOCKED', adminId, reason);

    const updated = await this.qrRepo.markUnlocked(id, adminId);

    this.logger.log(
      `QUARTERLY_REPORT_UNLOCKED: id=${id}, by=${adminId}, reason="${reason || 'no reason'}"`,
    );
    return updated;
  }

  /**
   * Phase GOV-D: Request unlock of a published quarterly report (Staff/Admin).
   * Sets unlock_requested_by fields for admin review.
   */
  async requestQuarterlyReportUnlock(
    id: string,
    userId: string,
    reason: string,
  ): Promise<any> {
    const report = await this.findOneQuarterlyReport(id);

    if (report.publication_status !== 'PUBLISHED') {
      throw new BadRequestException(
        `Only PUBLISHED reports can have unlock requests. Current status: ${report.publication_status}`,
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException(
        'A reason is required for the unlock request',
      );
    }

    if (report.unlock_requested_by) {
      throw new BadRequestException(
        'An unlock request is already pending for this report',
      );
    }

    const updated = await this.qrRepo.requestUnlock(id, userId, reason.trim());

    this.logger.log(
      `QUARTERLY_REPORT_UNLOCK_REQUESTED: id=${id}, by=${userId}, reason="${reason.trim()}"`,
    );
    return updated;
  }

  /**
   * Phase GOV-E: Deny unlock request (Admin only).
   * Clears unlock request fields.
   */
  async denyQuarterlyReportUnlock(
    id: string,
    adminId: string,
    user: JwtPayload,
  ): Promise<any> {
    // Phase BBCH (Track 1): Admin OR an Approver/Manager 'university_operations' module-level grant.
    if (
      !(await this.permissionResolver.canApproveModule(
        user,
        this.UO_LEVEL_KEYS,
      ))
    ) {
      throw new ForbiddenException(
        'Insufficient module level to deny unlock requests',
      );
    }

    const report = await this.findOneQuarterlyReport(id);

    if (!report.unlock_requested_by) {
      throw new BadRequestException(
        'No pending unlock request for this report',
      );
    }

    const updated = await this.qrRepo.clearUnlockRequest(id);

    this.logger.log(`QUARTERLY_REPORT_UNLOCK_DENIED: id=${id}, by=${adminId}`);
    return updated;
  }

  /**
   * Phase GOV-F: Find quarterly reports with pending unlock requests (Admin review queue).
   */
  async findQuarterlyReportsPendingUnlock(user: JwtPayload): Promise<any[]> {
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException(
        'Only Admin can view pending unlock requests',
      );
    }

    if (!user.is_superadmin) {
      const hasAccess = await this.moduleAssignmentRepo.hasModuleAccess(
        user.sub,
        ModuleType.OPERATIONS,
      );
      if (!hasAccess) {
        return [];
      }
    }

    return this.qrRepo.findPendingUnlock();
  }

  /**
   * Phase GOV-C: Find reviewed quarterly reports (PUBLISHED/REJECTED) for admin archive view.
   */
  async findQuarterlyReportsReviewed(user: JwtPayload): Promise<any[]> {
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view review history');
    }

    if (!user.is_superadmin) {
      const hasAccess = await this.moduleAssignmentRepo.hasModuleAccess(
        user.sub,
        ModuleType.OPERATIONS,
      );
      if (!hasAccess) {
        return [];
      }
    }

    return this.qrRepo.findReviewed();
  }

  /**
   * Phase GOV-D: Find submission history events for quarterly reports.
   * Returns the append-only event log for admin archive/audit view.
   */
  async findSubmissionHistory(
    user: JwtPayload,
    fiscalYear?: number,
    quarter?: string,
  ): Promise<any[]> {
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view submission history');
    }

    if (!user.is_superadmin) {
      const hasAccess = await this.moduleAssignmentRepo.hasModuleAccess(
        user.sub,
        ModuleType.OPERATIONS,
      );
      if (!hasAccess) {
        return [];
      }
    }

    return this.qrsRepo.findHistory(fiscalYear, quarter);
  }

  /**
   * Phase IT: Per-report submission history for a specific quarterly report.
   * Returns all append-only events from quarterly_report_submissions for the given QR ID.
   */
  async findQuarterlyReportHistory(
    id: string,
    user: JwtPayload,
  ): Promise<any[]> {
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException(
        'Only Admin can view quarterly report history',
      );
    }

    return this.qrsRepo.findHistoryForReport(id);
  }

  // ─── Phase EZ-C: Financial Analytics ──────────────────────────────────────────

  /**
   * Phase EZ-C: Financial pillar summary — per-pillar aggregation of financial metrics
   */
  async getFinancialPillarSummary(fiscalYear: number): Promise<any> {
    const result = await this.financialRepo.getPillarSummary(fiscalYear);

    return { pillars: result, fiscal_year: fiscalYear };
  }

  /**
   * Phase EZ-C: Financial quarterly trend — per-quarter aggregation
   */
  async getFinancialQuarterlyTrend(
    fiscalYear: number,
    pillarType?: string,
  ): Promise<any> {
    const result = await this.financialRepo.getQuarterlyTrend(
      fiscalYear,
      pillarType,
    );
    return { quarters: result, fiscal_year: fiscalYear };
  }

  /**
   * Phase EZ-C: Financial yearly comparison — utilization rate by pillar across years
   */
  async getFinancialYearlyComparison(years: number[]): Promise<any> {
    if (!years.length) return { years: [], pillars: [] };

    const result = await this.financialRepo.getYearlyComparison(years);

    // Phase GT-1 + GU-1: Return only fiscal years present in data — prevents empty-year bars (Directive 320, 326)
    const rawYears: number[] = result
      .map((r: any) => Number(r.fiscal_year))
      .filter((n: number) => Number.isFinite(n));
    const dataYears: number[] = [...new Set(rawYears)].sort(
      (a: number, b: number) => a - b,
    );
    return { years: dataYears, data: result };
  }

  /**
   * Phase EZ-C: Financial expense class breakdown — PS/MOOE/CO distribution
   */
  async getFinancialExpenseBreakdown(fiscalYear: number): Promise<any> {
    const result = await this.financialRepo.getExpenseBreakdown(fiscalYear);

    // Calculate percentage of total
    const totalObligation = result.reduce(
      (sum: number, r: any) => sum + Number(r.total_obligations),
      0,
    );
    const rows = result.map((r: any) => ({
      ...r,
      pct_of_total:
        totalObligation > 0
          ? Number(
              ((Number(r.total_obligations) / totalObligation) * 100).toFixed(
                2,
              ),
            )
          : 0,
    }));

    return { breakdown: rows, fiscal_year: fiscalYear };
  }
}
