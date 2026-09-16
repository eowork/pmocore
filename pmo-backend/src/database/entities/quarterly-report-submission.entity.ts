import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'quarterly_report_submissions' })
export class QuarterlyReportSubmission {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  quarterlyReportId!: string;

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

  @Property({ nullable: true, columnType: 'timestamptz' })
  submittedAt?: Date;

  @Property({ nullable: true, columnType: 'uuid' })
  reviewedBy?: string;

  @Property({ nullable: true, columnType: 'timestamptz' })
  reviewedAt?: Date;

  @Property({ nullable: true, columnType: 'text' })
  reviewNotes?: string;

  @Property({ columnType: 'uuid' })
  actionedBy!: string;

  @Property({ nullable: true, defaultRaw: 'NOW()', columnType: 'timestamptz' })
  actionedAt?: Date = new Date();

  @Property({ nullable: true, columnType: 'text' })
  reason?: string;

  @Property({ nullable: true, defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt?: Date = new Date();
}
