/**
 * Create Test Users for Authorization Tests
 *
 * Creates two test users with known passwords:
 * - admin@test.com / admin123 (Admin)
 * - staff@test.com / staff123 (Staff)
 *
 * Usage: node scripts/create-test-users.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'pmo_dashboard',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

async function createTestUsers() {
  console.log('\n=== Creating Test Users for Authorization Tests ===\n');

  try {
    // Get role IDs
    const rolesResult = await pool.query(
      'SELECT id, name FROM roles WHERE deleted_at IS NULL',
    );
    const roles = {};
    rolesResult.rows.forEach((row) => {
      roles[row.name] = row.id;
    });

    if (!roles['Admin'] || !roles['Staff']) {
      console.error('❌ Admin or Staff role not found in database');
      process.exit(1);
    }

    // Hash passwords
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const staffPasswordHash = await bcrypt.hash('staff123', 10);

    // Check if users already exist
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      ['admin@test.com'],
    );

    const existingStaff = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      ['staff@test.com'],
    );

    // Create admin user if doesn't exist
    let adminUserId;
    if (existingAdmin.rowCount === 0) {
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, campus, rank_level, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         RETURNING id`,
        [
          'admin',
          'admin@test.com',
          adminPasswordHash,
          'Test',
          'Admin',
          'Butuan Campus',
          10,
        ],
      );
      adminUserId = result.rows[0].id;

      // Assign Admin role
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, is_superadmin, assigned_at, created_at)
         VALUES ($1, $2, false, NOW(), NOW())`,
        [adminUserId, roles['Admin']],
      );

      console.log('✅ Created admin@test.com (password: admin123)');
    } else {
      // Update password for existing user
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
        [adminPasswordHash, 'admin@test.com'],
      );
      console.log('✅ Updated admin@test.com (password: admin123)');
    }

    // Create staff user if doesn't exist
    let staffUserId;
    if (existingStaff.rowCount === 0) {
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, campus, rank_level, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         RETURNING id`,
        [
          'staff',
          'staff@test.com',
          staffPasswordHash,
          'Test',
          'Staff',
          'Cabadbaran',
          70,
        ],
      );
      staffUserId = result.rows[0].id;

      // Assign Staff role
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, is_superadmin, assigned_at, created_at)
         VALUES ($1, $2, false, NOW(), NOW())`,
        [staffUserId, roles['Staff']],
      );

      console.log('✅ Created staff@test.com (password: staff123)');
    } else {
      // Update password for existing user
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
        [staffPasswordHash, 'staff@test.com'],
      );
      console.log('✅ Updated staff@test.com (password: staff123)');
    }

    console.log('\n=== Test Users Ready ===');
    console.log(
      'You can now run: node scripts/test-authorization-cm-cn-co.js\n',
    );
  } catch (error) {
    console.error('Error creating test users:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTestUsers();
