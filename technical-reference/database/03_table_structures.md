# PMO CORE — Table Structure Reference (Output 3)
> Track T11 · ACE Phase 3 · 2026-07-06
> Per-column detail for all **58 active tables**, grouped by module. Columns parsed **verbatim** from `coredata_schema.sql` (type/nullable/default are exact; not inferred). For the 26 legacy tables see `02_inventory_and_legacy.md` and the DDL in `01_schema.sql`.
>
> **Nullable** = `yes` unless `NOT NULL`. **Default** `—` = none. FK/PK/CHECK constraints are documented in `01_schema.sql` and `04_relationships_and_dependencies.md`; the **Description** for column intent is inferable from the column name and the module context (explicit COMMENTs are absent in the dump).

## Authentication / IAM / Access Control

### `access_requests`  (11 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | NO | — |
| `requested_module` | character varying(50) | NO | — |
| `requested_level` | character varying(30) | NO | — |
| `justification` | text | yes | — |
| `status` | character varying(20) | NO | `'PENDING'::character varying` |
| `granted_level` | character varying(30) | yes | — |
| `decision_note` | text | yes | — |
| `decided_by` | uuid | yes | — |
| `decided_at` | timestamp with time zone | yes | — |
| `requested_at` | timestamp with time zone | NO | `now()` |

### `departments`  (16 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | character varying(255) | NO | — |
| `code` | character varying(50) | yes | — |
| `description` | text | yes | — |
| `parent_id` | uuid | yes | — |
| `head_id` | uuid | yes | — |
| `email` | character varying(255) | yes | — |
| `phone` | character varying(20) | yes | — |
| `status` | public.department_status_enum | NO | `'ACTIVE'::public.department_status_enum` |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `created_by` | uuid | yes | — |
| `updated_by` | uuid | yes | — |

### `password_reset_requests`  (7 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `identifier` | text | NO | — |
| `status` | text | NO | `'PENDING'::text` |
| `notes` | text | yes | — |
| `requested_at` | timestamp with time zone | NO | `now()` |
| `completed_by` | uuid | yes | — |
| `completed_at` | timestamp with time zone | yes | — |

### `permissions`  (10 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | character varying(100) | NO | — |
| `description` | text | yes | — |
| `resource` | character varying(100) | NO | — |
| `action` | character varying(50) | NO | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |

### `role_permissions`  (4 columns · PK `role_id, permission_id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `role_id` | uuid | NO | — |
| `permission_id` | uuid | NO | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `created_by` | uuid | yes | — |

### `roles`  (8 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | character varying(50) | NO | — |
| `description` | text | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |

### `user_departments`  (5 columns · PK `user_id, department_id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `user_id` | uuid | NO | — |
| `department_id` | uuid | NO | — |
| `is_primary` | boolean | yes | `false` |
| `created_at` | timestamp with time zone | NO | `now()` |
| `created_by` | uuid | yes | — |

### `user_module_assignments`  (6 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | NO | — |
| `module` | public.module_type | NO | — |
| `assigned_by` | uuid | yes | — |
| `assigned_at` | timestamp with time zone | yes | `now()` |
| `created_at` | timestamp with time zone | yes | `now()` |

### `user_permission_overrides`  (9 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | NO | — |
| `module_key` | character varying(50) | NO | — |
| `can_access` | boolean | NO | `false` |
| `created_at` | timestamp without time zone | yes | `CURRENT_TIMESTAMP` |
| `created_by` | uuid | yes | — |
| `updated_at` | timestamp without time zone | yes | `CURRENT_TIMESTAMP` |
| `updated_by` | uuid | yes | — |
| `granted_level` | character varying(30) | yes | — |

### `user_pillar_assignments`  (5 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | NO | — |
| `pillar_type` | character varying(50) | NO | — |
| `assigned_by` | uuid | yes | — |
| `assigned_at` | timestamp with time zone | NO | `now()` |

### `user_roles`  (7 columns · PK `user_id, role_id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `user_id` | uuid | NO | — |
| `role_id` | uuid | NO | — |
| `is_superadmin` | boolean | NO | `false` |
| `assigned_by` | uuid | yes | — |
| `assigned_at` | timestamp with time zone | yes | `now()` |
| `created_at` | timestamp with time zone | NO | `now()` |
| `created_by` | uuid | yes | — |

### `users`  (28 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `email` | character varying(255) | NO | — |
| `password_hash` | character varying(255) | NO | — |
| `first_name` | character varying(100) | NO | — |
| `last_name` | character varying(100) | NO | — |
| `phone` | character varying(20) | yes | — |
| `avatar_url` | character varying(255) | yes | — |
| `is_active` | boolean | NO | `true` |
| `last_login_at` | timestamp with time zone | yes | — |
| `last_password_change_at` | timestamp with time zone | yes | — |
| `failed_login_attempts` | integer | yes | `0` |
| `account_locked_until` | timestamp with time zone | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `google_id` | character varying(255) | yes | — |
| `username` | character varying(100) | NO | — |
| `rank_level` | integer | yes | `100` |
| `campus` | text | yes | — |
| `status` | character varying(50) | yes | `'ACTIVE'::character varying` |
| `updated_by` | uuid | yes | — |
| `middle_name` | text | yes | — |
| `display_name` | character varying(255) | yes | — |
| `created_by` | uuid | yes | — |
| `profile_completed` | boolean | NO | `false` |
| `must_change_password` | boolean | NO | `false` |

