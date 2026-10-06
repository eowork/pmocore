import {
  Collection,
  Entity,
  Filter,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { ConstructionProjectRepository } from '../../construction-projects/repository/construction-project.repository';
import { Contractor } from './contractor.entity';
import { ConstructionDiaryEntry } from './construction-diary-entry.entity';
import { ConstructionDocumentChecklist } from './construction-document-checklist.entity';
import { ConstructionDocumentFolder } from './construction-document-folder.entity';
import { ConstructionDocumentSubmission } from './construction-document-submission.entity';
import { ConstructionGallery } from './construction-gallery.entity';
import { ConstructionMilestone } from './construction-milestone.entity';
import { ConstructionMovEntry } from './construction-mov-entry.entity';
import { ConstructionProgressReport } from './construction-progress-report.entity';
import { ConstructionRevisionOrder } from './construction-revision-order.entity';
import { ConstructionSubcategory } from './construction-subcategory.entity';
import { ConstructionTimelineEntry } from './construction-timeline-entry.entity';
import { FundingSource } from './funding-source.entity';
import { Project } from './project.entity';
import { User } from './user.entity';

type ChecklistRemarkEntry = {
  text: string;
  author?: string | null;
  timestamp: string;
};

// Phase JN-A: project_code uniqueness is a partial index (WHERE deleted_at IS NULL,
// coredata_schema.sql:3439-3442), not a plain unique constraint — a soft-deleted
// project's code must be reusable. A plain `unique: true` on the property makes
// mikro-orm's schema diff want to replace this index with a full-table unique
// constraint, silently reintroducing the reuse bug Migration20260502071146 fixed.
@Index({
  name: 'construction_projects_project_code_active_idx',
  expression:
    'CREATE UNIQUE INDEX construction_projects_project_code_active_idx ON construction_projects (project_code) WHERE deleted_at IS NULL',
})
@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
// The repository is bound here rather than registered separately so that
// @InjectRepository(ConstructionProject) hands back ConstructionProjectRepository, with its
// list query, everywhere the entity's repository is requested. The lazy callback is what
// mikro-orm expects and keeps the reference from being read at decoration time.
@Entity({
  tableName: 'construction_projects',
  repository: () => ConstructionProjectRepository,
})
export class ConstructionProject {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  // This column is a bigserial: bigint, backed by construction_projects_infra_project_uid_seq.
  //
  // An earlier attempt declared columnType 'bigserial' alone, which carries no default in
  // mikro-orm's metadata, so the differ generated a migration that dropped the DEFAULT —
  // construction project creation (raw INSERT in construction-projects.service.ts, which
  // never supplies this column) then hit a NOT NULL violation once that migration ran.
  // Spelling the default out with defaultRaw did not settle it either: mikro-orm introspects
  // a sequence-backed column as autoincrement with no default, so the entity's explicit
  // default read as a difference and the same two statements were regenerated on every diff.
  // autoincrement: true is how mikro-orm models exactly this column, and it diffs clean.
  @Property({
    columnType: 'bigint',
    unique: true,
    autoincrement: true,
  })
  infraProjectUid!: number;

  @Property({ columnType: 'uuid', unique: true })
  projectId!: string;

  @ManyToOne(() => Project, {
    fieldName: 'project_id',
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  parentProject!: Project;

  // Plain lookup index (coredata_schema.sql:3530-3533) — separate from the partial
  // unique index above (which only enforces uniqueness among non-deleted rows).
  @Index({ name: 'idx_conproj_code' })
  @Property({ length: 50 })
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

  // Named contractorRef rather than contractor because the free-text column below already
  // owns that name — it is the pre-contractors-table fallback the list query still reads.
  //
  // Every relation on this entity carries the same three options:
  // persist: false — the uuid scalar above stays the writer, so existing write paths are
  //   untouched and the column is never mapped twice on INSERT.
  // hidden: true — the relation is excluded from JSON, so endpoints that return this entity
  //   directly (findMyDrafts and the child-entity routes) serialise exactly as before.
  // createForeignKeyConstraint: false — this database has no foreign keys; declaring a
  //   relation must not make the schema differ want to add one.
  @ManyToOne(() => Contractor, {
    fieldName: 'contractor_id',
    nullable: true,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  contractorRef?: Contractor;

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

  @ManyToOne(() => FundingSource, {
    fieldName: 'funding_source_id',
    nullable: true,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  fundingSourceRef?: FundingSource;

  // AAAK: Two-Level Funding — Level 1 (controlled category, used for analytics/filtering)
  @Property({ nullable: true, length: 30 })
  primaryFundingSource?: string;

  // AAAK: Two-Level Funding — Level 2 (free-text description, detailed reporting/audit)
  @Property({ nullable: true, length: 255 })
  fundingSourceDescription?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  subcategoryId?: string;

  @ManyToOne(() => ConstructionSubcategory, {
    fieldName: 'subcategory_id',
    nullable: true,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  subcategory?: ConstructionSubcategory;

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

  @Property({ columnType: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => User, {
    fieldName: 'created_by',
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  creator!: User;

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
  // Explicit fieldName: default naming strategy would map to "rdp2017alignment"
  // (no underscore before "alignment"), but the actual column is "rdp2017_alignment"
  // (coredata_schema.sql:948) — also the name construction-projects.service.ts's raw
  // SQL hardcodes for this field.
  @Property({
    nullable: true,
    columnType: 'jsonb',
    fieldName: 'rdp2017_alignment',
  })
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

  // Inverse sides. These own no column, so they add nothing to the schema diff; hidden: true
  // keeps them out of JSON so a project serialised without populate() looks the same as it
  // always has. Load them explicitly with populate() — never with eager: true, which would
  // join on every single query that touches a project, including every write path.
  @OneToMany(() => ConstructionMilestone, (e) => e.project, { hidden: true })
  milestones = new Collection<ConstructionMilestone>(this);

  @OneToMany(() => ConstructionTimelineEntry, (e) => e.project, {
    hidden: true,
  })
  timelineEntries = new Collection<ConstructionTimelineEntry>(this);

  @OneToMany(() => ConstructionRevisionOrder, (e) => e.project, {
    hidden: true,
  })
  revisionOrders = new Collection<ConstructionRevisionOrder>(this);

  @OneToMany(() => ConstructionProgressReport, (e) => e.project, {
    hidden: true,
  })
  progressReports = new Collection<ConstructionProgressReport>(this);

  @OneToMany(() => ConstructionDocumentChecklist, (e) => e.project, {
    hidden: true,
  })
  documentChecklist = new Collection<ConstructionDocumentChecklist>(this);

  @OneToMany(() => ConstructionDocumentSubmission, (e) => e.project, {
    hidden: true,
  })
  documentSubmissions = new Collection<ConstructionDocumentSubmission>(this);

  @OneToMany(() => ConstructionDocumentFolder, (e) => e.project, {
    hidden: true,
  })
  documentFolders = new Collection<ConstructionDocumentFolder>(this);

  @OneToMany(() => ConstructionDiaryEntry, (e) => e.project, { hidden: true })
  diaryEntries = new Collection<ConstructionDiaryEntry>(this);

  @OneToMany(() => ConstructionGallery, (e) => e.project, { hidden: true })
  gallery = new Collection<ConstructionGallery>(this);

  @OneToMany(() => ConstructionMovEntry, (e) => e.project, { hidden: true })
  movEntries = new Collection<ConstructionMovEntry>(this);
}
