# CSU CORE Dashboard — Clean-Room Dry Run Guide

> **Purpose:** Prove that a stranger with only this documentation and the repository can deploy and operate PMO CORE from scratch — with zero help from the original developer.
> **Device:** Any Windows 11 laptop (Intel or AMD Ryzen — no difference in procedure)
> **Time required:** 60–90 minutes including installation
> **Operator:** Angelo Alcantara (outgoing developer)
> **Outcome:** PASS or FAIL with written findings

---

## What Is a Clean-Room Dry Run?

It is a rehearsal of the real handover deployment performed on a second machine that knows nothing about PMO CORE. No source files. No Docker images. No database. No environment files. Nothing.

You follow the documentation alone — just as the MIS successor will have to do on the university server.

**If it works: the documentation is proven.** You can hand over with confidence.
**If it fails: you find the gaps now, fix them, and try again before July 15.**

---

## PHASE 0 — What to Bring

Prepare these items on a USB drive or send them to the dry-run laptop before you start. Do NOT bring any source code or Docker images — those come from the internet.

### Required (the dry run cannot proceed without these)

| Item | Where to find it | How to transfer |
|---|---|---|
| Root `.env` file | `D:\Programming\pmo-dash\.env` on dev machine | Copy to USB |
| Backend `.env` file | `D:\Programming\pmo-dash\pmo-backend\.env` | Copy to USB |
| Frontend `.env` file | `D:\Programming\pmo-dash\pmo-frontend\.env` | Copy to USB |
| `pmoadmin` password | Value of `SEED_PMOADMIN_PASSWORD` in backend `.env` | Write it down separately — do not rely on memory |
| GitHub access | Repo is public — no credentials needed | None |

### Optional (for full data verification)

| Item | Where to find it | How to transfer |
|---|---|---|
| Latest backup folder | `D:\Programming\pmo-dash\backups\<latest-timestamp>\` | Copy folder to USB |

If you bring the backup, you can verify that real data loads and restores correctly. If you skip it, you test with a fresh empty database — still a valid dry run.

---

## PHASE 1 — Prepare the AMD Ryzen Laptop

### Step 1A — Enable Virtualization in BIOS (AMD Ryzen specific)

WSL2 requires AMD-V (called **SVM Mode** in AMD BIOS). It may be disabled on a factory-fresh laptop.

1. Restart the laptop and press `Delete`, `F2`, or `F10` during startup to enter BIOS (key varies by manufacturer — look for the prompt on screen)
2. Navigate to: **Advanced** → **CPU Configuration** (or similar — varies by BIOS)
3. Find **SVM Mode** or **AMD-V** and set it to **Enabled**
4. Save and exit (usually `F10`)

**Skip this step if WSL2 is already working on the laptop.** If WSL2 installs without errors in Step 1B, virtualization was already enabled.

---

### Step 1B — Install WSL2 and Ubuntu 22.04

Open **PowerShell as Administrator** (right-click Start menu → Windows PowerShell (Admin)):

```powershell
wsl --install -d Ubuntu-22.04
```

This installs WSL2 and Ubuntu in one command. It will take 3–5 minutes and **requires an internet connection.**

When it finishes, **restart the laptop.**

After restart, Ubuntu opens automatically. It will ask you to:
```
Enter new UNIX username: pmouser
Enter new UNIX password: (choose any password — you will need it for sudo)
Retype new UNIX password:
```

Write down this password. You will need it for `sudo` commands.

**Verify WSL2 is working:**

Open **Ubuntu** from the Start menu (or search for it). You should see a terminal prompt like:
```
pmouser@LAPTOP-NAME:~$
```

---

### Step 1C — Install Docker Desktop

1. Open a browser and go to **docker.com/products/docker-desktop**
2. Download Docker Desktop for Windows
3. Run the installer — accept defaults
4. When asked: **"Use WSL 2 based engine"** — make sure this is checked ✅
5. Complete installation and **restart if prompted**

After restart, Docker Desktop launches automatically (whale icon in system tray).

**Configure WSL integration:**

Open Docker Desktop → Settings (gear icon) → Resources → WSL Integration:
- Toggle **"Enable integration with my default WSL distro"** — ON ✅
- Toggle **Ubuntu-22.04** — ON ✅
- Click **"Apply & Restart"**

**Verify Docker works in Ubuntu terminal:**

```bash
docker --version
docker compose version
```

Expected output (versions may differ):
```
Docker version 27.x.x, build ...
Docker Compose version v2.x.x
```

If both commands return version numbers, Docker is ready.

---

## PHASE 2 — Clone and Configure

All remaining commands run in the **Ubuntu (WSL2) terminal.**

### Step 2A — Clone the Repository

```bash
cd ~
git clone https://github.com/eowork/pmoprototype.git pmo-dash
cd pmo-dash
git checkout pmo-deploy
```

Verify you are on the right branch:
```bash
git branch
# Should show: * pmo-deploy
```

Verify the key files are present:
```bash
ls
# Expected: docker-compose.yml  pmo-backend/  pmo-frontend/  backup.sh  restore.sh  handover/
```

---

### Step 2B — Configure Environment Files

**Copy the `.env` files from the USB drive.**

First, check if the USB drive is visible in WSL:

```bash
ls /mnt/
# Expected: c  d  e  (one letter per Windows drive, including USB)
```

If your USB drive letter is not listed, mount it manually (replace `e` with your actual USB letter):

```bash
sudo mkdir -p /mnt/e
sudo mount -t drvfs E: /mnt/e
```

Find your USB drive letter in Windows File Explorer (e.g., `E:\`), then copy all three `.env` files:

```bash
# Copy root .env
cp "/mnt/e/master-files/root-files/.env" ~/pmo-dash/.env

