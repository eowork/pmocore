import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ConstructionProject } from './construction-project.entity';

@Entity({ tableName: 'construction_gallery' })
export class ConstructionGallery {
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

  @Property({ length: 500 })
  imageUrl!: string;

  @Property({ nullable: true, length: 255 })
  caption?: string;

  @Property({ nullable: true, length: 50, default: 'IN_PROGRESS' })
  category?: string = 'IN_PROGRESS';

  @Property({ nullable: true, type: 'boolean', default: false })
  isFeatured?: boolean = false;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  uploadedAt: Date = new Date();

  // LB-C: User-supplied date when the photo was captured (distinct from server-side uploadedAt)
  @Property({ nullable: true, columnType: 'date' })
  imageTakenDate?: Date;
}
