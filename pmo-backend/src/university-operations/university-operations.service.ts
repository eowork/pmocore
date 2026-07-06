import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { createPaginatedResponse, PaginatedResponse } from '../common/dto';
import {
  UniversityOperation,
  OperationIndicator,
  OperationFinancial,
  QuarterlyReport,
  QuarterlyReportSubmission,
  FiscalYear,
  PillarIndicatorTaxonomy,
  OperationOrganizationalInfo,
  RecordAssignment,
} from '../database/entities';
import {
  CreateOperationDto,
  UpdateOperationDto,
  QueryOperationDto,
  CreateIndicatorDto,
  CreateIndicatorQuarterlyDto,
  CreateFinancialDto,
  FundType,
} from './dto';
import { JwtPayload } from '../common/interfaces';
import { PermissionResolverService } from '../common/services';

// Publication status values matching database enum
export type PublicationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED';

/**
 * DATA ACCESS ARCHITECTURE (HYBRID MODEL — Phase IQ):
 *
 * Tier 1 — ORM methods (em.find, em.persist, em.flush):
 *   Used for simple CRUD: assignments, fiscal years, org info.
 *
 * Tier 2 — Raw SQL via em.getConnection().execute(sql, [?...], 'all'):
 *   Used for complex analytics CTEs, multi-join reporting queries.
 *   All raw queries use '?' (Knex positional) placeholders.
 *   88 execute() calls are intentional and accepted (Phase IQ — indefinitely deferred from ORM replacement).
 *
 * DO NOT convert Tier-2 raw SQL to ORM unless a functional defect demands it.
 *
 * Legacy DatabaseService consumers (post-Phase IU):
 *   health.service.ts  — permanent (DB ping/metrics, not ORM-appropriate)
 *   ldap.strategy.ts   — reserved for Phase IR transport migration (tied to LDAP activation)
 *   google.strategy.ts — ✅ migrated to em.getConnection().execute (Phase IU)
 */
@Injectable()
export class UniversityOperationsService {
  private readonly logger = new Logger(UniversityOperationsService.name);

  // Allowlisted columns for filtering/sorting
  private readonly ALLOWED_SORTS = [
    'created_at',
    'title',
    'status',
    'start_date',
    'end_date',
  ];

