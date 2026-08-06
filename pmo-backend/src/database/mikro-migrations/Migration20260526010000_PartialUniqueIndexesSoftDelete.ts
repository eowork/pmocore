import { Migration } from '@mikro-orm/migrations';

export class Migration20260526010000_PartialUniqueIndexesSoftDelete extends Migration {
  async up(): Promise<void> {
    // ZL: Replace full-table UNIQUE constraints with partial UNIQUE indexes.
    // Soft-deleted users (deleted_at IS NOT NULL) are excluded from uniqueness checks,
    // allowing re-registration of a previously-deleted email/username.

    // Drop full-table unique constraints that include soft-deleted rows
    await this.execute(
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`,
    );
    await this.execute(
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique`,
    );
    await this.execute(
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_google_id_key`,
    );

    // Partial unique index: email uniqueness enforced only for active (non-deleted) users
    await this.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_unique
        ON users(email)
        WHERE deleted_at IS NULL
    `);

    // Partial unique index: username uniqueness enforced only for active (non-deleted) users
    await this.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_unique
        ON users(username)
        WHERE deleted_at IS NULL
    `);

    // Partial unique index: google_id uniqueness enforced only for active non-null entries
    await this.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_active_unique
        ON users(google_id)
        WHERE deleted_at IS NULL AND google_id IS NOT NULL
    `);
  }

  async down(): Promise<void> {
    await this.execute(`DROP INDEX IF EXISTS users_email_active_unique`);
    await this.execute(`DROP INDEX IF EXISTS users_username_active_unique`);
    await this.execute(`DROP INDEX IF EXISTS users_google_id_active_unique`);

    await this.execute(
      `ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email)`,
    );
    await this.execute(
      `ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username)`,
    );
    await this.execute(
      `ALTER TABLE users ADD CONSTRAINT users_google_id_key UNIQUE (google_id)`,
    );
  }
}
