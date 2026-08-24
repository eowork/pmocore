import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Phase ND-A (2026-05-21): Audit-tracked revision orders (VOR/CTE/WSO/WRO/etc.).
 * Many-to-one with construction_projects. Latest APPROVED revision mirrors
 * dates and duration back to the project record for fast listing/display.
 */
@Entity({ tableName: 'construction_revision_orders' })
export class ConstructionRevisionOrder {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  projectId!: string;

  @Property({ type: 'integer' })
  revisionNumber!: number;

  @Property({ length: 50 })
  revisionType!: string; // 'VOR' | 'CTE' | 'WSO' | 'WRO' | 'OTHER'

  @Property({ columnType: 'date' })
  revisionDate!: Date;

  @Property({ nullable: true, columnType: 'date' })
  newStartDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  newCompletionDate?: Date;

  @Property({ nullable: true, length: 100 })
  newDuration?: string;

  @Property({ nullable: true, columnType: 'decimal(15,2)' })
  costAdjustment?: string;

  @Property({ nullable: true, columnType: 'text' })
  justification?: string;

  @Property({ nullable: true, length: 50 })
  approvalStatus?: string; // 'DRAFT' | 'APPROVED' | 'REJECTED'

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
