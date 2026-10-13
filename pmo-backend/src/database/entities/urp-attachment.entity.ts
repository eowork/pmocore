import { ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { UPRReport } from './me-report.entity';
import { User } from './user.entity';

export class UprAttachment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => UPRReport, {
    fieldName: 'report_id',
    nullable: true,
    persist: false,
    createForeignKeyConstraint: false,
  })
  report_id?: UPRReport;

  @ManyToOne(() => User, {
    fieldName: 'uploaded_by',
    createForeignKeyConstraint: true,
  })
  uploaded_by: User;

  @Property({ type: 'string' })
  original_filename: string;

  @Property({ type: 'string' })
  @Unique({ name: 'uq_object_key' })
  object_key!: string;

  @Property({ type: 'string' })
  bucket_name?: string;

  @Property({ type: 'string' })
  mime_type?: string;

  @Property({ type: 'bigint' })
  file_size: number;

  @Property({ type: 'string' })
  checksum_sha256?: string;

  @Property({ type: 'string' })
  attachment_type: string;

  @Property({ type: 'timestamp', defaultRaw: 'now()' })
  created_at: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date(), nullable: true })
  updated_at?: Date;
}