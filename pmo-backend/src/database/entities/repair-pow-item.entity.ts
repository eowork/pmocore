import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'repair_pow_items' })
export class RepairPowItem {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  repairProjectId!: string;

  @Property({ length: 50 })
  itemNumber!: string;

  @Property({ columnType: 'text' })
  description!: string;

  @Property({ length: 20 })
  unit!: string;

  @Property({ columnType: 'decimal(15,2)' })
  quantity!: string;

  @Property({ columnType: 'decimal(15,2)' })
  estimatedMaterialCost!: string;

  @Property({ columnType: 'decimal(15,2)' })
  estimatedLaborCost!: string;

  @Property({ columnType: 'decimal(15,2)' })
  estimatedProjectCost!: string;

  @Property({ columnType: 'decimal(15,2)' })
  unitCost!: string;

  @Property({ type: 'boolean', default: false, nullable: true })
  isUnitCostOverridden?: boolean = false;

  @Property({ columnType: 'date' })
  dateEntry!: Date;

  @Property({ nullable: true, length: 50, default: 'Active' })
  status?: string = 'Active';

  @Property({ nullable: true, columnType: 'text' })
  remarks?: string;

  @Property({ length: 100 })
  category!: string;

  @Property({ length: 100 })
  phase!: string;

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
}
