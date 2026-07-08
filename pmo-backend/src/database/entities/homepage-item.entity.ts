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
  // Also doubles as a custom-uploaded icon image for sections that don't use
  // this slot for a section photo (T-HOME-CMS-5, TH5-6).
  @Property({ nullable: true, columnType: 'uuid' })
  mediaId?: string;

  // T-HOME-CMS-5 (TH5-11): Highlights only — closed CSU-palette accent color.
  @Property({ nullable: true, length: 30 })
  colorToken?: string;

  // T-HOME-CMS-8 (TH8-5): unused since T-HOME-CMS-11 decoupled Featured News
  // from COI (RH11-3) — kept in place per this project's additive-only
  // migration convention, never populated by new code.
  @Property({ nullable: true, columnType: 'uuid' })
  linkedProjectId?: string;

  // T-HOME-CMS-11 (TH11-2): Featured News fields.
  @Property({ nullable: true, length: 255 })
  subtitle?: string;

  @Property({ nullable: true, columnType: 'text' })
  fullDescription?: string;

  @Property({ nullable: true, length: 255 })
  author?: string;

  @Property({ nullable: true, length: 255 })
  department?: string;

  @Property({ nullable: true, columnType: 'date' })
  publishDate?: Date;

  @Property({ default: false })
  isFeatured: boolean = false;

  // Plain optional text — no longer resolved from a COI record (RH11-3).
  @Property({ nullable: true, length: 100 })
  statusText?: string;

  @Property({ nullable: true, length: 100 })
  campusText?: string;

  @Property({ nullable: true, length: 100 })
  budgetText?: string;

  @Property({ nullable: true, length: 50 })
  completionText?: string;

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
