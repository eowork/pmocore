import { EntityRepository, raw } from '@mikro-orm/postgresql';
import type { FilterQuery, QueryOrderMap } from '@mikro-orm/core';
import { assignColumns, toRow } from '../../common/repository/entity-row';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { ConstructionProject } from '../../database/entities/construction-project.entity';
// The remaining entities are imported from their own files rather than the entities barrel,
// which would reach back through construction-project.entity and reopen that same cycle.
import { RecordAssignment } from '../../database/entities/record-assignment.entity';
import { Role } from '../../database/entities/role.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import type { QueryConstructionProjectDto } from '../dto';

const ENTITY = 'ConstructionProject';

// Aggregates shared by the analytics below. SUM over a numeric column is NULL when no row
// matched, which is why each is wrapped in COALESCE — the dashboard expects 0, not null.
const COUNT = raw('COUNT(*)').as('count');
const SUM_CONTRACT = raw('COALESCE(SUM(cp.contract_amount), 0)').as(
  'total_contract',
);
const AVG_PROGRESS = raw('COALESCE(AVG(cp.physical_progress), 0)').as(
  'avg_progress',
);

// Sortable columns, keyed by the snake_case name the query string uses and mapped to the
// entity property the ORM orders by. Anything not on this list falls back to created_at.
const SORTABLE: Record<string, keyof ConstructionProject> = {
  created_at: 'createdAt',
  title: 'title',
  status: 'status',
  start_date: 'startDate',
  target_completion_date: 'targetCompletionDate',
  physical_progress: 'physicalProgress',
};

export interface FindAllConstructionProjectOptions {
  // When set, the result is restricted to projects this user is explicitly assigned to.
  // The caller owns the policy decision (QD-C contractor isolation); the repository only
  // applies the restriction it is handed.
  restrictToAssignedUserId?: string | null;
}

export interface FindAllConstructionProjectResult {
  rows: any[];
  total: number;
}

interface AssignedUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  department?: string | null;
  phone?: string | null;
  personnel_category?: string | null;
  project_role?: string | null;
  permissions?: Record<string, any> | null;
  user_role: string | null;
}

