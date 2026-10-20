import { EntityRepository, raw } from '@mikro-orm/postgresql';
import { QueryOrder } from '@mikro-orm/core';
// Imported as a type only. The entity binds this repository back through its @Entity()
// options, so a value import here would close a runtime require cycle.
import type { User } from '../database/entities/user.entity';

/**
 * The columns the assignment pickers read, named the way Postgres returns them.
 *
 * The list is deliberately narrow. These routes are open to any authenticated user, and a
 * hydrated User carries password_hash, google_id, failed_login_attempts and the metadata
 * blob along with the five fields the picker actually shows.
 */
export interface EligibleUserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  campus: string | null;
}

export interface EligibleContractorRow extends EligibleUserRow {
  company_name: string | null;
  position: string | null;
  assignment_count: number;
}

const IDENTITY_COLUMNS = [
  raw('u.id').as('id'),
  raw('u.first_name').as('first_name'),
  raw('u.last_name').as('last_name'),
  raw('u.email').as('email'),
  raw('u.campus').as('campus'),
];

/**
 * LIKE and ILIKE read % and _ as wildcards, so an unescaped search term lets a user type `_`
 * and match every row, or `%` and defeat the filter entirely. Backslash is the default escape
 * character in Postgres, which is why no ESCAPE clause is needed alongside this.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export class UserRepository extends EntityRepository<User> {
  /**
   * Users eligible to be delegated a record: every active account regardless of role, because
   * external personnel (Contractor, Consultant) have to appear beside institutional staff.
   *
   * `search` is optional — the endpoint lists everyone when it is absent, and an empty or
   * whitespace-only term is treated the same way rather than searching for a blank string.
   */
  findEligibleForAssignment(search?: string): Promise<EligibleUserRow[]> {
    const qb = this.createQueryBuilder('u')
      .select(IDENTITY_COLUMNS)
      // The notDeleted filter is not applied automatically on the QueryBuilder the way it is
      // on find(), so the soft-delete condition is stated here.
      .where({ deletedAt: null, isActive: true })
      .orderBy({ lastName: QueryOrder.ASC, firstName: QueryOrder.ASC });

    const term = search?.trim();
    if (term) {
      // ILIKE, not LIKE: names are stored as typed, so a case-sensitive match would miss
      // "Juan" for a search of "juan".
      const pattern = `%${escapeLike(term)}%`;
      qb.andWhere({
        $or: [
          { firstName: { $ilike: pattern } },
          { lastName: { $ilike: pattern } },
          { email: { $ilike: pattern } },
        ],
      });
    }

    // mapResults = false keeps the driver's snake_case row instead of hydrating an entity,
    // which is the shape these endpoints have always answered with.
    return qb.execute('all', false);
  }

  /**
   * Users holding the Contractor role, with the two metadata fields and the construction
   * workload the Quick Assign card displays.
   *
   * The role test is raw SQL because user_roles and roles are mapped with plain scalar id
   * columns rather than relations, so there is no association for the QueryBuilder to join.
   */
  findEligibleContractors(): Promise<EligibleContractorRow[]> {
    return this.createQueryBuilder('u')
      .select([
        ...IDENTITY_COLUMNS,
        raw(`u.metadata->>'companyName'`).as('company_name'),
        raw(`u.metadata->>'position'`).as('position'),
        raw(`(SELECT COUNT(*)::int FROM record_assignments ra
               WHERE ra.user_id = u.id AND ra.module = 'CONSTRUCTION')`).as(
          'assignment_count',
        ),
      ])
      .where({ deletedAt: null, isActive: true })
      .andWhere(
        `EXISTS (SELECT 1 FROM user_roles ur
                   JOIN roles r ON ur.role_id = r.id
                  WHERE ur.user_id = u.id AND r.name = ?)`,
        ['Contractor'],
      )
      .orderBy({ lastName: QueryOrder.ASC, firstName: QueryOrder.ASC })
      .execute('all', false);
  }
}
