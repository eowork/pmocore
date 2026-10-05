import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ConstructionProject } from './construction-project.entity';
import { ConstructionMilestoneRepository } from '../../construction-projects/repository/construction-milestone.repository';

// The repository is bound here so that @InjectRepository(ConstructionMilestone) hands back
// ConstructionMilestoneRepository, with its query methods, wherever the entity's repository
// is requested. The lazy callback is what mikro-orm expects and keeps the reference from
// being read at decoration time.
@Entity({
  tableName: 'construction_milestones',
  repository: () => ConstructionMilestoneRepository,
})
export class ConstructionMilestone {
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

  @Property({ length: 255 })
  title!: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ nullable: true, columnType: 'date' })
  targetDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  actualDate?: Date;

  @Property({ nullable: true, length: 50, default: 'PENDING' })
  status?: string = 'PENDING';

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
