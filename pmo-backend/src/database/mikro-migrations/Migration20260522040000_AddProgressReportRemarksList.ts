import { Migration } from '@mikro-orm/migrations';

export class Migration20260522040000_AddProgressReportRemarksList extends Migration {
  isTransactional(): boolean {
    return true;
  }

  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE construction_progress_reports
        ADD COLUMN IF NOT EXISTS narrative_list JSONB NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS remarks_list JSONB NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS issues_encountered_list JSONB NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS mitigation_actions_list JSONB NOT NULL DEFAULT '[]';
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE construction_progress_reports
        DROP COLUMN IF EXISTS narrative_list,
        DROP COLUMN IF EXISTS remarks_list,
        DROP COLUMN IF EXISTS issues_encountered_list,
        DROP COLUMN IF EXISTS mitigation_actions_list;
    `);
  }
}
