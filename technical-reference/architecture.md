# PMO Dashboard — Technical Architecture Reference
> Technical blueprint only. No tasks, no research, no history.

---

## System Overview

```
pmo-backend/          NestJS + PostgreSQL + MikroORM
pmo-frontend/         Nuxt 3 + Vue 3 + Vuetify 3 + Pinia + ApexCharts
database/migrations/  PostgreSQL migration files (raw SQL)
```

**Platform:** Windows 11 | **Shell:** Bash/PowerShell | **Node:** ≥18

---

## Frontend Architecture

### Routing
- Nuxt 3 file-based routing
- Auth middleware: `auth`, `permission` on protected pages
- Public pages: no middleware, `@Public()` decorator on backend

### Key Conventions
- `<script setup lang="ts">` — Composition API only
- `withDefaults(defineProps<Props>(), {...})` — typed props
- `defineEmits<{...}>()` — typed emits
- `useApi()` composable — all HTTP via `api.get/post/patch/del/upload/download`
- `api.del()` NOT `api.delete()` — team convention
- `useToast()` — success/error notifications
- `useAuthStore()` — current user/role

### State Management
- Pinia stores for auth, global state
- Component-local `ref/reactive/computed` for per-component state
- NO Vuex

### Type System
- `~/utils/adapters.ts` — **sole source of frontend type definitions**
- `BackendXxx` interfaces = raw API response shape
- `UIXxx` interfaces = adapted for frontend consumption
- `adaptXxx()` functions = transform Backend → UI

### Styling
- Vuetify 3 components only
- No raw CSS classes (use Vuetify utility classes)
- `elevation="2" rounded="lg"` — standard card style
- Color system: primary, info, success, warning, error, teal, blue-grey, secondary

---

## Backend Architecture

### Framework
- NestJS with TypeScript
- `ValidationPipe` global: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- `GlobalExceptionFilter` for unified error responses

### Data Access (Hybrid Pattern)
```
CRUD Operations    → MikroORM ORM (em.find, em.persist, em.flush)
Analytics/Complex  → Raw SQL (em.getConnection().execute())
Auth/Health        → Legacy DatabaseService (DO NOT introduce new usage)
```

**Array binding in raw SQL:** `WHERE id IN (${ids.map(()=>'?').join(',')})` with flat params.
NEVER `WHERE id = ANY(?)` — Knex positional binding flattens arrays causing syntax error.

### Entity Conventions
- `@Entity({ tableName: 'snake_case' })`
- `@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })`
- `@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })` on soft-deletable entities
- `deleted_at` timestamp = soft delete; never hard-delete users or projects

### Service Conventions
- `findOne()` before update/delete (throws NotFoundException if missing)
- `fireLog(user, ActivityAction.X, entityId, metadata)` after every CUD operation
- `fireLog` is fire-and-forget: `void this.activityLog.logAction(...).catch(() => {})`
- `ActivityLogService.logAction()` MUST use `em.fork()` — prevents tx race with caller queries

### Activity Logging
```typescript
enum ActivityAction {
  CREATE, UPDATE, DELETE, SUBMIT, PUBLISH, REJECT, WITHDRAW,
  UPLOAD, REMOVE_ATTACHMENT, DOWNLOAD, BATCH_UPLOAD,
  REMARKS_UPDATE, TEMPLATE_UPLOAD,
  // PHASE BBBG (Track 4) — identity, account & access audit completeness
  LOGIN, FIRST_LOGIN, PROFILE_COMPLETED,
  USER_CREATED, USER_UPDATED, RANK_CHANGED,
  MODULE_ACCESS_CHANGED, ACCESS_REVOKED,
  ACCOUNT_ENABLED, ACCOUNT_DISABLED,
  PASSWORD_RESET_REQUESTED
}
```
Logs stored in `activity_logs` table: `user_id, user_email, user_name, action, entity_type, entity_id, metadata, created_at`

---

## Database Architecture

### Core Tables
```
projects                    ← UO + legacy shared projects
construction_projects       ← COI projects (primary entity)
construction_milestones     ← Per-project milestones
construction_progress_reports ← WAR/MPR records
construction_gallery        ← Project images
construction_documents      ← All attachments (files + links)
construction_document_types ← Seeded taxonomy (READONLY)
construction_document_folders ← Folder hierarchy (CONTAINER/FORM/TEMPLATE/SUBMISSIONS)
construction_document_checklist ← CPES compliance tracking
record_assignments          ← User-to-project assignments
activity_logs               ← Audit trail
users                       ← System users
fiscal_years                ← UO fiscal year config
```

