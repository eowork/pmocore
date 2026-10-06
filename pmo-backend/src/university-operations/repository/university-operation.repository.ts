import { EntityRepository } from '@mikro-orm/core';
import type { FilterQuery, QueryOrderMap } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { UniversityOperation } from '../../database/entities/university-operation.entity';
// The remaining entities come from their own files rather than the entities barrel, which would
// reach back through university-operation.entity and reopen that same cycle.
import { QuarterlyReport } from '../../database/entities/quarterly-report.entity';
import { RecordAssignment } from '../../database/entities/record-assignment.entity';
import { User } from '../../database/entities/user.entity';
import type { CreateOperationDto, UpdateOperationDto } from '../dto';

/** One entry of the `assigned_users` array every operation row carries. */
export interface AssignedUser {
  id: string;
  name: string;
}

/**
 * An operation serialised the way this API has always returned it: the table's own columns under
 * their snake_case names. Callers read `publication_status`, `created_by` and `status_q1`..`q4`
 * off these rows, and the frontend reads the rest, so the shape is a contract.
 */
export interface OperationColumns {
  id: string;
  operation_type: string;
  title: string;
  description: string | null;
  code: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  budget: string | null;
  campus: string;
  coordinator_id: string | null;
  created_by: string;
  updated_by: string | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
  publication_status: string;
  submitted_by: string | null;
  submitted_at: Date | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  assigned_to: string | null;
  fiscal_year: number | null;
  status_q1: string | null;
  status_q2: string | null;
  status_q3: string | null;
  status_q4: string | null;
}

/** The single-record shape: every column, plus the joined display names and assignments. */
export interface OperationDetailRow extends OperationColumns {
  created_by_name: string | null;
  submitted_by_name: string | null;
  reviewed_by_name: string | null;
  assigned_users: AssignedUser[];
}

/** The list shape — a deliberate subset of the columns, not the whole row. */
export interface OperationListRow {
  id: string;
  operation_type: string;
  title: string;
  description: string | null;
  code: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  budget: string | null;
  campus: string;
  coordinator_id: string | null;
  publication_status: string;
  created_at: Date;
  updated_at: Date;
  submitted_by: string | null;
  submitted_at: Date | null;
  created_by: string;
  status_q1: string | null;
  status_q2: string | null;
  status_q3: string | null;
  status_q4: string | null;
  fiscal_year: number | null;
  submitted_by_name: string | null;
  assigned_users: AssignedUser[];
}

export interface PendingReviewRow {
  id: string;
  code: string | null;
  title: string;
  campus: string;
  publication_status: string;
  submitted_by: string | null;
  submitted_at: Date | null;
  created_at: Date;
  submitter_name: string | null;
}

export interface DraftRow {
  id: string;
  code: string | null;
  title: string;
  campus: string;
  publication_status: string;
  submitted_at: Date | null;
  review_notes: string | null;
  created_at: Date;
}

/** What the edit-lock validators need: the operation's own status plus the quarter's. */
export interface OperationEditState {
  publication_status: string;
  fiscal_year: number | null;
  quarterly_status: string | null;
  unlocked_by: string | null;
}

export interface FindAllOperationsOptions {
  /**
   * Visibility scope, decided by the caller and applied here as handed over.
   * - 'all': no restriction (admins).
   * - 'campus': the record's campus matches, or the user created it, or is assigned to it.
   * - 'published': the record is PUBLISHED, or the user created it, or is assigned to it.
   *   Used when the user's campus does not map to a record campus.
   * - 'own-status': a non-PUBLISHED publication_status filter, narrowed to the user's own rows.
   */
  scope: 'all' | 'campus' | 'published' | 'own-status';
  userId?: string;
  recordCampus?: string | null;
  publicationStatus?: string;
}

export interface FindAllOperationsResult {
  rows: OperationListRow[];
  total: number;
}

export interface OperationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
  operation_type?: string;
  status?: string;
  campus?: string;
  coordinator_id?: string;
  fiscal_year?: number;
}

/** Updatable columns, keyed by the snake_case name the DTO uses. */
const UPDATABLE: Record<string, keyof UniversityOperation> = {
  operation_type: 'operationType',
  title: 'title',
  description: 'description',
  code: 'code',
  start_date: 'startDate',
  end_date: 'endDate',
  status: 'status',
  budget: 'budget',
  campus: 'campus',
  coordinator_id: 'coordinatorId',
  metadata: 'metadata',
  fiscal_year: 'fiscalYear',
  assigned_to: 'assignedTo',
};

