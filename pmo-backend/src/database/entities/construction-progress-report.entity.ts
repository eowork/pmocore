import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Phase NE-A (2026-05-21): Chronological progress reports (MPR/WAR-aligned).
 * Many-to-one with construction_projects. Latest report mirrors percentage,
 * cost incurred, and as-of date back to the project record for fast display.
 */
@Entity({ tableName: 'construction_progress_reports' })
export class ConstructionProgressReport {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  projectId!: string;

  @Property({ length: 20 })
  reportType!: string; // 'MONTHLY' | 'QUARTERLY' | 'AD_HOC' | 'WEEKLY'

  @Property({ columnType: 'date' })
  reportDate!: Date;

  @Property({ nullable: true, length: 20 })
  reportNumber?: string; // e.g., 'MPR-2026-04' or 'WAR-W17'

  @Property({ columnType: 'decimal(5,2)', default: 0 })
  percentageCompletion: string = '0.00';

  @Property({ nullable: true, columnType: 'decimal(5,2)' })
  plannedAccomplishment?: string;

  @Property({ nullable: true, columnType: 'decimal(5,2)' })
  slippage?: string;

  @Property({ nullable: true, columnType: 'decimal(15,2)' })
  costIncurredToDate?: string;

  @Property({ nullable: true, columnType: 'decimal(15,2)' })
  costIncurredThisPeriod?: string;

  @Property({ nullable: true, type: 'integer' })
  calendarDaysElapsed?: number;

  @Property({ nullable: true, columnType: 'decimal(5,2)' })
  percentTimeElapsed?: string;

  @Property({ nullable: true, columnType: 'text' })
  remarks?: string;

  @Property({ nullable: true, columnType: 'text' })
  issuesEncountered?: string;

  @Property({ nullable: true, columnType: 'text' })
  mitigationActions?: string;

  @Property({ columnType: 'jsonb', nullable: true })
  narrativeList: Array<{ text: string; createdAt: string; author?: string }> =
    [];

  @Property({ columnType: 'jsonb', nullable: true })
  remarksList: Array<{ text: string; createdAt: string; author?: string }> = [];

  @Property({ columnType: 'jsonb', nullable: true })
  issuesEncounteredList: Array<{
    text: string;
    createdAt: string;
    author?: string;
  }> = [];

  @Property({ columnType: 'jsonb', nullable: true })
  mitigationActionsList: Array<{
    text: string;
    createdAt: string;
    author?: string;
  }> = [];

  @Property({ nullable: true, columnType: 'uuid' })
  movDocumentId?: string;

  @Property({ nullable: true, columnType: 'text' })
  movLink?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  createdBy?: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({
    defaultRaw: 'NOW()',
    onUpdate: () => new Date(),
    columnType: 'timestamptz',
  })
  updatedAt: Date = new Date();

  @Property({ nullable: true, columnType: 'uuid' })
  updatedBy?: string;
}
