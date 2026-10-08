import { Migration } from '@mikro-orm/migrations';

/**
 * Give each campus its own quarterly row for every indicator.
 *
 * Until now one row held a pillar indicator's figures for a fiscal year and quarter, with no way
 * to say which campus reported them — university_operations.campus exists but every record is
 * MAIN, and the page that creates operations hardcodes it. Campus moves onto the indicator row
 * so a third campus is a value rather than a migration.
 *
 * Existing rows are backfilled from their owning operation's campus, which is MAIN throughout.
 *
 * The unique index includes operation_id. Without it the index would fail on existing data:
 * six (indicator, fiscal year, quarter) groups span more than one operation, ten rows in all.
 * With it there are no duplicates today, so the index applies cleanly.
 */
export class Migration20261007000000_AddCampusToOperationIndicators extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE operation_indicators
        ADD COLUMN IF NOT EXISTS campus VARCHAR(100)
    `);

    // Backfill from the owning operation, then make the column required. Done in this order so
    // the NOT NULL is added against rows that already have a value.
    this.addSql(`
      UPDATE operation_indicators oi
         SET campus = uo.campus
        FROM university_operations uo
       WHERE uo.id = oi.operation_id
         AND oi.campus IS NULL
    `);

    // An indicator row whose operation has somehow gone misses the join above. MAIN is the
    // only campus in use, so it is the safe landing place rather than leaving the column null.
    this.addSql(`
      UPDATE operation_indicators SET campus = 'MAIN' WHERE campus IS NULL
    `);

    this.addSql(`
      ALTER TABLE operation_indicators
        ALTER COLUMN campus SET NOT NULL
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_oi_campus
        ON operation_indicators (campus)
    `);

    // One row per campus per quarter per indicator. Soft-deleted rows are excluded so a record
    // can be deleted and re-entered; Postgres treats NULLs as distinct, so an orphaned row
    // (pillar_indicator_id NULL) is not policed by this index.
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_oi_campus_quarter
        ON operation_indicators (operation_id, pillar_indicator_id, fiscal_year, reported_quarter, campus)
        WHERE deleted_at IS NULL
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS uq_oi_campus_quarter`);
    this.addSql(`DROP INDEX IF EXISTS idx_oi_campus`);
    this.addSql(
      `ALTER TABLE operation_indicators DROP COLUMN IF EXISTS campus`,
    );
  }
}
