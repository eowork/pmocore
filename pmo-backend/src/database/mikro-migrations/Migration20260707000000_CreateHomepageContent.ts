import { Migration } from '@mikro-orm/migrations';

/**
 * T-HOME-CMS (THC-1) — CMS-backed public homepage content.
 *
 * homepage_settings: singleton key/value copy (hero, about, footer/contact).
 * homepage_items:    generic ordered/publishable items (hero_slide, highlight,
 *                    card, faq, quick_link, announcement) — one schema for all
 *                    repeatable homepage zones (RHC-6).
 *
 * Seeds default content so a homepage backed by these tables never renders
 * empty (plan D11). Fresh-DB deploys get the same rows via seed.js (this
 * migration is fake-marked on fresh databases per ADR-023).
 */
export class Migration20260707000000_CreateHomepageContent extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS homepage_settings (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        setting_key varchar(100) NOT NULL,
        setting_value text NULL,
        data_type varchar(20) NOT NULL DEFAULT 'string',
        created_by uuid NULL,
        updated_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT homepage_settings_pkey PRIMARY KEY (id),
        CONSTRAINT homepage_settings_setting_key_unique UNIQUE (setting_key)
      )
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS homepage_items (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        section_key varchar(50) NOT NULL,
        item_order int NOT NULL DEFAULT 0,
        title varchar(255) NULL,
        body text NULL,
        icon varchar(100) NULL,
        link_url varchar(500) NULL,
        value_source varchar(50) NULL,
        manual_value varchar(100) NULL,
        media_id uuid NULL,
        is_published boolean NOT NULL DEFAULT true,
        created_by uuid NULL,
        updated_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        deleted_at timestamptz NULL,
        deleted_by uuid NULL,
        CONSTRAINT homepage_items_pkey PRIMARY KEY (id)
      )
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS homepage_items_section_order_index
         ON homepage_items (section_key, item_order) WHERE deleted_at IS NULL`,
    );

    // Seed defaults (idempotent — insert only when the table is empty).
    this.addSql(`
      INSERT INTO homepage_settings (setting_key, setting_value, data_type)
      SELECT * FROM (VALUES
        ('hero_headline', 'Caraga State University PMO CORE', 'string'),
        ('hero_subtitle', 'Centralized Operations and Reporting Engine', 'string'),
        ('hero_body', 'PMO CORE is the University''s integrated platform for planning, monitoring, and reporting — bringing infrastructure projects, university operations, and institutional programs into one transparent system managed by the Project Management Office.', 'string'),
        ('about_core_title', 'About PMO CORE', 'string'),
        ('about_core_body', 'CORE stands for Centralized Operations and Reporting Engine. It is maintained by the Project Management Office of Caraga State University as the single source of truth for university project and operations reporting. Records pass through a review-and-approval workflow before publication, and only information approved for public viewing appears on this site.', 'string'),
        ('footer_mission', 'PMO CORE publishes infrastructure and university operations information to promote transparency and accountability across CSU campuses.', 'string'),
        ('contact_address', 'Ampayon, Butuan City, Agusan del Norte', 'string'),
        ('contact_website', 'www.carsu.edu.ph', 'string'),
        ('social_links', '[]', 'json')
      ) AS v(setting_key, setting_value, data_type)
      WHERE NOT EXISTS (SELECT 1 FROM homepage_settings)
    `);

    this.addSql(`
      INSERT INTO homepage_items (section_key, item_order, title, body, icon, link_url, value_source, manual_value)
      SELECT * FROM (VALUES
        ('highlight', 1, 'Centralized Reporting', 'Infrastructure, operations, and program reporting unified in one university-wide platform.', 'mdi-database-outline', NULL, 'manual', NULL),
        ('highlight', 2, 'Transparent Governance', 'Every published record passes a review-and-approval workflow before public release.', 'mdi-scale-balance', NULL, 'manual', NULL),
        ('highlight', 3, 'Quarterly Publication', 'Accomplishments and progress are reported on a quarterly cycle aligned with national standards.', 'mdi-calendar-check-outline', NULL, 'manual', NULL),
        ('faq', 1, 'What is PMO CORE?', 'PMO CORE (Centralized Operations and Reporting Engine) is the public transparency portal of the Project Management Office of Caraga State University. It publishes information on infrastructure projects, repairs, and university operations across CSU campuses.', NULL, NULL, NULL, NULL),
        ('faq', 2, 'Who maintains the data?', 'Records are entered and maintained by authorized PMO personnel. Each record passes through a review-and-approval workflow before it is published.', NULL, NULL, NULL, NULL),
        ('faq', 3, 'How often is the information updated?', 'Reporting follows a quarterly cycle aligned with university and national budget-reporting standards. Individual project records may be updated more frequently as progress reports are filed.', NULL, NULL, NULL, NULL),
        ('faq', 4, 'Why are some projects not shown here?', 'Only records approved for public viewing appear on this site. Drafts, records under review, and internal working documents are not published.', NULL, NULL, NULL, NULL),
        ('faq', 5, 'Who can edit the data?', 'Only authenticated PMO staff with the appropriate role can create or modify records. Public visitors have read-only access to published information.', NULL, NULL, NULL, NULL),
        ('quick_link', 1, 'Published Projects', 'Browse published infrastructure projects across all campuses.', 'mdi-office-building-outline', '/coi/public', NULL, NULL),
        ('quick_link', 2, 'Staff Sign In', 'Authorized personnel access for data entry and review.', 'mdi-login', '/login', NULL, NULL)
      ) AS v(section_key, item_order, title, body, icon, link_url, value_source, manual_value)
      WHERE NOT EXISTS (SELECT 1 FROM homepage_items)
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS homepage_items`);
    this.addSql(`DROP TABLE IF EXISTS homepage_settings`);
  }
}
