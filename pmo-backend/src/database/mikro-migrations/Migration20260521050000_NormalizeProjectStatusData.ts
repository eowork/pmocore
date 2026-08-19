import { Migration } from '@mikro-orm/migrations';

/**
 * Phase MF (split B): Normalize legacy status values to the new canonical names.
 *
 * Depends on Migration20260521040000 having committed the new enum values
 * PROPOSAL and COMPLETE on project_status_enum. Runs transactionally.
 *
 * Updates the two tables that actually use `project_status_enum`:
 *   - construction_projects.status
 *   - projects.status
 *
 * NOTE: `repair_projects.status` uses a DIFFERENT enum (`repair_status_enum`)
 * with its own value set (e.g. PENDING / IN_PROGRESS / COMPLETED / etc. — no
 * `PLANNING`). The MikroORM snapshot at .snapshot-pmo_dashboard.json line 35477
 * incorrectly reports it as `project_status_enum`; the live DB is authoritative.
 * Repair projects intentionally retain their own status taxonomy and are not
 * normalized here.
 */
export class Migration20260521050000_NormalizeProjectStatusData extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `UPDATE construction_projects SET status = 'PROPOSAL' WHERE status = 'PLANNING'`,
    );
    this.addSql(
      `UPDATE construction_projects SET status = 'COMPLETE' WHERE status = 'COMPLETED'`,
    );
    this.addSql(
      `UPDATE projects SET status = 'PROPOSAL' WHERE status = 'PLANNING'`,
    );
    this.addSql(
      `UPDATE projects SET status = 'COMPLETE' WHERE status = 'COMPLETED'`,
    );
  }

  async down(): Promise<void> {
    this.addSql(
      `UPDATE construction_projects SET status = 'PLANNING' WHERE status = 'PROPOSAL'`,
    );
    this.addSql(
      `UPDATE construction_projects SET status = 'COMPLETED' WHERE status = 'COMPLETE'`,
    );
    this.addSql(
      `UPDATE projects SET status = 'PLANNING' WHERE status = 'PROPOSAL'`,
    );
    this.addSql(
      `UPDATE projects SET status = 'COMPLETED' WHERE status = 'COMPLETE'`,
    );
  }
}
