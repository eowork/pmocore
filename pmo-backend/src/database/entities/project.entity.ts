import { Entity, Filter, Index, PrimaryKey, Property } from '@mikro-orm/core';

// Phase JN-A: project_code uniqueness is a partial index (WHERE deleted_at IS NULL,
// coredata_schema.sql:4594-4597), not a plain unique constraint — a soft-deleted
// project's code must be reusable. A plain `unique: true` on the property makes
// mikro-orm's schema diff want to replace this index with a full-table unique
// constraint, silently reintroducing the reuse bug Migration20260502071146 fixed.
@Index({
  name: 'projects_project_code_active_idx',
  expression:
    'CREATE UNIQUE INDEX projects_project_code_active_idx ON projects (project_code) WHERE deleted_at IS NULL',
})
@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'projects' })
export class Project {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 50 })
  projectCode!: string;

  @Property({ length: 255 })
  title!: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ length: 50 })
  projectType!: string;

  @Property({ nullable: true, columnType: 'date' })
  startDate?: Date;

  @Property({ nullable: true, columnType: 'date' })
  endDate?: Date;

  @Property({ length: 50 })
  status!: string;

  @Property({ nullable: true, columnType: 'decimal(15,2)' })
  budget?: string;

  @Property({ length: 50 })
  campus!: string;

  @Property({ columnType: 'uuid' })
  createdBy!: string;

  @Property({ nullable: true, columnType: 'uuid' })
  updatedBy?: string;

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