## University Operations (BAR No.1 / No.2)

### `fiscal_years`  (5 columns · PK `year`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `year` | integer | NO | — |
| `is_active` | boolean | NO | `true` |
| `label` | character varying(50) | yes | — |
| `created_at` | timestamp with time zone | yes | `now()` |
| `updated_at` | timestamp with time zone | yes | `now()` |

### `operation_financials`  (29 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `operation_id` | uuid | NO | — |
| `fiscal_year` | integer | NO | — |
| `quarter` | character varying(2) | yes | — |
| `operations_programs` | character varying(255) | NO | — |
| `department` | character varying(255) | yes | — |
| `budget_source` | character varying(100) | yes | — |
| `allotment` | numeric(15,2) | yes | — |
| `target` | numeric(15,2) | yes | — |
| `obligation` | numeric(15,2) | yes | `0` |
| `disbursement` | numeric(15,2) | yes | `0` |
| `utilization_per_target` | numeric(5,2) | yes | — |
| `utilization_per_approved_budget` | numeric(5,2) | yes | — |
| `disbursement_rate` | numeric(5,2) | yes | — |
| `balance` | numeric(15,2) | yes | — |
| `variance` | numeric(15,2) | yes | — |
| `performance_indicator` | character varying(255) | yes | — |
| `status` | character varying(20) | yes | `'active'::character varying` |
| `remarks` | text | yes | — |
| `created_by` | uuid | yes | — |
| `updated_by` | uuid | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `fund_type` | public.fund_type_enum | yes | — |
| `project_code` | character varying(50) | yes | — |
| `expense_class` | character varying(4) | yes | — |

### `operation_indicators`  (73 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `operation_id` | uuid | NO | — |
| `particular` | character varying(500) | NO | — |
| `description` | text | yes | — |
| `indicator_code` | character varying(100) | yes | — |
| `uacs_code` | character varying(50) | yes | — |
| `fiscal_year` | integer | NO | — |
| `target_q1` | numeric(12,4) | yes | — |
| `target_q2` | numeric(12,4) | yes | — |
| `target_q3` | numeric(12,4) | yes | — |
| `target_q4` | numeric(12,4) | yes | — |
| `accomplishment_q1` | numeric(12,4) | yes | — |
| `accomplishment_q2` | numeric(12,4) | yes | — |
| `accomplishment_q3` | numeric(12,4) | yes | — |
| `accomplishment_q4` | numeric(12,4) | yes | — |
| `score_q1` | character varying(250) | yes | — |
| `score_q2` | character varying(250) | yes | — |
| `score_q3` | character varying(250) | yes | — |
| `score_q4` | character varying(250) | yes | — |
| `variance_as_of` | date | yes | — |
| `variance` | numeric(12,4) | yes | — |
| `average_target` | numeric(12,4) | yes | — |
| `average_accomplishment` | numeric(12,4) | yes | — |
| `status` | character varying(20) | yes | `'pending'::character varying` |
| `remarks` | text | yes | — |
| `subcategory_data` | jsonb | yes | — |
| `created_by` | uuid | NO | — |
| `updated_by` | uuid | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `pillar_indicator_id` | uuid | yes | — |
| `reported_quarter` | character varying(2) | yes | — |
| `override_rate` | numeric(6,2) | yes | — |
| `override_rate_q1` | numeric(6,2) | yes | — |
| `override_rate_q2` | numeric(6,2) | yes | — |
| `override_rate_q3` | numeric(6,2) | yes | — |
| `override_rate_q4` | numeric(6,2) | yes | — |
| `override_variance` | numeric(8,2) | yes | — |
| `override_variance_q1` | numeric(8,2) | yes | — |
| `override_variance_q2` | numeric(8,2) | yes | — |
| `override_variance_q3` | numeric(8,2) | yes | — |
| `override_variance_q4` | numeric(8,2) | yes | — |
| `override_total_target` | numeric(15,4) | yes | `NULL::numeric` |
| `override_total_actual` | numeric(15,4) | yes | `NULL::numeric` |
| `catch_up_plan` | text | yes | — |
| `facilitating_factors` | text | yes | — |
| `ways_forward` | text | yes | — |
| `mov` | text | yes | — |
| `numerator_q1` | numeric(12,4) | yes | — |
| `denominator_q1` | numeric(12,4) | yes | — |
| `numerator_q2` | numeric(12,4) | yes | — |
| `denominator_q2` | numeric(12,4) | yes | — |
| `numerator_q3` | numeric(12,4) | yes | — |
| `denominator_q3` | numeric(12,4) | yes | — |
| `numerator_q4` | numeric(12,4) | yes | — |
| `denominator_q4` | numeric(12,4) | yes | — |
| `target_numerator_q1` | numeric(12,4) | yes | — |
| `target_denominator_q1` | numeric(12,4) | yes | — |
| `target_numerator_q2` | numeric(12,4) | yes | — |
| `target_denominator_q2` | numeric(12,4) | yes | — |
| `target_numerator_q3` | numeric(12,4) | yes | — |
| `target_denominator_q3` | numeric(12,4) | yes | — |
| `target_numerator_q4` | numeric(12,4) | yes | — |
| `target_denominator_q4` | numeric(12,4) | yes | — |
| `remarks_q1` | text | yes | — |
| `remarks_q2` | text | yes | — |
| `remarks_q3` | text | yes | — |
| `remarks_q4` | text | yes | — |
| `override_total_target_fraction` | text | yes | — |
| `override_total_actual_fraction` | text | yes | — |

