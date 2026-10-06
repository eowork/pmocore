import { Migration } from '@mikro-orm/migrations';

/**
 * Layer 1.5 (Role Permission) — see technical-reference/architecture.md.
 *
 * Seeds the `permissions` catalog + `role_permissions` mapping for the six named
 * actions identified as too fine-grained/rare for the Layer-3 CRUD tiers
 * (Viewer/Contributor/Approver/Manager) to model — each currently gated only by a
 * blanket `@Roles('Admin')`. No `PermissionsGuard`/`@RequirePermission` exists yet;
 * this migration only seeds the catalog so it's ready when that guard is built.
 * ON CONFLICT guards make this idempotent (safe on fresh and existing databases).
 */
export class Migration20260907000000_SeedPermissionsCatalog extends Migration {
  override async up(): Promise<void> {
    // permission.entity.ts declares display_name/module/is_system/created_by, but the
    // live table (schema/coredata_schema.sql) predates those fields and never got them —
    // entity/schema drift unrelated to this seed. Bring the table in line with the
    // entity before inserting. display_name is nullable here (unlike the entity's
    // required type) since we don't know whether pre-existing rows can be backfilled;
    // is_system gets a DEFAULT so existing rows backfill safely under NOT NULL.
    this.addSql(`
      ALTER TABLE permissions
        ADD COLUMN IF NOT EXISTS display_name varchar(255),
        ADD COLUMN IF NOT EXISTS module varchar(100),
        ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS created_by uuid;
    `);
    // Entity declares action as length 100; live column was varchar(50) — widen to match.
    this.addSql(`ALTER TABLE permissions ALTER COLUMN action TYPE varchar(100);`);

    this.addSql(`
      INSERT INTO permissions (name, display_name, description, module, resource, action, is_system, created_at, updated_at)
      VALUES
        ('users.bulk_access_update', 'Bulk Update User Access', 'Mass grant/revoke module, permission, or pillar access across multiple selected users at once.', 'users', 'access', 'bulk_update', true, NOW(), NOW()),
        ('users.unlock_account', 'Unlock User Account', 'Manually clear a failed-login lockout on a user account.', 'users', 'account', 'unlock', true, NOW(), NOW()),
        ('access_requests.bulk_decide', 'Bulk Decide Access Requests', 'Approve or deny multiple pending access requests in one action.', 'access_requests', 'request', 'bulk_decide', true, NOW(), NOW()),
        ('access_requests.bulk_archive', 'Bulk Archive Access Requests', 'Archive multiple access requests in one action.', 'access_requests', 'request', 'bulk_archive', true, NOW(), NOW()),
        ('university_operations.export_report', 'Export University Operations Report', 'Export BAR No. 1/2 Physical or Financial Accomplishment data to PDF or Excel.', 'university_operations', 'report', 'export', true, NOW(), NOW()),
        ('system.manage_homepage', 'Manage Public Homepage', 'Edit the public-facing homepage CMS content (hero, highlights, FAQ, announcements).', 'system', 'homepage', 'manage', true, NOW(), NOW())
      ON CONFLICT (name) DO NOTHING;
    `);

    // Admin gets every seeded permission (parity — Admin already reaches all six
    // routes via @Roles today; this just keeps the catalog consistent so nothing
    // regresses once a PermissionsGuard starts reading role_permissions).
    this.addSql(`
      INSERT INTO role_permissions (role_id, permission_id, created_at)
      SELECT r.id, p.id, NOW()
      FROM roles r, permissions p
      WHERE r.name = 'Admin'
        AND p.name IN (
          'users.bulk_access_update',
          'users.unlock_account',
          'access_requests.bulk_decide',
          'access_requests.bulk_archive',
          'university_operations.export_report',
          'system.manage_homepage'
        )
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    `);
  }

  override async down(): Promise<void> {
    // role_permissions.permission_id has ON DELETE NO ACTION — clear mappings first.
    this.addSql(`
      DELETE FROM role_permissions
      WHERE permission_id IN (
        SELECT id FROM permissions WHERE name IN (
          'users.bulk_access_update',
          'users.unlock_account',
          'access_requests.bulk_decide',
          'access_requests.bulk_archive',
          'university_operations.export_report',
          'system.manage_homepage'
        )
      );
    `);
    this.addSql(`
      DELETE FROM permissions WHERE name IN (
        'users.bulk_access_update',
        'users.unlock_account',
        'access_requests.bulk_decide',
        'access_requests.bulk_archive',
        'university_operations.export_report',
        'system.manage_homepage'
      );
    `);

    this.addSql(`ALTER TABLE permissions ALTER COLUMN action TYPE varchar(50);`);
    this.addSql(`
      ALTER TABLE permissions
        DROP COLUMN IF EXISTS display_name,
        DROP COLUMN IF EXISTS module,
        DROP COLUMN IF EXISTS is_system,
        DROP COLUMN IF EXISTS created_by;
    `);
  }
}
