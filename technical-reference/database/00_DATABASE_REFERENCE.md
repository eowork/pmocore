# PMO CORE — Authoritative Database Reference
> **The single, authoritative reference for the PMO CORE PostgreSQL database.**
> Track T11 · ACE Framework Phase 3 · Generated 2026-07-06
> Suitable for: User & System Manual · Developer Docs · MIS Technical Documentation · Migration · Deployment · Knowledge Transfer.

## Provenance & authority
- **Source of truth:** `pmo-backend/schema/coredata_schema.sql` — a sanitized `pg_dump --schema-only` of the production/dev database (ADR-023, commit `8800f25`). This is the schema the Docker fresh-DB bootstrap loads and ships in the runtime image.
- **Why not entities/migrations alone:** MikroORM `createSchema()` omits ~50 migration-added, raw-SQL-accessed columns (hybrid data model, ADR-005). The dump is the merged, executed reality. See `research.md` RD-DB-1 / RD-1.
- **Validation:** every figure here is derived directly from the dump and cross-checked against `pmo-backend/src/**`. Table/type/FK/index/column counts were verified against the source (no loss, no invention).

## Document set (this folder)
| # | File | Contains |
|---|---|---|
| 00 | **`00_DATABASE_REFERENCE.md`** (this file) | Overview · Module Grouping (Output 5) · consolidated index of all outputs |
| 01 | `01_schema.sql` | **Output 1** — complete production-ready DDL (types, tables, PKs, UNIQUEs, indexes, FKs), module-grouped, verbatim from the dump |
| 02 | `02_inventory_and_legacy.md` | **Outputs 2 & 6** — full 84-table inventory + Active/Legacy classification with justification |
| 03 | `03_table_structures.md` | **Output 3** — per-column detail (type/nullable/default) for all 58 active tables |
| 04 | `04_relationships_and_dependencies.md` | **Outputs 4 & 8** — 185-FK relationship analysis + dependency hierarchy |
| 05 | `05_statistics_audit_readiness.md` | **Outputs 7, 9, 10** — statistics · audit/soft-delete review · production-readiness |

---

## 1. Database Overview

PMO CORE is a NestJS + PostgreSQL system for a Philippine state university PMO. The database backs six functional domains — **University Operations** (BAR No.1 physical / No.2 financial reporting), **Infrastructure/Construction projects (COI)**, **Repair projects**, **Gender & Development (GAD)**, a **Contractor portal**, and cross-cutting **IAM/Audit** — plus an inert layer of early-prototype tables retained from earlier design iterations.

| At a glance | |
|---|---|
| Engine | PostgreSQL 14+ (dump from `postgres:18-alpine`) |
| Tables | **84** (58 active · 26 legacy) |
| Columns | 1,329 |
| ENUM types | 19 · **CHECK** constraints 27 |
| Foreign keys | 185 · **Indexes** 173 (22 partial-unique) · **UNIQUE** 34 |
| Views / Sequences / Generated cols | 0 / 0 / 0 (UUID PKs via `gen_random_uuid()`) |
| PK convention | `uuid` surrogate (`id`), except `fiscal_years.year` (integer) |
| Audit model | per-row `*_at`/`*_by` columns + `activity_logs` event table |
| Soft-delete | `deleted_at IS NULL` + 22 partial-unique indexes |
| Readiness verdict | **Production-ready at target scale; findings LOW–MEDIUM, post-turnover** |

---

## 2. Module Grouping (Output 5)

All 84 tables grouped by functional module. **Active (58):**

**Authentication / IAM / Access Control (12)**
`users` · `roles` · `permissions` · `user_roles`ᴶ · `role_permissions`ᴶ · `user_departments`ᴶ · `departments` · `user_module_assignments` · `user_permission_overrides` · `user_pillar_assignments` · `access_requests` · `password_reset_requests`

**University Operations — BAR No.1 / No.2 (8)**
`university_operations` · `operation_indicators` · `operation_financials` · `operation_organizational_info` · `pillar_indicator_taxonomy` · `quarterly_reports` · `quarterly_report_submissions` · `fiscal_years`

