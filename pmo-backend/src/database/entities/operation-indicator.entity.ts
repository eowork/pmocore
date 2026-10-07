import {
  Entity,
  Filter,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { OperationIndicatorRepository } from '../../university-operations/repository/operation-indicator.repository';
import { PillarIndicatorTaxonomy } from './pillar-indicator-taxonomy.entity';
import { UniversityOperation } from './university-operation.entity';

@Filter({ name: 'notDeleted', cond: { deletedAt: null } })
@Entity({
  tableName: 'operation_indicators',
  repository: () => OperationIndicatorRepository,
})
export class OperationIndicator {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  operationId!: string;

  // Read-only views over the two uuid columns, so the taxonomy metadata and the owning
  // operation can be eager-loaded instead of hand-joined.
  // persist: false — the scalar column stays the writer, the relation never writes.
  // hidden: true — excluded from serialisation, so no response gains a nested object.
  // createForeignKeyConstraint: false — production has no foreign keys on this table and these
  // mappings must not start emitting DDL that would add some.
  @ManyToOne(() => UniversityOperation, {
    fieldName: 'operation_id',
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  operation!: UniversityOperation;

  @Property({ nullable: true, columnType: 'uuid' })
  pillarIndicatorId?: string;

  // Nullable because an indicator can be orphaned — pillar_indicator_id NULL — which is why
  // every query against it was a LEFT JOIN rather than an inner one.
  @ManyToOne(() => PillarIndicatorTaxonomy, {
    fieldName: 'pillar_indicator_id',
    nullable: true,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  taxonomy?: PillarIndicatorTaxonomy;

  @Property({ length: 500 })
  particular!: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ nullable: true, length: 100 })
  indicatorCode?: string;

  @Property({ nullable: true, length: 50 })
  uacsCode?: string;

  @Property({ type: 'integer' })
  fiscalYear!: number;

  @Property({ nullable: true, length: 2 })
  reportedQuarter?: string;

  // Which campus reported these figures. One row per campus per quarter, enforced by the
  // uq_oi_campus_quarter index — see Migration20261007000000. Required, so a row can never be
  // ambiguous about whose numbers it holds.
  @Property({ length: 100 })
  campus!: string;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetQ1?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetQ2?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetQ3?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetQ4?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  accomplishmentQ1?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  accomplishmentQ2?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  accomplishmentQ3?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  accomplishmentQ4?: number;

  @Property({ nullable: true, length: 250 })
  scoreQ1?: string;

  @Property({ nullable: true, length: 250 })
  scoreQ2?: string;

  @Property({ nullable: true, length: 250 })
  scoreQ3?: string;

  @Property({ nullable: true, length: 250 })
  scoreQ4?: string;

  @Property({ nullable: true, columnType: 'date' })
  varianceAsOf?: Date;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  variance?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  averageTarget?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  averageAccomplishment?: number;

  @Property({ nullable: true, length: 20, default: 'pending' })
  status?: string;

  @Property({ nullable: true, columnType: 'text' })
  remarks?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  subcategoryData?: Record<string, any>;

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

  @Property({ nullable: true, columnType: 'numeric(6,2)' })
  overrideRate?: number;

  @Property({ nullable: true, columnType: 'numeric(6,2)' })
  overrideRateQ1?: number;

  @Property({ nullable: true, columnType: 'numeric(6,2)' })
  overrideRateQ2?: number;

  @Property({ nullable: true, columnType: 'numeric(6,2)' })
  overrideRateQ3?: number;

  @Property({ nullable: true, columnType: 'numeric(6,2)' })
  overrideRateQ4?: number;

  @Property({ nullable: true, columnType: 'numeric(8,2)' })
  overrideVariance?: number;

  @Property({ nullable: true, columnType: 'numeric(8,2)' })
  overrideVarianceQ1?: number;

  @Property({ nullable: true, columnType: 'numeric(8,2)' })
  overrideVarianceQ2?: number;

  @Property({ nullable: true, columnType: 'numeric(8,2)' })
  overrideVarianceQ3?: number;

  @Property({ nullable: true, columnType: 'numeric(8,2)' })
  overrideVarianceQ4?: number;

  @Property({ nullable: true, columnType: 'numeric(15,4)' })
  overrideTotalTarget?: number;

  @Property({ nullable: true, columnType: 'numeric(15,4)' })
  overrideTotalActual?: number;

  @Property({ nullable: true, columnType: 'text' })
  catchUpPlan?: string;

  @Property({ nullable: true, columnType: 'text' })
  facilitatingFactors?: string;

  @Property({ nullable: true, columnType: 'text' })
  waysForward?: string;

  @Property({ nullable: true, columnType: 'text' })
  mov?: string;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  numeratorQ1?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  denominatorQ1?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  numeratorQ2?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  denominatorQ2?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  numeratorQ3?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  denominatorQ3?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  numeratorQ4?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  denominatorQ4?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetNumeratorQ1?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetDenominatorQ1?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetNumeratorQ2?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetDenominatorQ2?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetNumeratorQ3?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetDenominatorQ3?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetNumeratorQ4?: number;

  @Property({ nullable: true, columnType: 'numeric(12,4)' })
  targetDenominatorQ4?: number;

  @Property({ nullable: true, columnType: 'text' })
  remarksQ1?: string;

  @Property({ nullable: true, columnType: 'text' })
  remarksQ2?: string;

  @Property({ nullable: true, columnType: 'text' })
  remarksQ3?: string;

  @Property({ nullable: true, columnType: 'text' })
  remarksQ4?: string;

  @Property({ nullable: true, columnType: 'text' })
  overrideTotalTargetFraction?: string;

  @Property({ nullable: true, columnType: 'text' })
  overrideTotalActualFraction?: string;
}
