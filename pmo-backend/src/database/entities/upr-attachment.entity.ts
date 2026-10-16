import {
  BigIntType,
  Entity,
  Filter,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';
import { UPRReport } from './upr-report.entity';
import { User } from './user.entity';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'upr_attachments' })
export class UprAttachment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  // Nullable: a file can be uploaded before the report row it belongs to exists.
  @Index()
  @ManyToOne(() => UPRReport, {
    fieldName: 'report_id',
    nullable: true,
    deleteRule: 'cascade',
    updateRule: 'cascade',
  })
  report?: UPRReport;

  // restrict: the uploader is part of the file's provenance, so the account cannot be
  // removed while attachments still point at it.
  @Index()
  @ManyToOne(() => User, {
    fieldName: 'uploaded_by',
    deleteRule: 'restrict',
    updateRule: 'cascade',
  })
  uploaded_by!: User;

  @Property({ type: 'string', length: 255 })
  original_filename!: string;

  @Property({ type: 'string', length: 255 })
  @Unique({ name: 'uq_object_key' })
  object_key!: string;

  @Property({ type: 'string', length: 255, nullable: true })
  bucket_name?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  mime_type?: string;

  // BigIntType('number') keeps the column bigint while handing back a JS number; the
  // default mode returns a string, which would not match the declared type.
  @Property({ type: new BigIntType('number') })
  file_size!: number;

  @Property({ type: 'string', length: 64, nullable: true })
  checksum_sha256?: string;

  @Property({ type: 'string', length: 255 })
  attachment_type!: string;

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