/** Sortable columns, keyed by the snake_case name the query string uses. */
const SORTABLE: Record<string, keyof UniversityOperation> = {
  created_at: 'createdAt',
  title: 'title',
  status: 'status',
  start_date: 'startDate',
  end_date: 'endDate',
};

const QUARTER_STATUS: Record<string, keyof UniversityOperation> = {
  Q1: 'statusQ1',
  Q2: 'statusQ2',
  Q3: 'statusQ3',
  Q4: 'statusQ4',
};

export class UniversityOperationRepository extends EntityRepository<UniversityOperation> {
  // ─── Reads ─────────────────────────────────────────────────────────────────

  /**
   * Paginated operation list in the snake_case shape the API has always returned, with the
   * submitter's display name and the assigned_users array each row carries.
   *
   * Visibility is not decided here. The caller passes a scope and this applies it, so no filter
   * combination below can widen what the user was allowed to see.
   */
  async findAllOperations(
    query: OperationQuery,
    options: FindAllOperationsOptions,
  ): Promise<FindAllOperationsResult> {
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = query;
    const offset = (page - 1) * limit;

    const where: FilterQuery<UniversityOperation> = { deletedAt: null };

    if (query.operation_type)
      Object.assign(where, { operationType: query.operation_type });
    if (query.status) Object.assign(where, { status: query.status });
    if (query.campus) Object.assign(where, { campus: query.campus });
    if (query.coordinator_id)
      Object.assign(where, { coordinatorId: query.coordinator_id });
    if (query.fiscal_year)
      Object.assign(where, { fiscalYear: query.fiscal_year });

    await this.applyScope(where, options);

    // `id` is a tiebreaker so pagination stays deterministic when rows share a sort value.
    // Without it a row with a duplicated created_at can appear on two pages or on none, which
    // is what the previous ORDER BY with no secondary key allowed.
    const orderBy = {
      [SORTABLE[sort] ?? 'createdAt']:
        order.toLowerCase() === 'asc' ? 'asc' : 'desc',
      id: 'desc',
    } as QueryOrderMap<UniversityOperation>;
    const [operations, total] = await this.findAndCount(where, {
      // Eager-loads the submitter name the list has always shown. The relation is a read-only
      // mapping over the existing submitted_by column — see the entity.
      populate: ['submitter'],
      // filters: false — User carries a default 'notDeleted' filter, which would make the
      // populated relation resolve to null once that user is soft-deleted. The previous
      // LEFT JOIN resolved the name regardless, and a record should not lose its submitter's
      // name because that account was retired. The record's own soft-delete is in `where`.
      filters: false,
      orderBy,
      limit,
      offset,
    });
    if (operations.length === 0) return { rows: [], total };

    const assigned = await this.loadAssignedUsers(operations.map((o) => o.id));

    const rows = operations.map((o) => ({
      id: o.id,
      operation_type: o.operationType,
      title: o.title,
      description: o.description ?? null,
      code: o.code ?? null,
      start_date: dateOnly(o.startDate),
      end_date: dateOnly(o.endDate),
      status: o.status,
      budget: decimal(o.budget),
      campus: o.campus,
      coordinator_id: o.coordinatorId ?? null,
      publication_status: o.publicationStatus,
      created_at: o.createdAt,
      updated_at: o.updatedAt,
      submitted_by: o.submittedBy ?? null,
      submitted_at: o.submittedAt ?? null,
      created_by: o.createdBy,
      status_q1: o.statusQ1 ?? null,
      status_q2: o.statusQ2 ?? null,
      status_q3: o.statusQ3 ?? null,
      status_q4: o.statusQ4 ?? null,
      fiscal_year: o.fiscalYear ?? null,
      submitted_by_name: fullName(o.submitter),
      assigned_users: assigned.get(o.id) ?? [],
    }));

    return { rows, total };
  }

  /** One operation with its display names and assignments, or null when it does not exist. */
  async findDetail(id: string): Promise<OperationDetailRow | null> {
    const operation = await this.findOne(
      { id, deletedAt: null },
      { populate: ['creator', 'submitter', 'reviewer'], filters: false },
    );
    if (!operation) return null;

    const assigned = await this.loadAssignedUsers([id]);
    return {
      ...toColumns(operation),
      created_by_name: fullName(operation.creator),
      submitted_by_name: fullName(operation.submitter),
      reviewed_by_name: fullName(operation.reviewer),
      assigned_users: assigned.get(id) ?? [],
    };
  }

