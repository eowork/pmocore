# Migrations

Everything up to and including `Migration20261013030328` has run on production against real
data. **Those files are frozen.** Editing, reordering, renaming or deleting one changes what a
database that has already recorded it will never run again, while changing what a fresh database
gets — the two drift apart silently. A mistake in an applied migration is corrected by a new
migration, never by editing the old one.

That is also why there is no squashed baseline: squashing would strand production, which is
mid-history. `schema/coredata_schema.sql` plus `schema/coredata_schema.baseline` exist for the
fresh-install path only (see `migrate.js`), not as a replacement for this folder.

## Writing a new one

Generate the draft, then **read every statement before committing it**. The generator diffs the
entities against whichever database it connects to, so it emits two kinds of line:

1. What you meant to change.
2. Anything in the database that no entity models — which it reads as "delete this".

Category 2 is how `Migration20261019030114` arrived carrying
`alter table "users" drop constraint chk_users_rank_level`. That check guards live data and is
in the schema dump; no entity declares it, so the differ wants it gone on every single run.
Delete those lines from the draft. `safe: true` in `mikro-orm.config.ts` suppresses dropped
columns and tables, but not dropped constraints.

Treat a generated migration as a draft, not as output.

## Guard DDL that may already exist

The UPR tables were created on development machines with `schema:update --run` before their
migration existed, so the migration met objects it had no record of and failed on
`type "upr_status_enum" already exists`. Write DDL that tolerates the object being there:

| statement | guarded form |
| --- | --- |
| `create table` | `create table if not exists` |
| `create index` | `create index if not exists` |
| `add column` | `add column if not exists` |
| `drop …` | `drop … if exists` |
| `create type` | `do $$ begin if not exists (select 1 from pg_type where typname = '…') then … end if; end $$;` |
| `add constraint` | `do $$ begin if not exists (select 1 from pg_constraint where conname = '…' and conrelid = '"table"'::regclass) then … end if; end $$;` |

Postgres has no `create type if not exists` and no `add constraint if not exists`, hence the two
DO blocks. `Migration20261013030328` is the worked example.

## Do not run `schema:update --run`

It writes schema that `mikro_orm_migrations` has no record of, which is what put the UPR tables
ahead of their own migration and cost a day of crash-looping containers. Use
`schema:update --dump` to read the pending SQL, then write the migration by hand.

## Checking a migration before it reaches a container

Replay it against a real database inside a transaction that is rolled back:

```sh
# extract the compiled SQL
node -e "const {Migration…:M}=require('./dist/database/mikro-migrations/Migration…');
  const m=new M(null,null); m.up().then(()=>console.log(m.getQueries().map(q=>q.sql ?? q).join('\n')))"
```

Wrap the output in `BEGIN; … ROLLBACK;` and run it through `psql`. It proves the statements
work against the live schema without committing anything.

Do not try the same trick by calling `migrator.up({ transaction })` inside `em.transactional`
and throwing at the end. With `allOrNothing: false` the migrator opens its own transaction per
migration and commits it, so the outer transaction is ignored and the throw rolls back nothing —
the migrations are applied for real. Replay the SQL through `psql` instead, or point a throwaway
database at it.
