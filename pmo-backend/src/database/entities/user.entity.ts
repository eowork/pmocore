import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 100, unique: true })
  username!: string;

  @Property({ length: 255, unique: true })
  email!: string;

  @Property({ length: 255 })
  passwordHash!: string;

  @Property({ length: 100 })
  firstName!: string;

  @Property({ length: 100 })
  lastName!: string;

  @Property({ nullable: true, columnType: 'text' })
  middleName?: string;

  @Property({ nullable: true, length: 255 })
  displayName?: string;

  @Property({ nullable: true, length: 255 })
  avatarUrl?: string;

  @Property({ nullable: true, columnType: 'text' })
  campus?: string;

  @Property({ nullable: true, length: 50, default: 'ACTIVE' })
  status?: string;

  @Property({ type: 'boolean', default: true })
  isActive: boolean = true;

  @Property({ nullable: true, type: 'integer', default: 100 })
  rankLevel?: number;

  @Property({ nullable: true, length: 255, unique: true })
  googleId?: string;

  @Property({ nullable: true, type: 'integer', default: 0 })
  failedLoginAttempts?: number;

  @Property({ nullable: true, columnType: 'timestamptz' })
  accountLockedUntil?: Date;

  @Property({ nullable: true, columnType: 'timestamptz' })
  lastLoginAt?: Date;

  @Property({ nullable: true, columnType: 'timestamptz' })
  lastPasswordChangeAt?: Date;

  @Property({ nullable: true, length: 20 })
  phone?: string;

  // PHASE BBBA (BBBA-1e): first-login profile-completion gate. Existing users are
  // backfilled to true by migration; new accounts start false.
  @Property({ type: 'boolean', default: false })
  profileCompleted: boolean = false;

  // PHASE BBBC (Track 4): force a password change at next login (set on admin reset / new
  // admin-created accounts; cleared when the user changes their password).
  @Property({ type: 'boolean', default: false })
  mustChangePassword: boolean = false;

  @Property({ nullable: true, columnType: 'jsonb' })
  metadata?: Record<string, any>;

  @Property({ nullable: true, columnType: 'uuid' })
  createdBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  updatedBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  deletedBy?: string;

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
}
