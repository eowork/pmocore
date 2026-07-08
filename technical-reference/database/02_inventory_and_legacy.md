# PMO CORE — Database Inventory & Active/Legacy Classification
> **Outputs 2 & 6** of Track T11 · ACE Phase 3 · 2026-07-06
> Source of truth: `pmo-backend/schema/coredata_schema.sql` (84 tables). Usage classification cross-checked against `pmo-backend/src/**` (entities, services, controllers, DTOs, raw SQL) and `mikro-migrations`.

## Summary
| Metric | Count |
|---|---|
| Total tables | **84** |
| Active (referenced by code / ORM / raw SQL) | **58** |
| Legacy (zero code references — archival candidates) | **26** |
| Entity-backed tables (`@Entity` with `tableName`) | 56 |
| Active but **not** entity-backed (raw-SQL access only) | 2 (`facilities`, `mikro_orm_migrations`) |
| Junction (composite-PK bridge) tables | 3 (`user_roles`, `role_permissions`, `user_departments`) |

**Classification method:** a table is **Active** if it is (a) mapped by a MikroORM entity that is registered and used, OR (b) referenced by name in a raw SQL string inside a service/controller. It is **Legacy** if a full-source grep (`src/**/*.ts`, excluding `mikro-migrations` and `*.spec.ts`) returns **zero** references. Every legacy classification below is backed by a zero-match grep.

---

## Output 2 — Database Inventory (grouped by module)

Legend — **U?** = Currently Used · **SD** = has `deleted_at` soft-delete · PK `id` unless noted.

### Authentication / IAM / Access Control (12 tables — all active)
| Table | Cols | PK | SD | U? | Purpose · Major relationships |
|---|---|---|---|---|---|
| `users` | 28 | id | Y | Yes | Central identity. Referenced by **126 FKs** (every audit `*_by` column). Parent to roles, departments, assignments. |
| `roles` | 8 | id | Y | Yes | RBAC roles (SuperAdmin/Admin/Staff/Auditor). M:N to users & permissions. |
| `permissions` | 10 | id | Y | Yes | Granular permission catalog. M:N to roles via `role_permissions`. |
| `user_roles` | 7 | (user_id, role_id) | — | Yes | **Junction** user↔role. |
| `role_permissions` | 4 | (role_id, permission_id) | — | Yes | **Junction** role↔permission. |
| `user_departments` | 5 | (user_id, department_id) | — | Yes | **Junction** user↔department. |
| `departments` | 16 | id | Y | Yes | Org units. Referenced by users, audit_trail. |
| `user_module_assignments` | 6 | id | — | Yes | Per-user module access grants. |
| `user_permission_overrides` | 9 | id | — | Yes | Per-user module override (granted_level, can_access). |
| `user_pillar_assignments` | 5 | id | — | Yes | Assigns users to UO pillars (GOVERNANCE/ADMIN/QASS/EXTERNAL). |
| `access_requests` | 11 | id | — | Yes | Self-service module access request workflow. |
| `password_reset_requests` | 7 | id | — | Yes | Password-reset token lifecycle. |

### University Operations — BAR No.1 / No.2 (8 tables — all active)
| Table | Cols | PK | SD | U? | Purpose · Major relationships |
|---|---|---|---|---|---|
| `university_operations` | 30 | id | Y | Yes | UO operation records; per-quarter status columns (status_q1–q4). |
| `operation_indicators` | **73** | id | Y | Yes | BAR1 physical accomplishment — per-quarter numerator/denominator/target/override/remarks. Widest UO table. |
| `operation_financials` | 29 | id | Y | Yes | BAR2 financial — appropriation, obligation, disbursement, utilization, expense_class. |
| `operation_organizational_info` | 13 | id | Y | Yes | Org context per operation. |
| `pillar_indicator_taxonomy` | 13 | id | — | Yes | **Authoritative BAR1 taxonomy** (migration 019 — READONLY). |
| `quarterly_reports` | 20 | id | Y | Yes | DRAFT→PENDING_REVIEW→PUBLISHED lifecycle per FY/quarter. |
| `quarterly_report_submissions` | 15 | id | — | Yes | Immutable submission event log (SUBMITTED/APPROVED/REJECTED/REVERTED/UNLOCKED). |
| `fiscal_years` | 5 | **year** | — | Yes | Configurable FY registry. PK is `year` (integer), not `id`. |

