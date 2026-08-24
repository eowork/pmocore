import { Migration } from '@mikro-orm/migrations';

/**
 * T-HOME-CMS-8 (TH8-5) — Featured Projects CMS curation. `linked_project_id`
 * is a plain UUID column (no FK), resolved manually in the service layer —
 * same pattern as `homepage_items.media_id` (RH5's precedent). Cards link to
 * a real, published construction_projects row so campus/status/budget/
 * completion always come from the governed COI record, never duplicated
 * (RH8-5 — avoids a second, driftable source of truth for those figures).
 */
export class Migration20260712000000_AddLinkedProjectToHomepageItems extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE homepage_items ADD COLUMN IF NOT EXISTS linked_project_id UUID NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE homepage_items DROP COLUMN IF EXISTS linked_project_id;`,
    );
  }
}
