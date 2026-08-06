import { Migration } from '@mikro-orm/migrations';

export class Migration20260523010000_ExtendRecordAssignmentPermissions extends Migration {
  isTransactional(): boolean {
    return true;
  }

  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE record_assignments
        ADD COLUMN IF NOT EXISTS project_role VARCHAR(100),
        ADD COLUMN IF NOT EXISTS permissions JSONB;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE record_assignments
        DROP COLUMN IF EXISTS project_role,
        DROP COLUMN IF EXISTS permissions;
    `);
  }
}