### `operation_organizational_info`  (13 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `operation_id` | uuid | NO | — |
| `department` | character varying(255) | yes | — |
| `agency_entity` | character varying(255) | yes | — |
| `operating_unit` | character varying(255) | yes | — |
| `organization_code` | character varying(100) | yes | — |
| `created_by` | uuid | NO | — |
| `updated_by` | uuid | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |

### `pillar_indicator_taxonomy`  (13 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `pillar_type` | public.operation_type_enum | NO | — |
| `indicator_name` | character varying(500) | NO | — |
| `indicator_code` | character varying(50) | yes | — |
| `uacs_code` | character varying(50) | yes | — |
| `indicator_order` | integer | NO | — |
| `indicator_type` | character varying(20) | NO | — |
| `unit_type` | character varying(20) | NO | — |
| `description` | text | yes | — |
| `is_active` | boolean | yes | `true` |
| `created_at` | timestamp with time zone | NO | `now()` |
| `created_by` | uuid | yes | — |
| `organizational_outcome` | character varying(10) | yes | — |

### `quarterly_report_submissions`  (15 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `quarterly_report_id` | uuid | NO | — |
| `fiscal_year` | integer | NO | — |
| `quarter` | character varying(2) | NO | — |
| `version` | integer | NO | `1` |
| `event_type` | character varying(30) | NO | — |
| `submitted_by` | uuid | yes | — |
| `submitted_at` | timestamp with time zone | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `review_notes` | text | yes | — |
| `actioned_by` | uuid | NO | — |
| `actioned_at` | timestamp with time zone | yes | `now()` |
| `reason` | text | yes | — |
| `created_at` | timestamp with time zone | yes | `now()` |

### `quarterly_reports`  (20 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `fiscal_year` | integer | NO | — |
| `quarter` | character varying(2) | NO | — |
| `title` | text | yes | — |
| `publication_status` | character varying(20) | yes | `'DRAFT'::character varying` |
| `submitted_by` | uuid | yes | — |
| `submitted_at` | timestamp with time zone | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `review_notes` | text | yes | — |
| `created_by` | uuid | NO | — |
| `created_at` | timestamp with time zone | yes | `now()` |
| `updated_at` | timestamp with time zone | yes | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `unlock_requested_by` | uuid | yes | — |
| `unlock_requested_at` | timestamp with time zone | yes | — |
| `unlock_request_reason` | text | yes | — |
| `unlocked_by` | uuid | yes | — |
| `unlocked_at` | timestamp with time zone | yes | — |
| `submission_count` | integer | NO | `0` |

### `university_operations`  (30 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `operation_type` | public.operation_type_enum | NO | — |
| `title` | character varying(255) | NO | — |
| `description` | text | yes | — |
| `code` | character varying(50) | yes | — |
| `start_date` | date | yes | — |
| `end_date` | date | yes | — |
| `status` | public.project_status_enum | NO | — |
| `budget` | numeric(15,2) | yes | — |
| `campus` | public.campus_enum | NO | — |
| `coordinator_id` | uuid | yes | — |
| `created_by` | uuid | NO | — |
| `updated_by` | uuid | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `publication_status` | public.publication_status_enum | yes | `'PUBLISHED'::public.publication_status_enum` |
| `submitted_by` | uuid | yes | — |
| `submitted_at` | timestamp with time zone | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `review_notes` | text | yes | — |
| `assigned_to` | uuid | yes | — |
| `fiscal_year` | integer | yes | — |
| `status_q1` | character varying(20) | yes | `'DRAFT'::character varying` |
| `status_q2` | character varying(20) | yes | `'DRAFT'::character varying` |
| `status_q3` | character varying(20) | yes | `'DRAFT'::character varying` |
| `status_q4` | character varying(20) | yes | `'DRAFT'::character varying` |

## Infrastructure / Construction (COI)

### `construction_diary_entries`  (8 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `entry_date` | date | NO | — |
| `title` | character varying(255) | yes | — |
| `content` | text | NO | — |
| `author_id` | uuid | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |

### `construction_document_checklist`  (15 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `document_type_id` | uuid | NO | — |
| `submission_status` | character varying(30) | NO | `'NOT_SUBMITTED'::character varying` |
| `submitted_by` | uuid | yes | — |
| `submitted_at` | timestamp with time zone | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `review_notes` | text | yes | — |
| `current_version` | integer | NO | `0` |
| `expiry_date` | date | yes | — |
| `linked_document_id` | uuid | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `remarks` | text | yes | — |

