import { Migration } from '@mikro-orm/migrations';

/**
 * Phase JW-B: Admin↔Client narrative coverage gap remediation.
 *
 * Adds three narrative TEXT columns (`summary`, `scope`, `facilities`) used by
 * the client prototype's Overview tab, and converts `beneficiaries` from
 * VARCHAR(255) to INTEGER. Existing non-numeric beneficiaries values are
 * coerced to NULL (regex-safe cast) — no row is dropped, no error is raised.
 */
export class Migration20260507120000_AddNarrativeFields extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE construction_projects
         ADD COLUMN IF NOT EXISTS summary TEXT,
         ADD COLUMN IF NOT EXISTS scope TEXT,
         ADD COLUMN IF NOT EXISTS facilities TEXT;`,
    );

    // Guard: only cast when column is still VARCHAR (createSchema already creates it as INTEGER)
    this.addSql(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'construction_projects'
            AND column_name = 'beneficiaries'
            AND data_type = 'character varying'
        ) THEN
          ALTER TABLE construction_projects
            ALTER COLUMN beneficiaries TYPE INTEGER
            USING (CASE
                     WHEN beneficiaries IS NULL OR beneficiaries = '' THEN NULL
                     WHEN beneficiaries ~ '^[0-9]+$' THEN beneficiaries::INTEGER
                     ELSE NULL
                   END);
        END IF;
      END $$;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE construction_projects
         ALTER COLUMN beneficiaries TYPE VARCHAR(255)
         USING beneficiaries::VARCHAR(255);`,
    );

    this.addSql(
      `ALTER TABLE construction_projects
         DROP COLUMN IF EXISTS facilities,
         DROP COLUMN IF EXISTS scope,
         DROP COLUMN IF EXISTS summary;`,
    );
  }
}
