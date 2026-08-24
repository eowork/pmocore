import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'contractor_users' })
export class ContractorUser {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 255, unique: true })
  email!: string;

  @Property({ nullable: true, columnType: 'text' })
  passwordHash?: string;

  @Property({ columnType: 'text' })
  fullName!: string;

  @Property({ nullable: true, length: 255 })
  companyName?: string;

  @Property({ nullable: true, length: 30 })
  phone?: string;

  @Property({ nullable: true, length: 150 })
  position?: string;

  @Property({ nullable: true, length: 255, unique: true })
  googleId?: string;

  @Property({ nullable: true, columnType: 'text' })
  avatarUrl?: string;

  @Property({ length: 20, default: 'ACTIVE' })
  status: string = 'ACTIVE';

  @Property({ type: 'boolean', default: true })
  isActive: boolean = true;

  @Property({ nullable: true, columnType: 'timestamptz' })
  lastLoginAt?: Date;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({
    defaultRaw: 'NOW()',
    onUpdate: () => new Date(),
    columnType: 'timestamptz',
  })
  updatedAt: Date = new Date();
}
