import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ConstructionProject } from './construction-project.entity';
import {
  ConstructionProgressReportRepository
} from '../../construction-projects/repository/construction-progress-report.repository';

/**
 * Phase NE-A (2026-05-21): Chronological progress reports (MPR/WAR-aligned).
 * Many-to-one with construction_projects. Latest report mirrors percentage,
 * cost incurred, and as-of date back to the project record for fast display.
 */
@Entity({
  tableName: 'construction_progress_reports',
  repository: () => ConstructionProgressReportRepository,
})
export class ConstructionProgressReport {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  projectId!: string;

  // Read-only link back to the owning project, so queries can populate() the parent.
  //
  // persist: false — project_id stays owned by the projectId scalar above, which every
  //   existing write path sets. Two properties mapping one column collide on INSERT.
  // hidden: true — keeps the relation out of JSON, so endpoints returning this entity
  //   directly serialise exactly as they did before.
  // createForeignKeyConstraint: false — this database has no foreign keys; declaring a
  //   relation must not make the schema differ want to add one.
  @ManyToOne(() => ConstructionProject, {
    fieldName: 'project_id',
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  project!: ConstructionProject;

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

  @Property({ columnType: 'jsonb', default: '[]' })
  narrativeList: Array<{ text: string; createdAt: string; author?: string }> =
    [];

  @Property({ columnType: 'jsonb', default: '[]' })
  remarksList: Array<{ text: string; createdAt: string; author?: string }> = [];

  @Property({ columnType: 'jsonb', default: '[]' })
  issuesEncounteredList: Array<{
    text: string;
    createdAt: string;
    author?: string;
  }> = [];

  @Property({ columnType: 'jsonb', default: '[]' })
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
