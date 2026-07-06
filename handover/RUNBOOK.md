# CSU CORE Dashboard — Operations Runbook

> **Audience:** MIS staff responsible for day-to-day operation
> **Covers:** Start/stop, logs, backup, restore, user lockout, prohibited commands, incident response
> **Last verified:** 2026-07-01

All commands run in the **WSL Ubuntu terminal** from the project directory:

```bash
cd /path/to/pmo-dash
```

---

## Daily Operations

### Start the stack

```bash
docker compose up -d
```

Wait for all containers to be healthy:

```bash
docker compose ps
# All three should show "healthy" or "Up"
```

### Stop the stack (data is preserved)

```bash
docker compose stop
```

> This stops containers but does NOT delete any data. `docker compose up -d` starts them again.

### Restart a single service

```bash
docker compose restart backend
docker compose restart frontend
```

### Check status

```bash
docker compose ps
```

### View logs

```bash
# Follow live backend logs
docker compose logs -f backend

# Last 50 lines from all services
docker compose logs --tail=50

# Specific service, last 100 lines
docker compose logs --tail=100 postgres
```

---

## Backup

### Run a manual backup

```bash
bash /path/to/pmo-dash/backup.sh
```

Backup lands in `/path/to/pmo-dash/backups/YYYYMMDD_HHMMSS/` containing:
- `db.dump` — full PostgreSQL database (custom format)
- `uploads.tar.gz` — all uploaded files from `/app/uploads`
- `MANIFEST.txt` — size and metadata

The stack stays running during backup. It is safe to run at any time.

### Verify a backup is complete

```bash
ls /path/to/pmo-dash/backups/
# Lists all backup timestamps

ls /path/to/pmo-dash/backups/20260701_020000/
# Expected: db.dump  uploads.tar.gz  MANIFEST.txt

cat /path/to/pmo-dash/backups/20260701_020000/MANIFEST.txt
```

### Scheduled backups

Backups are scheduled via cron to run at 2:00 AM daily:

```bash
crontab -l
# Should show: 0 2 * * * bash /path/to/pmo-dash/backup.sh >> /var/log/pmo-backup.log 2>&1
```

Check the backup log:

```bash
tail -30 /var/log/pmo-backup.log
```

### Copy backups off-server

```bash
# From Windows, the backups folder is visible at:
# D:\path\to\pmo-dash\backups\
# Copy to an external drive or network share via File Explorer.
```

---

## Restore

> **WARNING:** Restore REPLACES ALL current data with the backup. Only use for disaster recovery.

### Restore from a backup

The stack must be running before restoring:

```bash
docker compose up -d
```

Run the restore script with the backup timestamp:

```bash
bash /path/to/pmo-dash/restore.sh 20260701_020000
# Replace with the actual backup folder name
```

The script will:
1. Show the backup manifest
2. Ask you to type `YES` to confirm
3. Stop the backend (prevents writes during restore)
4. Drop and recreate the database from `db.dump`
5. Replace `/app/uploads` from `uploads.tar.gz`
6. Restart and wait for backend health

Verify after restore:

```bash
curl -s http://localhost:3000/health
# Expected: {"status":"ok","checks":{"database":{"status":"healthy"},...}}
```

---

## Rebuild After Code Update

When a new version is deployed from the repository:

```bash
cd /path/to/pmo-dash
git pull origin pmo-deploy
docker compose up -d --build backend frontend
```

PostgreSQL is unaffected — only the application images are rebuilt.

---

## User Management

### Access the application as SuperAdmin

Browse to `http://localhost:3001` and log in with `pmoadmin` credentials.

From the Users module (SuperAdmin only):
- Create, edit, deactivate users
- Assign roles (Admin, Staff, Auditor, Client, Contractor)
- Reset passwords

### Unlock a locked account (too many failed logins)

```bash
docker compose exec -T postgres psql -U postgres -d pmo_dashboard -c \
  "UPDATE users SET account_locked_until = NULL, failed_login_attempts = 0
   WHERE email = 'user@example.com' AND deleted_at IS NULL;"
```

### Reset a user password via database

```bash
# Step 1: Generate bcrypt hash for the new password
docker compose exec -T backend node -e \
  "const bcrypt = require('bcrypt'); bcrypt.hash('newpassword123', 10).then(h => console.log(h));"
# Copy the output (starts with $2b$10$...)

# Step 2: Apply to the user
docker compose exec -T postgres psql -U postgres -d pmo_dashboard -c \
  "UPDATE users SET password_hash = '\$2b\$10\$REPLACE_HASH_HERE'
   WHERE email = 'user@example.com' AND deleted_at IS NULL;"
```

### Reset pmoadmin password

Same as above — use `WHERE username = 'pmoadmin'` instead of email.

---

## Database Access

Direct database access (read-only queries, diagnostics):

```bash
docker compose exec postgres psql -U postgres -d pmo_dashboard
```

Useful queries:

```sql
-- Count active users
SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND is_active = true;

-- Check quarterly report statuses
SELECT fiscal_year, quarter, publication_status FROM quarterly_reports
WHERE deleted_at IS NULL ORDER BY fiscal_year DESC, quarter;

-- Check recent activity
SELECT action, entity_type, created_at FROM activity_logs
ORDER BY created_at DESC LIMIT 20;

-- Exit
\q
```