  /** The operation for one pillar and fiscal year, as plain columns. */
  async findForPillarYear(
    operationType: string,
    fiscalYear: number,
  ): Promise<OperationColumns | null> {
    const operation = await this.findOne(
      { operationType, fiscalYear, deletedAt: null },
      { filters: false },
    );
    return operation ? toColumns(operation) : null;
  }

  /** Who created an operation, or null when there is no live row with that id. */
  async findCreatedBy(id: string): Promise<string | null> {
    const operation = await this.findOne(
      { id, deletedAt: null },
      { fields: ['createdBy'], filters: false },
    );
    return operation?.createdBy ?? null;
  }

  /**
   * The operation's publication status together with the quarterly report governing the quarter
   * asked for. The quarterly report is joined on (fiscal_year, quarter), not on a key, so it is
   * resolved as a second lookup; quarterly_status and unlocked_by are null when there is none.
   */
  async findEditState(
    id: string,
    quarter?: string,
  ): Promise<OperationEditState | null> {
    const operation = await this.findOne(
      { id, deletedAt: null },
      { fields: ['publicationStatus', 'fiscalYear'], filters: false },
    );
    if (!operation) return null;

    const state: OperationEditState = {
      publication_status: operation.publicationStatus,
      fiscal_year: operation.fiscalYear ?? null,
      quarterly_status: null,
      unlocked_by: null,
    };
    if (!quarter || operation.fiscalYear == null) return state;

    const report = await this.getEntityManager().findOne(
      QuarterlyReport,
      { fiscalYear: operation.fiscalYear, quarter, deletedAt: null },
      { fields: ['publicationStatus', 'unlockedBy'], filters: false },
    );
    if (report) {
      state.quarterly_status = report.publicationStatus;
      state.unlocked_by = report.unlockedBy ?? null;
    }
    return state;
  }