### `construction_document_folders`  (13 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `parent_id` | uuid | yes | — |
| `folder_name` | character varying(200) | NO | — |
| `group_code` | character varying(50) | yes | — |
| `node_type` | character varying(30) | NO | `'CONTAINER'::character varying` |
| `sort_order` | integer | NO | `0` |
| `created_by` | uuid | yes | — |
| `updated_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |

### `construction_document_submissions`  (9 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `checklist_item_id` | uuid | NO | — |
| `project_id` | uuid | NO | — |
| `document_id` | uuid | NO | — |
| `version` | integer | NO | — |
| `submitted_by` | uuid | NO | — |
| `submitted_at` | timestamp with time zone | NO | `now()` |
| `submission_notes` | text | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |

### `construction_document_types`  (10 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `group_code` | character varying(20) | NO | — |
| `group_label` | character varying(100) | NO | — |
| `type_code` | character varying(50) | NO | — |
| `type_label` | character varying(255) | NO | — |
| `is_required` | boolean | NO | `true` |
| `sort_order` | integer | NO | `0` |
| `is_active` | boolean | NO | `true` |
| `created_at` | timestamp with time zone | NO | `now()` |
| `template_url` | text | yes | — |

### `construction_gallery`  (8 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `image_url` | character varying(500) | NO | — |
| `caption` | character varying(255) | yes | — |
| `category` | character varying(50) | yes | `'IN_PROGRESS'::character varying` |
| `is_featured` | boolean | yes | `false` |
| `uploaded_at` | timestamp with time zone | NO | `now()` |
| `image_taken_date` | date | yes | — |

### `construction_milestones`  (16 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `title` | character varying(255) | NO | — |
| `description` | text | yes | — |
| `target_date` | date | yes | — |
| `actual_date` | date | yes | — |
| `status` | character varying(50) | yes | `'PENDING'::character varying` |
| `remarks` | text | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `start_date` | date | yes | — |
| `actual_start_date` | date | yes | — |
| `progress` | numeric(5,2) | NO | `0.00` |
| `category` | character varying(50) | yes | — |
| `created_by` | character varying(36) | yes | — |
| `updated_by` | character varying(36) | yes | — |
| `updated_at` | timestamp with time zone | yes | — |

### `construction_mov_entries`  (18 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `related_entity_type` | character varying(20) | NO | — |
| `related_entity_id` | uuid | NO | — |
| `mov_link` | text | yes | — |
| `mov_title` | character varying(255) | NO | — |
| `mov_description` | text | yes | — |
| `evidence_category` | character varying(50) | NO | `'other'::character varying` |
| `entry_date` | date | yes | — |
| `uploaded_by` | uuid | yes | — |
| `verification_status` | character varying(20) | NO | `'PENDING'::character varying` |
| `remarks` | text | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `file_path` | character varying(500) | yes | — |
| `file_name` | character varying(255) | yes | — |
| `file_size` | integer | yes | — |
| `mime_type` | character varying(100) | yes | — |

### `construction_progress_reports`  (25 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `report_type` | character varying(20) | NO | — |
| `report_date` | date | NO | — |
| `report_number` | character varying(20) | yes | — |
| `percentage_completion` | numeric(5,2) | NO | `0` |
| `planned_accomplishment` | numeric(5,2) | yes | — |
| `slippage` | numeric(5,2) | yes | — |
| `cost_incurred_to_date` | numeric(15,2) | yes | — |
| `cost_incurred_this_period` | numeric(15,2) | yes | — |
| `calendar_days_elapsed` | integer | yes | — |
| `percent_time_elapsed` | numeric(5,2) | yes | — |
| `remarks` | text | yes | — |
| `issues_encountered` | text | yes | — |
| `mitigation_actions` | text | yes | — |
| `mov_document_id` | uuid | yes | — |
| `mov_link` | text | yes | — |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `updated_by` | uuid | yes | — |
| `narrative_list` | jsonb | NO | `'[]'::jsonb` |
| `remarks_list` | jsonb | NO | `'[]'::jsonb` |
| `issues_encountered_list` | jsonb | NO | `'[]'::jsonb` |
| `mitigation_actions_list` | jsonb | NO | `'[]'::jsonb` |

### `construction_projects`  (95 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `infra_project_uid` | bigint | NO | — |
| `project_id` | uuid | NO | — |
| `project_code` | character varying(50) | NO | — |
| `title` | character varying(255) | NO | — |
| `description` | text | yes | — |
| `ideal_infrastructure_image` | character varying(255) | yes | — |
| `beneficiaries` | integer | yes | — |
| `objectives` | jsonb | yes | — |
| `key_features` | jsonb | yes | — |
| `original_contract_duration` | character varying(100) | yes | — |
| `contract_number` | character varying(50) | yes | — |
| `contractor_id` | uuid | yes | — |
| `contract_amount` | numeric(15,2) | yes | — |
| `start_date` | date | yes | — |
| `target_completion_date` | date | yes | — |
| `actual_completion_date` | date | yes | — |
| `project_duration` | character varying(100) | yes | — |
| `project_engineer` | character varying(255) | yes | — |
| `project_manager` | character varying(255) | yes | — |
| `location_coordinates` | point | yes | — |
| `building_type` | character varying(100) | yes | — |
| `floor_area` | numeric(10,2) | yes | — |
| `number_of_floors` | integer | yes | — |
| `funding_source_id` | uuid | yes | — |
| `subcategory_id` | uuid | yes | — |
| `campus` | public.campus_enum | NO | — |
| `status` | public.project_status_enum | NO | — |
| `latitude` | numeric(9,6) | yes | — |
| `longitude` | numeric(9,6) | yes | — |
| `physical_progress` | numeric(5,2) | yes | `0.00` |
| `financial_progress` | numeric(5,2) | yes | `0.00` |
| `timeline_data` | jsonb | yes | `'[]'::jsonb` |
| `gallery_images` | jsonb | yes | `'[]'::jsonb` |
| `created_by` | uuid | NO | — |
| `updated_by` | uuid | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `publication_status` | public.publication_status_enum | yes | `'PUBLISHED'::public.publication_status_enum` |
| `submitted_by` | uuid | yes | — |
| `submitted_at` | timestamp with time zone | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `review_notes` | text | yes | — |
| `assigned_to` | uuid | yes | — |
| `target_physical_progress` | numeric(5,2) | yes | `100` |
| `target_financial_progress` | numeric(5,2) | yes | `100` |
| `summary` | text | yes | — |
| `scope` | text | yes | — |
| `facilities` | text | yes | — |
| `strategic_alignment` | text | yes | — |
| `output_indicators` | jsonb | yes | — |
| `outcome_indicators` | jsonb | yes | — |
| `implementing_agency` | character varying(255) | yes | — |
| `project_status_category` | character varying(50) | yes | — |
| `status_updates` | jsonb | yes | — |
| `readiness_documents` | jsonb | yes | — |
| `signatories` | jsonb | yes | — |
| `document_checklist_remarks` | jsonb | NO | `'{}'::jsonb` |
| `incident_log` | jsonb | NO | `'[]'::jsonb` |
| `risk_register` | jsonb | NO | `'[]'::jsonb` |
| `escalation_records` | jsonb | NO | `'[]'::jsonb` |
| `contractor` | character varying(255) | yes | — |
| `spatial_coverage` | character varying(500) | yes | — |
| `municipality` | character varying(100) | yes | — |
| `province` | character varying(100) | yes | — |
| `co_implementing_agency` | character varying(255) | yes | — |
| `attached_agency` | character varying(255) | yes | — |
| `original_start_date` | date | yes | — |
| `revised_start_date` | date | yes | — |
| `original_completion_date` | date | yes | — |
| `revised_completion_date` | date | yes | — |
| `revised_project_duration` | character varying(100) | yes | — |
| `as_of_date` | date | yes | — |
| `cost_incurred_to_date` | numeric(15,2) | yes | — |
| `rdp_alignment` | jsonb | yes | — |
| `socioeconomic_agenda` | jsonb | yes | — |
| `csu_likha_goals` | jsonb | yes | — |
| `beneficiary_list` | jsonb | yes | — |
| `funding_source_type` | character varying(20) | yes | — |
| `additional_funding_sources` | jsonb | yes | — |
| `remarks_log` | jsonb | NO | `'[]'::jsonb` |
| `personnel_groups` | jsonb | yes | — |
| `custom_key_sections` | jsonb | yes | `'[]'::jsonb` |
| `sdg_goals` | jsonb | yes | `'[]'::jsonb` |
| `custom_supporting_sections` | jsonb | yes | `'[]'::jsonb` |
| `project_notes_banking` | jsonb | yes | — |
| `rdp2017_alignment` | jsonb | yes | — |
| `point_agenda_10` | jsonb | yes | — |
| `implementation_period` | character varying(100) | yes | — |
| `primary_funding_source` | character varying(30) | yes | — |
| `funding_source_description` | character varying(255) | yes | — |

### `construction_revision_orders`  (17 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `revision_number` | integer | NO | — |
| `revision_type` | character varying(50) | NO | — |
| `revision_date` | date | NO | — |
| `new_start_date` | date | yes | — |
| `new_completion_date` | date | yes | — |
| `new_duration` | character varying(100) | yes | — |
| `cost_adjustment` | numeric(15,2) | yes | — |
| `justification` | text | yes | — |
| `approval_status` | character varying(50) | yes | — |
| `mov_document_id` | uuid | yes | — |
| `mov_link` | text | yes | — |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `updated_by` | uuid | yes | — |

### `construction_subcategories`  (10 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | character varying(100) | NO | — |
| `description` | text | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `created_by` | uuid | yes | — |
| `updated_by` | uuid | yes | — |

### `construction_timeline_entries`  (35 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `entry_type` | character varying(20) | NO | `'WEEKLY'::character varying` |
| `entry_date` | date | NO | — |
| `period_label` | character varying(100) | yes | — |
| `title` | character varying(255) | NO | — |
| `description` | text | yes | — |
| `weather` | character varying(100) | yes | — |
| `manpower_count` | integer | yes | — |
| `equipment_used` | text | yes | — |
| `work_accomplished` | text | yes | — |
| `issues_encountered` | text | yes | — |
| `photos_count` | integer | NO | `0` |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `reporter_type` | character varying(20) | yes | — |
| `war_number` | character varying(50) | yes | — |
| `reporting_period_start` | date | yes | — |
| `reporting_period_end` | date | yes | — |
| `personnel_equipment_constraints` | text | yes | — |
| `mitigation_measures` | text | yes | — |
| `look_ahead_activities` | text | yes | — |
| `accomplishments` | jsonb | yes | `'[]'::jsonb` |
| `signatories` | jsonb | yes | `'[]'::jsonb` |
| `mpr_number` | character varying(50) | yes | — |
| `reporting_period_month` | date | yes | — |
| `work_items` | jsonb | yes | `'[]'::jsonb` |
| `accomplishment_summary_percent` | numeric(5,2) | yes | — |
| `percent_time_elapsed` | numeric(5,2) | yes | — |
| `original_contract_amount` | numeric(18,2) | yes | — |
| `revised_contract_amount` | numeric(18,2) | yes | — |
| `concerns_list` | jsonb | yes | `'[]'::jsonb` |
| `billing_amount_this_period` | numeric(15,2) | yes | — |
| `financial_accomplishment_percent` | numeric(5,2) | yes | — |

### `funding_sources`  (11 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | character varying(100) | NO | — |
| `description` | text | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `created_by` | uuid | yes | — |
| `updated_by` | uuid | yes | — |
| `type` | character varying(20) | yes | — |

## Contractor Sub-system

### `contractor_invite_tokens`  (10 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `token` | character varying(64) | NO | — |
| `target_email` | character varying(255) | yes | — |
| `created_by` | uuid | NO | — |
| `expires_at` | timestamp with time zone | NO | — |
| `accepted_at` | timestamp with time zone | yes | — |
| `accepted_by` | uuid | yes | — |
| `status` | character varying(20) | NO | `'PENDING'::character varying` |
| `created_at` | timestamp with time zone | NO | `now()` |

### `contractor_users`  (14 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `email` | character varying(255) | NO | — |
| `password_hash` | text | yes | — |
| `full_name` | text | NO | — |
| `company_name` | character varying(255) | yes | — |
| `phone` | character varying(30) | yes | — |
| `"position"` | character varying(150) | yes | — |
| `google_id` | character varying(255) | yes | — |
| `avatar_url` | text | yes | — |
| `status` | character varying(20) | NO | `'ACTIVE'::character varying` |
| `is_active` | boolean | NO | `true` |
| `last_login_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |

