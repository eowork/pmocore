import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'construction_gallery' })
export class ConstructionGallery {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  projectId!: string;

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
