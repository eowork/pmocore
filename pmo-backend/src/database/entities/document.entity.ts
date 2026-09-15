import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'documents' })
export class Document {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 100 })
  documentableType!: string;

  @Property({ columnType: 'uuid' })
  documentableId!: string;

  @Property({ length: 100 })
  documentType!: string;

  @Property({ length: 255 })
  fileName!: string;

  @Property({ length: 255 })
  filePath!: string;

  @Property({ type: 'integer' })
  fileSize!: number;

  @Property({ length: 100 })
  mimeType!: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ nullable: true, type: 'integer', default: 1 })
  version?: number;

  @Property({ nullable: true, length: 50 })
  category?: string;

  @Property({ nullable: true, columnType: 'text' })
  extractedText?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  chunks?: Record<string, any>;

  @Property({ nullable: true, columnType: 'timestamptz' })
  processedAt?: Date;

  @Property({ nullable: true, length: 50, default: 'ready' })
  status?: string;

  @Property({ length: 20, default: 'ACTIVE' })
  lifecycleStatus: string = 'ACTIVE';

  @Property({ columnType: 'uuid' })
  uploadedBy!: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  metadata?: Record<string, any>;

  @Property({ nullable: true, columnType: 'uuid' })
  createdBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  updatedBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  folderId?: string | null;

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
