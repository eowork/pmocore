import {
  Check,
  Entity,
  Enum,
  Filter,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { Max, Min } from 'class-validator';
import { UprStatus } from '../../upr-report/enums';
import { User } from './user.entity';

// The quarter is also guarded by class-validator below, but that only covers values
// arriving through a DTO. The check constraint keeps seeds, scripts and direct SQL honest.
@Check({
  name: 'upr_reports_quarter_check',
  expression: '"quarter" between 1 and 4',
})
// One report per office per quarter. Written as a partial unique index rather than a
// unique constraint so a soft-deleted report does not block a replacement.
@Index({
  name: 'uq_upr_reports_office_period',
  expression:
    'create unique index "uq_upr_reports_office_period" on "upr_reports" ("office_name", "fiscal_year", "quarter") where "deleted_at" is null',
})
@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'upr_reports' })
export class UPRReport {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ type: 'string', length: 150 })
  office_name!: string;

  @Property({ type: 'integer' })
  fiscal_year!: number;

  @Property({ type: 'integer' })
  @Min(1, { message: 'Quarter must be between 1 and 4' })
  @Max(4, { message: 'Quarter must be between 1 and 4' })
  quarter!: number;

  @Property({ type: 'text' })
  unit_office_profile!: string;

  @Property({ type: 'text' })
  quality_objective!: string;

  @Enum({
    items: () => UprStatus,
    nativeEnumName: 'upr_status_enum',
    default: UprStatus.DRAFT,
  })
  status: UprStatus = UprStatus.DRAFT;

  // restrict, not cascade: a report is an official record and must outlive the account
  // that filed it. Removing a user with reports has to be a deliberate, separate decision.
  @Index()
  @ManyToOne(() => User, {
    fieldName: 'prepared_by',
    deleteRule: 'restrict',
    updateRule: 'cascade',
  })
  prepared_by!: User;

  @Property({ columnType: 'timestamptz', defaultRaw: 'now()' })
  created_at: Date = new Date();

  @Property({
    columnType: 'timestamptz',
    onUpdate: () => new Date(),
    nullable: true,
  })
  updated_at?: Date;

  @Property({ columnType: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
