import { Migration } from '@mikro-orm/migrations';

export class Migration20260522020000_CreateConstructionProgressReports extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS construction_progress_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES construction_projects(id),
        report_type VARCHAR(20) NOT NULL,
        report_date DATE NOT NULL,
        report_number VARCHAR(20),
        percentage_completion DECIMAL(5,2) NOT NULL DEFAULT 0,
        planned_accomplishment DECIMAL(5,2),
        slippage DECIMAL(5,2),
        cost_incurred_to_date DECIMAL(15,2),
        cost_incurred_this_period DECIMAL(15,2),
        calendar_days_elapsed INTEGER,
        percent_time_elapsed DECIMAL(5,2),
        remarks TEXT,
        issues_encountered TEXT,
        mitigation_actions TEXT,
        mov_document_id UUID,
        mov_link TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by UUID
      )
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS idx_cpr_project_date ON construction_progress_reports(project_id, report_date DESC)`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS construction_progress_reports`);
  }
}
