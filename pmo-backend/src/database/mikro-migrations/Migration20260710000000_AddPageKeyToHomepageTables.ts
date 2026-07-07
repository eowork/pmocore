import { Migration } from '@mikro-orm/migrations';

/**
 * T-HOME-CMS-4 (TH4-5) — additive `page_key` column on both homepage CMS
 * tables, defaulted to 'home' so every existing row is unaffected. Lays the
 * groundwork for future public pages (News, Gallery, Publications) to reuse
 * the identical admin tabs/service/API shape, filtered by a different key —
 * not a page-builder, just one column.
 */
export class Migration20260710000000_AddPageKeyToHomepageTables extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE homepage_settings
        ADD COLUMN IF NOT EXISTS page_key varchar(50) NOT NULL DEFAULT 'home'
    `);
    this.addSql(`
      ALTER TABLE homepage_items
        ADD COLUMN IF NOT EXISTS page_key varchar(50) NOT NULL DEFAULT 'home'
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS homepage_items_page_section_index
         ON homepage_items (page_key, section_key, item_order) WHERE deleted_at IS NULL`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS homepage_items_page_section_index`);
    this.addSql(`ALTER TABLE homepage_items DROP COLUMN IF EXISTS page_key`);
    this.addSql(`ALTER TABLE homepage_settings DROP COLUMN IF EXISTS page_key`);
  }
}