---

## Health Checks

```bash
# Full health status
curl -s http://localhost:3000/health

# Quick check — just status
curl -s http://localhost:3000/health | grep '"status"'

# Frontend reachable
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
# Expected: 200
```

---

## Prohibited Commands

**NEVER run these commands on a production system:**

| Command | Why it is dangerous |
|---|---|
| `docker compose down -v` | The `-v` flag DELETES the `pgdata` volume — all database data is permanently destroyed |
| `docker volume rm pgdata` | Same — destroys the database volume |
| `docker system prune -a --volumes` | Destroys all volumes including `backend_uploads` |
| `DROP DATABASE pmo_dashboard;` | Destroys the database directly |

**Safe alternatives:**

| Instead of | Use |
|---|---|
| `docker compose down -v` | `docker compose stop` (data preserved) |
| Deleting volumes | `bash restore.sh <timestamp>` (safe restore) |

---

## Troubleshooting

### Backend crash loop

```bash
docker compose logs backend --tail=30
```

| Error | Fix |
|---|---|
| `password authentication failed` | `DATABASE_PASSWORD` in `pmo-backend/.env` doesn't match postgres | 
| `Fatal: POSTGRES_PASSWORD must be set` | Add `POSTGRES_PASSWORD` to root `.env` |
| `ECONNREFUSED` | Postgres not ready — wait and run `docker compose up -d backend` |

### Frontend shows blank page or "Cannot connect to API"

```bash
# Check if backend is healthy
docker compose ps | grep backend
# Must show (healthy), not Restarting

# Check NUXT_PUBLIC_API_BASE in frontend container
docker compose exec frontend printenv NUXT_PUBLIC_API_BASE
# Expected: http://localhost:3000
```

### Disk space

```bash
# Check Docker volume sizes
docker system df -v | grep -E "VOLUME|pgdata|backend"

# Check backup folder size
du -sh /path/to/pmo-dash/backups/
```

If disk is low, archive old backup folders to external storage and delete from the backups/ directory.

### Container won't start after system reboot

Docker Desktop should auto-start with Windows. If not:
1. Open Docker Desktop from the Start menu
2. Wait for the whale icon in the system tray to show "Docker Desktop is running"
3. Then in WSL Ubuntu: `docker compose up -d`

---

## Incident Response

### Severity Classification

| Level | Definition | Example |
|---|---|---|
| **S1 — Critical** | System completely unavailable; data loss; security breach | All containers down; database corrupted; unauthorized access |
| **S2 — High** | Core feature broken; users cannot submit reports | Authentication failing; quarterly report save returns 500 |
| **S3 — Medium** | Single feature broken; workaround exists | Analytics chart not rendering; one module inaccessible |
| **S4 — Low** | Cosmetic or minor inconvenience | Label misaligned; filter not resetting |

---

### Escalation Contacts

Fill in these contacts before go-live. Keep a printed copy near the server.

| Role | Name | Contact |
|---|---|---|
| MIS Successor (primary) | | |
| MIS Director | | |
| PMO Director | | |
| Server / Network Admin | | |
| Outgoing Developer (if reachable) | Angelo Alcantara | meoangeloalcantara@gmail.com |

---

### S1 Response Procedure

**Step 1 — Assess**
```bash
docker compose ps
# Are all containers running and healthy?
```

```bash
curl http://localhost:3000/health
# Is the backend responding?
```

**Step 2 — Attempt recovery**
```bash
docker compose up -d
# Restart any stopped containers
```

If the database is corrupted or data is missing:
```bash
# List available backups
ls backups/

# Restore from the most recent backup (REPLACES all current data)
bash restore.sh <timestamp>
# Example: bash restore.sh 20260702_020001
```

**Step 3 — Notify**
- Notify MIS Director and PMO Director immediately by phone/message
- State: what is affected, when it started, what you have done

**Step 4 — Post-incident report**
Within 24 hours of an S1 or S2 incident, submit a written summary to the MIS Director:
- What happened and when
- Root cause (if known)
- Actions taken
- Resolution time
- Preventive measures

---

### Health Check

Verify system health at any time:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-07-01T...",
  "uptime": 12345,
  "version": "2.8.0",
  "checks": {
    "database": { "status": "healthy", "latency": 3 },
    "memory": { "status": "healthy" }
  }
}
```

If `status` is `"degraded"` or `"error"`, check container logs immediately.

---

### Security Incident Procedure

If you suspect unauthorized access (unfamiliar user accounts, unexpected data changes):

1. Check activity logs in the PMO CORE admin panel (SuperAdmin → Activity Log)
2. Check backend logs: `docker compose logs backend --tail=200 | grep -i "401\|403\|login"`
3. If a user account was compromised: deactivate it via User Management immediately
4. If a JWT secret compromise is suspected: rotate `AUTH_JWT_SECRET` in `pmo-backend/.env` and restart backend — this invalidates ALL active sessions (all users must re-login)
5. Notify MIS Director and document the incident

