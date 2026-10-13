import {
  Entity,
  Filter,
  Index,
  ManyToOne,
  OneToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { UPRReport } from './upr-report.entity';
import { UprAttachment } from './upr-attachment.entity';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'upr_initiatives' })
export class UprInitiative {
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

  @Property({ type: 'string', length: 150 })
  title!: string;

  @Property({ type: 'text' })
  description!: string;

  @Property({ type: 'text', nullable: true })
  drive_link?: string;

  // The supporting file, when one was uploaded. set null rather than cascade: losing the
  // attachment must not take the initiative text with it.
  @OneToOne(() => UprAttachment, {
    fieldName: 'attachment_id',
    nullable: true,
    deleteRule: 'set null',
    updateRule: 'cascade',
    owner: true,
  })
  attachment?: UprAttachment;

  @Property({ type: 'integer' })
  sort_order!: number;

  @Property({ columnType: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