  constructor(
    @InjectRepository(UniversityOperation)
    private readonly uoRepo: EntityRepository<UniversityOperation>,
    @InjectRepository(OperationIndicator)
    private readonly indicatorRepo: EntityRepository<OperationIndicator>,
    @InjectRepository(OperationFinancial)
    private readonly financialRepo: EntityRepository<OperationFinancial>,
    @InjectRepository(QuarterlyReport)
    private readonly qrRepo: EntityRepository<QuarterlyReport>,
    @InjectRepository(QuarterlyReportSubmission)
    private readonly qrsRepo: EntityRepository<QuarterlyReportSubmission>,
    @InjectRepository(FiscalYear)
    private readonly fyRepo: EntityRepository<FiscalYear>,
    @InjectRepository(PillarIndicatorTaxonomy)
    private readonly taxonomyRepo: EntityRepository<PillarIndicatorTaxonomy>,
    @InjectRepository(OperationOrganizationalInfo)
    private readonly orgInfoRepo: EntityRepository<OperationOrganizationalInfo>,
    private readonly em: EntityManager,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  /**
   * Delegate to centralized permission resolver
   * @deprecated Use this.permissionResolver.isAdmin() directly
   */
  private isAdmin(user: JwtPayload): boolean {
    return this.permissionResolver.isAdmin(user);
  }

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
   * Phase AT: Update record assignments in junction table
   * Replaces all existing assignments for a record with new user IDs
   */
  private async updateRecordAssignments(
    recordId: string,
    userIds: string[],
  ): Promise<void> {
    await this.em.nativeDelete(RecordAssignment, {
      module: 'OPERATIONS',
      recordId,
    });
    if (userIds.length > 0) {
      const assignments = userIds.map((userId) =>
        this.em.create(RecordAssignment, { module: 'OPERATIONS', recordId, userId }),
      );
      await this.em.persistAndFlush(assignments);
    }
  }

  // ─── Phase IJ: Assignment CRUD ──────────────────────────────────────────────

  async getOperationAssignments(operationId: string): Promise<RecordAssignment[]> {
    return this.em.find(RecordAssignment, {
      module: 'OPERATIONS',
      recordId: operationId,
    });
  }

  async addOperationAssignment(
    operationId: string,
    userId: string,
    assignedBy: string,
  ): Promise<RecordAssignment> {
    await this.findOne(operationId);
    const existing = await this.em.findOne(RecordAssignment, {
      module: 'OPERATIONS',
      recordId: operationId,
      userId,
    });
    if (existing) return existing;
    const assignment = this.em.create(RecordAssignment, {
      module: 'OPERATIONS',
      recordId: operationId,
      userId,
      assignedBy,
      assignedAt: new Date(),
    });
    await this.em.persistAndFlush(assignment);
    return assignment;
  }

  async removeOperationAssignment(
    operationId: string,
    userId: string,
  ): Promise<void> {
    const deleted = await this.em.nativeDelete(RecordAssignment, {
      module: 'OPERATIONS',
      recordId: operationId,
      userId,
    });
    if (deleted === 0) throw new NotFoundException('Assignment not found');
  }

  /**
   * Phase AT: Check if user is assigned to record via junction table
   */
  private async isUserAssigned(
    recordId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.em.getConnection().execute(
      `SELECT 1 FROM record_assignments WHERE module = 'OPERATIONS' AND record_id = ? AND user_id = ?`,
      [recordId, userId],
    );
    return result.length > 0;
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
    if (this.isAdmin(user)) {
      return;
    }

    // Resolve UO module level from the permission-override system (authoritative source).
    const overrideRows = await this.em.getConnection().execute(
      `SELECT granted_level FROM user_permission_overrides
       WHERE user_id = ? AND module_key = 'university_operations' AND can_access = true`,
      [userId],
    );
    const grantedLevel: string | null = overrideRows[0]?.granted_level ?? null;

    // Approver and Manager have module-wide write authority — no record-ownership check needed.
    if (grantedLevel === 'Approver' || grantedLevel === 'Manager') {
      return;
    }

    // Viewer without a level grant cannot write (already blocked by ModuleAccessGuard, but
    // belt-and-suspenders: deny here too so the service is self-contained).
    if (!grantedLevel || grantedLevel === 'Viewer') {
      throw new ForbiddenException('Insufficient module level to modify this operation.');
    }

    // Contributor: must be the record creator or an assigned user.
    const result = await this.em.getConnection().execute(
      `SELECT created_by FROM university_operations WHERE id = ? AND deleted_at IS NULL`,
      [operationId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Operation not found');
    }

    const isOwner = result[0].created_by === userId;
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
    if (!this.isAdmin(user)) {
      const moduleCheck = await this.em.getConnection().execute(
        `SELECT 1 FROM user_module_assignments WHERE user_id = ? AND (module = 'OPERATIONS' OR module = 'ALL')`,
        [user.sub],
      );
      if (moduleCheck.length === 0) {
        return null;
      }
    }

    const result = await this.em.getConnection().execute(
      `SELECT * FROM university_operations
       WHERE operation_type = ?
         AND fiscal_year = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [pillarType, fiscalYear],
    );
    return result[0] || null;
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
    if (this.isAdmin(user)) {
      return;
    }

    const overrideRows = await this.em.getConnection().execute(
      `SELECT granted_level FROM user_permission_overrides
       WHERE user_id = ? AND module_key = 'university_operations' AND can_access = true`,
      [userId],
    );
    const grantedLevel: string | null = overrideRows[0]?.granted_level ?? null;

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
    const result = await this.em.getConnection().execute(
      `SELECT uo.fiscal_year, qr.publication_status AS quarterly_status,
              qr.unlocked_by
       FROM university_operations uo
       LEFT JOIN quarterly_reports qr
         ON qr.fiscal_year = uo.fiscal_year AND qr.quarter = ?
            AND qr.deleted_at IS NULL
       WHERE uo.id = ? AND uo.deleted_at IS NULL`,
      [quarter, operationId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Operation not found');
    }

    const row = result[0];

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
    let result;

    if (quarter) {
      // Phase ER-B: JOIN quarterly_reports to enforce edit lock on published quarters
      // Phase GOV-C: Also fetch unlocked_by for strict admin unlock enforcement
      result = await this.em.getConnection().execute(
        `SELECT uo.publication_status, qr.publication_status AS quarterly_status,
                qr.unlocked_by
         FROM university_operations uo
         LEFT JOIN quarterly_reports qr
           ON qr.fiscal_year = uo.fiscal_year AND qr.quarter = ?
              AND qr.deleted_at IS NULL
         WHERE uo.id = ? AND uo.deleted_at IS NULL`,
        [quarter, operationId],
      );
    } else {
      result = await this.em.getConnection().execute(
        `SELECT uo.publication_status
         FROM university_operations uo
         WHERE uo.id = ? AND uo.deleted_at IS NULL`,
        [operationId],
      );
    }

    if (result.length === 0) {
      throw new NotFoundException('Operation not found');
    }

    const row = result[0];
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
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = query;
    const offset = (page - 1) * limit;

    // Validate sort column
    const sortColumn = this.ALLOWED_SORTS.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build WHERE clause (qualified with 'uo.' to avoid JOIN ambiguity)
    const conditions: string[] = ['uo.deleted_at IS NULL'];
    const params: any[] = [];

    // Phase X: Visibility filter by role
    // Admin: sees all records. Non-admin: PUBLISHED + own records in any status.
    const queryAny = query as any;
    if (queryAny.publication_status) {
      if (
        queryAny.publication_status !== 'PUBLISHED' &&
        user &&
        !this.isAdmin(user)
      ) {
        conditions.push(
          `(uo.publication_status = ? AND uo.created_by = ?)`,
        );
        params.push(queryAny.publication_status, user.sub);
      } else {
        conditions.push(`uo.publication_status = ?`);
        params.push(queryAny.publication_status);
      }
    } else if (user && !this.isAdmin(user)) {
      // Phase Y + AM + AT: Campus-scoped visibility with junction table for assignments
      const recordCampus = this.normalizeUserCampusToRecordCampus(user.campus);
      if (recordCampus) {
        // Phase IH: user.sub pushed twice — binds both created_by and ra.user_id positions
        conditions.push(
          `(uo.campus = ? OR uo.created_by = ? OR EXISTS (SELECT 1 FROM record_assignments ra WHERE ra.module = 'OPERATIONS' AND ra.record_id = uo.id AND ra.user_id = ?))`,
        );
        params.push(recordCampus, user.sub, user.sub);
      } else {
        // Phase IH: user.sub pushed twice — binds both created_by and ra.user_id positions
        conditions.push(
          `(uo.publication_status = 'PUBLISHED' OR uo.created_by = ? OR EXISTS (SELECT 1 FROM record_assignments ra WHERE ra.module = 'OPERATIONS' AND ra.record_id = uo.id AND ra.user_id = ?))`,
        );
        params.push(user.sub, user.sub);
      }
    }

    if (query.operation_type) {
      conditions.push(`uo.operation_type = ?`);
      params.push(query.operation_type);
    }
    if (query.status) {
      conditions.push(`uo.status = ?`);
      params.push(query.status);
    }
    if (query.campus) {
      conditions.push(`uo.campus = ?`);
      params.push(query.campus);
    }
    if (query.coordinator_id) {
      conditions.push(`uo.coordinator_id = ?`);
      params.push(query.coordinator_id);
    }
    // Phase BD: fiscal_year filter on main table
    if (query.fiscal_year) {
      conditions.push(`uo.fiscal_year = ?`);
      params.push(query.fiscal_year);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count (uses alias for consistency with data query)
    const countResult = await this.em.getConnection().execute(
      `SELECT COUNT(*) FROM university_operations uo LEFT JOIN users submitter ON uo.submitted_by = submitter.id WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult[0].count, 10);

    // Get paginated data
    const dataResult = await this.em.getConnection().execute(
      `SELECT uo.id, uo.operation_type, uo.title, uo.description, uo.code, uo.start_date, uo.end_date,
              uo.status, uo.budget, uo.campus, uo.coordinator_id, uo.publication_status, uo.created_at, uo.updated_at,
              uo.submitted_by, uo.submitted_at, uo.created_by,
              uo.status_q1, uo.status_q2, uo.status_q3, uo.status_q4,
              uo.fiscal_year,
              submitter.first_name || ' ' || submitter.last_name as submitted_by_name,
              (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)), '[]'::json)
               FROM record_assignments ra JOIN users u ON ra.user_id = u.id
               WHERE ra.module = 'OPERATIONS' AND ra.record_id = uo.id) as assigned_users
       FROM university_operations uo
       LEFT JOIN users submitter ON uo.submitted_by = submitter.id
       WHERE ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return createPaginatedResponse(dataResult, total, page, limit);
  }

  async findOne(id: string): Promise<any> {
    const result = await this.em.getConnection().execute(
      `SELECT uo.*,
              creator.first_name || ' ' || creator.last_name as created_by_name,
              submitter.first_name || ' ' || submitter.last_name as submitted_by_name,
              reviewer.first_name || ' ' || reviewer.last_name as reviewed_by_name,
              (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)), '[]'::json)
               FROM record_assignments ra JOIN users u ON ra.user_id = u.id
               WHERE ra.module = 'OPERATIONS' AND ra.record_id = uo.id) as assigned_users
       FROM university_operations uo
       LEFT JOIN users creator ON uo.created_by = creator.id
       LEFT JOIN users submitter ON uo.submitted_by = submitter.id
       LEFT JOIN users reviewer ON uo.reviewed_by = reviewer.id
       WHERE uo.id = ? AND uo.deleted_at IS NULL`,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Operation with ID ${id} not found`);
    }

    const operation = result[0];

    // Get organizational info
    const orgInfo = await this.em.getConnection().execute(
      `SELECT * FROM operation_organizational_info WHERE operation_id = ? AND deleted_at IS NULL`,
      [id],
    );

    // Get indicators
    const indicators = await this.em.getConnection().execute(
      `SELECT * FROM operation_indicators WHERE operation_id = ? AND deleted_at IS NULL ORDER BY fiscal_year DESC`,
      [id],
    );

    // Get financials
    const financials = await this.em.getConnection().execute(
      `SELECT * FROM operation_financials WHERE operation_id = ? AND deleted_at IS NULL ORDER BY fiscal_year DESC, quarter`,
      [id],
    );

    return {
      ...operation,
      organizational_info: orgInfo[0] || null,
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
    if (dto.code) {
      const existing = await this.em.getConnection().execute(
        `SELECT id FROM university_operations WHERE code = ? AND deleted_at IS NULL`,
        [dto.code],
      );
      if (existing.length > 0) {
        throw new ConflictException(
          `Operation code ${dto.code} already exists`,
        );
      }
    }

    // Universal Draft Governance: ALL users create DRAFT
    // Publishing requires explicit approval action via POST /:id/publish endpoint
    const publicationStatus: PublicationStatus = 'DRAFT';
    const submittedBy = userId; // Always track submitter for audit trail
    const submittedAt = new Date(); // Always track submission time

    // Phase AN: Include assigned_to for inline assignment during creation
    // Phase BD: Include fiscal_year for year-based filtering
    const result = await this.em.getConnection().execute(
      `INSERT INTO university_operations
       (operation_type, title, description, code, start_date, end_date, status, budget, campus, coordinator_id, metadata, created_by,
        publication_status, submitted_by, submitted_at, assigned_to, fiscal_year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        dto.operation_type,
        dto.title,
        dto.description,
        dto.code,
        dto.start_date,
        dto.end_date,
        dto.status,
        dto.budget,
        dto.campus,
        dto.coordinator_id,
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        userId,
        publicationStatus,
        submittedBy,
        submittedAt,
        dto.assigned_to || null,
        dto.fiscal_year || null,
      ],
    );

    // Phase AT: Handle multi-select assignments via junction table
    const recordId = result[0].id;
    if (dto.assigned_user_ids && dto.assigned_user_ids.length > 0) {
      await this.updateRecordAssignments(recordId, dto.assigned_user_ids);
    } else if (dto.assigned_to) {
      // Backward compatibility: single assigned_to also creates junction entry
      await this.updateRecordAssignments(recordId, [dto.assigned_to]);
    }

    this.logger.log(
      `OPERATION_CREATED: id=${recordId}, status=${publicationStatus}, by=${userId}`,
    );
    return result[0];
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
    if (dtoAny.code) {
      const existing = await this.em.getConnection().execute(
        `SELECT id FROM university_operations WHERE code = ? AND id != ? AND deleted_at IS NULL`,
        [dtoAny.code, id],
      );
      if (existing.length > 0) {
        throw new ConflictException(
          `Operation code ${dtoAny.code} already exists`,
        );
      }
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

    // Build dynamic SET clause
    const fields = Object.keys(dto).filter(
      (k) => dto[k] !== undefined && k !== 'assigned_user_ids',
    );
    if (fields.length === 0) {
      return this.findOne(id);
    }

    let setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values: any[] = fields.map((f) =>
      f === 'metadata' ? JSON.stringify(dto[f]) : dto[f],
    );

    // Apply status reset fields based on prior status
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

    await this.em.getConnection().execute(
      `UPDATE university_operations
       SET ${setClause}, updated_by = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [...values, userId, id],
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

    await this.em.getConnection().execute(
      `UPDATE university_operations SET deleted_at = NOW(), deleted_by = ? WHERE id = ?`,
      [userId, id],
    );

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

    const result = await this.em.getConnection().execute(
      `UPDATE university_operations
       SET publication_status = 'PENDING_REVIEW',
           submitted_by = ?,
           submitted_at = NOW(),
           review_notes = NULL,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [userId, id],
    );

    this.logger.log(`OPERATION_SUBMITTED_FOR_REVIEW: id=${id}, by=${userId}`);
    return result[0];
  }

  async publish(id: string, adminId: string, user: JwtPayload): Promise<any> {
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can publish records');
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

    const result = await this.em.getConnection().execute(
      `UPDATE university_operations
       SET publication_status = 'PUBLISHED',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_notes = NULL,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [adminId, id],
    );

    this.logger.log(`OPERATION_PUBLISHED: id=${id}, by=${adminId}`);
    return result[0];
  }

  async reject(
    id: string,
    adminId: string,
    notes: string,
    user: JwtPayload,
  ): Promise<any> {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can reject records');
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

    const result = await this.em.getConnection().execute(
      `UPDATE university_operations
       SET publication_status = 'REJECTED',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_notes = ?,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [adminId, notes.trim(), id],
    );

    this.logger.log(`OPERATION_REJECTED: id=${id}, by=${adminId}`);
    return result[0];
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

    const result = await this.em.getConnection().execute(
      `UPDATE university_operations
       SET publication_status = 'DRAFT',
           submitted_by = NULL,
           submitted_at = NULL,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [id],
    );

    this.logger.log(`OPERATION_WITHDRAWN: id=${id}, by=${userId}`);
    return result[0];
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

    const result = await this.em.getConnection().execute(
      `UPDATE university_operations
       SET ${statusCol} = 'PENDING_REVIEW', updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [id],
    );

    this.logger.log(
      `QUARTER_SUBMITTED: id=${id}, quarter=${quarter}, by=${userId}`,
    );
    return result[0];
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
    if (!this.isAdmin(user))
      throw new ForbiddenException('Only Admin can approve quarters');
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

    const result = await this.em.getConnection().execute(
      `UPDATE university_operations
       SET ${statusCol} = 'PUBLISHED', updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [id],
    );

    this.logger.log(
      `QUARTER_APPROVED: id=${id}, quarter=${quarter}, by=${adminId}`,
    );
    return result[0];
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
    if (!this.isAdmin(user))
      throw new ForbiddenException('Only Admin can reject quarters');

    const operation = await this.findOne(id);
    const statusCol = `status_${quarter.toLowerCase()}`;
    const currentStatus = operation[statusCol] || 'DRAFT';
    if (currentStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `${quarter} can only be rejected from PENDING_REVIEW status. Current: ${currentStatus}`,
      );
    }

    const result = await this.em.getConnection().execute(
      `UPDATE university_operations
       SET ${statusCol} = 'REJECTED', review_notes = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [id, notes || ''],
    );

    this.logger.log(
      `QUARTER_REJECTED: id=${id}, quarter=${quarter}, by=${adminId}`,
    );
    return result[0];
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

    const result = await this.em.getConnection().execute(
      `UPDATE university_operations
       SET ${statusCol} = 'DRAFT', updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [id],
    );

    this.logger.log(
      `QUARTER_WITHDRAWN: id=${id}, quarter=${quarter}, by=${userId}`,
    );
    return result[0];
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
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view pending reviews');
    }

    // Check module access (SuperAdmin or user with OPERATIONS/ALL assignment)
    if (!user.is_superadmin) {
      const accessCheck = await this.em.getConnection().execute(
        `SELECT 1 FROM user_module_assignments
         WHERE user_id = ?
           AND (module = 'OPERATIONS' OR module = 'ALL')`,
        [user.sub],
      );

      if (accessCheck.length === 0) {
        return []; // No access to this module
      }
    }

    const result = await this.em.getConnection().execute(
      `SELECT uo.id, uo.code, uo.title, uo.campus, uo.publication_status,
              uo.submitted_by, uo.submitted_at, uo.created_at,
              u.first_name || ' ' || u.last_name as submitter_name
       FROM university_operations uo
       LEFT JOIN users u ON uo.submitted_by = u.id
       WHERE uo.publication_status = 'PENDING_REVIEW'
         AND uo.deleted_at IS NULL
       ORDER BY uo.submitted_at ASC`,
    );

    return result;
  }

  async findMyDrafts(userId: string): Promise<any[]> {
    const result = await this.em.getConnection().execute(
      `SELECT id, code, title, campus, publication_status,
              submitted_at, review_notes, created_at
       FROM university_operations
       WHERE created_by = ?
         AND publication_status IN ('DRAFT', 'PENDING_REVIEW', 'REJECTED')
         AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [userId],
    );

    return result;
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
      { orderBy: { indicatorOrder: 'ASC' } },
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
      { orderBy: { indicatorType: 'ASC', indicatorOrder: 'ASC' } },
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
   * Phase DK-B: Uses LEFT JOIN to include orphaned indicators (pillar_indicator_id = NULL)
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

    const validPillarTypes = [
      'HIGHER_EDUCATION',
      'ADVANCED_EDUCATION',
      'RESEARCH',
      'TECHNICAL_ADVISORY',
    ];
    if (!validPillarTypes.includes(pillarType)) {
      this.logger.debug(
        `[findIndicatorsByPillarAndYear] Invalid pillar_type: ${pillarType}`,
      );
      return [];
    }

    // Phase DY-C: Filter by reported_quarter when provided
    // Phase IG: pillarType bound twice (uo.operation_type + pit.pillar_type) — duplicated for Knex positional binding
    const params: any[] = [pillarType, pillarType, fiscalYear];
    let quarterFilter = '';
    if (quarter && ['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
      quarterFilter = ` AND (oi.reported_quarter = ? OR oi.reported_quarter IS NULL)`;
      params.push(quarter);
    }

    // Phase DK-B: Use LEFT JOIN to include orphaned indicators
    const result = await this.em.getConnection().execute(
      `SELECT
        oi.*,
        pit.indicator_name,
        pit.indicator_code,
        pit.uacs_code,
        pit.unit_type,
        pit.indicator_type,
        pit.description
       FROM operation_indicators oi
       LEFT JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
       JOIN university_operations uo ON oi.operation_id = uo.id
       WHERE uo.operation_type = ?
         AND (pit.pillar_type = ? OR pit.pillar_type IS NULL)
         AND oi.fiscal_year = ?
         AND oi.deleted_at IS NULL
         AND uo.deleted_at IS NULL${quarterFilter}
       ORDER BY COALESCE(pit.indicator_order, 999) ASC, oi.particular ASC`,
      params,
    );

    // Phase DK-B: Log orphan count for admin awareness
    const orphanCount = result.filter(
      (r) => !r.pillar_indicator_id,
    ).length;
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

    let query = `
      SELECT
        oi.*,
        pit.indicator_name as taxonomy_name,
        pit.indicator_code as taxonomy_code,
        pit.uacs_code as taxonomy_uacs,
        pit.unit_type,
        pit.description as taxonomy_description
      FROM operation_indicators oi
      LEFT JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
      WHERE oi.operation_id = ? AND oi.deleted_at IS NULL
    `;
    const params: any[] = [operationId];

    if (fiscalYear) {
      query += ` AND oi.fiscal_year = ?`;
      params.push(fiscalYear);
    }

    query += ` ORDER BY COALESCE(pit.indicator_order, 999) ASC, oi.fiscal_year DESC, oi.created_at DESC`;

    const result = await this.em.getConnection().execute(query, params);
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
      variance: formatDecimal(overrideVarianceAnnual ?? variance, 4),
      override_variance: formatDecimal(overrideVarianceAnnual, 2),
      computed_variance: formatDecimal(variance, 4),
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
    const taxonomyCheck = await this.em.getConnection().execute(
      `SELECT id, pillar_type, indicator_name
       FROM pillar_indicator_taxonomy
       WHERE id = ? AND is_active = true`,
      [dto.pillar_indicator_id],
    );

    if (taxonomyCheck.length === 0) {
      throw new BadRequestException(
        'Invalid pillar_indicator_id: Indicator not found in taxonomy',
      );
    }

    const taxonomy = taxonomyCheck[0];
    if (taxonomy.pillar_type !== operation.operation_type) {
      throw new BadRequestException(
        `Indicator taxonomy mismatch: Indicator belongs to ${taxonomy.pillar_type}, but operation is ${operation.operation_type}`,
      );
    }

    // Check if quarterly data already exists for this indicator + fiscal year + quarter
    // Phase DY-C: Include reported_quarter in duplicate check when provided
    const existingCheckParams: any[] = [
      dto.pillar_indicator_id,
      operationId,
      dto.fiscal_year,
    ];
    let existingCheckQuery = `SELECT id FROM operation_indicators
       WHERE pillar_indicator_id = ? AND operation_id = ? AND fiscal_year = ? AND deleted_at IS NULL`;
    if (dto.reported_quarter) {
      existingCheckQuery += ` AND reported_quarter = ?`;
      existingCheckParams.push(dto.reported_quarter);
    } else {
      existingCheckQuery += ` AND reported_quarter IS NULL`;
    }
    const existingCheck = await this.em.getConnection().execute(
      existingCheckQuery,
      existingCheckParams,
    );

    if (existingCheck.length > 0) {
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
    const result = await this.em.getConnection().execute(
      `INSERT INTO operation_indicators
       (operation_id, pillar_indicator_id, particular, fiscal_year, reported_quarter,
        target_q1, target_q2, target_q3, target_q4,
        accomplishment_q1, accomplishment_q2, accomplishment_q3, accomplishment_q4,
        score_q1, score_q2, score_q3, score_q4,
        remarks, override_rate, override_variance,
        override_total_target, override_total_actual,
        catch_up_plan, facilitating_factors, ways_forward, mov,
        numerator_q1, denominator_q1, numerator_q2, denominator_q2,
        numerator_q3, denominator_q3, numerator_q4, denominator_q4,
        target_numerator_q1, target_denominator_q1, target_numerator_q2, target_denominator_q2,
        target_numerator_q3, target_denominator_q3, target_numerator_q4, target_denominator_q4,
        remarks_q1, remarks_q2, remarks_q3, remarks_q4,
        override_total_target_fraction, override_total_actual_fraction,
        created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        operationId,
        dto.pillar_indicator_id,
        taxonomy.indicator_name,
        dto.fiscal_year,
        dto.reported_quarter || null,
        dto.target_q1,
        dto.target_q2,
        dto.target_q3,
        dto.target_q4,
        dto.accomplishment_q1,
        dto.accomplishment_q2,
        dto.accomplishment_q3,
        dto.accomplishment_q4,
        dto.score_q1,
        dto.score_q2,
        dto.score_q3,
        dto.score_q4,
        dto.remarks,
        dto.override_rate ?? null,
        dto.override_variance ?? null,
        dto.override_total_target ?? null,
        dto.override_total_actual ?? null,
        dto.catch_up_plan ?? null,
        dto.facilitating_factors ?? null,
        dto.ways_forward ?? null,
        dto.mov ?? null,
        dto.numerator_q1 ?? null,
        dto.denominator_q1 ?? null,
        dto.numerator_q2 ?? null,
        dto.denominator_q2 ?? null,
        dto.numerator_q3 ?? null,
        dto.denominator_q3 ?? null,
        dto.numerator_q4 ?? null,
        dto.denominator_q4 ?? null,
        dto.target_numerator_q1 ?? null,
        dto.target_denominator_q1 ?? null,
        dto.target_numerator_q2 ?? null,
        dto.target_denominator_q2 ?? null,
        dto.target_numerator_q3 ?? null,
        dto.target_denominator_q3 ?? null,
        dto.target_numerator_q4 ?? null,
        dto.target_denominator_q4 ?? null,
        dto.remarks_q1 ?? null,
        dto.remarks_q2 ?? null,
        dto.remarks_q3 ?? null,
        dto.remarks_q4 ?? null,
        dto.override_total_target_fraction ?? null,
        dto.override_total_actual_fraction ?? null,
        userId,
      ],
    );

    this.logger.log(
      `INDICATOR_QUARTERLY_CREATED: id=${result[0].id}, taxonomy=${dto.pillar_indicator_id}, operation=${operationId}, by=${userId}`,
    );

    // Phase GOV-C: Auto-revert quarterly report to DRAFT when indicator data changes
    await this.autoRevertQuarterlyReport(
      dto.fiscal_year,
      dto.reported_quarter,
      userId,
    );

    return this.computeIndicatorMetrics(result[0]);
  }

  /**
   * Phase DJ-A: Update quarterly indicator data with full validation
   * Enforces fiscal_year scope, taxonomy validation, and pillar type match
   * Unlike the generic updateIndicator, this validates quarterly-specific constraints
   */
  async updateIndicatorQuarterlyData(
    operationId: string,
    indicatorId: string,
    dto: Partial<CreateIndicatorQuarterlyDto>,
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

    // Phase DK-A: Use LEFT JOIN to include orphaned indicators (pillar_indicator_id = NULL)
    const check = await this.em.getConnection().execute(
      `SELECT oi.id, oi.fiscal_year, oi.pillar_indicator_id, oi.operation_id, oi.particular,
              pit.pillar_type, pit.indicator_name, uo.operation_type
       FROM operation_indicators oi
       LEFT JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
       JOIN university_operations uo ON oi.operation_id = uo.id
       WHERE oi.id = ? AND oi.operation_id = ? AND oi.deleted_at IS NULL`,
      [indicatorId, operationId],
    );

    // Phase DL-A: Diagnostic logging for lookup result
    this.logger.log(
      `[PATCH /indicators/quarterly] LOOKUP RESULT: found=${check.length > 0}, rowCount=${check.length}`,
    );

    if (check.length > 0) {
      const found = check[0];
      this.logger.log(
        `[PATCH /indicators/quarterly] FOUND INDICATOR: id=${found.id}, operation_id=${found.operation_id}, fiscal_year=${found.fiscal_year}, pillar_indicator_id=${found.pillar_indicator_id || 'NULL (orphan)'}`,
      );
    } else {
      // Phase DL-A: Enhanced 404 diagnostic logging
      this.logger.error(
        `[PATCH /indicators/quarterly] 404 TRIGGERED: Indicator ${indicatorId} not found in operation ${operationId}`,
      );

      // Log all indicators for this operation
      const allIndicators = await this.em.getConnection().execute(
        `SELECT id, pillar_indicator_id, fiscal_year, operation_id, particular 
         FROM operation_indicators 
         WHERE operation_id = ? AND deleted_at IS NULL 
         LIMIT 10`,
        [operationId],
      );
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
      const otherOps = await this.em.getConnection().execute(
        `SELECT id, operation_id, fiscal_year, particular 
         FROM operation_indicators 
         WHERE id = ? AND deleted_at IS NULL`,
        [indicatorId],
      );
      if (otherOps.length > 0) {
        this.logger.error(
          `[PATCH /indicators/quarterly] MISMATCH CONFIRMED: Indicator ${indicatorId} belongs to operation ${otherOps[0].operation_id} (FY ${otherOps[0].fiscal_year}), but PATCH was sent to operation ${operationId}`,
        );
      } else {
        this.logger.error(
          `[PATCH /indicators/quarterly] Indicator ${indicatorId} does NOT exist in database (deleted or invalid UUID)`,
        );
      }
    }

    if (check.length === 0) {
      throw new NotFoundException(
        `Indicator ${indicatorId} not found in operation ${operationId}`,
      );
    }

    const indicator = check[0];

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
        const taxonomyCheck = await this.em.getConnection().execute(
          `SELECT pillar_type FROM pillar_indicator_taxonomy WHERE id = ? AND is_active = true`,
          [dto.pillar_indicator_id],
        );
        if (taxonomyCheck.length === 0) {
          throw new BadRequestException(
            'Invalid pillar_indicator_id: not found in taxonomy',
          );
        }
        if (taxonomyCheck[0].pillar_type !== indicator.pillar_type) {
          throw new BadRequestException(
            `Cannot change indicator to different pillar type (current: ${indicator.pillar_type}, new: ${taxonomyCheck[0].pillar_type})`,
          );
        }
      }
    }

    // Perform dynamic field update (same logic as generic updateIndicator, excluding pillar_indicator_id)
    // reported_quarter is also excluded: it is an immutable partitioning key set at CREATE time;
    // mutating it via PATCH on a NULL-quarter row triggers the uq_oi_quarterly_per_quarter constraint.
    const fields = Object.keys(dto).filter(
      (k) => dto[k] !== undefined && k !== 'pillar_indicator_id' && k !== 'reported_quarter',
    );
    if (fields.length === 0) {
      // No changes, return current state with metrics
      // Phase DK-A: Use LEFT JOIN for orphan compatibility
      const current = await this.em.getConnection().execute(
        `SELECT oi.*, pit.indicator_name, pit.indicator_code, pit.uacs_code, pit.unit_type
         FROM operation_indicators oi
         LEFT JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
         WHERE oi.id = ?`,
        [indicatorId],
      );
      return this.computeIndicatorMetrics(current[0]);
    }

    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => dto[f]);

    await this.em.getConnection().execute(
      `UPDATE operation_indicators
       SET ${setClause}, updated_by = ?, updated_at = NOW()
       WHERE id = ?
       RETURNING *`,
      [...values, userId, indicatorId],
    );

    this.logger.log(
      `INDICATOR_QUARTERLY_UPDATED: id=${indicatorId}, operation=${operationId}, fiscal_year=${indicator.fiscal_year}, orphan=${!indicator.pillar_indicator_id}, by=${userId}`,
    );

    // Phase GOV-C: Auto-revert quarterly report to DRAFT when indicator data changes
    await this.autoRevertQuarterlyReport(
      indicator.fiscal_year,
      dto.reported_quarter,
      userId,
    );

    // Phase DK-A: Use LEFT JOIN for orphan compatibility
    const enriched = await this.em.getConnection().execute(
      `SELECT oi.*, pit.indicator_name, pit.indicator_code, pit.uacs_code, pit.unit_type
       FROM operation_indicators oi
       LEFT JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
       WHERE oi.id = ?`,
      [indicatorId],
    );

    return this.computeIndicatorMetrics(enriched[0]);
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

    const result = await this.em.getConnection().execute(
      `INSERT INTO operation_indicators
       (operation_id, particular, description, indicator_code, uacs_code, fiscal_year,
        target_q1, target_q2, target_q3, target_q4,
        accomplishment_q1, accomplishment_q2, accomplishment_q3, accomplishment_q4,
        remarks, metadata, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        operationId,
        dto.particular,
        dto.description,
        dto.indicator_code,
        dto.uacs_code,
        dto.fiscal_year,
        dto.target_q1,
        dto.target_q2,
        dto.target_q3,
        dto.target_q4,
        dto.accomplishment_q1,
        dto.accomplishment_q2,
        dto.accomplishment_q3,
        dto.accomplishment_q4,
        dto.remarks,
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        userId,
      ],
    );

    this.logger.log(
      `INDICATOR_CREATED: id=${result[0].id}, operation=${operationId}, by=${userId}`,
    );
    return result[0];
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

    const check = await this.em.getConnection().execute(
      `SELECT id FROM operation_indicators WHERE id = ? AND operation_id = ? AND deleted_at IS NULL`,
      [indicatorId, operationId],
    );
    if (check.length === 0) {
      throw new NotFoundException(`Indicator ${indicatorId} not found`);
    }

    const fields = Object.keys(dto).filter((k) => dto[k] !== undefined);
    if (fields.length === 0) {
      const current = await this.em.getConnection().execute(
        `SELECT * FROM operation_indicators WHERE id = ?`,
        [indicatorId],
      );
      return current[0];
    }

    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) =>
      f === 'metadata' ? JSON.stringify(dto[f]) : dto[f],
    );

    const result = await this.em.getConnection().execute(
      `UPDATE operation_indicators
       SET ${setClause}, updated_by = ?, updated_at = NOW()
       WHERE id = ?
       RETURNING *`,
      [...values, userId, indicatorId],
    );

    this.logger.log(`INDICATOR_UPDATED: id=${indicatorId}, by=${userId}`);
    return result[0];
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

    const result = await this.em.getConnection().execute(
      `UPDATE operation_indicators SET deleted_at = NOW(), deleted_by = ?
       WHERE id = ? AND operation_id = ? AND deleted_at IS NULL`,
      [userId, indicatorId, operationId],
      'run',
    );

    if (result.affectedRows === 0) {
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

    let query = `SELECT * FROM operation_financials WHERE operation_id = ? AND deleted_at IS NULL`;
    const params: any[] = [operationId];

    if (fiscalYear) {
      query += ` AND fiscal_year = ?`;
      params.push(fiscalYear);
    }
    if (quarter) {
      query += ` AND quarter = ?`;
      params.push(quarter);
    }
    // Phase BC: fund_type filter for BAR1 subcategory tabs
    if (fundType) {
      query += ` AND fund_type = ?`;
      params.push(fundType);
    }
    // Phase ET-B: expense_class filter for PS/MOOE/CO grouping
    if (expenseClass) {
      query += ` AND expense_class = ?`;
      params.push(expenseClass);
    }

    query += ` ORDER BY fiscal_year DESC, quarter, operations_programs`;

    const result = await this.em.getConnection().execute(query, params);
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
    const result = await this.em.getConnection().execute(
      `INSERT INTO operation_financials
       (operation_id, fiscal_year, quarter, operations_programs, department, budget_source,
        fund_type, project_code, expense_class,
        allotment, target, obligation, disbursement, performance_indicator, remarks, metadata, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        operationId,
        dto.fiscal_year,
        dto.quarter,
        dto.operations_programs,
        dto.department,
        dto.budget_source,
        dto.fund_type || null,
        dto.project_code || null,
        dto.expense_class || null,
        dto.allotment,
        dto.target,
        dto.obligation,
        dto.disbursement,
        dto.performance_indicator,
        dto.remarks,
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        userId,
      ],
    );

    this.logger.log(
      `FINANCIAL_CREATED: id=${result[0].id}, operation=${operationId}, by=${userId}`,
    );
    // Phase FA-C: Auto-revert quarterly report Published → Draft on financial create
    await this.autoRevertQuarterlyReport(dto.fiscal_year, dto.quarter, userId);
    // Phase CP: Return record with computed metrics
    return this.computeFinancialMetrics(result[0]);
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
    const existing = await this.em.getConnection().execute(
      `SELECT id, fiscal_year, quarter FROM operation_financials WHERE id = ? AND operation_id = ? AND deleted_at IS NULL`,
      [financialId, operationId],
    );
    if (existing.length === 0) {
      throw new NotFoundException(`Financial record ${financialId} not found`);
    }
    const recordQuarter: string = existing[0].quarter;
    const recordFiscalYear: number = existing[0].fiscal_year;

    // Phase FH-2: Financial uses quarterly report lock only, not operation publication
    await this.validateFinancialEditable(operationId, recordQuarter, user);

    const fields = Object.keys(dto).filter((k) => dto[k] !== undefined);
    if (fields.length === 0) {
      const current = await this.em.getConnection().execute(
        `SELECT * FROM operation_financials WHERE id = ?`,
        [financialId],
      );
      // Phase CP: Return record with computed metrics
      return this.computeFinancialMetrics(current[0]);
    }

    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) =>
      f === 'metadata' ? JSON.stringify(dto[f]) : dto[f],
    );

    const result = await this.em.getConnection().execute(
      `UPDATE operation_financials
       SET ${setClause}, updated_by = ?, updated_at = NOW()
       WHERE id = ?
       RETURNING *`,
      [...values, userId, financialId],
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
    return this.computeFinancialMetrics(result[0]);
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
    const existing = await this.em.getConnection().execute(
      `SELECT id, fiscal_year, quarter FROM operation_financials WHERE id = ? AND operation_id = ? AND deleted_at IS NULL`,
      [financialId, operationId],
    );
    if (existing.length === 0) {
      throw new NotFoundException(`Financial record ${financialId} not found`);
    }
    const recordQuarter: string = existing[0].quarter;
    const recordFiscalYear: number = existing[0].fiscal_year;

    // Phase FH-2: Financial uses quarterly report lock only, not operation publication
    await this.validateFinancialEditable(operationId, recordQuarter, user);

    const result = await this.em.getConnection().execute(
      `UPDATE operation_financials SET deleted_at = NOW(), deleted_by = ?
       WHERE id = ? AND operation_id = ? AND deleted_at IS NULL`,
      [userId, financialId, operationId],
      'run',
    );

    if (result.affectedRows === 0) {
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

    const existing = await this.orgInfoRepo.findOne({ operationId, deletedAt: null });
    if (!existing) {
      const info = this.em.create(OperationOrganizationalInfo, {
        operationId,
        department: dto.department || '',
        agencyEntity: dto.agency_entity || '',
        operatingUnit: dto.operating_unit || '',
        organizationCode: dto.organization_code || '',
      });
      await this.em.persistAndFlush(info);
      this.logger.log(
        `ORG_INFO_CREATED: operation=${operationId}, by=${userId}`,
      );
    } else {
      existing.department = dto.department || '';
      existing.agencyEntity = dto.agency_entity || '';
      existing.operatingUnit = dto.operating_unit || '';
      existing.organizationCode = dto.organization_code || '';
      await this.em.flush();
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

    const info = await this.orgInfoRepo.findOne({ operationId, deletedAt: null });
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
    const [totalRes, linkedRes, orphansByPillarRes] = await Promise.all([
      this.em.getConnection().execute(
        `SELECT COUNT(*) FROM operation_indicators WHERE deleted_at IS NULL`,
      ),
      this.em.getConnection().execute(
        `SELECT COUNT(*) FROM operation_indicators WHERE deleted_at IS NULL AND pillar_indicator_id IS NOT NULL`,
      ),
      this.em.getConnection().execute(`
        SELECT o.operation_type AS pillar_type, COUNT(i.id) AS count
        FROM operation_indicators i
        JOIN university_operations o ON i.operation_id = o.id
        WHERE i.deleted_at IS NULL AND i.pillar_indicator_id IS NULL
        GROUP BY o.operation_type
        ORDER BY o.operation_type
      `),
    ]);

    const total = parseInt(totalRes[0].count, 10);
    const linked = parseInt(linkedRes[0].count, 10);

    return {
      totalIndicators: total,
      linkedIndicators: linked,
      orphanIndicators: total - linked,
      orphansByPillar: orphansByPillarRes.map((r) => ({
        pillar_type: r.pillar_type,
        count: parseInt(r.count, 10),
      })),
    };
  }

  /**
   * Phase DK-D: Get detailed list of orphaned indicators for admin review
   * Returns full orphan records with quarterly data status
   */
  async getOrphanedIndicatorsList(): Promise<any[]> {
    const result = await this.em.getConnection().execute(
      `SELECT
        oi.id,
        oi.operation_id,
        oi.particular,
        oi.fiscal_year,
        oi.created_at,
        oi.updated_at,
        oi.remarks,
        oi.target_q1, oi.target_q2, oi.target_q3, oi.target_q4,
        oi.accomplishment_q1, oi.accomplishment_q2, oi.accomplishment_q3, oi.accomplishment_q4,
        uo.title AS operation_title,
        uo.operation_type,
        CASE
          WHEN oi.target_q1 IS NOT NULL OR oi.target_q2 IS NOT NULL OR
               oi.target_q3 IS NOT NULL OR oi.target_q4 IS NOT NULL OR
               oi.accomplishment_q1 IS NOT NULL OR oi.accomplishment_q2 IS NOT NULL OR
               oi.accomplishment_q3 IS NOT NULL OR oi.accomplishment_q4 IS NOT NULL
          THEN TRUE
          ELSE FALSE
        END AS has_quarterly_data
       FROM operation_indicators oi
       JOIN university_operations uo ON oi.operation_id = uo.id
       WHERE oi.pillar_indicator_id IS NULL
         AND oi.deleted_at IS NULL
       ORDER BY oi.fiscal_year DESC, uo.operation_type, oi.particular`,
    );

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
    const taxonomyRes = await this.em.getConnection().execute(`
      SELECT
        pillar_type,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE indicator_type = 'OUTCOME') AS outcome_count,
        COUNT(*) FILTER (WHERE indicator_type = 'OUTPUT') AS output_count
      FROM pillar_indicator_taxonomy
      WHERE is_active = true
      GROUP BY pillar_type
      ORDER BY pillar_type
    `);

    // Phase GO-1: Two-stage CTE aggregation — fixes data loss from DISTINCT ON in row-per-quarter model.
    // Stage 1 (canonical_ops): DISTINCT ON picks ONE canonical operation per indicator (multi-operation dedup).
    // Stage 2 (merged): MAX-aggregates ALL rows of that operation across reported_quarter values (multi-row dedup).
    // Outer SELECT is unchanged — deduped alias exposes same column interface as before.
    const dataRes = await this.em.getConnection().execute(
      `
      WITH canonical_ops AS (
        SELECT DISTINCT ON (oi.pillar_indicator_id)
          oi.operation_id, oi.pillar_indicator_id
        FROM operation_indicators oi
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year = ? AND oi.deleted_at IS NULL AND pit.is_active = true
        ORDER BY oi.pillar_indicator_id, oi.updated_at DESC
      ),
      merged AS (
        SELECT
          oi.pillar_indicator_id,
          pit.pillar_type, pit.unit_type, pit.indicator_type,
          MAX(oi.target_q1) AS target_q1, MAX(oi.target_q2) AS target_q2,
          MAX(oi.target_q3) AS target_q3, MAX(oi.target_q4) AS target_q4,
          MAX(oi.accomplishment_q1) AS accomplishment_q1, MAX(oi.accomplishment_q2) AS accomplishment_q2,
          MAX(oi.accomplishment_q3) AS accomplishment_q3, MAX(oi.accomplishment_q4) AS accomplishment_q4
        FROM operation_indicators oi
        JOIN canonical_ops co ON oi.operation_id = co.operation_id
          AND oi.pillar_indicator_id = co.pillar_indicator_id
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year = ? AND oi.deleted_at IS NULL
        GROUP BY oi.pillar_indicator_id, pit.pillar_type, pit.unit_type, pit.indicator_type
      )
      SELECT
        deduped.pillar_type,
        COUNT(DISTINCT deduped.pillar_indicator_id) AS indicators_with_data,
        SUM(
          CASE WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT')
            THEN COALESCE(deduped.target_q1,0) + COALESCE(deduped.target_q2,0) + COALESCE(deduped.target_q3,0) + COALESCE(deduped.target_q4,0)
            ELSE 0
          END
        ) AS count_target,
        SUM(
          CASE WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT')
            THEN COALESCE(deduped.accomplishment_q1,0) + COALESCE(deduped.accomplishment_q2,0) + COALESCE(deduped.accomplishment_q3,0) + COALESCE(deduped.accomplishment_q4,0)
            ELSE 0
          END
        ) AS count_accomplishment,
        AVG(
          CASE WHEN deduped.unit_type = 'PERCENTAGE' THEN
            (COALESCE(deduped.target_q1,0) + COALESCE(deduped.target_q2,0) + COALESCE(deduped.target_q3,0) + COALESCE(deduped.target_q4,0))
            / NULLIF(
              (CASE WHEN deduped.target_q1 IS NOT NULL AND deduped.target_q1 != 0 THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.target_q2 IS NOT NULL AND deduped.target_q2 != 0 THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.target_q3 IS NOT NULL AND deduped.target_q3 != 0 THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.target_q4 IS NOT NULL AND deduped.target_q4 != 0 THEN 1 ELSE 0 END)
            , 0)
          ELSE NULL END
        ) AS pct_avg_target,
        AVG(
          CASE WHEN deduped.unit_type = 'PERCENTAGE' THEN
            (COALESCE(deduped.accomplishment_q1,0) + COALESCE(deduped.accomplishment_q2,0) + COALESCE(deduped.accomplishment_q3,0) + COALESCE(deduped.accomplishment_q4,0))
            / NULLIF(
              (CASE WHEN deduped.accomplishment_q1 IS NOT NULL AND deduped.accomplishment_q1 != 0 THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.accomplishment_q2 IS NOT NULL AND deduped.accomplishment_q2 != 0 THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.accomplishment_q3 IS NOT NULL AND deduped.accomplishment_q3 != 0 THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.accomplishment_q4 IS NOT NULL AND deduped.accomplishment_q4 != 0 THEN 1 ELSE 0 END)
            , 0)
          ELSE NULL END
        ) AS pct_avg_accomplishment,
        COUNT(CASE WHEN deduped.unit_type = 'PERCENTAGE' THEN 1 END) AS pct_indicator_count,
        COUNT(CASE WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT') THEN 1 END) AS count_indicator_count,
        -- Phase GN-2: Unit-type-aware avg accomplishment rate (formula unchanged)
        AVG(
          CASE
            WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT') AND deduped._sum_target > 0
              THEN (deduped._sum_actual / deduped._sum_target) * 100
            WHEN deduped.unit_type = 'PERCENTAGE' AND deduped._filled_target_qs > 0 AND deduped._filled_actual_qs > 0
              THEN (
                (deduped._sum_actual / deduped._filled_actual_qs) /
                NULLIF(deduped._sum_target / deduped._filled_target_qs, 0)
              ) * 100
            ELSE NULL
          END
        ) AS avg_accomplishment_rate,
        SUM(
          CASE WHEN deduped._sum_target > 0 THEN 1.0 ELSE 0 END
        ) AS indicator_target_rate,
        SUM(
          CASE
            WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT') AND deduped._sum_target > 0
              THEN deduped._sum_actual / deduped._sum_target
            WHEN deduped.unit_type = 'PERCENTAGE' AND deduped._filled_target_qs > 0 AND deduped._filled_actual_qs > 0
              THEN (deduped._sum_actual / deduped._filled_actual_qs) /
                   NULLIF(deduped._sum_target / deduped._filled_target_qs, 0)
            ELSE NULL
          END
        ) AS indicator_actual_rate
      FROM (
        SELECT
          merged.*,
          (COALESCE(merged.target_q1,0)+COALESCE(merged.target_q2,0)+COALESCE(merged.target_q3,0)+COALESCE(merged.target_q4,0)) AS _sum_target,
          (COALESCE(merged.accomplishment_q1,0)+COALESCE(merged.accomplishment_q2,0)+COALESCE(merged.accomplishment_q3,0)+COALESCE(merged.accomplishment_q4,0)) AS _sum_actual,
          (CASE WHEN merged.target_q1 IS NOT NULL AND merged.target_q1 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q2 IS NOT NULL AND merged.target_q2 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q3 IS NOT NULL AND merged.target_q3 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q4 IS NOT NULL AND merged.target_q4 != 0 THEN 1 ELSE 0 END) AS _filled_target_qs,
          (CASE WHEN merged.accomplishment_q1 IS NOT NULL AND merged.accomplishment_q1 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q2 IS NOT NULL AND merged.accomplishment_q2 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q3 IS NOT NULL AND merged.accomplishment_q3 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q4 IS NOT NULL AND merged.accomplishment_q4 != 0 THEN 1 ELSE 0 END) AS _filled_actual_qs
        FROM merged
      ) AS deduped
      GROUP BY deduped.pillar_type
    `,
      [fiscalYear, fiscalYear],
    );

    // Phase DQ-B: Build response with unit-type-aware fields
    const dataMap = new Map<string, any>(
      dataRes.map((r) => [r.pillar_type, r]),
    );

    const pillars = taxonomyRes.map((t) => {
      const data = dataMap.get(t.pillar_type);
      const totalTaxonomy = parseInt(t.total, 10);
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
        outcome_indicators: parseInt(t.outcome_count, 10),
        output_indicators: parseInt(t.output_count, 10),
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
    let pillarFilter = '';
    const params: any[] = [fiscalYear];

    if (pillarType) {
      pillarFilter = `AND pit.pillar_type = ?`;
      params.push(pillarType);
    }

    // Phase GO-2: Two-stage CTE — same pattern as getPillarSummary.
    // pillarFilter applied in canonical_ops WHERE clause.
    const query = `
      WITH canonical_ops AS (
        SELECT DISTINCT ON (oi.pillar_indicator_id)
          oi.operation_id, oi.pillar_indicator_id
        FROM operation_indicators oi
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year = ? AND oi.deleted_at IS NULL AND pit.is_active = true
        ${pillarFilter}
        ORDER BY oi.pillar_indicator_id, oi.updated_at DESC
      ),
      deduped AS (
        SELECT
          oi.pillar_indicator_id,
          pit.pillar_type, pit.unit_type,
          MAX(oi.target_q1) AS target_q1, MAX(oi.target_q2) AS target_q2,
          MAX(oi.target_q3) AS target_q3, MAX(oi.target_q4) AS target_q4,
          MAX(oi.accomplishment_q1) AS accomplishment_q1, MAX(oi.accomplishment_q2) AS accomplishment_q2,
          MAX(oi.accomplishment_q3) AS accomplishment_q3, MAX(oi.accomplishment_q4) AS accomplishment_q4
        FROM operation_indicators oi
        JOIN canonical_ops co ON oi.operation_id = co.operation_id
          AND oi.pillar_indicator_id = co.pillar_indicator_id
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year = ? AND oi.deleted_at IS NULL
        GROUP BY oi.pillar_indicator_id, pit.pillar_type, pit.unit_type
      )
      SELECT
        -- Phase AAAG-A: per-pillar grouping (one row per pillar)
        deduped.pillar_type,
        SUM(CASE WHEN deduped.target_q1 > 0 THEN 1.0 ELSE 0 END) AS target_rate_q1,
        SUM(CASE WHEN deduped.target_q2 > 0 THEN 1.0 ELSE 0 END) AS target_rate_q2,
        SUM(CASE WHEN deduped.target_q3 > 0 THEN 1.0 ELSE 0 END) AS target_rate_q3,
        SUM(CASE WHEN deduped.target_q4 > 0 THEN 1.0 ELSE 0 END) AS target_rate_q4,
        SUM(CASE WHEN deduped.target_q1 > 0 THEN COALESCE(deduped.accomplishment_q1,0)/deduped.target_q1 ELSE NULL END) AS actual_rate_q1,
        SUM(CASE WHEN deduped.target_q2 > 0 THEN COALESCE(deduped.accomplishment_q2,0)/deduped.target_q2 ELSE NULL END) AS actual_rate_q2,
        SUM(CASE WHEN deduped.target_q3 > 0 THEN COALESCE(deduped.accomplishment_q3,0)/deduped.target_q3 ELSE NULL END) AS actual_rate_q3,
        SUM(CASE WHEN deduped.target_q4 > 0 THEN COALESCE(deduped.accomplishment_q4,0)/deduped.target_q4 ELSE NULL END) AS actual_rate_q4
      FROM deduped
      GROUP BY deduped.pillar_type
    `;

    const result = await this.em.getConnection().execute(query, [...params, fiscalYear]);

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
    // Phase II: ANY(?) incompatible with MikroORM execute array binding — use IN with scalar params.
    const yqs = years.map(() => '?').join(', ');
    const yearlyRes = await this.em.getConnection().execute(
      `
      WITH canonical_ops AS (
        SELECT DISTINCT ON (oi.fiscal_year, oi.pillar_indicator_id)
          oi.operation_id, oi.pillar_indicator_id, oi.fiscal_year
        FROM operation_indicators oi
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year IN (${yqs}) AND oi.deleted_at IS NULL AND pit.is_active = true
        ORDER BY oi.fiscal_year, oi.pillar_indicator_id, oi.updated_at DESC
      ),
      merged AS (
        SELECT
          oi.pillar_indicator_id, oi.fiscal_year, pit.unit_type,
          MAX(oi.target_q1) AS target_q1, MAX(oi.target_q2) AS target_q2,
          MAX(oi.target_q3) AS target_q3, MAX(oi.target_q4) AS target_q4,
          MAX(oi.accomplishment_q1) AS accomplishment_q1, MAX(oi.accomplishment_q2) AS accomplishment_q2,
          MAX(oi.accomplishment_q3) AS accomplishment_q3, MAX(oi.accomplishment_q4) AS accomplishment_q4
        FROM operation_indicators oi
        JOIN canonical_ops co ON oi.operation_id = co.operation_id
          AND oi.pillar_indicator_id = co.pillar_indicator_id
          AND oi.fiscal_year = co.fiscal_year
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year IN (${yqs}) AND oi.deleted_at IS NULL
        GROUP BY oi.pillar_indicator_id, oi.fiscal_year, pit.unit_type
      )
      SELECT
        deduped.fiscal_year,
        COUNT(*) AS total_indicators,
        AVG(
          CASE
            WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT') AND deduped._sum_target > 0
              THEN (deduped._sum_actual / deduped._sum_target) * 100
            WHEN deduped.unit_type = 'PERCENTAGE' AND deduped._filled_target_qs > 0 AND deduped._filled_actual_qs > 0
              THEN ((deduped._sum_actual / deduped._filled_actual_qs) /
                    NULLIF(deduped._sum_target / deduped._filled_target_qs, 0)) * 100
            ELSE NULL
          END
        ) AS avg_accomplishment_rate
      FROM (
        SELECT
          merged.*,
          (COALESCE(merged.target_q1,0)+COALESCE(merged.target_q2,0)+COALESCE(merged.target_q3,0)+COALESCE(merged.target_q4,0)) AS _sum_target,
          (COALESCE(merged.accomplishment_q1,0)+COALESCE(merged.accomplishment_q2,0)+COALESCE(merged.accomplishment_q3,0)+COALESCE(merged.accomplishment_q4,0)) AS _sum_actual,
          (CASE WHEN merged.target_q1 IS NOT NULL AND merged.target_q1 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q2 IS NOT NULL AND merged.target_q2 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q3 IS NOT NULL AND merged.target_q3 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q4 IS NOT NULL AND merged.target_q4 != 0 THEN 1 ELSE 0 END) AS _filled_target_qs,
          (CASE WHEN merged.accomplishment_q1 IS NOT NULL AND merged.accomplishment_q1 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q2 IS NOT NULL AND merged.accomplishment_q2 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q3 IS NOT NULL AND merged.accomplishment_q3 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q4 IS NOT NULL AND merged.accomplishment_q4 != 0 THEN 1 ELSE 0 END) AS _filled_actual_qs
        FROM merged
      ) AS deduped
      GROUP BY deduped.fiscal_year
      ORDER BY deduped.fiscal_year
    `,
      [...years, ...years],
    );

    // Phase GO-3: Pillar breakdown — same two-stage CTE, adds pillar_type to grouping
    const pillarRes = await this.em.getConnection().execute(
      `
      WITH canonical_ops AS (
        SELECT DISTINCT ON (oi.fiscal_year, oi.pillar_indicator_id)
          oi.operation_id, oi.pillar_indicator_id, oi.fiscal_year
        FROM operation_indicators oi
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year IN (${yqs}) AND oi.deleted_at IS NULL AND pit.is_active = true
        ORDER BY oi.fiscal_year, oi.pillar_indicator_id, oi.updated_at DESC
      ),
      merged AS (
        SELECT
          oi.pillar_indicator_id, oi.fiscal_year, pit.pillar_type, pit.unit_type,
          MAX(oi.target_q1) AS target_q1, MAX(oi.target_q2) AS target_q2,
          MAX(oi.target_q3) AS target_q3, MAX(oi.target_q4) AS target_q4,
          MAX(oi.accomplishment_q1) AS accomplishment_q1, MAX(oi.accomplishment_q2) AS accomplishment_q2,
          MAX(oi.accomplishment_q3) AS accomplishment_q3, MAX(oi.accomplishment_q4) AS accomplishment_q4
        FROM operation_indicators oi
        JOIN canonical_ops co ON oi.operation_id = co.operation_id
          AND oi.pillar_indicator_id = co.pillar_indicator_id
          AND oi.fiscal_year = co.fiscal_year
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year IN (${yqs}) AND oi.deleted_at IS NULL
        GROUP BY oi.pillar_indicator_id, oi.fiscal_year, pit.pillar_type, pit.unit_type
      )
      SELECT
        deduped.fiscal_year,
        deduped.pillar_type,
        AVG(
          CASE
            WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT') AND deduped._sum_target > 0
              THEN (deduped._sum_actual / deduped._sum_target) * 100
            WHEN deduped.unit_type = 'PERCENTAGE' AND deduped._filled_target_qs > 0 AND deduped._filled_actual_qs > 0
              THEN ((deduped._sum_actual / deduped._filled_actual_qs) /
                    NULLIF(deduped._sum_target / deduped._filled_target_qs, 0)) * 100
            ELSE NULL
          END
        ) AS avg_accomplishment_rate,
        AVG(CASE WHEN deduped.unit_type = 'PERCENTAGE'
          THEN deduped._sum_target / NULLIF(deduped._filled_target_qs, 0)
          ELSE NULL END) AS pct_avg_target,
        AVG(CASE WHEN deduped.unit_type = 'PERCENTAGE'
          THEN deduped._sum_actual / NULLIF(deduped._filled_actual_qs, 0)
          ELSE NULL END) AS pct_avg_accomplishment,
        SUM(CASE WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT')
          THEN deduped._sum_target ELSE 0 END) AS count_target,
        SUM(CASE WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT')
          THEN deduped._sum_actual ELSE 0 END) AS count_accomplishment
      FROM (
        SELECT
          merged.*,
          (COALESCE(merged.target_q1,0)+COALESCE(merged.target_q2,0)+COALESCE(merged.target_q3,0)+COALESCE(merged.target_q4,0)) AS _sum_target,
          (COALESCE(merged.accomplishment_q1,0)+COALESCE(merged.accomplishment_q2,0)+COALESCE(merged.accomplishment_q3,0)+COALESCE(merged.accomplishment_q4,0)) AS _sum_actual,
          (CASE WHEN merged.target_q1 IS NOT NULL AND merged.target_q1 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q2 IS NOT NULL AND merged.target_q2 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q3 IS NOT NULL AND merged.target_q3 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q4 IS NOT NULL AND merged.target_q4 != 0 THEN 1 ELSE 0 END) AS _filled_target_qs,
          (CASE WHEN merged.accomplishment_q1 IS NOT NULL AND merged.accomplishment_q1 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q2 IS NOT NULL AND merged.accomplishment_q2 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q3 IS NOT NULL AND merged.accomplishment_q3 != 0 THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q4 IS NOT NULL AND merged.accomplishment_q4 != 0 THEN 1 ELSE 0 END) AS _filled_actual_qs
        FROM merged
      ) AS deduped
      GROUP BY deduped.fiscal_year, deduped.pillar_type
      ORDER BY deduped.fiscal_year, deduped.pillar_type
    `,
      [...years, ...years],
    );

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
    const result = await this.em.getConnection().execute(
      `
      SELECT
        uo.operation_type AS pillar_type,
        COALESCE(of2.department, 'Unspecified') AS campus,
        COALESCE(SUM(of2.allotment), 0) AS total_appropriation,
        COALESCE(SUM(of2.obligation), 0) AS total_obligations,
        COALESCE(SUM(of2.disbursement), 0) AS total_disbursement,
        CASE WHEN SUM(of2.allotment) > 0
          THEN ROUND((SUM(of2.obligation)::numeric / SUM(of2.allotment)) * 100, 2)
          ELSE 0
        END AS utilization_rate
      FROM operation_financials of2
      JOIN university_operations uo ON uo.id = of2.operation_id
      WHERE uo.fiscal_year = ? AND of2.deleted_at IS NULL AND uo.deleted_at IS NULL
      GROUP BY uo.operation_type, of2.department
      ORDER BY uo.operation_type, of2.department
    `,
      [fiscalYear],
    );

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
    const result = await this.em.getConnection().execute(
      `
      SELECT
        uo.operation_type AS pillar_type,
        of2.expense_class,
        COALESCE(SUM(of2.allotment), 0) AS total_appropriation,
        COALESCE(SUM(of2.obligation), 0) AS total_obligations,
        COALESCE(SUM(of2.disbursement), 0) AS total_disbursement
      FROM operation_financials of2
      JOIN university_operations uo ON uo.id = of2.operation_id
      WHERE uo.fiscal_year = ? AND of2.deleted_at IS NULL AND uo.deleted_at IS NULL
      GROUP BY uo.operation_type, of2.expense_class
      ORDER BY uo.operation_type, of2.expense_class
    `,
      [fiscalYear],
    );

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
      { orderBy: { year: 'DESC' }, fields: ['year', 'label'] },
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
    await this.em.persistAndFlush(fy);
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
    await this.em.flush();
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
    const qr = this.em.create(QuarterlyReport, {
      fiscalYear,
      quarter,
      title,
      publicationStatus: 'DRAFT',
      createdBy: userId,
    });
    await this.em.persistAndFlush(qr);

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
    let query = `SELECT qr.*, u.first_name || ' ' || u.last_name as submitter_name
                 FROM quarterly_reports qr
                 LEFT JOIN users u ON qr.submitted_by = u.id
                 WHERE qr.deleted_at IS NULL`;
    const params: any[] = [];

    if (fiscalYear) {
      query += ` AND qr.fiscal_year = ?`;
      params.push(fiscalYear);
    }
    if (quarter) {
      query += ` AND qr.quarter = ?`;
      params.push(quarter);
    }

    query += ' ORDER BY qr.fiscal_year DESC, qr.quarter ASC';
    const result = await this.em.getConnection().execute(query, params);
    return result;
  }

  async findOneQuarterlyReport(id: string): Promise<any> {
    const result = await this.em.getConnection().execute(
      `SELECT qr.*, u.first_name || ' ' || u.last_name as submitter_name
       FROM quarterly_reports qr
       LEFT JOIN users u ON qr.submitted_by = u.id
       WHERE qr.id = ? AND qr.deleted_at IS NULL`,
      [id],
    );
    if (result.length === 0) {
      throw new NotFoundException(`Quarterly report ${id} not found`);
    }
    return result[0];
  }

  async findQuarterlyReportsPendingReview(user: JwtPayload): Promise<any[]> {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view pending reviews');
    }

    // Module access check (same pattern as findPendingReview)
    if (!user.is_superadmin) {
      const accessCheck = await this.em.getConnection().execute(
        `SELECT 1 FROM user_module_assignments
         WHERE user_id = ?
           AND (module = 'OPERATIONS' OR module = 'ALL')`,
        [user.sub],
      );
      if (accessCheck.length === 0) {
        return [];
      }
    }

    // Phase EZ-B: Enrich with has_physical/has_financial flags for dynamic submission labels
    const result = await this.em.getConnection().execute(
      `SELECT qr.id, qr.fiscal_year, qr.quarter, qr.title, qr.publication_status,
              qr.submitted_by, qr.submitted_at, qr.created_at,
              u.first_name || ' ' || u.last_name as submitter_name,
              EXISTS(
                SELECT 1 FROM operation_indicators oi
                JOIN university_operations uo ON uo.id = oi.operation_id
                WHERE uo.fiscal_year = qr.fiscal_year
                  AND oi.deleted_at IS NULL
                  AND (oi.target_q1 IS NOT NULL OR oi.accomplishment_q1 IS NOT NULL
                       OR oi.target_q2 IS NOT NULL OR oi.accomplishment_q2 IS NOT NULL
                       OR oi.target_q3 IS NOT NULL OR oi.accomplishment_q3 IS NOT NULL
                       OR oi.target_q4 IS NOT NULL OR oi.accomplishment_q4 IS NOT NULL)
              ) as has_physical,
              EXISTS(
                SELECT 1 FROM operation_financials of2
                WHERE of2.fiscal_year = qr.fiscal_year
                  AND of2.deleted_at IS NULL
              ) as has_financial
       FROM quarterly_reports qr
       LEFT JOIN users u ON qr.submitted_by = u.id
       WHERE qr.publication_status = 'PENDING_REVIEW'
         AND qr.deleted_at IS NULL
       ORDER BY qr.submitted_at ASC`,
    );
    return result;
  }

  async submitQuarterlyReport(id: string, userId: string): Promise<any> {
    const report = await this.findOneQuarterlyReport(id);

    if (
      report.publication_status !== 'DRAFT' &&
      report.publication_status !== 'REJECTED'
    ) {
      throw new BadRequestException(
        `Only DRAFT or REJECTED reports can be submitted. Current status: ${report.publication_status}`,
      );
    }

    // Creator can submit
    if (report.created_by !== userId) {
      const isAdmin = await this.permissionResolver.isAdminFromDatabase(userId);
      if (!isAdmin) {
        throw new ForbiddenException(
          'Only the creator or an admin can submit this report',
        );
      }
    }

    // Phase GOV-D: Snapshot submission event and increment submission_count
    await this.snapshotSubmissionHistory(
      { ...report, submission_count: (report.submission_count || 0) + 1 },
      'SUBMITTED',
      userId,
    );

    const result = await this.em.getConnection().execute(
      `UPDATE quarterly_reports
       SET publication_status = 'PENDING_REVIEW',
           submitted_by = ?,
           submitted_at = NOW(),
           review_notes = NULL,
           submission_count = COALESCE(submission_count, 0) + 1,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [userId, id],
    );

    this.logger.log(`QUARTERLY_REPORT_SUBMITTED: id=${id}, by=${userId}`);
    return result[0];
  }

  async approveQuarterlyReport(
    id: string,
    adminId: string,
    user: JwtPayload,
  ): Promise<any> {
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can approve quarterly reports');
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

    const result = await this.em.getConnection().execute(
      `UPDATE quarterly_reports
       SET publication_status = 'PUBLISHED',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_notes = NULL,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [adminId, id],
    );

    this.logger.log(`QUARTERLY_REPORT_APPROVED: id=${id}, by=${adminId}`);
    return result[0];
  }

  async rejectQuarterlyReport(
    id: string,
    adminId: string,
    notes: string,
    user: JwtPayload,
  ): Promise<any> {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can reject quarterly reports');
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

    const result = await this.em.getConnection().execute(
      `UPDATE quarterly_reports
       SET publication_status = 'REJECTED',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_notes = ?,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [adminId, notes.trim(), id],
    );

    this.logger.log(`QUARTERLY_REPORT_REJECTED: id=${id}, by=${adminId}`);
    return result[0];
  }

  async withdrawQuarterlyReport(id: string, userId: string): Promise<any> {
    const report = await this.findOneQuarterlyReport(id);

    if (report.publication_status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Only PENDING_REVIEW reports can be withdrawn. Current status: ${report.publication_status}`,
      );
    }

    if (report.submitted_by !== userId) {
      throw new ForbiddenException(
        'Only the original submitter can withdraw this report',
      );
    }

    const result = await this.em.getConnection().execute(
      `UPDATE quarterly_reports
       SET publication_status = 'DRAFT',
           submitted_by = NULL,
           submitted_at = NULL,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [id],
    );

    this.logger.log(`QUARTERLY_REPORT_WITHDRAWN: id=${id}, by=${userId}`);
    return result[0];
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
      const submission = this.em.create(QuarterlyReportSubmission, {
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
      await this.em.persistAndFlush(submission);
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

    const report = await this.em.getConnection().execute(
      `SELECT id, fiscal_year, quarter, publication_status, submission_count,
              submitted_by, submitted_at, reviewed_by, reviewed_at, review_notes
       FROM quarterly_reports
       WHERE fiscal_year = ? AND quarter = ? AND deleted_at IS NULL`,
      [fiscalYear, quarter],
    );

    if (report.length === 0) return;

    const qr = report[0];
    if (qr.publication_status === 'DRAFT') return;

    // Phase GOV-D: Snapshot review metadata before destroying it
    await this.snapshotSubmissionHistory(
      qr,
      'REVERTED',
      userId,
      'indicator_update',
    );

    await this.em.getConnection().execute(
      `UPDATE quarterly_reports
       SET publication_status = 'DRAFT',
           reviewed_by = NULL,
           reviewed_at = NULL,
           review_notes = NULL,
           submitted_by = NULL,
           submitted_at = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [qr.id],
    );

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
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can unlock quarterly reports');
    }

    const report = await this.findOneQuarterlyReport(id);

    if (report.publication_status !== 'PUBLISHED') {
      throw new BadRequestException(
        `Only PUBLISHED reports can be unlocked. Current status: ${report.publication_status}`,
      );
    }

    // Phase GOV-D: Snapshot review metadata before destroying it
    await this.snapshotSubmissionHistory(report, 'UNLOCKED', adminId, reason);

    const result = await this.em.getConnection().execute(
      `UPDATE quarterly_reports
       SET publication_status = 'DRAFT',
           reviewed_by = NULL,
           reviewed_at = NULL,
           review_notes = NULL,
           submitted_by = NULL,
           submitted_at = NULL,
           unlocked_by = ?,
           unlocked_at = NOW(),
           unlock_requested_by = NULL,
           unlock_requested_at = NULL,
           unlock_request_reason = NULL,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [adminId, id],
    );

    this.logger.log(
      `QUARTERLY_REPORT_UNLOCKED: id=${id}, by=${adminId}, reason="${reason || 'no reason'}"`,
    );
    return result[0];
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

    const result = await this.em.getConnection().execute(
      `UPDATE quarterly_reports
       SET unlock_requested_by = ?,
           unlock_requested_at = NOW(),
           unlock_request_reason = ?,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [userId, reason.trim(), id],
    );

    this.logger.log(
      `QUARTERLY_REPORT_UNLOCK_REQUESTED: id=${id}, by=${userId}, reason="${reason.trim()}"`,
    );
    return result[0];
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
    if (!this.permissionResolver.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can deny unlock requests');
    }

    const report = await this.findOneQuarterlyReport(id);

    if (!report.unlock_requested_by) {
      throw new BadRequestException(
        'No pending unlock request for this report',
      );
    }

    const result = await this.em.getConnection().execute(
      `UPDATE quarterly_reports
       SET unlock_requested_by = NULL,
           unlock_requested_at = NULL,
           unlock_request_reason = NULL,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING *`,
      [id],
    );

    this.logger.log(`QUARTERLY_REPORT_UNLOCK_DENIED: id=${id}, by=${adminId}`);
    return result[0];
  }

  /**
   * Phase GOV-F: Find quarterly reports with pending unlock requests (Admin review queue).
   */
  async findQuarterlyReportsPendingUnlock(user: JwtPayload): Promise<any[]> {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException(
        'Only Admin can view pending unlock requests',
      );
    }

    if (!user.is_superadmin) {
      const accessCheck = await this.em.getConnection().execute(
        `SELECT 1 FROM user_module_assignments
         WHERE user_id = ?
           AND (module = 'OPERATIONS' OR module = 'ALL')`,
        [user.sub],
      );
      if (accessCheck.length === 0) {
        return [];
      }
    }

    const result = await this.em.getConnection().execute(
      `SELECT qr.id, qr.fiscal_year, qr.quarter, qr.title, qr.publication_status,
              qr.unlock_requested_by, qr.unlock_requested_at, qr.unlock_request_reason,
              qr.created_at,
              u.first_name || ' ' || u.last_name as requester_name
       FROM quarterly_reports qr
       LEFT JOIN users u ON qr.unlock_requested_by = u.id
       WHERE qr.unlock_requested_by IS NOT NULL
         AND qr.deleted_at IS NULL
       ORDER BY qr.unlock_requested_at ASC`,
    );
    return result;
  }

  /**
   * Phase GOV-C: Find reviewed quarterly reports (PUBLISHED/REJECTED) for admin archive view.
   */
  async findQuarterlyReportsReviewed(user: JwtPayload): Promise<any[]> {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view review history');
    }

    if (!user.is_superadmin) {
      const accessCheck = await this.em.getConnection().execute(
        `SELECT 1 FROM user_module_assignments
         WHERE user_id = ?
           AND (module = 'OPERATIONS' OR module = 'ALL')`,
        [user.sub],
      );
      if (accessCheck.length === 0) {
        return [];
      }
    }

    const result = await this.em.getConnection().execute(
      `SELECT qr.id, qr.fiscal_year, qr.quarter, qr.title, qr.publication_status,
              qr.submitted_by, qr.submitted_at,
              qr.reviewed_by, qr.reviewed_at, qr.review_notes,
              qr.unlocked_by, qr.unlocked_at,
              reviewer.first_name || ' ' || reviewer.last_name AS reviewed_by_name,
              submitter.first_name || ' ' || submitter.last_name AS submitter_name,
              unlocker.first_name || ' ' || unlocker.last_name AS unlocked_by_name
       FROM quarterly_reports qr
       LEFT JOIN users reviewer ON qr.reviewed_by = reviewer.id
       LEFT JOIN users submitter ON qr.submitted_by = submitter.id
       LEFT JOIN users unlocker ON qr.unlocked_by = unlocker.id
       WHERE qr.publication_status IN ('PUBLISHED', 'REJECTED')
         AND qr.deleted_at IS NULL
       ORDER BY qr.reviewed_at DESC NULLS LAST`,
    );
    return result;
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
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view submission history');
    }

    if (!user.is_superadmin) {
      const accessCheck = await this.em.getConnection().execute(
        `SELECT 1 FROM user_module_assignments
         WHERE user_id = ?
           AND (module = 'OPERATIONS' OR module = 'ALL')`,
        [user.sub],
      );
      if (accessCheck.length === 0) {
        return [];
      }
    }

    let query = `
      SELECT qrs.id, qrs.quarterly_report_id, qrs.fiscal_year, qrs.quarter,
             qrs.version, qrs.event_type,
             qrs.submitted_by, qrs.submitted_at,
             qrs.reviewed_by, qrs.reviewed_at, qrs.review_notes,
             qrs.actioned_by, qrs.actioned_at, qrs.reason,
             qr.title, qr.publication_status AS current_status,
             submitter.first_name || ' ' || submitter.last_name AS submitter_name,
             reviewer.first_name || ' ' || reviewer.last_name AS reviewed_by_name,
             actor.first_name || ' ' || actor.last_name AS actioned_by_name
      FROM quarterly_report_submissions qrs
      JOIN quarterly_reports qr ON qrs.quarterly_report_id = qr.id
      LEFT JOIN users submitter ON qrs.submitted_by = submitter.id
      LEFT JOIN users reviewer ON qrs.reviewed_by = reviewer.id
      LEFT JOIN users actor ON qrs.actioned_by = actor.id
      WHERE qr.deleted_at IS NULL`;

    const params: any[] = [];
    if (fiscalYear) {
      params.push(fiscalYear);
      query += ` AND qrs.fiscal_year = ?`;
    }
    if (quarter) {
      params.push(quarter);
      query += ` AND qrs.quarter = ?`;
    }

    query += ` ORDER BY qrs.actioned_at DESC`;

    const result = await this.em.getConnection().execute(query, params);
    return result;
  }

  /**
   * Phase IT: Per-report submission history for a specific quarterly report.
   * Returns all append-only events from quarterly_report_submissions for the given QR ID.
   */
  async findQuarterlyReportHistory(
    id: string,
    user: JwtPayload,
  ): Promise<any[]> {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Only Admin can view quarterly report history');
    }

    return this.em.getConnection().execute(
      `SELECT qrs.id, qrs.quarterly_report_id, qrs.fiscal_year, qrs.quarter,
              qrs.version, qrs.event_type,
              qrs.submitted_by, qrs.submitted_at,
              qrs.reviewed_by, qrs.reviewed_at, qrs.review_notes,
              qrs.actioned_by, qrs.actioned_at, qrs.reason,
              qr.title, qr.publication_status AS current_status,
              submitter.first_name || ' ' || submitter.last_name AS submitter_name,
              reviewer.first_name || ' ' || reviewer.last_name AS reviewed_by_name,
              actor.first_name || ' ' || actor.last_name AS actioned_by_name
       FROM quarterly_report_submissions qrs
       JOIN quarterly_reports qr ON qrs.quarterly_report_id = qr.id
       LEFT JOIN users submitter ON qrs.submitted_by = submitter.id
       LEFT JOIN users reviewer ON qrs.reviewed_by = reviewer.id
       LEFT JOIN users actor ON qrs.actioned_by = actor.id
       WHERE qrs.quarterly_report_id = ?
         AND qr.deleted_at IS NULL
       ORDER BY qrs.actioned_at DESC`,
      [id],
    );
  }

  // ─── Phase EZ-C: Financial Analytics ──────────────────────────────────────────

  /**
   * Phase EZ-C: Financial pillar summary — per-pillar aggregation of financial metrics
   */
  async getFinancialPillarSummary(fiscalYear: number): Promise<any> {
    const result = await this.em.getConnection().execute(
      `
      SELECT
        uo.operation_type AS pillar_type,
        COUNT(of2.id) AS record_count,
        COALESCE(SUM(of2.allotment), 0) AS total_appropriation,
        COALESCE(SUM(of2.obligation), 0) AS total_obligations,
        COALESCE(SUM(of2.disbursement), 0) AS total_disbursement,
        CASE WHEN SUM(of2.allotment) > 0
          THEN ROUND((SUM(of2.obligation)::numeric / SUM(of2.allotment)) * 100, 2)
          ELSE 0
        END AS avg_utilization_rate,
        COALESCE(SUM(of2.allotment) - SUM(of2.obligation), 0) AS total_balance
      FROM operation_financials of2
      JOIN university_operations uo ON uo.id = of2.operation_id
      WHERE uo.fiscal_year = ?
        AND of2.deleted_at IS NULL
        AND uo.deleted_at IS NULL
      GROUP BY uo.operation_type
      ORDER BY uo.operation_type
    `,
      [fiscalYear],
    );

    return { pillars: result, fiscal_year: fiscalYear };
  }

  /**
   * Phase EZ-C: Financial quarterly trend — per-quarter aggregation
   */
  async getFinancialQuarterlyTrend(
    fiscalYear: number,
    pillarType?: string,
  ): Promise<any> {
    let query = `
      SELECT
        of2.quarter,
        COALESCE(SUM(of2.allotment), 0) AS total_appropriation,
        COALESCE(SUM(of2.obligation), 0) AS total_obligations,
        COALESCE(SUM(of2.disbursement), 0) AS total_disbursement,
        CASE WHEN SUM(of2.allotment) > 0
          THEN ROUND((SUM(of2.obligation)::numeric / SUM(of2.allotment)) * 100, 2)
          ELSE 0
        END AS utilization_rate
      FROM operation_financials of2
      JOIN university_operations uo ON uo.id = of2.operation_id
      WHERE uo.fiscal_year = ?
        AND of2.deleted_at IS NULL
        AND uo.deleted_at IS NULL`;

    const params: any[] = [fiscalYear];
    if (pillarType && pillarType !== 'ALL') {
      params.push(pillarType);
      query += ` AND uo.operation_type = ?`;
    }

    query += ` GROUP BY of2.quarter ORDER BY of2.quarter`;

    const result = await this.em.getConnection().execute(query, params);
    return { quarters: result, fiscal_year: fiscalYear };
  }

  /**
   * Phase EZ-C: Financial yearly comparison — utilization rate by pillar across years
   */
  async getFinancialYearlyComparison(years: number[]): Promise<any> {
    if (!years.length) return { years: [], pillars: [] };

    const result = await this.em.getConnection().execute(
      `
      SELECT
        uo.fiscal_year,
        uo.operation_type AS pillar_type,
        CASE WHEN SUM(of2.allotment) > 0
          THEN ROUND((SUM(of2.obligation)::numeric / SUM(of2.allotment)) * 100, 2)
          ELSE 0
        END AS utilization_rate,
        COALESCE(SUM(of2.allotment), 0) AS total_appropriation,
        COALESCE(SUM(of2.obligation), 0) AS total_obligations
      FROM operation_financials of2
      JOIN university_operations uo ON uo.id = of2.operation_id
      WHERE uo.fiscal_year IN (${years.map(() => '?').join(', ')})
        AND of2.deleted_at IS NULL
        AND uo.deleted_at IS NULL
      GROUP BY uo.fiscal_year, uo.operation_type
      ORDER BY uo.fiscal_year, uo.operation_type
    `,
      [...years],
    );

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
    const result = await this.em.getConnection().execute(
      `
      SELECT
        COALESCE(of2.expense_class, 'Unclassified') AS expense_class,
        COUNT(of2.id) AS record_count,
        COALESCE(SUM(of2.allotment), 0) AS total_appropriation,
        COALESCE(SUM(of2.obligation), 0) AS total_obligations,
        COALESCE(SUM(of2.disbursement), 0) AS total_disbursement
      FROM operation_financials of2
      JOIN university_operations uo ON uo.id = of2.operation_id
      WHERE uo.fiscal_year = ?
        AND of2.deleted_at IS NULL
        AND uo.deleted_at IS NULL
      GROUP BY of2.expense_class
      ORDER BY of2.expense_class
    `,
      [fiscalYear],
    );

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
