# PMO CORE — Statistics, Audit Review & Production-Readiness (Outputs 7, 9, 10)
> Track T11 · ACE Phase 3 · 2026-07-06
> All figures computed directly from `coredata_schema.sql` and the T11-1…T11-4 artifacts (not re-estimated).

## Output 7 — Database Statistics
| Metric | Value | Notes |
|---|---|---|
| **Total tables** | **84** | 58 active · 26 legacy |
| Total columns | **1,329** | across all 84 tables |
| Views | **0** | no DB views; all aggregation is in-service (raw SQL / ORM) |
| ENUM types | **19** | see `01_schema.sql` §1 |
| Junction tables (composite-PK bridges) | **3** | `user_roles`, `role_permissions`, `user_departments` |
| Bridge tables (surrogate-PK M:N) | 1 | `project_contractor_assignments` |
| Foreign keys | **185** | 144 active↔active · 41 legacy-internal |
| Indexes | **173** | incl. **22 partial-unique** (`WHERE deleted_at IS NULL`) |
| Named UNIQUE constraints | **34** | + 22 partial-unique indexes enforce soft-delete-aware uniqueness |
| CHECK constraints | **27** | enum-like string guards + `chk_users_rank_level` range |
| Generated columns | **0** | — |
| Sequences | 0 | all PKs are `uuid DEFAULT gen_random_uuid()` except `fiscal_years.year` (int) |
| Audit tables (have `created_at`) | 75 of 84 (51 of 58 active) | |
| Soft-delete tables (have `deleted_at`) | 52 of 84 (30 of 58 active) | |

## Output 9 — Audit & Soft-Delete Review

### How auditing is implemented
Two complementary mechanisms:
1. **Per-row audit columns** — `created_at`, `updated_at`, `deleted_at` (timestamps) and `created_by`, `updated_by`, `deleted_by` (uuid → `users`). Set by the service layer / MikroORM lifecycle hooks. This is the primary trail.
2. **`activity_logs`** (migration 044) — application-level event log (`entity_type`, `entity_id`, `action`, `user_id`, `created_at`). Indexed on `created_at` + `entity_type` for querying.

There is **no database-trigger auditing** and **no populated `audit_trail` table** (that table is legacy/unused — see `02_inventory_and_legacy.md`).

### Soft-delete
Soft-delete = `deleted_at IS NULL` filter, enforced for uniqueness via **22 partial-unique indexes** (e.g. `uq_oi_quarterly_per_quarter ... WHERE deleted_at IS NULL AND reported_quarter IS NOT NULL`). 30 of 58 active tables use it. Records are never hard-deleted where `deleted_at` exists; `users` are soft-deleted (18 of 25 rows soft-deleted per RD-5), which is why 126 FKs to `users` use RESTRICT rather than CASCADE.

### Full-audit coverage (active tables)
| Column | Active tables having it |
|---|---|
| `created_at` | 51 / 58 |
| `updated_at` | 41 / 58 |
| `deleted_at` | 30 / 58 |
| `created_by` | 28 / 58 |
| `updated_by` | 21 / 58 |
| `deleted_by` | 20 / 58 |

Tables with the **complete 6-column audit set** include `users`, `construction_projects`, `operation_indicators`, `operation_financials`, `operation_organizational_info`, `university_operations`, `repair_projects`, `documents`, `media`, `departments`, `system_settings`, `funding_sources`, `contractors`, `construction_subcategories`, `construction_document_folders`, `repair_types`.

### Audit gaps (active tables)
- **No `created_at` at all (7):** `access_requests`*, `construction_gallery`, `mikro_orm_migrations`†, `password_reset_requests`*, `project_contractor_assignments`, `record_assignments`, `user_pillar_assignments`.
  \* these use a domain-specific timestamp (`requested_at` / token timestamps) instead — functionally covered. † ORM system table, N/A.
- **`construction_gallery` has zero audit columns** — no way to attribute who uploaded a gallery image or when. **Genuine gap** (LOW–MEDIUM): image provenance is untracked. The linked `documents`/`media` path is fully audited; only inline gallery rows are not.
- Junction tables (`user_roles`, `role_permissions`, `user_departments`, `user_module_assignments`, `user_pillar_assignments`) carry partial audit (`created_at`/`created_by`/`assigned_by`) but no soft-delete — acceptable (assignments are hard-removed by design).

## Output 10 — Production-Readiness Assessment
> Evidence-based review. **No schema change is made or recommended for immediate action during turnover** — these are documented for the successor. Severity reflects impact at the projected scale (20–50 concurrent users, low-thousands of rows per table).

