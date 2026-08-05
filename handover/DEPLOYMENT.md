# CSU CORE Dashboard — Deployment Guide

> **Audience:** MIS successor deploying on a fresh server
> **Time required:** ~30 minutes on a prepared machine
> **Last verified:** 2026-07-01 on Windows 11 + WSL2 + Docker Desktop

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Windows 11 | Any | WSL2 requires Windows 10 2004+ (Build 19041+) |
| WSL2 + Ubuntu | Ubuntu 22.04 LTS | Install via Microsoft Store |
| Docker Desktop | Latest | Enable WSL2 backend in settings |
| Git | Any | Pre-installed in Ubuntu |
| Ports available | 3000, 3001 | Backend + Frontend |

### Install WSL2 (if not present)

Open PowerShell as Administrator:

```powershell
wsl --install -d Ubuntu-22.04
```

Restart the machine. Open Ubuntu from the Start menu and set a username/password.

### Install Docker Desktop

Download from docker.com. During setup, enable **"Use WSL 2 based engine"** and check **Ubuntu-22.04** under Settings → Resources → WSL Integration.

Verify in Ubuntu terminal:

```bash
docker --version
docker compose version
```

---

## Step 1 — Clone the Repository

Open the Ubuntu (WSL2) terminal:

```bash
cd ~
git clone https://github.com/eowork/pmocore.git pmo-dash
cd pmo-dash
git checkout pmo-deploy
```

Or if deploying from a ZIP handover package, extract to a known path and adjust all paths below accordingly.

---

## Step 2 — Configure Environment Files

Only one `.env` file is required: `pmo-backend/.env`. It is not committed to the repo — create it from the provided example. This single file is the source of truth for both the backend application **and** Docker Compose — `docker-compose.yml` interpolates `DATABASE_NAME`/`DATABASE_USER`/`DATABASE_PASSWORD` directly from it, so there is no separate root `.env` to create anymore.

### Backend `.env` (also read by Docker Compose)

```bash
cp /path/to/pmo-dash/pmo-backend/.env.example /path/to/pmo-dash/pmo-backend/.env
nano /path/to/pmo-dash/pmo-backend/.env
```

Fill in (minimum required values):

```env
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=pmo_dashboard
DATABASE_USER=postgres
DATABASE_PASSWORD=<generate below>

PORT=3000
NODE_ENV=development

AUTH_JWT_SECRET=<generate below>
AUTH_JWT_EXPIRES_IN=28800

FRONTEND_URL=http://localhost:3001

SEED_PMOADMIN_PASSWORD=<choose a strong password>
SEED_ADMIN_PASSWORD=<choose a strong password>
```

> `BACKEND_PORT` and `FRONTEND_PORT` are optional — they only affect the host-side port mapping that Docker Compose uses, and default to `3000`/`3001` if left unset. Add them to this same `pmo-backend/.env` file (not a separate one) only if you need different host ports.

Generate `DATABASE_PASSWORD`:

```bash
openssl rand -hex 20
# Example output: a3f9c2e817b4d056f1209e3c7a8b4d1f2c09e3a1
```

Generate `AUTH_JWT_SECRET`:

```bash
openssl rand -base64 48
```

> `SEED_PMOADMIN_PASSWORD` becomes the password for the `pmoadmin` SuperAdmin account on first deploy. Write it down — there is no recovery email on a fresh database.

> **Every `docker compose` command from here on needs `--env-file`.** Because Compose now reads `DATABASE_NAME`/`DATABASE_USER`/`DATABASE_PASSWORD` from `pmo-backend/.env` instead of a root `.env`, every invocation that parses `docker-compose.yml` — `up`, `ps`, `logs`, `exec`, `stop`, `restart`, `start`, `down`, `build`, etc. — must include `--env-file ./pmo-backend/.env` (path relative to wherever you run the command; use an absolute path if not running from the repo root). Without it, Compose fails immediately with `DATABASE_PASSWORD must be set in pmo-backend/.env`. The one exception is `docker compose version`, which doesn't read the project file at all. The commands in this guide below already include the flag.

---

## Step 3 — First Deploy

Navigate to the project directory (WSL path) and start the stack:

```bash
cd /path/to/pmo-dash
docker compose --env-file ./pmo-backend/.env up -d
```

The first run builds both images from source. Expect 3–5 minutes. Progress prints to the terminal.

Watch for completion:

```bash
docker compose --env-file ./pmo-backend/.env ps
```

Expected output when ready:

```
NAME                  STATUS
pmo-dash-postgres-1   Up X seconds (healthy)
pmo-dash-backend-1    Up X seconds (healthy)
pmo-dash-frontend-1   Up X seconds
```

> **If backend shows "Restarting":** See Troubleshooting section below.

---

## Step 4 — Verify the Deployment

```bash
# 1. API health check
curl -s http://localhost:3000/health
# Expected: {"status":"ok","checks":{"database":{"status":"healthy"},...}}

# 2. Swagger is disabled in production (expected 404)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/docs
# Expected: 404

# 3. Frontend loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
# Expected: 200
```

Open `http://localhost:3001` in a browser. The login page should appear.

Log in with:
- **Identifier:** `pmoadmin`
- **Password:** the value you set for `SEED_PMOADMIN_PASSWORD`

> **Safety check — do this before continuing:** also try logging in with the password `pmocore`
> (for `pmoadmin`) or `pmoadmincore` (for `admin`). **If either of these actually logs you in,
> STOP** — it means your real `.env` password was not applied when the database was first
> created, and the account is protected only by a well-known default. Because these accounts are
> seeded only once, on the very first database initialization, editing `.env` now will **not**
> retroactively fix an already-seeded weak password — you must reset it directly. Use
> `RUNBOOK.md` → "Reset pmoadmin password" to set a real password immediately, then verify the
> old default no longer works.

