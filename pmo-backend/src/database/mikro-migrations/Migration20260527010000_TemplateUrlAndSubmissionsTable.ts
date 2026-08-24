import { Migration } from '@mikro-orm/migrations';

export class Migration20260527010000_TemplateUrlAndSubmissionsTable extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      ALTER TABLE construction_document_types
        ADD COLUMN IF NOT EXISTS template_url TEXT NULL;
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS construction_document_submissions (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        checklist_item_id UUID        NOT NULL REFERENCES construction_document_checklist(id),
        project_id        UUID        NOT NULL,
        document_id       UUID        NOT NULL REFERENCES documents(id),
        version           INTEGER     NOT NULL,
        submitted_by      UUID        NOT NULL REFERENCES users(id),
        submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submission_notes  TEXT        NULL,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.execute(`
      CREATE INDEX IF NOT EXISTS idx_doc_submissions_checklist
        ON construction_document_submissions(checklist_item_id);
    `);

    await this.execute(`
      CREATE INDEX IF NOT EXISTS idx_doc_submissions_project
        ON construction_document_submissions(project_id);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`DROP INDEX IF EXISTS idx_doc_submissions_project;`);
    await this.execute(`DROP INDEX IF EXISTS idx_doc_submissions_checklist;`);
    await this.execute(
      `DROP TABLE IF EXISTS construction_document_submissions;`,
    );
    await this.execute(`
      ALTER TABLE construction_document_types DROP COLUMN IF EXISTS template_url;
    `);
  }
}
