const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'pmo_dashboard',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

async function checkSchema() {
  // Check roles table
  console.log('=== ROLES TABLE ===');
  const roles = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'roles'
    ORDER BY ordinal_position
  `);
  roles.rows.forEach((c) =>
    console.log(`  - ${c.column_name} (${c.data_type})`),
  );

  const rolesData = await pool.query('SELECT * FROM roles LIMIT 10');
  console.log('\nSample roles:');
  rolesData.rows.forEach((r) =>
    console.log(
      `  - ${r.id}: ${r.name} (${r.description || 'no description'})`,
    ),
  );

  // Check user_roles table
  console.log('\n=== USER_ROLES TABLE ===');
  const userRoles = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'user_roles'
    ORDER BY ordinal_position
  `);
  userRoles.rows.forEach((c) =>
    console.log(`  - ${c.column_name} (${c.data_type})`),
  );

  await pool.end();
}

checkSchema();
