import { Migration } from '@mikro-orm/migrations';

/**
 * T-HOME-CMS-5 (Scope A) — additive-only changes:
 * - color_token on homepage_items (TH5-11: closed-set per-highlight accent color)
 * - homepage_sections_config gains a 'quick_links' entry for existing DBs
 *   (TH5-3: PublicQuickLinks.vue was already built/CMS-wired but never listed
 *   in the sections config — this wires it in without disturbing any admin
 *   customization already saved to the row).
 */
export class Migration20260711000000_HomepageCms5Additions extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE homepage_items ADD COLUMN IF NOT EXISTS color_token VARCHAR(30) NULL;
    `);

    // Only touch rows that don't already mention quick_links (idempotent; leaves
    // any admin-customized config alone once it has the key).
    this.addSql(`
      UPDATE homepage_settings
      SET setting_value = (setting_value::jsonb || '[{"key":"quick_links","visible":true,"order":99}]'::jsonb)::text
      WHERE setting_key = 'homepage_sections_config'
        AND setting_value NOT LIKE '%quick_links%';
    `);
  }

  async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE homepage_items DROP COLUMN IF EXISTS color_token;`,
    );
    this.addSql(`
      UPDATE homepage_settings
      SET setting_value = (
        SELECT jsonb_agg(elem) FROM jsonb_array_elements(setting_value::jsonb) elem
        WHERE elem->>'key' != 'quick_links'
      )::text
      WHERE setting_key = 'homepage_sections_config';
    `);
  }
}
