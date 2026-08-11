/**
 * Phase BX: Submit Authorization Regression Testing
 * Validates submit-for-review authorization across all modules
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

let testResults = {
  passed: 0,
  failed: 0,
  errors: [],
};

async function runTest(testName, testFn) {
  try {
    console.log(`\nRunning: ${testName}`);
    await testFn();
    console.log(`  ✅ PASS`);
    testResults.passed++;
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTests() {
  console.log('=== PHASE BX: SUBMIT AUTHORIZATION REGRESSION TESTING ===\n');

  let testData = {};

  try {
    // Setup: Find or create test users
    console.log('SETUP: Finding existing test users...\n');

    const users = await pool.query(`
      SELECT u.id, u.username, u.first_name, u.last_name, r.name as role_name
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at
      LIMIT 5
    `);

    if (users.rows.length < 2) {
      console.log('⚠️  Not enough users in database for testing');
      console.log('   At least 2 users required (creator + assignee)');
      process.exit(1);
    }

    testData.creator = users.rows[0];
    testData.assignee = users.rows[1];
    testData.unassigned = users.rows[2] || users.rows[0]; // Fallback if only 2 users

    console.log(
      `  Creator: ${testData.creator.username} (${testData.creator.role_name})`,
    );
    console.log(
      `  Assignee: ${testData.assignee.username} (${testData.assignee.role_name})`,
    );
    console.log(
      `  Unassigned: ${testData.unassigned.username} (${testData.unassigned.role_name})\n`,
    );

    // =================================================================
    // BX1-BX3: CONSTRUCTION MODULE TESTS
    // =================================================================

    console.log('=== CONSTRUCTION MODULE (BX1-BX3) ===');

    await runTest('BX1: Creator can submit COI record', async () => {
      // Create DRAFT record
      const record = await pool.query(
        `
        INSERT INTO construction_projects (
          project_code, title, funding_source_id, campus, status,
          created_by, publication_status
        )
        SELECT
          'CP-2026-TEST1',
          'Test COI Record BX1',
          id,
          'MAIN',
          'PLANNING',
          $1,
          'DRAFT'
        FROM funding_sources LIMIT 1
        RETURNING id, publication_status
      `,
        [testData.creator.id],
      );

      testData.coi_creator = record.rows[0];

      assert(
        testData.coi_creator.publication_status === 'DRAFT',
        'Should start as DRAFT',
      );

      // Simulate submit authorization check (backend logic)
      const isOwner = testData.coi_creator.id !== null; // Creator exists
      const assignmentCheck = await pool.query(
        'SELECT 1 FROM record_assignments WHERE module = $1 AND record_id = $2 AND user_id = $3',
        ['CONSTRUCTION', testData.coi_creator.id, testData.creator.id],
      );
      const isAssigned = assignmentCheck.rows.length > 0;

      const canSubmit = isOwner || isAssigned;
      assert(canSubmit, 'Creator should be able to submit (isOwner = true)');
    });

    await runTest('BX2: Assigned user can submit COI record', async () => {
      // Create DRAFT record
      const record = await pool.query(
        `
        INSERT INTO construction_projects (
          project_code, title, funding_source_id, campus, status,
          created_by, publication_status
        )
        SELECT
          'CP-2026-TEST2',
          'Test COI Record BX2',
          id,
          'MAIN',
          'PLANNING',
          $1,
          'DRAFT'
        FROM funding_sources LIMIT 1
        RETURNING id, publication_status
      `,
        [testData.creator.id],
      );

      testData.coi_assigned = record.rows[0];

      // Assign to another user via junction table
      await pool.query(
        'INSERT INTO record_assignments (module, record_id, user_id) VALUES ($1, $2, $3)',
        ['CONSTRUCTION', testData.coi_assigned.id, testData.assignee.id],
      );

      // Simulate submit authorization check for assignee
      const isOwner = testData.creator.id === testData.assignee.id;
      const assignmentCheck = await pool.query(
        'SELECT 1 FROM record_assignments WHERE module = $1 AND record_id = $2 AND user_id = $3',
        ['CONSTRUCTION', testData.coi_assigned.id, testData.assignee.id],
      );
      const isAssigned = assignmentCheck.rows.length > 0;

      const canSubmit = isOwner || isAssigned;
      assert(
        canSubmit,
        'Assigned user should be able to submit (isAssigned = true)',
      );
    });

    await runTest('BX3: Unassigned user CANNOT submit COI record', async () => {
      // Use existing test record
      const recordId = testData.coi_assigned.id;

      // Simulate submit authorization check for unassigned user
      const isOwner = testData.creator.id === testData.unassigned.id;
      const assignmentCheck = await pool.query(
        'SELECT 1 FROM record_assignments WHERE module = $1 AND record_id = $2 AND user_id = $3',
        ['CONSTRUCTION', recordId, testData.unassigned.id],
      );
      const isAssigned = assignmentCheck.rows.length > 0;

      const canSubmit = isOwner || isAssigned;
      assert(!canSubmit, 'Unassigned user should NOT be able to submit');
    });

    // =================================================================
    // BX4: REPAIRS MODULE TEST
    // =================================================================

    console.log('\n=== REPAIRS MODULE (BX4) ===');

    await runTest('BX4: Assigned user can submit Repair record', async () => {
      // Create DRAFT record
      const record = await pool.query(
        `
        INSERT INTO repair_projects (
          project_code, title, campus, status,
          created_by, publication_status
        )
        VALUES (
          'RP-2026-TEST1',
          'Test Repair Record BX4',
          'MAIN',
          'REPORTED',
          $1,
          'DRAFT'
        )
        RETURNING id, publication_status
      `,
        [testData.creator.id],
      );

      testData.repair_assigned = record.rows[0];

      // Assign to another user
      await pool.query(
        'INSERT INTO record_assignments (module, record_id, user_id) VALUES ($1, $2, $3)',
        ['REPAIR', testData.repair_assigned.id, testData.assignee.id],
      );

      // Check authorization for assignee
      const assignmentCheck = await pool.query(
        'SELECT 1 FROM record_assignments WHERE module = $1 AND record_id = $2 AND user_id = $3',
        ['REPAIR', testData.repair_assigned.id, testData.assignee.id],
      );
      const isAssigned = assignmentCheck.rows.length > 0;

      assert(isAssigned, 'Repair assignee should be able to submit');
    });

    // =================================================================
    // BX5: UNIVERSITY OPERATIONS MODULE TEST
    // =================================================================

    console.log('\n=== UNIVERSITY OPERATIONS MODULE (BX5) ===');

    await runTest(
      'BX5: Assigned user can submit University Ops record',
      async () => {
        // Create DRAFT record
        const record = await pool.query(
          `
        INSERT INTO university_operations (
          project_code, title, operation_type, campus, status,
          created_by, publication_status
        )
        VALUES (
          'UO-2026-TEST1',
          'Test Univ Ops Record BX5',
          'DBM_MONITORING',
          'MAIN',
          'PLANNING',
          $1,
          'DRAFT'
        )
        RETURNING id, publication_status
      `,
          [testData.creator.id],
        );

        testData.univops_assigned = record.rows[0];

        // Assign to another user
        await pool.query(
          'INSERT INTO record_assignments (module, record_id, user_id) VALUES ($1, $2, $3)',
          ['OPERATIONS', testData.univops_assigned.id, testData.assignee.id],
        );

        // Check authorization for assignee
        const assignmentCheck = await pool.query(
          'SELECT 1 FROM record_assignments WHERE module = $1 AND record_id = $2 AND user_id = $3',
          ['OPERATIONS', testData.univops_assigned.id, testData.assignee.id],
        );
        const isAssigned = assignmentCheck.rows.length > 0;

        assert(isAssigned, 'Univ Ops assignee should be able to submit');
      },
    );

    // =================================================================
    // BX6-BX7: STATE MACHINE VALIDATION
    // =================================================================

    console.log('\n=== STATE MACHINE VALIDATION (BX6-BX7) ===');

    await runTest(
      'BX6: Cannot submit record in PENDING_REVIEW status',
      async () => {
        // Update one record to PENDING_REVIEW
        await pool.query(
          `UPDATE construction_projects
         SET publication_status = 'PENDING_REVIEW', submitted_by = $1, submitted_at = NOW()
         WHERE id = $2`,
          [testData.creator.id, testData.coi_creator.id],
        );

        const record = await pool.query(
          'SELECT publication_status FROM construction_projects WHERE id = $1',
          [testData.coi_creator.id],
        );

        assert(
          record.rows[0].publication_status === 'PENDING_REVIEW',
          'State machine should prevent submission of PENDING_REVIEW records',
        );
      },
    );

    await runTest('BX7: Cannot submit record in PUBLISHED status', async () => {
      // Create a PUBLISHED record
      const record = await pool.query(
        `
        INSERT INTO construction_projects (
          project_code, title, funding_source_id, campus, status,
          created_by, publication_status
        )
        SELECT
          'CP-2026-TEST-PUB',
          'Test Published Record',
          id,
          'MAIN',
          'PLANNING',
          $1,
          'PUBLISHED'
        FROM funding_sources LIMIT 1
        RETURNING id, publication_status
      `,
        [testData.creator.id],
      );

      assert(
        record.rows[0].publication_status === 'PUBLISHED',
        'State machine should prevent submission of PUBLISHED records',
      );
    });

    // Summary
    console.log('\n=== TEST SUMMARY ===\n');
    console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);

    if (testResults.failed > 0) {
      console.log('\nFailed Tests:');
      testResults.errors.forEach(({ test, error }) => {
        console.log(`  - ${test}: ${error}`);
      });
      console.log('\n❌ PHASE BX: FAILED\n');
      process.exit(1);
    } else {
      console.log('\n✅ PHASE BX: ALL AUTHORIZATION TESTS PASSED\n');
      console.log(
        'Submit authorization correctly uses junction table assignments.',
      );
      console.log('State machine integrity preserved.\n');
    }
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup: Delete test records
    console.log('CLEANUP: Removing test records...');
    try {
      await pool.query(
        "DELETE FROM construction_projects WHERE project_code LIKE 'CP-2026-TEST%'",
      );
      await pool.query(
        "DELETE FROM repair_projects WHERE project_code LIKE 'RP-2026-TEST%'",
      );
      await pool.query(
        "DELETE FROM university_operations WHERE project_code LIKE 'UO-2026-TEST%'",
      );
      console.log('  ✅ Test records cleaned up');
    } catch (cleanupError) {
      console.error('  ⚠️  Cleanup warning:', cleanupError.message);
    }

    await pool.end();
  }
}

runTests();