### `contractors`  (17 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | character varying(255) | NO | — |
| `contact_person` | character varying(255) | yes | — |
| `email` | character varying(255) | yes | — |
| `phone` | character varying(20) | yes | — |
| `address` | text | yes | — |
| `tin_number` | character varying(50) | yes | — |
| `registration_number` | character varying(100) | yes | — |
| `validity_date` | date | yes | — |
| `status` | public.contractor_status_enum | NO | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `created_by` | uuid | yes | — |
| `updated_by` | uuid | yes | — |

### `project_contractor_assignments`  (9 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `user_id` | uuid CONSTRAINT project_contractor_assignments_contractor_user_id_not_null | NO | — |
| `invite_token_id` | uuid | yes | — |
| `role` | character varying(100) | yes | — |
| `permissions` | jsonb | yes | — |
| `assigned_by` | uuid | yes | — |
| `assigned_at` | timestamp with time zone | NO | `now()` |
| `removed_at` | timestamp with time zone | yes | — |

## Repair Projects

### `facilities`  (13 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `building_name` | character varying(100) | NO | — |
| `room_number` | character varying(50) | NO | — |
| `facility_type` | character varying(50) | yes | `'Classroom'::character varying` |
| `campus` | public.campus_enum | yes | `'MAIN'::public.campus_enum` |
| `capacity` | integer | yes | — |
| `floor_area_sqm` | numeric(10,2) | yes | — |
| `condition_rating` | public.condition_enum | yes | `'GOOD'::public.condition_enum` |
| `features_list` | jsonb | yes | `'[]'::jsonb` |
| `is_operational` | boolean | yes | `true` |
| `last_inspected_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |

### `projects`  (17 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_code` | character varying(50) | NO | — |
| `title` | character varying(255) | NO | — |
| `description` | text | yes | — |
| `project_type` | public.project_type_enum | NO | — |
| `start_date` | date | yes | — |
| `end_date` | date | yes | — |
| `status` | public.project_status_enum | NO | — |
| `budget` | numeric(15,2) | yes | — |
| `campus` | public.campus_enum | NO | — |
| `created_by` | uuid | NO | — |
| `updated_by` | uuid | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |

