import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { UserPermissionOverrideRepository } from '../../common/repository/user-permission-override.repository';

@Entity({
  tableName: 'user_permission_overrides',
  repository: () => UserPermissionOverrideRepository,
})
export class UserPermissionOverride {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  userId!: string;

  @Property({ length: 50 })
  moduleKey!: string;

  @Property({ type: 'boolean', default: false })
  canAccess: boolean = false;

  // PHASE BBBC (Track 8a): per-module access LEVEL governing CRUD (Viewer/Contributor/Approver/
  // Manager). NULL = legacy/entry-only. Module entry (canAccess) is separate from this CRUD tier.
  @Property({ nullable: true, length: 30 })
  grantedLevel?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  createdBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  updatedBy?: string;

  @Property({ defaultRaw: 'CURRENT_TIMESTAMP', columnType: 'timestamp' })
  createdAt: Date = new Date();

  @Property({
    defaultRaw: 'CURRENT_TIMESTAMP',
    onUpdate: () => new Date(),
    columnType: 'timestamp',
  })
  updatedAt: Date = new Date();
}
