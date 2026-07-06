'use strict';
// Docker deployment migration bootstrap.
// Fresh database: loads the AUTHORITATIVE schema dump (schema/coredata_schema.sql,
// pg_dump --schema-only of the source DB) then fake-marks all migrations applied.
// This is used INSTEAD of entity createSchema() because createSchema omits ~50
// migration-added, raw-SQL columns that are populated and app-used (ADR-023).
// Set SEED_SKIP=true to load schema WITHOUT the base seed (data-clone scenario,
// where a full data dump supplies its own reference data).
// Existing database: runs any pending migrations normally via migrator.up().

const fs = require('fs');
const path = require('path');
const { MikroORM } = require('@mikro-orm/core');
const config = require('./dist/database/mikro-orm.config');
const { seedFreshDatabase } = require('./seed');

async function main() {
  console.log('[migrate] Connecting to database...');
  const orm = await MikroORM.init(config.default || config);
  const conn = orm.em.getConnection();

  // Detect fresh database: projects table is the canonical indicator
  const rows = await conn.execute(
    "SELECT to_regclass('public.projects') AS tbl"
  );
  const isFresh = rows[0]?.tbl === null;

  if (isFresh) {
    console.log('[migrate] Fresh database — loading authoritative schema dump');

    // Load the complete schema (all tables + the migration/raw-SQL columns that
    // entity createSchema would omit). Executed as one simple-protocol query.
    const schemaPath = path.join(__dirname, 'schema', 'coredata_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await conn.execute(schemaSql);
    // Reset search_path defensively (the dump's was stripped during sanitization).
    await conn.execute('SET search_path TO public');
    console.log('[migrate] Schema loaded from ' + schemaPath);

    // mikro_orm_migrations is part of the dump (empty); ensure it exists regardless
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS mikro_orm_migrations (
        id serial PRIMARY KEY,
        name varchar(255) NULL,
        executed_at timestamptz DEFAULT NOW()
      )
    `);

    // Fake-mark every migration as applied — the dumped schema is already at the
    // current state, so running ALTER migrations on top would error.
    const migrator = orm.getMigrator();
    const pending = await migrator.getPendingMigrations();
    for (const m of pending) {
      await conn.execute(
        'INSERT INTO mikro_orm_migrations (name, executed_at) VALUES (?, NOW())',
        [m.name]
      );
    }
    console.log(`[migrate] Done — ${pending.length} migrations marked applied`);

    if (process.env.SEED_SKIP === 'true') {
      console.log('[migrate] SEED_SKIP=true — skipping base seed (data-clone mode)');
    } else {
      // Fresh empty schema — seed roles, a SuperAdmin, and reference data
      await seedFreshDatabase(orm);
    }

  } else {
    console.log('[migrate] Existing database — running pending migrations');
    const migrator = orm.getMigrator();
    await migrator.up();
    console.log('[migrate] Migrations complete');
  }

  await orm.close(true);
}

main().catch(err => {
  console.error('[migrate] Fatal:', err.message || err);
  process.exit(1);
});