# Copy backend .env
cp "/mnt/e/master-files/pmo-backend/.env" ~/pmo-dash/pmo-backend/.env

# Copy frontend .env
cp "/mnt/e/master-files/pmo-frontend/.env" ~/pmo-dash/pmo-frontend/.env
```

> Adjust the path after `/mnt/e/` to match the folder structure on your USB.
> If any path has spaces (e.g., a folder named "Meo Angelo Alcantara"), wrap the entire path in double quotes.

**Verify all three files are in place:**

```bash
ls -la ~/pmo-dash/.env
ls -la ~/pmo-dash/pmo-backend/.env
ls -la ~/pmo-dash/pmo-frontend/.env
# All three should show file sizes > 0
```

**Check required variables are set in backend `.env`:**

```bash
grep -E "DATABASE_PASSWORD|AUTH_JWT_SECRET|SEED_PMOADMIN_PASSWORD" ~/pmo-dash/pmo-backend/.env
# All three should appear with non-empty values
```

If `SEED_PMOADMIN_PASSWORD` is missing, add it manually:

```bash
nano ~/pmo-dash/pmo-backend/.env
# Add line: SEED_PMOADMIN_PASSWORD=<your_password>
# Ctrl+O to save, Ctrl+X to exit
```

---

### Step 2C — Verify docker-compose.yml Postgres Password Requirement

```bash
grep "POSTGRES_PASSWORD" ~/pmo-dash/docker-compose.yml
```

If it shows `${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in .env}`, the stack will refuse to start without the password — this is correct security behavior.

```bash
grep "POSTGRES_PASSWORD" ~/pmo-dash/.env
# Should show: POSTGRES_PASSWORD=<some-value>
```

---

## PHASE 3 — First Boot

### Step 3A — Start the Stack

```bash
cd ~/pmo-dash
docker compose up -d
```

The **first run builds both images from source.** This takes 3–8 minutes depending on internet speed and CPU. You will see build progress in the terminal.

Do not interrupt it.

### Step 3B — Watch for Healthy Status

```bash
docker compose ps
```

Run this every 30 seconds until all containers show healthy. Expected final state:

```
NAME                  STATUS
pmo-dash-postgres-1   Up X seconds (healthy)
pmo-dash-backend-1    Up X seconds (healthy)
pmo-dash-frontend-1   Up X seconds
```

> **If backend keeps restarting:** See Troubleshooting section at the end of this guide.

### Step 3C — Confirm API and Frontend Are Up

```bash
# Health check
curl -s http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","timestamp":"...","uptime":...,"checks":{"database":{"status":"healthy","latency":...},"memory":{"status":"healthy"}}}
```

```bash
# Frontend HTTP status
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
# Expected: 200
```

---

## PHASE 4 — Verification Checklist

Open `http://localhost:3001` in a browser on the dry-run laptop. Work through each check below. Mark ✅ or ❌.

