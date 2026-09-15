import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Phase JW-G: Periodic project diary entries (daily/weekly/monthly/quarterly).
 * Independent of milestones — populated admin-side, consumed by the client
 * prototype's Timeline tab.
 */
@Entity({ tableName: 'construction_timeline_entries' })
export class ConstructionTimelineEntry {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  projectId!: string;

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
  accomplishments?: Array<{
    description?: string;
    category?: string;
    date?: string;
    percentage?: number;
    remarks?: string;
  }>;

  @Property({ nullable: true, columnType: 'jsonb', default: '[]' })
  signatories?: Array<{
    userId?: string;
    userName?: string;
    position?: string;
    role?: string;
    date?: string;
  }>;

  // GGG-F: MPR (Monthly Progress Report) fields
  @Property({ nullable: true, length: 50 })
  mprNumber?: string;

  @Property({ nullable: true, columnType: 'date' })
  reportingPeriodMonth?: Date;

  @Property({ nullable: true, columnType: 'jsonb', default: '[]' })
  workItems?: Array<Record<string, any>>;

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
  concernsList?: Array<{
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
  }>;

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
