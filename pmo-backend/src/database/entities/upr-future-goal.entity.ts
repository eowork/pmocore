import {
  ArrayType,
  Entity,
  Filter,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { UPRReport } from './upr-report.entity';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'upr_future_goals' })
export class UprFutureGoal {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  // Indexed because these rows are only ever read through their parent report.
  @Index()
  @ManyToOne(() => UPRReport, {
    fieldName: 'report_id',
    deleteRule: 'cascade',
    updateRule: 'cascade',
  })
  report!: UPRReport;

  @Property({ type: 'text' })
  initiative!: string;

  @Property({ type: 'date', nullable: true })
  target_date_of_completion?: Date;

  // ArrayType is rendered as a native text[] by the Postgres platform. The initializer keeps
  // a goal with no outcomes from inserting null into a NOT NULL column.
  @Property({ type: ArrayType })
  outcomes: string[] = [];

  @Property({ type: 'integer' })
  sort_order!: number;

  @Property({ columnType: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
