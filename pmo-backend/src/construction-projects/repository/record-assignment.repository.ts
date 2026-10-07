import { EntityRepository } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { RecordAssignment } from '../../database/entities/record-assignment.entity';

/**
 * record_assignments is polymorphic: CONSTRUCTION, REPAIR and OPERATIONS rows all share the
 * record_id column and are told apart only by `module`. Every method here therefore takes the
 * module as its first argument — there is no safe default, and omitting it would let one
 * module read or delete another's assignments.
 */
export class RecordAssignmentRepository extends EntityRepository<RecordAssignment> {
  /** Every assignment on one record, in no particular order. */
  findForRecord(module: string, recordId: string): Promise<RecordAssignment[]> {
    return this.find({ module, recordId });
  }

  /** The one assignment joining a user to a record, or null when there is none. */
  findUserAssignment(
    module: string,
    recordId: string,
    userId: string,
  ): Promise<RecordAssignment | null> {
    return this.findOne({ module, recordId, userId });
  }

  /** Whether a user is assigned to a record. Counts rather than hydrating the row. */
  async isUserAssigned(
    module: string,
    recordId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.count({ module, recordId, userId });
    return count > 0;
  }

  /** The ids of every record a user is assigned to within one module. */
  async findAssignedRecordIds(
    module: string,
    userId: string,
  ): Promise<string[]> {
    const rows = await this.find({ module, userId }, { fields: ['recordId'] });
    return rows.map((r) => r.recordId);
  }

  /**
   * Assign a user to a record, returning the existing assignment untouched when there already
   * is one. The table has no unique constraint on (module, record_id, user_id), so the check is
   * what keeps a repeated call from inserting a duplicate.
   */
  async assignUser(
    module: string,
    recordId: string,
    userId: string,
    assignedBy: string,
  ): Promise<RecordAssignment> {
    const existing = await this.findUserAssignment(module, recordId, userId);
    if (existing) return existing;

    const assignment = this.create({
      module,
      recordId,
      userId,
      assignedBy,
      assignedAt: new Date(),
    });
    await this.getEntityManager().persist(assignment).flush();
    return assignment;
  }

  /**
   * The permission map a user holds on one record, or null when they hold no assignment.
   *
   * A null permissions column is returned as null rather than an empty object, so a caller can
   * tell "assigned with nothing granted" apart from "not assigned" — the two have different
   * meanings in the deny-by-default checks.
   */
  async findPermissions(
    module: string,
    recordId: string,
    userId: string,
  ): Promise<Record<string, any> | null> {
    const assignment = await this.findOne({ module, recordId, userId });
    return assignment?.permissions ?? null;
  }

  /** Every record a user is assigned to within one module, with the permissions on each. */
  async findAssignmentsForUser(
    module: string,
    userId: string,
  ): Promise<{ recordId: string; permissions: Record<string, any> | null }[]> {
    const rows = await this.find({ module, userId });
    return rows.map((r) => ({
      recordId: r.recordId,
      permissions: r.permissions ?? null,
    }));
  }

  /**
   * Create a user's assignment or update the one that exists, metadata and all.
   *
   * This replaces an INSERT ... ON CONFLICT (module, record_id, user_id) DO UPDATE, which the
   * database cannot run: record_assignments carries only a primary key on id, so Postgres
   * rejects that statement with 42P10 and creating a project with any assignment failed. The
   * lookup here does the same job without needing the index.
   */
  async upsertAssignment(
    module: string,
    recordId: string,
    userId: string,
    metadata: {
      role?: string | null;
      department?: string | null;
      phone?: string | null;
      personnelCategory?: string | null;
      projectRole?: string | null;
      permissions?: Record<string, any> | null;
    } = {},
  ): Promise<RecordAssignment> {
    const existing = await this.findUserAssignment(module, recordId, userId);
    const assignment =
      existing ??
      this.create({ module, recordId, userId, assignedAt: new Date() });

    assignment.role = metadata.role ?? undefined;
    assignment.department = metadata.department ?? undefined;
    assignment.phone = metadata.phone ?? undefined;
    assignment.personnelCategory = metadata.personnelCategory ?? undefined;
    assignment.projectRole = metadata.projectRole ?? undefined;
    assignment.permissions = metadata.permissions ?? null;

    if (!existing) this.getEntityManager().persist(assignment);
    await this.getEntityManager().flush();
    return assignment;
  }

  /**
   * Assign a user if they are not assigned already, leaving an existing row untouched.
   *
   * This replaces an INSERT ... DO NOTHING, which fails for the same reason as above. Unlike
   * assignUser it records no assignedBy, matching the statement it replaces.
   */
  async ensureAssignment(
    module: string,
    recordId: string,
    userId: string,
  ): Promise<RecordAssignment> {
    const existing = await this.findUserAssignment(module, recordId, userId);
    if (existing) return existing;

    const assignment = this.create({ module, recordId, userId });
    await this.getEntityManager().persist(assignment).flush();
    return assignment;
  }

  /** Remove one user's assignment. Returns the number of rows deleted (0 or 1). */
  removeAssignment(
    module: string,
    recordId: string,
    userId: string,
  ): Promise<number> {
    return this.nativeDelete({ module, recordId, userId });
  }

  /**
   * Replace the whole assignment set for a record. Idempotent: the existing rows are deleted
   * first, so calling this twice with the same ids leaves the same state. Metadata columns
   * (role, department, phone) are not written here — this is the plain user-id form.
   */
  async replaceAssignments(
    module: string,
    recordId: string,
    userIds: string[],
  ): Promise<void> {
    await this.nativeDelete({ module, recordId });
    if (userIds.length === 0) return;

    const assignments = userIds.map((userId) =>
      this.create({ module, recordId, userId }),
    );
    await this.getEntityManager().persist(assignments).flush();
  }
}
