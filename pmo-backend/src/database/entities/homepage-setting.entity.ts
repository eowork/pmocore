import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

// T-HOME-CMS (THC-2): singleton homepage content — hero copy, about text,
// footer/contact fields. One row per key (mirrors system_settings shape).
@Entity({ tableName: 'homepage_settings' })
export class HomepageSetting {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  // NOTE (TH4-5): unique on settingKey alone — fine while 'home' is the only
  // page_key in use. A second real page will need this changed to a composite
  // unique on (pageKey, settingKey); deferred until that page actually exists
  // (YAGNI — no second page to collide with today).
  @Property({ length: 100 })
  @Unique()
  settingKey!: string;

  @Property({ nullable: true, columnType: 'text' })
  settingValue?: string;

  @Property({ length: 20, default: 'string' })
  dataType: string = 'string';

  // T-HOME-CMS-4 (TH4-5): future multi-page CMS support — every existing row
  // is implicitly 'home'; a future page reuses this same table/mechanism.
  @Property({ length: 50, default: 'home' })
  pageKey: string = 'home';

  @Property({ nullable: true, columnType: 'uuid' })
  createdBy?: string;

  @Property({ nullable: true, columnType: 'uuid' })
  updatedBy?: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({
    defaultRaw: 'NOW()',
    onUpdate: () => new Date(),
    columnType: 'timestamptz',
  })
  updatedAt: Date = new Date();
}
