import {
  Entity,
  Enum,
  Filter,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { OperationFinancialRepository } from '../../university-operations/repository/operation-financial.repository';
import { UniversityOperation } from './university-operation.entity';

@Filter({ name: 'notDeleted', cond: { deletedAt: null } })
@Entity({
  tableName: 'operation_financials',
  repository: () => OperationFinancialRepository,
})
export class OperationFinancial {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  operationId!: string;

  // Read-only view over the uuid column above, so the owning operation's pillar and fiscal
  // year can be joined by the analytics queries instead of being hand-joined.
  // persist: false — the scalar column stays the writer, the relation never writes.
  // hidden: true — excluded from serialisation, so no response gains a nested object.
  // createForeignKeyConstraint: false — production has no foreign keys on this table and this
  // mapping must not start emitting DDL that would add one.
  @ManyToOne(() => UniversityOperation, {
    fieldName: 'operation_id',
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  operation!: UniversityOperation;

  @Property({ type: 'integer' })
  fiscalYear!: number;

  @Property({ nullable: true, length: 2 })
  quarter?: string;

  @Property({ length: 255 })
  operationsPrograms!: string;

  @Property({ nullable: true, length: 255 })
  department?: string;

  @Property({ nullable: true, length: 100 })
  budgetSource?: string;

  @Property({ nullable: true, length: 50 })
  fundType?: string;

  // Plain lookup index (coredata_schema.sql:3936-3939).
  @Index({ name: 'idx_of_project_code' })
  @Property({ nullable: true, length: 50 })
  projectCode?: string;

  // varchar(4) guarded by the chk_expense_class CHECK constraint — see the note on
  // ConstructionDocumentChecklist.submissionStatus for why this must be declared as an enum.
  @Enum({
    items: ['PS', 'MOOE', 'CO'],
    columnType: 'varchar(4)',
    nullable: true,
  })
  expenseClass?: string;

  @Property({ nullable: true, columnType: 'numeric(15,2)' })
  allotment?: number;

  @Property({ nullable: true, columnType: 'numeric(15,2)' })
  target?: number;

  @Property({ nullable: true, columnType: 'numeric(15,2)', default: 0 })
  obligation?: number;

  @Property({ nullable: true, columnType: 'numeric(15,2)', default: 0 })
  disbursement?: number;

  @Property({ nullable: true, columnType: 'numeric(5,2)' })
  utilizationPerTarget?: number;

  @Property({ nullable: true, columnType: 'numeric(5,2)' })
  utilizationPerApprovedBudget?: number;

  @Property({ nullable: true, columnType: 'numeric(5,2)' })
  disbursementRate?: number;

  @Property({ nullable: true, columnType: 'numeric(15,2)' })
  balance?: number;

  @Property({ nullable: true, columnType: 'numeric(15,2)' })
  variance?: number;

  @Property({ nullable: true, length: 255 })
  performanceIndicator?: string;

  @Property({ nullable: true, length: 20, default: 'active' })
  status?: string;

  @Property({ nullable: true, columnType: 'text' })
  remarks?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  metadata?: Record<string, any>;

  @Property({ nullable: true, columnType: 'uuid' })
  createdBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  updatedBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  deletedBy?: string;

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
}
