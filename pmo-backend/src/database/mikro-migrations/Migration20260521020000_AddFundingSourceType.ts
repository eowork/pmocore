import { Migration } from '@mikro-orm/migrations';

export class Migration20260521020000_AddFundingSourceType extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS type VARCHAR(20)`,
    );

    this.addSql(`
      INSERT INTO funding_sources (id, name, type, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'Regular Agency Fund', 'INTERNAL', NOW(), NOW()),
        (gen_random_uuid(), 'Business Related Fund', 'INTERNAL', NOW(), NOW()),
        (gen_random_uuid(), 'Internally Generated Fund', 'INTERNAL', NOW(), NOW()),
        (gen_random_uuid(), 'Trust Receipts / Inter-Agency Transferred Fund', 'EXTERNAL', NOW(), NOW()),
        (gen_random_uuid(), 'GAA (General Appropriations Act)', 'EXTERNAL', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
  }

  async down(): Promise<void> {
    this.addSql(`ALTER TABLE funding_sources DROP COLUMN IF EXISTS type`);
  }
}
