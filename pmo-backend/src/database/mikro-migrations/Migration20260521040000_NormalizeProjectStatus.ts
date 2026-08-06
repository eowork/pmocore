import { Migration } from '@mikro-orm/migrations';

/**
 * Phase MF (split A): Add new enum values to project_status_enum.
 *
 * IMPORTANT: PostgreSQL forbids using a newly-added enum value in the same
 * transaction in which it was added. This migration runs OUTSIDE a transaction
 * via `isTransactional() = false` so that the new values are committed before
 * the data normalization migration (Migration20260521050000) tries to use them.
 *
 * Tables using project_status_enum: construction_projects.status,
 * projects.status, repair_projects.status — all three are normalized in
 * Migration20260521050000_NormalizeProjectStatusData.
 */
export class Migration20260521040000_NormalizeProjectStatus extends Migration {
  override isTransactional(): boolean {
    return false;
  }

  async up(): Promise<void> {
    this.addSql(
      `ALTER TYPE project_status_enum ADD VALUE IF NOT EXISTS 'PROPOSAL'`,
    );
    this.addSql(
      `ALTER TYPE project_status_enum ADD VALUE IF NOT EXISTS 'COMPLETE'`,
    );
  }

  async down(): Promise<void> {
    // PostgreSQL does not support removing values from an enum type.
    // Down-migration is intentionally a no-op; rollback requires manual schema work.
  }
}
