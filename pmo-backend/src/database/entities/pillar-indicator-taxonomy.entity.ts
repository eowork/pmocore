import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

// READ-ONLY entity — seeded by migration 016. Never write/persist against this entity.
@Entity({ tableName: 'pillar_indicator_taxonomy' })
export class PillarIndicatorTaxonomy {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 50 })
  pillarType!: string;

  // 500 to fit the longest BAR1 indicator (AE-OC-01 multi-part descriptor, 447 chars);
  // matches the live dev DB column width.
  @Property({ length: 500 })
  indicatorName!: string;

  @Property({ nullable: true, length: 50 })
  indicatorCode?: string;

  @Property({ length: 50 })
  uacsCode!: string;

  @Property({ type: 'integer' })
  indicatorOrder!: number;

  @Property({ length: 20 })
  indicatorType!: string;

  @Property({ length: 20 })
  unitType!: string;

  @Property({ nullable: true, columnType: 'text' })
  description?: string;

  @Property({ type: 'boolean', default: true })
  isActive: boolean = true;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ nullable: true, type: 'uuid' })
  createdBy?: string;
}