### Migration Conventions
- Raw SQL files: `database/migrations/NNN_description.sql`
- MikroORM TS migrations: `pmo-backend/src/database/mikro-migrations/MigrationYYYYMMDDHHmmss_Description.ts`
- Always `IF NOT EXISTS` / `IF EXISTS` — idempotent
- Never drop columns with data — use soft deprecation

### Soft Delete Pattern
All entities: `deleted_at TIMESTAMPTZ NULL` + `deleted_by UUID NULL`
Filter applied by default: `deleted_at IS NULL`

### Key JSONB Columns (construction_projects)
```
rdp_alignment           string[]  — RDP chapter keys
socioeconomic_agenda    string[]  — SEA item keys
csu_likha_goals         string[]  — LIKHA_x keys
sdg_goals               string[]  — SDG_n keys
beneficiary_list        string[]
additional_funding_sources {type, name, notes}[]
remarks_log             {text, author, created_at}[]
personnel_groups        {csu: [], contractor: [], others: []}
custom_key_sections     {id, label, typeCode}[]
custom_supporting_sections {id, label, typeCode}[]
status_updates          {date, text}[]
readiness_documents     {type, status, remarks}[]
signatories             {name, position, date}[]
incident_log            {date, severity, description, status}[]
risk_register           {risk, likelihood, impact, mitigation, status}[]
escalation_records      {escalatedTo, date, issue, resolution}[]
```

---

## Authorization Model

Authorization is a **4-layer hierarchy**. Each layer answers a distinct question; they are
evaluated in order and are NOT interchangeable. Conflating them is the root cause of the
historical "Approver/Manager 403 on their own module" bug (resolved PHASE BBBG, Track 1).

```
┌── Layer 1: System Role ──────────── WHO are you? (identity tier)
│     SuperAdmin · Admin · Staff · Viewer · Auditor · Contractor
│     → Coarse identity. SuperAdmin/Admin bypass module checks (isAdmin()).
│     → Stored on user + roles; enforced by @Roles(...) + RolesGuard.
│
├── Layer 2: Rank ─────────────────── HOW MUCH approval authority? (org hierarchy)
│     Numeric rank_level (lower = higher authority).
│     → Governs APPROVAL routing ONLY (who may approve/submit to whom).
│     → NEVER gates module CRUD. A high rank does not grant edit rights.
│
├── Layer 3: Module Level ─────────── WHAT can you do in THIS module? (CRUD tier)
│     Viewer → Contributor → Approver → Manager (per module_key).
│     → Single source of truth: user_permission_overrides
│         (can_access = true, granted_level).
│     → Enforced by ModuleAccessGuard (level-aware).
│       Viewer/none = read-only; Contributor = create/edit own scope;
│       Approver/Manager = full module CRUD (record scope bypassed).
│
└── Layer 4: Record Assignment ────── WHICH records? (row scope — Contributor only)
      record_assignments + created_by ownership.
      → Scopes a Contributor to assigned/created rows ONLY.
      → Approver / Manager / Admin BYPASS this layer entirely.
```

### Module Levels (Layer 3)
```
Viewer      → Read-only
Contributor → Create/edit records they own or are assigned (Layer 4 applies)
Approver    → Full module CRUD + approval authority; record scope bypassed
Manager     → Full module CRUD + module administration; record scope bypassed
```

### Critical Enforcement Rule (PHASE BBBG, Track 1)
Record-ownership validators (`validateOperationOwnership`, `validateFinancialAccess` in
`university-operations.service.ts`) MUST read `granted_level` from
`user_permission_overrides` **after** the admin bypass and **before** any
`created_by`/`record_assignments` check:
1. `isAdmin(user)` → return (bypass)
2. `granted_level` ∈ {Approver, Manager} → return (Layer 3 grants full CRUD)
3. `granted_level` ∈ {Viewer, null} → throw Forbidden
4. Contributor → fall through to Layer 4 (owner/assigned record check)

