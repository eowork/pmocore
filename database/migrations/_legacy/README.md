# Legacy raw SQL migrations (archived)

**Do not run these files. Do not add new files here.**

These 50 `.sql` files (`002`–`048`) are the pre-MikroORM migration history. They were
applied by hand with `psql -f` between project start and Phase JH-A, and are kept only
as a historical record of how the schema was built.

## Why they are archived, not deleted

Their DDL is already baked into `pmo-backend/schema/coredata_schema.sql`, the schema
dump that `pmo-backend/migrate.js` loads on a fresh database. Nothing executes these
files: no Dockerfile, no `docker-entrypoint.sh`, no `docker-compose.yml`, no npm script.
The `database/` directory is not even inside the backend Docker build context
(`context: ./pmo-backend`), so these files have never been present in any built image.

Running one against a current database would re-apply superseded DDL against a schema
that has moved on — the reason they were moved out of the way.

## Where schema changes live now

All schema changes are MikroORM TypeScript migrations in
`pmo-backend/src/database/mikro-migrations/`. See
`pmo-backend/src/database/MIGRATION_LOG.md` for the rationale behind each one.

```bash
npm run migration:create   # scaffold a new migration
npm run migration:up       # apply pending migrations
npm run migration:list     # show applied / pending
npm run migration:check    # fail if entities have drifted from the schema
```

`Migration20260430000000_Baseline.ts` is an intentional no-op that anchors MikroORM's
tracking table at the state these 50 files produced. It does not recreate their tables —
on a fresh database that DDL comes from `coredata_schema.sql`.

## Removed alongside this move

`pmo-backend/scripts/run-migration.js` — the ad-hoc runner that executed these files. It
had no ledger (it would happily re-run an already-applied file) and its post-run check
always looked for the `record_assignments` table regardless of which migration ran, a
leftover from migration `012`. Recover from git history if ever needed.
