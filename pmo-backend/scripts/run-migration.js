/**
 * Migration Runner Script
 * Executes SQL migration files against the database
 *
 * Usage: node scripts/run-migration.js <migration-file>
 * Example: node scripts/run-migration.js 012_add_record_assignments_table.sql
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration(migrationFile) {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'pmo_dashboard',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  });

  const migrationPath = path.join(
    __dirname,
    '../../database/migrations',
    migrationFile,
  );

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log(`Executing migration: ${migrationFile}`);
  console.log('---');

  try {
    await pool.query(sql);
    console.log('Migration executed successfully!');

    // Verify table exists
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'record_assignments'
    `);

    if (parseInt(result.rows[0].count) > 0) {
      console.log('Verification: record_assignments table EXISTS');
    } else {
      console.log(
        'Warning: record_assignments table NOT FOUND after migration',
      );
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.log('Usage: node scripts/run-migration.js <migration-file>');
  console.log(
    'Example: node scripts/run-migration.js 012_add_record_assignments_table.sql',
  );
  process.exit(1);
}

runMigration(migrationFile);
