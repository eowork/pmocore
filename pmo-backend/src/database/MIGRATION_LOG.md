# Database Migration Log — PMO Dashboard

> Authoritative chronological log of all MikroORM migrations applied to the
> PMO Dashboard schema. Each entry is **concise** (≤ 20 lines), **comprehensive**
> (covers what / why / data migration / risk / verification), and **self-contained**
> (no need to read the migration file to understand the change).
>
> **Scope:** This file is the single source of truth for migration intent.
> Migration `.ts` files contain the SQL; this file contains the rationale.
>
> **Ordering:** Chronological (oldest → newest).
> **Convention:** Append a new entry every time a migration is created. Never
> rewrite history — corrections go in a follow-up migration with its own entry.

---

## Migration20260430000000 — Baseline

**Phase:** Initial setup
**File:** `Migration20260430000000_Baseline.ts`
**Applied:** 2026-04-30
**Schema changes:** Establishes the baseline schema snapshot for MikroORM tracking. No new tables or columns introduced — pre-existing schema captured for incremental migration management.
**Why:** Activate MikroORM migration tracking against a known good schema state. All subsequent migrations build on this snapshot.
**Data migration:** None.
**Risk:** None.
**Verification:** `mikro_orm_migrations` table exists; baseline row recorded.

---

## Migration20260502071146 — Partial Unique Index on `project_code`

**Phase:** JN-A
**File:** `Migration20260502071146_PartialUniqueProjectCode.ts`
**Applied:** 2026-05-02
**Schema changes:**

- `projects`: DROP `projects_project_code_key`; CREATE partial unique index `projects_project_code_active_idx ON (project_code) WHERE deleted_at IS NULL`
- `construction_projects`: same pattern with `construction_projects_project_code_active_idx`
  **Why:** Plain UNIQUE constraint blocked re-use of project codes after soft-delete. Partial index enforces uniqueness only among active rows.
  **Data migration:** None.
  **Risk:** LOW — soft-deleted rows now unconstrained; intended behavior.
  **Verification:** Soft-delete a project, then create a new project with the same code → succeeds.

---

## Migration20260507120000 — Narrative Fields + Beneficiaries Type Conversion

**Phase:** JW-B
**File:** `Migration20260507120000_AddNarrativeFields.ts`
**Applied:** 2026-05-07
**Schema changes:**

- `construction_projects`: ADD COLUMN `summary TEXT`, `scope TEXT`, `facilities TEXT` (all nullable)
- `construction_projects`: ALTER COLUMN `beneficiaries` TYPE `INTEGER` USING regex-safe cast (`^[0-9]+$` → integer; else NULL)
  **Why:** Client prototype Overview section renders summary/scope/facilities prominently and treats beneficiaries as a numeric count. Admin had no capture surface.
  **Data migration:** Existing `beneficiaries` text values matching `^[0-9]+$` preserved as integers; non-numeric strings (e.g., "Students, Faculty") coerced to NULL — no row dropped, no error raised.
  **Risk:** MEDIUM — irreversible loss of free-text beneficiaries narrative for non-numeric rows. Mitigated by preserving values via `down()` only as best-effort VARCHAR cast.
  **Verification:** JW-V3 through JW-V9.

---

## Migration20260507130000 — Gallery Category Vocabulary Alignment

**Phase:** JW-C
**File:** `Migration20260507130000_AlignGalleryCategoryEnum.ts`
**Applied:** 2026-05-07
**Schema changes:**

- `construction_gallery.category`: default `'PROGRESS'` → `'IN_PROGRESS'`
  **Data migration (forward-only):**
- `PROGRESS` → `IN_PROGRESS`
- `AFTER` → `COMPLETED`
- `AERIAL`, `DETAIL`, `INSPECTION` → `DOCUMENTATION` (defensive — never written by app)
- `BEFORE` unchanged
  **Why:** Admin enum diverged from client prototype's filter vocabulary (`Before / In Progress / Completed / Documentation`); broke client gallery filter.
  **Risk:** LOW — column is VARCHAR (not native ENUM); CHECK constraints are application-side.
  **Verification:** JW-V10 through JW-V12.

---

## Migration20260507140000 — Document Lifecycle Status

**Phase:** JW-D
**File:** `Migration20260507140000_AddDocumentLifecycleStatus.ts`
**Applied:** 2026-05-07
**Schema changes:**

