# PMO CORE — Relationship Analysis & Dependency Map (Outputs 4 & 8)
> Track T11 · ACE Phase 3 · 2026-07-06
> Derived from the 185 `FOREIGN KEY` constraints in `coredata_schema.sql`, cross-checked against MikroORM `@ManyToOne`/`@OneToMany`/`@ManyToMany` decorators.

## Foreign-key overview
| Metric | Count |
|---|---|
| Total FK constraints | **185** |
| Into `users` (audit `*_by` + ownership) | **126** (105 among active tables) |
| Active↔active FKs | 144 |
| Internal to the legacy cluster (legacy child or parent) | 41 |
| `ON DELETE CASCADE` | 21 |
| `ON DELETE SET NULL` | 10 |
| `ON DELETE` default (NO ACTION/RESTRICT) | 154 |

**Reading the map:** `users` is the universal parent — 126 of 185 FKs point at it, almost entirely from `created_by` / `updated_by` / `deleted_by` / `*_by` audit columns (`ON DELETE SET NULL` where a user may be removed, RESTRICT elsewhere). Those are omitted from the per-module diagrams below (they would swamp the signal); they are summarized once here and treated as a cross-cutting concern.

---

## Output 4 — Relationship Analysis (structural spine, `users` audit-FKs excluded)

Relationship type is stated from the **child's** perspective (the table holding the FK column). N:1 = many child rows per parent; M:N = resolved through a junction table.

### Authentication / IAM
| Parent | → Child | FK column | Type | ON DELETE | Why / consumed by |
|---|---|---|---|---|---|
| `roles` | `user_roles` | role_id | M:N (user↔role) | CASCADE | RBAC role assignment. `auth`/`users` module, `RolesGuard`. |
| `users` | `user_roles` | user_id | M:N | CASCADE | (junction other leg) |
| `roles` | `role_permissions` | role_id | M:N (role↔perm) | RESTRICT | Permission grants per role. `ModuleAccessGuard`. |
| `permissions` | `role_permissions` | permission_id | M:N | RESTRICT | (junction other leg) |
| `departments` | `user_departments` | department_id | M:N (user↔dept) | RESTRICT | Department membership. |
| `departments` | `departments` | parent_id | N:1 (self) | RESTRICT | Department hierarchy (self-referencing tree). |

> `user_module_assignments`, `user_permission_overrides`, `user_pillar_assignments`, `access_requests`, `password_reset_requests` link to `users` only (audit/ownership) — see cross-cutting note.

### University Operations
| Parent | → Child | FK column | Type | ON DELETE | Why / consumed by |
|---|---|---|---|---|---|
| `university_operations` | `operation_indicators` | operation_id | N:1 | RESTRICT | BAR1 physical rows per operation. `university-operations.service.ts`. |
| `university_operations` | `operation_financials` | operation_id | N:1 | RESTRICT | BAR2 financial rows per operation. |
| `university_operations` | `operation_organizational_info` | operation_id | N:1 | RESTRICT | Org context per operation. |
| `pillar_indicator_taxonomy` | `operation_indicators` | pillar_indicator_id | N:1 | RESTRICT | Ties each indicator to the authoritative BAR1 taxonomy (migration 019). |
| `quarterly_reports` | `quarterly_report_submissions` | quarterly_report_id | N:1 | RESTRICT | Submission event log per report. Governance lifecycle. |

> `fiscal_year` is stored as an **integer column** on UO tables, not an FK to `fiscal_years` — see Output 10 (missing FK, low risk).

### Infrastructure / COI
| Parent | → Child | FK column | Type | ON DELETE | Why / consumed by |
|---|---|---|---|---|---|
| `construction_projects` | `construction_diary_entries` | project_id | N:1 | CASCADE | Site diary per project. |
| `construction_projects` | `construction_document_checklist` | project_id | N:1 | CASCADE | Doc checklist per project. |
| `construction_projects` | `construction_document_folders` | project_id | N:1 | CASCADE | Folder tree per project. |
| `construction_projects` | `construction_gallery` | project_id | N:1 | CASCADE | Images per project. |
| `construction_projects` | `construction_milestones` | project_id | N:1 | CASCADE | Milestones per project. |
| `construction_projects` | `construction_mov_entries` | project_id | N:1 | CASCADE | MOV entries per project. |
| `construction_projects` | `construction_progress_reports` | project_id | N:1 | RESTRICT | Progress reports per project. |
| `construction_projects` | `construction_revision_orders` | project_id | N:1 | RESTRICT | Revision orders per project. |
| `construction_projects` | `construction_timeline_entries` | project_id | N:1 | CASCADE | WAR/MPR timeline per project. |
| `construction_subcategories` | `construction_projects` | subcategory_id | N:1 | RESTRICT | Project categorization. |
| `funding_sources` | `construction_projects` | funding_source_id | N:1 | RESTRICT | Funding source per project. |
| `construction_document_types` | `construction_document_checklist` | document_type_id | N:1 | RESTRICT | Checklist item derives from a doc type. |
| `construction_document_checklist` | `construction_document_submissions` | checklist_item_id | N:1 | RESTRICT | Submissions against a checklist item. |
| `construction_document_folders` | `construction_document_folders` | parent_id | N:1 (self) | CASCADE | Folder tree (self-referencing). |
| `construction_document_folders` | `documents` | folder_id | N:1 | SET NULL | Documents filed into a folder. |
| `documents` | `construction_document_checklist` | linked_document_id | N:1 | RESTRICT | Links a checklist item to a stored document. |
| `documents` | `construction_document_submissions` | document_id | N:1 | RESTRICT | Submission's stored file. |

