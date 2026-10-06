import { Entity, Enum, PrimaryKey, Property } from '@mikro-orm/core';
import { ModuleType } from '../../common/enums';
import { UserModuleAssignmentRepository } from '../../common/repository/user-module-assignment.repository';

@Entity({
  tableName: 'user_module_assignments',
  repository: () => UserModuleAssignmentRepository,
})
export class UserModuleAssignment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  userId!: string;

  @Enum({ items: () => ModuleType })
  module!: ModuleType;

  @Property({ nullable: true, columnType: 'uuid' })
  assignedBy?: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  assignedAt: Date = new Date();

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();
}