Skipping step 2 re-imposes Layer 4 on Approver/Manager and produces a false 403 even
though `ModuleAccessGuard` already admitted them.

### Enforcement Surfaces
- Server-side identity: `@Roles('Admin', 'Staff')` + `RolesGuard`
- Server-side module level: `ModuleAccessGuard` (reads `user_permission_overrides`)
- Frontend: `usePermissions()` composable + `canUpload`/`canDelete` props (presentation only — backend is authoritative)
- Public routes: `@Public()` decorator (no JWT guard)
- Contractor / Contributor row isolation: `record_assignments` table

### Access-Request Lifecycle (PHASE BBBG, Track 2)
`access_requests.status` is a plain varchar (no enum constraint — new states need no migration):
```
PENDING → APPROVED   (admin grants → writes user_permission_overrides)
PENDING → DENIED     (admin rejects)
PENDING → CANCELLED  (requester withdraws own pending request)
PENDING → EXPIRED    (admin manual action only — NO scheduled TTL job)
APPROVED → REVOKED   (admin revokes → removes the override)
DENIED/REVOKED/EXPIRED → PENDING  (admin reopen)
```

### LDAP / Directory Integration (PREPARED — DO NOT REMOVE)
The schema and auth layer retain LDAP/AD readiness for a future campus-directory bind.
These preparations are intentional and **must be preserved** across refactors:
- `users.username` is an immutable, directory-aligned identity key (set once at creation).
- Password auth is isolated in the local auth strategy so a directory bind can be added
  alongside it without disturbing JWT issuance or module authorization.
- The 4-layer model above is bind-source agnostic: Layers 2–4 operate on the local user
  record regardless of whether identity (Layer 1) is locally provisioned or directory-sourced.
No LDAP code is active yet; the above documents why related scaffolding is retained.

---

## Attachment Architecture

### CiAttachmentHub — Hub Component
Single attachment renderer for all COI project pages.

**Modes:** `staging` (new.vue) | `edit` (edit-[id].vue) | `view` (detail-[id].vue)

**Sections (tabs):**
```
checklist    → CiDocumentChecklist (CPES compliance tracker, eager mount)
key          → CiRepositoryCard grid (Project Profile, Feasibility, HGDG, etc.)
gallery      → Thumbnail strip + CiGalleryModal
supporting   → CiRepositoryCard grid (SD_ORDERS/SD_REPORTS/SD_CERTS/ECO_FORMS by seeded typeCode)
cpes         → CiRepositoryCard grid (CPES_DOCS seeded types)
other        → Single "Miscellaneous" CiRepositoryCard (__MISC__ sentinel)
audit        → CiAuditLogPanel
```

**Critical constraints:**
- Shared `CiRepositoryModal` instance: `uploadType` resets to `typeCodes[0]` on every open
- External links: `onRepoLink()` POSTs with `externalLink` (no mimeType in body)
- `__MISC__` sentinel typeCode → `activeRepoDocs` returns `otherDocs` (non-managed docs)
- `checklistRef` is never null because checklist window-item uses `eager`

### Repository Modal — Shared Instance
`CiRepositoryModal.vue` receives `:documents="activeRepoDocs"` filtered by typeCode.

**Sections:** Files list | External Links list (separate sections, DDD/ZZZ)
**Actions:** Download (authenticated blob), Copy URL (clipboard), Delete (with permission)

### Document Entity
```
documents table:
  id, documentable_type='CONSTRUCTION_PROJECT', documentable_id,
  document_type (typeCode), file_name, file_path, file_size, mime_type,
  description, version (auto-increment per folder), uploaded_by,
  folder_id (nullable), lifecycle_status='ACTIVE', deleted_at
```
Links stored with `mime_type='application/x-external-link'` or `'application/x-google-drive-link'`

### Document Folder Hierarchy
```
CONTAINER  ← Top-level group (SD_ORDERS, SD_REPORTS, etc.)
  FORM       ← Named form/template
    TEMPLATE   ← Downloadable official template
    SUBMISSIONS ← Upload target; version auto-increments
```

---

## Gallery Architecture

```
construction_gallery:
  id, project_id, image_url, caption, category, is_featured,
  image_taken_date, uploaded_at, created_by
```

