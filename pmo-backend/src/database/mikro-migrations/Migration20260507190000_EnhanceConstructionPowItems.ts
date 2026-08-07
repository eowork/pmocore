import { Migration } from '@mikro-orm/migrations';

/**
 * Phase JY-B: Add Phase JU-B entity columns missing from construction_pow_items.
 *
 * `construction_pow_items` was bootstrapped from a draft schema that predated the
 * Phase JU-B entity redesign.  Migration20260507170000_AddConstructionPowItems
 * used CREATE TABLE IF NOT EXISTS — since the table already existed, that
 * migration was a silent no-op and the new columns were never written to the DB.
 *
 * This migration adds the missing columns via ALTER TABLE so the ORM queries
 * (which reference sort_order, progress, etc.) can succeed.
 *
 * All additions are IF NOT EXISTS so re-running is safe.
 */
export class Migration20260507190000_EnhanceConstructionPowItems extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE construction_pow_items
         ADD COLUMN IF NOT EXISTS progress               DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
         ADD COLUMN IF NOT EXISTS sort_order             INTEGER       NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS start_date             DATE,
         ADD COLUMN IF NOT EXISTS end_date               DATE,
         ADD COLUMN IF NOT EXISTS project_duration       VARCHAR(100),
         ADD COLUMN IF NOT EXISTS variance               DECIMAL(15,2),
         ADD COLUMN IF NOT EXISTS estimated_project_cost DECIMAL(15,2),
         ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW();`,
    );

    this.addSql(
      `COMMENT ON COLUMN construction_pow_items.progress IS
         'Percent completion of this POW item (0–100)';`,
    );
    this.addSql(
      `COMMENT ON COLUMN construction_pow_items.sort_order IS
         'Display order (ascending); ORM orders by sort_order ASC, created_at ASC';`,
    );
    this.addSql(
      `COMMENT ON COLUMN construction_pow_items.estimated_project_cost IS
         'Total estimated cost (material + labor, or standalone figure)';`,
    );
    this.addSql(
      `COMMENT ON COLUMN construction_pow_items.variance IS
         'Variance between estimated and actual cost';`,
    );

    // Index for ordering — avoids seq scan on the sort_order + created_at orderBy
    this.addSql(
      `CREATE INDEX IF NOT EXISTS idx_construction_pow_items_order
         ON construction_pow_items (project_id, sort_order ASC, created_at ASC);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS idx_construction_pow_items_order;`);
    this.addSql(
      `ALTER TABLE construction_pow_items
         DROP COLUMN IF EXISTS updated_at,
         DROP COLUMN IF EXISTS estimated_project_cost,
         DROP COLUMN IF EXISTS variance,
         DROP COLUMN IF EXISTS project_duration,
         DROP COLUMN IF EXISTS end_date,
         DROP COLUMN IF EXISTS start_date,
         DROP COLUMN IF EXISTS sort_order,
         DROP COLUMN IF EXISTS progress;`,
    );
  }
}