**Infrastructure / Construction — COI (14)**
`construction_projects` · `construction_subcategories` · `funding_sources` · `construction_milestones` · `construction_timeline_entries` · `construction_diary_entries` · `construction_progress_reports` · `construction_revision_orders` · `construction_mov_entries` · `construction_gallery` · `construction_document_types` · `construction_document_checklist` · `construction_document_folders` · `construction_document_submissions`

**Contractor Sub-system (4)**
`contractors` · `contractor_users` · `contractor_invite_tokens` · `project_contractor_assignments`ᴮ

**Repair Projects (7)**
`projects` · `facilities` · `repair_types` · `repair_projects` · `repair_project_phases` · `repair_project_team_members` · `repair_pow_items`

**Gender & Development — GAD (7)**
`gad_budget_plans` · `gad_gpb_accomplishments` · `gad_faculty_parity_data` · `gad_staff_parity_data` · `gad_student_parity_data` · `gad_pwd_parity_data` · `gad_indigenous_parity_data`

**Audit / Records / System (6)**
`activity_logs` · `record_assignments` · `documents` · `media` · `system_settings` · `mikro_orm_migrations`ˢ

**Legacy / Orphaned — archival candidates (26)**
*Pre-refactor COI prototype (9):* `construction_project_accomplishment_records`, `construction_project_actual_accomplishment_records`, `construction_project_assignments`, `construction_project_financial_reports`, `construction_project_milestones`, `construction_project_phases`, `construction_project_progress`, `construction_project_progress_summaries`, `construction_project_team_members`
*Pre-refactor repair prototype (5):* `repair_project_accomplishment_records`, `repair_project_actual_accomplishment_records`, `repair_project_financial_reports`, `repair_project_milestones`, `repair_project_progress_summaries`
*Early campus/asset prototype (12):* `buildings`, `rooms`, `room_assessments`, `university_statistics`, `notifications`, `policies`, `downloadable_forms`, `forms_inventory`, `user_page_permissions`, `gad_yearly_profiles`, `audit_trail`, `university_operations_personnel`

> ᴶ composite-PK junction · ᴮ surrogate-PK M:N bridge · ˢ ORM system table · full justification in `02_inventory_and_legacy.md`.

---

## 3. Consolidated findings

### Inventory & classification → `02`
84 tables classified; every Legacy label backed by a zero-reference grep. Only 2 active tables are non-entity (raw-SQL): `facilities`, `mikro_orm_migrations`; `projects` is entity-backed but written via raw SQL by the repair module.

### Schema (DDL) → `01`
19 enums, 84 `CREATE TABLE` (module-grouped), 84 PKs, 34 UNIQUE constraints, 173 indexes, 185 FKs — all verbatim from the authoritative dump.

### Table structures → `03`
Column-level type/nullable/default for all 58 active tables. Widest: `construction_projects` (95), `operation_indicators` (73), `repair_projects` (44), `construction_timeline_entries` (35).

### Relationships & dependencies → `04`
`users` is the universal root (126 inbound audit FKs). COI uses CASCADE from `construction_projects` to its children; most other FKs are RESTRICT. No circular dependencies (two nullable self-trees only). Migration/restore load order documented; `SET session_replication_role='replica'` sidesteps ordering.

### Statistics, audit, readiness → `05`
Production-ready at target scale. Non-blocking, post-turnover items: index ~18 structural FK columns on growth tables; add FK for `fiscal_year`; add audit columns to `construction_gallery`; archive the 26 legacy tables via `SET SCHEMA archive` (never `DROP`, per project rule).

---

## 4. How to use this reference
- **Successor / new developer:** read §1–§2 here, then `01_schema.sql` for the physical model. Use `03` as a column dictionary.
- **MIS / DBA:** `05` (readiness + audit) and `04` (relationships, restore order).
- **Deployment / migration:** `01_schema.sql` is loadable as-is; the live bootstrap path is `pmo-backend/migrate.js` → `schema/coredata_schema.sql` (do not regenerate from entities — see Provenance).
- **Do not** normalize the wide UO/COI tables or drop legacy tables during turnover — both are documented deliberate states.

*Generated under ACE v2.4 governance. Authority: `coredata_schema.sql` (ADR-023). This reference documents the schema as-is; it prescribes no change to the live implementation.*
