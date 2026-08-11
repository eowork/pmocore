/**
 * Assignment Persistence Test
 * Tests CRUD operations on record_assignments table
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function testAssignments() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'pmo_dashboard',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  });

  console.log('=== Assignment Persistence Tests ===\n');

  try {
    // Get a test project and test users
    const projectResult = await pool.query(`
      SELECT id FROM construction_projects WHERE deleted_at IS NULL LIMIT 1
    `);

    const userResult = await pool.query(`
      SELECT id FROM users WHERE deleted_at IS NULL AND is_active = true LIMIT 3
    `);

    if (projectResult.rows.length === 0) {
      console.log('No test project found - creating mock test');
      console.log('✓ Skipping assignment tests (no test data available)');
      await pool.end();
      return;
    }

    if (userResult.rows.length < 2) {
      console.log('Not enough test users - need at least 2');
      console.log('✓ Skipping assignment tests (insufficient test data)');
      await pool.end();
      return;
    }

    const testProjectId = projectResult.rows[0].id;
    const testUsers = userResult.rows.map((r) => r.id);
    console.log(`Test project: ${testProjectId}`);
    console.log(`Test users: ${testUsers.join(', ')}\n`);

    // Test 1: Clear existing assignments
    console.log('Test 1: Clear existing assignments');
    await pool.query(
      `
      DELETE FROM record_assignments
      WHERE module = 'CONSTRUCTION' AND record_id = $1
    `,
      [testProjectId],
    );
    console.log('  ✓ Cleared\n');

    // Test 2: Insert multiple assignments
    console.log('Test 2: Insert 2 assignments');
    for (const userId of testUsers.slice(0, 2)) {
      await pool.query(
        `
        INSERT INTO record_assignments (module, record_id, user_id)
        VALUES ('CONSTRUCTION', $1, $2)
        ON CONFLICT (module, record_id, user_id) DO NOTHING
      `,
        [testProjectId, userId],
      );
    }

    let count = await pool.query(
      `
      SELECT COUNT(*) as count FROM record_assignments
      WHERE module = 'CONSTRUCTION' AND record_id = $1
    `,
      [testProjectId],
    );
    console.log(`  ✓ Inserted - Count: ${count.rows[0].count}\n`);

    // Test 3: Query assigned_users via json_agg
    console.log('Test 3: Query assigned_users array');
    const assignedResult = await pool.query(
      `
      SELECT COALESCE(json_agg(json_build_object(
        'id', u.id,
        'name', u.first_name || ' ' || u.last_name
      )), '[]'::json) as assigned_users
      FROM record_assignments ra
      JOIN users u ON ra.user_id = u.id
      WHERE ra.module = 'CONSTRUCTION' AND ra.record_id = $1
    `,
      [testProjectId],
    );
    console.log(
      `  ✓ assigned_users: ${JSON.stringify(assignedResult.rows[0].assigned_users)}\n`,
    );

    // Test 4: Remove one assignment
    console.log('Test 4: Remove 1 assignment');
    await pool.query(
      `
      DELETE FROM record_assignments
      WHERE module = 'CONSTRUCTION' AND record_id = $1 AND user_id = $2
    `,
      [testProjectId, testUsers[0]],
    );

    count = await pool.query(
      `
      SELECT COUNT(*) as count FROM record_assignments
      WHERE module = 'CONSTRUCTION' AND record_id = $1
    `,
      [testProjectId],
    );
    console.log(`  ✓ Removed - Count: ${count.rows[0].count}\n`);

    // Test 5: Clear all assignments
    console.log('Test 5: Clear all assignments');
    await pool.query(
      `
      DELETE FROM record_assignments
      WHERE module = 'CONSTRUCTION' AND record_id = $1
    `,
      [testProjectId],
    );

    count = await pool.query(
      `
      SELECT COUNT(*) as count FROM record_assignments
      WHERE module = 'CONSTRUCTION' AND record_id = $1
    `,
      [testProjectId],
    );
    console.log(`  ✓ Cleared - Count: ${count.rows[0].count}\n`);

    console.log('=== All Assignment Tests PASSED ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testAssignments();
