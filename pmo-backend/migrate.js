'use strict';
// Docker deployment migration bootstrap.
// Fresh database: loads the AUTHORITATIVE schema dump (schema/coredata_schema.sql,
// pg_dump --schema-only of the source DB), fake-marks the migrations that dump
// already contains (up to schema/coredata_schema.baseline), then runs any
// migration written after the dump was taken. This is used INSTEAD of entity
// createSchema() because createSchema omits ~50 migration-added, raw-SQL columns
// that are populated and app-used (ADR-023).
//
// When adding a migration you do NOT need to regenerate the dump — the tail is
// applied automatically. Regenerating the dump is optional hygiene; if you do,
// update coredata_schema.baseline in the same commit.
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
    "SELECT to_regclass('public.projects') AS tbl",
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

    // The dump is a point-in-time snapshot, NOT necessarily the migration head.
    // schema/coredata_schema.baseline names the last migration the dump already
    // contains. Everything up to and including it is fake-marked applied (its DDL
    // is baked into the dump, so re-running it would error); everything AFTER it
    // is genuinely applied by migrator.up(). Without this split, a migration
    // written after the dump was taken would be marked applied without ever
    // running, and no later boot would repair it.
    const baselinePath = path.join(
      __dirname,
      'schema',
      'coredata_schema.baseline',
    );
    const baseline = fs.readFileSync(baselinePath, 'utf8').trim();

    const migrator = orm.getMigrator();
    const pending = await migrator.getPendingMigrations();
    // Names may carry a .js/.ts suffix depending on the runtime, so match on prefix.
    const cutoff = pending.findIndex((m) => m.name.startsWith(baseline));
    if (cutoff === -1) {
      throw new Error(
        `Baseline migration "${baseline}" (${baselinePath}) matches no migration. ` +
          'Regenerate the schema dump and update the baseline file together.',
      );
    }

    const alreadyInDump = pending.slice(0, cutoff + 1);
    for (const m of alreadyInDump) {
      await conn.execute(
        'INSERT INTO mikro_orm_migrations (name, executed_at) VALUES (?, NOW())',
        [m.name],
      );
    }
    console.log(
      `[migrate] ${alreadyInDump.length} migrations marked applied (present in dump, baseline ${baseline})`,
    );

    // Apply the tail — migrations written after the dump was taken.
    const tail = pending.length - alreadyInDump.length;
    if (tail > 0) {
      console.log(`[migrate] Applying ${tail} post-baseline migration(s)...`);
      await migrator.up();
    }
    console.log('[migrate] Done — schema at migration head');

    if (process.env.SEED_SKIP === 'true') {
      console.log(
        '[migrate] SEED_SKIP=true — skipping base seed (data-clone mode)',
      );
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

main().catch((err) => {
  console.error('[migrate] Fatal:', err.message || err);
  process.exit(1);
});
