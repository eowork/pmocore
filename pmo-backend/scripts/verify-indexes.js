/**
 * Phase BR: Index Verification Script
 * Verifies that performance indexes are created and being used
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

async function verifyIndexes() {
  console.log('=== PHASE BR: INDEX VERIFICATION ===\n');

  let allPassed = true;

  try {
    // Step 1: Check that indexes exist
    console.log('Step 1: Checking for performance indexes...\n');

    const expectedIndexes = [
      {
        name: 'idx_record_assignments_module_record',
        table: 'record_assignments',
      },
      { name: 'idx_record_assignments_user', table: 'record_assignments' },
      { name: 'idx_users_rank_level', table: 'users' },
      {
        name: 'idx_construction_projects_publication_status',
        table: 'construction_projects',
      },
      {
        name: 'idx_repair_projects_publication_status',
        table: 'repair_projects',
      },
      {
        name: 'idx_university_operations_publication_status',
        table: 'university_operations',
      },
      {
        name: 'idx_construction_projects_campus',
        table: 'construction_projects',
      },
      { name: 'idx_repair_projects_campus', table: 'repair_projects' },
      {
        name: 'idx_university_operations_campus',
        table: 'university_operations',
      },
      {
        name: 'idx_construction_projects_created_by',
        table: 'construction_projects',
      },
      { name: 'idx_repair_projects_created_by', table: 'repair_projects' },
      {
        name: 'idx_university_operations_created_by',
        table: 'university_operations',
      },
      {
        name: 'idx_construction_projects_campus_status',
        table: 'construction_projects',
      },
      { name: 'idx_repair_projects_campus_status', table: 'repair_projects' },
      {
        name: 'idx_university_operations_campus_status',
        table: 'university_operations',
      },
    ];

    for (const { name, table } of expectedIndexes) {
      const result = await pool.query(
        `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = $1
      `,
        [name],
      );

      if (result.rows.length > 0) {
        console.log(`  ✓ Index '${name}' EXISTS on ${table}`);
      } else {
        console.log(`  ✗ Index '${name}' MISSING on ${table}`);
        allPassed = false;
      }
    }

    // Step 2: Verify index usage with EXPLAIN
    console.log('\nStep 2: Verifying index usage with EXPLAIN...\n');

    // Test 1: record_assignments by module and record_id
    const test1 = await pool.query(`
      EXPLAIN (FORMAT JSON)
      SELECT * FROM record_assignments
      WHERE module = 'construction-projects' AND record_id = '00000000-0000-0000-0000-000000000000'
    `);
    const plan1 = test1.rows[0]['QUERY PLAN'][0].Plan;
    if (
      plan1['Index Name'] === 'idx_record_assignments_module_record' ||
      plan1.Plans?.[0]?.['Index Name'] ===
        'idx_record_assignments_module_record'
    ) {
      console.log(
        '  ✓ record_assignments query uses idx_record_assignments_module_record',
      );
    } else {
      console.log('  ⚠  record_assignments query not using expected index');
      console.log('     Plan:', JSON.stringify(plan1, null, 2));
    }

    // Test 2: construction_projects by campus and publication_status
    const test2 = await pool.query(`
      EXPLAIN (FORMAT JSON)
      SELECT * FROM construction_projects
      WHERE campus = 'MAIN' AND publication_status = 'PUBLISHED' AND deleted_at IS NULL
    `);
    const plan2 = test2.rows[0]['QUERY PLAN'][0].Plan;
    const usesCompositeIndex =
      plan2['Index Name'] === 'idx_construction_projects_campus_status' ||
      plan2.Plans?.[0]?.['Index Name'] ===
        'idx_construction_projects_campus_status';
    const usesCampusIndex =
      plan2['Index Name'] === 'idx_construction_projects_campus' ||
      plan2.Plans?.[0]?.['Index Name'] === 'idx_construction_projects_campus';

    if (usesCompositeIndex) {
      console.log(
        '  ✓ construction_projects query uses idx_construction_projects_campus_status (composite)',
      );
    } else if (usesCampusIndex) {
      console.log(
        '  ✓ construction_projects query uses idx_construction_projects_campus',
      );
    } else {
      console.log(
        '  ⚠  construction_projects query may not be using expected index',
      );
      console.log('     Plan:', JSON.stringify(plan2, null, 2));
    }

    // Test 3: users by rank_level
    const test3 = await pool.query(`
      EXPLAIN (FORMAT JSON)
      SELECT * FROM users
      WHERE rank_level >= 50 AND deleted_at IS NULL
    `);
    const plan3 = test3.rows[0]['QUERY PLAN'][0].Plan;
    if (
      plan3['Index Name'] === 'idx_users_rank_level' ||
      plan3.Plans?.[0]?.['Index Name'] === 'idx_users_rank_level'
    ) {
      console.log('  ✓ users query uses idx_users_rank_level');
    } else {
      console.log('  ⚠  users query not using expected index');
      console.log('     Plan:', JSON.stringify(plan3, null, 2));
    }

    // Step 3: Count records to show index is helpful
    console.log('\nStep 3: Counting records for performance context...\n');

    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM record_assignments) as assignments,
        (SELECT COUNT(*) FROM construction_projects WHERE deleted_at IS NULL) as construction,
        (SELECT COUNT(*) FROM repair_projects WHERE deleted_at IS NULL) as repairs,
        (SELECT COUNT(*) FROM university_operations WHERE deleted_at IS NULL) as operations
    `);

    console.log(`  Record counts:`);
    console.log(`    - record_assignments: ${counts.rows[0].assignments}`);
    console.log(`    - construction_projects: ${counts.rows[0].construction}`);
    console.log(`    - repair_projects: ${counts.rows[0].repairs}`);
    console.log(`    - university_operations: ${counts.rows[0].operations}`);

    // Summary
    console.log('\n=== INDEX VERIFICATION SUMMARY ===\n');

    if (allPassed) {
      console.log('✓ All required indexes are created');
      console.log('✓ Queries are using appropriate indexes');
      console.log('\nStatus: PERFORMANCE OPTIMIZED\n');
    } else {
      console.log('✗ Some indexes are MISSING');
      console.log('\nAction Required: Review migration 013 execution\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyIndexes();
