# PMO CORE — Deployment Learning Handbook

> **Author:** Generated from ACE Phase 1 + 2 research — PMO CORE project, July 2026
> **Purpose:** Personal reference handbook for the operator and future maintainers
> **Audience:** Developers with application experience, limited DevOps exposure
> **Style:** Progressive — read from start to finish the first time; use as reference thereafter

---

# Table of Contents

1. [Introduction](#1-introduction)
2. [The Big Picture — Software Lifecycle](#2-the-big-picture)
3. [Understanding the Current PMO CORE System](#3-understanding-the-current-pmo-core-system)
4. [Understanding Every Technology](#4-understanding-every-technology)
5. [PMO CORE Architecture — How It All Connects](#5-pmo-core-architecture)
6. [The Deployment Journey](#6-the-deployment-journey)
7. [Common Beginner Questions](#7-common-beginner-questions)
8. [PMO CORE Deployment Roadmap](#8-pmo-core-deployment-roadmap)
9. [Practical Analogies](#9-practical-analogies)
10. [Learning Roadmap](#10-learning-roadmap)

---

# 1. Introduction

## Why These Notes Exist

You built PMO CORE from the ground up. You understand every feature, every database table, every API route. But building a system and deploying it to a production server are two entirely different disciplines. Most developers spend years writing code before they ever have to think about what happens when that code leaves their laptop and runs on a server that other people depend on every day.

These notes exist because you are at that exact moment. The application is finished. The question now is: how do you make it reliably available to the university?

This handbook consolidates everything you have learned and implemented during the deployment preparation phase into one reference document. It explains not just what was done but why — because understanding the reasoning is what transforms instructions into judgment.

## Current Stage of PMO CORE

PMO CORE is an institutional project management dashboard for Caraga State University. As of July 2026, the system is **approximately 82% deployment-ready**. All application features are complete. The remaining work is infrastructure: making the system reliably run on a university server, survive power cycles and failures, and be maintainable by someone other than the original developer.

## What You Will Understand After Reading This

- Why production deployments are fundamentally different from development environments
- What every technology in the stack does and why it was chosen
- How data moves through the entire PMO CORE system
- What the MIS team needs to do and why you cannot do it yourself
- How to think about system reliability, backups, and recovery
- How to explain the system clearly to non-technical stakeholders

---

# 2. The Big Picture

## The Software Lifecycle

Every software system passes through the same fundamental stages. Understanding where you are in that lifecycle — and what comes next — prevents the anxiety of thinking you are "almost done" when significant work remains.

```
Planning
  ↓   You decided what to build and for whom
Research
  ↓   You studied the domain, existing tools, technical constraints
Development
  ↓   You wrote the code — features, modules, APIs, UI
Testing
  ↓   You verified features work as expected
Pre-Deployment          ← PMO CORE is here right now
  ↓   You harden the system, migrate data, set up infrastructure
Deployment
  ↓   You run the system on the production server for the first time
Production
  ↓   Real users access the system daily
Maintenance
  ↓   You monitor, back up, patch, and fix issues
Future Development
      New features are added to a running system
```

PMO CORE completed Development and Testing months ago. The current work — Docker hardening, security fixes, backup scripts, handover documentation — is all Pre-Deployment work. This is a distinct engineering discipline with its own set of concerns.

## Why Pre-Deployment Takes So Long

In development, if something breaks, you fix it on your laptop and try again. Nobody is affected except you.

In production, if something breaks, real people cannot do their work. Reports are delayed. Data may be lost. The university MIS Director is on the phone asking what happened.

Pre-deployment work exists to answer the question: *what happens when things go wrong in production, and how do we recover?* This forces you to think about:

- What if the server reboots unexpectedly?
- What if an important file gets deleted?
- What if a wrong password change locks everyone out?
- What if the database needs to be moved to a different server?

None of these scenarios are edge cases in a real institution. They happen regularly. Pre-deployment is about preparing for them before they happen, not after.

---

# 3. Understanding the Current PMO CORE System

## What Has Been Completed

PMO CORE is a three-tier web application serving the Project Management Office of Caraga State University. The following have been fully built and verified:

**Application Modules:**

| Module | Purpose |
|---|---|
| COI (Construction of Infrastructure) | Tracks construction and repair projects across all campuses |
| University Operations (UO) | BAR No. 1 (Physical) and BAR No. 2 (Financial) quarterly accomplishments |
| Repairs | Repair and maintenance project management |
| GAD Parity | Gender and Development data entry and reporting |
| User Management | Role-based user accounts with campus and module-level access |
| Authentication | Local login, Google OAuth, LDAP/AD (institutional) |

**Infrastructure Completed:**

| Item | What It Does |
|---|---|
| Docker Compose stack | Runs all three services (database, backend, frontend) in isolation |
| Security hardening | CORS restriction, Swagger disabled in production, upload protection |
| Backup and restore scripts | Automated daily backup with one-command recovery |
| LDAP test directory | Proves institutional login works before MIS provides real credentials |
| Handover documentation | Deployment guide, operations runbook, MIS checklist, user guide |

## What Remains

| Item | Owner | Priority |
|---|---|---|
| Cron backup scheduling | Operator (1 command) | P0 — do today |
| Clean-room dry run | Operator (on another device) | P0 — proves the deployment guide works |
| TLS/HTTPS setup | MIS | P1 — cannot proceed without MIS |
| LDAP swap to real AD | MIS + Successor | P1 — 6-line `.env` change when MIS provides values |
| Upload AV scanning | MIS/Successor | P2 — post-launch |

## Honest Engineering Assessment

PMO CORE is a well-structured institutional system. The codebase is clean, documented, and maintainable. The deployment preparation has addressed the most critical risks: data persistence, authentication, file security, backup, and documentation.

What it is not yet: battle-hardened by months of real usage. The first few weeks in production will likely surface edge cases that testing did not catch. This is normal for any institutional system and is why the operations runbook and escalation procedures matter.

---

# 4. Understanding Every Technology

This section explains every major technology in PMO CORE. Each explanation follows the same structure: what it is, why it exists, why PMO CORE needs it, and what would happen without it.

---

## Windows

**What it is:** The operating system installed on the developer's laptop (Windows 11 in this case).

**Why it exists:** It is the most common desktop OS in the Philippines academic context.

**The challenge it creates:** Most web servers run Linux, not Windows. The software tools used to build web servers — Docker, nginx, bash scripts — were designed for Linux. Running them on Windows requires an additional compatibility layer.

**What would happen without a solution:** You would have to choose between developing on Windows (comfortable) or developing on Linux (where deployment tools work naturally). This tension is exactly what WSL2 solves.

---

## Linux

**What it is:** A family of free, open-source operating systems used by the vast majority of web servers in the world.

**Why it exists:** Linux was designed from the beginning for multi-user, networked computing. It is stable, efficient, and has decades of tools built around server operations.

**Why PMO CORE needs it:** The production MIS server will almost certainly run Linux (Ubuntu, CentOS, or similar). Docker runs natively on Linux. All the deployment scripts (`backup.sh`, `restore.sh`) are Linux bash scripts.

**What would happen without it:** PMO CORE would need different tooling for Windows servers, which is less common, less documented, and more expensive.

---

## Ubuntu

**What it is:** The most popular distribution (version) of Linux. A "distribution" packages the Linux kernel together with common tools, a package manager, and a user environment.

**Why PMO CORE uses it:** Ubuntu 22.04 LTS (Long Term Support) is what WSL2 provides by default, and it is one of the most common choices for university servers. LTS means it receives security updates for five years — important for a long-running institutional system.

---

## WSL2 (Windows Subsystem for Linux 2)

**What it is:** A compatibility layer built into Windows that runs a real Linux kernel inside a virtual machine that is tightly integrated with Windows. It lets you open a terminal that behaves exactly like a Linux server terminal — while still using Windows for everything else.

**Why it exists:** Microsoft built WSL2 so developers on Windows could use Linux tools without dual-booting or running a slow virtual machine.

**Why PMO CORE uses it:** All deployment operations — starting Docker, running backup scripts, connecting to the database — are done in the WSL Ubuntu terminal. The project files live on the Windows `D:\` drive but are accessed in WSL at `/mnt/d/`.

**A practical example:** When you type `docker compose up -d` in the Ubuntu terminal, Linux is actually executing that command. The Docker daemon runs in Linux. The result is visible from Windows because WSL2 bridges the two.

**What would happen without it:** On Windows, you would need Docker Desktop with its own complexity, and bash scripts would not run without modification.

---

## Docker

**What it is:** A tool that packages software into self-contained units called **containers**. A container includes the application code and everything it needs to run: the runtime, libraries, configuration, and dependencies.

**The problem it solves:** "It works on my machine" is the most common phrase in software development. Docker eliminates this problem by ensuring that the exact same environment that works on your laptop runs identically on the production server.

**Why PMO CORE uses it:** PMO CORE has three components (database, backend, frontend) that each have their own dependencies and versions. Without Docker, installing and configuring all of these correctly on a new server is a multi-hour, error-prone process. With Docker, it is one command: `docker compose up -d`.

**Analogy:** Think of Docker containers like shipping containers on a cargo ship. Before standardized shipping containers, every type of cargo required different loading equipment, different ships, and different handling. Standardized containers meant any cargo could go on any ship. Docker containers work the same way — any application can run on any server that has Docker installed.

---

## Containers

**What a container is:** A running instance of a Docker image. Think of it as a running process that is isolated from the host operating system and from other containers — but still shares the host's kernel for efficiency.

**The key properties of containers:**

1. **Isolation:** What happens inside a container does not affect the host or other containers (unless deliberately configured to).
2. **Reproducibility:** Starting the same image always produces the same container.
3. **Ephemerality:** Containers can be deleted and recreated at any time. This is a feature, not a bug — it enforces the discipline that important data must live outside the container.

**In PMO CORE you have three containers running simultaneously:**

```
pmo-dash-postgres-1    ← the database
pmo-dash-backend-1     ← the NestJS API
pmo-dash-frontend-1    ← the Nuxt SPA server
```

---

## Images

**What an image is:** A read-only template from which containers are created. An image is like a recipe; a container is the meal you cook from it.

**Where images come from:** Either pulled from Docker Hub (a public registry of pre-built images) or built from a `Dockerfile` (a set of instructions that describes how to assemble the image).

**In PMO CORE:**
- `postgres:18-alpine` — pulled from Docker Hub (official PostgreSQL image, Alpine Linux variant for small size)
- `pmo-dash-backend` — built from `pmo-backend/Dockerfile` (your custom NestJS image)
- `pmo-dash-frontend` — built from `pmo-frontend/Dockerfile` (your custom Nuxt image)

**Why this matters for deployment:** When you run `docker compose up -d --build`, Docker rebuilds your custom images from source. This bakes your latest code changes into the image. The old container is replaced by a new one. This is how you deploy updates.

---

## Volumes

**What a volume is:** A persistent storage location that exists outside the container. Data written to a volume survives container deletion and recreation.

**Why this is critical:** Remember that containers are ephemeral. If you stored your database data inside a container, deleting the container (which happens during updates) would delete all your data. Volumes solve this.

**In PMO CORE you have two volumes:**

| Volume | What it stores |
|---|---|
| `pgdata` | All PostgreSQL database data — every user, project, report, indicator |
| `backend_uploads` | All uploaded files — project photos, documents, templates |

**The critical rule this establishes:** The volumes are the irreplaceable parts of the system. The containers are replaceable. You can delete every container and rebuild from scratch — as long as the volumes are intact and you have the source code, the system can be fully restored.

**The most dangerous command in this context:** `docker compose down -v`. The `-v` flag deletes volumes. Never run this in production. Ever.

---

## Docker Compose

**What it is:** A tool for defining and running multi-container Docker applications. Instead of starting each container with a long `docker run` command, you describe the entire stack in a single file (`docker-compose.yml`) and manage it with simple commands.

**Why PMO CORE uses it:** PMO CORE requires three services to run together in a specific order: PostgreSQL must be healthy before the backend starts, and the backend must be healthy before the frontend starts. Docker Compose handles this dependency chain automatically via `condition: service_healthy`.

**The key commands you use daily:**

```bash
docker compose up -d              # Start all services in the background
docker compose up -d --build backend  # Rebuild and restart the backend
docker compose ps                 # Check status of all containers
docker compose logs -f backend    # Follow live backend logs
docker compose stop               # Stop all containers (data preserved)
```

**What the `docker-compose.yml` file does:** It is the single source of truth for how the entire PMO CORE infrastructure is configured. If you gave this file to any other developer with Docker installed, they could run the complete system without knowing anything else about the project.

---

## PostgreSQL

**What it is:** A free, open-source relational database management system. It stores data in structured tables with rows and columns, and allows complex queries using SQL (Structured Query Language).

**Why PMO CORE uses it:** PMO CORE manages complex, interrelated data: projects belong to campuses, indicators belong to pillars, financial records belong to quarters, users have role-based permissions. Relational databases excel at managing exactly this kind of structured, connected data.

**The PostgreSQL version matter:** PMO CORE uses `postgres:18-alpine`. PostgreSQL 18 is a recent major version. The `alpine` suffix means it is built on Alpine Linux — a very small Linux distribution chosen to keep the Docker image size small.

**Why the database port is not published:** In the current Docker Compose configuration, PostgreSQL's port 5432 is not exposed to the host network. Only the backend container (on the same Docker internal network) can reach it. This is intentional security — the database should never be directly reachable from outside the application.

**How to access the database when needed:**
```bash
docker compose exec postgres psql -U postgres -d pmo_dashboard
```
This opens a database console inside the container — no network port required.

---

## MikroORM

**What it is:** An Object-Relational Mapper (ORM) for Node.js and TypeScript. An ORM is a tool that lets you work with database records as JavaScript/TypeScript objects instead of writing raw SQL for every operation.

**Why PMO CORE uses a hybrid approach:** PMO CORE uses MikroORM for standard CRUD operations (create, read, update, delete) where an ORM's structured approach is clean and safe. For complex analytical queries — aggregations, multi-table joins, fiscal year summaries — it uses raw SQL with `em.getConnection().execute()`. This hybrid approach gives you the best of both worlds.

**An important technical detail:** When using raw SQL in MikroORM's driver, parameters must use `?` positional placeholders, not `$1, $2` style (which is native PostgreSQL syntax but not what the Knex driver layer expects). Several bugs in the project were fixed because of this distinction.

---

## NestJS

**What it is:** A progressive Node.js framework for building server-side applications. It uses TypeScript, encourages a modular architecture, and provides structure that makes large applications maintainable.

**Why PMO CORE uses it:** PMO CORE is not a small project. It has over 20 backend modules, complex authentication, file handling, role-based authorization, activity logging, and analytics. NestJS enforces structure through dependency injection, decorators, and module boundaries — making it manageable as the application grows.

**The architecture pattern:** NestJS uses a Controller-Service-Repository pattern:
- **Controllers** handle HTTP requests and route them
- **Services** contain the business logic
- **The database layer** handles data persistence

**In production Docker:** NestJS runs as a compiled JavaScript application (`dist/main.js`). The TypeScript source code is compiled during the Docker build step. This is why the image build takes a minute — it is compiling your code.

---

## Nuxt 3

**What it is:** A framework built on top of Vue 3 for building web applications. Nuxt adds routing, server-side rendering capabilities, and build tooling on top of Vue's component system.

**How PMO CORE uses it:** PMO CORE uses Nuxt in SPA (Single Page Application) mode. The entire frontend is compiled into static HTML, CSS, and JavaScript files that are served by Nitro (Nuxt's server). The application runs entirely in the browser after the initial load — subsequent navigation does not require full page reloads.

**The API relationship:** The Nuxt frontend communicates with the NestJS backend via HTTP API calls. The `NUXT_PUBLIC_API_BASE` environment variable tells the frontend where to find the API. In development this is empty (same origin). In Docker it is `http://localhost:3000`.

---

## Node.js

**What it is:** A JavaScript runtime that lets you run JavaScript code outside the browser — on a server. Both NestJS (backend) and Nuxt (frontend's build process) run on Node.js.

**Why this matters for Docker:** Both the backend and frontend Docker images are built on `node:20-alpine` — Node.js version 20 on Alpine Linux. Node.js 20 is an LTS (Long Term Support) version, meaning it receives security updates until 2026.

---

## Google OAuth

**What it is:** OAuth (Open Authorization) is a standard protocol that lets users authenticate with one service using their account from another trusted service. Google OAuth lets users log into PMO CORE using their Google account without creating a separate password.

**Why PMO CORE uses it:** CSU has institutional Google accounts (`@carsu.edu.ph`). Rather than managing separate passwords, faculty and staff can log in with credentials they already know and trust.

**The security constraint:** PMO CORE restricts Google OAuth to a specific domain (`OAUTH_ALLOWED_DOMAIN=carsu.edu.ph`). A Gmail account (`@gmail.com`) is rejected. Only `@carsu.edu.ph` accounts are permitted. This prevents unauthorized external access.

**The flow:**
```
User clicks "Sign in with Google"
  ↓
Browser navigates to Google's authentication page
  ↓
User approves with their CSU Google account
  ↓
Google redirects back to PMO CORE's callback URL
  ↓
Backend verifies the domain, creates/finds the user, issues a JWT
  ↓
User is logged in
```

---

## LDAP (Lightweight Directory Access Protocol)

**What it is:** A protocol for accessing and maintaining distributed directory information services. In practice, it is the technology behind most corporate and university "Active Directory" systems — the central database that knows every employee's username and password.

**Why universities use it:** CSU likely manages thousands of employee accounts through Microsoft Active Directory (AD), which uses LDAP. When an employee joins, their account is added to AD. When they leave, it is removed. All internal systems (email, library, HR) authenticate against this single directory.

**Why PMO CORE implements it:** Integrating with the university's LDAP means:
- Users log in with their existing university credentials
- Access is automatically revoked when employment ends
- No separate password management for PMO CORE administrators

**The test directory approach:** Since MIS has not yet provided the real AD credentials, a self-hosted test LDAP server (`osixia/openldap`) simulates the real thing. The two test users (`meoangelo.alcantara@carsu.edu.ph`, `pmoadmin@carsu.edu.ph`) with password `testldap123` have been verified to authenticate successfully. When MIS provides the real AD values, it is a 6-line change in `pmo-backend/.env` and a container restart — no code change.

**What MIS said and what it meant:**
> "Make your own LDAP environment for user management, and upon agreement for deployment, we will give you the configurations to replace."

This means exactly what was implemented: build and validate with a local test directory, and MIS will supply production values at go-live.

---

## JWT (JSON Web Token)

**What it is:** A compact, self-contained way to transmit information between parties as a cryptographically signed JSON object. In authentication, a JWT represents a logged-in user's identity and permissions.

**How it works:**

```
User submits login credentials
  ↓
Backend verifies credentials against DB or LDAP
  ↓
Backend creates a JWT: { user_id, email, roles, expiry }
  ↓
JWT is signed with a secret key only the backend knows
  ↓
JWT is returned to the browser
  ↓
Browser stores JWT in localStorage
  ↓
Every subsequent API request includes the JWT in the Authorization header
  ↓
Backend verifies the signature and reads the user's identity
```

**Why the secret key matters:** The `AUTH_JWT_SECRET` environment variable is the key used to sign all tokens. If someone knows this key, they can forge tokens for any user. This is why the `.env.example` says `CHANGE_BEFORE_DEPLOY` — a weak or leaked JWT secret compromises the entire authentication system.

**PMO CORE JWT settings:** Tokens expire in 8 hours (`AUTH_JWT_EXPIRES_IN=8h`). After expiry, the user must log in again. The system is stateless — the backend does not track active sessions. A token is valid until it expires, regardless of whether the user has logged out.

---

## Authentication vs Authorization

These two terms are often confused. They are distinct concepts.

**Authentication** answers: *Who are you?*
- Verifying a username and password
- Validating a Google OAuth token
- Verifying LDAP credentials
- Checking a JWT signature

**Authorization** answers: *What are you allowed to do?*
- Can this user access the COI module?
- Can this user edit financial records?
- Can this user see another campus's data?

**PMO CORE's 4-layer authorization model:**

| Layer | What it controls |
|---|---|
| Layer 1: System Role | Admin, Staff, Auditor, Client, Contractor |
| Layer 2: Rank Level | Rank 10 = SuperAdmin authority |
| Layer 3: Module Permission | Per-module access via `user_permission_overrides` |
| Layer 4: Record Assignment | Row-level scope for contributors |

A user might be authenticated (they logged in successfully) but still not authorized to access a specific module. Authentication is the door; authorization is which rooms you can enter.

---

## Role-Based Access Control (RBAC)

**What it is:** A method of restricting system access based on the roles assigned to individual users. Instead of assigning permissions to individual users (which becomes unmaintainable at scale), you assign permissions to roles, and users are assigned roles.

**Why PMO CORE uses it:** PMO CORE serves multiple campuses, multiple departments, and multiple types of users — directors, project managers, data encoders, auditors, and external contractors. Each has different access needs. RBAC makes this manageable.

**In practice:** A Staff user assigned to the Cabadbaran campus and the COI module can only see and edit construction projects at Cabadbaran. An Admin can see all campuses. A SuperAdmin can manage users and system settings. The same codebase serves all of them with appropriate restrictions.

---

## File Storage and Upload Persistence

**The challenge:** Users upload photos of construction sites and scanned documents. These files must survive container restarts and deployments.

**The solution in PMO CORE:** Uploaded files are stored in a named Docker volume (`backend_uploads`) mounted at `/app/uploads` inside the backend container. Because it is a volume, the files persist even if the container is deleted and recreated.

**The two-tier access model:**

| File type | How it is served | Why |
|---|---|---|
| Gallery images (PNG, JPG, WebP, etc.) | Public static route at `/uploads/` | Images are displayed publicly in project galleries |
| Documents (PDF, DOCX, etc.) | Authenticated streaming endpoint | Documents may contain sensitive information |

Any request to `/uploads/something.pdf` returns HTTP 403. Documents are only accessible via `GET /api/construction-projects/:id/documents/:docId/download` with a valid JWT. This was implemented as security hardening (T2).

---

## Reverse Proxy and Nginx

**What a reverse proxy is:** A server that sits in front of your application and forwards incoming requests to it. Users connect to the proxy, not directly to your application.

**What nginx is:** The most widely used open-source reverse proxy and web server. It handles HTTPS termination, compression, caching, and load balancing.

**Why PMO CORE will need it:** Currently, users access the system at `http://localhost:3001`. For production at `https://core.carsu.edu.ph`, nginx will:
- Receive HTTPS requests on port 443
- Decrypt the TLS/SSL connection
- Forward the request to the frontend container on port 3001
- Forward API requests to the backend container on port 3000
- Return the response to the user

**Why this is MIS's responsibility:** nginx must be configured with the university's SSL certificate, which is issued for the `core.carsu.edu.ph` domain. Only MIS can provision the server, register the domain, and obtain or install the certificate. The nginx configuration template is written and ready in `handover/MIS_CHECKLIST.md`.

---

## SSL/TLS and HTTPS

**What it is:** Transport Layer Security (TLS) is the protocol that encrypts communication between a browser and a server. HTTPS is HTTP over TLS.

**Why it matters:** Without HTTPS, all data transmitted between the user's browser and the server — including login credentials and JWT tokens — is transmitted in plain text. Anyone on the same network can intercept and read it.

**Current state:** PMO CORE runs on HTTP for local development and pre-deployment testing. This is acceptable on a local machine or a secured campus LAN. For public access, HTTPS is mandatory. MIS must set up nginx with a certificate before the system goes live publicly.

---

## Environment Variables

**What they are:** Configuration values that are passed to an application at runtime, stored outside the source code. They typically live in a `.env` file that is never committed to version control.

**Why they exist:** The same application code needs to run in different environments with different settings:
- In development: connect to a local database with a simple password
- In production: connect to a Docker database with a strong password

Hardcoding these values in source code would mean the same password ends up in your git repository — a serious security risk. Environment variables keep secrets out of the code.

**PMO CORE's environment variable structure:**

```
Root .env              ← Docker Compose reads this (POSTGRES_PASSWORD, ports)
pmo-backend/.env       ← Backend reads this (DATABASE_*, JWT, LDAP, OAuth)
pmo-frontend/.env      ← Frontend reads this (API URLs)
```

**The `.env.example` files** are templates committed to the repository. They show what variables are needed but contain placeholder values (`CHANGE_BEFORE_DEPLOY`). On a new server, you copy the example file, fill in the real values, and never commit the real `.env`.

---

## Monitoring and Logging

**What monitoring is:** Continuously watching the health and performance of a running system, alerting when something goes wrong.

**What logging is:** Recording what the application does as it runs. Good logs let you reconstruct exactly what happened when something fails.

**Current state in PMO CORE:** The backend uses NestJS's built-in Logger and a custom `LoggingInterceptor` that records every HTTP request with method, path, status code, and duration. Logs are viewable via `docker compose logs -f backend`.

**What is not yet implemented:** A dedicated monitoring system (like Prometheus, Grafana, or Datadog) that sends alerts when the system is down or degrading. This is a P2 item for after deployment. For an initial university deployment, checking `docker compose ps` and the backend health endpoint is sufficient monitoring.

---

## Backup

**What it is:** A copy of your data at a specific point in time, stored separately from the primary system.

**Why it is critical:** Without backups:
- Accidental deletion of the database cannot be undone
- Hardware failure destroys all data permanently
- There is no way to recover from a botched deployment

**PMO CORE's backup approach:** The `backup.sh` script runs while the stack is live. It captures two things atomically:

1. `db.dump` — the complete PostgreSQL database using `pg_dump` (PostgreSQL's official backup tool, produces compressed binary format)
2. `uploads.tar.gz` — all uploaded files from the backend container

Both are timestamped and stored in `backups/YYYYMMDD_HHMMSS/`. The cron job runs this at 2:00 AM daily automatically.

**The safety principle:** The backup script never uses `docker compose down -v`. All backup operations happen against the running, live system. There is no downtime.

---

## Disaster Recovery (DR)

**What it is:** The process of restoring a system after a catastrophic failure. Not just "can we recover?" but "how long does it take?" and "how much data do we lose?"

**Two key metrics:**

| Metric | Definition | PMO CORE's answer |
|---|---|---|
| RPO (Recovery Point Objective) | Maximum acceptable data loss (how old can the backup be?) | ~24 hours (daily backup at 2 AM) |
| RTO (Recovery Time Objective) | Maximum acceptable downtime (how long to restore?) | ~15-30 minutes (restore.sh runtime) |

**PMO CORE's restore procedure:** `bash restore.sh 20260701_133553` restores the full database and uploads from that backup. It requires confirmation, stops the backend first (to prevent writes during restore), drops and recreates the database, restores uploads, and restarts the backend.

---

# 5. PMO CORE Architecture

## The Complete Data Flow

```
University User
  │  opens browser, navigates to http://core.carsu.edu.ph (or localhost:3001)
  ↓
Browser (Chrome, Edge, Firefox)
  │  loads the SPA (Single Page Application)
  │  all subsequent interactions happen via JavaScript
  ↓
Frontend Container — Nuxt 3 / Nitro (port 3001)
  │  serves the compiled Vue 3 application
  │  stores JWT in localStorage
  │  sends API requests to the backend
  ↓
Backend Container — NestJS (port 3000)
  │  validates the JWT on every protected request
  │  applies role-based authorization checks
  │  executes business logic
  │  queries the database
  │  reads/writes files to the uploads volume
  ↓
PostgreSQL Container — postgres:18-alpine (port 5432, internal only)
  │  stores all structured data
  │  persists to the pgdata volume
  ↓
Docker Volumes (on the Linux host filesystem)
  │  pgdata → database files
  │  backend_uploads → uploaded files
  ↓
WSL2 / Linux Host (Windows 11 machine or MIS server)
  │  runs Docker daemon
  │  runs all containers
  ↓
MIS Network Infrastructure
  │  firewall, DNS, nginx reverse proxy (future)
  │  SSL certificate termination (future)
  ↓
University Campus Network
     connects all users to the system
```

## The Three Containers and How They Talk

```
┌─────────────────────────────────────────────────┐
│              Docker Internal Network             │
│                                                 │
│  ┌─────────────┐    HTTP API    ┌─────────────┐ │
│  │  Frontend   │ ─────────────▶ │   Backend   │ │
│  │  :3000 int  │ ◀───────────── │   :3000     │ │
│  └─────────────┘   JSON resp.   └──────┬──────┘ │
│                                        │        │
│                                  SQL queries     │
│                                        │        │
│                                 ┌──────▼──────┐ │
│                                 │ PostgreSQL  │ │
│                                 │   :5432     │ │
│                                 └─────────────┘ │
└─────────────────────────────────────────────────┘
        │                    │
        ▼                    ▼
  Published port         No published port
  3001 → users         (internal only — security)
  3000 → API calls
```

## The Authentication Flow in Detail

```
1. User submits login form
      ↓
2. Browser sends POST /api/auth/login
      ↓
3. Backend verifies password hash (bcrypt, 10 rounds)
      or
   Backend queries LDAP server
      or
   Backend validates Google OAuth token
      ↓
4. Backend creates JWT:
   {
     sub: "user-uuid",
     email: "user@carsu.edu.ph",
     roles: ["Admin"],
     is_superadmin: true,
     campus: "MAIN"
   }
      ↓
5. JWT signed with AUTH_JWT_SECRET and returned
      ↓
6. Browser stores JWT in localStorage
      ↓
7. Every API request includes: Authorization: Bearer eyJ...
      ↓
8. Backend validates signature, extracts user identity
      ↓
9. Authorization guards check roles and module permissions
      ↓
10. Request is allowed or rejected with 401/403
```

---

# 6. The Deployment Journey

## Stage 1 — Development (Complete)

You wrote the code on your laptop. The database ran locally on `localhost:5432`. The backend on `localhost:3000`. The frontend on `localhost:3001`. All environment variables pointed to local resources.

The defining characteristic of this stage: **only you could run it**, because it depended on the exact configuration of your machine.

## Stage 2 — Containerization (Complete)

You wrapped the entire application in Docker. Now anyone with Docker installed could run `docker compose up -d` and get a working system — regardless of what operating system or configuration their machine has.

This was the first major step toward reproducibility. The code left your machine and could run somewhere else.

## Stage 3 — Pre-Deployment Hardening (Mostly Complete)

This is where most of the recent work happened. The question at this stage is: *is this system safe and reliable enough for real people to depend on?*

The hardening work completed:
- **CORS restriction** — only the known frontend URL can make cross-origin requests
- **Swagger disabled in production** — API documentation is not exposed publicly
- **Database port not published** — PostgreSQL is only reachable internally
- **Upload protection** — documents require authentication; images are public
- **Strong secrets required** — Docker Compose fails to start if `POSTGRES_PASSWORD` is not set
- **File size limits unified** — all upload endpoints agree on 10 MB maximum
- **Backup and restore** — daily automated backup with verified restore procedure
- **LDAP proven** — institutional authentication tested against a simulated directory

## Stage 4 — The First Deployment (Upcoming)

This is when the system runs on the actual MIS server for the first time. The clean-room dry run (deploying on a second device using only the documentation) is the rehearsal for this moment.

Key steps:
1. MIS provisions a server (Linux, Docker installed)
2. Repository is cloned to the server
3. `.env` files are created with real secrets
4. `docker compose up -d` starts the stack
5. Existing data is restored from the handover backup
6. MIS sets up nginx + SSL for HTTPS access
7. LDAP is pointed to the real Active Directory

## Stage 5 — Production (After Handover)

The system is live. Real users submit quarterly reports, update project statuses, and upload construction photos. The successor monitors the system, applies updates, and responds to issues using the operations runbook.

The defining characteristic of this stage: **mistakes have real consequences**. This is why every preceding stage exists — to eliminate as many potential mistakes as possible before reaching this point.

---

# 7. Common Beginner Questions

## Why Linux and not Windows Server?

Windows Server licenses cost money. Linux is free. The ecosystem of web server tools — Docker, nginx, bash — was built for and runs best on Linux. The global web infrastructure runs overwhelmingly on Linux. Supporting your system on Linux means more help, more documentation, and more experienced people available when something goes wrong.

## Why Docker and not just installing everything directly?

Installing NestJS, PostgreSQL, and Nuxt directly on a server creates a "snowflake server" — a unique configuration that is difficult to reproduce. When the server hardware fails (and it will eventually), you need to recreate the exact environment from memory. Docker replaces that fragile snowflake with a precise, version-controlled recipe that can be executed on any machine in minutes.

## Why WSL2?

Because you develop on Windows but deploy to Linux. WSL2 bridges that gap, letting you use Linux tools on Windows without managing a separate virtual machine. Your deployment scripts run identically on your Windows laptop (via WSL2) and on the MIS Linux server.

## Why PostgreSQL and not MySQL or another database?

PostgreSQL has stricter data integrity enforcement, better support for complex queries (which PMO CORE uses extensively for analytics), superior JSON handling, and excellent tooling. It is the dominant choice for serious institutional applications.

## Why containers and not just running the app directly?

Running applications directly on a server creates dependency conflicts. If the server already runs another Node.js application at a different version, they may interfere. Containers isolate each application completely — each container has its own Node.js version, its own libraries, its own environment. They coexist without conflict.

## Why volumes instead of just writing files inside the container?

Containers are designed to be disposable. When you rebuild the backend after a code change, the old container is deleted. Any data that was inside the container is gone. Volumes live outside the container — they are attached to it, not part of it. Data persists through any number of container replacements.

## Why Docker Compose instead of managing containers individually?

PMO CORE has three containers that depend on each other in a specific order. Docker Compose manages this dependency graph, starts services in the right order, applies environment variables, connects containers to the same network, and attaches volumes — all from one `docker-compose.yml` file and one command.

## Why LDAP and not just local accounts?

If you manage local accounts only, a new employee must request a separate PMO CORE account. When they leave the university, someone must remember to deactivate their PMO CORE account. With LDAP, account lifecycle is managed centrally by MIS — when an employee leaves, their AD account is disabled, and they can no longer log into any system, including PMO CORE, automatically.

## Why Google OAuth?

CSU already has Google Workspace for institutional email. Faculty and staff already trust their Google credentials. OAuth lets them use those trusted credentials without creating and remembering another password. It also means if someone's CSU Google account is deactivated, they immediately lose access to PMO CORE.

## Why JWT and not traditional sessions?

Traditional server sessions require the server to store session data for every logged-in user. This creates state on the server — it needs to remember who is logged in. JWT is stateless: all user information is encoded in the token itself. The server does not need to remember anything. This works well for APIs and scales easily.

## Why are authentication and authorization different?

They answer different questions. Authentication asks "are you who you say you are?" (identity verification). Authorization asks "are you allowed to do this?" (permission enforcement). They are always both required, but they are separate systems. A person might authenticate successfully (valid credentials) but be unauthorized to access certain data (wrong role or permissions). Keeping them separate makes each one simpler and more auditable.

## Why do backups matter for a university system?

Consider: a staff member accidentally deletes all Q4 financial records for all campuses the day before the quarterly report is due. Without backups, those records are gone permanently. With a daily backup, the worst case is losing one day of data. The 30 minutes it takes to restore from backup is inconvenient. Permanent data loss is catastrophic. Backups are not optional in production.

## Why is production different from development?

In development, you control everything. You can restart the database at will. You know exactly what data is in it. You can roll back code changes in seconds.

In production, real users have entered real data they depend on. Other people are using the system while you are trying to fix problems. There is no "quick restart" — a restart means every active user gets logged out. Changes must be tested before deployment. Every action has real consequences for real people.

---

# 8. PMO CORE Deployment Roadmap

## What Has Been Completed

| Track | Item | Commit |
|---|---|---|
| T1 | Schema dump + data migration foundation | `8800f25` |
| T2 | Upload restriction (images public, docs authenticated) | `3c46622` |
| T3 | Backup and restore scripts | `7d41ca0` |
| T3 | URL qualification for Docker API calls | `5d1356a`, `0748dd8` |
| T3 | UO service placeholder fix | `4833b90` |
| T3 | Dockerfile public/templates fix | `d69765c` |
| SEC | CORS, Swagger gate, DB port, env templates | `9c826f3` |
| SEC | WSL2 port binding fix | `52a7e1d` |
| T8 | Handover documentation suite (4 docs) | `fdb024a` |
| T5a | LDAP test directory (bitnami → osixia) | `fcf0085` |
| T6 | Upload size limit unified (25MB → 10MB) | `651a17c` |

## What Remains

### Operator Tasks (Things Only You Can Do Before Handover)

| Task | How | When |
|---|---|---|
| Schedule backup cron | `crontab -e` — one line | Today |
| Run restore test | `bash restore.sh <timestamp>` in WSL | This week |
| Clean-room dry run | Deploy on a second device using only `handover/DEPLOYMENT.md` | This week |
| Transfer secrets | In person: pmoadmin password, `.env` files, backup set | Before the 3rd week of July 2026 (target handover window) |
| GitHub access | Add successor as collaborator | Before the 3rd week of July 2026 (target handover window) |

### MIS Tasks (After Handover)

| Task | What MIS Does | Why You Cannot Do It |
|---|---|---|
| Server provisioning | Provides a Linux server with Docker installed | Hardware and licensing are MIS's domain |
| Firewall configuration | Blocks port 5432 externally, opens 80/443 | Network infrastructure is MIS-controlled |
| nginx + TLS | Installs nginx, obtains SSL cert, configures domain | Requires domain ownership and certificate authority |
| LDAP values | Provides AD server URL, bind DN, service account password | Only MIS knows their Active Directory configuration |
| Backup storage | Configures NAS or external storage for backup copies | Institutional storage is MIS-managed |

### Deployment Blockers (Cannot Go Live Without These)

| Blocker | Owner | Status |
|---|---|---|
| Clean-room dry run | Operator | Not done |
| MIS server provisioned | MIS | Pending coordination |
| TLS configured | MIS | Pending |
| LDAP swap to real AD | MIS + Successor | Pending |

### Safely Deferrable (Post-Launch)

| Item | Why It Can Wait |
|---|---|
| Antivirus scanning on uploads | Low risk for internal institutional files |
| Full system manual (300 pages) | User guide exists; full manual is supplementary |
| External NAS storage | Local volume backup is sufficient for initial launch |
| Monitoring dashboard | Manual health checks adequate for initial period |

---

# 9. Practical Analogies

## Docker Is a Shipping Container

Before standardized shipping containers, each type of cargo required custom loading, specialized ships, and different port equipment. A piano moved differently from grain, which moved differently from cars. Moving anything across the world was expensive and unpredictable.

The standardized shipping container changed everything. A container can hold any cargo. Any container fits on any container ship. Any port can handle any container. The cargo inside does not matter.

Docker works the same way. Before Docker, deploying a web application required manually installing the right version of Node.js, the right database driver, the right system libraries — all on the specific operating system of the target server. If the server had a different Linux version, packages might be incompatible. Hours of troubleshooting followed.

Docker containers are the standardized shipping containers of software. Your application, its dependencies, its configuration — all packaged together. Any server running Docker can run your container. The server's specific Linux version does not matter. Deployment becomes predictable.

## Volumes Are the Cargo That Survives the Journey

Continuing the shipping analogy: if the ship (container) sinks, the cargo (data) is lost — unless you stored the cargo in a warehouse (volume) and only loaded copies onto the ship.

Volumes are the warehouse. Your database data and uploaded files live in the warehouse, not on the ship. The ship can be rebuilt, upgraded, or replaced entirely. The cargo is always safe in the warehouse.

## Environment Variables Are Like a Restaurant's Secret Recipe Vault

A restaurant chain has dozens of locations. Every location uses the same recipe books (source code). But each location's chef is only given the secret ingredient ratios that apply to their kitchen — the head chef's secret is not written in the public recipe book.

Environment variables work the same way. The recipe book (source code) is publicly available in the git repository. The secret ingredient ratios (database password, JWT secret, API keys) live only in the `.env` file on the specific server — never in the recipe book.

## Authentication Is the Security Guard at the University Gate

Every CSU campus has a security guard at the entrance. When you arrive, the guard checks your ID. This is authentication — verifying who you are.

Once inside, different areas have different access requirements. The faculty lounge requires a faculty ID card. The server room requires an MIS badge. The dean's office requires an appointment. This is authorization — verifying what you are permitted to do.

The security guard (authentication) does not manage which rooms you can enter. The room access controls (authorization) do not verify your identity. They work together but are separate systems.

## Backups Are the University's Document Archive

The university's registrar's office maintains physical and digital backups of all student records. If the main computer system fails, the archived records allow reconstruction. If a typhoon damages the building, off-site copies at another campus ensure nothing is permanently lost.

PMO CORE's backup system works the same way. Daily backups are the archive. The restore script is the retrieval process. Storing backups on an external NAS is the off-site copy. The goal is identical: ensure that no single failure can permanently destroy institutional records.

## The Deployment Journey Is Like Building and Opening a Restaurant

Development = you build the restaurant, design the menu, hire staff, and run test operations with family and friends.

Pre-deployment = you get health inspections, fire safety certification, business permits, train the staff, finalize the menu, set up the POS system, and do a soft opening.

Deployment = the doors open to the public for the first time.

Production = daily operations. Food must be prepared consistently. If the refrigerator breaks, you need a procedure. If a staff member calls in sick, operations must continue. Problems must be solved without closing the restaurant.

The pre-deployment phase for PMO CORE — security hardening, documentation, backup scripts — is the equivalent of getting the health inspection and training the staff before the doors open.

---

# 10. Learning Roadmap

## Concepts You Have Already Demonstrated

Reading through the work done on PMO CORE, you have shown solid practical understanding of:

- ✅ Full-stack web application development (NestJS + Nuxt 3)
- ✅ Relational database design and SQL
- ✅ REST API design and implementation
- ✅ JWT authentication and RBAC
- ✅ Docker and Docker Compose fundamentals
- ✅ Environment variable management and security
- ✅ Git version control and conventional commits
- ✅ WSL2 and Linux terminal basics
- ✅ LDAP protocol concepts and configuration
- ✅ Backup and recovery concepts

## Concepts Worth Deeper Study Before Handover

These concepts were encountered during pre-deployment but deserve more thorough understanding:

**Linux system administration (1-2 weeks):**
- File permissions (`chmod`, `chown`)
- Process management (`ps`, `kill`, `systemctl`)
- Cron job management
- System logs (`journalctl`, `/var/log/`)
- Disk usage and monitoring (`df`, `du`)

**Networking fundamentals (1 week):**
- TCP/IP basics (ports, protocols, sockets)
- DNS resolution
- Firewall rules (`ufw`, `iptables` basics)
- How HTTPS and TLS work at the certificate level
- How reverse proxies work in practice

**PostgreSQL administration (3-5 days):**
- `pg_dump` and `pg_restore` options
- Connection limits and performance tuning
- Backup verification (restoring to a test database)
- User and permission management

**Docker in production (1 week):**
- Docker networking in depth
- Container resource limits (CPU, memory)
- Log management and rotation
- Image security scanning
- Multi-stage build optimization

## Recommended Learning Order

1. Finish this project's clean-room dry run — practical learning beats reading
2. Study Linux system administration basics (Ubuntu documentation, Linux Journey website)
3. Study nginx configuration (the official nginx beginner's guide)
4. Study PostgreSQL backup and recovery in depth
5. Build a small side project using Docker Compose with three services — cement the concepts

## Confidence Assessment

| Area | Readiness |
|---|---|
| Explaining the system to MIS | High |
| Performing the first deployment | Medium-High — dry run first |
| Responding to common production issues | Medium — runbook helps |
| Handling database corruption | Medium — restore procedure exists |
| Configuring TLS/nginx | Low — MIS handles, template exists |
| Modifying the system post-deployment | High — you know the codebase |

## Advice for Maintaining the System After Handover

For the successor who takes over this system:

**Day 1:** Read `handover/DEPLOYMENT.md` completely. Run the deployment on the provided server. Do not skip steps. Every step exists because something went wrong without it.

**Week 1:** Deploy successfully. Verify all modules work. Confirm backup cron is scheduled. Run a test restore.

**Month 1:** Monitor daily. Check `docker compose ps` each morning. Check backup logs weekly. Ask MIS for the LDAP and TLS configuration and complete those integrations.

**Ongoing:** Do not run `docker compose down -v`. Ever. That flag is documented in the runbook specifically because it looks harmless and is extremely destructive.

Before making any significant change to a running production system: take a backup first. Then make the change. If something breaks, you can restore.

---

*This handbook was compiled from ACE Phase 1 research and Phase 2 planning across the complete PMO CORE deployment preparation. The technology explanations reflect the actual implementation decisions made in the project, not generic descriptions. Every system described here is running and verified as of July 1, 2026.*

*Next update recommended: after the clean-room dry run, when new insights from attempting a fresh deployment will surface gaps worth documenting.*
