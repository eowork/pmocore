import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ConstructionProject } from './construction-project.entity';
import { ConstructionTimelineEntryRepository } from '../../construction-projects/repository/construction-timeline-entry.repository';

/**
 * Shapes of this table's jsonb columns.
 *
 * They live here, on the entity that persists them, and the create DTO's item classes
 * implement them — so the validated request shape and the stored shape cannot drift apart
 * without the compiler saying so. Every field is optional because these are hand-filled
 * rows in a form the user can add and leave half-blank.
 */
export interface TimelineAccomplishment {
  description?: string;
  category?: string;
  date?: string;
  percentage?: number | null;
  remarks?: string;
}

export interface TimelineSignatory {
  userId?: string;
  userName?: string;
  position?: string;
  role?: string;
  date?: string;
}

/** MPR itemised work breakdown, one row per contract line item. */
export interface TimelineWorkItem {
  itemNumber?: string;
  description?: string;
  unit?: string;
  quantity?: number | null;
  unitCost?: number | null;
  weightNumber?: number | null;
  actualPercentToDate?: number | null;
  costToDate?: number | null;
}

/** ZZZ-G: structured Project Concern, shared by WAR, MPR and timelogs. */
export interface TimelineConcern {
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
  status?: string;
  responsibleParty?: string;
  resolutionTargetDate?: string;
  actualResolutionDate?: string;
  mitigationAction?: string;
  createdBy?: string;
  createdAt?: string;
}

/**
 * Phase JW-G: Periodic project diary entries (daily/weekly/monthly/quarterly).
 * Independent of milestones — populated admin-side, consumed by the client
 * prototype's Timeline tab.
 */
// The repository is bound here so that @InjectRepository(ConstructionTimelineEntry) hands
// back ConstructionTimelineEntryRepository, with its query methods, wherever the entity's
// repository is requested.
@Entity({
  tableName: 'construction_timeline_entries',
  repository: () => ConstructionTimelineEntryRepository,
})
export class ConstructionTimelineEntry {
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

  @Property({ length: 20, default: 'WEEKLY' })
  entryType: string = 'WEEKLY';

  @Property({ columnType: 'date' })
  entryDate!: Date;

  @Property({ nullable: true, length: 100 })
  periodLabel?: string;

  @Property({ length: 255 })
  title!: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ nullable: true, length: 100 })
  weather?: string;

  @Property({ nullable: true, type: 'integer' })
  manpowerCount?: number;

  @Property({ nullable: true, columnType: 'text' })
  equipmentUsed?: string;

  @Property({ nullable: true, columnType: 'text' })
  workAccomplished?: string;

  @Property({ nullable: true, columnType: 'text' })
  issuesEncountered?: string;

  @Property({ type: 'integer', default: 0 })
  photosCount: number = 0;

  // LC-D: who filed this entry — enables evaluator vs constructor log filtering
  @Property({ nullable: true, length: 20 })
  reporterType?: string;

  // GGG-F: WAR (Weekly Accomplishment Report) fields
  @Property({ nullable: true, length: 50 })
  warNumber?: string;

  @Property({ nullable: true, columnType: 'date' })
  reportingPeriodStart?: Date;

  @Property({ nullable: true, columnType: 'date' })
  reportingPeriodEnd?: Date;

  @Property({ nullable: true, columnType: 'text' })
  personnelEquipmentConstraints?: string;

  @Property({ nullable: true, columnType: 'text' })
  mitigationMeasures?: string;

  @Property({ nullable: true, columnType: 'text' })
  lookAheadActivities?: string;

  @Property({ nullable: true, columnType: 'jsonb', default: '[]' })
  accomplishments?: TimelineAccomplishment[];

  @Property({ nullable: true, columnType: 'jsonb', default: '[]' })
  signatories?: TimelineSignatory[];

  // GGG-F: MPR (Monthly Progress Report) fields
  @Property({ nullable: true, length: 50 })
  mprNumber?: string;

  @Property({ nullable: true, columnType: 'date' })
  reportingPeriodMonth?: Date;

  @Property({ nullable: true, columnType: 'jsonb', default: '[]' })
  workItems?: TimelineWorkItem[];

  @Property({ nullable: true, columnType: 'numeric(5,2)' })
  accomplishmentSummaryPercent?: number;

  @Property({ nullable: true, columnType: 'numeric(5,2)' })
  percentTimeElapsed?: number;

  @Property({ nullable: true, columnType: 'numeric(18,2)' })
  originalContractAmount?: number;

  @Property({ nullable: true, columnType: 'numeric(18,2)' })
  revisedContractAmount?: number;

  // BBB-C: WAR/MPR financial billing fields (operational records; Progress Reports is the official source)
  @Property({ nullable: true, columnType: 'decimal(15,2)' })
  billingAmountThisPeriod?: number;

  @Property({ nullable: true, columnType: 'decimal(5,2)' })
  financialAccomplishmentPercent?: number;

  // ZZZ-G: structured Project Concerns list (shared by WAR/MPR/timelogs)
  @Property({ nullable: true, columnType: 'jsonb', default: '[]' })
  concernsList?: TimelineConcern[];

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
}
