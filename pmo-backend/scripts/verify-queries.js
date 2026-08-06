/**
 * Query Verification Script
 * Tests that record_assignments queries work correctly
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function verifyQueries() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'pmo_dashboard',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  });

  const tests = [
    {
      name: 'Construction Projects findAll',
      query: `
        SELECT cp.id, cp.title,
               (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)), '[]'::json)
                FROM record_assignments ra JOIN users u ON ra.user_id = u.id
                WHERE ra.module = 'CONSTRUCTION' AND ra.record_id = cp.id) as assigned_users
        FROM construction_projects cp
        WHERE cp.deleted_at IS NULL
        LIMIT 3
      `,
    },
    {
      name: 'Repair Projects findAll',
      query: `
        SELECT rp.id, rp.title,
               (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)), '[]'::json)
                FROM record_assignments ra JOIN users u ON ra.user_id = u.id
                WHERE ra.module = 'REPAIR' AND ra.record_id = rp.id) as assigned_users
        FROM repair_projects rp
        WHERE rp.deleted_at IS NULL
        LIMIT 3
      `,
    },
    {
      name: 'University Operations findAll',
      query: `
        SELECT uo.id, uo.title,
               (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)), '[]'::json)
                FROM record_assignments ra JOIN users u ON ra.user_id = u.id
                WHERE ra.module = 'OPERATIONS' AND ra.record_id = uo.id) as assigned_users
        FROM university_operations uo
        WHERE uo.deleted_at IS NULL
        LIMIT 3
      `,
    },
  ];

  let allPassed = true;

  for (const test of tests) {
    try {
      const result = await pool.query(test.query);
      console.log(`✓ ${test.name}: SUCCESS (${result.rows.length} rows)`);
    } catch (error) {
      console.log(`✗ ${test.name}: FAILED - ${error.message}`);
      allPassed = false;
    }
  }

  await pool.end();

  if (allPassed) {
    console.log(
      '\n✓ All queries passed - record_assignments table working correctly',
    );
    process.exit(0);
  } else {
    console.log('\n✗ Some queries failed');
    process.exit(1);
  }
}

verifyQueries();
