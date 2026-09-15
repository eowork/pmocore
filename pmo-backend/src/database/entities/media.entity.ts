import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'media' })
export class Media {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 100 })
  mediableType!: string;

  @Property({ columnType: 'uuid' })
  mediableId!: string;

  @Property({ columnType: 'media_type_enum' })
  mediaType!: string;

  @Property({ length: 255 })
  fileName!: string;

  @Property({ length: 255 })
  filePath!: string;

  @Property({ type: 'integer' })
  fileSize!: number;

  @Property({ length: 100 })
  mimeType!: string;

  @Property({ nullable: true, length: 255 })
  title?: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ nullable: true, length: 255 })
  altText?: string;

  @Property({ nullable: true, type: 'boolean', default: false })
  isFeatured?: boolean = false;

  @Property({ nullable: true, length: 255 })
  thumbnailUrl?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  dimensions?: Record<string, any>;

  @Property({ nullable: true, columnType: 'jsonb' })
  tags?: Record<string, any>;

  @Property({ nullable: true, columnType: 'date' })
  captureDate?: Date;

  @Property({ nullable: true, type: 'integer', default: 0 })
  displayOrder?: number = 0;

  @Property({ nullable: true, columnType: 'jsonb' })
  location?: Record<string, any>;

  @Property({ nullable: true, length: 50 })
  projectType?: string;

  @Property({ columnType: 'uuid' })
  uploadedBy!: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  metadata?: Record<string, any>;

  @Property({ nullable: true, columnType: 'uuid' })
  createdBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  updatedBy?: string;

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