### `repair_pow_items`  (21 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `repair_project_id` | uuid | NO | — |
| `item_number` | character varying(50) | NO | — |
| `description` | text | NO | — |
| `unit` | character varying(20) | NO | — |
| `quantity` | numeric(15,2) | NO | — |
| `estimated_material_cost` | numeric(15,2) | NO | — |
| `estimated_labor_cost` | numeric(15,2) | NO | — |
| `estimated_project_cost` | numeric(15,2) | NO | — |
| `unit_cost` | numeric(15,2) | NO | — |
| `is_unit_cost_overridden` | boolean | yes | `false` |
| `date_entry` | date | NO | — |
| `status` | character varying(50) | yes | `'Active'::character varying` |
| `remarks` | text | yes | — |
| `category` | character varying(100) | NO | — |
| `phase` | character varying(100) | NO | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |

### `repair_project_phases`  (15 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `repair_project_id` | uuid | NO | — |
| `phase_name` | character varying(100) | NO | — |
| `phase_description` | text | yes | — |
| `target_progress` | numeric(5,2) | yes | — |
| `actual_progress` | numeric(5,2) | yes | — |
| `status` | character varying(50) | yes | — |
| `target_start_date` | date | yes | — |
| `target_end_date` | date | yes | — |
| `actual_start_date` | date | yes | — |
| `actual_end_date` | date | yes | — |
| `remarks` | text | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