### Contractor
| Parent | → Child | FK column | Type | ON DELETE | Why |
|---|---|---|---|---|---|
| `construction_projects` | `project_contractor_assignments` | project_id | M:N (project↔contractor) | CASCADE | Contractor assignment to project. |
| `construction_projects` | `contractor_invite_tokens` | project_id | N:1 | CASCADE | Invite scoped to a project. |
| `contractor_invite_tokens` | `project_contractor_assignments` | invite_token_id | N:1 | RESTRICT | Assignment created from an accepted invite. |
| `contractors` | `construction_projects` | contractor_id | N:1 | RESTRICT | Primary contractor on a COI project. |
| `contractors` | `repair_projects` | contractor_id | N:1 | RESTRICT | Contractor on a repair project. |

### Repair Projects
| Parent | → Child | FK column | Type | ON DELETE | Why |
|---|---|---|---|---|---|
| `projects` | `repair_projects` | project_id | N:1 | RESTRICT | Repair project extends a generic parent `projects` row. |
| `projects` | `construction_projects` | project_id | N:1 | RESTRICT | COI project also extends a generic `projects` row. |
| `facilities` | `repair_projects` | facility_id | N:1 | RESTRICT | Repair targets a facility (raw-SQL join). |
| `repair_types` | `repair_projects` | repair_type_id | N:1 | RESTRICT | Repair classification. |
| `repair_projects` | `repair_pow_items` | repair_project_id | N:1 | RESTRICT | Program-of-works items. |
| `repair_projects` | `repair_project_phases` | repair_project_id | N:1 | RESTRICT | Phases. |
| `repair_projects` | `repair_project_team_members` | repair_project_id | N:1 | RESTRICT | Team members. |

### GAD & System
GAD tables (`gad_*`) and system tables (`activity_logs`, `record_assignments`, `documents`, `media`, `system_settings`) link to `users` (audit) and carry `fiscal_year`/`module` **as scalar columns**, not FKs. `record_assignments.module` is a CHECK-constrained string (`CONSTRUCTION`/`REPAIR`/`OPERATIONS`) — a polymorphic association resolved in application code, not by FK (see Output 10).

### Cross-cutting: the `users` audit web
126 FKs reference `users(id)` from columns `created_by`, `updated_by`, `deleted_by`, `approved_by`, `reviewed_by`, `assigned_to`, `author_id`, `actor_id`, etc. Pattern:
- Ownership/authorship (`author_id`, `assigned_to`) → typically `ON DELETE SET NULL` or RESTRICT.
- Audit (`*_by`) → RESTRICT (a user with audit history cannot be hard-deleted; the app soft-deletes users via `deleted_at` instead).
This is why `users` shows 126 inbound FKs while holding almost no outbound structural FKs — it is the root of the dependency tree.

---

## Output 8 — Dependency Hierarchy

Top-down creation/dependency order (a table depends on everything above it). `users` is the universal root via audit FKs.

```
users  (root — 126 inbound audit/ownership FKs)
│
├── roles ── role_permissions ── permissions
│     └── user_roles
├── departments (self-tree) ── user_departments
├── user_module_assignments / user_permission_overrides /
│   user_pillar_assignments / access_requests / password_reset_requests
│
├── fiscal_years        pillar_indicator_taxonomy (BAR1 taxonomy, READONLY)
│        │                        │
│   university_operations ────────┤
│        ├── operation_indicators (← pillar_indicator_taxonomy)
│        ├── operation_financials
│        └── operation_organizational_info
│   quarterly_reports ── quarterly_report_submissions
│
├── projects (generic parent)
│     ├── construction_projects  (← subcategory, funding_source, contractor)
│     │     ├── construction_diary_entries / _gallery / _milestones /
│     │     │   _mov_entries / _timeline_entries          [CASCADE]
│     │     ├── construction_progress_reports / _revision_orders [RESTRICT]
│     │     ├── construction_document_folders (self-tree) ── documents
│     │     │     └── construction_document_checklist (← document_types)
│     │     │            └── construction_document_submissions
│     │     ├── contractor_invite_tokens
│     │     └── project_contractor_assignments (← contractors, invite_tokens)
│     └── repair_projects  (← facilities, repair_types, contractor)
│           ├── repair_pow_items
│           ├── repair_project_phases
│           └── repair_project_team_members
│
├── contractors ── contractor_users ── contractor_invite_tokens
│
├── gad_* (7 datasets — depend only on users + scalar fiscal_year)
│
└── activity_logs / record_assignments / documents / media /
    system_settings / mikro_orm_migrations   (system, users-only deps)

LEGACY cluster (isolated — no FK to any active table):
    buildings ── rooms ── room_assessments ;  construction_project_* (9) ;
    repair_project_* (5) ;  audit_trail, notifications, policies,
    downloadable_forms, forms_inventory, user_page_permissions,
    university_statistics, gad_yearly_profiles, university_operations_personnel
```

**Load order for migration/restore:** thanks to the mostly-flat FK graph (154 of 185 FKs are RESTRICT/NO-ACTION and `users` is the single deep root), a data load using `SET session_replication_role = 'replica'` (per RD-5) sidesteps ordering entirely. Natural order otherwise: `users` → reference tables (`roles`, `permissions`, `departments`, `fiscal_years`, `pillar_indicator_taxonomy`, `funding_sources`, `construction_subcategories`, `repair_types`, `facilities`, `contractors`) → `projects` → `construction_projects`/`repair_projects` → children → junctions → logs.

**Circular dependencies:** none. Two self-references exist (`departments.parent_id`, `construction_document_folders.parent_id`) — these are trees, not cycles, and both are nullable at the root.
