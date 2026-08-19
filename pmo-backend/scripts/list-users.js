/**
 * List all users in the database
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

async function listUsers() {
  console.log('=== USERS IN DATABASE ===\n');

  try {
    const users = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.campus,
        u.rank_level,
        u.is_active,
        r.name as role_name,
        u.created_at
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `);

    if (users.rows.length === 0) {
      console.log('⚠️  No users found in database.\n');
      console.log('You may need to seed initial users.\n');
      return;
    }

    console.log(`Found ${users.rows.length} active users:\n`);

    users.rows.forEach((u, i) => {
      console.log(`${i + 1}. ${u.username}`);
      console.log(`   Email: ${u.email}`);
      console.log(`   Name: ${u.first_name} ${u.last_name}`);
      console.log(`   Role: ${u.role_name || 'None'}`);
      console.log(`   Campus: ${u.campus || 'Not set'}`);
      console.log(`   Rank: ${u.rank_level || 'Not set'}`);
      console.log(`   Active: ${u.is_active}`);
      console.log(`   Created: ${u.created_at.toISOString().split('T')[0]}`);
      console.log('');
    });

    console.log('=== END OF USER LIST ===\n');
  } catch (error) {
    console.error('✗ Failed to list users:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

listUsers();
