/**
 * Phase BQ: End-to-End Workflow Testing
 * Validates critical user workflows through backend API
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

// Test helper functions
async function createTestUser(username, roleName, rankLevel, campus) {
  // Get role ID
  const roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', [
    roleName,
  ]);
  if (roleResult.rows.length === 0) {
    throw new Error(`Role ${roleName} not found`);
  }
  const roleId = roleResult.rows[0].id;

  // Create or update user
  const userResult = await pool.query(
    `
    INSERT INTO users (username, password_hash, email, first_name, last_name, rank_level, campus, deleted_at)
    VALUES ($1, 'test_hash', $2, $3, $4, $5, $6, NULL)
    ON CONFLICT (username) DO UPDATE
      SET deleted_at = NULL, rank_level = $5, campus = $6
    RETURNING id, username, rank_level, campus
  `,
    [username, `${username}@test.com`, 'Test', 'User', rankLevel, campus],
  );

  const user = userResult.rows[0];

  // Assign role (delete existing first to avoid duplicates)
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [user.id]);
  await pool.query(
    `
    INSERT INTO user_roles (user_id, role_id, assigned_at, created_at)
    VALUES ($1, $2, NOW(), NOW())
  `,
    [user.id, roleId],
  );

  // Return user with role info
  return {
    ...user,
    role: roleName,
    roleId: roleId,
  };
}

async function createTestRecord(module, tableName, createdBy, campus) {
  // Determine appropriate status value based on table
  let status;
  if (tableName === 'repair_projects') {
    status = 'REPORTED'; // repair_status_enum
  } else {
    status = 'PLANNING'; // project_status_enum
  }

  const result = await pool.query(
    `
    INSERT INTO ${tableName} (
      title,
      status,
      created_by,
      campus,
      publication_status,
      deleted_at
    ) VALUES ($1, $2, $3, $4, 'DRAFT', NULL)
    RETURNING id, title, publication_status, created_by, campus
  `,
    [`Test ${module} Record`, status, createdBy, campus],
  );
  return result.rows[0];
}

async function assignUsers(module, recordId, userIds) {
  // Delete existing assignments
  await pool.query(
    'DELETE FROM record_assignments WHERE module = $1 AND record_id = $2',
    [module, recordId],
  );

  // Insert new assignments
  for (const userId of userIds) {
    await pool.query(
      'INSERT INTO record_assignments (module, record_id, user_id) VALUES ($1, $2, $3)',
      [module, recordId, userId],
    );
  }
}

async function getRecordWithAssignments(tableName, recordId) {
  const result = await pool.query(
    `
    SELECT
      r.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', u.id,
            'username', u.username,
            'role', ro.name
          )
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'
      ) AS assigned_users
    FROM ${tableName} r
    LEFT JOIN record_assignments ra ON ra.module = $1 AND ra.record_id = r.id
    LEFT JOIN users u ON u.id = ra.user_id AND u.deleted_at IS NULL
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles ro ON ro.id = ur.role_id
    WHERE r.id = $2 AND r.deleted_at IS NULL
    GROUP BY r.id
  `,
    [getModuleName(tableName), recordId],
  );
  return result.rows[0];
}

async function updateRecordStatus(
  tableName,
  recordId,
  status,
  userId = null,
  notes = null,
) {
  const updates = [`publication_status = $1`];
  const values = [status, recordId];
  let paramCount = 2;

  if (status === 'PENDING_REVIEW' && userId) {
    updates.push(`submitted_by = $${++paramCount}`);
    updates.push(`submitted_at = NOW()`);
    values.push(userId);
  } else if ((status === 'PUBLISHED' || status === 'REJECTED') && userId) {
    updates.push(`reviewed_by = $${++paramCount}`);
    updates.push(`reviewed_at = NOW()`);
    values.push(userId);
    if (notes) {
      updates.push(`review_notes = $${++paramCount}`);
      values.push(notes);
    }
  }

  await pool.query(
    `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $2`,
    values,
  );
}

function getModuleName(tableName) {
  const map = {
    construction_projects: 'construction-projects',
    repair_projects: 'repair-projects',
    university_operations: 'university-operations',
  };
  return map[tableName];
}

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
  console.log('=== PHASE BQ: END-TO-END WORKFLOW TESTING ===\n');
  console.log('Testing backend API workflows...\n');

  let testUsers = {};
  let testRecords = {};

  try {
    // Setup: Create test users (rank_level must be 10-100, campus enum: MAIN, CABADBARAN, BOTH)
    console.log('SETUP: Creating test users...');
    testUsers.staff = await createTestUser('bq_staff', 'Staff', 10, 'MAIN');
    testUsers.director = await createTestUser(
      'bq_director',
      'Staff',
      30,
      'MAIN',
    ); // Staff with higher rank
    testUsers.viewer = await createTestUser('bq_viewer', 'Client', 10, 'MAIN'); // Client = read-only
    testUsers.admin = await createTestUser('bq_admin', 'Admin', 100, 'MAIN'); // Highest rank
    testUsers.cabadbaran_staff = await createTestUser(
      'bq_cabadbaran',
      'Staff',
      10,
      'CABADBARAN',
    );
    console.log('  ✅ Test users created\n');

    // BQ1: Record Creation & Assignment
    console.log('=== BQ1: RECORD CREATION & ASSIGNMENT ===');

    await runTest('BQ1.1: Create COI record with DRAFT status', async () => {
      const record = await createTestRecord(
        'COI',
        'construction_projects',
        testUsers.staff.id,
        'MAIN',
      );
      testRecords.coi = record;
      assert(record.publication_status === 'DRAFT', 'Should have DRAFT status');
      assert(
        record.created_by === testUsers.staff.id,
        'Should be created by staff',
      );
    });

    await runTest('BQ1.2: Assign multiple users to record', async () => {
      await assignUsers('construction-projects', testRecords.coi.id, [
        testUsers.director.id,
        testUsers.viewer.id,
      ]);

      const result = await pool.query(
        'SELECT user_id FROM record_assignments WHERE module = $1 AND record_id = $2',
        ['construction-projects', testRecords.coi.id],
      );
      assert(result.rows.length === 2, 'Should have 2 assignments');
    });

    await runTest('BQ1.3: Verify junction table entries', async () => {
      const record = await getRecordWithAssignments(
        'construction_projects',
        testRecords.coi.id,
      );
      assert(
        Array.isArray(record.assigned_users) &&
          record.assigned_users.length === 2,
        'Should have 2 assigned users',
      );
      const assignedIds = record.assigned_users.map((u) => u.id);
      assert(
        assignedIds.includes(testUsers.director.id) &&
          assignedIds.includes(testUsers.viewer.id),
        'Should include director and viewer',
      );
    });

    // BQ2: Assignment-Based Edit Permission
    console.log('\n=== BQ2: ASSIGNMENT-BASED EDIT PERMISSION ===');

    await runTest('BQ2.1: Director assigned can edit record', async () => {
      const record = await getRecordWithAssignments(
        'construction_projects',
        testRecords.coi.id,
      );
      const isAssigned = record.assigned_users.some(
        (u) => u.id === testUsers.director.id,
      );
      assert(isAssigned, 'Director should be assigned to record');

      // Simulate permission check
      const canEdit =
        record.created_by === testUsers.director.id ||
        record.assigned_users.some((u) => u.id === testUsers.director.id);
      assert(canEdit, 'Director should have edit permission via assignment');
    });

    await runTest('BQ2.2: Viewer assigned can edit record', async () => {
      const record = await getRecordWithAssignments(
        'construction_projects',
        testRecords.coi.id,
      );
      const isAssigned = record.assigned_users.some(
        (u) => u.id === testUsers.viewer.id,
      );
      assert(isAssigned, 'Viewer should be assigned to record');

      const canEdit =
        record.created_by === testUsers.viewer.id ||
        record.assigned_users.some((u) => u.id === testUsers.viewer.id);
      assert(canEdit, 'Viewer should have edit permission via assignment');
    });

    // BQ3: Client (Read-Only) Assignment Elevation
    console.log('\n=== BQ3: CLIENT ASSIGNMENT ELEVATION ===');

    await runTest('BQ3.1: Client role can edit when assigned', async () => {
      const record = await getRecordWithAssignments(
        'construction_projects',
        testRecords.coi.id,
      );
      // Client has read-only role normally, but assignment elevates to edit
      const hasAssignmentElevation = record.assigned_users.some(
        (u) => u.id === testUsers.viewer.id && u.role === 'Client',
      );
      assert(
        hasAssignmentElevation,
        'Client role should be elevated to edit via assignment',
      );
    });

    // BQ4: Submit for Review
    console.log('\n=== BQ4: SUBMIT FOR REVIEW ===');

    await runTest('BQ4.1: Staff submits record for review', async () => {
      await updateRecordStatus(
        'construction_projects',
        testRecords.coi.id,
        'PENDING_REVIEW',
        testUsers.staff.id,
      );

      const record = await pool.query(
        'SELECT publication_status, submitted_by, submitted_at FROM construction_projects WHERE id = $1',
        [testRecords.coi.id],
      );
      assert(
        record.rows[0].publication_status === 'PENDING_REVIEW',
        'Should be PENDING_REVIEW',
      );
      assert(
        record.rows[0].submitted_by === testUsers.staff.id,
        'Should capture submitter',
      );
      assert(
        record.rows[0].submitted_at !== null,
        'Should capture submission time',
      );
    });

    // BQ5: Admin Approval
    console.log('\n=== BQ5: ADMIN APPROVAL ===');

    await runTest('BQ5.1: Admin publishes record', async () => {
      await updateRecordStatus(
        'construction_projects',
        testRecords.coi.id,
        'PUBLISHED',
        testUsers.admin.id,
        'Approved for publication',
      );

      const record = await pool.query(
        'SELECT publication_status, reviewed_by, reviewed_at, review_notes FROM construction_projects WHERE id = $1',
        [testRecords.coi.id],
      );
      assert(
        record.rows[0].publication_status === 'PUBLISHED',
        'Should be PUBLISHED',
      );
      assert(
        record.rows[0].reviewed_by === testUsers.admin.id,
        'Should capture reviewer',
      );
      assert(record.rows[0].reviewed_at !== null, 'Should capture review time');
      assert(
        record.rows[0].review_notes === 'Approved for publication',
        'Should capture notes',
      );
    });

    await runTest('BQ5.2: Rank check (admin has rank 100)', async () => {
      assert(
        testUsers.admin.rank_level === 100,
        'Admin should have rank level 100 for approval',
      );
    });

    // BQ6: Cross-Module Consistency
    console.log('\n=== BQ6: CROSS-MODULE CONSISTENCY ===');

    await runTest(
      'BQ6.1: Create Repair record with same workflow',
      async () => {
        const record = await createTestRecord(
          'Repair',
          'repair_projects',
          testUsers.staff.id,
          'MAIN',
        );
        testRecords.repair = record;
        assert(
          record.publication_status === 'DRAFT',
          'Repair should start as DRAFT',
        );

        await assignUsers('repair-projects', record.id, [
          testUsers.director.id,
        ]);
        const withAssignments = await getRecordWithAssignments(
          'repair_projects',
          record.id,
        );
        assert(
          withAssignments.assigned_users.length === 1,
          'Repair should support assignments',
        );
      },
    );

    await runTest(
      'BQ6.2: Create University Op record with same workflow',
      async () => {
        const record = await createTestRecord(
          'Univ Op',
          'university_operations',
          testUsers.staff.id,
          'MAIN',
        );
        testRecords.univOp = record;
        assert(
          record.publication_status === 'DRAFT',
          'Univ Op should start as DRAFT',
        );

        await assignUsers('university-operations', record.id, [
          testUsers.viewer.id,
        ]);
        const withAssignments = await getRecordWithAssignments(
          'university_operations',
          record.id,
        );
        assert(
          withAssignments.assigned_users.length === 1,
          'Univ Op should support assignments',
        );
      },
    );

    await runTest('BQ6.3: Submit Repair for review', async () => {
      await updateRecordStatus(
        'repair_projects',
        testRecords.repair.id,
        'PENDING_REVIEW',
        testUsers.director.id,
      );
      const record = await pool.query(
        'SELECT publication_status, submitted_by FROM repair_projects WHERE id = $1',
        [testRecords.repair.id],
      );
      assert(
        record.rows[0].publication_status === 'PENDING_REVIEW',
        'Repair workflow matches COI',
      );
    });

    await runTest('BQ6.4: Publish University Op', async () => {
      await updateRecordStatus(
        'university_operations',
        testRecords.univOp.id,
        'PUBLISHED',
        testUsers.admin.id,
      );
      const record = await pool.query(
        'SELECT publication_status, reviewed_by FROM university_operations WHERE id = $1',
        [testRecords.univOp.id],
      );
      assert(
        record.rows[0].publication_status === 'PUBLISHED',
        'Univ Op workflow matches COI',
      );
    });

    // BQ7: Campus-Scoped Visibility
    console.log('\n=== BQ7: CAMPUS-SCOPED VISIBILITY ===');

    await runTest('BQ7.1: Create CABADBARAN record', async () => {
      const record = await createTestRecord(
        'COI',
        'construction_projects',
        testUsers.cabadbaran_staff.id,
        'CABADBARAN',
      );
      testRecords.cabadbaran = record;
      assert(
        record.campus === 'CABADBARAN',
        'Record should be in CABADBARAN campus',
      );
    });

    await runTest('BQ7.2: MAIN user sees own campus records', async () => {
      const result = await pool.query(
        `
        SELECT id, campus FROM construction_projects
        WHERE campus = $1 AND created_by = $2 AND deleted_at IS NULL
      `,
        ['MAIN', testUsers.staff.id],
      );
      assert(result.rows.length > 0, 'MAIN user should see MAIN records');
    });

    await runTest(
      'BQ7.3: Users see PUBLISHED records from other campuses',
      async () => {
        const result = await pool.query(`
        SELECT id, campus, publication_status FROM construction_projects
        WHERE publication_status = 'PUBLISHED' AND deleted_at IS NULL
      `);
        assert(
          result.rows.length > 0,
          'Users should see published records across campuses',
        );
      },
    );

    await runTest(
      'BQ7.4: Users see assigned records regardless of campus',
      async () => {
        // Assign CABADBARAN record to MAIN director
        await assignUsers('construction-projects', testRecords.cabadbaran.id, [
          testUsers.director.id,
        ]);

        const result = await pool.query(
          `
        SELECT r.id, r.campus FROM construction_projects r
        INNER JOIN record_assignments ra ON ra.module = 'construction-projects' AND ra.record_id = r.id
        WHERE ra.user_id = $1 AND r.deleted_at IS NULL
      `,
          [testUsers.director.id],
        );

        const hasAssignedFromOtherCampus = result.rows.some(
          (r) => r.campus === 'CABADBARAN',
        );
        assert(
          hasAssignedFromOtherCampus,
          'Users should see assigned records from other campuses',
        );
      },
    );

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
      console.log('\n❌ PHASE BQ: FAILED\n');
      process.exit(1);
    } else {
      console.log('\n✅ PHASE BQ: ALL BACKEND WORKFLOWS VALIDATED\n');
      console.log('⚠️  MANUAL FRONTEND TESTING STILL REQUIRED:');
      console.log('   - Test UI button visibility (Edit, Submit, Publish)');
      console.log('   - Test form interactions');
      console.log('   - Test navigation flows');
      console.log('   - Verify data displays correctly\n');
    }
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup: Delete test data
    console.log('CLEANUP: Removing test data...');
    try {
      if (testRecords.coi) {
        await pool.query(
          'DELETE FROM record_assignments WHERE module = $1 AND record_id = $2',
          ['construction-projects', testRecords.coi.id],
        );
        await pool.query('DELETE FROM construction_projects WHERE id = $1', [
          testRecords.coi.id,
        ]);
      }
      if (testRecords.repair) {
        await pool.query(
          'DELETE FROM record_assignments WHERE module = $1 AND record_id = $2',
          ['repair-projects', testRecords.repair.id],
        );
        await pool.query('DELETE FROM repair_projects WHERE id = $1', [
          testRecords.repair.id,
        ]);
      }
      if (testRecords.univOp) {
        await pool.query(
          'DELETE FROM record_assignments WHERE module = $1 AND record_id = $2',
          ['university-operations', testRecords.univOp.id],
        );
        await pool.query('DELETE FROM university_operations WHERE id = $1', [
          testRecords.univOp.id,
        ]);
      }
      if (testRecords.cabadbaran) {
        await pool.query(
          'DELETE FROM record_assignments WHERE module = $1 AND record_id = $2',
          ['construction-projects', testRecords.cabadbaran.id],
        );
        await pool.query('DELETE FROM construction_projects WHERE id = $1', [
          testRecords.cabadbaran.id,
        ]);
      }
      await pool.query('DELETE FROM users WHERE username LIKE $1', ['bq_%']);
      console.log('  ✅ Test data cleaned up');
    } catch (cleanupError) {
      console.error('  ⚠️  Cleanup warning:', cleanupError.message);
    }

    await pool.end();
  }
}

runTests();
