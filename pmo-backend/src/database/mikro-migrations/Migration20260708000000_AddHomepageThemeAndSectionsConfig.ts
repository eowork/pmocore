import { Migration } from '@mikro-orm/migrations';

/**
 * T-HOME-CMS-2 (THM-1/THM-5) — homepage theme preset + section-level
 * enable/disable/reorder config. Both are additive `homepage_settings` rows,
 * reusing the existing singleton-settings mechanism (no new tables).
 *
 * ON CONFLICT DO NOTHING (not the "insert only if table empty" pattern used by
 * the original homepage seed) because these two keys are being added to an
 * ALREADY-POPULATED table on existing databases.
 */
export class Migration20260708000000_AddHomepageThemeAndSectionsConfig extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      INSERT INTO homepage_settings (setting_key, setting_value, data_type)
      VALUES ('homepage_theme', 'light_emerald', 'string')
      ON CONFLICT (setting_key) DO NOTHING
    `);

    this.addSql(`
      INSERT INTO homepage_settings (setting_key, setting_value, data_type)
      VALUES (
        'homepage_sections_config',
        '[{"key":"about_core","visible":true,"order":1},{"key":"highlights","visible":true,"order":2},{"key":"featured_projects","visible":true,"order":3},{"key":"announcements","visible":true,"order":4},{"key":"latest_updates","visible":true,"order":5},{"key":"transparency","visible":true,"order":6},{"key":"faq","visible":true,"order":7}]',
        'json'
      )
      ON CONFLICT (setting_key) DO NOTHING
    `);
  }

  async down(): Promise<void> {
    this.addSql(
      `DELETE FROM homepage_settings WHERE setting_key IN ('homepage_theme', 'homepage_sections_config')`,
    );
  }
}
