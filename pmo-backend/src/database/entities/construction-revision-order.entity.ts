import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ConstructionProject } from './construction-project.entity';

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
