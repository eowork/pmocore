import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { QuarterlyReport } from './quarterly-report.entity';
import { User } from './user.entity';
import { QuarterlyReportSubmissionRepository } from '../../university-operations/repository/quarterly-report-submission.repository';

@Entity({
  tableName: 'quarterly_report_submissions',
  repository: () => QuarterlyReportSubmissionRepository,
})
export class QuarterlyReportSubmission {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  quarterlyReportId!: string;

  // Read-only views over the uuid columns, so the report's title and the three display names
  // can be eager-loaded instead of joined by hand.
  // persist: false — the scalar column stays the writer, the relation never writes.
  // hidden: true — excluded from serialisation, so no response gains a nested object.
  // createForeignKeyConstraint: false — production has no foreign keys on this table and these
  // mappings must not start emitting DDL that would add some.
  @ManyToOne(() => QuarterlyReport, {
    fieldName: 'quarterly_report_id',
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  report!: QuarterlyReport;

  @Property({ type: 'integer' })
  fiscalYear!: number;

  @Property({ length: 2 })
  quarter!: string;

  @Property({ type: 'integer', default: 1 })
  version: number = 1;

  @Property({ length: 30 })
  eventType!: string;

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

  @Property({ columnType: 'uuid' })
  actionedBy!: string;

  @ManyToOne(() => User, {
    fieldName: 'actioned_by',
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  actor?: User;

  @Property({ nullable: true, defaultRaw: 'NOW()', columnType: 'timestamptz' })
  actionedAt?: Date = new Date();

  @Property({ nullable: true, columnType: 'text' })
  reason?: string;

  @Property({ nullable: true, defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt?: Date = new Date();
}
