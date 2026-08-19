/**
 * Phase BO: Migration Verification Script
 * Verifies all required database migrations are applied
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function verifyMigrations() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'pmo_dashboard',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  });

  console.log('=== PHASE BO: MIGRATION VERIFICATION ===\n');

  let allPassed = true;

  try {
    // Step 1: Check for required tables
    console.log('Step 1: Checking for required tables...\n');

    const tables = [
      { name: 'user_permission_overrides', migration: '006' },
      { name: 'user_module_assignments', migration: '009' },
      { name: 'record_assignments', migration: '012' },
    ];

    for (const { name, migration } of tables) {
      const result = await pool.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      `,
        [name],
      );

      if (result.rows.length > 0) {
        console.log(`  ✓ Table '${name}' EXISTS (migration ${migration})`);
      } else {
        console.log(
          `  ✗ Table '${name}' MISSING (migration ${migration} not applied)`,
        );
        allPassed = false;
      }
    }

    // Step 2: Check for required columns
    console.log('\nStep 2: Checking for required columns...\n');

    const columns = [
      { table: 'users', column: 'rank_level', migration: '008' },
      { table: 'users', column: 'campus', migration: '011' },
      {
        table: 'construction_projects',
        column: 'publication_status',
        migration: '007',
      },
      {
        table: 'construction_projects',
        column: 'submitted_by',
        migration: '007',
      },
      {
        table: 'construction_projects',
        column: 'submitted_at',
        migration: '007',
      },
      {
        table: 'construction_projects',
        column: 'reviewed_by',
        migration: '007',
      },
      {
        table: 'construction_projects',
        column: 'reviewed_at',
        migration: '007',
      },
      {
        table: 'construction_projects',
        column: 'review_notes',
        migration: '007',
      },
      {
        table: 'construction_projects',
        column: 'assigned_to',
        migration: '010',
      },
      {
        table: 'repair_projects',
        column: 'publication_status',
        migration: '007',
      },
      { table: 'repair_projects', column: 'assigned_to', migration: '010' },
      {
        table: 'university_operations',
        column: 'publication_status',
        migration: '007',
      },
      {
        table: 'university_operations',
        column: 'assigned_to',
        migration: '010',
      },
    ];

    for (const { table, column, migration } of columns) {
      const result = await pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      `,
        [table, column],
      );

      if (result.rows.length > 0) {
        console.log(
          `  ✓ Column '${table}.${column}' EXISTS (migration ${migration})`,
        );
      } else {
        console.log(
          `  ✗ Column '${table}.${column}' MISSING (migration ${migration} not applied)`,
        );
        allPassed = false;
      }
    }

    // Step 3: Check for database functions
    console.log('\nStep 3: Checking for database functions...\n');

    const functions = [
      { name: 'user_has_module_access', migration: '009' },
      { name: 'can_modify_user', migration: '008' },
    ];

    for (const { name, migration } of functions) {
      const result = await pool.query(
        `
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = $1
      `,
        [name],
      );

      if (result.rows.length > 0) {
        console.log(`  ✓ Function '${name}()' EXISTS (migration ${migration})`);
      } else {
        console.log(
          `  ⚠  Function '${name}()' MISSING (migration ${migration} may not be applied)`,
        );
        // Functions are less critical, don't fail verification
      }
    }

    // Summary
    console.log('\n=== MIGRATION VERIFICATION SUMMARY ===\n');

    if (allPassed) {
      console.log('✓ All required migrations appear to be applied');
      console.log('✓ Database schema is complete');
      console.log('\nStatus: READY FOR PRODUCTION\n');
    } else {
      console.log('✗ Some migrations are MISSING');
      console.log('✗ Database schema is INCOMPLETE');
      console.log(
        '\nAction Required: Execute missing migrations before production deployment\n',
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyMigrations();
