import { Migration } from '@mikro-orm/migrations';

export class Migration20260915030158 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "rooms" drop constraint if exists "rooms_building_id_fkey";`,
    );

    this.addSql(
      `alter table "room_assessments" drop constraint if exists "room_assessments_room_id_fkey";`,
    );

    this.addSql(`drop table if exists "audit_trail" cascade;`);

    this.addSql(`drop table if exists "buildings" cascade;`);

    this.addSql(
      `drop table if exists "construction_project_accomplishment_records" cascade;`,
    );

    this.addSql(
      `drop table if exists "construction_project_actual_accomplishment_records" cascade;`,
    );

    this.addSql(
      `drop table if exists "construction_project_assignments" cascade;`,
    );

    this.addSql(
      `drop table if exists "construction_project_financial_reports" cascade;`,
    );

    this.addSql(
      `drop table if exists "construction_project_milestones" cascade;`,
    );

    this.addSql(`drop table if exists "construction_project_phases" cascade;`);

    this.addSql(
      `drop table if exists "construction_project_progress" cascade;`,
    );

    this.addSql(
      `drop table if exists "construction_project_progress_summaries" cascade;`,
    );

    this.addSql(
      `drop table if exists "construction_project_team_members" cascade;`,
    );

    this.addSql(`drop table if exists "downloadable_forms" cascade;`);

    this.addSql(`drop table if exists "forms_inventory" cascade;`);

    this.addSql(`drop table if exists "gad_yearly_profiles" cascade;`);

    this.addSql(`drop table if exists "notifications" cascade;`);

    this.addSql(`drop table if exists "policies" cascade;`);

    this.addSql(
      `drop table if exists "repair_project_accomplishment_records" cascade;`,
    );

    this.addSql(
      `drop table if exists "repair_project_actual_accomplishment_records" cascade;`,
    );

    this.addSql(
      `drop table if exists "repair_project_financial_reports" cascade;`,
    );

    this.addSql(`drop table if exists "repair_project_milestones" cascade;`);

    this.addSql(
      `drop table if exists "repair_project_progress_summaries" cascade;`,
    );

    this.addSql(`drop table if exists "room_assessments" cascade;`);

    this.addSql(`drop table if exists "rooms" cascade;`);

    this.addSql(
      `drop table if exists "university_operations_personnel" cascade;`,
    );

    this.addSql(`drop table if exists "university_statistics" cascade;`);

    this.addSql(`drop table if exists "user_page_permissions" cascade;`);

    this.addSql(
      `alter table "construction_diary_entries" drop constraint if exists "construction_diary_entries_author_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_diary_entries" drop constraint if exists "construction_diary_entries_project_id_fkey";`,
    );

    this.addSql(
      `alter table "construction_document_checklist" drop constraint if exists "construction_document_checklist_submission_status_check";`,
    );

    this.addSql(
      `alter table "construction_document_checklist" drop constraint if exists "construction_document_checklist_document_type_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_document_checklist" drop constraint if exists "construction_document_checklist_linked_document_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_document_checklist" drop constraint if exists "construction_document_checklist_project_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_document_checklist" drop constraint if exists "construction_document_checklist_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "construction_document_checklist" drop constraint if exists "construction_document_checklist_submitted_by_fkey";`,
    );

    this.addSql(
      `alter table "construction_document_folders" drop constraint if exists "construction_document_folders_created_by_fkey";`,
    );
    this.addSql(
      `alter table "construction_document_folders" drop constraint if exists "construction_document_folders_deleted_by_fkey";`,
    );
    this.addSql(
      `alter table "construction_document_folders" drop constraint if exists "construction_document_folders_parent_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_document_folders" drop constraint if exists "construction_document_folders_project_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_document_folders" drop constraint if exists "construction_document_folders_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "construction_document_submissions" drop constraint if exists "construction_document_submissions_checklist_item_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_document_submissions" drop constraint if exists "construction_document_submissions_document_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_document_submissions" drop constraint if exists "construction_document_submissions_submitted_by_fkey";`,
    );

    this.addSql(
      `alter table "construction_document_types" drop constraint if exists "construction_document_types_group_code_check";`,
    );

    this.addSql(
      `alter table "construction_gallery" drop constraint if exists "construction_gallery_category_check";`,
    );

    this.addSql(
      `alter table "construction_gallery" drop constraint if exists "construction_gallery_project_id_fkey";`,
    );

    this.addSql(
      `alter table "construction_milestones" drop constraint if exists "construction_milestones_project_id_fkey";`,
    );

    this.addSql(
      `alter table "construction_mov_entries" drop constraint if exists "construction_mov_entries_related_entity_type_check";`,
    );
    this.addSql(
      `alter table "construction_mov_entries" drop constraint if exists "construction_mov_entries_verification_status_check";`,
    );

    this.addSql(
      `alter table "construction_mov_entries" drop constraint if exists "construction_mov_entries_project_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_mov_entries" drop constraint if exists "construction_mov_entries_uploaded_by_fkey";`,
    );

    this.addSql(
      `alter table "construction_progress_reports" drop constraint if exists "construction_progress_reports_project_id_fkey";`,
    );

    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_project_status_category_check";`,
    );

    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_assigned_to_fkey";`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_contractor_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_created_by_fkey";`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_deleted_by_fkey";`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_funding_source_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_project_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_subcategory_id_fkey";`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_submitted_by_fkey";`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "construction_revision_orders" drop constraint if exists "construction_revision_orders_project_id_fkey";`,
    );

    this.addSql(
      `alter table "construction_subcategories" drop constraint if exists "construction_subcategories_created_by_fkey";`,
    );
    this.addSql(
      `alter table "construction_subcategories" drop constraint if exists "construction_subcategories_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "construction_timeline_entries" drop constraint if exists "construction_timeline_entries_entry_type_check";`,
    );

    this.addSql(
      `alter table "construction_timeline_entries" drop constraint if exists "construction_timeline_entries_created_by_fkey";`,
    );
    this.addSql(
      `alter table "construction_timeline_entries" drop constraint if exists "construction_timeline_entries_project_id_fkey";`,
    );

    this.addSql(
      `alter table "contractors" drop constraint if exists "fk_contractors_created_by";`,
    );
    this.addSql(
      `alter table "contractors" drop constraint if exists "fk_contractors_updated_by";`,
    );

    this.addSql(
      `alter table "contractor_invite_tokens" drop constraint if exists "cit_accepted_by_fkey";`,
    );
    this.addSql(
      `alter table "contractor_invite_tokens" drop constraint if exists "contractor_invite_tokens_created_by_fkey";`,
    );
    this.addSql(
      `alter table "contractor_invite_tokens" drop constraint if exists "contractor_invite_tokens_project_id_fkey";`,
    );

    this.addSql(
      `alter table "departments" drop constraint if exists "departments_created_by_fkey";`,
    );
    this.addSql(
      `alter table "departments" drop constraint if exists "departments_head_id_fkey";`,
    );
    this.addSql(
      `alter table "departments" drop constraint if exists "departments_parent_id_fkey";`,
    );
    this.addSql(
      `alter table "departments" drop constraint if exists "departments_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "documents" drop constraint if exists "documents_lifecycle_status_check";`,
    );

    this.addSql(
      `alter table "documents" drop constraint if exists "documents_created_by_fkey";`,
    );
    this.addSql(
      `alter table "documents" drop constraint if exists "documents_deleted_by_fkey";`,
    );
    this.addSql(
      `alter table "documents" drop constraint if exists "documents_folder_id_fkey";`,
    );
    this.addSql(
      `alter table "documents" drop constraint if exists "documents_updated_by_fkey";`,
    );
    this.addSql(
      `alter table "documents" drop constraint if exists "documents_uploaded_by_fkey";`,
    );

    this.addSql(
      `alter table "funding_sources" drop constraint if exists "fk_funding_sources_created_by";`,
    );
    this.addSql(
      `alter table "funding_sources" drop constraint if exists "fk_funding_sources_updated_by";`,
    );

    this.addSql(
      `alter table "gad_budget_plans" drop constraint if exists "gad_budget_plans_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "gad_budget_plans" drop constraint if exists "gad_budget_plans_submitted_by_fkey";`,
    );

    this.addSql(
      `alter table "gad_faculty_parity_data" drop constraint if exists "gad_faculty_parity_data_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "gad_faculty_parity_data" drop constraint if exists "gad_faculty_parity_data_submitted_by_fkey";`,
    );

    this.addSql(
      `alter table "gad_gpb_accomplishments" drop constraint if exists "gad_gpb_accomplishments_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "gad_gpb_accomplishments" drop constraint if exists "gad_gpb_accomplishments_submitted_by_fkey";`,
    );

    this.addSql(
      `alter table "gad_indigenous_parity_data" drop constraint if exists "gad_indigenous_parity_data_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "gad_indigenous_parity_data" drop constraint if exists "gad_indigenous_parity_data_submitted_by_fkey";`,
    );

    this.addSql(
      `alter table "gad_pwd_parity_data" drop constraint if exists "gad_pwd_parity_data_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "gad_pwd_parity_data" drop constraint if exists "gad_pwd_parity_data_submitted_by_fkey";`,
    );

    this.addSql(
      `alter table "gad_staff_parity_data" drop constraint if exists "gad_staff_parity_data_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "gad_staff_parity_data" drop constraint if exists "gad_staff_parity_data_submitted_by_fkey";`,
    );

    this.addSql(
      `alter table "gad_student_parity_data" drop constraint if exists "gad_student_parity_data_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "gad_student_parity_data" drop constraint if exists "gad_student_parity_data_submitted_by_fkey";`,
    );

    this.addSql(`alter table "media" drop constraint if exists "media_created_by_fkey";`);
    this.addSql(`alter table "media" drop constraint if exists "media_deleted_by_fkey";`);
    this.addSql(`alter table "media" drop constraint if exists "media_updated_by_fkey";`);
    this.addSql(
      `alter table "media" drop constraint if exists "media_uploaded_by_fkey";`,
    );

    this.addSql(
      `alter table "operation_financials" drop constraint if exists "operation_financials_quarter_check";`,
    );
    this.addSql(
      `alter table "operation_financials" drop constraint if exists "operation_financials_status_check";`,
    );
    this.addSql(
      `alter table "operation_financials" drop constraint if exists "operation_financials_expense_class_check";`,
    );

    this.addSql(
      `alter table "operation_financials" drop constraint if exists "operation_financials_created_by_fkey";`,
    );
    this.addSql(
      `alter table "operation_financials" drop constraint if exists "operation_financials_operation_id_fkey";`,
    );
    this.addSql(
      `alter table "operation_financials" drop constraint if exists "operation_financials_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "operation_indicators" drop constraint if exists "operation_indicators_status_check";`,
    );
    this.addSql(
      `alter table "operation_indicators" drop constraint if exists "operation_indicators_reported_quarter_check";`,
    );

    this.addSql(
      `alter table "operation_indicators" drop constraint if exists "operation_indicators_created_by_fkey";`,
    );
    this.addSql(
      `alter table "operation_indicators" drop constraint if exists "operation_indicators_operation_id_fkey";`,
    );
    this.addSql(
      `alter table "operation_indicators" drop constraint if exists "operation_indicators_pillar_indicator_id_fkey";`,
    );
    this.addSql(
      `alter table "operation_indicators" drop constraint if exists "operation_indicators_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "operation_organizational_info" drop constraint if exists "operation_organizational_info_created_by_fkey";`,
    );
    this.addSql(
      `alter table "operation_organizational_info" drop constraint if exists "operation_organizational_info_operation_id_fkey";`,
    );
    this.addSql(
      `alter table "operation_organizational_info" drop constraint if exists "operation_organizational_info_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "password_reset_requests" drop constraint if exists "password_reset_requests_status_check";`,
    );

    this.addSql(
      `alter table "password_reset_requests" drop constraint if exists "password_reset_requests_completed_by_fkey";`,
    );

    this.addSql(
      `alter table "pillar_indicator_taxonomy" drop constraint if exists "pillar_indicator_taxonomy_indicator_type_check";`,
    );
    this.addSql(
      `alter table "pillar_indicator_taxonomy" drop constraint if exists "pillar_indicator_taxonomy_unit_type_check";`,
    );

    this.addSql(
      `alter table "projects" drop constraint if exists "projects_created_by_fkey";`,
    );
    this.addSql(
      `alter table "projects" drop constraint if exists "projects_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "project_contractor_assignments" drop constraint if exists "pca_user_id_fkey";`,
    );
    this.addSql(
      `alter table "project_contractor_assignments" drop constraint if exists "project_contractor_assignments_assigned_by_fkey";`,
    );
    this.addSql(
      `alter table "project_contractor_assignments" drop constraint if exists "project_contractor_assignments_invite_token_id_fkey";`,
    );
    this.addSql(
      `alter table "project_contractor_assignments" drop constraint if exists "project_contractor_assignments_project_id_fkey";`,
    );

    this.addSql(
      `alter table "quarterly_reports" drop constraint if exists "quarterly_reports_quarter_check";`,
    );
    this.addSql(
      `alter table "quarterly_reports" drop constraint if exists "quarterly_reports_publication_status_check";`,
    );

    this.addSql(
      `alter table "quarterly_reports" drop constraint if exists "quarterly_reports_created_by_fkey";`,
    );
    this.addSql(
      `alter table "quarterly_reports" drop constraint if exists "quarterly_reports_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "quarterly_reports" drop constraint if exists "quarterly_reports_submitted_by_fkey";`,
    );
    this.addSql(
      `alter table "quarterly_reports" drop constraint if exists "quarterly_reports_unlock_requested_by_fkey";`,
    );
    this.addSql(
      `alter table "quarterly_reports" drop constraint if exists "quarterly_reports_unlocked_by_fkey";`,
    );

    this.addSql(
      `alter table "quarterly_report_submissions" drop constraint if exists "quarterly_report_submissions_event_type_check";`,
    );

    this.addSql(
      `alter table "quarterly_report_submissions" drop constraint if exists "quarterly_report_submissions_actioned_by_fkey";`,
    );
    this.addSql(
      `alter table "quarterly_report_submissions" drop constraint if exists "quarterly_report_submissions_quarterly_report_id_fkey";`,
    );
    this.addSql(
      `alter table "quarterly_report_submissions" drop constraint if exists "quarterly_report_submissions_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "quarterly_report_submissions" drop constraint if exists "quarterly_report_submissions_submitted_by_fkey";`,
    );

    this.addSql(
      `alter table "record_assignments" drop constraint if exists "record_assignments_module_check";`,
    );

    this.addSql(
      `alter table "record_assignments" drop constraint if exists "record_assignments_assigned_by_fkey";`,
    );
    this.addSql(
      `alter table "record_assignments" drop constraint if exists "record_assignments_user_id_fkey";`,
    );

    this.addSql(
      `alter table "repair_pow_items" drop constraint if exists "repair_pow_items_deleted_by_fkey";`,
    );
    this.addSql(
      `alter table "repair_pow_items" drop constraint if exists "repair_pow_items_repair_project_id_fkey";`,
    );

    this.addSql(
      `alter table "repair_projects" drop constraint if exists "fk_deleted_by_user";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_assigned_to_fkey";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_contractor_id_fkey";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_created_by_fkey";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_facility_id_fkey";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_inspector_id_fkey";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_project_id_fkey";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_project_manager_id_fkey";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_repair_type_id_fkey";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_submitted_by_fkey";`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "repair_project_phases" drop constraint if exists "repair_project_phases_repair_project_id_fkey";`,
    );

    this.addSql(
      `alter table "repair_project_team_members" drop constraint if exists "repair_project_team_members_repair_project_id_fkey";`,
    );
    this.addSql(
      `alter table "repair_project_team_members" drop constraint if exists "repair_project_team_members_user_id_fkey";`,
    );

    this.addSql(
      `alter table "repair_types" drop constraint if exists "repair_types_created_by_fkey";`,
    );
    this.addSql(
      `alter table "repair_types" drop constraint if exists "repair_types_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "role_permissions" drop constraint if exists "role_permissions_created_by_fkey";`,
    );
    this.addSql(
      `alter table "role_permissions" drop constraint if exists "role_permissions_permission_id_fkey";`,
    );
    this.addSql(
      `alter table "role_permissions" drop constraint if exists "role_permissions_role_id_fkey";`,
    );

    this.addSql(
      `alter table "system_settings" drop constraint if exists "system_settings_created_by_fkey";`,
    );
    this.addSql(
      `alter table "system_settings" drop constraint if exists "system_settings_updated_by_fkey";`,
    );

    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_status_q1_check";`,
    );
    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_status_q2_check";`,
    );
    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_status_q3_check";`,
    );
    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_status_q4_check";`,
    );

    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_assigned_to_fkey";`,
    );
    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_coordinator_id_fkey";`,
    );
    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_created_by_fkey";`,
    );
    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_reviewed_by_fkey";`,
    );
    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_submitted_by_fkey";`,
    );
    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_updated_by_fkey";`,
    );

    this.addSql(`alter table "users" drop constraint if exists "users_created_by_fkey";`);
    this.addSql(`alter table "users" drop constraint if exists "users_updated_by_fkey";`);

    this.addSql(
      `alter table "activity_logs" drop constraint if exists "activity_logs_user_id_fkey";`,
    );

    this.addSql(
      `alter table "user_departments" drop constraint if exists "user_departments_created_by_fkey";`,
    );
    this.addSql(
      `alter table "user_departments" drop constraint if exists "user_departments_department_id_fkey";`,
    );
    this.addSql(
      `alter table "user_departments" drop constraint if exists "user_departments_user_id_fkey";`,
    );

    this.addSql(
      `alter table "user_module_assignments" drop constraint if exists "user_module_assignments_assigned_by_fkey";`,
    );
    this.addSql(
      `alter table "user_module_assignments" drop constraint if exists "user_module_assignments_user_id_fkey";`,
    );

    this.addSql(
      `alter table "user_permission_overrides" drop constraint if exists "user_permission_overrides_created_by_fkey";`,
    );
    this.addSql(
      `alter table "user_permission_overrides" drop constraint if exists "user_permission_overrides_updated_by_fkey";`,
    );
    this.addSql(
      `alter table "user_permission_overrides" drop constraint if exists "user_permission_overrides_user_id_fkey";`,
    );

    this.addSql(
      `alter table "user_pillar_assignments" drop constraint if exists "user_pillar_assignments_pillar_type_check";`,
    );

    this.addSql(
      `alter table "user_pillar_assignments" drop constraint if exists "user_pillar_assignments_assigned_by_fkey";`,
    );
    this.addSql(
      `alter table "user_pillar_assignments" drop constraint if exists "user_pillar_assignments_user_id_fkey";`,
    );

    this.addSql(
      `alter table "user_roles" drop constraint if exists "user_roles_assigned_by_fkey";`,
    );
    this.addSql(
      `alter table "user_roles" drop constraint if exists "user_roles_created_by_fkey";`,
    );
    this.addSql(
      `alter table "user_roles" drop constraint if exists "user_roles_role_id_fkey";`,
    );
    this.addSql(
      `alter table "user_roles" drop constraint if exists "user_roles_user_id_fkey";`,
    );

    this.addSql(`drop index if exists "idx_diary_entries_entry_date";`);
    this.addSql(`drop index if exists "idx_diary_entries_project_id";`);

    this.addSql(
      `alter table "construction_document_checklist" drop constraint if exists "construction_document_checklist_project_id_document_type_id_key";`,
    );
    this.addSql(`drop index if exists "idx_doc_checklist_project";`);
    this.addSql(`drop index if exists "idx_doc_checklist_status";`);

    this.addSql(
      `alter table "construction_document_checklist" alter column "submission_status" type varchar(30) using ("submission_status"::varchar(30));`,
    );

    this.addSql(`drop index if exists "idx_construction_document_folders_parent";`);
    this.addSql(`drop index if exists "idx_construction_document_folders_project";`);

    this.addSql(`drop index if exists "idx_doc_submissions_checklist";`);
    this.addSql(`drop index if exists "idx_doc_submissions_project";`);

    this.addSql(
      `alter table "construction_document_types" alter column "group_code" type varchar(20) using ("group_code"::varchar(20));`,
    );
    this.addSql(
      `alter table "construction_document_types" drop constraint if exists "construction_document_types_type_code_key";`,
    );
    this.addSql(
      `alter table "construction_document_types" add constraint "construction_document_types_type_code_unique" unique ("type_code");`,
    );

    this.addSql(
      `alter table "construction_gallery" alter column "category" type varchar(50) using ("category"::varchar(50));`,
    );

    this.addSql(
      `alter table "construction_milestones" alter column "progress" type decimal(5,2) using ("progress"::decimal(5,2));`,
    );
    this.addSql(
      `alter table "construction_milestones" alter column "progress" set default 0;`,
    );

    this.addSql(`drop index if exists "idx_mov_entries_entity";`);
    this.addSql(`drop index if exists "idx_mov_entries_project_id";`);

    this.addSql(
      `alter table "construction_mov_entries" alter column "related_entity_type" type varchar(20) using ("related_entity_type"::varchar(20));`,
    );
    this.addSql(
      `alter table "construction_mov_entries" alter column "verification_status" type varchar(20) using ("verification_status"::varchar(20));`,
    );

    this.addSql(`drop index if exists "idx_cpr_project_date";`);

    this.addSql(`drop index if exists "idx_conproj_campus";`);
    this.addSql(`drop index if exists "idx_conproj_contractor";`);
    this.addSql(`drop index if exists "idx_conproj_project_id";`);
    this.addSql(`drop index if exists "idx_conproj_start_date";`);
    this.addSql(`drop index if exists "idx_conproj_status";`);
    this.addSql(`drop index if exists "idx_conproj_target_date";`);
    this.addSql(`drop index if exists "idx_construction_projects_assigned_to";`);
    this.addSql(`drop index if exists "idx_construction_projects_campus";`);
    this.addSql(`drop index if exists "idx_construction_projects_campus_status";`);
    this.addSql(`drop index if exists "idx_construction_projects_created_by";`);
    this.addSql(`drop index if exists "idx_construction_projects_publication_status";`);
    this.addSql(
      `alter table "construction_projects" drop column "location_coordinates", drop column "risk_register", drop column "escalation_records";`,
    );

    this.addSql(
      `alter table "construction_projects" alter column "infra_project_uid" type bigint using ("infra_project_uid"::bigint);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "infra_project_uid" set default nextval('construction_projects_infra_project_uid_seq'::regclass);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "campus" type varchar(50) using ("campus"::varchar(50));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "status" type varchar(50) using ("status"::varchar(50));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "physical_progress" type decimal(5,2) using ("physical_progress"::decimal(5,2));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "physical_progress" set default 0;`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "financial_progress" type decimal(5,2) using ("financial_progress"::decimal(5,2));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "financial_progress" set default 0;`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "timeline_data" drop default;`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "timeline_data" type jsonb using ("timeline_data"::jsonb);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "gallery_images" drop default;`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "gallery_images" type jsonb using ("gallery_images"::jsonb);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "publication_status" drop default;`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "publication_status" type varchar(50) using ("publication_status"::varchar(50));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "publication_status" set default 'PUBLISHED';`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "target_physical_progress" type decimal(5,2) using ("target_physical_progress"::decimal(5,2));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "target_financial_progress" type decimal(5,2) using ("target_financial_progress"::decimal(5,2));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "project_status_category" type varchar(50) using ("project_status_category"::varchar(50));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "custom_key_sections" type jsonb using ("custom_key_sections"::jsonb);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "sdg_goals" drop default;`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "sdg_goals" type jsonb using ("sdg_goals"::jsonb);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "custom_supporting_sections" type jsonb using ("custom_supporting_sections"::jsonb);`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_infra_project_uid_key";`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_infra_project_uid_unique" unique ("infra_project_uid");`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_project_id_key";`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_project_id_unique" unique ("project_id");`,
    );

    this.addSql(`drop index if exists "idx_cro_project_date";`);
    this.addSql(`drop index if exists "idx_cro_project_revnum";`);

    this.addSql(
      `alter table "construction_subcategories" drop constraint if exists "construction_subcategories_name_key";`,
    );

    this.addSql(`drop index if exists "idx_timeline_entries_entry_date";`);
    this.addSql(`drop index if exists "idx_timeline_entries_project_id";`);

    this.addSql(
      `alter table "construction_timeline_entries" alter column "entry_type" type varchar(20) using ("entry_type"::varchar(20));`,
    );

    this.addSql(`drop index if exists "idx_contractors_name";`);
    this.addSql(`drop index if exists "idx_contractors_status";`);

    this.addSql(
      `alter table "contractors" alter column "status" type varchar(50) using ("status"::varchar(50));`,
    );

    this.addSql(`drop index if exists "idx_contractor_invite_token";`);

    this.addSql(
      `alter table "contractor_invite_tokens" drop constraint if exists "contractor_invite_tokens_token_key";`,
    );
    this.addSql(
      `alter table "contractor_invite_tokens" add constraint "contractor_invite_tokens_token_unique" unique ("token");`,
    );

    this.addSql(
      `alter table "contractor_users" drop constraint if exists "contractor_users_email_key";`,
    );
    this.addSql(
      `alter table "contractor_users" add constraint "contractor_users_email_unique" unique ("email");`,
    );
    this.addSql(
      `alter table "contractor_users" drop constraint if exists "contractor_users_google_id_key";`,
    );
    this.addSql(
      `alter table "contractor_users" add constraint "contractor_users_google_id_unique" unique ("google_id");`,
    );

    this.addSql(`drop index if exists "idx_departments_head";`);
    this.addSql(`drop index if exists "idx_departments_name";`);
    this.addSql(`drop index if exists "idx_departments_parent";`);
    this.addSql(`drop index if exists "idx_departments_status";`);

    this.addSql(
      `alter table "departments" alter column "status" drop default;`,
    );
    this.addSql(
      `alter table "departments" alter column "status" type varchar(50) using ("status"::varchar(50));`,
    );
    this.addSql(
      `alter table "departments" alter column "status" set default 'ACTIVE';`,
    );
    this.addSql(
      `alter table "departments" drop constraint if exists "departments_code_key";`,
    );
    this.addSql(
      `alter table "departments" add constraint "departments_code_unique" unique ("code");`,
    );

    this.addSql(`drop index if exists "idx_documents_docpair";`);
    this.addSql(`drop index if exists "idx_documents_folder_id";`);
    this.addSql(`drop index if exists "idx_documents_type";`);
    this.addSql(`drop index if exists "idx_documents_uploader";`);

    this.addSql(
      `alter table "documents" alter column "lifecycle_status" type varchar(20) using ("lifecycle_status"::varchar(20));`,
    );

    this.addSql(`alter table "facilities" alter column "campus" drop default;`);
    this.addSql(
      `alter table "facilities" alter column "campus" type varchar(50) using ("campus"::varchar(50));`,
    );
    this.addSql(`alter table "facilities" alter column "campus" set default 'MAIN';`);
    this.addSql(
      `alter table "facilities" alter column "condition_rating" drop default;`,
    );
    this.addSql(
      `alter table "facilities" alter column "condition_rating" type varchar(50) using ("condition_rating"::varchar(50));`,
    );
    this.addSql(
      `alter table "facilities" alter column "condition_rating" set default 'GOOD';`,
    );

    this.addSql(`drop index if exists "idx_fiscal_years_active";`);

    this.addSql(
      `alter table "funding_sources" drop constraint if exists "funding_sources_name_key";`,
    );

    this.addSql(`drop index if exists "homepage_items_page_section_index";`);
    this.addSql(`drop index if exists "homepage_items_section_order_index";`);

    this.addSql(`drop index if exists "idx_media_featured";`);
    this.addSql(`drop index if exists "idx_media_pair";`);
    this.addSql(`drop index if exists "idx_media_type";`);
    this.addSql(`drop index if exists "idx_media_uploader";`);

    this.addSql(
      `alter table "media" alter column "media_type" type media_type_enum using ("media_type"::media_type_enum);`,
    );

    this.addSql(`drop index if exists "idx_of_department";`);
    this.addSql(`drop index if exists "idx_of_expense_class";`);
    this.addSql(`drop index if exists "idx_of_fund_type";`);
    this.addSql(`drop index if exists "idx_of_fund_type_operation";`);
    this.addSql(`drop index if exists "idx_of_operation";`);
    this.addSql(`drop index if exists "idx_of_operation_expense";`);
    this.addSql(`drop index if exists "idx_of_program";`);
    this.addSql(`drop index if exists "idx_of_quarter";`);
    this.addSql(`drop index if exists "idx_of_status";`);
    this.addSql(`drop index if exists "idx_of_year";`);
    this.addSql(
      `alter table "operation_financials" drop constraint if exists "operation_financials_operation_id_fiscal_year_quarter_opera_key";`,
    );

    this.addSql(
      `alter table "operation_financials" alter column "quarter" type varchar(2) using ("quarter"::varchar(2));`,
    );
    this.addSql(
      `alter table "operation_financials" alter column "status" type varchar(20) using ("status"::varchar(20));`,
    );
    this.addSql(
      `alter table "operation_financials" alter column "fund_type" type varchar(50) using ("fund_type"::varchar(50));`,
    );
    this.addSql(
      `alter table "operation_financials" alter column "expense_class" type varchar(4) using ("expense_class"::varchar(4));`,
    );

    this.addSql(`drop index if exists "idx_oi_code";`);
    this.addSql(`drop index if exists "idx_oi_created_by";`);
    this.addSql(`drop index if exists "idx_oi_operation";`);
    this.addSql(`drop index if exists "idx_oi_pillar_indicator";`);
    this.addSql(`drop index if exists "idx_oi_reported_quarter";`);
    this.addSql(`drop index if exists "idx_oi_status";`);
    this.addSql(`drop index if exists "idx_oi_subcategory_data";`);
    this.addSql(`drop index if exists "idx_oi_uacs";`);
    this.addSql(`drop index if exists "idx_oi_year";`);
    this.addSql(`drop index if exists "idx_operation_indicators_pillar_indicator_id";`);
    this.addSql(`drop index if exists "uq_oi_quarterly_per_quarter";`);
    this.addSql(`drop index if exists "uq_operation_indicators_orphan";`);

    this.addSql(
      `alter table "operation_indicators" alter column "status" type varchar(20) using ("status"::varchar(20));`,
    );
    this.addSql(
      `alter table "operation_indicators" alter column "reported_quarter" type varchar(2) using ("reported_quarter"::varchar(2));`,
    );
    this.addSql(
      `alter table "operation_indicators" alter column "override_total_target" drop default;`,
    );
    this.addSql(
      `alter table "operation_indicators" alter column "override_total_target" type numeric(15,4) using ("override_total_target"::numeric(15,4));`,
    );
    this.addSql(
      `alter table "operation_indicators" alter column "override_total_actual" drop default;`,
    );
    this.addSql(
      `alter table "operation_indicators" alter column "override_total_actual" type numeric(15,4) using ("override_total_actual"::numeric(15,4));`,
    );

    this.addSql(`drop index if exists "idx_ooi_department";`);
    this.addSql(`drop index if exists "idx_ooi_operation";`);
    this.addSql(`drop index if exists "idx_ooi_org_code";`);

    this.addSql(
      `alter table "operation_organizational_info" drop constraint if exists "operation_organizational_info_operation_id_key";`,
    );
    this.addSql(
      `alter table "operation_organizational_info" add constraint "operation_organizational_info_operation_id_unique" unique ("operation_id");`,
    );

    this.addSql(`drop index if exists "idx_prr_status";`);

    this.addSql(
      `alter table "password_reset_requests" alter column "status" type text using ("status"::text);`,
    );

    this.addSql(`drop index if exists "idx_permissions_name";`);
    this.addSql(`drop index if exists "idx_permissions_resource";`);

    this.addSql(
      `alter table "permissions" drop constraint if exists "permissions_name_key";`,
    );
    this.addSql(
      `alter table "permissions" add constraint "permissions_name_unique" unique ("name");`,
    );

    this.addSql(`drop index if exists "idx_pit_active";`);
    this.addSql(`drop index if exists "idx_pit_oo";`);
    this.addSql(`drop index if exists "idx_pit_order";`);
    this.addSql(`drop index if exists "idx_pit_pillar_type";`);
    this.addSql(
      `alter table "pillar_indicator_taxonomy" drop constraint if exists "uniq_pillar_indicator";`,
    );
    this.addSql(
      `alter table "pillar_indicator_taxonomy" drop column "organizational_outcome";`,
    );

    this.addSql(
      `alter table "pillar_indicator_taxonomy" alter column "pillar_type" type varchar(50) using ("pillar_type"::varchar(50));`,
    );
    this.addSql(
      `alter table "pillar_indicator_taxonomy" alter column "indicator_type" type varchar(20) using ("indicator_type"::varchar(20));`,
    );
    this.addSql(
      `alter table "pillar_indicator_taxonomy" alter column "unit_type" type varchar(20) using ("unit_type"::varchar(20));`,
    );

    this.addSql(`drop index if exists "idx_projects_campus";`);
    this.addSql(`drop index if exists "idx_projects_status";`);
    this.addSql(`drop index if exists "idx_projects_type";`);

    this.addSql(
      `alter table "projects" alter column "project_type" type varchar(50) using ("project_type"::varchar(50));`,
    );
    this.addSql(
      `alter table "projects" alter column "status" type varchar(50) using ("status"::varchar(50));`,
    );
    this.addSql(
      `alter table "projects" alter column "campus" type varchar(50) using ("campus"::varchar(50));`,
    );

    this.addSql(`drop index if exists "idx_contractor_assignments_project";`);
    this.addSql(
      `alter table "project_contractor_assignments" drop constraint if exists "pca_project_user_unique";`,
    );
    this.addSql(
      `alter table "project_contractor_assignments" drop constraint if exists "project_contractor_assignment_project_id_contractor_user_id_key";`,
    );

    this.addSql(`drop index if exists "idx_quarterly_reports_created_by";`);
    this.addSql(`drop index if exists "idx_quarterly_reports_fiscal_year";`);
    this.addSql(`drop index if exists "idx_quarterly_reports_publication_status";`);
    this.addSql(`drop index if exists "idx_quarterly_reports_unique_active";`);
    this.addSql(`drop index if exists "idx_quarterly_reports_unlock_requested";`);

    this.addSql(
      `alter table "quarterly_reports" alter column "quarter" type varchar(2) using ("quarter"::varchar(2));`,
    );
    this.addSql(
      `alter table "quarterly_reports" alter column "publication_status" type varchar(20) using ("publication_status"::varchar(20));`,
    );

    this.addSql(`drop index if exists "idx_qr_submissions_fiscal";`);
    this.addSql(`drop index if exists "idx_qr_submissions_report";`);

    this.addSql(
      `alter table "quarterly_report_submissions" alter column "event_type" type varchar(30) using ("event_type"::varchar(30));`,
    );

    this.addSql(`drop index if exists "idx_record_assignments_assigned_at";`);
    this.addSql(`drop index if exists "idx_record_assignments_module_record";`);
    this.addSql(`drop index if exists "idx_record_assignments_record";`);
    this.addSql(`drop index if exists "idx_record_assignments_user";`);
    this.addSql(
      `alter table "record_assignments" drop constraint if exists "record_assignments_module_record_id_user_id_key";`,
    );

    this.addSql(
      `alter table "record_assignments" alter column "module" type varchar(50) using ("module"::varchar(50));`,
    );

    this.addSql(`drop index if exists "idx_rpi_category";`);
    this.addSql(`drop index if exists "idx_rpi_date";`);
    this.addSql(`drop index if exists "idx_rpi_phase";`);
    this.addSql(`drop index if exists "idx_rpi_project";`);

    this.addSql(`drop index if exists "idx_repair_projects_assigned_to";`);
    this.addSql(`drop index if exists "idx_repair_projects_campus";`);
    this.addSql(`drop index if exists "idx_repair_projects_campus_status";`);
    this.addSql(`drop index if exists "idx_repair_projects_created_by";`);
    this.addSql(`drop index if exists "idx_repair_projects_publication_status";`);
    this.addSql(`drop index if exists "idx_repairs_building";`);
    this.addSql(`drop index if exists "idx_repairs_campus";`);
    this.addSql(`drop index if exists "idx_repairs_emergency";`);
    this.addSql(`drop index if exists "idx_repairs_status";`);
    this.addSql(`drop index if exists "idx_repairs_type";`);

    this.addSql(
      `alter table "repair_projects" alter column "urgency_level" drop default;`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "urgency_level" type varchar(50) using ("urgency_level"::varchar(50));`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "urgency_level" set default 'LOW';`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "campus" type varchar(50) using ("campus"::varchar(50));`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "status" type varchar(50) using ("status"::varchar(50));`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "physical_progress" type decimal(5,2) using ("physical_progress"::decimal(5,2));`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "physical_progress" set default 0;`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "financial_progress" type decimal(5,2) using ("financial_progress"::decimal(5,2));`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "financial_progress" set default 0;`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "publication_status" drop default;`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "publication_status" type varchar(50) using ("publication_status"::varchar(50));`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "publication_status" set default 'PUBLISHED';`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_project_id_key";`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_project_id_unique" unique ("project_id");`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_project_code_key";`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_project_code_unique" unique ("project_code");`,
    );

    this.addSql(
      `alter table "repair_types" drop constraint if exists "repair_types_name_key";`,
    );

    this.addSql(`drop index if exists "idx_sys_settings_group";`);
    this.addSql(
      `alter table "system_settings" drop constraint if exists "system_settings_setting_key_key";`,
    );

    this.addSql(
      `alter table "system_settings" alter column "data_type" type varchar(50) using ("data_type"::varchar(50));`,
    );
    this.addSql(
      `alter table "system_settings" alter column "is_public" type boolean using ("is_public"::boolean);`,
    );

    this.addSql(`drop index if exists "idx_univ_ops_campus";`);
    this.addSql(`drop index if exists "idx_univ_ops_coordinator";`);
    this.addSql(`drop index if exists "idx_univ_ops_status";`);
    this.addSql(`drop index if exists "idx_univ_ops_type";`);
    this.addSql(`drop index if exists "idx_university_operations_assigned_to";`);
    this.addSql(`drop index if exists "idx_university_operations_campus";`);
    this.addSql(`drop index if exists "idx_university_operations_campus_status";`);
    this.addSql(`drop index if exists "idx_university_operations_created_by";`);
    this.addSql(`drop index if exists "idx_university_operations_publication_status";`);
    this.addSql(`drop index if exists "idx_uo_fiscal_year";`);
    this.addSql(`drop index if exists "idx_uo_fiscal_year_campus";`);

    this.addSql(
      `alter table "university_operations" alter column "operation_type" type varchar(50) using ("operation_type"::varchar(50));`,
    );
    this.addSql(
      `alter table "university_operations" alter column "status" type varchar(20) using ("status"::varchar(20));`,
    );
    this.addSql(
      `alter table "university_operations" alter column "campus" type varchar(100) using ("campus"::varchar(100));`,
    );
    this.addSql(
      `alter table "university_operations" alter column "publication_status" drop default;`,
    );
    this.addSql(
      `alter table "university_operations" alter column "publication_status" type varchar(20) using ("publication_status"::varchar(20));`,
    );
    this.addSql(
      `alter table "university_operations" alter column "publication_status" set default 'PUBLISHED';`,
    );
    this.addSql(
      `alter table "university_operations" alter column "status_q1" type varchar(20) using ("status_q1"::varchar(20));`,
    );
    this.addSql(
      `alter table "university_operations" alter column "status_q2" type varchar(20) using ("status_q2"::varchar(20));`,
    );
    this.addSql(
      `alter table "university_operations" alter column "status_q3" type varchar(20) using ("status_q3"::varchar(20));`,
    );
    this.addSql(
      `alter table "university_operations" alter column "status_q4" type varchar(20) using ("status_q4"::varchar(20));`,
    );
    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_code_key";`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_code_unique" unique ("code");`,
    );

    this.addSql(`drop index if exists "idx_users_campus";`);
    this.addSql(`drop index if exists "idx_users_email";`);
    this.addSql(`drop index if exists "idx_users_google_id";`);
    this.addSql(`drop index if exists "idx_users_is_active";`);
    this.addSql(`drop index if exists "idx_users_rank_level";`);
    this.addSql(`drop index if exists "idx_users_username";`);
    this.addSql(`drop index if exists "idx_users_username_lower";`);
    this.addSql(`drop index if exists "users_email_active_unique";`);
    this.addSql(`drop index if exists "users_google_id_active_unique";`);
    this.addSql(`drop index if exists "users_username_active_unique";`);
    this.addSql(`alter table "users" drop constraint chk_users_rank_level;`);

    // this.addSql(
    //   `alter table "users" add constraint "users_username_unique" unique ("username");`,
    // );
    // this.addSql(
    //   `alter table "users" add constraint "users_email_unique" unique ("email");`,
    // );
    // this.addSql(
    //   `alter table "users" add constraint "users_google_id_unique" unique ("google_id");`,
    // );

    this.addSql(`drop index if exists "idx_activity_logs_created";`);
    this.addSql(`drop index if exists "idx_activity_logs_entity";`);
    this.addSql(`drop index if exists "idx_activity_logs_user";`);

    this.addSql(
      `alter table "activity_logs" alter column "action" type text using ("action"::text);`,
    );
    this.addSql(
      `alter table "activity_logs" add constraint "activity_logs_action_check" check("action" in ('CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'PUBLISH', 'REJECT', 'WITHDRAW', 'UPLOAD', 'REMOVE_ATTACHMENT', 'DOWNLOAD', 'BATCH_UPLOAD', 'REMARKS_UPDATE', 'TEMPLATE_UPLOAD', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'PROFILE_UPDATE', 'ACCESS_REQUEST', 'ACCESS_APPROVE', 'ACCESS_REJECT', 'ROLE_ASSIGN', 'FIRST_LOGIN', 'PROFILE_COMPLETED', 'RANK_CHANGED', 'MODULE_ACCESS_CHANGED', 'ACCESS_REVOKED', 'ACCOUNT_ENABLED', 'ACCOUNT_DISABLED', 'USER_CREATED', 'USER_UPDATED', 'PASSWORD_RESET_REQUESTED', 'ACCESS_CANCELLED', 'ACCESS_REOPENED', 'ACCESS_EXPIRED', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_RESET_DENIED'));`,
    );
    this.addSql(
      `alter table "activity_logs" add constraint "activity_logs_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "user_departments" alter column "is_primary" type boolean using ("is_primary"::boolean);`,
    );

    this.addSql(`drop index if exists "idx_user_module_assignments_module";`);
    this.addSql(`drop index if exists "idx_user_module_assignments_user_id";`);
    this.addSql(
      `alter table "user_module_assignments" drop constraint if exists "uq_user_module_assignment";`,
    );

    this.addSql(
      `alter table "user_module_assignments" alter column "module" type text using ("module"::text);`,
    );
    this.addSql(
      `alter table "user_module_assignments" alter column "assigned_at" type timestamptz using ("assigned_at"::timestamptz);`,
    );
    this.addSql(
      `alter table "user_module_assignments" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`,
    );
    this.addSql(
      `alter table "user_module_assignments" add constraint "user_module_assignments_module_check" check("module" in ('CONSTRUCTION', 'REPAIR', 'OPERATIONS', 'ALL'));`,
    );

    this.addSql(`drop index if exists "idx_user_permission_overrides_module_key";`);
    this.addSql(`drop index if exists "idx_user_permission_overrides_user_id";`);
    this.addSql(
      `alter table "user_permission_overrides" drop constraint if exists "uq_user_module";`,
    );

    this.addSql(
      `alter table "user_permission_overrides" alter column "created_at" type timestamp using ("created_at"::timestamp);`,
    );
    this.addSql(
      `alter table "user_permission_overrides" alter column "updated_at" type timestamp using ("updated_at"::timestamp);`,
    );

    this.addSql(
      `alter table "user_pillar_assignments" drop constraint if exists "uq_user_pillar";`,
    );

    this.addSql(
      `alter table "user_pillar_assignments" alter column "pillar_type" type varchar(50) using ("pillar_type"::varchar(50));`,
    );

    this.addSql(`drop index if exists "idx_user_roles_assigned_by";`);
    this.addSql(`drop index if exists "idx_user_roles_is_superadmin";`);

    this.addSql(
      `alter table "user_roles" alter column "assigned_at" type timestamptz using ("assigned_at"::timestamptz);`,
    );

    this.addSql(`drop type if exists "building_status_enum";`);
    this.addSql(`drop type if exists "building_type_enum";`);
    this.addSql(`drop type if exists "campus_enum";`);
    this.addSql(`drop type if exists "condition_enum";`);
    this.addSql(`drop type if exists "contractor_status_enum";`);
    this.addSql(`drop type if exists "department_status_enum";`);
    this.addSql(`drop type if exists "fund_type_enum";`);
    this.addSql(`drop type if exists "operation_type_enum";`);
    this.addSql(`drop type if exists "project_status_enum";`);
    this.addSql(`drop type if exists "project_type_enum";`);
    this.addSql(`drop type if exists "publication_status_enum";`);
    this.addSql(`drop type if exists "repair_status_enum";`);
    this.addSql(`drop type if exists "room_status_enum";`);
    this.addSql(`drop type if exists "room_type_enum";`);
    this.addSql(`drop type if exists "semester_enum";`);
    this.addSql(`drop type if exists "setting_data_type_enum";`);
    this.addSql(`drop type if exists "urgency_level_enum";`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `create type "building_status_enum" as enum ('OPERATIONAL', 'UNDER_CONSTRUCTION', 'RENOVATION', 'CLOSED');`,
    );
    this.addSql(
      `create type "building_type_enum" as enum ('ACADEMIC', 'ADMINISTRATIVE', 'RESIDENTIAL', 'OTHER');`,
    );
    this.addSql(
      `create type "campus_enum" as enum ('MAIN', 'CABADBARAN', 'BOTH');`,
    );
    this.addSql(
      `create type "condition_enum" as enum ('POOR', 'FAIR', 'GOOD', 'VERY_GOOD', 'EXCELLENT');`,
    );
    this.addSql(
      `create type "contractor_status_enum" as enum ('ACTIVE', 'SUSPENDED', 'BLACKLISTED');`,
    );
    this.addSql(
      `create type "department_status_enum" as enum ('ACTIVE', 'INACTIVE');`,
    );
    this.addSql(
      `create type "fund_type_enum" as enum ('RAF_PROGRAMS', 'RAF_PROJECTS', 'RAF_CONTINUING', 'IGF_MAIN', 'IGF_CABADBARAN');`,
    );
    this.addSql(
      `create type "operation_type_enum" as enum ('HIGHER_EDUCATION', 'ADVANCED_EDUCATION', 'RESEARCH', 'TECHNICAL_ADVISORY');`,
    );
    this.addSql(
      `create type "project_status_enum" as enum ('PLANNING', 'ONGOING', 'COMPLETED', 'ON_HOLD', 'CANCELLED', 'PROPOSAL', 'COMPLETE');`,
    );
    this.addSql(
      `create type "project_type_enum" as enum ('CONSTRUCTION', 'REPAIR', 'RESEARCH', 'EXTENSION', 'TRAINING', 'OTHER');`,
    );
    this.addSql(
      `create type "publication_status_enum" as enum ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');`,
    );
    this.addSql(
      `create type "repair_status_enum" as enum ('REPORTED', 'INSPECTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');`,
    );
    this.addSql(
      `create type "room_status_enum" as enum ('AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE', 'UNAVAILABLE');`,
    );
    this.addSql(
      `create type "room_type_enum" as enum ('CLASSROOM', 'LABORATORY', 'OFFICE', 'CONFERENCE', 'AUDITORIUM', 'OTHER');`,
    );
    this.addSql(
      `create type "semester_enum" as enum ('FIRST', 'SECOND', 'SUMMER');`,
    );
    this.addSql(
      `create type "setting_data_type_enum" as enum ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'DATETIME');`,
    );
    this.addSql(
      `create type "urgency_level_enum" as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');`,
    );
    this.addSql(
      `create table "audit_trail" ("id" uuid not null default gen_random_uuid(), "occurred_at" timestamptz(6) not null default now(), "actor_id" uuid null, "actor_department_id" uuid null, "actor_position" varchar(100) null, "resource_type" varchar(100) not null, "resource_id" uuid null, "action_type" varchar(50) not null, "delta" jsonb null, "ip_address" varchar(45) null, "user_agent" text null, "correlation_id" uuid null, "metadata" jsonb null, constraint "audit_trail_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "idx_audit_actor" on "audit_trail" ("actor_id");`,
    );
    this.addSql(
      `create index "idx_audit_correlation" on "audit_trail" ("correlation_id");`,
    );
    this.addSql(
      `create index "idx_audit_occurred" on "audit_trail" ("occurred_at");`,
    );
    this.addSql(
      `create index "idx_audit_resource" on "audit_trail" ("resource_type", "resource_id");`,
    );

    this.addSql(
      `create table "buildings" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "code" varchar(50) null, "campus" "campus_enum" not null, "building_type" "building_type_enum" not null, "year_built" int4 null, "total_floors" int4 null, "total_area" numeric(10,2) null, "status" "building_status_enum" not null, "metadata" jsonb null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "deleted_by" uuid null, constraint "buildings_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "buildings" add constraint "buildings_code_key" unique ("code");`,
    );
    this.addSql(
      `alter table "buildings" add constraint "buildings_name_key" unique ("name");`,
    );
    this.addSql(
      `create index "idx_buildings_campus" on "buildings" ("campus");`,
    );
    this.addSql(`create index "idx_buildings_name" on "buildings" ("name");`);
    this.addSql(
      `create index "idx_buildings_status" on "buildings" ("status");`,
    );
    this.addSql(
      `create index "idx_buildings_type" on "buildings" ("building_type");`,
    );

    this.addSql(
      `create table "construction_project_accomplishment_records" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "date_entry" date not null, "comments" text null, "remarks_comments" text null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "construction_project_accomplishment_records_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "construction_project_actual_accomplishment_records" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "date_entry" date not null, "progress_accomplishment" numeric(5,2) null, "actual_percent" numeric(5,2) null, "target_percent" numeric(5,2) null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "construction_project_actual_accomplishment_records_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "construction_project_assignments" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "project_id" uuid not null, "can_edit" bool not null default false, "can_delete" bool not null default false, "can_view_documents" bool not null default true, "can_upload_documents" bool not null default false, "assigned_by" uuid not null, "assigned_at" timestamptz(6) not null default now(), "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "deleted_by" uuid null, constraint "construction_project_assignments_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "idx_cpa_project" on "construction_project_assignments" ("project_id");`,
    );
    this.addSql(
      `create index "idx_cpa_user" on "construction_project_assignments" ("user_id");`,
    );
    this.addSql(
      `alter table "construction_project_assignments" add constraint "unique_const_proj_assignment" unique ("user_id", "project_id");`,
    );

    this.addSql(
      `create table "construction_project_financial_reports" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "report_title" varchar(255) not null, "report_date" date not null, "target_budget" numeric(15,2) null, "actual_spent" numeric(15,2) null, "status" varchar(50) null, "remarks" text null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "construction_project_financial_reports_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "construction_project_milestones" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "title" varchar(255) not null, "description" text null, "start_date" date null, "end_date" date null, "actual_start_date" date null, "actual_end_date" date null, "status" varchar(50) null, "progress" numeric(5,2) null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "construction_project_milestones_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "construction_project_phases" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "phase_name" varchar(100) not null, "phase_description" text null, "target_progress" numeric(5,2) null, "actual_progress" numeric(5,2) null, "status" varchar(50) null, "target_start_date" date null, "target_end_date" date null, "actual_start_date" date null, "actual_end_date" date null, "remarks" text null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "construction_project_phases_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "construction_project_progress" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "report_date" date not null, "physical_progress_percentage" numeric(5,2) not null, "financial_progress_percentage" numeric(5,2) not null, "time_elapsed_percentage" numeric(5,2) not null, "slippage_percentage" numeric(5,2) null, "remarks" text null, "reported_by" uuid not null, "metadata" jsonb null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "deleted_by" uuid null, constraint "construction_project_progress_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "idx_cpp_date" on "construction_project_progress" ("report_date");`,
    );
    this.addSql(
      `create index "idx_cpp_project" on "construction_project_progress" ("project_id");`,
    );

    this.addSql(
      `create table "construction_project_progress_summaries" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "period" varchar(50) not null, "physical_progress" numeric(5,2) null, "financial_progress" numeric(5,2) null, "issues" text null, "recommendations" text null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "construction_project_progress_summaries_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "construction_project_team_members" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "user_id" uuid null, "name" varchar(255) not null, "role" varchar(100) not null, "department" varchar(100) null, "responsibilities" text null, "status" varchar(50) null default 'Active', "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "construction_project_team_members_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "downloadable_forms" ("id" uuid not null default gen_random_uuid(), "form_title" varchar(255) not null, "department_owner" varchar(100) null, "file_url" varchar(500) not null, "file_type" varchar(10) null, "file_size_display" varchar(20) null, "is_public" bool null default true, "created_at" timestamptz(6) not null default now(), constraint "downloadable_forms_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "forms_inventory" ("id" uuid not null default gen_random_uuid(), "title" varchar(255) not null, "form_code" varchar(100) null, "description" text null, "category" varchar(100) null, "revision_number" varchar(20) null default '1.0', "is_active" bool null default true, "document_id" uuid null, "owning_department_id" uuid null, "created_by" uuid not null, "updated_by" uuid null, "metadata" jsonb null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "deleted_by" uuid null, constraint "forms_inventory_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "forms_inventory" add constraint "forms_inventory_form_code_key" unique ("form_code");`,
    );
    this.addSql(
      `create index "idx_forms_code" on "forms_inventory" ("form_code");`,
    );
    this.addSql(
      `create index "idx_forms_dept" on "forms_inventory" ("owning_department_id");`,
    );

    this.addSql(
      `create table "gad_yearly_profiles" ("id" uuid not null default gen_random_uuid(), "academic_year" int4 not null, "student_statistics" jsonb null default '{}', "faculty_statistics" jsonb null default '{}', "staff_statistics" jsonb null default '{}', "key_insights" jsonb null default '[]', "updated_at" timestamptz(6) not null default now(), constraint "gad_yearly_profiles_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "gad_yearly_profiles" add constraint "gad_yearly_profiles_academic_year_key" unique ("academic_year");`,
    );

    this.addSql(
      `create table "notifications" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "title" varchar(255) not null, "message" text not null, "notification_type" varchar(50) not null, "is_read" bool null default false, "read_at" timestamptz(6) null, "action_url" varchar(255) null, "related_entity_type" varchar(100) null, "related_entity_id" uuid null, "created_by" uuid null, "metadata" jsonb null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "deleted_by" uuid null, constraint "notifications_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "idx_notifications_entity" on "notifications" ("related_entity_type", "related_entity_id");`,
    );
    this.addSql(
      `create index "idx_notifications_read" on "notifications" ("is_read");`,
    );
    this.addSql(
      `create index "idx_notifications_type" on "notifications" ("notification_type");`,
    );
    this.addSql(
      `create index "idx_notifications_user" on "notifications" ("user_id");`,
    );

    this.addSql(
      `create table "policies" ("id" uuid not null default gen_random_uuid(), "title" varchar(255) not null, "description" text null, "category" varchar(100) not null, "policy_number" varchar(50) null, "status" varchar(50) not null default 'DRAFT', "valid_from" date not null, "valid_until" date null, "issuing_authority" varchar(255) null, "version_number" varchar(20) null, "effective_date" date null, "file_url" varchar(500) null, "document_id" uuid null, "created_by" uuid not null, "updated_by" uuid null, "metadata" jsonb null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "deleted_by" uuid null, constraint "policies_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "idx_policies_status" on "policies" ("status");`);
    this.addSql(
      `create index "idx_policies_validity" on "policies" ("valid_from", "valid_until");`,
    );

    this.addSql(
      `create table "repair_project_accomplishment_records" ("id" uuid not null default gen_random_uuid(), "repair_project_id" uuid not null, "date_entry" date not null, "comments" text null, "remarks_comments" text null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "repair_project_accomplishment_records_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "repair_project_actual_accomplishment_records" ("id" uuid not null default gen_random_uuid(), "repair_project_id" uuid not null, "date_entry" date not null, "progress_accomplishment" numeric(5,2) null, "actual_percent" numeric(5,2) null, "target_percent" numeric(5,2) null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "repair_project_actual_accomplishment_records_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "repair_project_financial_reports" ("id" uuid not null default gen_random_uuid(), "repair_project_id" uuid not null, "report_title" varchar(255) not null, "report_date" date not null, "target_budget" numeric(15,2) null, "actual_spent" numeric(15,2) null, "status" varchar(50) null, "remarks" text null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "repair_project_financial_reports_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "repair_project_milestones" ("id" uuid not null default gen_random_uuid(), "repair_project_id" uuid not null, "title" varchar(255) not null, "description" text null, "start_date" date null, "end_date" date null, "actual_start_date" date null, "actual_end_date" date null, "status" varchar(50) null, "progress" numeric(5,2) null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "repair_project_milestones_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "repair_project_progress_summaries" ("id" uuid not null default gen_random_uuid(), "repair_project_id" uuid not null, "period" varchar(50) not null, "physical_progress" numeric(5,2) null, "financial_progress" numeric(5,2) null, "issues" text null, "recommendations" text null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, constraint "repair_project_progress_summaries_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "room_assessments" ("id" uuid not null default gen_random_uuid(), "room_id" uuid not null, "assessment_date" date not null, "academic_year" varchar(20) not null, "semester" "semester_enum" not null, "subject_code" varchar(50) null, "subject_description" varchar(255) null, "number_of_students" int4 null, "class_schedule" text null, "functionality_score" int4 null, "utility_systems_score" int4 null, "sanitation_score" int4 null, "equipment_score" int4 null, "furniture_score" int4 null, "space_management_score" int4 null, "safety_score" int4 null, "overall_score" numeric(5,2) null, "overall_condition" "condition_enum" null, "functionality_details" json null, "utility_systems_details" json null, "sanitation_details" json null, "equipment_details" json null, "furniture_details" json null, "space_management_details" json null, "safety_details" json null, "assessor_id" uuid not null, "assessor_position" varchar(100) null, "remarks" text null, "recommended_actions" text null, "metadata" jsonb null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "deleted_by" uuid null, constraint "room_assessments_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "idx_rass_assessor" on "room_assessments" ("assessor_id");`,
    );
    this.addSql(
      `create index "idx_rass_ay" on "room_assessments" ("academic_year");`,
    );
    this.addSql(
      `create index "idx_rass_date" on "room_assessments" ("assessment_date");`,
    );
    this.addSql(
      `create index "idx_rass_room" on "room_assessments" ("room_id");`,
    );
    this.addSql(
      `create index "idx_rass_sem" on "room_assessments" ("semester");`,
    );

    this.addSql(
      `create table "rooms" ("id" uuid not null default gen_random_uuid(), "building_id" uuid not null, "room_number" varchar(20) not null, "floor_number" int4 not null, "room_type" "room_type_enum" not null, "capacity" int4 null, "area" numeric(10,2) null, "status" "room_status_enum" not null, "is_airconditioned" bool null default false, "has_projector" bool null default false, "has_whiteboard" bool null default true, "is_wheelchair_accessible" bool null default false, "metadata" jsonb null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "deleted_by" uuid null, constraint "rooms_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "idx_rooms_building" on "rooms" ("building_id");`,
    );
    this.addSql(`create index "idx_rooms_status" on "rooms" ("status");`);
    this.addSql(`create index "idx_rooms_type" on "rooms" ("room_type");`);

    this.addSql(
      `create table "university_operations_personnel" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "category" varchar(100) not null, "can_add" bool not null default false, "can_edit" bool not null default false, "can_delete" bool not null default false, "can_approve" bool not null default false, "assigned_by" uuid not null, "assigned_at" timestamptz(6) not null default now(), "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "deleted_by" uuid null, constraint "university_operations_personnel_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "idx_uop_category" on "university_operations_personnel" ("category");`,
    );
    this.addSql(
      `create index "idx_uop_user" on "university_operations_personnel" ("user_id");`,
    );
    this.addSql(
      `alter table "university_operations_personnel" add constraint "unique_univ_ops_personnel" unique ("user_id", "category");`,
    );

    this.addSql(
      `create table "university_statistics" ("id" uuid not null default gen_random_uuid(), "academic_year" int4 not null, "enrolled_students" int4 null default 0, "graduates_count" int4 null default 0, "research_projects_count" int4 null default 0, "extension_beneficiaries" int4 null default 0, "programs_offered" int4 null default 0, "research_projects_active" int4 null default 0, "research_publications" int4 null default 0, "research_budget_utilized" numeric(15,2) null, "total_research_budget" numeric(15,2) null, "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "campus" text null, constraint "university_statistics_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "idx_us_campus" on "university_statistics" ("campus");`,
    );
    this.addSql(
      `alter table "university_statistics" add constraint "uniq_academic_year_campus" unique ("academic_year", "campus");`,
    );

    this.addSql(
      `create table "user_page_permissions" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "page_id" varchar(100) not null, "can_view" bool not null default true, "can_add" bool not null default false, "can_edit" bool not null default false, "can_delete" bool not null default false, "can_approve" bool not null default false, "can_assign_staff" bool not null default false, "can_manage_permissions" bool not null default false, "assigned_by" uuid not null, "assigned_at" timestamptz(6) not null default now(), "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "deleted_at" timestamptz(6) null, "deleted_by" uuid null, constraint "user_page_permissions_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "idx_upp_page" on "user_page_permissions" ("page_id");`,
    );
    this.addSql(
      `create index "idx_upp_user" on "user_page_permissions" ("user_id");`,
    );
    this.addSql(
      `alter table "user_page_permissions" add constraint "unique_user_page_permission" unique ("user_id", "page_id");`,
    );

    this.addSql(
      `alter table "audit_trail" add constraint "audit_trail_actor_department_id_fkey" foreign key ("actor_department_id") references "departments" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "audit_trail" add constraint "audit_trail_actor_id_fkey" foreign key ("actor_id") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "construction_project_accomplishment_records" add constraint "construction_project_accomplishment_records_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "construction_project_actual_accomplishment_records" add constraint "construction_project_actual_accomplishment_reco_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "construction_project_assignments" add constraint "construction_project_assignments_assigned_by_fkey" foreign key ("assigned_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_project_assignments" add constraint "construction_project_assignments_deleted_by_fkey" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_project_assignments" add constraint "construction_project_assignments_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `alter table "construction_project_assignments" add constraint "fk_cpa_project" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete cascade;`,
    );

    this.addSql(
      `alter table "construction_project_financial_reports" add constraint "construction_project_financial_reports_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "construction_project_milestones" add constraint "construction_project_milestones_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "construction_project_phases" add constraint "construction_project_phases_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "construction_project_progress" add constraint "construction_project_progress_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_project_progress" add constraint "construction_project_progress_reported_by_fkey" foreign key ("reported_by") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "construction_project_progress_summaries" add constraint "construction_project_progress_summaries_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "construction_project_team_members" add constraint "construction_project_team_members_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_project_team_members" add constraint "construction_project_team_members_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "forms_inventory" add constraint "forms_inventory_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "forms_inventory" add constraint "forms_inventory_deleted_by_fkey" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "forms_inventory" add constraint "forms_inventory_document_id_fkey" foreign key ("document_id") references "documents" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "forms_inventory" add constraint "forms_inventory_owning_department_id_fkey" foreign key ("owning_department_id") references "departments" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "forms_inventory" add constraint "forms_inventory_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "notifications" add constraint "notifications_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "notifications" add constraint "notifications_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "policies" add constraint "policies_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "policies" add constraint "policies_deleted_by_fkey" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "policies" add constraint "policies_document_id_fkey" foreign key ("document_id") references "documents" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "policies" add constraint "policies_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "repair_project_accomplishment_records" add constraint "repair_project_accomplishment_records_repair_project_id_fkey" foreign key ("repair_project_id") references "repair_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "repair_project_actual_accomplishment_records" add constraint "repair_project_actual_accomplishment_rec_repair_project_id_fkey" foreign key ("repair_project_id") references "repair_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "repair_project_financial_reports" add constraint "repair_project_financial_reports_repair_project_id_fkey" foreign key ("repair_project_id") references "repair_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "repair_project_milestones" add constraint "repair_project_milestones_repair_project_id_fkey" foreign key ("repair_project_id") references "repair_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "repair_project_progress_summaries" add constraint "repair_project_progress_summaries_repair_project_id_fkey" foreign key ("repair_project_id") references "repair_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "room_assessments" add constraint "room_assessments_assessor_id_fkey" foreign key ("assessor_id") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "room_assessments" add constraint "room_assessments_room_id_fkey" foreign key ("room_id") references "rooms" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "rooms" add constraint "rooms_building_id_fkey" foreign key ("building_id") references "buildings" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "university_operations_personnel" add constraint "university_operations_personnel_assigned_by_fkey" foreign key ("assigned_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "university_operations_personnel" add constraint "university_operations_personnel_deleted_by_fkey" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "university_operations_personnel" add constraint "university_operations_personnel_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete cascade;`,
    );

    this.addSql(
      `alter table "user_page_permissions" add constraint "user_page_permissions_assigned_by_fkey" foreign key ("assigned_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "user_page_permissions" add constraint "user_page_permissions_deleted_by_fkey" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "user_page_permissions" add constraint "user_page_permissions_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete cascade;`,
    );

    this.addSql(
      `alter table "activity_logs" drop constraint if exists "activity_logs_action_check";`,
    );

    this.addSql(
      `alter table "activity_logs" drop constraint if exists "activity_logs_user_id_foreign";`,
    );

    this.addSql(
      `alter table "user_module_assignments" drop constraint if exists "user_module_assignments_module_check";`,
    );

    this.addSql(
      `alter table "activity_logs" alter column "action" type varchar(50) using ("action"::varchar(50));`,
    );
    this.addSql(
      `alter table "activity_logs" add constraint "activity_logs_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete set null;`,
    );
    this.addSql(
      `create index "idx_activity_logs_created" on "activity_logs" ("created_at");`,
    );
    this.addSql(
      `create index "idx_activity_logs_entity" on "activity_logs" ("entity_type", "entity_id");`,
    );
    this.addSql(
      `create index "idx_activity_logs_user" on "activity_logs" ("user_id");`,
    );

    this.addSql(
      `alter table "construction_diary_entries" add constraint "construction_diary_entries_author_id_fkey" foreign key ("author_id") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_diary_entries" add constraint "construction_diary_entries_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `create index "idx_diary_entries_entry_date" on "construction_diary_entries" ("project_id", "entry_date");`,
    );
    this.addSql(
      `create index "idx_diary_entries_project_id" on "construction_diary_entries" ("project_id");`,
    );

    this.addSql(
      `alter table "construction_document_checklist" add constraint "construction_document_checklist_submission_status_check" check("submission_status" in ('NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'));`,
    );
    this.addSql(
      `alter table "construction_document_checklist" add constraint "construction_document_checklist_document_type_id_fkey" foreign key ("document_type_id") references "construction_document_types" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_document_checklist" add constraint "construction_document_checklist_linked_document_id_fkey" foreign key ("linked_document_id") references "documents" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_document_checklist" add constraint "construction_document_checklist_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `alter table "construction_document_checklist" add constraint "construction_document_checklist_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_document_checklist" add constraint "construction_document_checklist_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_document_checklist" add constraint "construction_document_checklist_project_id_document_type_id_key" unique ("project_id", "document_type_id");`,
    );
    this.addSql(
      `create index "idx_doc_checklist_project" on "construction_document_checklist" ("project_id");`,
    );
    this.addSql(
      `create index "idx_doc_checklist_status" on "construction_document_checklist" ("project_id", "submission_status");`,
    );

    this.addSql(
      `alter table "construction_document_folders" add constraint "construction_document_folders_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_document_folders" add constraint "construction_document_folders_deleted_by_fkey" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_document_folders" add constraint "construction_document_folders_parent_id_fkey" foreign key ("parent_id") references "construction_document_folders" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `alter table "construction_document_folders" add constraint "construction_document_folders_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `alter table "construction_document_folders" add constraint "construction_document_folders_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_construction_document_folders_parent" on "construction_document_folders" ("parent_id");`,
    );
    this.addSql(
      `create index "idx_construction_document_folders_project" on "construction_document_folders" ("project_id");`,
    );

    this.addSql(
      `alter table "construction_document_submissions" add constraint "construction_document_submissions_checklist_item_id_fkey" foreign key ("checklist_item_id") references "construction_document_checklist" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_document_submissions" add constraint "construction_document_submissions_document_id_fkey" foreign key ("document_id") references "documents" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_document_submissions" add constraint "construction_document_submissions_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_doc_submissions_checklist" on "construction_document_submissions" ("checklist_item_id");`,
    );
    this.addSql(
      `create index "idx_doc_submissions_project" on "construction_document_submissions" ("project_id");`,
    );

    this.addSql(
      `alter table "construction_document_types" add constraint "construction_document_types_group_code_check" check("group_code" in ('GROUP_1', 'GROUP_2', 'GROUP_3', 'GROUP_4', 'GROUP_5', 'GROUP_6', 'ECO_FORMS', 'SD_ORDERS', 'SD_REPORTS', 'SD_CERTS', 'CPES_DOCS'));`,
    );
    this.addSql(
      `alter table "construction_document_types" drop constraint if exists "construction_document_types_type_code_unique";`,
    );
    this.addSql(
      `alter table "construction_document_types" add constraint "construction_document_types_type_code_key" unique ("type_code");`,
    );

    this.addSql(
      `alter table "construction_gallery" add constraint "construction_gallery_category_check" check("category" in ('BEFORE', 'IN_PROGRESS', 'COMPLETED', 'DOCUMENTATION', 'PROFILE'));`,
    );
    this.addSql(
      `alter table "construction_gallery" add constraint "construction_gallery_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete cascade;`,
    );

    this.addSql(
      `alter table "construction_milestones" alter column "progress" type numeric(5,2) using ("progress"::numeric(5,2));`,
    );
    this.addSql(
      `alter table "construction_milestones" alter column "progress" set default 0.00;`,
    );
    this.addSql(
      `alter table "construction_milestones" add constraint "construction_milestones_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete cascade;`,
    );

    this.addSql(
      `alter table "construction_mov_entries" add constraint "construction_mov_entries_related_entity_type_check" check("related_entity_type" in ('MILESTONE', 'TIMELINE_ENTRY'));`,
    );
    this.addSql(
      `alter table "construction_mov_entries" add constraint "construction_mov_entries_verification_status_check" check("verification_status" in ('PENDING', 'VERIFIED', 'REJECTED'));`,
    );
    this.addSql(
      `alter table "construction_mov_entries" add constraint "construction_mov_entries_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `alter table "construction_mov_entries" add constraint "construction_mov_entries_uploaded_by_fkey" foreign key ("uploaded_by") references "users" ("id") on update no action on delete set null;`,
    );
    this.addSql(
      `create index "idx_mov_entries_entity" on "construction_mov_entries" ("related_entity_type", "related_entity_id");`,
    );
    this.addSql(
      `create index "idx_mov_entries_project_id" on "construction_mov_entries" ("project_id");`,
    );

    this.addSql(
      `alter table "construction_progress_reports" add constraint "construction_progress_reports_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_cpr_project_date" on "construction_progress_reports" ("project_id", "report_date");`,
    );

    this.addSql(
      `alter table "construction_projects" add column "location_coordinates" point null, add column "risk_register" jsonb not null default '[]', add column "escalation_records" jsonb not null default '[]';`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "infra_project_uid" type int8 using ("infra_project_uid"::int8);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "campus" type "campus_enum" using ("campus"::"campus_enum");`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "status" type "project_status_enum" using ("status"::"project_status_enum");`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "physical_progress" type numeric(5,2) using ("physical_progress"::numeric(5,2));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "physical_progress" set default 0.00;`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "financial_progress" type numeric(5,2) using ("financial_progress"::numeric(5,2));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "financial_progress" set default 0.00;`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "target_physical_progress" type numeric(5,2) using ("target_physical_progress"::numeric(5,2));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "target_financial_progress" type numeric(5,2) using ("target_financial_progress"::numeric(5,2));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "timeline_data" type jsonb using ("timeline_data"::jsonb);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "timeline_data" set default '[]';`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "gallery_images" type jsonb using ("gallery_images"::jsonb);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "gallery_images" set default '[]';`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "publication_status" drop default;`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "publication_status" type "publication_status_enum" using ("publication_status"::"publication_status_enum");`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "publication_status" set default 'PUBLISHED'::"publication_status_enum";`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "custom_key_sections" type jsonb using ("custom_key_sections"::jsonb);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "custom_supporting_sections" type jsonb using ("custom_supporting_sections"::jsonb);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "sdg_goals" type jsonb using ("sdg_goals"::jsonb);`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "sdg_goals" set default '[]';`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_project_status_category_check" check("project_status_category" in ('NEW', 'ONGOING', 'COMPLETED', 'SUSPENDED', 'CANCELLED'));`,
    );
    this.addSql(
      `create sequence if not exists "construction_projects_infra_project_uid_seq";`,
    );
    this.addSql(
      `select setval('construction_projects_infra_project_uid_seq', (select max("infra_project_uid") from "construction_projects"));`,
    );
    this.addSql(
      `alter table "construction_projects" alter column "infra_project_uid" set default nextval('construction_projects_infra_project_uid_seq');`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_assigned_to_fkey" foreign key ("assigned_to") references "users" ("id") on update no action on delete set null;`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_contractor_id_fkey" foreign key ("contractor_id") references "contractors" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_deleted_by_fkey" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_funding_source_id_fkey" foreign key ("funding_source_id") references "funding_sources" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_project_id_fkey" foreign key ("project_id") references "projects" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_subcategory_id_fkey" foreign key ("subcategory_id") references "construction_subcategories" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_conproj_campus" on "construction_projects" ("campus");`,
    );
    this.addSql(
      `create index "idx_conproj_contractor" on "construction_projects" ("contractor_id");`,
    );
    this.addSql(
      `create index "idx_conproj_project_id" on "construction_projects" ("project_id");`,
    );
    this.addSql(
      `create index "idx_conproj_start_date" on "construction_projects" ("start_date");`,
    );
    this.addSql(
      `create index "idx_conproj_status" on "construction_projects" ("status");`,
    );
    this.addSql(
      `create index "idx_conproj_target_date" on "construction_projects" ("target_completion_date");`,
    );
    this.addSql(
      `create index "idx_construction_projects_assigned_to" on "construction_projects" ("assigned_to");`,
    );
    this.addSql(
      `CREATE INDEX idx_construction_projects_campus ON public.construction_projects USING btree (campus) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `CREATE INDEX idx_construction_projects_campus_status ON public.construction_projects USING btree (campus, publication_status) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `CREATE INDEX idx_construction_projects_created_by ON public.construction_projects USING btree (created_by) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `create index "idx_construction_projects_publication_status" on "construction_projects" ("publication_status");`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_infra_project_uid_unique";`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_infra_project_uid_key" unique ("infra_project_uid");`,
    );
    this.addSql(
      `alter table "construction_projects" drop constraint if exists "construction_projects_project_id_unique";`,
    );
    this.addSql(
      `alter table "construction_projects" add constraint "construction_projects_project_id_key" unique ("project_id");`,
    );

    this.addSql(
      `alter table "construction_revision_orders" add constraint "construction_revision_orders_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_cro_project_date" on "construction_revision_orders" ("project_id", "revision_date");`,
    );
    this.addSql(
      `alter table "construction_revision_orders" add constraint "idx_cro_project_revnum" unique ("project_id", "revision_number");`,
    );

    this.addSql(
      `alter table "construction_subcategories" add constraint "construction_subcategories_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_subcategories" add constraint "construction_subcategories_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_subcategories" add constraint "construction_subcategories_name_key" unique ("name");`,
    );

    this.addSql(
      `alter table "construction_timeline_entries" add constraint "construction_timeline_entries_entry_type_check" check("entry_type" in ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'));`,
    );
    this.addSql(
      `alter table "construction_timeline_entries" add constraint "construction_timeline_entries_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "construction_timeline_entries" add constraint "construction_timeline_entries_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `create index "idx_timeline_entries_entry_date" on "construction_timeline_entries" ("entry_date");`,
    );
    this.addSql(
      `create index "idx_timeline_entries_project_id" on "construction_timeline_entries" ("project_id");`,
    );

    this.addSql(
      `alter table "contractor_invite_tokens" add constraint "cit_accepted_by_fkey" foreign key ("accepted_by") references "users" ("id") on update no action on delete set null;`,
    );
    this.addSql(
      `alter table "contractor_invite_tokens" add constraint "contractor_invite_tokens_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "contractor_invite_tokens" add constraint "contractor_invite_tokens_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `create index "idx_contractor_invite_token" on "contractor_invite_tokens" ("token");`,
    );
    this.addSql(
      `alter table "contractor_invite_tokens" drop constraint if exists "contractor_invite_tokens_token_unique";`,
    );
    this.addSql(
      `alter table "contractor_invite_tokens" add constraint "contractor_invite_tokens_token_key" unique ("token");`,
    );

    this.addSql(
      `alter table "contractor_users" drop constraint if exists "contractor_users_email_unique";`,
    );
    this.addSql(
      `alter table "contractor_users" add constraint "contractor_users_email_key" unique ("email");`,
    );
    this.addSql(
      `alter table "contractor_users" drop constraint if exists "contractor_users_google_id_unique";`,
    );
    this.addSql(
      `alter table "contractor_users" add constraint "contractor_users_google_id_key" unique ("google_id");`,
    );

    this.addSql(
      `alter table "contractors" alter column "status" type "contractor_status_enum" using ("status"::"contractor_status_enum");`,
    );
    this.addSql(
      `alter table "contractors" add constraint "fk_contractors_created_by" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "contractors" add constraint "fk_contractors_updated_by" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_contractors_name" on "contractors" ("name");`,
    );
    this.addSql(
      `create index "idx_contractors_status" on "contractors" ("status");`,
    );

    this.addSql(
      `alter table "departments" alter column "status" drop default;`,
    );
    this.addSql(
      `alter table "departments" alter column "status" type "department_status_enum" using ("status"::"department_status_enum");`,
    );
    this.addSql(
      `alter table "departments" alter column "status" set default 'ACTIVE'::"department_status_enum";`,
    );
    this.addSql(
      `alter table "departments" add constraint "departments_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "departments" add constraint "departments_head_id_fkey" foreign key ("head_id") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "departments" add constraint "departments_parent_id_fkey" foreign key ("parent_id") references "departments" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "departments" add constraint "departments_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_departments_head" on "departments" ("head_id");`,
    );
    this.addSql(
      `create index "idx_departments_name" on "departments" ("name");`,
    );
    this.addSql(
      `create index "idx_departments_parent" on "departments" ("parent_id");`,
    );
    this.addSql(
      `create index "idx_departments_status" on "departments" ("status");`,
    );
    this.addSql(
      `alter table "departments" drop constraint if exists "departments_code_unique";`,
    );
    this.addSql(
      `alter table "departments" add constraint "departments_code_key" unique ("code");`,
    );

    this.addSql(
      `alter table "documents" add constraint "documents_lifecycle_status_check" check("lifecycle_status" in ('ACTIVE', 'ARCHIVED', 'DRAFT'));`,
    );
    this.addSql(
      `alter table "documents" add constraint "documents_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "documents" add constraint "documents_deleted_by_fkey" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "documents" add constraint "documents_folder_id_fkey" foreign key ("folder_id") references "construction_document_folders" ("id") on update no action on delete set null;`,
    );
    this.addSql(
      `alter table "documents" add constraint "documents_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "documents" add constraint "documents_uploaded_by_fkey" foreign key ("uploaded_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_documents_docpair" on "documents" ("documentable_type", "documentable_id");`,
    );
    this.addSql(
      `create index "idx_documents_folder_id" on "documents" ("folder_id");`,
    );
    this.addSql(
      `create index "idx_documents_type" on "documents" ("document_type");`,
    );
    this.addSql(
      `create index "idx_documents_uploader" on "documents" ("uploaded_by");`,
    );

    this.addSql(`alter table "facilities" alter column "campus" drop default;`);
    this.addSql(
      `alter table "facilities" alter column "campus" type "campus_enum" using ("campus"::"campus_enum");`,
    );
    this.addSql(
      `alter table "facilities" alter column "campus" set default 'MAIN'::"campus_enum";`,
    );
    this.addSql(
      `alter table "facilities" alter column "condition_rating" drop default;`,
    );
    this.addSql(
      `alter table "facilities" alter column "condition_rating" type "condition_enum" using ("condition_rating"::"condition_enum");`,
    );
    this.addSql(
      `alter table "facilities" alter column "condition_rating" set default 'GOOD'::"condition_enum";`,
    );

    this.addSql(
      `CREATE INDEX idx_fiscal_years_active ON public.fiscal_years USING btree (year) WHERE (is_active = true);`,
    );

    this.addSql(
      `alter table "funding_sources" add constraint "fk_funding_sources_created_by" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "funding_sources" add constraint "fk_funding_sources_updated_by" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "funding_sources" add constraint "funding_sources_name_key" unique ("name");`,
    );

    this.addSql(
      `alter table "gad_budget_plans" add constraint "gad_budget_plans_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "gad_budget_plans" add constraint "gad_budget_plans_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "gad_faculty_parity_data" add constraint "gad_faculty_parity_data_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "gad_faculty_parity_data" add constraint "gad_faculty_parity_data_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "gad_gpb_accomplishments" add constraint "gad_gpb_accomplishments_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "gad_gpb_accomplishments" add constraint "gad_gpb_accomplishments_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "gad_indigenous_parity_data" add constraint "gad_indigenous_parity_data_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "gad_indigenous_parity_data" add constraint "gad_indigenous_parity_data_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "gad_pwd_parity_data" add constraint "gad_pwd_parity_data_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "gad_pwd_parity_data" add constraint "gad_pwd_parity_data_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "gad_staff_parity_data" add constraint "gad_staff_parity_data_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "gad_staff_parity_data" add constraint "gad_staff_parity_data_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "gad_student_parity_data" add constraint "gad_student_parity_data_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "gad_student_parity_data" add constraint "gad_student_parity_data_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `CREATE INDEX homepage_items_page_section_index ON public.homepage_items USING btree (page_key, section_key, item_order) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `CREATE INDEX homepage_items_section_order_index ON public.homepage_items USING btree (section_key, item_order) WHERE (deleted_at IS NULL);`,
    );

    this.addSql(
      `alter table "media" add constraint "media_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "media" add constraint "media_deleted_by_fkey" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "media" add constraint "media_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "media" add constraint "media_uploaded_by_fkey" foreign key ("uploaded_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_media_featured" on "media" ("is_featured");`,
    );
    this.addSql(
      `create index "idx_media_pair" on "media" ("mediable_type", "mediable_id");`,
    );
    this.addSql(`create index "idx_media_type" on "media" ("media_type");`);
    this.addSql(
      `create index "idx_media_uploader" on "media" ("uploaded_by");`,
    );

    this.addSql(
      `alter table "operation_financials" alter column "fund_type" type "fund_type_enum" using ("fund_type"::"fund_type_enum");`,
    );
    this.addSql(
      `alter table "operation_financials" add constraint "operation_financials_quarter_check" check("quarter" in ('Q1', 'Q2', 'Q3', 'Q4'));`,
    );
    this.addSql(
      `alter table "operation_financials" add constraint "operation_financials_expense_class_check" check("expense_class" in ('PS', 'MOOE', 'CO'));`,
    );
    this.addSql(
      `alter table "operation_financials" add constraint "operation_financials_status_check" check("status" in ('active', 'completed', 'pending', 'cancelled'));`,
    );
    this.addSql(
      `alter table "operation_financials" add constraint "operation_financials_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "operation_financials" add constraint "operation_financials_operation_id_fkey" foreign key ("operation_id") references "university_operations" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "operation_financials" add constraint "operation_financials_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_of_department" on "operation_financials" ("department");`,
    );
    this.addSql(
      `create index "idx_of_expense_class" on "operation_financials" ("expense_class");`,
    );
    this.addSql(
      `create index "idx_of_fund_type" on "operation_financials" ("fund_type");`,
    );
    this.addSql(
      `CREATE INDEX idx_of_fund_type_operation ON public.operation_financials USING btree (operation_id, fund_type) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `create index "idx_of_operation" on "operation_financials" ("operation_id");`,
    );
    this.addSql(
      `CREATE INDEX idx_of_operation_expense ON public.operation_financials USING btree (operation_id, expense_class) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `create index "idx_of_program" on "operation_financials" ("operations_programs");`,
    );
    this.addSql(
      `create index "idx_of_quarter" on "operation_financials" ("quarter");`,
    );
    this.addSql(
      `create index "idx_of_status" on "operation_financials" ("status");`,
    );
    this.addSql(
      `create index "idx_of_year" on "operation_financials" ("fiscal_year");`,
    );
    this.addSql(
      `alter table "operation_financials" add constraint "operation_financials_operation_id_fiscal_year_quarter_opera_key" unique ("operation_id", "fiscal_year", "quarter", "operations_programs");`,
    );

    this.addSql(
      `alter table "operation_indicators" alter column "override_total_target" type numeric(15,4) using ("override_total_target"::numeric(15,4));`,
    );
    this.addSql(
      `alter table "operation_indicators" alter column "override_total_target" set default NULL::numeric;`,
    );
    this.addSql(
      `alter table "operation_indicators" alter column "override_total_actual" type numeric(15,4) using ("override_total_actual"::numeric(15,4));`,
    );
    this.addSql(
      `alter table "operation_indicators" alter column "override_total_actual" set default NULL::numeric;`,
    );
    this.addSql(
      `alter table "operation_indicators" add constraint "operation_indicators_reported_quarter_check" check("reported_quarter" in ('Q1', 'Q2', 'Q3', 'Q4'));`,
    );
    this.addSql(
      `alter table "operation_indicators" add constraint "operation_indicators_status_check" check("status" in ('pending', 'approved', 'rejected'));`,
    );
    this.addSql(
      `alter table "operation_indicators" add constraint "operation_indicators_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "operation_indicators" add constraint "operation_indicators_operation_id_fkey" foreign key ("operation_id") references "university_operations" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "operation_indicators" add constraint "operation_indicators_pillar_indicator_id_fkey" foreign key ("pillar_indicator_id") references "pillar_indicator_taxonomy" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "operation_indicators" add constraint "operation_indicators_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_oi_code" on "operation_indicators" ("indicator_code");`,
    );
    this.addSql(
      `create index "idx_oi_created_by" on "operation_indicators" ("created_by");`,
    );
    this.addSql(
      `create index "idx_oi_operation" on "operation_indicators" ("operation_id");`,
    );
    this.addSql(
      `create index "idx_oi_pillar_indicator" on "operation_indicators" ("pillar_indicator_id");`,
    );
    this.addSql(
      `create index "idx_oi_reported_quarter" on "operation_indicators" ("reported_quarter");`,
    );
    this.addSql(
      `create index "idx_oi_status" on "operation_indicators" ("status");`,
    );
    this.addSql(
      `create index "idx_oi_subcategory_data" on "operation_indicators" ("subcategory_data");`,
    );
    this.addSql(
      `create index "idx_oi_uacs" on "operation_indicators" ("uacs_code");`,
    );
    this.addSql(
      `create index "idx_oi_year" on "operation_indicators" ("fiscal_year");`,
    );
    this.addSql(
      `create index "idx_operation_indicators_pillar_indicator_id" on "operation_indicators" ("pillar_indicator_id");`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX uq_oi_quarterly_per_quarter ON public.operation_indicators USING btree (operation_id, pillar_indicator_id, fiscal_year, reported_quarter) WHERE ((deleted_at IS NULL) AND (reported_quarter IS NOT NULL));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX uq_operation_indicators_orphan ON public.operation_indicators USING btree (operation_id, lower(TRIM(BOTH FROM particular)), fiscal_year) WHERE ((deleted_at IS NULL) AND (pillar_indicator_id IS NULL));`,
    );

    this.addSql(
      `alter table "operation_organizational_info" add constraint "operation_organizational_info_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "operation_organizational_info" add constraint "operation_organizational_info_operation_id_fkey" foreign key ("operation_id") references "university_operations" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "operation_organizational_info" add constraint "operation_organizational_info_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_ooi_department" on "operation_organizational_info" ("department");`,
    );
    this.addSql(
      `create index "idx_ooi_operation" on "operation_organizational_info" ("operation_id");`,
    );
    this.addSql(
      `create index "idx_ooi_org_code" on "operation_organizational_info" ("organization_code");`,
    );
    this.addSql(
      `alter table "operation_organizational_info" drop constraint if exists "operation_organizational_info_operation_id_unique";`,
    );
    this.addSql(
      `alter table "operation_organizational_info" add constraint "operation_organizational_info_operation_id_key" unique ("operation_id");`,
    );

    this.addSql(
      `alter table "password_reset_requests" add constraint "password_reset_requests_status_check" check("status" in ('PENDING', 'COMPLETED', 'CANCELLED'));`,
    );
    this.addSql(
      `alter table "password_reset_requests" add constraint "password_reset_requests_completed_by_fkey" foreign key ("completed_by") references "users" ("id") on update no action on delete set null;`,
    );
    this.addSql(
      `create index "idx_prr_status" on "password_reset_requests" ("status");`,
    );

    this.addSql(
      `create index "idx_permissions_name" on "permissions" ("name");`,
    );
    this.addSql(
      `create index "idx_permissions_resource" on "permissions" ("resource");`,
    );
    this.addSql(
      `alter table "permissions" drop constraint if exists "permissions_name_unique";`,
    );
    this.addSql(
      `alter table "permissions" add constraint "permissions_name_key" unique ("name");`,
    );

    this.addSql(
      `alter table "pillar_indicator_taxonomy" add column "organizational_outcome" text check ("organizational_outcome" in ('OO1', 'OO2', 'OO3')) null;`,
    );
    this.addSql(
      `alter table "pillar_indicator_taxonomy" alter column "pillar_type" type "operation_type_enum" using ("pillar_type"::"operation_type_enum");`,
    );
    this.addSql(
      `alter table "pillar_indicator_taxonomy" add constraint "pillar_indicator_taxonomy_indicator_type_check" check("indicator_type" in ('OUTCOME', 'OUTPUT'));`,
    );
    this.addSql(
      `alter table "pillar_indicator_taxonomy" add constraint "pillar_indicator_taxonomy_unit_type_check" check("unit_type" in ('PERCENTAGE', 'COUNT', 'WEIGHTED_COUNT', 'RATIO', 'SCORE'));`,
    );
    this.addSql(
      `create index "idx_pit_active" on "pillar_indicator_taxonomy" ("is_active");`,
    );
    this.addSql(
      `create index "idx_pit_oo" on "pillar_indicator_taxonomy" ("organizational_outcome");`,
    );
    this.addSql(
      `create index "idx_pit_order" on "pillar_indicator_taxonomy" ("pillar_type", "indicator_order");`,
    );
    this.addSql(
      `create index "idx_pit_pillar_type" on "pillar_indicator_taxonomy" ("pillar_type");`,
    );
    this.addSql(
      `alter table "pillar_indicator_taxonomy" add constraint "uniq_pillar_indicator" unique ("pillar_type", "indicator_name");`,
    );

    this.addSql(
      `alter table "project_contractor_assignments" add constraint "pca_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `alter table "project_contractor_assignments" add constraint "project_contractor_assignments_assigned_by_fkey" foreign key ("assigned_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "project_contractor_assignments" add constraint "project_contractor_assignments_invite_token_id_fkey" foreign key ("invite_token_id") references "contractor_invite_tokens" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "project_contractor_assignments" add constraint "project_contractor_assignments_project_id_fkey" foreign key ("project_id") references "construction_projects" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `create index "idx_contractor_assignments_project" on "project_contractor_assignments" ("project_id");`,
    );
    this.addSql(
      `alter table "project_contractor_assignments" add constraint "pca_project_user_unique" unique ("project_id", "user_id");`,
    );
    this.addSql(
      `alter table "project_contractor_assignments" add constraint "project_contractor_assignment_project_id_contractor_user_id_key" unique ("project_id", "user_id");`,
    );

    this.addSql(
      `alter table "projects" alter column "project_type" type "project_type_enum" using ("project_type"::"project_type_enum");`,
    );
    this.addSql(
      `alter table "projects" alter column "status" type "project_status_enum" using ("status"::"project_status_enum");`,
    );
    this.addSql(
      `alter table "projects" alter column "campus" type "campus_enum" using ("campus"::"campus_enum");`,
    );
    this.addSql(
      `alter table "projects" add constraint "projects_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "projects" add constraint "projects_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(`create index "idx_projects_campus" on "projects" ("campus");`);
    this.addSql(`create index "idx_projects_status" on "projects" ("status");`);
    this.addSql(
      `create index "idx_projects_type" on "projects" ("project_type");`,
    );

    this.addSql(
      `alter table "quarterly_report_submissions" add constraint "quarterly_report_submissions_event_type_check" check("event_type" in ('SUBMITTED', 'APPROVED', 'REJECTED', 'REVERTED', 'UNLOCKED'));`,
    );
    this.addSql(
      `alter table "quarterly_report_submissions" add constraint "quarterly_report_submissions_actioned_by_fkey" foreign key ("actioned_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "quarterly_report_submissions" add constraint "quarterly_report_submissions_quarterly_report_id_fkey" foreign key ("quarterly_report_id") references "quarterly_reports" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "quarterly_report_submissions" add constraint "quarterly_report_submissions_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "quarterly_report_submissions" add constraint "quarterly_report_submissions_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_qr_submissions_fiscal" on "quarterly_report_submissions" ("fiscal_year", "quarter");`,
    );
    this.addSql(
      `create index "idx_qr_submissions_report" on "quarterly_report_submissions" ("quarterly_report_id");`,
    );

    this.addSql(
      `alter table "quarterly_reports" add constraint "quarterly_reports_quarter_check" check("quarter" in ('Q1', 'Q2', 'Q3', 'Q4'));`,
    );
    this.addSql(
      `alter table "quarterly_reports" add constraint "quarterly_reports_publication_status_check" check("publication_status" in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'));`,
    );
    this.addSql(
      `alter table "quarterly_reports" add constraint "quarterly_reports_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "quarterly_reports" add constraint "quarterly_reports_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "quarterly_reports" add constraint "quarterly_reports_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "quarterly_reports" add constraint "quarterly_reports_unlock_requested_by_fkey" foreign key ("unlock_requested_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "quarterly_reports" add constraint "quarterly_reports_unlocked_by_fkey" foreign key ("unlocked_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_quarterly_reports_created_by" on "quarterly_reports" ("created_by");`,
    );
    this.addSql(
      `create index "idx_quarterly_reports_fiscal_year" on "quarterly_reports" ("fiscal_year");`,
    );
    this.addSql(
      `create index "idx_quarterly_reports_publication_status" on "quarterly_reports" ("publication_status");`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX idx_quarterly_reports_unique_active ON public.quarterly_reports USING btree (fiscal_year, quarter) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `CREATE INDEX idx_quarterly_reports_unlock_requested ON public.quarterly_reports USING btree (unlock_requested_by) WHERE (unlock_requested_by IS NOT NULL);`,
    );

    this.addSql(
      `alter table "record_assignments" add constraint "record_assignments_module_check" check("module" in ('CONSTRUCTION', 'REPAIR', 'OPERATIONS'));`,
    );
    this.addSql(
      `alter table "record_assignments" add constraint "record_assignments_assigned_by_fkey" foreign key ("assigned_by") references "users" ("id") on update no action on delete set null;`,
    );
    this.addSql(
      `alter table "record_assignments" add constraint "record_assignments_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `create index "idx_record_assignments_assigned_at" on "record_assignments" ("assigned_at");`,
    );
    this.addSql(
      `create index "idx_record_assignments_module_record" on "record_assignments" ("module", "record_id");`,
    );
    this.addSql(
      `create index "idx_record_assignments_record" on "record_assignments" ("module", "record_id");`,
    );
    this.addSql(
      `create index "idx_record_assignments_user" on "record_assignments" ("user_id");`,
    );
    this.addSql(
      `alter table "record_assignments" add constraint "record_assignments_module_record_id_user_id_key" unique ("module", "record_id", "user_id");`,
    );

    this.addSql(
      `alter table "repair_pow_items" add constraint "repair_pow_items_deleted_by_fkey" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_pow_items" add constraint "repair_pow_items_repair_project_id_fkey" foreign key ("repair_project_id") references "repair_projects" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_rpi_category" on "repair_pow_items" ("category");`,
    );
    this.addSql(
      `create index "idx_rpi_date" on "repair_pow_items" ("date_entry");`,
    );
    this.addSql(
      `create index "idx_rpi_phase" on "repair_pow_items" ("phase");`,
    );
    this.addSql(
      `create index "idx_rpi_project" on "repair_pow_items" ("repair_project_id");`,
    );

    this.addSql(
      `alter table "repair_project_phases" add constraint "repair_project_phases_repair_project_id_fkey" foreign key ("repair_project_id") references "repair_projects" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "repair_project_team_members" add constraint "repair_project_team_members_repair_project_id_fkey" foreign key ("repair_project_id") references "repair_projects" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_project_team_members" add constraint "repair_project_team_members_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "repair_projects" alter column "urgency_level" drop default;`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "urgency_level" type "urgency_level_enum" using ("urgency_level"::"urgency_level_enum");`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "urgency_level" set default 'LOW'::"urgency_level_enum";`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "campus" type "campus_enum" using ("campus"::"campus_enum");`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "status" type "repair_status_enum" using ("status"::"repair_status_enum");`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "physical_progress" type numeric(5,2) using ("physical_progress"::numeric(5,2));`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "physical_progress" set default 0.00;`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "financial_progress" type numeric(5,2) using ("financial_progress"::numeric(5,2));`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "financial_progress" set default 0.00;`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "publication_status" drop default;`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "publication_status" type "publication_status_enum" using ("publication_status"::"publication_status_enum");`,
    );
    this.addSql(
      `alter table "repair_projects" alter column "publication_status" set default 'PUBLISHED'::"publication_status_enum";`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "fk_deleted_by_user" foreign key ("deleted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_assigned_to_fkey" foreign key ("assigned_to") references "users" ("id") on update no action on delete set null;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_contractor_id_fkey" foreign key ("contractor_id") references "contractors" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_facility_id_fkey" foreign key ("facility_id") references "facilities" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_inspector_id_fkey" foreign key ("inspector_id") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_project_id_fkey" foreign key ("project_id") references "projects" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_project_manager_id_fkey" foreign key ("project_manager_id") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_repair_type_id_fkey" foreign key ("repair_type_id") references "repair_types" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_repair_projects_assigned_to" on "repair_projects" ("assigned_to");`,
    );
    this.addSql(
      `CREATE INDEX idx_repair_projects_campus ON public.repair_projects USING btree (campus) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `CREATE INDEX idx_repair_projects_campus_status ON public.repair_projects USING btree (campus, publication_status) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `CREATE INDEX idx_repair_projects_created_by ON public.repair_projects USING btree (created_by) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `create index "idx_repair_projects_publication_status" on "repair_projects" ("publication_status");`,
    );
    this.addSql(
      `create index "idx_repairs_building" on "repair_projects" ("building_name");`,
    );
    this.addSql(
      `create index "idx_repairs_campus" on "repair_projects" ("campus");`,
    );
    this.addSql(
      `create index "idx_repairs_emergency" on "repair_projects" ("is_emergency");`,
    );
    this.addSql(
      `create index "idx_repairs_status" on "repair_projects" ("status");`,
    );
    this.addSql(
      `create index "idx_repairs_type" on "repair_projects" ("repair_type_id");`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_project_code_unique";`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_project_code_key" unique ("project_code");`,
    );
    this.addSql(
      `alter table "repair_projects" drop constraint if exists "repair_projects_project_id_unique";`,
    );
    this.addSql(
      `alter table "repair_projects" add constraint "repair_projects_project_id_key" unique ("project_id");`,
    );

    this.addSql(
      `alter table "repair_types" add constraint "repair_types_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_types" add constraint "repair_types_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "repair_types" add constraint "repair_types_name_key" unique ("name");`,
    );

    this.addSql(
      `alter table "role_permissions" add constraint "role_permissions_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "role_permissions" add constraint "role_permissions_permission_id_fkey" foreign key ("permission_id") references "permissions" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "role_permissions" add constraint "role_permissions_role_id_fkey" foreign key ("role_id") references "roles" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "system_settings" alter column "data_type" type "setting_data_type_enum" using ("data_type"::"setting_data_type_enum");`,
    );
    this.addSql(
      `alter table "system_settings" alter column "is_public" type bool using ("is_public"::bool);`,
    );
    this.addSql(
      `alter table "system_settings" add constraint "system_settings_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "system_settings" add constraint "system_settings_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_sys_settings_group" on "system_settings" ("setting_group");`,
    );
    this.addSql(
      `alter table "system_settings" add constraint "system_settings_setting_key_key" unique ("setting_key");`,
    );

    this.addSql(
      `alter table "university_operations" alter column "operation_type" type "operation_type_enum" using ("operation_type"::"operation_type_enum");`,
    );
    this.addSql(
      `alter table "university_operations" alter column "status" type "project_status_enum" using ("status"::"project_status_enum");`,
    );
    this.addSql(
      `alter table "university_operations" alter column "campus" type "campus_enum" using ("campus"::"campus_enum");`,
    );
    this.addSql(
      `alter table "university_operations" alter column "publication_status" drop default;`,
    );
    this.addSql(
      `alter table "university_operations" alter column "publication_status" type "publication_status_enum" using ("publication_status"::"publication_status_enum");`,
    );
    this.addSql(
      `alter table "university_operations" alter column "publication_status" set default 'PUBLISHED'::"publication_status_enum";`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_status_q1_check" check("status_q1" in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'));`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_status_q2_check" check("status_q2" in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'));`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_status_q3_check" check("status_q3" in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'));`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_status_q4_check" check("status_q4" in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'));`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_assigned_to_fkey" foreign key ("assigned_to") references "users" ("id") on update no action on delete set null;`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_coordinator_id_fkey" foreign key ("coordinator_id") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_reviewed_by_fkey" foreign key ("reviewed_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_submitted_by_fkey" foreign key ("submitted_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `create index "idx_univ_ops_campus" on "university_operations" ("campus");`,
    );
    this.addSql(
      `create index "idx_univ_ops_coordinator" on "university_operations" ("coordinator_id");`,
    );
    this.addSql(
      `create index "idx_univ_ops_status" on "university_operations" ("status");`,
    );
    this.addSql(
      `create index "idx_univ_ops_type" on "university_operations" ("operation_type");`,
    );
    this.addSql(
      `create index "idx_university_operations_assigned_to" on "university_operations" ("assigned_to");`,
    );
    this.addSql(
      `CREATE INDEX idx_university_operations_campus ON public.university_operations USING btree (campus) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `CREATE INDEX idx_university_operations_campus_status ON public.university_operations USING btree (campus, publication_status) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `CREATE INDEX idx_university_operations_created_by ON public.university_operations USING btree (created_by) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `create index "idx_university_operations_publication_status" on "university_operations" ("publication_status");`,
    );
    this.addSql(
      `CREATE INDEX idx_uo_fiscal_year ON public.university_operations USING btree (fiscal_year) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `CREATE INDEX idx_uo_fiscal_year_campus ON public.university_operations USING btree (fiscal_year, campus) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `alter table "university_operations" drop constraint if exists "university_operations_code_unique";`,
    );
    this.addSql(
      `alter table "university_operations" add constraint "university_operations_code_key" unique ("code");`,
    );

    this.addSql(
      `alter table "user_departments" alter column "is_primary" type bool using ("is_primary"::bool);`,
    );
    this.addSql(
      `alter table "user_departments" add constraint "user_departments_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "user_departments" add constraint "user_departments_department_id_fkey" foreign key ("department_id") references "departments" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "user_departments" add constraint "user_departments_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete no action;`,
    );

    this.addSql(
      `alter table "user_module_assignments" alter column "module" type "module_type" using ("module"::"module_type");`,
    );
    this.addSql(
      `alter table "user_module_assignments" alter column "assigned_at" type timestamptz(6) using ("assigned_at"::timestamptz(6));`,
    );
    this.addSql(
      `alter table "user_module_assignments" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`,
    );
    this.addSql(
      `alter table "user_module_assignments" add constraint "user_module_assignments_assigned_by_fkey" foreign key ("assigned_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "user_module_assignments" add constraint "user_module_assignments_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `create index "idx_user_module_assignments_module" on "user_module_assignments" ("module");`,
    );
    this.addSql(
      `create index "idx_user_module_assignments_user_id" on "user_module_assignments" ("user_id");`,
    );
    this.addSql(
      `alter table "user_module_assignments" add constraint "uq_user_module_assignment" unique ("user_id", "module");`,
    );

    this.addSql(
      `alter table "user_permission_overrides" alter column "created_at" type timestamp(6) using ("created_at"::timestamp(6));`,
    );
    this.addSql(
      `alter table "user_permission_overrides" alter column "updated_at" type timestamp(6) using ("updated_at"::timestamp(6));`,
    );
    this.addSql(
      `alter table "user_permission_overrides" add constraint "user_permission_overrides_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "user_permission_overrides" add constraint "user_permission_overrides_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "user_permission_overrides" add constraint "user_permission_overrides_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `create index "idx_user_permission_overrides_module_key" on "user_permission_overrides" ("module_key");`,
    );
    this.addSql(
      `create index "idx_user_permission_overrides_user_id" on "user_permission_overrides" ("user_id");`,
    );
    this.addSql(
      `alter table "user_permission_overrides" add constraint "uq_user_module" unique ("user_id", "module_key");`,
    );

    this.addSql(
      `alter table "user_pillar_assignments" add constraint "user_pillar_assignments_pillar_type_check" check("pillar_type" in ('HIGHER_EDUCATION', 'ADVANCED_EDUCATION', 'RESEARCH', 'TECHNICAL_ADVISORY'));`,
    );
    this.addSql(
      `alter table "user_pillar_assignments" add constraint "user_pillar_assignments_assigned_by_fkey" foreign key ("assigned_by") references "users" ("id") on update no action on delete set null;`,
    );
    this.addSql(
      `alter table "user_pillar_assignments" add constraint "user_pillar_assignments_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `alter table "user_pillar_assignments" add constraint "uq_user_pillar" unique ("user_id", "pillar_type");`,
    );

    this.addSql(
      `alter table "user_roles" alter column "assigned_at" type timestamptz(6) using ("assigned_at"::timestamptz(6));`,
    );
    this.addSql(
      `alter table "user_roles" add constraint "user_roles_assigned_by_fkey" foreign key ("assigned_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "user_roles" add constraint "user_roles_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "user_roles" add constraint "user_roles_role_id_fkey" foreign key ("role_id") references "roles" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `alter table "user_roles" add constraint "user_roles_user_id_fkey" foreign key ("user_id") references "users" ("id") on update no action on delete cascade;`,
    );
    this.addSql(
      `create index "idx_user_roles_assigned_by" on "user_roles" ("assigned_by");`,
    );
    this.addSql(
      `CREATE INDEX idx_user_roles_is_superadmin ON public.user_roles USING btree (is_superadmin) WHERE (is_superadmin = true);`,
    );

    // this.addSql(`alter table "users" drop constraint if exists "users_username_unique";`);
    // this.addSql(`alter table "users" drop constraint if exists "users_email_unique";`);
    // this.addSql(
    //   `alter table "users" drop constraint if exists "users_google_id_unique";`,
    // );

    this.addSql(
      `alter table "users" add constraint "users_created_by_fkey" foreign key ("created_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(
      `alter table "users" add constraint "users_updated_by_fkey" foreign key ("updated_by") references "users" ("id") on update no action on delete no action;`,
    );
    this.addSql(`create index "idx_users_campus" on "users" ("campus");`);
    this.addSql(`create index "idx_users_email" on "users" ("email");`);
    this.addSql(
      `CREATE INDEX idx_users_google_id ON public.users USING btree (google_id) WHERE (google_id IS NOT NULL);`,
    );
    this.addSql(`create index "idx_users_is_active" on "users" ("is_active");`);
    this.addSql(
      `create index "idx_users_rank_level" on "users" ("rank_level");`,
    );
    this.addSql(`create index "idx_users_username" on "users" ("username");`);
    this.addSql(
      `CREATE INDEX idx_users_username_lower ON public.users USING btree (lower((username)::text));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX users_email_active_unique ON public.users USING btree (email) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX users_google_id_active_unique ON public.users USING btree (google_id) WHERE ((deleted_at IS NULL) AND (google_id IS NOT NULL));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX users_username_active_unique ON public.users USING btree (username) WHERE (deleted_at IS NULL);`,
    );
    this.addSql(
      `alter table "users" add constraint chk_users_rank_level check((rank_level >= 10) AND (rank_level <= 100));`,
    );
  }
}
