import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/core';

// T-HOME-CMS (THC-2): generic ordered homepage content item. One schema covers
// hero slides, highlights, cards, FAQ entries, quick links, and announcements —
// discriminated by sectionKey (RHC-6: one table beats six near-identical ones).
@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
@Entity({ tableName: 'homepage_items' })
export class HomepageItem {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  // hero_slide | highlight | card | faq | quick_link | announcement |
  // about_facet | transparency_pillar
  @Property({ length: 50 })
  sectionKey!: string;

  // T-HOME-CMS-4 (TH4-5): future multi-page CMS support — every existing row
  // is implicitly 'home'.
  @Property({ length: 50, default: 'home' })
  pageKey: string = 'home';

  @Property({ type: 'integer', default: 0 })
  itemOrder: number = 0;

  @Property({ nullable: true, length: 255 })
  title?: string;

  @Property({ nullable: true, columnType: 'text' })
  body?: string;

  @Property({ nullable: true, length: 100 })
  icon?: string;

  @Property({ nullable: true, length: 500 })
  linkUrl?: string;

  // Highlights only: manual | auto:published_count | auto:ongoing_count | auto:completed_count
  @Property({ nullable: true, length: 50 })
  valueSource?: string;

  @Property({ nullable: true, length: 100 })
  manualValue?: string;

  // Optional image via the existing Media module (mediableType homepage_*).
  @Property({ nullable: true, columnType: 'uuid' })
  mediaId?: string;

  @Property({ default: true })
  isPublished: boolean = true;

  // T-HOME-CMS-3 (TH3-5): Announcements only — pin to top + optional visibility window.
  @Property({ default: false })
  isPinned: boolean = false;

  @Property({ nullable: true, columnType: 'timestamptz' })
  scheduledStart?: Date;

  @Property({ nullable: true, columnType: 'timestamptz' })
  scheduledEnd?: Date;

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

  @Property({ nullable: true, columnType: 'timestamptz' })
  deletedAt?: Date;

  @Property({ nullable: true, columnType: 'uuid' })
  deletedBy?: string;
}
