import { Migration } from '@mikro-orm/migrations';

/**
 * T-HOME-CMS-11 (TH11-2) — Featured News: decouples featured_project from
 * COI (campus/status/budget/completion become plain optional text, same
 * pattern as T-HOME-CMS-9's unimplemented TH9-1) and adds the fields this
 * track's directive requires (subtitle, full description, author,
 * department, publish date, featured flag). All additive; `linked_project_id`
 * (T-HOME-CMS-8) stays in place, unused going forward.
 */
export class Migration20260713000000_FeaturedNewsFields extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE homepage_items
        ADD COLUMN IF NOT EXISTS subtitle VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS full_description TEXT NULL,
        ADD COLUMN IF NOT EXISTS author VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS department VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS publish_date DATE NULL,
        ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS status_text VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS campus_text VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS budget_text VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS completion_text VARCHAR(50) NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE homepage_items
        DROP COLUMN IF EXISTS subtitle,
        DROP COLUMN IF EXISTS full_description,
        DROP COLUMN IF EXISTS author,
        DROP COLUMN IF EXISTS department,
        DROP COLUMN IF EXISTS publish_date,
        DROP COLUMN IF EXISTS is_featured,
        DROP COLUMN IF EXISTS status_text,
        DROP COLUMN IF EXISTS campus_text,
        DROP COLUMN IF EXISTS budget_text,
        DROP COLUMN IF EXISTS completion_text;
    `);
  }
}