- `documents`: ADD COLUMN `lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'`
- `documents`: ADD CONSTRAINT `documents_lifecycle_status_check CHECK (lifecycle_status IN ('ACTIVE','ARCHIVED','DRAFT'))`
  **Why:** Client prototype document filter tabs (Active / Archived / Draft) had no DB foundation. Existing `status` column tracks pipeline state (`ready`/`processing`/`failed`) and must NOT be overloaded — both columns co-exist.
  **Data migration:** Existing rows default to `'ACTIVE'`.
  **Risk:** LOW — purely additive; default ensures all existing rows are valid against the CHECK constraint.
  **Architecture deviation:** Plan specified PostgreSQL ENUM type; actual implementation uses VARCHAR + CHECK to match the prevailing schema convention (`construction_gallery.category`) and avoid PG enum rigidity.
  **Verification:** JW-V13 through JW-V15.

---

## Migration20260507150000 — Team Assignment Metadata

**Phase:** JW-E
**File:** `Migration20260507150000_AddTeamAssignmentMetadata.ts`
**Applied:** 2026-05-07
**Schema changes:**

- `record_assignments`: ADD COLUMN `role VARCHAR(100)` NULLABLE
- `record_assignments`: ADD COLUMN `department VARCHAR(150)` NULLABLE
- `record_assignments`: ADD COLUMN `phone VARCHAR(30)` NULLABLE
  **Why:** Client prototype team section renders per-member role badge (emerald), department, and phone. The `record_assignments` join table only tracked `(module, recordId, userId)` with no per-assignment metadata, so admin had no surface to capture these fields.
  **Data migration:** None (new nullable columns).
  **Risk:** LOW — additive only; existing assignments unaffected.
  **Verification:** JW-V16 through JW-V20.

---

## Migration20260507160000 — Construction Timeline Diary Entries

**Phase:** JW-G
**File:** `Migration20260507160000_AddConstructionTimelineEntries.ts`
**Applied:** 2026-05-07
**Schema changes (new table):**

- CREATE TABLE `construction_timeline_entries` (UUID pk; project_id FK ON DELETE CASCADE; entry_type VARCHAR(20) DEFAULT 'WEEKLY' + CHECK; entry_date DATE NOT NULL; period_label VARCHAR(100); title VARCHAR(255) NOT NULL; description TEXT; weather VARCHAR(100); manpower_count INTEGER; equipment_used TEXT; work_accomplished TEXT; issues_encountered TEXT; photos_count INTEGER DEFAULT 0; created_by UUID FK users; created_at, updated_at TIMESTAMPTZ).
- INDEX `idx_timeline_entries_project_id` ON (project_id)
- INDEX `idx_timeline_entries_entry_date` ON (entry_date DESC)
  **Why:** Client prototype Timeline tab renders a periodic work-log diary (weather, manpower, equipment, work accomplished, issues). 7 client fields had no DB foundation. Distinct from `construction_milestones` — milestones track key dates; diary entries track ongoing periodic work.
  **Data migration:** None (greenfield table).
  **Risk:** LOW — new table with FK cascade; no existing data touched. The unused `timelineData JSONB` stub on `construction_projects` is intentionally retained (out-of-scope per JW-D7).
  **Architecture note:** `entry_type` uses VARCHAR + CHECK (not PG ENUM) for consistency with gallery/document conventions and easier future evolution.
  **Verification:** JW-V23 through JW-V28.

---

## Migration20260507170000 — Construction POW Items

**Phase:** JU-B
**File:** `Migration20260507170000_AddConstructionPowItems.ts`
**Applied:** 2026-05-07
**Schema changes (new table):**

- CREATE TABLE `construction_pow_items` (UUID pk; project_id FK ON DELETE CASCADE; description TEXT NOT NULL; progress DECIMAL(5,2) DEFAULT 0; quantity DECIMAL(10,3); unit VARCHAR(50); unit_cost / estimated_material_cost / estimated_labor_cost / estimated_project_cost / variance DECIMAL(15,2); start_date, end_date DATE; project_duration VARCHAR(100); status VARCHAR(50) DEFAULT 'NOT_STARTED' + CHECK; category VARCHAR(100); sort_order INTEGER DEFAULT 0; created_at, updated_at TIMESTAMPTZ).
- CHECK `status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','BLOCKED')`
- INDEX `idx_construction_pow_items_project` ON (project_id)
- INDEX `idx_construction_pow_items_status` ON (project_id, status)
  **Why:** Program of Works (POW) is the work-breakdown structure of each construction project — line items with quantity, unit cost, material/labor estimates, schedule, and per-item progress. Independent of milestones (key dates) and timeline diary (periodic logs). Required by client prototype POW tab.
  **Data migration:** None (greenfield table).
  **Risk:** LOW — new table; FK cascade ensures cleanup on project delete.
  **Verification:** JU-V4 through JU-V7.

