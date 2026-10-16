import {
  Entity,
  Filter,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { UPRReport } from './upr-report.entity';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'upr_best_practices' })
export class UprBestPractices {
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
  description!: string;

  @Property({ type: 'integer' })
  sort_order!: number;

  @Property({ columnType: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
