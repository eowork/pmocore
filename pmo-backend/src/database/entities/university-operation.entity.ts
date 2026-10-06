import {
  Entity,
  Filter,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { UniversityOperationRepository } from '../../university-operations/repository/university-operation.repository';
import { User } from './user.entity';

@Filter({ name: 'notDeleted', cond: { deletedAt: null } })
@Entity({
  tableName: 'university_operations',
  repository: () => UniversityOperationRepository,
})
export class UniversityOperation {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 50 })
  operationType!: string;

  @Property({ length: 255 })
  title!: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ nullable: true, length: 50, unique: true })
  code?: string;

  @Property({ nullable: true, columnType: 'date' })
  startDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  endDate?: Date;

  @Property({ length: 20 })
  status!: string;

  @Property({ nullable: true, columnType: 'numeric(15,2)' })
  budget?: number;

  @Property({ length: 100 })
  campus!: string;

  @Property({ nullable: true, columnType: 'uuid' })
  coordinatorId?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  metadata?: Record<string, any>;

  @Property({ columnType: 'uuid' })
  createdBy!: string;

  // The three relations below are read-only views over the uuid columns above them, added so
  // the display names the API returns can be eager-loaded instead of joined by hand.
  // persist: false — the scalar column stays the writer, the relation never writes.
  // hidden: true — excluded from serialisation, so no response gains a nested user object.
  // createForeignKeyConstraint: false — production has no foreign keys on this table and these
  // mappings must not start emitting DDL that would add some.
  @ManyToOne(() => User, {
    fieldName: 'created_by',
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  creator!: User;

  @Property({ length: 20, default: 'PUBLISHED' })
  publicationStatus: string = 'PUBLISHED';

  @Property({ nullable: true, columnType: 'uuid' })
  submittedBy?: string;

  @ManyToOne(() => User, {
    fieldName: 'submitted_by',
    nullable: true,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  submitter?: User;

  @Property({ nullable: true, columnType: 'timestamptz' })
  submittedAt?: Date;

  @Property({ nullable: true, columnType: 'uuid' })
  reviewedBy?: string;

  @ManyToOne(() => User, {
    fieldName: 'reviewed_by',
    nullable: true,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  reviewer?: User;

  @Property({ nullable: true, columnType: 'timestamptz' })
  reviewedAt?: Date;

  @Property({ nullable: true, columnType: 'text' })
  reviewNotes?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  assignedTo?: string;

  @Property({ nullable: true, type: 'integer' })
  fiscalYear?: number;

  @Property({ nullable: true, length: 20, default: 'DRAFT' })
  statusQ1?: string;

  @Property({ nullable: true, length: 20, default: 'DRAFT' })
  statusQ2?: string;

  @Property({ nullable: true, length: 20, default: 'DRAFT' })
  statusQ3?: string;

  @Property({ nullable: true, length: 20, default: 'DRAFT' })
  statusQ4?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  updatedBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  deletedBy?: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({
    defaultRaw: 'NOW()',
    onUpdate: () => new Date(),
    columnType: 'timestamptz',
  })
  updatedAt: Date = new Date();

  @Property({ nullable: true, columnType: 'timestamptz' })
  deletedAt?: Date;
}
