import {
  Entity,
  Filter,
  ManyToOne,
  OneToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { UPRReport } from './me-report.entity';
import { UprAttachment } from './urp-attachment.entity';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'upr_initiatives' })
export class UprInitiative {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => UPRReport, {
    fieldName: 'upr_report_id',
    nullable: false,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  upr_report: UPRReport;

  @Property({ length: 150 })
  title!: string;

  @Property({ type: 'text' })
  description!: string;

  @Property({ type: 'text' })
  drive_link?: string;

  @OneToOne(() => UprAttachment, {
    fieldName: 'attachment_id',
    nullable: true,
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  attachment?: UprAttachment;

  @Property({ type: 'integer' })
  sort_order: number;
}