---

## Migration20260513000000 — POW Audit Governance Fields

**Phase:** KB-B
**File:** `Migration20260513000000_AddPowRemarksDateEntry.ts`
**Applied:** 2026-05-13
**Schema changes:**

- `construction_pow_items`: ADD COLUMN `remarks TEXT` NULLABLE
- `construction_pow_items`: ADD COLUMN `date_of_entry DATE` NULLABLE
  **Why:** Section 2.141-A.1 audit identified two governance gaps in POW: no `remarks` for administrative justification (distinct from `description` work narrative) and no user-settable `date_of_entry` (distinct from `start_date` work start and auto-set `created_at`). Required for audit compliance.
  **Data migration:** None (additive nullable columns).
  **Risk:** LOW — purely additive; existing rows unaffected.
  **Verification:** KB-V3 through KB-V7.

---

## Migration20260513010000 — Document Governance System (CPES Compliance)

**Phase:** KB-E
**File:** `Migration20260513010000_AddDocumentGovernanceTables.ts`
**Applied:** 2026-05-13
**Schema changes (two new tables + 27 seed rows):**

- CREATE TABLE `construction_document_types` (group_code/group_label/type_code/type_label/is_required/sort_order/is_active + CHECK on group_code)
- CREATE TABLE `construction_document_checklist` (project_id FK→cascade, document_type_id FK, submission_status + CHECK, reviewer/submitter/timestamps/review_notes, current_version, expiry_date, linked_document_id FK→documents, UNIQUE(project_id,document_type_id))
- INDEX `idx_doc_checklist_project` ON (project_id)
- INDEX `idx_doc_checklist_status` ON (project_id, submission_status)
- INSERT 27 seed rows: Groups 1–6 covering all CPES/infrastructure document types
  **Why:** Section 2.141-C identified absence of compliance checklist architecture. Existing `documents` table was a flat upload store; no submission/approval workflow, no version tracking, no per-project compliance status. This phase adds CPES-grade compliance tracking decoupled from raw file upload.
  **Data migration:** Seeds 27 standard CPES document type rows. ON CONFLICT DO NOTHING — safe to re-run.
  **Risk:** MEDIUM — new tables and FK; existing `documents` table untouched. Lazy initialization in service ensures per-project checklist rows are created only on first access.
  **Verification:** KB-V12 through KB-V17.

---

## Migration20260513020000 — Financial Traceability Fields

**Phase:** KB-F
**File:** `Migration20260513020000_AddFinancialTraceabilityFields.ts`
**Applied:** 2026-05-13
**Schema changes:**

- `construction_project_financials`: ADD COLUMN `activity_title VARCHAR(255)` NULLABLE
- `construction_project_financials`: ADD COLUMN `transaction_category VARCHAR(100)` NULLABLE
- `construction_project_financials`: ADD COLUMN `remarks TEXT` NULLABLE
- `construction_project_financials`: ADD COLUMN `payment_reference VARCHAR(100)` NULLABLE
- `construction_project_financials`: ADD COLUMN `status VARCHAR(50) NOT NULL DEFAULT 'ALLOCATED'`
- ADD CONSTRAINT `construction_financial_status_check` (status IN ALLOCATED/OBLIGATED/DISBURSED/LIQUIDATED)
  **Why:** Section 2.141-B.1 audit confirmed the per-fiscal-year COA model is correct but lacked operational context. These 5 fields enable activity-linked tracking, transaction classification, payment reference (JEV/billing), audit annotation, and workflow status — supporting Philippine government infrastructure traceability requirements.
  **Data migration:** Existing rows default to `status='ALLOCATED'` (preserved baseline semantics — an existing entry represents allocated budget by default).
  **Risk:** LOW — additive columns + named CHECK constraint; default ensures all existing rows pass the constraint immediately.
  **Verification:** KB-V18 through KB-V19.