### Infrastructure / Construction Projects — COI (14 tables — all active)
| Table | Cols | PK | SD | U? | Purpose · Major relationships |
|---|---|---|---|---|---|
| `construction_projects` | **95** | id | Y | Yes | COI master record. **Widest table in the DB.** Parent to 20 FKs. |
| `construction_subcategories` | 10 | id | Y | Yes | Project categorization. |
| `funding_sources` | 11 | id | Y | Yes | Funding source catalog (metadata JSON). |
| `construction_milestones` | 16 | id | — | Yes | Project milestones (enhanced, migration 046). |
| `construction_timeline_entries` | 35 | id | — | Yes | WAR/MPR timeline w/ financial + concerns fields. |
| `construction_diary_entries` | 8 | id | — | Yes | Site diary. |
| `construction_progress_reports` | 25 | id | — | Yes | Progress reports w/ remarks list. |
| `construction_revision_orders` | 17 | id | — | Yes | Revision/variation orders. |
| `construction_mov_entries` | 18 | id | — | Yes | Means-of-verification entries (migration 048). |
| `construction_gallery` | 8 | id | — | Yes | Project images (category BEFORE/IN_PROGRESS/COMPLETED/…). |
| `construction_document_types` | 10 | id | — | Yes | Document taxonomy (11 group_codes; template_url). |
| `construction_document_checklist` | 15 | id | — | Yes | Per-project doc checklist (submission_status). |
| `construction_document_folders` | 13 | id | Y | Yes | Folder tree for documents. |
| `construction_document_submissions` | 9 | id | — | Yes | Uploaded submissions against checklist items. |

### Contractor Sub-system (4 tables — all active)
| Table | Cols | PK | SD | U? | Purpose |
|---|---|---|---|---|---|
| `contractors` | 17 | id | Y | Yes | Contractor registry (status ACTIVE/SUSPENDED/BLACKLISTED). |
| `contractor_users` | 14 | id | — | Yes | Contractor portal accounts. |
| `contractor_invite_tokens` | 10 | id | — | Yes | Invite/onboarding tokens. |
| `project_contractor_assignments` | 9 | id | — | Yes | **Junction-like** project↔contractor (surrogate PK). |

### Repair Projects (7 tables — all active)
| Table | Cols | PK | SD | U? | Purpose · Notes |
|---|---|---|---|---|---|
| `projects` | 17 | id | Y | Yes | **Generic parent project** — repair module inserts/joins here via raw SQL (`repair-projects.service.ts:246,310,520`). Entity-backed but written via raw SQL. |
| `facilities` | 13 | id | — | Yes | **No entity** — referenced only via raw SQL `LEFT JOIN facilities` (`repair-projects.service.ts:249`). |
| `repair_types` | 10 | id | Y | Yes | Repair type catalog. |
| `repair_projects` | 44 | id | Y | Yes | Repair master record. |
| `repair_project_phases` | 15 | id | Y | Yes | Repair phases (entity-backed). |
| `repair_project_team_members` | 11 | id | Y | Yes | Repair team (entity-backed). |
| `repair_pow_items` | 21 | id | Y | Yes | Program-of-works line items. |

### Gender & Development — GAD (7 tables — all active)
| Table | Cols | PK | SD | U? | Purpose |
|---|---|---|---|---|---|
| `gad_budget_plans` | 20 | id | Y | Yes | GAD budget plan (GPB). |
| `gad_gpb_accomplishments` | 19 | id | Y | Yes | GPB accomplishment records. |
| `gad_faculty_parity_data` | 15 | id | Y | Yes | Faculty gender-parity dataset. |
| `gad_staff_parity_data` | 15 | id | Y | Yes | Staff gender-parity dataset. |
| `gad_student_parity_data` | 14 | id | Y | Yes | Student gender-parity dataset. |
| `gad_pwd_parity_data` | 14 | id | Y | Yes | PWD parity dataset. |
| `gad_indigenous_parity_data` | 14 | id | Y | Yes | Indigenous-peoples parity dataset. |

