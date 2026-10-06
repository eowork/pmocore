import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { RecordAssignmentRepository } from '../../construction-projects/repository/record-assignment.repository';

@Entity({
  tableName: 'record_assignments',
  repository: () => RecordAssignmentRepository,
})
export class RecordAssignment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 50 })
  module!: string;

  @Property({ columnType: 'uuid' })
  recordId!: string;

  @Property({ columnType: 'uuid' })
  userId!: string;

  @Property({ nullable: true, defaultRaw: 'NOW()', columnType: 'timestamptz' })
  assignedAt?: Date;

  @Property({ nullable: true, columnType: 'uuid' })
  assignedBy?: string;

  @Property({ nullable: true, length: 100 })
  role?: string;

  @Property({ nullable: true, length: 150 })
  department?: string;

  @Property({ nullable: true, length: 30 })
  phone?: string;

  // KD-D: Governance category of this personnel assignment.
  // Expected values: IMPLEMENTING / MONITORING / UNIVERSITY_OFFICIAL / OVERSIGHT.
  @Property({ nullable: true, length: 50 })
  personnelCategory?: string;

  // PA-A: Human-readable project role (distinct from system role, e.g. "Project Engineer")
  @Property({ nullable: true, length: 100 })
  projectRole?: string;

  // PA-A: Per-assignment project-level permission overrides (default: viewer-only for non-Admins)
  @Property({ columnType: 'jsonb', nullable: true })
  permissions?: Record<string, any> | null;
}
