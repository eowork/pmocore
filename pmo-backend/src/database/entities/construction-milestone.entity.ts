import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'construction_milestones' })
export class ConstructionMilestone {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  projectId!: string;

  @Property({ length: 255 })
  title!: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ nullable: true, columnType: 'date' })
  targetDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  actualDate?: Date;

  @Property({ length: 50, default: 'PENDING' })
  status: string = 'PENDING';

  @Property({ nullable: true, columnType: 'text' })
  remarks?: string;

  @Property({ nullable: true, columnType: 'date' })
  startDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  actualStartDate?: Date;

  @Property({ columnType: 'decimal(5,2)', default: 0 })
  progress: string = '0.00';

  @Property({ nullable: true, length: 50 })
  category?: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  // LI-A: Audit trail fields
  @Property({ nullable: true, length: 36 })
  createdBy?: string;

  @Property({
    nullable: true,
    columnType: 'timestamptz',
    onUpdate: () => new Date(),
  })
  updatedAt?: Date;

  @Property({ nullable: true, length: 36 })
  updatedBy?: string;
}