  /**
   * Whether an operation code is already taken. `excludeId` leaves the record being updated out
   * of the check so re-saving it with its own code is not a conflict.
   */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    const where: FilterQuery<UniversityOperation> = { code, deletedAt: null };
    if (excludeId) Object.assign(where, { id: { $ne: excludeId } });
    const count = await this.count(where, { filters: false });
    return count > 0;
  }

  /** Everything awaiting review, oldest submission first. */

  async findPendingReview(): Promise<PendingReviewRow[]> {
    const operations = await this.find(
      { publicationStatus: 'PENDING_REVIEW', deletedAt: null },
      {
        populate: ['submitter'],
        filters: false,
        orderBy: { submittedAt: 'asc' },
      },
    );
    return operations.map((o) => ({
      id: o.id,
      code: o.code ?? null,
      title: o.title,
      campus: o.campus,
      publication_status: o.publicationStatus,
      submitted_by: o.submittedBy ?? null,
      submitted_at: o.submittedAt ?? null,
      created_at: o.createdAt,
      submitter_name: fullName(o.submitter),
    }));
  }

  /** A user's own unpublished records, newest first. */
  async findDraftsForUser(userId: string): Promise<DraftRow[]> {
    const operations = await this.find(
      {
        createdBy: userId,
        publicationStatus: { $in: ['DRAFT', 'PENDING_REVIEW', 'REJECTED'] },
        deletedAt: null,
      },
      { filters: false, orderBy: { createdAt: 'desc' } },
    );
    return operations.map((o) => ({
      id: o.id,
      code: o.code ?? null,
      title: o.title,
      campus: o.campus,
      publication_status: o.publicationStatus,
      submitted_at: o.submittedAt ?? null,
      review_notes: o.reviewNotes ?? null,
      created_at: o.createdAt,
    }));
  }

  // ─── Writes ────────────────────────────────────────────────────────────────

  /** Insert an operation and return it in the same column shape the INSERT used to return. */
  async createOperation(
    dto: CreateOperationDto,
    userId: string,
    publicationStatus: string,
    submittedBy: string,
    submittedAt: Date,
  ): Promise<OperationColumns> {
    const operation = this.create(
      {
        operationType: dto.operation_type,
        title: dto.title,
        description: dto.description,
        code: dto.code,
        startDate: toDate(dto.start_date),
        endDate: toDate(dto.end_date),
        status: dto.status,
        budget: dto.budget,
        campus: dto.campus,
        coordinatorId: dto.coordinator_id,
        // jsonb takes the value itself. The raw statement had to JSON.stringify it; doing that
        // here would store a quoted string instead of an object.
        metadata: dto.metadata,
        createdBy: userId,
        publicationStatus,
        submittedBy,
        submittedAt,
        assignedTo: dto.assigned_to || undefined,
        fiscalYear: dto.fiscal_year ?? undefined,
      },
      // partial: true — id, created_at and updated_at are filled by the database or the entity's
      // own defaults, and create() would otherwise demand them.
      { partial: true },
    );
    await this.getEntityManager().persist(operation).flush();
    return toColumns(operation);
  }

  /**
   * Apply a field update. Only the columns in UPDATABLE can be written, so a key that slipped
   * past validation cannot reach the SET clause the way a string-built one allowed.
   *
   * `statusReset` reproduces the deterministic state machine: editing a non-DRAFT record returns
   * it to DRAFT, clearing either the submission metadata or the review metadata depending on
   * which status it was in.
   */
  async applyUpdate(
    id: string,
    dto: UpdateOperationDto,
    userId: string,
    statusReset: 'none' | 'from-pending' | 'from-reviewed',
  ): Promise<void> {
    const operation = await this.findOne(
      { id, deletedAt: null },
      { filters: false },
    );
    if (!operation) return;

    for (const [column, property] of Object.entries(UPDATABLE)) {
      const value = (dto as Record<string, any>)[column];
      if (value === undefined) continue;
      (operation as Record<string, any>)[property] =
        property === 'startDate' || property === 'endDate'
          ? toDate(value)
          : value;
    }

    if (statusReset === 'from-pending') {
      operation.publicationStatus = 'DRAFT';
      operation.submittedBy = undefined;
      operation.submittedAt = undefined;
    } else if (statusReset === 'from-reviewed') {
      operation.publicationStatus = 'DRAFT';
      operation.reviewedBy = undefined;
      operation.reviewedAt = undefined;
      operation.reviewNotes = undefined;
      operation.submittedBy = userId;
      operation.submittedAt = new Date();
    }

    operation.updatedBy = userId;
    await this.getEntityManager().flush();
  }

  /** Soft-delete. Returns the number of rows affected (0 when the id does not exist). */
  softDelete(id: string, userId: string): Promise<number> {
    return this.nativeUpdate(
      { id },
      { deletedAt: new Date(), deletedBy: userId },
    );
  }

  // ─── Workflow transitions ──────────────────────────────────────────────────
  //
  // Each of these used to be a single UPDATE ... RETURNING *, so each returns the record's own
  // columns — no joined names, no assignments. The entity is loaded, mutated and flushed rather
  // than updated in place, because the caller needs the resulting row back.

  async markSubmittedForReview(
    id: string,
    userId: string,
  ): Promise<OperationColumns | null> {
    return this.transition(id, (o) => {
      o.publicationStatus = 'PENDING_REVIEW';
      o.submittedBy = userId;
      o.submittedAt = new Date();
      o.reviewNotes = undefined;
    });
  }

  async markPublished(
    id: string,
    adminId: string,
  ): Promise<OperationColumns | null> {
    return this.transition(id, (o) => {
      o.publicationStatus = 'PUBLISHED';
      o.reviewedBy = adminId;
      o.reviewedAt = new Date();
      o.reviewNotes = undefined;
    });
  }

  async markRejected(
    id: string,
    adminId: string,
    notes: string,
  ): Promise<OperationColumns | null> {
    return this.transition(id, (o) => {
      o.publicationStatus = 'REJECTED';
      o.reviewedBy = adminId;
      o.reviewedAt = new Date();
      o.reviewNotes = notes;
    });
  }

  async markWithdrawn(id: string): Promise<OperationColumns | null> {
    return this.transition(id, (o) => {
      o.publicationStatus = 'DRAFT';
      o.submittedBy = undefined;
      o.submittedAt = undefined;
    });
  }

  /**
   * Set one quarter's status. The quarter picks the column through QUARTER_STATUS rather than
   * being interpolated into SQL as `status_${quarter.toLowerCase()}` was.
   */
  async setQuarterStatus(
    id: string,
    quarter: string,
    status: string,
    reviewNotes?: string,
  ): Promise<OperationColumns | null> {
    const property = QUARTER_STATUS[quarter];
    if (!property) return null;
    return this.transition(id, (o) => {
      (o as Record<string, any>)[property] = status;
      if (reviewNotes !== undefined) o.reviewNotes = reviewNotes;
    });
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async transition(
    id: string,
    mutate: (operation: UniversityOperation) => void,
  ): Promise<OperationColumns | null> {
    const operation = await this.findOne(
      { id, deletedAt: null },
      { filters: false },
    );
    if (!operation) return null;
    mutate(operation);
    await this.getEntityManager().flush();
    return toColumns(operation);
  }

  /**
   * Narrow a where clause to what the caller's scope allows. Assignment is checked against the
   * set of records the user is assigned to rather than a correlated EXISTS — the set depends on
   * the user, not on the row, so one lookup answers it for the whole page.
   */
  private async applyScope(
    where: FilterQuery<UniversityOperation>,
    options: FindAllOperationsOptions,
  ): Promise<void> {
    if (options.scope === 'all') {
      if (options.publicationStatus) {
        Object.assign(where, { publicationStatus: options.publicationStatus });
      }
      return;
    }

    if (options.scope === 'own-status') {
      Object.assign(where, {
        publicationStatus: options.publicationStatus,
        createdBy: options.userId,
      });
      return;
    }

    const assignedIds = await this.assignedOperationIds(options.userId!);
    const visible: FilterQuery<UniversityOperation>[] = [
      { createdBy: options.userId },
    ];
    if (assignedIds.length > 0) visible.push({ id: { $in: assignedIds } });
    visible.push(
      options.scope === 'campus'
        ? { campus: options.recordCampus! }
        : { publicationStatus: 'PUBLISHED' },
    );
    Object.assign(where, { $or: visible });
  }

  private async assignedOperationIds(userId: string): Promise<string[]> {
    const rows = await this.getEntityManager().find(
      RecordAssignment,
      { module: 'OPERATIONS', userId },
      { fields: ['recordId'] },
    );
    return rows.map((r) => r.recordId);
  }

  /**
   * Personnel assigned to each operation on this page — the json_agg subquery the raw statement
   * built inline. An assignment whose user row is gone is dropped, matching the previous inner
   * JOIN against users.
   */
  private async loadAssignedUsers(
    operationIds: string[],
  ): Promise<Map<string, AssignedUser[]>> {
    const em = this.getEntityManager();
    const assignments = await em.find(RecordAssignment, {
      module: 'OPERATIONS',
      recordId: { $in: operationIds },
    });
    if (assignments.length === 0) return new Map();

    const userIds = [...new Set(assignments.map((a) => a.userId))];
    const users = await em.find(
      User,
      { id: { $in: userIds } },
      { filters: false },
    );
    const names = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );

    const byOperation = new Map<string, AssignedUser[]>();
    for (const a of assignments) {
      const name = names.get(a.userId);
      if (!name) continue;
      const list = byOperation.get(a.recordId) ?? [];
      list.push({ id: a.userId, name });
      byOperation.set(a.recordId, list);
    }
    return byOperation;
  }
}

