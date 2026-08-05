# CSU CORE Dashboard — AMD Ryzen Laptop Setup Guide

> **Purpose:** Prepare a brand-new Windows 11 AMD Ryzen laptop to run PMO CORE from scratch.
> **Use this guide FIRST** — before opening `DRYRUN_GUIDE.md`.
> **Audience:** Someone who has never used WSL2 or Docker before.
> **Total time:** 45–75 minutes (depending on internet speed and hardware).
> **Internet required:** Yes — approximately 500 MB of downloads.

---

## Pre-Flight Checklist

Complete every item before proceeding. A missing item will stop you mid-installation.

### Hardware Check

Open **Windows PowerShell** (search "PowerShell" in the Start menu — no need for Administrator yet):

```powershell
# Check RAM
(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1GB
```

Expected output: `8` or higher. If lower than `8`, Docker will likely crash or run very slowly.

```powershell
# Check free disk space on C:
(Get-PSDrive C).Free / 1GB
```

Expected output: `10` or higher (in GB). Docker images + build cache need ~8 GB minimum.

### Windows Version Check

Press `Win + R` → type `winver` → press `Enter`.

A popup appears. Look for the build number:
```
Windows 11
Version 23H2 (OS Build 22631.xxxx)
```

The build number must be **19041 or higher**. Windows 11 is always sufficient. Windows 10 below build 19041 will not support WSL2.

### Internet Check

```powershell
# Test internet connectivity
Test-NetConnection -ComputerName "registry-1.docker.io" -Port 443
```

Expected output includes `TcpTestSucceeded : True`. If False, check Wi-Fi connection before proceeding — Docker cannot download images without internet.

### Checklist Summary

| Item | Required | Check |
|---|---|---|
| RAM | 8 GB minimum | |
| Free disk space | 10 GB minimum | |
| Windows build | 19041 or higher | |
| Internet | Active and stable | |
| USB drive with `.env` files | From dev machine | |
| `pmoadmin` password | Written down | |

**Only proceed when all boxes are checked.**

---

## Section 1 — Enable AMD SVM Mode in BIOS

### What Is SVM Mode?

SVM (Secure Virtual Machine) is AMD's hardware virtualization feature. WSL2 — the Linux layer that Docker runs on — requires this to be enabled. It is often **disabled by default** on factory-fresh laptops.

**How to know if you need this step:** Skip to Section 2 and run the WSL2 install command. If it completes without errors, SVM was already enabled. Come back to Section 1 only if you see error `0x80370102`.

---

### Step 1A — Enter BIOS

Completely shut down the laptop (not restart — fully power off).

Power it on and **immediately** press the BIOS key repeatedly until the BIOS screen appears. The key depends on your laptop brand:

| Brand | BIOS Key | Notes |
|---|---|---|
| ASUS | `Delete` or `F2` | Press repeatedly right after power-on |
| Acer | `F2` | Press repeatedly right after power-on |
| HP | `F10` | Or press `Escape` first, then `F10` from the menu |
| Lenovo | `F2` or `Fn + F2` | On some Lenovo models: `Enter` then `F1` |
| MSI | `Delete` | Press repeatedly right after power-on |
| Dell | `F2` | Press repeatedly right after power-on |
| Samsung | `F2` | Press repeatedly right after power-on |

> **Tip:** If you miss the window, the laptop boots into Windows normally. Shut down completely and try again — you have about 2–3 seconds after the manufacturer logo appears.

You will see a screen that looks something like this (appearance varies by manufacturer):

```
┌─────────────────────────────────────────────┐
│  ASUS UEFI BIOS Utility                     │
│  Main  Advanced  Boot  Security  Exit       │
│                                             │
│  System Information                         │
│  CPU: AMD Ryzen 7 5700U                     │
│  Memory: 16384 MB                           │
└─────────────────────────────────────────────┘
```

---

### Step 1B — Navigate to SVM Mode

Use arrow keys to navigate. Mouse may or may not work in BIOS.

Find the path for your brand:

**ASUS:**
```
Advanced → CPU Configuration → SVM Mode → [Disabled] → change to [Enabled]
```

**Acer:**
```
Advanced → Virtualization Technology (AMD-V) → [Disabled] → change to [Enabled]
```

**HP:**
```
Advanced → System Options → Virtualization Technology (AMD-V) → check the box ✅
```

**Lenovo:**
```
Configuration → AMD SVM Technology → [Disabled] → change to [Enabled]
```
*(On some Lenovo models it is under Security → Virtualization)*

**MSI:**
```
OC → CPU Features → SVM Mode → [Disabled] → change to [Enabled]
```

