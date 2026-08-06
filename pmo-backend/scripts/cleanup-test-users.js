/**
 * Cleanup Script: Remove automated test users
 * Removes users created during Phase BQ testing that were not cleaned up
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'pmo_dashboard',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

async function cleanup() {
  console.log('=== CLEANUP: REMOVING TEST USERS ===\n');

  try {
    // List test users before deletion
    const before = await pool.query(`
      SELECT id, username, email, first_name, last_name, campus, rank_level
      FROM users
      WHERE username LIKE 'bq_%'
    `);

    if (before.rows.length === 0) {
      console.log('✓ No test users found. Database is clean.\n');
      return;
    }

    console.log(`Found ${before.rows.length} test users:\n`);
    before.rows.forEach((u) => {
      console.log(
        `  - ${u.username} (${u.first_name} ${u.last_name}, ${u.campus}, rank ${u.rank_level})`,
      );
    });

    // Delete user_roles first (foreign key constraint)
    const rolesDeleted = await pool.query(`
      DELETE FROM user_roles
      WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'bq_%')
    `);
    console.log(`\n✓ Deleted ${rolesDeleted.rowCount} user_roles entries`);

    // Delete record_assignments
    const assignmentsDeleted = await pool.query(`
      DELETE FROM record_assignments
      WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'bq_%')
    `);
    console.log(
      `✓ Deleted ${assignmentsDeleted.rowCount} record_assignments entries`,
    );

    // Delete users
    const usersDeleted = await pool.query(`
      DELETE FROM users WHERE username LIKE 'bq_%'
    `);
    console.log(`✓ Deleted ${usersDeleted.rowCount} users\n`);

    console.log('=== CLEANUP COMPLETE ===\n');
  } catch (error) {
    console.error('✗ Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanup();
