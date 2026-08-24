import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

type ChecklistRemarkEntry = {
  text: string;
  author?: string | null;
  timestamp: string;
};

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'construction_projects' })
export class ConstructionProject {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'bigserial', unique: true })
  infraProjectUid!: number;

  @Property({ columnType: 'uuid', unique: true })
  projectId!: string;

  @Property({ length: 50, unique: true })
  projectCode!: string;

  @Property({ length: 255 })
  title!: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ nullable: true, length: 255 })
  idealInfrastructureImage?: string;

  @Property({ nullable: true, type: 'integer' })
  beneficiaries?: number;

  @Property({ nullable: true, columnType: 'text' })
  summary?: string;

  @Property({ nullable: true, columnType: 'text' })
  scope?: string;

  @Property({ nullable: true, columnType: 'text' })
  facilities?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  objectives?: any;

  @Property({ nullable: true, columnType: 'jsonb' })
  keyFeatures?: any;

  @Property({ nullable: true, length: 100 })
  originalContractDuration?: string;

  // XXX-K: Implementation Period (free-text, R-222)
  @Property({ nullable: true, length: 100 })
  implementationPeriod?: string;

  @Property({ nullable: true, length: 50 })
  contractNumber?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  contractorId?: string;

  @Property({ nullable: true, length: 255 })
  contractor?: string;

  @Property({ nullable: true, columnType: 'decimal(15,2)' })
  contractAmount?: string;

  @Property({ nullable: true, columnType: 'date' })
  startDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  targetCompletionDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  actualCompletionDate?: Date;

  @Property({ nullable: true, length: 100 })
  projectDuration?: string;

  @Property({ nullable: true, length: 255 })
  projectEngineer?: string;

  @Property({ nullable: true, length: 255 })
  projectManager?: string;

  @Property({ nullable: true, length: 100 })
  buildingType?: string;

  @Property({ nullable: true, columnType: 'decimal(10,2)' })
  floorArea?: string;

  @Property({ nullable: true, type: 'integer' })
  numberOfFloors?: number;

  // AAAK: legacy FK — kept for backward compatibility, now nullable (superseded by
  // primaryFundingSource + fundingSourceDescription two-level structure below).
  @Property({ nullable: true, columnType: 'uuid' })
  fundingSourceId?: string;

  // AAAK: Two-Level Funding — Level 1 (controlled category, used for analytics/filtering)
  @Property({ nullable: true, length: 30 })
  primaryFundingSource?: string;

  // AAAK: Two-Level Funding — Level 2 (free-text description, detailed reporting/audit)
  @Property({ nullable: true, length: 255 })
  fundingSourceDescription?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  subcategoryId?: string;

  @Property({ length: 50 })
  campus!: string;

  @Property({ length: 50 })
  status!: string;

  @Property({ nullable: true, columnType: 'decimal(9,6)' })
  latitude?: string;

  @Property({ nullable: true, columnType: 'decimal(9,6)' })
  longitude?: string;

  @Property({ columnType: 'decimal(5,2)', default: 0 })
  physicalProgress: string = '0.00';

  @Property({ columnType: 'decimal(5,2)', default: 0 })
  financialProgress: string = '0.00';

  @Property({ columnType: 'decimal(5,2)', default: 100 })
  targetPhysicalProgress: string = '100.00';

  @Property({ columnType: 'decimal(5,2)', default: 100 })
  targetFinancialProgress: string = '100.00';

  @Property({ nullable: true, columnType: 'jsonb' })
  timelineData?: any;

  @Property({ nullable: true, columnType: 'jsonb' })
  galleryImages?: any;

  @Property({ nullable: true, length: 50, default: 'PUBLISHED' })
  publicationStatus?: string;

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

  @Property({ nullable: true, columnType: 'uuid' })
  assignedTo?: string;

  @Property({ columnType: 'uuid' })
  createdBy!: string;

  @Property({ nullable: true, columnType: 'uuid' })
  updatedBy?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  metadata?: Record<string, any>;

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

  @Property({ nullable: true, columnType: 'uuid' })
  deletedBy?: string;

  // KC-C: Project Profile fields
  @Property({ nullable: true, columnType: 'text' })
  strategicAlignment?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  outputIndicators?: any;

  @Property({ nullable: true, columnType: 'jsonb' })
  outcomeIndicators?: any;

  @Property({ nullable: true, length: 255 })
  implementingAgency?: string;

  @Property({ nullable: true, length: 50 })
  projectStatusCategory?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  statusUpdates?: any;

  @Property({ nullable: true, columnType: 'jsonb' })
  readinessDocuments?: any;

  @Property({ nullable: true, columnType: 'jsonb' })
  signatories?: any;

  // KV-D2: per-group evaluator remarks for document compliance checklist
  @Property({ columnType: 'jsonb', default: '{}' })
  documentChecklistRemarks: Record<string, string | ChecklistRemarkEntry[]> =
    {};

  // AAA-F-3: per-project custom Key Document repository sections
  @Property({ columnType: 'jsonb', default: '[]' })
  customKeySections: Array<{ id: string; label: string; typeCode: string }> =
    [];

  // SSS-B: per-project custom Supporting Document repository folders (cards)
  @Property({ columnType: 'jsonb', default: '[]' })
  customSupportingSections: Array<{
    id: string;
    label: string;
    typeCode: string;
  }> = [];

  // KW-F2: project monitoring logs
  @Property({ columnType: 'jsonb', default: '[]' })
  incidentLog: any[] = [];

  // XXX-M: riskRegister/escalationRecords removed — Project Governance section removed

  // GGG-E: Others-tab data banking (additionalNotes, projectReferences[], specialInstructions, historicalReferences[], customMetadata{})
  @Property({ columnType: 'jsonb', nullable: true })
  projectNotesBanking?: {
    additionalNotes?: string;
    projectReferences?: Array<{ label: string; url?: string; notes?: string }>;
    specialInstructions?: string;
    historicalReferences?: Array<{ date: string; description: string }>;
    customMetadata?: Record<string, string>;
  };

  // MC: Location
  @Property({ nullable: true, columnType: 'varchar(500)' })
  spatialCoverage?: string;

  @Property({ nullable: true, length: 100 })
  municipality?: string;

  @Property({ nullable: true, length: 100 })
  province?: string;

  // MC: Implementation Agencies
  @Property({ nullable: true, length: 255 })
  coImplementingAgency?: string;

  @Property({ nullable: true, length: 255 })
  attachedAgency?: string;

  // MC: Revision Orders
  @Property({ nullable: true, columnType: 'date' })
  originalStartDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  revisedStartDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  originalCompletionDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  revisedCompletionDate?: Date;

  @Property({ nullable: true, length: 100 })
  revisedProjectDuration?: string;

  // MC: Progress Monitoring
  @Property({ nullable: true, columnType: 'date' })
  asOfDate?: Date;

  @Property({ nullable: true, columnType: 'decimal(15,2)' })
  costIncurredToDate?: string;

  // MC: Strategic Alignment
  @Property({ nullable: true, columnType: 'jsonb' })
  rdpAlignment?: any;

  @Property({ nullable: true, columnType: 'jsonb' })
  socioeconomicAgenda?: any;

  @Property({ nullable: true, columnType: 'jsonb' })
  csuLikhaGoals?: any;

  // QQQ: UN Sustainable Development Goals
  @Property({ nullable: true, columnType: 'jsonb' })
  sdgGoals?: any;

  // XXX-K: Historical Planning Frameworks (2017-2022)
  @Property({ nullable: true, columnType: 'jsonb' })
  rdp2017Alignment?: any;

  // Explicit fieldName: default naming strategy would map to "point_agenda10"
  // (no underscore before "10"), but the migration column is "point_agenda_10".
  @Property({
    nullable: true,
    columnType: 'jsonb',
    fieldName: 'point_agenda_10',
  })
  pointAgenda10?: any;

  // MC: Beneficiaries dynamic list
  @Property({ nullable: true, columnType: 'jsonb' })
  beneficiaryList?: any;

  // MC: Hybrid Funding
  @Property({ nullable: true, length: 20 })
  fundingSourceType?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  additionalFundingSources?: any;

  // MC: Chronological remarks log
  @Property({ columnType: 'jsonb', default: '[]' })
  remarksLog: any[] = [];

  // MC: Structured personnel groups
  @Property({ nullable: true, columnType: 'jsonb' })
  personnelGroups?: any;
}