**Dell:**
```
Virtualization Support → Virtualization → Enable Intel Virtualization Technology ✅
```
*(Dell labels it as "Intel" even on AMD laptops — this is normal)*

**Generic AMI BIOS (no brand listed):**
```
Advanced → CPU Configuration → SVM Mode → [Enabled]
```

---

### Step 1C — Save and Exit

Press `F10` to save and exit (on most BIOS). Confirm with `Yes` when prompted.

The laptop restarts into Windows.

---

### Step 1D — Confirm SVM Is Now Active

After Windows loads, open PowerShell and run:

```powershell
# Check if virtualization is enabled
(Get-ComputerInfo).HyperVRequirementVirtualizationFirmwareEnabled
```

Expected output: `True`

If it shows `False`, SVM is still disabled — return to BIOS and try again.

---

## Section 2 — Install WSL2 and Ubuntu 22.04

### Step 2A — Open PowerShell as Administrator

Right-click the **Start button** → select **"Windows PowerShell (Admin)"** or **"Terminal (Admin)"**.

A blue/black window opens. The title bar should say "Administrator."

---

### Step 2B — Install WSL2 and Ubuntu

Type this command exactly and press `Enter`:

```powershell
wsl --install -d Ubuntu-22.04
```

**What you will see (this is normal — do not close the window):**

```
Installing: Virtual Machine Platform
Virtual Machine Platform has been installed.
Installing: Windows Subsystem for Linux
Windows Subsystem for Linux has been installed.
Downloading: WSL Kernel
Installing: WSL Kernel
WSL Kernel has been installed.
Downloading: Ubuntu 22.04 LTS
The requested operation is successful. Changes will not be effective until the system is rebooted.
```

This takes **3–5 minutes**. Progress may appear to stall — this is normal during the download phase.

**When it finishes:** You will see the "requested operation is successful" message.

---

### Step 2C — Restart the Laptop

Click Start → Power → Restart (not Shut down — Restart).

After the restart, **Ubuntu will open automatically** in a new window. If it does not, open the Start menu and search for "Ubuntu."

---

### Step 2D — Ubuntu First-Time Setup

Ubuntu shows this on first launch:

```
Installing, this may take a few minutes...
```

Wait 1–2 minutes. Then:

```
Please create a default UNIX user account. The username does not need to match
your Windows username.
For more information visit: https://aka.ms/wslusers
Enter new UNIX username:
```

Type a username (no spaces, all lowercase). Example: `pmouser`

```
New password:
```

Type a password. **Nothing will appear as you type — this is normal.** Press `Enter` when done.

```
Retype new password:
```

Type the same password again. Press `Enter`.

```
passwd: password updated successfully
```

You will now see your Ubuntu terminal prompt:

```
pmouser@LAPTOP-NAME:~$
```

**You are now inside Linux.** Everything from this point forward happens in this Ubuntu terminal unless told otherwise.

---

### Step 2E — Common WSL2 Installation Errors

**Error: `0x80370102`**
```
WslRegisterDistribution failed with error: 0x80370102
Please enable the Virtual Machine Platform Windows feature and ensure
virtualization is enabled in the BIOS.
```
**Fix:** Return to Section 1 and enable SVM Mode in BIOS.

---

**Error: `0x80004005`**
```
Error: 0x80004005
```
**Fix:** Run this in Administrator PowerShell, then restart:
```powershell
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
Restart-Computer
```

---

**Error: `0x8007019e` or Ubuntu does not install**
```
Error: 0x8007019e
The Windows Subsystem for Linux optional component is not enabled.
```
**Fix:** Run in Administrator PowerShell:
```powershell
wsl --install
Restart-Computer
```
Then retry `wsl --install -d Ubuntu-22.04`.

---

**Ubuntu window does not open after restart**

Open Start menu → search "Ubuntu" → click "Ubuntu 22.04 LTS." It will continue first-time setup.

---

### Step 2F — Verify WSL2 Is Working

In the Ubuntu terminal:

```bash
uname -r
```

Expected output (version number will vary):
```
5.15.167.4-microsoft-standard-WSL2
```

The important part is `WSL2` at the end. If you see that, WSL2 is correctly installed.

```bash
lsb_release -a
```

Expected output:
```
No LSB modules are available.
Distributor ID: Ubuntu
Description:    Ubuntu 22.04.x LTS
Release:        22.04
Codename:       jammy
```

---

## Section 3 — Configure Ubuntu

### Step 3A — Set Git Identity

Run these two commands in the Ubuntu terminal. Replace the name and email with your own:

