import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

// Restored to stop mikro-orm migration:create from proposing to DROP this table —
// it has no MikroORM entity but is still live-queried via raw SQL
// (repair-projects.service.ts's GET :id JOIN on repair_projects.facility_id).
// Column shapes mirror coredata_schema.sql's "facilities" table exactly.
@Entity({ tableName: 'facilities' })
export class Facility {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 100 })
  buildingName!: string;

  @Property({ length: 50 })
  roomNumber!: string;

  @Property({ nullable: true, length: 50, default: 'Classroom' })
  facilityType?: string;

  // Native enum in DB (campus_enum), stored as plain string — mirrors the
  // codebase-wide convention (e.g. RepairProject.campus, ConstructionProject.campus).
  @Property({ nullable: true, length: 50, default: 'MAIN' })
  campus?: string;

  @Property({ nullable: true, type: 'integer' })
  capacity?: number;

  @Property({ nullable: true, columnType: 'numeric(10,2)' })
  floorAreaSqm?: string;

  // Native enum in DB (condition_enum), stored as plain string — same convention as campus above.
  @Property({ nullable: true, length: 50, default: 'GOOD' })
  conditionRating?: string;

  @Property({ nullable: true, columnType: 'jsonb', default: '[]' })
  featuresList?: any;

  @Property({ nullable: true, default: true })
  isOperational?: boolean;

  @Property({ nullable: true, columnType: 'timestamptz' })
  lastInspectedAt?: Date;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({
    defaultRaw: 'NOW()',
    onUpdate: () => new Date(),
    columnType: 'timestamptz',
  })
  updatedAt: Date = new Date();
}
