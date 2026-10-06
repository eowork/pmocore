import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';
import {
  ConstructionSubcategoriesRepository
} from '../../construction-subcategories/repository/construction-subcategories.repository';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({
  tableName: 'construction_subcategories',
  repository: () => ConstructionSubcategoriesRepository,
})
export class ConstructionSubcategory {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 100 })
  name!: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ nullable: true, columnType: 'jsonb' })
  metadata?: Record<string, unknown>;

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