### 4A — Authentication

| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 1 | Login page loads | Browse to `http://localhost:3001` | Login form visible | |
| 2 | Local login works | Enter `pmoadmin` + your SEED_PMOADMIN_PASSWORD | Redirect to Dashboard | |
| 3 | Wrong password rejected | Enter `pmoadmin` + wrong password | "Invalid credentials" error | |
| 4 | Rate limiting active | Enter wrong password 6 times rapidly | 6th attempt shows 429 error | |
| 5 | Swagger hidden | Browse to `http://localhost:3000/api/docs` | 404 Not Found | |

### 4B — Dashboard and Navigation

| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 6 | Dashboard loads | After login | Stats and charts visible | |
| 7 | Sidebar navigation works | Click COI, UO, Users | Each page loads without error | |
| 8 | User profile visible | Click user avatar top-right | Profile dropdown shows email and role | |

### 4C — COI Module

| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 9 | COI project list loads | Navigate to COI | Page loads (may be empty on fresh DB) | |
| 10 | Create a test project | Click New Project → fill Title, Campus, Status → Save | Project appears in list | |
| 11 | Public view accessible | Open new browser tab → `http://localhost:3001/coi/public` | Public project page loads without login | |
| 12 | Document auth enforced | Try `http://localhost:3000/uploads/test.pdf` | HTTP 403 Forbidden | |

### 4D — University Operations

| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 13 | UO Physical page loads | Navigate to University Operations → Physical | Pillar sections and indicator rows visible | |
| 14 | UO Financial page loads | Navigate to University Operations → Financial | Financial table with quarter columns visible | |

### 4E — User Management

| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 15 | Users page loads | Navigate to Users (SuperAdmin only) | User list with pmoadmin visible | |
| 16 | Create a test user | Click New User → fill name, email → Save | User appears in list | |

### 4F — Backup and Restore

| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 17 | Manual backup runs | `bash ~/pmo-dash/backup.sh` | "Backup complete" with DB size and uploads size | |
| 18 | Backup folder created | `ls ~/pmo-dash/backups/` | Timestamped folder with db.dump + uploads.tar.gz | |
| 19 | Restore works | `bash ~/pmo-dash/restore.sh <timestamp>` → type YES | "Restore complete" + backend returns healthy | |
| 20 | Stack still healthy after restore | `docker compose ps` | All containers running and healthy | |

---

### Optional: Load Real Data (if you brought a backup)

```bash
# Copy backup folder from USB to the dry-run machine
cp -r /mnt/e/DRYRUN_FILES/backups/20260701_151631 ~/pmo-dash/backups/

# Restore it
bash ~/pmo-dash/restore.sh 20260701_151631
```

After restore, log in and verify:
- COI project list shows real projects from the dev machine
- UO data (Physical and Financial) is populated
- User list shows the real user accounts

---

## PHASE 5 — Schedule Cron Jobs

```bash
# Add both cron jobs non-interactively
(crontab -l 2>/dev/null; echo "0 2 * * * bash ~/pmo-dash/backup.sh >> /var/log/pmo-backup.log 2>&1"; echo "*/5 * * * * curl -sf http://localhost:3000/health -o /dev/null && echo \"\$(date): OK\" >> /var/log/pmo-health.log || echo \"\$(date): DOWN\" >> /var/log/pmo-health.log") | crontab -

# Create log files
sudo touch /var/log/pmo-backup.log /var/log/pmo-health.log
sudo chmod 666 /var/log/pmo-backup.log /var/log/pmo-health.log

# Verify
crontab -l
```

Expected: Two entries at the bottom — `0 2 * * *` and `*/5 * * * *`.

---

## PHASE 6 — Reboot Test

This confirms the stack survives a machine restart — critical for a server that may restart after power failure or updates.

```bash
# Simulate reboot: stop all containers
docker compose stop

# Verify containers are stopped
docker compose ps
# All should show "Exited"

# Bring everything back up
docker compose up -d

# Wait 30 seconds, then verify
docker compose ps
# All should return to healthy
```

