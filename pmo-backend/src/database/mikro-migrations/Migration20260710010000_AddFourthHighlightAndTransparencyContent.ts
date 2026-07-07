import { Migration } from '@mikro-orm/migrations';

/**
 * T-HOME-CMS-4 (TH4-2/TH4-4) — a 4th University Highlights card (only 3 were
 * ever seeded), plus making "About PMO CORE" facets and the entire
 * "Why PMO CORE Exists" section (title, body, 4 pillars) CMS-editable via the
 * same generic homepage_items/homepage_settings mechanism used everywhere
 * else. Seed values match today's hardcoded copy exactly — zero visual change
 * on deploy; only the source of truth moves from .vue files to the database.
 */
export class Migration20260710010000_AddFourthHighlightAndTransparencyContent extends Migration {
  async up(): Promise<void> {
    // TH4-2: 4th highlight (only if the table still has exactly the original 3 —
    // avoids duplicating if an admin already added their own 4th via the UI).
    this.addSql(`
      INSERT INTO homepage_items (section_key, item_order, title, body, icon, value_source, manual_value)
      SELECT 'highlight', 4, 'University-Wide Reach', 'Serving both the Main and Cabadbaran campuses under one unified reporting platform.', 'mdi-map-marker-radius-outline', 'manual', '2 Campuses'
      WHERE (SELECT COUNT(*) FROM homepage_items WHERE section_key = 'highlight' AND deleted_at IS NULL) = 3
    `);

    // TH4-4: Transparency settings.
    this.addSql(`
      INSERT INTO homepage_settings (setting_key, setting_value, data_type)
      VALUES
        ('transparency_title', 'Why PMO CORE Exists', 'string'),
        ('transparency_body', 'The Project Management Office maintains PMO CORE so that students, employees, and the public can see how university infrastructure and operations are planned, funded, and delivered. Only records approved for public viewing appear here.', 'string')
      ON CONFLICT (setting_key) DO NOTHING
    `);

    // TH4-4: About PMO CORE facets (copied from PublicAboutCore.vue's hardcoded array).
    this.addSql(`
      INSERT INTO homepage_items (section_key, item_order, title, body, icon)
      SELECT * FROM (VALUES
        ('about_facet', 1, 'Centralized', 'One platform for infrastructure, operations, and program reporting across all CSU campuses.', 'mdi-hub-outline'),
        ('about_facet', 2, 'Operations', 'Live monitoring of university projects and quarterly accomplishments from proposal to completion.', 'mdi-cog-outline'),
        ('about_facet', 3, 'Reporting', 'Structured, standards-aligned reports reviewed and approved before publication.', 'mdi-file-chart-outline'),
        ('about_facet', 4, 'Engine', 'The system that powers transparency and evidence-based decisions for university governance.', 'mdi-engine-outline')
      ) AS v(section_key, item_order, title, body, icon)
      WHERE NOT EXISTS (SELECT 1 FROM homepage_items WHERE section_key = 'about_facet')
    `);

    // TH4-4: Transparency pillars (copied from PublicTransparency.vue's hardcoded array).
    this.addSql(`
      INSERT INTO homepage_items (section_key, item_order, title, body, icon)
      SELECT * FROM (VALUES
        ('transparency_pillar', 1, 'Transparency', 'Published project records are open to the public, no account required.', 'mdi-eye-outline'),
        ('transparency_pillar', 2, 'Accountability', 'Every published record passes a review-and-approval workflow before release.', 'mdi-scale-balance'),
        ('transparency_pillar', 3, 'Monitoring', 'Physical progress and timelines are tracked from proposal to completion.', 'mdi-chart-timeline-variant'),
        ('transparency_pillar', 4, 'Governance', 'Reporting follows university and national budget-reporting standards.', 'mdi-domain')
      ) AS v(section_key, item_order, title, body, icon)
      WHERE NOT EXISTS (SELECT 1 FROM homepage_items WHERE section_key = 'transparency_pillar')
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DELETE FROM homepage_items WHERE section_key IN ('about_facet', 'transparency_pillar')`);
    this.addSql(`DELETE FROM homepage_items WHERE section_key = 'highlight' AND title = 'University-Wide Reach'`);
    this.addSql(`DELETE FROM homepage_settings WHERE setting_key IN ('transparency_title', 'transparency_body')`);
  }
}
