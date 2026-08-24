const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'pmo_dashboard',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

async function checkConstraint() {
  const result = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname LIKE '%rank%'
  `);

  console.log('Rank level constraints:');
  result.rows.forEach((c) => {
    console.log(`  ${c.conname}: ${c.definition}`);
  });

  await pool.end();
}

checkConstraint();