```bash
git config --global user.name "Angelo Alcantara"
git config --global user.email "meoangeloalcantara@gmail.com"
```

No output is expected. Verify:

```bash
git config --global --list
```

Expected output:
```
user.name=Angelo Alcantara
user.email=meoangeloalcantara@gmail.com
```

---

### Step 3B — Update Ubuntu Package List

This keeps Ubuntu's software database current and prevents download errors later:

```bash
sudo apt update
```

You will be asked for your Ubuntu password (the one you set in Step 2D). Nothing appears as you type — press `Enter` when done.

Expected output (last few lines):
```
Get:XX https://... Packages [XXX kB]
Fetched XXX kB in Xs (XXX kB/s)
Reading package lists... Done
```

This takes 30–60 seconds.

---

## Section 4 — Install Docker Desktop

### Step 4A — Download Docker Desktop

Open a **Windows browser** (Edge or Chrome — not the Ubuntu terminal).

Go to: `https://www.docker.com/products/docker-desktop/`

Click **"Download for Windows"**. The file is approximately **600 MB**. Download time varies by internet speed:

| Speed | Estimated time |
|---|---|
| 10 Mbps | ~8 minutes |
| 50 Mbps | ~2 minutes |
| 100 Mbps | ~1 minute |

---

### Step 4B — Run the Installer

Double-click the downloaded file (`Docker Desktop Installer.exe`).

Windows may show a UAC prompt: **"Do you want to allow this app to make changes?"** → Click **Yes**.

The installer window opens. You will see two checkboxes:

```
☑  Use WSL 2 instead of Hyper-V (recommended)
☑  Add shortcut to desktop
```

**Make sure the first checkbox is checked.** The second is optional. Click **OK**.

Installation progress bar runs for 2–4 minutes. When complete:

```
Installation succeeded
Close and restart
```

Click **"Close and restart"**. The laptop will restart.

---

### Step 4C — Docker Desktop First Launch

After restart, Docker Desktop launches automatically. You will see:

**Docker Desktop Service Agreement** — Read and click **Accept**.

The Docker Desktop dashboard opens. It may show a tutorial. Click **Skip tutorial** or **Skip** — you do not need it.

Look at the **system tray** (bottom-right corner of the taskbar). Find the whale icon 🐋.

- **"Docker Desktop is running"** — ✅ Ready
- **"Docker Desktop is starting..."** — ⏳ Wait 1–2 more minutes
- **"Docker Desktop failed to start"** — ❌ See troubleshooting below

Do not proceed until the tray icon says **"Docker Desktop is running."**

---

### Step 4D — Configure WSL Integration (Critical Step)

This step connects Docker to your Ubuntu terminal. **Without this, Docker commands will not work in Ubuntu.**

In Docker Desktop, click the **gear icon** (Settings) in the top-right.

Navigate: **Resources → WSL Integration**

You will see:

```
□  Enable integration with my default WSL distro

Manual integration with specific distros:
□  Ubuntu
□  Ubuntu-22.04
```

1. Toggle **"Enable integration with my default WSL distro"** → **ON** ✅
2. Toggle **Ubuntu-22.04** → **ON** ✅

Click **"Apply & Restart"** at the bottom.

Docker Desktop restarts internally (30–60 seconds). The tray icon will briefly show "starting" then return to "running."

---

### Step 4E — Verify Docker Works in Ubuntu

Open the Ubuntu terminal (Start menu → Ubuntu).

```bash
docker --version
```

Expected output:
```
Docker version 27.x.x, build xxxxxxx
```

```bash
docker compose version
```

Expected output:
```
Docker Compose version v2.x.x
```

**If you see `docker: command not found`:** Return to Step 4D. The WSL integration toggle for Ubuntu-22.04 is not ON.

**If you see `permission denied while trying to connect to the Docker daemon`:**

```bash
sudo usermod -aG docker $USER
```

Then **close and reopen** the Ubuntu terminal. Run `docker --version` again.

---

### Step 4F — Common Docker Desktop Errors

**Docker Desktop stuck on "starting" for more than 5 minutes:**

1. Right-click the whale tray icon → Quit Docker Desktop
2. Restart the laptop
3. Open Docker Desktop from the Start menu

---

**"An unexpected error occurred" during install:**

1. Uninstall Docker Desktop via Windows Settings → Apps
2. Restart the laptop
3. Re-download and reinstall (Step 4A)

---

**`docker: command not found` after WSL integration configured:**

