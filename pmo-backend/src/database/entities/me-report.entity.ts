import {
  Entity,
  Enum,
  Filter,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { Max, Min } from 'class-validator';
import { UprStatus } from '../../upr-report/enums';
import { User } from './user.entity';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'upr-report' })
export class UPRReport {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 150 })
  office_name: string;

  @Property({ type: 'integer' })
  fiscal_year: number;

  @Property({ type: 'integer' })
  @Min(1, { message: 'Quarter must be between 1 and 4' })
  @Max(4, { message: 'Quarter must be between 1 and 4' })
  quarter: number;

  @Property({ type: 'text' })
  unit_office_profile: string;

  @Property({ type: 'text' })
  quality_objective: string;

  @Enum({ items: () => UprStatus, nativeEnumName: 'upr_status_enum' })
  status!: UprStatus;

  @ManyToOne(() => User, {
    fieldName: 'prepared_by',
    nullable: false,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  prepared_by: User;

  @Property({ type: 'timestamp', defaultRaw: 'now()' })
  created_at: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date(), nullable: true })
  updated_at: Date;
}
