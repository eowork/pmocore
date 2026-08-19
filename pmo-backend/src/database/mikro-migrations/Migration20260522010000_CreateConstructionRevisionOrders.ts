import { Migration } from '@mikro-orm/migrations';

export class Migration20260522010000_CreateConstructionRevisionOrders extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS construction_revision_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES construction_projects(id),
        revision_number INTEGER NOT NULL,
        revision_type VARCHAR(50) NOT NULL,
        revision_date DATE NOT NULL,
        new_start_date DATE,
        new_completion_date DATE,
        new_duration VARCHAR(100),
        cost_adjustment DECIMAL(15,2),
        justification TEXT,
        approval_status VARCHAR(50),
        mov_document_id UUID,
        mov_link TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by UUID
      )
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS idx_cro_project_date ON construction_revision_orders(project_id, revision_date DESC)`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_cro_project_revnum ON construction_revision_orders(project_id, revision_number)`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS construction_revision_orders`);
  }
}
