import { EntityRepository } from '@mikro-orm/core';
import type { FilterQuery, QueryOrderMap } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { ConstructionProject } from '../database/entities/construction-project.entity';
// The remaining entities are imported from their own files rather than the entities barrel,
// which would reach back through construction-project.entity and reopen that same cycle.
import { RecordAssignment } from '../database/entities/record-assignment.entity';
import { Role } from '../database/entities/role.entity';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/entities/user-role.entity';
import type { QueryConstructionProjectDto } from './dto';

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
    const [users, userRoles] = await Promise.all([
      em.find(User, { id: { $in: userIds } }, { filters: false }),
      em.find(UserRole, { userId: { $in: userIds } }),
    ]);

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