---

## Pass / Fail Criteria

### PASS — All of the following are true:

- [ ] Stack boots from scratch with `docker compose up -d`
- [ ] All 3 containers reach healthy/running state
- [ ] `GET /health` returns `{"status":"ok"}`
- [ ] Login with pmoadmin credentials works
- [ ] Wrong password returns an error (not a crash)
- [ ] Rate limiting triggers after 5 rapid failed logins
- [ ] Swagger returns 404 in production mode
- [ ] Document downloads return 403 (unauthorized)
- [ ] COI public page loads without login
- [ ] Backup script completes successfully
- [ ] Restore script completes and system returns healthy
- [ ] Stack survives a stop-start cycle

### FAIL — Any of the following is true:

- Backend container keeps restarting after `docker compose up -d`
- Cannot log in with the correct pmoadmin password
- Any critical module (COI, UO, Users) fails to load
- Backup or restore script errors out
- Stack does not recover after a restart

---

## What to Record

After the dry run, write down:

| Item | Value |
|---|---|
| Date | |
| Dry-run laptop model | |
| Time to complete (minutes) | |
| Steps that caused confusion | |
| Any step that failed | |
| Workaround used (if any) | |
| Overall result | PASS / FAIL |
| Documentation gaps found | |

This record becomes input for updating `handover/DEPLOYMENT.md` before the real MIS handover.

---

## Troubleshooting

### Backend keeps restarting

```bash
docker compose logs backend --tail=30
```

| Error message | Cause | Fix |
|---|---|---|
| `password authentication failed` | `DATABASE_PASSWORD` in `pmo-backend/.env` does not match `POSTGRES_PASSWORD` in root `.env` | Edit both files to match |
| `POSTGRES_PASSWORD must be set` | Root `.env` is missing or `POSTGRES_PASSWORD` is empty | Add the line to root `.env` |
| `ECONNREFUSED` | Postgres not yet ready when backend started | Run `docker compose up -d backend` again after 30 seconds |
| `Cannot find module` | Image build failed | Run `docker compose up -d --build backend` |

### Docker build fails (no internet / slow)

```bash
# Check internet from WSL
curl -s https://registry-1.docker.io/v2/ -o /dev/null -w "%{http_code}"
# Expected: 401 (reachable) or 200
```

If you get "Could not resolve host" — check laptop Wi-Fi. Docker image pull requires internet on first run.

### WSL2 not starting

Open PowerShell as Administrator:
```powershell
wsl --shutdown
wsl --update
wsl -d Ubuntu-22.04
```

If WSL2 still fails to start, virtualization may not be enabled (see Phase 1 Step 1A — AMD SVM Mode).

### Port already in use (3000 or 3001)

```bash
# Check what is using the port
ss -tlnp | grep -E "3000|3001"

# Kill the process if it's not Docker
kill -9 <PID>
```

Or change the ports in root `.env` (`BACKEND_PORT`, `FRONTEND_PORT`) and restart the stack.

### USB drive not visible in WSL

In WSL terminal:
```bash
ls /mnt/
# Should show: c  d  e  (letters for each Windows drive)
```

If your USB letter is not listed:
```bash
sudo mkdir /mnt/e
sudo mount -t drvfs E: /mnt/e
```

### Forgot SEED_PMOADMIN_PASSWORD

```bash
# Generate a new bcrypt hash
docker compose exec -T backend node -e "const bcrypt = require('bcrypt'); bcrypt.hash('newpassword123', 10).then(h => console.log(h));"

# Apply the hash
docker compose exec -T postgres psql -U postgres -d pmo_dashboard -c \
  "UPDATE users SET password_hash = '\$2b\$10\$PASTE_HASH_HERE' WHERE username = 'pmoadmin';"
```

---

## Definition of Done

The clean-room dry run is complete and successful when:

1. All Phase 4 verification checks are marked ✅
2. Backup and restore (Phase 4F) confirmed working
3. Stack survived a stop-start cycle (Phase 6)
4. Findings recorded in the table above
5. Any documentation gaps found are reported to the outgoing developer for fixes

**Once this is done, PMO CORE is proven deployable by anyone following the documentation. The handover can proceed.**