## Migration20260513030000 — Project Profile Fields

**Phase:** KC-C
**File:** `Migration20260513030000_AddProjectProfileFields.ts`
**Applied:** 2026-05-11
**Schema changes:**

- `construction_projects`: ADD COLUMN `strategic_alignment TEXT` NULLABLE
- `construction_projects`: ADD COLUMN `output_indicators JSONB` NULLABLE
- `construction_projects`: ADD COLUMN `outcome_indicators JSONB` NULLABLE
- `construction_projects`: ADD COLUMN `implementing_agency VARCHAR(255)` NULLABLE
- `construction_projects`: ADD COLUMN `project_status_category VARCHAR(50)` NULLABLE
- `construction_projects`: ADD COLUMN `status_updates JSONB` NULLABLE
- `construction_projects`: ADD COLUMN `readiness_documents JSONB` NULLABLE
- `construction_projects`: ADD COLUMN `signatories JSONB` NULLABLE
- ADD CONSTRAINT `construction_project_status_category_check` (status_category IN NEW/ONGOING/COMPLETED/SUSPENDED/CANCELLED) NOT VALID
  **Why:** Section 2.142-B.2 — Overview tab gap analysis required Project Profile governance fields to support strategic alignment narrative, output/outcome indicator tracking, implementing agency identification, lifecycle status categorization, status update audit trail, document readiness checklist, and signatory tracking. All nullable — no impact on existing rows or Create/Edit flow.
  **Risk:** LOW — additive columns; NOT VALID CHECK skips full-table scan; all fields optional in DTO.
  **Verification:** KC-V8 through KC-V13.

## Migration20260514000000 — Personnel Category

**Phase:** KD-D
**File:** `Migration20260514000000_AddPersonnelCategory.ts`
**Applied:** 2026-05-11
**Schema changes:**

- `record_assignments`: ADD COLUMN `personnel_category VARCHAR(50)` NULLABLE
  **Why:** Section 2.143 — Team tab governance restructure required grouping assigned personnel by their oversight category (IMPLEMENTING / MONITORING / UNIVERSITY_OFFICIAL / OVERSIGHT) to surface roles per CSU governance norms.
  **Risk:** LOW — additive, nullable; existing rows fall back to "Other Assigned Personnel" group.
  **Verification:** KD-V15 through KD-V18.

## Migration20260514010000 — Construction Diary Entries

**Phase:** KD-E
**File:** `Migration20260514010000_AddConstructionDiaryEntries.ts`
**Applied:** 2026-05-11
**Schema changes:**

- CREATE TABLE `construction_diary_entries` (id UUID PK, project_id UUID FK→construction_projects ON DELETE CASCADE, entry_date DATE NOT NULL, title VARCHAR(255), content TEXT NOT NULL, author_id UUID FK→users, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
- CREATE INDEX `idx_diary_entries_project_id` ON (project_id)
- CREATE INDEX `idx_diary_entries_entry_date` ON (project_id, entry_date DESC)
  **Why:** Section 2.143 — Project Diary surfaces day-by-day site narrative alongside milestones in Timeline tab. Hard-delete only per KD-G8 (no `deleted_at`); cascade with parent project ensures clean removal.
  **Risk:** LOW — new isolated table; cascade delete avoids orphan rows.
  **Verification:** KD-V19 through KD-V24.

## Migration20260514020000 — Profile Gallery Category

**Phase:** KF-AB
**File:** `Migration20260514020000_AddProfileGalleryCategory.ts`
**Applied:** 2026-05-14
**Schema changes:**

- `construction_gallery`: DROP + RE-ADD `construction_gallery_category_check` CHECK constraint to include `PROFILE` in the allowed values: `('BEFORE','IN_PROGRESS','COMPLETED','DOCUMENTATION','PROFILE')`
  **Why:** KF-AB image governance — PROFILE category allows up to 3 project facade / architectural images per project; these are displayed in the Overview tab as a preview strip. Service layer enforces the max-3 cap via `galleryRepo.count`.
  **Risk:** LOW — existing rows still satisfy the updated constraint because no `PROFILE` rows exist yet; additive only.
  **Verification:** `\d construction_gallery` confirms updated CHECK; upload a 4th PROFILE image returns 400.
