import { Migration } from '@mikro-orm/migrations';

/**
 * T-HOME-CMS-3 (TH3-5) — pinned + scheduled visibility for homepage_items
 * (used by Announcements; additive columns on the existing generic table,
 * consistent with its "one schema for all repeatable content" design).
 */
export class Migration20260709000000_AddPinAndScheduleToHomepageItems extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE homepage_items
        ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS scheduled_start timestamptz NULL,
        ADD COLUMN IF NOT EXISTS scheduled_end timestamptz NULL
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE homepage_items
        DROP COLUMN IF EXISTS is_pinned,
        DROP COLUMN IF EXISTS scheduled_start,
        DROP COLUMN IF EXISTS scheduled_end
    `);
  }
}
