import { Migration } from '@mikro-orm/migrations';

export class Migration20260523020000_CreateContractorSystem extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS contractor_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT,
        full_name TEXT NOT NULL,
        company_name VARCHAR(255),
        phone VARCHAR(30),
        position VARCHAR(150),
        google_id VARCHAR(255) UNIQUE,
        avatar_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS contractor_invite_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
        token VARCHAR(64) UNIQUE NOT NULL,
        target_email VARCHAR(255),
        created_by UUID NOT NULL REFERENCES users(id),
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        accepted_by UUID REFERENCES contractor_users(id),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS project_contractor_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
        contractor_user_id UUID NOT NULL REFERENCES contractor_users(id) ON DELETE CASCADE,
        invite_token_id UUID REFERENCES contractor_invite_tokens(id),
        role VARCHAR(100),
        permissions JSONB,
        assigned_by UUID REFERENCES users(id),
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        removed_at TIMESTAMPTZ,
        UNIQUE(project_id, contractor_user_id)
      )
    `);

    await this.execute(
      `CREATE INDEX IF NOT EXISTS idx_contractor_invite_token ON contractor_invite_tokens(token)`,
    );
    await this.execute(
      `CREATE INDEX IF NOT EXISTS idx_contractor_assignments_project ON project_contractor_assignments(project_id)`,
    );
  }

  async down(): Promise<void> {
    await this.execute(`DROP TABLE IF EXISTS project_contractor_assignments`);
    await this.execute(`DROP TABLE IF EXISTS contractor_invite_tokens`);
    await this.execute(`DROP TABLE IF EXISTS contractor_users`);
  }
}