### Audit / Records / System (6 tables — all active)
| Table | Cols | PK | SD | U? | Purpose · Notes |
|---|---|---|---|---|---|
| `activity_logs` | 9 | id | — | Yes | Application activity log (migration 044). |
| `record_assignments` | 12 | id | — | Yes | Generic record→user assignment (module CONSTRUCTION/REPAIR/OPERATIONS). |
| `documents` | 25 | id | Y | Yes | Generic document store (lifecycle ACTIVE/ARCHIVED/DRAFT). |
| `media` | 27 | id | Y | Yes | Generic media/attachment store. |
| `system_settings` | 14 | id | Y | Yes | Key-value app settings (typed via `setting_data_type_enum`). |
| `mikro_orm_migrations` | 3 | id | — | Yes* | **ORM system table** — migration bookkeeping. Not app data. |

---

## Output 6 — Active vs Legacy Classification

### Active (58)
All 58 tables listed in Output 2 above. Justification per table = entity registration and/or a cited raw-SQL reference (see `facilities`, `projects`, `mikro_orm_migrations` notes — the only non-entity actives).

### Legacy (26) — zero code references, archival candidates
Each row: verified by `grep -rl "<table>" src --include=*.ts | grep -v spec` returning **0 matches**. Grouped by apparent origin.

#### A. Pre-refactor "construction_project_*" prototype layer (9)
Superseded by the current `construction_*` model (`construction_projects` + `construction_milestones` + `construction_timeline_entries` + `construction_document_*`). The plural `construction_project_*` naming is the abandoned first design.
| Legacy table | Superseded by |
|---|---|
| `construction_project_accomplishment_records` | `construction_progress_reports` / `construction_mov_entries` |
| `construction_project_actual_accomplishment_records` | `construction_progress_reports` |
| `construction_project_assignments` | `record_assignments` + `project_contractor_assignments` |
| `construction_project_financial_reports` | `construction_timeline_entries` (financial fields) |
| `construction_project_milestones` | `construction_milestones` |
| `construction_project_phases` | `construction_timeline_entries` |
| `construction_project_progress` | `construction_progress_reports` |
| `construction_project_progress_summaries` | `construction_progress_reports` |
| `construction_project_team_members` | `record_assignments` |

#### B. Pre-refactor "repair_project_*" prototype layer (5)
Superseded by the current `repair_project_phases` + `repair_project_team_members` + `repair_pow_items` model.
`repair_project_accomplishment_records`, `repair_project_actual_accomplishment_records`, `repair_project_financial_reports`, `repair_project_milestones`, `repair_project_progress_summaries`.

#### C. Early facilities/campus prototype (predates current architecture) (11)
No active module maps to any of these — an early "campus asset registry" concept that was never wired into the current UO/COI/Repair architecture.
`buildings`, `rooms`, `room_assessments`, `university_statistics`, `notifications`, `policies`, `downloadable_forms`, `forms_inventory`, `user_page_permissions`, `gad_yearly_profiles`, `audit_trail`.

> **Note on `audit_trail`:** despite the name, it is unreferenced; current auditing runs through `activity_logs` (active) + per-table `*_by`/`*_at` columns. `audit_trail` is the abandoned original design.
> **Note on `university_operations_personnel`:** unreferenced; superseded by `operation_organizational_info` + `user_pillar_assignments`.

`university_operations_personnel` is the 26th legacy table (category C/UO-prototype).

### Discrepancies (historical migrations vs. current implementation)
- **RD-1 (confirmed):** ~50 columns on `operation_indicators`, `operation_financials`, taxonomy, roles/permissions `metadata`, etc. exist in the dump but not in MikroORM entities — accessed via raw SQL (hybrid model, ADR-005). The dump (not entities) is authoritative; T11-1 preserves them.
- **Two migration histories:** `database/migrations/*.sql` (001–048) and `src/database/mikro-migrations/*.ts` (68 files) both contributed; neither alone enumerates the schema. Legacy tables A/B/C originate from the early numbered SQL migrations and were never dropped.

### Recommendation (no action taken — documentation only)
The 26 legacy tables are **safe archival candidates**: drop or move to an `_archived_*` schema after a data-presence check (`SELECT count(*)`). Per project rule "Archive, Never Delete," recommend `ALTER TABLE ... SET SCHEMA archive;` rather than `DROP`. **Do not action during turnover** — this is a post-handover cleanup, and the dump-based bootstrap (ADR-023) already reproduces them harmlessly.