---

## Step 5 — Migrate Existing Data (if inheriting from prior deployment)

If you received a backup from the outgoing operator:

```bash
# List available backups (operator should provide timestamp)
ls /path/to/pmo-dash/backups/

# Restore from a specific backup
bash /path/to/pmo-dash/restore.sh 20260701_020000
# Replace timestamp with the actual backup folder name
```

> See `handover/RUNBOOK.md` for full restore procedure details.

---

## Step 6 — Copy Uploaded Files

If uploaded files (project photos, documents) were provided separately:

```bash
# Copy the uploads directory into the running backend container
docker cp /path/to/uploads/. pmo-dash-backend-1:/app/uploads/

# Verify
docker compose --env-file ./pmo-backend/.env exec backend sh -c "ls /app/uploads/ | wc -l"
# Expected: number of files provided
```

---

## Step 7 — Schedule Automatic Backups

```bash
crontab -e
```

Add this line:

```
0 2 * * * bash /path/to/pmo-dash/backup.sh >> /var/log/pmo-backup.log 2>&1
```

Backups run daily at 2:00 AM. Output logs to `/var/log/pmo-backup.log`.

---

## Troubleshooting

### Backend keeps restarting

```bash
docker compose --env-file ./pmo-backend/.env logs backend --tail=30
```

**Common causes:**

| Error in logs | Cause | Fix |
|---|---|---|
| `password authentication failed for user "postgres"` | `DATABASE_PASSWORD` in `pmo-backend/.env` was changed after the Postgres volume was already initialized (Postgres only applies `POSTGRES_PASSWORD` the first time an empty volume is created) | Reset the password inside the running Postgres container to match `pmo-backend/.env`, or wipe the `pgdata` volume and let it reinitialize (see `RUNBOOK.md`) |
| `DATABASE_PASSWORD must be set in pmo-backend/.env` | The `docker compose` command was run without `--env-file ./pmo-backend/.env`, or `pmo-backend/.env` is missing `DATABASE_PASSWORD` | Re-run with `--env-file ./pmo-backend/.env` and confirm `DATABASE_PASSWORD` is set in `pmo-backend/.env` |
| `Cannot find module` or build error | Image built before code was ready | Run `docker compose --env-file ./pmo-backend/.env up -d --build backend` |
| `ECONNREFUSED` to postgres | Postgres not yet healthy when backend started | Wait 30 seconds and run `docker compose --env-file ./pmo-backend/.env up -d backend` again |

### Port already in use

```bash
# Check what is using port 3000 or 3001
netstat -ano | findstr :3000    # Windows PowerShell
ss -tlnp | grep 3000            # WSL Ubuntu
```

Kill the conflicting process or set `BACKEND_PORT` / `FRONTEND_PORT` in `pmo-backend/.env` (these are optional and default to `3000`/`3001` if unset).

### WSL2 port binding error (127.0.0.1)

If you see `ports are not available: exposing port TCP 127.0.0.1:...`: remove any `ports:` entry under the `postgres:` service in `docker-compose.yml`. PostgreSQL does not need a published port — the backend connects via Docker's internal network.

### Forgot SEED_PMOADMIN_PASSWORD

Reset via the database:

```bash
# Generate new bcrypt hash for your chosen password
docker compose --env-file ./pmo-backend/.env exec -T backend node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-new-password', 10).then(h => console.log(h));"

# Apply hash to DB
docker compose --env-file ./pmo-backend/.env exec -T postgres psql -U postgres -d pmo_dashboard -c \
  "UPDATE users SET password_hash = '\$2b\$10\$REPLACE_WITH_HASH' WHERE username = 'pmoadmin';"
```

---

## Environment Variable Reference

| Variable | File | Required | Purpose |
|---|---|---|---|
| `DATABASE_NAME` | `pmo-backend/.env` | No (defaults to `pmo_dashboard`) | Postgres database name — also used by Docker Compose |
| `DATABASE_USER` | `pmo-backend/.env` | No (defaults to `postgres`) | Postgres superuser name — also used by Docker Compose |
| `DATABASE_PASSWORD` | `pmo-backend/.env` | Yes | Postgres superuser password — required by Docker Compose too, no default |
| `AUTH_JWT_SECRET` | `pmo-backend/.env` | Yes | Signs all JWT tokens — min 32 chars |
| `FRONTEND_URL` | `pmo-backend/.env` | Yes | CORS origin — set to the URL users browse to |
| `SEED_PMOADMIN_PASSWORD` | `pmo-backend/.env` | First deploy only | SuperAdmin initial password |
| `SEED_ADMIN_PASSWORD` | `pmo-backend/.env` | First deploy only | Admin initial password |
| `BACKEND_PORT` / `FRONTEND_PORT` | `pmo-backend/.env` | Optional (default `3000`/`3001`) | Host-side port mapping, read by Docker Compose |
| `GOOGLE_CLIENT_ID/SECRET` | `pmo-backend/.env` | Optional | Enable Google OAuth login |
| `LDAP_URL` | `pmo-backend/.env` | Optional | Enable LDAP/AD login (see MIS_CHECKLIST.md) |

---

## What Runs Where

```
Browser (http://localhost:3001)
    ↓  SPA served by Nuxt/Nitro
Frontend container (port 3001)
    ↓  REST API calls to http://localhost:3000
Backend container (port 3000) — NestJS
    ↓  PostgreSQL protocol (internal Docker network only)
PostgreSQL container (port 5432, internal only)
    ↓  pgdata Docker volume (persists across restarts)
```

> The PostgreSQL port is NOT published to the host. Access the database only via `docker compose --env-file ./pmo-backend/.env exec postgres psql`.