Close the Ubuntu terminal completely. Re-open it. Run `docker --version` again.
If still not found — in Docker Desktop, toggle the Ubuntu-22.04 integration OFF, click Apply, then toggle back ON, click Apply & Restart.

---

## Section 5 — Verify Everything Is Ready

Run all six of these commands in the Ubuntu terminal. Every output must match what is shown. Do not proceed to the dry run until all six pass.

```bash
# 1. WSL2 running
uname -r | grep WSL2
```
Expected: `5.15.xxx.x-microsoft-standard-WSL2` (any version with WSL2)

```bash
# 2. Ubuntu version correct
lsb_release -d
```
Expected: `Description:	Ubuntu 22.04.x LTS`

```bash
# 3. Docker installed
docker --version
```
Expected: `Docker version 27.x.x, build ...`

```bash
# 4. Docker Compose installed
docker compose version
```
Expected: `Docker Compose version v2.x.x`

```bash
# 5. Docker daemon reachable
docker info 2>&1 | grep "Server Version"
```
Expected: `Server Version: 27.x.x`
If output is blank or shows an error — Docker Desktop is not running. Open it from the Start menu.

```bash
# 6. Git configured
git config --global user.name && git config --global user.email
```
Expected: Your name on line 1, your email on line 2.

---

### Ready Gate

| Check | Command | Expected | Pass? |
|---|---|---|---|
| WSL2 active | `uname -r \| grep WSL2` | Line with WSL2 | |
| Ubuntu 22.04 | `lsb_release -d` | Ubuntu 22.04.x LTS | |
| Docker version | `docker --version` | Version number | |
| Compose version | `docker compose version` | Version number | |
| Docker daemon | `docker info 2>&1 \| grep "Server Version"` | Server Version: ... | |
| Git identity | `git config --global user.name` | Your name | |

**When all 6 rows are checked: your machine is ready. Open `DRYRUN_GUIDE.md` and begin from PHASE 0.**

---

## Section 6 — What to Expect During First `docker compose up`

This section prepares you for what the first boot looks like. Reading it before running the command prevents unnecessary panic.

### The First Boot Downloads Everything

On a completely fresh machine with no Docker cache, the command:

```bash
docker compose up -d
```

…will download approximately **450–500 MB** and build the application images. This takes time. It is normal. Do not interrupt it.

### What You Will See

The terminal prints a long build log. Here is what it means, annotated:

```
[+] Building 0.0s (0/0)                            ← Starting to plan the build

[+] Building 2.1s (3/18)
 => [backend internal] load build definition        ← Reading the Dockerfile
 => [backend] FROM docker.io/library/node:20-alpine ← Downloading Node.js base image (~180 MB)
 => CACHED [backend 1/8] WORKDIR /app              ← Using cached layer (fast)

[+] Building 45.2s (10/18)
 => [backend 5/8] RUN npm ci                       ← Installing npm packages (~2-3 min)
```

**The `npm ci` step takes the longest (2–4 minutes)** because it downloads all backend dependencies. This is normal — it looks frozen but is working.

```
[+] Building 180.3s (18/18) FINISHED               ← Build complete ✅

[+] Running 3/3
 ✔ Container pmo-dash-postgres-1  Started           ← Database started ✅
 ✔ Container pmo-dash-backend-1   Started           ← API started ✅
 ✔ Container pmo-dash-frontend-1  Started           ← Web app started ✅
```

When you see `Running 3/3` with all three containers showing a checkmark — the system is up.

### Build Time Estimates by AMD Ryzen Model

| Processor | RAM | Estimated First Build Time |
|---|---|---|
| Ryzen 3 (4-core) | 8 GB | 8–12 minutes |
| Ryzen 5 (6-core) | 8 GB | 6–9 minutes |
| Ryzen 5 (6-core) | 16 GB | 4–7 minutes |
| Ryzen 7 (8-core) | 16 GB | 3–5 minutes |
| Ryzen 9 (12-core+) | 16–32 GB | 2–4 minutes |

**Subsequent starts** (after the first build) take only **30–60 seconds** because images are cached.

### Signs Something Is Wrong

| What you see | What it means | Fix |
|---|---|---|
| Build stops at `npm ci` for more than 10 minutes with no progress | Network timeout during npm install | Press `Ctrl+C`, run `docker compose up -d --build` again |
| `ERROR [backend X/Y]` in red | A build step failed | Check internet, then run `docker compose up -d --build` |
| `no space left on device` | Less than 5 GB free disk space | Delete large files from Windows, then retry |
| `docker: cannot connect to the Docker daemon` | Docker Desktop is not running | Open Docker Desktop from Start menu, wait for "running" |

### After the Build — Checking Container Health

