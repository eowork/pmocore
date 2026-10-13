import {
  Entity,
  Filter,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { UPRReport } from './me-report.entity';

@Filter({ name: 'notDeleted', cond: { deleted: false }, default: true })
@Entity({ tableName: 'upr_best_practices' })
export class UprBestPractices {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => UPRReport, {
    fieldName: 'report_id',
    deleteRule: 'cascade',
  })
  report_id!: string;

  @Property({ type: 'text' })
  description: string;

  @Property({ type: 'integer' })
  sort_order: number;
}
