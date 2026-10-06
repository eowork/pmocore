import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'gad_faculty_parity_data' })
export class GadFacultyParityData {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 20 })
  academicYear!: string;

  @Property({ length: 100 })
  college!: string;

  @Property({ length: 50 })
  category!: string;

  @Property({ nullable: true, type: 'integer', default: 0 })
  totalFaculty?: number;

  @Property({ nullable: true, type: 'integer', default: 0 })
  maleCount?: number;

  @Property({ nullable: true, type: 'integer', default: 0 })
  femaleCount?: number;

  @Property({ nullable: true, length: 50 })
  genderBalance?: string;

  @Property({ nullable: true, length: 50, default: 'pending' })
  status?: string;

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