```bash
docker compose ps
```

Expected output:
```
NAME                  IMAGE              STATUS
pmo-dash-postgres-1   postgres:18-alpine Up 30 seconds (healthy)
pmo-dash-backend-1    pmo-dash-backend   Up 25 seconds (healthy)
pmo-dash-frontend-1   pmo-dash-frontend  Up 20 seconds
```

The backend must show `(healthy)` before the application is usable. If it shows `(health: starting)`, wait another 30 seconds and run `docker compose ps` again.

If it shows `Restarting` — see the Troubleshooting section below.

---

## Troubleshooting Reference

### WSL2 Does Not Install (`0x80370102`)

```
WslRegisterDistribution failed with error: 0x80370102
```

**Cause:** AMD SVM Mode is disabled in BIOS.
**Fix:** Section 1 — enter BIOS and enable SVM Mode.

---

### Docker Command Not Found in Ubuntu

```
pmouser@LAPTOP:~$ docker --version
Command 'docker' not found
```

**Cause:** Docker Desktop WSL integration not configured for Ubuntu-22.04.
**Fix:**
1. Open Docker Desktop → gear icon → Resources → WSL Integration
2. Toggle Ubuntu-22.04 → ON
3. Click Apply & Restart
4. Close and reopen Ubuntu terminal

---

### Backend Container Keeps Restarting

```bash
docker compose ps
# Shows: pmo-dash-backend-1   Restarting
```

Check the logs:
```bash
docker compose logs backend --tail=20
```

| Error in logs | Cause | Fix |
|---|---|---|
| `password authentication failed for user "postgres"` | `DATABASE_PASSWORD` in `pmo-backend/.env` does not match `POSTGRES_PASSWORD` in root `.env` | Edit both files to use the same value |
| `POSTGRES_PASSWORD must be set` | Root `.env` is missing or the variable is empty | Open root `.env` and ensure `POSTGRES_PASSWORD=<value>` is present |
| `ECONNREFUSED 127.0.0.1:5432` | Postgres not ready when backend started | Run `docker compose up -d backend` again after 30 seconds |

---

### Cannot Find USB Drive in Ubuntu

```bash
ls /mnt/
```

Expected: `c  d  e  f  ...` — one letter per Windows drive.

If your USB letter does not appear:
```bash
# Mount the USB manually (replace e with your USB drive letter)
sudo mkdir -p /mnt/e
sudo mount -t drvfs E: /mnt/e
ls /mnt/e
```

---

### Port Already in Use

```
Error response from daemon: driver failed programming external connectivity:
Bind for 0.0.0.0:3001 failed: port is already allocated
```

**Fix:**
```bash
# Find what is using port 3001
ss -tlnp | grep 3001

# Or change the port in root .env
nano ~/pmo-dash/.env
# Edit FRONTEND_PORT=3001 to FRONTEND_PORT=3002
# Then restart: docker compose up -d
```

---

### Build Fails Midway (Network Error)

```
ERROR [backend 5/8] RUN npm ci --only=production
npm ERR! network timeout
```

**Fix:** Retry the build — this is usually a temporary network issue:
```bash
docker compose down
docker compose up -d --build
```

---

### Docker Desktop Will Not Start After Laptop Wakes from Sleep

Docker Desktop sometimes loses connection to WSL2 after sleep.

**Fix:**
1. Right-click tray icon → Quit Docker Desktop
2. Wait 10 seconds
3. Open Docker Desktop from Start menu
4. Wait for "Docker Desktop is running" in tray
5. Then run `docker compose up -d` in Ubuntu terminal

---

## Quick Reference Card

Keep this visible during the dry run:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PMO CORE — Quick Reference
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  START STACK:     docker compose up -d
  STOP STACK:      docker compose stop  (data safe)
  CHECK STATUS:    docker compose ps
  VIEW LOGS:       docker compose logs -f backend
  HEALTH CHECK:    curl http://localhost:3000/health

  FRONTEND:        http://localhost:3001
  LOGIN:           pmoadmin / <SEED_PMOADMIN_PASSWORD>

  BACKUP:          bash ~/pmo-dash/backup.sh
  RESTORE:         bash ~/pmo-dash/restore.sh <timestamp>

  NEVER RUN:       docker compose down -v   ← DELETES ALL DATA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## When This Guide Is Complete

When Section 5 — Verify Everything Is Ready — shows all 6 checks passing, your AMD Ryzen laptop is fully prepared.

**Next step:** Open `handover/DRYRUN_GUIDE.md` and begin from **PHASE 0 — What to Bring.**