export class ConstructionProjectRepository extends EntityRepository<ConstructionProject> {
  /**
   * Paginated project list in the snake_case shape the API has always returned, including the
   * joined display names (funding source, contractor, submitter) and the assigned_users array
   * each row carries.
   *
   * The entity graph has no relations — every foreign key on ConstructionProject is a plain
   * uuid property — so the related rows cannot be reached with populate. They are instead
   * fetched in one batched query per table, keyed by the ids on the current page, and stitched
   * together in memory. That is a fixed six queries regardless of page size, not an N+1.
   */
  async findAllConstructionProject(
    query: QueryConstructionProjectDto,
    options: FindAllConstructionProjectOptions = {},
  ): Promise<FindAllConstructionProjectResult> {
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = query;
    const offset = (page - 1) * limit;
    const em = this.getEntityManager();

    const queryAny = query as any;
    const where: FilterQuery<ConstructionProject> = {
      ...(queryAny.publication_status
        ? { publicationStatus: queryAny.publication_status }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.campus ? { campus: query.campus } : {}),
      ...(query.contractor_id ? { contractorId: query.contractor_id } : {}),
      ...(query.funding_source_id
        ? { fundingSourceId: query.funding_source_id }
        : {}),
      // AAAK: Two-Level Funding filters — primary (controlled Level-1 exact match) +
      // description (free-text Level-2 partial match).
      ...(query.primary_funding_source
        ? { primaryFundingSource: query.primary_funding_source }
        : {}),
      ...(query.funding_source_description
        ? {
            fundingSourceDescription: {
              $ilike: `%${query.funding_source_description}%`,
            },
          }
        : {}),
    };

    // Record scoping, when the caller asks for it. Without a relation to traverse this is
    // resolved as an id set rather than an EXISTS subquery, and it is ANDed into the same
    // where object as every filter above, so no filter combination can widen the scope.
    if (options.restrictToAssignedUserId) {
      const assigned = await em.find(
        RecordAssignment,
        { module: 'CONSTRUCTION', userId: options.restrictToAssignedUserId },
        { fields: ['recordId'] },
      );
      if (assigned.length === 0) return { rows: [], total: 0 };
      Object.assign(where, { id: { $in: assigned.map((a) => a.recordId) } });
    }

    // Soft-deleted projects are normally excluded by the entity's default 'notDeleted'
    // filter, but filters are switched off below, so the condition is stated here instead.
    Object.assign(where, { deletedAt: null });

    // `id` is a tiebreaker so pagination stays deterministic when rows share a sort value.
    const orderBy = {
      [SORTABLE[sort] ?? 'createdAt']:
        order.toLowerCase() === 'asc' ? 'asc' : 'desc',
      id: 'desc',
    } as QueryOrderMap<ConstructionProject>;

    const [projects, total] = await this.findAndCount(where, {
      // Eager-loads the three display names the list has always shown. The relations are
      // read-only mappings over the existing uuid columns — see the entity.
      populate: ['contractorRef', 'fundingSourceRef', 'submitter'],
      // filters: false — Contractor, FundingSource and User each carry a default
      // 'notDeleted' filter, which would make a populated relation resolve to null once the
      // referenced row is soft-deleted. The previous LEFT JOIN resolved these names
      // regardless, and a project should not lose its contractor's name because that
      // contractor was retired. The project's own soft-delete condition is in `where` above.
      filters: false,
      orderBy,
      limit,
      offset,
    });
    if (projects.length === 0) return { rows: [], total };

    // Assigned personnel is the one association that cannot be a relation: record_assignments
    // is polymorphic (CONSTRUCTION / REPAIR / OPERATIONS all share record_id), so there is
    // nothing for an @OneToMany to point at. It stays a batched manual join.
    const assignments = await this.loadAssignments(projects);
    const users = await this.loadUserNames(assignments.map((a) => a.userId));
    const assignedUsers = this.groupAssignedUsers(assignments, users);

    const rows = projects.map((p) => ({
      id: p.id,
      infra_project_uid: p.infraProjectUid,
      project_id: p.projectId,
      project_code: p.projectCode,
      title: p.title,
      description: p.description,
      status: p.status,
      campus: p.campus,
      start_date: dateOnly(p.startDate),
      target_completion_date: dateOnly(p.targetCompletionDate),
      physical_progress: p.physicalProgress,
      financial_progress: p.financialProgress,
      contract_amount: p.contractAmount,
      contractor_id: p.contractorId,
      funding_source_id: p.fundingSourceId,
      publication_status: p.publicationStatus,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      project_duration: p.projectDuration,
      submitted_by: p.submittedBy,
      submitted_at: p.submittedAt,
      original_start_date: dateOnly(p.originalStartDate),
      revised_start_date: dateOnly(p.revisedStartDate),
      original_completion_date: dateOnly(p.originalCompletionDate),
      revised_completion_date: dateOnly(p.revisedCompletionDate),
      primary_funding_source: p.primaryFundingSource,
      funding_source_description: p.fundingSourceDescription,
      funding_source_name: p.fundingSourceRef?.name ?? null,
      // The free-text `contractor` column is the fallback for projects recorded before the
      // contractors table existed, matching the previous COALESCE(c.name, cp.contractor).
      contractor_name: p.contractorRef?.name ?? p.contractor ?? null,
      submitted_by_name: p.submitter
        ? `${p.submitter.firstName} ${p.submitter.lastName}`
        : null,
      assigned_users: assignedUsers.get(p.id) ?? [],
    }));

    return { rows, total };
  }

