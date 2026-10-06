import { EntityRepository } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { UserPermissionOverride } from '../../database/entities/user-permission-override.entity';

export class UserPermissionOverrideRepository extends EntityRepository<UserPermissionOverride> {
  /**
   * The CRUD level a user holds on a module — Viewer, Contributor, Approver or Manager.
   *
   * Returns null when there is no accessible grant at all, and also when the grant exists but
   * carries no level (legacy entry-only rows, where granted_level is NULL). Callers treat both
   * as "no write authority", so they are deliberately not distinguished.
   */
  async findGrantedLevel(
    userId: string,
    moduleKey: string,
  ): Promise<string | null> {
    const override = await this.findOne({ userId, moduleKey, canAccess: true });
    return override?.grantedLevel ?? null;
  }

  /** Whether a user may enter a module at all, regardless of the level granted. */
  async hasModuleAccess(userId: string, moduleKey: string): Promise<boolean> {
    const count = await this.count({ userId, moduleKey, canAccess: true });
    return count > 0;
  }
}
