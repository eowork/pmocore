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