**Categories:** `PROFILE` (carousel), `IN_PROGRESS`, `COMPLETED`, `INSPECTION`, etc.

**Carousel rule:** `profileImages.first || gallery.all` — PROFILE category shown first.

**Static serving:** `pmo-backend/public/templates/` served at `/templates/` via `useStaticAssets`.

---

## Naming Conventions

### Backend
- Controllers: `construction-projects.controller.ts`
- Services: `construction-projects.service.ts`
- Entities: `ConstructionProject` entity class, `construction_projects` table
- DTOs: `snake_case` fields (match database column names)
- Route params: `:id` (UUID)

### Frontend
- Components: `CiXxx.vue` (COI prefix)
- Composables: `useXxx.ts`
- Pages: `detail-[id].vue`, `new.vue`, `edit-[id].vue`
- Utils: `adapters.ts`, `coiHierarchies.ts`, `coiFormState.ts`

### CSS / Styling
- Vuetify utility classes preferred
- Scoped `<style scoped>` for component-specific overrides
- `.overview-grid { align-items: flex-start }` — prevents sibling panel stretching

---

## Key URLs

| Route | Purpose |
|---|---|
| `GET /api/construction-projects` | List COI projects |
| `GET /api/construction-projects/:id` | Project detail (includes milestones, progress_reports) |
| `POST /api/construction-projects/:id/documents` | Upload file OR register external link |
| `GET /api/construction-projects/:id/documents` | List all documents (`IN(?,…)` not `ANY(?)`) |
| `GET /api/construction-projects/:id/document-folders` | Folder tree `{data: FolderNode[]}` |
| `GET /api/public/construction-projects` | Public listing (no auth) |
| `GET /templates/SD_ECO_001.docx` | Served by useStaticAssets — requires backend restart |
| `GET /uploads/<image>` | Static, images-only (png/jpg/gif/webp/etc.) — documents → 403; guarded API for docs (T2 ✅) |
| `GET /health` | Liveness (global `api` prefix excluded) — used by Docker healthcheck |

---

## Deployment Architecture (Docker / WSL2 / Ubuntu)

```
docker-compose.yml
  postgres  → image postgres:16-alpine,  volume pgdata
  backend   → build pmo-backend,  volume backend_uploads:/app/uploads,  env_file .env
  frontend  → build pmo-frontend,  NUXT_PUBLIC_API_BASE → backend
```

### Bootstrap flow (`docker-entrypoint.sh` → `migrate.js`)
```
Fresh DB (projects table absent):
  load schema  →  fake-mark all migrations applied  →  seed.js (roles, SuperAdmin, reference, taxonomy)
Existing DB:
  migrator.up()  (run pending migrations only)
```
- **Schema source (ADR-023):** authoritative dev `pg_dump --schema-only` (NOT entity `createSchema`, which omits ~50 migration/raw-SQL columns). See `research.md` RD-1.
- **Seed (`seed.js`, ADR-024):** runs only on fresh DB; idempotent; SuperAdmin creds from `SEED_SUPERADMIN_*` (default `admin` / `ChangeMe!2026`).
- **Metadata provider:** `ReflectMetadataProvider` in production (compiled JS), `TsMorphMetadataProvider` in dev; `mikro-orm.useTsNode:false` in the image.

### Volumes & operational rules
- `pgdata`, `backend_uploads` survive restart/`down`/rebuild; **`down -v` destroys them — banned in production**.
- `.env` `SEED_*` changes apply only on a **fresh** DB (seed skips existing DBs).
- Lockout: 5 failed logins → 15-min lock (`auth.service.ts:78`); reset by clearing `account_locked_until`.

### Build
- Multi-stage `Dockerfile`: `npm install` (not `ci`), `nest build` (needs `tsconfig.build.json` → correct `dist/` layout), copies `migrate.js` + `seed.js` into the runtime image.
- Entity glob `./dist/**/*.entity.js` (must span the whole tree — entities live in `database/entities/`, `activity-logs/`, `contractor-auth/entities/`).

### LDAP / TLS / domain (pending MIS — see plan.md T4/T5a)
LDAP env-gated (`LDAP_URL`); prove vs self-hosted test directory, swap to MIS via `.env`. TLS/domain via an MIS-provided reverse proxy (nginx) — templated, applied at cutover.
