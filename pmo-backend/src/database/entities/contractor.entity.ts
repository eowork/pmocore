import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'contractors' })
export class Contractor {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 255 })
  name!: string;

  @Property({ nullable: true, length: 255 })
  contactPerson?: string;

  @Property({ nullable: true, length: 255 })
  email?: string;

  @Property({ nullable: true, length: 20 })
  phone?: string;

  @Property({ nullable: true, columnType: 'text' })
  address?: string;

  @Property({ nullable: true, length: 50 })
  tinNumber?: string;

  @Property({ nullable: true, length: 100 })
  registrationNumber?: string;

  @Property({ nullable: true, columnType: 'date' })
  validityDate?: Date;

  @Property({ length: 50 })
  status!: string;

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
