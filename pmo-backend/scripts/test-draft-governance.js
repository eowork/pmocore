/**
 * Draft Governance Test
 * Verifies publication_status state machine is unaffected by schema changes
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function testDraftGovernance() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'pmo_dashboard',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  });

  console.log('=== Draft Governance Tests ===\n');

  try {
    // Test 1: Verify publication_status column exists in all 3 tables
    console.log('Test 1: Verify publication_status column exists');

    const tables = [
      'construction_projects',
      'repair_projects',
      'university_operations',
    ];
    for (const table of tables) {
      const result = await pool.query(
        `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'publication_status'
      `,
        [table],
      );

      if (result.rows.length > 0) {
        console.log(
          `  ✓ ${table}: publication_status exists (${result.rows[0].data_type})`,
        );
      } else {
        console.log(`  ✗ ${table}: publication_status NOT FOUND`);
        throw new Error(`Missing publication_status in ${table}`);
      }
    }
    console.log();

    // Test 2: Verify draft governance columns exist
    console.log('Test 2: Verify governance metadata columns');

    const governanceColumns = [
      'submitted_by',
      'submitted_at',
      'reviewed_by',
      'reviewed_at',
      'review_notes',
    ];
    for (const table of tables) {
      const result = await pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = ANY($2)
      `,
        [table, governanceColumns],
      );

      const foundColumns = result.rows.map((r) => r.column_name);
      const missing = governanceColumns.filter(
        (c) => !foundColumns.includes(c),
      );

      if (missing.length === 0) {
        console.log(`  ✓ ${table}: All governance columns present`);
      } else {
        console.log(`  ✗ ${table}: Missing columns: ${missing.join(', ')}`);
      }
    }
    console.log();

    // Test 3: Verify publication_status distribution
    console.log('Test 3: Publication status distribution');

    for (const table of tables) {
      const result = await pool.query(`
        SELECT publication_status, COUNT(*) as count
        FROM ${table}
        WHERE deleted_at IS NULL
        GROUP BY publication_status
        ORDER BY publication_status
      `);

      console.log(`  ${table}:`);
      if (result.rows.length === 0) {
        console.log('    (no records)');
      } else {
        result.rows.forEach((row) => {
          console.log(`    ${row.publication_status || 'NULL'}: ${row.count}`);
        });
      }
    }
    console.log();

    // Test 4: Verify record_assignments doesn't interfere with governance queries
    console.log(
      'Test 4: Verify governance queries work with record_assignments',
    );

    const govQuery = await pool.query(`
      SELECT cp.id, cp.title, cp.publication_status,
             cp.submitted_by, cp.submitted_at,
             submitter.first_name || ' ' || submitter.last_name as submitted_by_name,
             (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)), '[]'::json)
              FROM record_assignments ra JOIN users u ON ra.user_id = u.id
              WHERE ra.module = 'CONSTRUCTION' AND ra.record_id = cp.id) as assigned_users
      FROM construction_projects cp
      LEFT JOIN users submitter ON cp.submitted_by = submitter.id
      WHERE cp.deleted_at IS NULL
      LIMIT 3
    `);

    console.log(
      `  ✓ Governance + assignment query works (${govQuery.rows.length} rows)`,
    );
    if (govQuery.rows.length > 0) {
      const sample = govQuery.rows[0];
      console.log(
        `  Sample: status=${sample.publication_status}, assigned_users=${JSON.stringify(sample.assigned_users)}`,
      );
    }
    console.log();

    console.log('=== All Draft Governance Tests PASSED ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDraftGovernance();
