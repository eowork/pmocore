import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'fiscal_years' })
export class FiscalYear {
  @PrimaryKey({ type: 'integer', autoincrement: false })
  year!: number;

  @Property({ nullable: true, length: 50 })
  label?: string;

  @Property({ type: 'boolean', default: true })
  isActive: boolean = true;

  @Property({ nullable: true, defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt?: Date;

  @Property({
    nullable: true,
    defaultRaw: 'NOW()',
    onUpdate: () => new Date(),
    columnType: 'timestamptz',
  })
  updatedAt?: Date;
}
