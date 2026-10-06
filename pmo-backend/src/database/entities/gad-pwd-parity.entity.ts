import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'gad_pwd_parity_data' })
export class GadPwdParityData {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 20 })
  academicYear!: string;

  @Property({ length: 50 })
  pwdCategory!: string;

  @Property({ nullable: true, length: 100 })
  subcategory?: string;

  @Property({ nullable: true, type: 'integer', default: 0 })
  totalBeneficiaries?: number = 0;

  @Property({ nullable: true, type: 'integer', default: 0 })
  maleCount?: number = 0;

  @Property({ nullable: true, type: 'integer', default: 0 })
  femaleCount?: number = 0;

  @Property({ nullable: true, length: 50, default: 'pending' })
  status?: string = 'pending';

  @Property({ nullable: true, columnType: 'uuid' })
  submittedBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  reviewedBy?: string;

  @Property({ nullable: true, columnType: 'timestamptz' })
  reviewedAt?: Date;

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
