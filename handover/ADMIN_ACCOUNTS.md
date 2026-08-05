# Admin Accounts — How They Get Created

## Short answer

**No script to run.** It's already built into the system and fires automatically the first time
the database is created.

## Fresh install (no backup restored)

Just build and start the stack as `DEPLOYMENT.md` describes:

```bash
docker compose --env-file ./pmo-backend/.env up -d --build
```

On a fresh, empty database, `pmo-backend/seed.js` runs automatically and creates:

| Username | Email | Password source | Type |
|---|---|---|---|
| `pmoadmin` | pmoadmin@carsu.edu.ph | `SEED_PMOADMIN_PASSWORD` in `.env` | Local, SuperAdmin |
| `admin` | admin@carsu.edu.ph | `SEED_ADMIN_PASSWORD` in `.env` | Local, SuperAdmin |
| `pmu` | pmu@carsu.edu.ph | — | Google OAuth only, SuperAdmin |

Log in with `pmoadmin` (or `admin`) and use the **Users** module in the app to create accounts
for real staff and assign roles. No further script needed — this is the intended, built-in way to
onboard the first real admin.

## If a backup was transferred privately (real data restore)

If you received a backup set (`db.dump` + `uploads.tar.gz`) through the outgoing operator's
private transfer channel and restored it with `restore.sh`, the seed step above **does not run
again** — it only ever runs once, on a genuinely empty database. Instead, the restore brings in
the **actual, already-existing** admin accounts (including `pmoadmin` and any others created since
launch) exactly as they were on the source system, with their real password hashes and roles
intact. You do not need to re-create or re-seed anything — just log in with whichever admin
credentials were provided alongside the backup.

## If you need to promote a user directly (no UI access yet)

See `RUNBOOK.md` → "Reset a user password via database" for the direct-SQL fallback pattern —
only needed if no admin account is usable yet.