  /**
   * One project with everything the detail endpoint has always returned: its own columns, the
   * display names reached through its relations, and the assigned personnel.
   *
   * The six LEFT JOINs are populated relations — see the entity — and the json_agg subquery
   * becomes the same batched lookup the list already uses, so the two agree on what an
   * assigned user looks like.
   */
  async findDetail(id: string): Promise<Record<string, any> | null> {
    const project = await this.findOne(
      { id, deletedAt: null },
      {
        populate: [
          'parentProject',
          'contractorRef',
          'fundingSourceRef',
          'creator',
          'submitter',
          'reviewer',
        ],
        // filters: false — the related rows each carry a default 'notDeleted' filter, which
        // would blank a name once that row is soft-deleted. The joins resolved them
        // regardless, and a project should not lose its contractor's name because that
        // contractor was retired. The project's own soft-delete is in the where above.
        filters: false,
      },
    );
    if (!project) return null;

    const assignments = await this.loadAssignments([project]);
    const users = await this.loadUserNames(assignments.map((a) => a.userId));

    return {
      ...toRow(this.getEntityManager(), ENTITY, project),
      project_title: project.parentProject?.title ?? null,
      project_type: project.parentProject?.projectType ?? null,
      contractor_name: project.contractorRef?.name ?? null,
      funding_source_name: project.fundingSourceRef?.name ?? null,
      created_by_name: fullName(project.creator),
      submitted_by_name: fullName(project.submitter),
      reviewed_by_name: fullName(project.reviewer),
      assigned_users: this.groupAssignedUsers(assignments, users).get(id) ?? [],
    };
  }

  /** Who created a project, or null when there is no live row with that id. */
  async findCreatedBy(id: string): Promise<string | null> {
    const project = await this.findOne(
      { id, deletedAt: null },
      { fields: ['createdBy'], filters: false },
    );
    return project?.createdBy ?? null;
  }