### `repair_project_team_members`  (11 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `repair_project_id` | uuid | NO | — |
| `user_id` | uuid | yes | — |
| `name` | character varying(255) | NO | — |
| `role` | character varying(100) | NO | — |
| `department` | character varying(100) | yes | — |
| `responsibilities` | text | yes | — |
| `status` | character varying(50) | yes | `'Active'::character varying` |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

### `repair_projects`  (44 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_id` | uuid | NO | — |
| `project_code` | character varying(50) | NO | — |
| `title` | character varying(255) | NO | — |
| `description` | text | yes | — |
| `building_name` | character varying(255) | NO | — |
| `floor_number` | character varying(20) | yes | — |
| `room_number` | character varying(20) | yes | — |
| `specific_location` | character varying(255) | yes | — |
| `repair_type_id` | uuid | NO | — |
| `urgency_level` | public.urgency_level_enum | NO | `'LOW'::public.urgency_level_enum` |
| `is_emergency` | boolean | NO | `false` |
| `campus` | public.campus_enum | NO | — |
| `reported_by` | character varying(255) | yes | — |
| `reported_date` | timestamp with time zone | yes | `now()` |
| `inspection_date` | date | yes | — |
| `inspector_id` | uuid | yes | — |
| `inspection_findings` | text | yes | — |
| `status` | public.repair_status_enum | NO | — |
| `start_date` | date | yes | — |
| `end_date` | date | yes | — |
| `budget` | numeric(15,2) | yes | — |
| `project_manager_id` | uuid | yes | — |
| `contractor_id` | uuid | yes | — |
| `completion_date` | date | yes | — |
| `facility_id` | uuid | yes | — |
| `assigned_technician` | character varying(255) | yes | — |
| `created_by` | uuid | NO | — |
| `updated_by` | uuid | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `physical_progress` | numeric(5,2) | yes | `0.00` |
| `financial_progress` | numeric(5,2) | yes | `0.00` |
| `actual_cost` | numeric(15,2) | yes | — |
| `publication_status` | public.publication_status_enum | yes | `'PUBLISHED'::public.publication_status_enum` |
| `submitted_by` | uuid | yes | — |
| `submitted_at` | timestamp with time zone | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `review_notes` | text | yes | — |
| `assigned_to` | uuid | yes | — |

### `repair_types`  (10 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | character varying(100) | NO | — |
| `description` | text | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `created_by` | uuid | yes | — |
| `updated_by` | uuid | yes | — |

## Gender & Development (GAD)

### `gad_budget_plans`  (20 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `title` | character varying(255) | NO | — |
| `description` | text | yes | — |
| `category` | character varying(100) | yes | — |
| `priority` | character varying(20) | yes | — |
| `status` | character varying(50) | yes | — |
| `budget_allocated` | numeric(12,2) | yes | — |
| `budget_utilized` | numeric(12,2) | yes | — |
| `target_beneficiaries` | integer | yes | — |
| `start_date` | date | yes | — |
| `end_date` | date | yes | — |
| `year` | character varying(4) | yes | — |
| `responsible` | character varying(255) | yes | — |
| `data_status` | character varying(50) | yes | `'pending'::character varying` |
| `submitted_by` | uuid | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

### `gad_faculty_parity_data`  (15 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `academic_year` | character varying(20) | NO | — |
| `college` | character varying(100) | NO | — |
| `category` | character varying(50) | NO | — |
| `total_faculty` | integer | yes | `0` |
| `male_count` | integer | yes | `0` |
| `female_count` | integer | yes | `0` |
| `gender_balance` | character varying(50) | yes | — |
| `status` | character varying(50) | yes | `'pending'::character varying` |
| `submitted_by` | uuid | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

### `gad_gpb_accomplishments`  (19 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `title` | character varying(255) | NO | — |
| `description` | text | yes | — |
| `category` | character varying(100) | yes | — |
| `priority` | character varying(20) | yes | — |
| `status` | character varying(50) | yes | — |
| `target_beneficiaries` | integer | yes | — |
| `actual_beneficiaries` | integer | yes | — |
| `target_budget` | numeric(12,2) | yes | — |
| `actual_budget` | numeric(12,2) | yes | — |
| `year` | character varying(4) | yes | — |
| `responsible` | character varying(255) | yes | — |
| `data_status` | character varying(50) | yes | `'pending'::character varying` |
| `submitted_by` | uuid | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

