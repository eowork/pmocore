import { EntityRepository } from '@mikro-orm/core';
import { ModuleType } from '../enums';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { UserModuleAssignment } from '../../database/entities/user-module-assignment.entity';

export class UserModuleAssignmentRepository extends EntityRepository<UserModuleAssignment> {
  /**
   * Whether a user may enter a module. ModuleType.ALL is a wildcard grant that satisfies every
   * module, so it is always accepted alongside the module asked for.
   */
  async hasModuleAccess(userId: string, module: ModuleType): Promise<boolean> {
    const count = await this.count({
      userId,
      module: { $in: [module, ModuleType.ALL] },
    });
    return count > 0;
  }

  /** Every module a user holds a grant for, wildcard grants included. */
  async findModulesForUser(userId: string): Promise<ModuleType[]> {
    const rows = await this.find({ userId }, { fields: ['module'] });
    return rows.map((r) => r.module);
  }
}