### 1. Indexing
- **173 indexes present**, including well-chosen partial-unique indexes for soft-delete and composite business keys. Hot query paths (`operation_indicators` by `operation_id`/`fiscal_year`/`reported_quarter`/`pillar_indicator_id`; `operation_financials` similarly; `construction_projects.project_code`) **are indexed**. Good baseline.
- **105 of 144 active FK columns have no dedicated leading index.** Of these, **87 point to `users`** (audit `*_by` columns) — rarely used as a query predicate, so low priority. **18 are structural** join columns; the ones on growth tables are worth an index post-turnover:
  `construction_gallery(project_id)`, `construction_milestones(project_id)`, `construction_document_checklist(document_type_id, linked_document_id)`, `construction_document_submissions(document_id)`, `contractor_invite_tokens(project_id)`, `repair_project_phases(repair_project_id)`, `repair_project_team_members(repair_project_id)`, `repair_projects(contractor_id, facility_id, project_id)`.
  The remaining structural ones are on tiny reference/junction tables (`role_permissions`, `user_roles`, `user_departments`) where a full scan is cheaper than an index. **Severity: LOW** at current scale; revisit if COI/repair child tables grow past ~10⁴ rows.

### 2. Missing foreign keys (integrity risk)
- **`fiscal_year` is a bare `integer`** on `operation_indicators`, `operation_financials`, `university_operations`, and GAD tables — **not** an FK to `fiscal_years(year)`. A row can reference a non-existent fiscal year. **Severity: LOW–MEDIUM** (values are UI-constrained; add FK for hard integrity later).
- **`record_assignments.module`** is a CHECK-constrained string (`CONSTRUCTION`/`REPAIR`/`OPERATIONS`) with `record_id` as an untyped uuid — a **polymorphic association** with no FK to the target row. Resolved in application code. Standard trade-off for polymorphism; **Severity: LOW** but means orphaned assignments are possible if a target is deleted.
- **File links are soft** (RD-2): `construction_gallery.image_url`, `documents` paths are strings, not FKs to a file registry. Drift possible in both directions. Known, accepted (T2/T7 scope).

### 3. Normalization
- **`construction_projects` (95 cols)** and **`operation_indicators` (73 cols)** are wide by design: per-quarter columns (`*_q1`…`*_q4`), overrides, and denormalized BAR fields. This is **intentional denormalization** matching the BAR No.1/No.2 report shape and the hybrid raw-SQL access model (ADR-005). Not a defect; documented so a successor does not "normalize" them and break the BAR renderers. **No action.**
- `operation_financials` stores both raw amounts and computed rates (`utilization_*`, `disbursement_rate`, `balance`) — computed server-side in `computeFinancialMetrics()` and persisted. Acceptable caching of derived values; keep computation authoritative.

### 4. Circular dependencies
- **None.** Two self-referencing trees (`departments.parent_id`, `construction_document_folders.parent_id`), both nullable at root — safe.

### 5. Redundant / legacy structures
- **26 legacy tables (≈31% of the schema)** are unreferenced (Output 6). They inflate the dump, migrations, and cognitive load but are otherwise inert. **Recommendation:** post-turnover, `ALTER TABLE … SET SCHEMA archive` (per "Archive, Never Delete") after a `count(*)` check. **Do not action during turnover** — the ADR-023 dump reproduces them harmlessly and touching them now adds risk before the July 15 handover.

### 6. Performance bottlenecks
- No table is expected to exceed low-thousands of rows in the near term (RD-5: UO ~475, COI ~600). MikroORM pool `min:2 max:10` (RD-SE-4) is adequate. **No bottleneck at projected scale.** The one watch-item is dashboard fan-out (11 parallel queries, RD-SE-1) — already accommodated in throttling, not a schema issue.

### 7. Data-integrity risks (ranked)
| Risk | Severity | Mitigation |
|---|---|---|
| Soft file↔row links can drift | MEDIUM | Integrity audit in backup/restore runbook (T3); object-store migration (T7) |
| `fiscal_year` not FK-enforced | LOW–MED | Add FK to `fiscal_years(year)` post-turnover |
| Polymorphic `record_assignments` orphans | LOW | App-level cascade on record delete |
| `construction_gallery` unaudited uploads | LOW | Add `created_at`/`created_by` post-turnover |
| Legacy tables mistaken for active | LOW | This document + Output 6 |

### Overall verdict
**Production-ready at target scale.** The schema is coherent, well-constrained (185 FKs, 27 CHECKs, 34 UNIQUEs, soft-delete-aware partial indexes), and free of circular dependencies. All findings are **LOW–MEDIUM, non-blocking, post-turnover** enhancements — consistent with the "harden and ship" verdict in `research.md`. The single most valuable follow-up is archiving the 26 legacy tables to shrink the surface a successor must reason about.
