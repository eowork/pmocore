import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'repair_project_team_members' })
export class RepairProjectTeamMember {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  repairProjectId!: string;

  @Property({ nullable: true, columnType: 'uuid' })
  userId?: string;

  @Property({ length: 255 })
  name!: string;

  @Property({ length: 100 })
  role!: string;

  @Property({ nullable: true, length: 100 })
  department?: string;

  @Property({ nullable: true, columnType: 'text' })
  responsibilities?: string;

  @Property({ nullable: true, length: 50, default: 'Active' })
  status?: string = 'Active';

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
