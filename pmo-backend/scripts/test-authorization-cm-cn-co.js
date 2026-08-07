/**
 * Phase CM/CN/CO Authorization Verification Tests
 *
 * Tests the following security scenarios:
 * - CM4: Non-owner Staff cannot modify indicators via API
 * - CN3: Non-owner Staff cannot modify financials via API
 * - CO3: PUBLISHED operations reject indicator/financial mutations
 *
 * Usage: node scripts/test-authorization-cm-cn-co.js
 *
 * Prerequisites:
 * - Backend running on localhost:3000
 * - At least 2 users exist (1 admin, 1 staff)
 * - At least 1 university operation exists
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Test results collector
const results = {
  passed: [],
  failed: [],
  skipped: [],
};

// Helper to make HTTP requests
function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : null,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Login helper
async function login(identifier, password) {
  const res = await request('POST', '/api/auth/login', {
    identifier,
    password,
  });
  if (res.status === 200 || res.status === 201) {
    return res.data.access_token || res.data.token;
  }
  throw new Error(`Login failed for ${identifier}: ${res.status}`);
}

// Test runner
async function runTest(name, testFn) {
  try {
    await testFn();
    results.passed.push(name);
    console.log(`✅ ${name}`);
  } catch (error) {
    results.failed.push({ name, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

// Main test suite
async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Phase CM/CN/CO Authorization Verification Tests');
  console.log('═══════════════════════════════════════════════════════\n');

  // Configuration - update these for your environment
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  const STAFF_EMAIL = process.env.STAFF_EMAIL || 'staff@test.com';
  const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'staff123';

  let adminToken, staffToken;

  // Step 1: Login as admin and staff
  console.log('Step 1: Authenticating test users...\n');

  try {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log(`  ✓ Admin logged in: ${ADMIN_EMAIL}`);
  } catch (e) {
    console.log(`  ✗ Admin login failed: ${e.message}`);
    console.log('\nSkipping tests - cannot authenticate admin user.');
    console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
    return;
  }

  try {
    staffToken = await login(STAFF_EMAIL, STAFF_PASSWORD);
    console.log(`  ✓ Staff logged in: ${STAFF_EMAIL}`);
  } catch (e) {
    console.log(`  ⚠ Staff login failed: ${e.message}`);
    console.log('  Some tests will be skipped.\n');
    staffToken = null;
  }

  // Step 2: Get a university operation to test with
  console.log('\nStep 2: Finding test operation...\n');

  const opsRes = await request(
    'GET',
    '/api/university-operations?limit=1',
    null,
    adminToken,
  );
  if (opsRes.status !== 200 || !opsRes.data?.data?.length) {
    console.log('  ✗ No university operations found. Create one first.');
    return;
  }

  const operation = opsRes.data.data[0];
  console.log(`  ✓ Using operation: ${operation.title} (${operation.id})`);
  console.log(`  ✓ Status: ${operation.publication_status || 'DRAFT'}`);
  console.log(`  ✓ Owner: ${operation.created_by}`);

  // Step 3: Run authorization tests
  console.log('\n───────────────────────────────────────────────────────');
  console.log('  Phase CM Tests: Indicator Authorization');
  console.log('───────────────────────────────────────────────────────\n');

  // CM1: Admin can create indicator on any operation
  await runTest('CM1: Admin creates indicator', async () => {
    const res = await request(
      'POST',
      `/api/university-operations/${operation.id}/indicators`,
      {
        particular: 'Admin Test Indicator',
        fiscal_year: 2025,
        target_q1: 100,
      },
      adminToken,
    );

    if (res.status !== 201) {
      throw new Error(
        `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`,
      );
    }
  });

  // CM4: Non-owner Staff cannot modify indicator (if staffToken exists)
  if (staffToken) {
    await runTest(
      'CM4: Non-owner Staff blocked from creating indicator',
      async () => {
        const res = await request(
          'POST',
          `/api/university-operations/${operation.id}/indicators`,
          {
            particular: 'Staff Unauthorized Test',
            fiscal_year: 2025,
            target_q1: 50,
          },
          staffToken,
        );

        if (res.status !== 403) {
          throw new Error(
            `Expected 403 Forbidden, got ${res.status}. Authorization gap detected!`,
          );
        }
      },
    );
  } else {
    results.skipped.push(
      'CM4: Non-owner Staff blocked (no staff user available)',
    );
  }

  console.log('\n───────────────────────────────────────────────────────');
  console.log('  Phase CN Tests: Financial Authorization');
  console.log('───────────────────────────────────────────────────────\n');

  // CN1: Admin can create financial on any operation
  await runTest('CN1: Admin creates financial', async () => {
    const res = await request(
      'POST',
      `/api/university-operations/${operation.id}/financials`,
      {
        operations_programs: 'Admin Test Financial',
        fiscal_year: 2025,
        fund_type: 'RAF_PROGRAMS',
        allotment: 1000000,
      },
      adminToken,
    );

    if (res.status !== 201) {
      throw new Error(
        `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`,
      );
    }

    // Verify computed fields are returned
    if (res.data && res.data.variance === undefined) {
      console.log('    ⚠ Warning: Computed fields (variance) not returned');
    }
  });

  // CN3: Non-owner Staff cannot modify financial
  if (staffToken) {
    await runTest(
      'CN3: Non-owner Staff blocked from creating financial',
      async () => {
        const res = await request(
          'POST',
          `/api/university-operations/${operation.id}/financials`,
          {
            operations_programs: 'Staff Unauthorized Test',
            fiscal_year: 2025,
            fund_type: 'RAF_PROGRAMS',
            allotment: 500000,
          },
          staffToken,
        );

        if (res.status !== 403) {
          throw new Error(
            `Expected 403 Forbidden, got ${res.status}. Authorization gap detected!`,
          );
        }
      },
    );
  } else {
    results.skipped.push(
      'CN3: Non-owner Staff blocked (no staff user available)',
    );
  }

  console.log('\n───────────────────────────────────────────────────────');
  console.log('  Phase CO Tests: Publication Status Lock');
  console.log('───────────────────────────────────────────────────────\n');

  // Check if we can test publication lock
  if (operation.publication_status === 'PUBLISHED') {
    await runTest(
      'CO1: PUBLISHED operation rejects indicator creation',
      async () => {
        const res = await request(
          'POST',
          `/api/university-operations/${operation.id}/indicators`,
          {
            particular: 'Should Be Rejected',
            fiscal_year: 2025,
            target_q1: 100,
          },
          adminToken,
        );

        if (res.status !== 403) {
          throw new Error(
            `Expected 403 for PUBLISHED operation, got ${res.status}`,
          );
        }
      },
    );

    await runTest(
      'CO2: PUBLISHED operation rejects financial creation',
      async () => {
        const res = await request(
          'POST',
          `/api/university-operations/${operation.id}/financials`,
          {
            operations_programs: 'Should Be Rejected',
            fiscal_year: 2025,
            fund_type: 'RAF_PROGRAMS',
            allotment: 100000,
          },
          adminToken,
        );

        if (res.status !== 403) {
          throw new Error(
            `Expected 403 for PUBLISHED operation, got ${res.status}`,
          );
        }
      },
    );
  } else {
    console.log('  ⚠ Operation is not PUBLISHED - skipping CO tests');
    console.log('    To test CO1/CO2, publish an operation first.\n');
    results.skipped.push(
      'CO1: PUBLISHED blocks indicator (operation not PUBLISHED)',
    );
    results.skipped.push(
      'CO2: PUBLISHED blocks financial (operation not PUBLISHED)',
    );
  }

  console.log('\n───────────────────────────────────────────────────────');
  console.log('  Phase CP Tests: Auto-Computed Financial Metrics');
  console.log('───────────────────────────────────────────────────────\n');

  await runTest('CP1: Financial returns computed variance', async () => {
    const res = await request(
      'POST',
      `/api/university-operations/${operation.id}/financials`,
      {
        operations_programs: 'Compute Test',
        fiscal_year: 2025,
        fund_type: 'RAF_PROGRAMS',
        target: 1000000,
        obligation: 750000,
        allotment: 1000000,
        disbursement: 500000,
      },
      adminToken,
    );

    if (res.status !== 201) {
      throw new Error(`Expected 201, got ${res.status}`);
    }

    const data = res.data;

    // Check variance: target - obligation = 1000000 - 750000 = 250000
    if (data.variance !== 250000) {
      throw new Error(`Expected variance=250000, got ${data.variance}`);
    }

    // Check utilization_rate: (obligation / allotment) * 100 = 75%
    if (Math.abs(data.utilization_rate - 75) > 0.1) {
      throw new Error(
        `Expected utilization_rate≈75, got ${data.utilization_rate}`,
      );
    }

    // Check balance: allotment - disbursement = 1000000 - 500000 = 500000
    if (data.balance !== 500000) {
      throw new Error(`Expected balance=500000, got ${data.balance}`);
    }

    // Check disbursement_rate: (disbursement / obligation) * 100 = 66.67%
    if (Math.abs(data.disbursement_rate - 66.67) > 0.1) {
      throw new Error(
        `Expected disbursement_rate≈66.67, got ${data.disbursement_rate}`,
      );
    }
  });

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`  ✅ Passed: ${results.passed.length}`);
  console.log(`  ❌ Failed: ${results.failed.length}`);
  console.log(`  ⏭  Skipped: ${results.skipped.length}`);

  if (results.failed.length > 0) {
    console.log('\n  Failed tests:');
    results.failed.forEach((f) => console.log(`    - ${f.name}: ${f.error}`));
  }

  if (results.skipped.length > 0) {
    console.log('\n  Skipped tests:');
    results.skipped.forEach((s) => console.log(`    - ${s}`));
  }

  console.log('\n═══════════════════════════════════════════════════════\n');

  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
