import { Entity, Filter, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Filter({ name: 'notDeleted', cond: { deletedAt: null } })
@Entity({ tableName: 'operation_financials' })
export class OperationFinancial {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  operationId!: string;

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

  @Property({ nullable: true, length: 4 })
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