### `gad_indigenous_parity_data`  (14 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `academic_year` | character varying(20) | NO | — |
| `indigenous_category` | character varying(50) | NO | — |
| `subcategory` | character varying(100) | yes | — |
| `total_participants` | integer | yes | `0` |
| `male_count` | integer | yes | `0` |
| `female_count` | integer | yes | `0` |
| `status` | character varying(50) | yes | `'pending'::character varying` |
| `submitted_by` | uuid | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

### `gad_pwd_parity_data`  (14 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `academic_year` | character varying(20) | NO | — |
| `pwd_category` | character varying(50) | NO | — |
| `subcategory` | character varying(100) | yes | — |
| `total_beneficiaries` | integer | yes | `0` |
| `male_count` | integer | yes | `0` |
| `female_count` | integer | yes | `0` |
| `status` | character varying(50) | yes | `'pending'::character varying` |
| `submitted_by` | uuid | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

### `gad_staff_parity_data`  (15 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `academic_year` | character varying(20) | NO | — |
| `department` | character varying(100) | NO | — |
| `staff_category` | character varying(50) | NO | — |
| `total_staff` | integer | yes | `0` |
| `male_count` | integer | yes | `0` |
| `female_count` | integer | yes | `0` |
| `gender_balance` | character varying(50) | yes | — |
| `status` | character varying(50) | yes | `'pending'::character varying` |
| `submitted_by` | uuid | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

### `gad_student_parity_data`  (14 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `academic_year` | character varying(20) | NO | — |
| `program` | character varying(100) | NO | — |
| `admission_male` | integer | yes | `0` |
| `admission_female` | integer | yes | `0` |
| `graduation_male` | integer | yes | `0` |
| `graduation_female` | integer | yes | `0` |
| `status` | character varying(50) | yes | `'pending'::character varying` |
| `submitted_by` | uuid | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

## Audit / Records / System

### `activity_logs`  (9 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | yes | — |
| `user_email` | character varying(255) | NO | — |
| `user_name` | character varying(255) | NO | — |
| `action` | character varying(50) | NO | — |
| `entity_type` | character varying(100) | NO | — |
| `entity_id` | uuid | NO | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |

### `documents`  (25 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `documentable_type` | character varying(100) | NO | — |
| `documentable_id` | uuid | NO | — |
| `document_type` | character varying(100) | NO | — |
| `file_name` | character varying(255) | NO | — |
| `file_path` | character varying(255) | NO | — |
| `file_size` | integer | NO | — |
| `mime_type` | character varying(100) | NO | — |
| `description` | text | yes | — |
| `version` | integer | yes | `1` |
| `category` | character varying(50) | yes | — |
| `extracted_text` | text | yes | — |
| `chunks` | jsonb | yes | — |
| `processed_at` | timestamp with time zone | yes | — |
| `status` | character varying(50) | yes | `'ready'::character varying` |
| `uploaded_by` | uuid | NO | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `created_by` | uuid | yes | — |
| `updated_by` | uuid | yes | — |
| `lifecycle_status` | character varying(20) | NO | `'ACTIVE'::character varying` |
| `folder_id` | uuid | yes | — |

### `media`  (27 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `mediable_type` | character varying(100) | NO | — |
| `mediable_id` | uuid | NO | — |
| `media_type` | public.media_type_enum | NO | — |
| `file_name` | character varying(255) | NO | — |
| `file_path` | character varying(255) | NO | — |
| `file_size` | integer | NO | — |
| `mime_type` | character varying(100) | NO | — |
| `title` | character varying(255) | yes | — |
| `description` | text | yes | — |
| `alt_text` | character varying(255) | yes | — |
| `is_featured` | boolean | yes | `false` |
| `thumbnail_url` | character varying(255) | yes | — |
| `dimensions` | jsonb | yes | — |
| `tags` | jsonb | yes | — |
| `capture_date` | date | yes | — |
| `display_order` | integer | yes | `0` |
| `location` | jsonb | yes | — |
| `project_type` | character varying(50) | yes | — |
| `uploaded_by` | uuid | NO | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `created_by` | uuid | yes | — |
| `updated_by` | uuid | yes | — |

### `mikro_orm_migrations`  (3 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | integer | NO | — |
| `name` | character varying(255) | yes | — |
| `executed_at` | timestamp with time zone | yes | `now()` |

### `record_assignments`  (12 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `module` | character varying(50) | NO | — |
| `record_id` | uuid | NO | — |
| `user_id` | uuid | NO | — |
| `assigned_at` | timestamp with time zone | yes | `now()` |
| `assigned_by` | uuid | yes | — |
| `role` | character varying(100) | yes | — |
| `department` | character varying(150) | yes | — |
| `phone` | character varying(30) | yes | — |
| `personnel_category` | character varying(50) | yes | — |
| `project_role` | character varying(100) | yes | — |
| `permissions` | jsonb | yes | — |

### `system_settings`  (14 columns · PK `id`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `setting_key` | character varying(100) | NO | — |
| `setting_value` | text | yes | — |
| `setting_group` | character varying(50) | NO | — |
| `data_type` | public.setting_data_type_enum | NO | — |
| `is_public` | boolean | yes | `false` |
| `description` | text | yes | — |
| `updated_by` | uuid | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `deleted_by` | uuid | yes | — |
| `created_by` | uuid | yes | — |
