import {
  Entity,
  Filter,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { QuarterlyReportRepository } from '../../university-operations/repository/quarterly-report.repository';
import { User } from './user.entity';

@Filter({ name: 'notDeleted', cond: { deletedAt: null } })
@Entity({
  tableName: 'quarterly_reports',
  repository: () => QuarterlyReportRepository,
})
export class QuarterlyReport {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ type: 'integer' })
  fiscalYear!: number;

  @Property({ length: 2 })
  quarter!: string;

  @Property({ nullable: true, columnType: 'text' })
  title?: string;

  @Property({ nullable: true, length: 20, default: 'DRAFT' })
  publicationStatus?: string = 'DRAFT';

  @Property({ columnType: 'uuid' })
  createdBy!: string;

  @Property({ type: 'integer', default: 0 })
  submissionCount: number = 0;

  @Property({ nullable: true, columnType: 'timestamptz' })
  submittedAt?: Date;

  @Property({ nullable: true, columnType: 'uuid' })
  submittedBy?: string;

  // Read-only views over the uuid columns above them, so the display names the API returns
  // can be eager-loaded instead of joined by hand.
  // persist: false — the scalar column stays the writer, the relation never writes.
  // hidden: true — excluded from serialisation, so no response gains a nested user object.
  // createForeignKeyConstraint: false — production has no foreign keys on this table and these
  // mappings must not start emitting DDL that would add some.
  @ManyToOne(() => User, {
    fieldName: 'submitted_by',
    nullable: true,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  submitter?: User;

  @Property({ nullable: true, columnType: 'timestamptz' })
  reviewedAt?: Date;

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

  @Property({ nullable: true, columnType: 'text' })
  reviewNotes?: string;

  @Property({ nullable: true, columnType: 'timestamptz' })
  unlockRequestedAt?: Date;

  @Property({ nullable: true, columnType: 'uuid' })
  unlockRequestedBy?: string;

  @ManyToOne(() => User, {
    fieldName: 'unlock_requested_by',
    nullable: true,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  unlockRequester?: User;

  @Property({ nullable: true, columnType: 'text' })
  unlockRequestReason?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  unlockedBy?: string;

  @ManyToOne(() => User, {
    fieldName: 'unlocked_by',
    nullable: true,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  unlocker?: User;

  @Property({ nullable: true, columnType: 'timestamptz' })
  unlockedAt?: Date;

  @Property({ nullable: true, defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt?: Date = new Date();

  @Property({
    nullable: true,
    defaultRaw: 'NOW()',
    onUpdate: () => new Date(),
    columnType: 'timestamptz',
  })
  updatedAt?: Date = new Date();

  @Property({ nullable: true, columnType: 'timestamptz' })
  deletedAt?: Date;
}
