import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'gad_student_parity_data' })
export class GadStudentParityData {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 20 })
  academicYear!: string;

  @Property({ length: 100 })
  program!: string;

  @Property({ nullable: true, type: 'integer', default: 0 })
  admissionMale?: number = 0;

  @Property({ nullable: true, type: 'integer', default: 0 })
  admissionFemale?: number = 0;

  @Property({ nullable: true, type: 'integer', default: 0 })
  graduationMale?: number = 0;

  @Property({ nullable: true, type: 'integer', default: 0 })
  graduationFemale?: number = 0;

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