/** The 31 table columns under their snake_case names — what `SELECT *` used to return. */
function toColumns(o: UniversityOperation): OperationColumns {
  return {
    id: o.id,
    operation_type: o.operationType,
    title: o.title,
    description: o.description ?? null,
    code: o.code ?? null,
    start_date: dateOnly(o.startDate),
    end_date: dateOnly(o.endDate),
    status: o.status,
    budget: decimal(o.budget),
    campus: o.campus,
    coordinator_id: o.coordinatorId ?? null,
    created_by: o.createdBy,
    updated_by: o.updatedBy ?? null,
    metadata: o.metadata ?? null,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    deleted_at: o.deletedAt ?? null,
    deleted_by: o.deletedBy ?? null,
    publication_status: o.publicationStatus,
    submitted_by: o.submittedBy ?? null,
    submitted_at: o.submittedAt ?? null,
    reviewed_by: o.reviewedBy ?? null,
    reviewed_at: o.reviewedAt ?? null,
    review_notes: o.reviewNotes ?? null,
    assigned_to: o.assignedTo ?? null,
    fiscal_year: o.fiscalYear ?? null,
    status_q1: o.statusQ1 ?? null,
    status_q2: o.statusQ2 ?? null,
    status_q3: o.statusQ3 ?? null,
    status_q4: o.statusQ4 ?? null,
  };
}

function fullName(user?: User | null): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}

/**
 * Render a DATE column as the plain YYYY-MM-DD the raw statement returned.
 *
 * The driver hands a DATE back as a Date, which would serialise as a full UTC instant and shift
 * the calendar day for anyone east or west of UTC. start_date and end_date are calendar dates,
 * not instants, and they stay that way on the wire.
 */
function dateOnly(value?: Date | string | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/**
 * numeric(15,2) comes back from the driver as a string so no cents are lost to float rounding,
 * and the raw query returned it that way. Keep it a string even when the entity types it number.
 */
function decimal(value?: number | string | null): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : value.toFixed(2);
}

function toDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}