  /**
   * Whether a project code is already taken. `excludeId` leaves the record being updated out,
   * so re-saving it with its own code is not a conflict.
   */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    const where: FilterQuery<ConstructionProject> = {
      projectCode: code,
      deletedAt: null,
    };
    if (excludeId) Object.assign(where, { id: { $ne: excludeId } });
    return (await this.count(where, { filters: false })) > 0;
  }

  /** Everything awaiting review, oldest submission first. */
  async findPendingReview(): Promise<Record<string, any>[]> {
    const projects = await this.find(
      { publicationStatus: 'PENDING_REVIEW', deletedAt: null },
      {
        populate: ['submitter'],
        filters: false,
        orderBy: { submittedAt: 'asc', id: 'asc' },
      },
    );
    return projects.map((p) => ({
      id: p.id,
      project_code: p.projectCode,
      title: p.title,
      campus: p.campus,
      publication_status: p.publicationStatus,
      submitted_by: p.submittedBy ?? null,
      submitted_at: p.submittedAt ?? null,
      created_at: p.createdAt,
      submitter_name: fullName(p.submitter),
    }));
  }

  /**
   * Write the supplied columns onto a project. Only real columns of the entity can be written,
   * so a key that slipped past validation cannot reach the SET clause the way a string-built
   * one allowed. Returns the column names actually written.
   */
  async applyUpdate(
    id: string,
    dto: Record<string, any>,
    userId: string,
    statusReset: 'none' | 'from-pending' | 'from-reviewed',
  ): Promise<string[] | null> {
    const project = await this.findOne(
      { id, deletedAt: null },
      { filters: false },
    );
    if (!project) return null;

    const { applied } = assignColumns(
      this.getEntityManager(),
      ENTITY,
      project,
      dto,
      // assigned_user_ids and assignments are personnel, written through
      // RecordAssignmentRepository rather than as columns on this row.
      ['assigned_user_ids', 'assignments', 'publication_status'],
    );

    if (statusReset === 'from-pending') {
      project.publicationStatus = 'DRAFT';
      project.submittedBy = undefined;
      project.submittedAt = undefined;
    } else if (statusReset === 'from-reviewed') {
      project.publicationStatus = 'DRAFT';
      project.reviewedBy = undefined;
      project.reviewedAt = undefined;
      project.reviewNotes = undefined;
      project.submittedBy = userId;
      project.submittedAt = new Date();
    }

    project.updatedBy = userId;
    await this.getEntityManager().flush();
    return applied;
  }

  /** Soft-delete. Returns the number of rows affected (0 when the id does not exist). */
  softDelete(id: string, userId: string): Promise<number> {
    return this.nativeUpdate(
      { id },
      { deletedAt: new Date(), deletedBy: userId },
    );
  }

  // ─── Analytics ─────────────────────────────────────────────────────────────
  //
  // GROUP BY aggregations that find() cannot express, built with the query builder. The only
  // inline SQL is the fixed aggregate expressions; nothing a caller supplies reaches them.

  /** Project counts and contract totals, grouped every way the dashboard shows them. */
  async getAnalytics(): Promise<{
    byStatus: Record<string, any>[];
    byCampus: Record<string, any>[];
    byPublication: Record<string, any>[];
    totals: Record<string, any>;
    byFundingSource: Record<string, any>[];
    byContractor: Record<string, any>[];
  }> {
    const live = () => this.createQueryBuilder('cp').where({ deletedAt: null });

    const [
      byStatus,
      byCampus,
      byPublication,
      totalsRows,
      byFundingSource,
      byContractor,
    ] = await Promise.all([
      live()
        .select([raw('cp.status').as('status'), COUNT, SUM_CONTRACT])
        .groupBy('cp.status')
        .orderBy({ [raw('count')]: 'desc' })
        .execute('all', false),
      live()
        .select([
          raw('cp.campus').as('campus'),
          COUNT,
          SUM_CONTRACT,
          AVG_PROGRESS,
        ])
        .groupBy('cp.campus')
        .orderBy({ [raw('count')]: 'desc' })
        .execute('all', false),
      live()
        .select([raw('cp.publication_status').as('publication_status'), COUNT])
        .groupBy('cp.publicationStatus')
        .execute('all', false),
      live()
        .select([
          raw('COUNT(*)').as('total'),
          raw('COALESCE(SUM(cp.contract_amount), 0)').as(
            'total_contract_value',
          ),
          AVG_PROGRESS,
          raw(`COUNT(*) FILTER (
              WHERE cp.status = 'ONGOING'
                AND cp.physical_progress::numeric < cp.target_physical_progress::numeric
            )`).as('delayed_count'),
        ])
        .execute('all', false),
      // AAAK: grouped by the controlled Level-1 category so descriptive Level-2 variants
      // ("GAA FY2025", "GAA Savings") all roll up under their category.
      live()
        .select([
          raw(`COALESCE(cp.primary_funding_source, 'OTHER')`).as(
            'primary_funding_source',
          ),
          COUNT,
          SUM_CONTRACT,
        ])
        .groupBy(raw(`COALESCE(cp.primary_funding_source, 'OTHER')`) as any)
        .orderBy({ [raw('count')]: 'desc' })
        .execute('all', false),
      // MMM-A: the column is `contractor` (free text), not contractor_name.
      live()
        .andWhere({ contractor: { $ne: null } })
        .select([
          raw('cp.contractor').as('contractor_name'),
          COUNT,
          SUM_CONTRACT,
        ])
        .groupBy('cp.contractor')
        .orderBy({ [raw('count')]: 'desc' })
        .limit(10)
        .execute('all', false),
    ]);

    return {
      byStatus,
      byCampus,
      byPublication,
      totals: totalsRows[0],
      byFundingSource,
      byContractor,
    };
  }

  /**
   * Contract value against cost actually incurred, across every live project.
   *
   * This stays SQL. It opens with DISTINCT ON to take each project's most recent progress
   * report before summing, which neither find() nor the query builder can express, and
   * rewriting it in memory would mean loading every report to pick one per project. It lives
   * here rather than in the service so the service holds no SQL.
   */
  async getFinancialTotals(): Promise<Record<string, any>> {
    const em = this.getEntityManager();
    const rows = await em.getConnection().execute(
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
      [],
      'all',
      em.getTransactionContext(),
    );
    return rows[0];
  }

  private loadAssignments(
    projects: ConstructionProject[],
  ): Promise<RecordAssignment[]> {
    return this.getEntityManager().find(RecordAssignment, {
      module: 'CONSTRUCTION',
      recordId: { $in: projects.map((p) => p.id) },
    });
  }

  /**
   * Display name, email and system role for each assigned user on this page. A user's system
   * role lives two tables away (user_roles, then roles) and is not reachable from the
   * assignment, so it is resolved here rather than through a relation.
   */
  private async loadUserNames(
    ids: (string | undefined | null)[],
  ): Promise<
    Map<string, { name: string; email: string; role: string | null }>
  > {
    const userIds = unique(ids);
    if (userIds.length === 0) return new Map();

    const em = this.getEntityManager();
    const usersQuery = em.find(
      User,
      { id: { $in: userIds } },
      { filters: false },
    );
    const userRolesQuery = em.find(UserRole, { userId: { $in: userIds } });
    const users = await usersQuery;
    const userRoles = await userRolesQuery;

    const roleNames = new Map<string, string>();
    const roleIds = unique(userRoles.map((ur) => ur.roleId));
    if (roleIds.length > 0) {
      const roles = await em.find(
        Role,
        { id: { $in: roleIds } },
        { filters: false },
      );
      for (const r of roles) roleNames.set(r.id, r.name);
    }

    // One role per user, matching the LIMIT 1 the previous subquery used. A user with several
    // roles resolves to whichever row comes back first, exactly as before.
    const roleByUser = new Map<string, string>();
    for (const ur of userRoles) {
      if (!roleByUser.has(ur.userId)) {
        const name = roleNames.get(ur.roleId);
        if (name) roleByUser.set(ur.userId, name);
      }
    }

    return new Map(
      users.map((u) => [
        u.id,
        {
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          role: roleByUser.get(u.id) ?? null,
        },
      ]),
    );
  }

  /**
   * Personnel assigned to each project on this page — the json_agg subquery the raw statement
   * used to build inline. An assignment whose user row is gone is dropped, matching the
   * previous inner JOIN against users.
   */
  private groupAssignedUsers(
    assignments: RecordAssignment[],
    users: Map<string, { name: string; email: string; role: string | null }>,
  ): Map<string, AssignedUser[]> {
    const byProject = new Map<string, AssignedUser[]>();
    for (const a of assignments) {
      const u = users.get(a.userId);
      if (!u) continue;
      const list = byProject.get(a.recordId) ?? [];
      list.push({
        id: a.userId,
        name: u.name,
        email: u.email,
        role: a.role ?? null,
        department: a.department ?? null,
        phone: a.phone ?? null,
        personnel_category: a.personnelCategory ?? null,
        project_role: a.projectRole ?? null,
        permissions: a.permissions ?? null,
        user_role: u.role,
      });
      byProject.set(a.recordId, list);
    }
    return byProject;
  }
}

function fullName(
  user?: { firstName: string; lastName: string } | null,
): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}

function unique(values: (string | undefined | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}

/**
 * Render a DATE column as the plain YYYY-MM-DD the raw statement used to return.
 *
 * The ORM hydrates a DATE into a Date, which would serialise as a full UTC instant. The COI
 * list page compares these values as strings — `p.startDate <= filterDateTo` in
 * pages/coi/index.vue — and "2020-11-05T00:00:00.000Z" <= "2020-11-05" is false, so a project
 * would drop out of its own start date's range. These are calendar dates, not instants, and
 * they stay that way on the wire.
 */
function dateOnly(value?: Date | string | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
