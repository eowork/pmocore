import { Migration } from '@mikro-orm/migrations';

export class Migration20260915040700 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "construction_document_checklist" drop constraint if exists "construction_document_checklist_submission_status_check";`);

    this.addSql(`alter table "operation_financials" drop constraint if exists "operation_financials_expense_class_check";`);

    this.addSql(`alter table "user_pillar_assignments" drop constraint if exists "user_pillar_assignments_pillar_type_check";`);

    this.addSql(`alter table "construction_document_checklist" alter column "submission_status" type varchar(30) using ("submission_status"::varchar(30));`);

    this.addSql(`alter table "construction_projects" alter column "infra_project_uid" type bigint using ("infra_project_uid"::bigint);`);
    this.addSql(`alter table "construction_projects" alter column "infra_project_uid" set default nextval('construction_projects_infra_project_uid_seq'::regclass);`);
    this.addSql(`alter table "construction_projects" alter column "physical_progress" type decimal(5,2) using ("physical_progress"::decimal(5,2));`);
    this.addSql(`alter table "construction_projects" alter column "physical_progress" set not null;`);
    this.addSql(`alter table "construction_projects" alter column "financial_progress" type decimal(5,2) using ("financial_progress"::decimal(5,2));`);
    this.addSql(`alter table "construction_projects" alter column "financial_progress" set not null;`);
    this.addSql(`alter table "construction_projects" alter column "target_physical_progress" type decimal(5,2) using ("target_physical_progress"::decimal(5,2));`);
    this.addSql(`alter table "construction_projects" alter column "target_physical_progress" set not null;`);
    this.addSql(`alter table "construction_projects" alter column "target_financial_progress" type decimal(5,2) using ("target_financial_progress"::decimal(5,2));`);
    this.addSql(`alter table "construction_projects" alter column "target_financial_progress" set not null;`);
    this.addSql(`alter table "construction_projects" alter column "custom_key_sections" type jsonb using ("custom_key_sections"::jsonb);`);
    this.addSql(`alter table "construction_projects" alter column "custom_key_sections" set not null;`);
    this.addSql(`alter table "construction_projects" alter column "custom_supporting_sections" type jsonb using ("custom_supporting_sections"::jsonb);`);
    this.addSql(`alter table "construction_projects" alter column "custom_supporting_sections" set not null;`);

    this.addSql(`alter table "media" alter column "media_type" type media_type_enum using ("media_type"::media_type_enum);`);

    this.addSql(`alter table "operation_financials" alter column "expense_class" type varchar(4) using ("expense_class"::varchar(4));`);

    this.addSql(`alter table "repair_projects" alter column "physical_progress" type decimal(5,2) using ("physical_progress"::decimal(5,2));`);
    this.addSql(`alter table "repair_projects" alter column "physical_progress" set not null;`);
    this.addSql(`alter table "repair_projects" alter column "financial_progress" type decimal(5,2) using ("financial_progress"::decimal(5,2));`);
    this.addSql(`alter table "repair_projects" alter column "financial_progress" set not null;`);

    this.addSql(`alter table "system_settings" alter column "is_public" type boolean using ("is_public"::boolean);`);
    this.addSql(`alter table "system_settings" alter column "is_public" set not null;`);

    this.addSql(`alter table "university_operations" alter column "publication_status" type varchar(20) using ("publication_status"::varchar(20));`);
    this.addSql(`alter table "university_operations" alter column "publication_status" set not null;`);

    this.addSql(`alter table "user_departments" alter column "is_primary" type boolean using ("is_primary"::boolean);`);
    this.addSql(`alter table "user_departments" alter column "is_primary" set not null;`);

    this.addSql(`alter table "user_module_assignments" alter column "assigned_at" type timestamptz using ("assigned_at"::timestamptz);`);
    this.addSql(`alter table "user_module_assignments" alter column "assigned_at" set not null;`);
    this.addSql(`alter table "user_module_assignments" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "user_module_assignments" alter column "created_at" set not null;`);

    this.addSql(`alter table "user_permission_overrides" alter column "created_at" type timestamp using ("created_at"::timestamp);`);
    this.addSql(`alter table "user_permission_overrides" alter column "created_at" set not null;`);
    this.addSql(`alter table "user_permission_overrides" alter column "updated_at" type timestamp using ("updated_at"::timestamp);`);
    this.addSql(`alter table "user_permission_overrides" alter column "updated_at" set not null;`);

    this.addSql(`alter table "user_pillar_assignments" alter column "pillar_type" type varchar(50) using ("pillar_type"::varchar(50));`);

    this.addSql(`alter table "user_roles" alter column "assigned_at" type timestamptz using ("assigned_at"::timestamptz);`);
    this.addSql(`alter table "user_roles" alter column "assigned_at" set not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "construction_document_checklist" add constraint "construction_document_checklist_submission_status_check" check("submission_status" in ('NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'));`);

    this.addSql(`alter table "construction_projects" alter column "infra_project_uid" type int8 using ("infra_project_uid"::int8);`);
    this.addSql(`alter table "construction_projects" alter column "physical_progress" type numeric(5,2) using ("physical_progress"::numeric(5,2));`);
    this.addSql(`alter table "construction_projects" alter column "physical_progress" drop not null;`);
    this.addSql(`alter table "construction_projects" alter column "financial_progress" type numeric(5,2) using ("financial_progress"::numeric(5,2));`);
    this.addSql(`alter table "construction_projects" alter column "financial_progress" drop not null;`);
    this.addSql(`alter table "construction_projects" alter column "target_physical_progress" type numeric(5,2) using ("target_physical_progress"::numeric(5,2));`);
    this.addSql(`alter table "construction_projects" alter column "target_physical_progress" drop not null;`);
    this.addSql(`alter table "construction_projects" alter column "target_financial_progress" type numeric(5,2) using ("target_financial_progress"::numeric(5,2));`);
    this.addSql(`alter table "construction_projects" alter column "target_financial_progress" drop not null;`);
    this.addSql(`alter table "construction_projects" alter column "custom_key_sections" type jsonb using ("custom_key_sections"::jsonb);`);
    this.addSql(`alter table "construction_projects" alter column "custom_key_sections" drop not null;`);
    this.addSql(`alter table "construction_projects" alter column "custom_supporting_sections" type jsonb using ("custom_supporting_sections"::jsonb);`);
    this.addSql(`alter table "construction_projects" alter column "custom_supporting_sections" drop not null;`);
    this.addSql(`create sequence if not exists "construction_projects_infra_project_uid_seq";`);
    this.addSql(`select setval('construction_projects_infra_project_uid_seq', (select max("infra_project_uid") from "construction_projects"));`);
    this.addSql(`alter table "construction_projects" alter column "infra_project_uid" set default nextval('construction_projects_infra_project_uid_seq');`);

    this.addSql(`alter table "operation_financials" add constraint "operation_financials_expense_class_check" check("expense_class" in ('PS', 'MOOE', 'CO'));`);

    this.addSql(`alter table "repair_projects" alter column "physical_progress" type numeric(5,2) using ("physical_progress"::numeric(5,2));`);
    this.addSql(`alter table "repair_projects" alter column "physical_progress" drop not null;`);
    this.addSql(`alter table "repair_projects" alter column "financial_progress" type numeric(5,2) using ("financial_progress"::numeric(5,2));`);
    this.addSql(`alter table "repair_projects" alter column "financial_progress" drop not null;`);

    this.addSql(`alter table "system_settings" alter column "is_public" type bool using ("is_public"::bool);`);
    this.addSql(`alter table "system_settings" alter column "is_public" drop not null;`);

    this.addSql(`alter table "university_operations" alter column "publication_status" type varchar(20) using ("publication_status"::varchar(20));`);
    this.addSql(`alter table "university_operations" alter column "publication_status" drop not null;`);

    this.addSql(`alter table "user_departments" alter column "is_primary" type bool using ("is_primary"::bool);`);
    this.addSql(`alter table "user_departments" alter column "is_primary" drop not null;`);

    this.addSql(`alter table "user_module_assignments" alter column "assigned_at" type timestamptz(6) using ("assigned_at"::timestamptz(6));`);
    this.addSql(`alter table "user_module_assignments" alter column "assigned_at" drop not null;`);
    this.addSql(`alter table "user_module_assignments" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "user_module_assignments" alter column "created_at" drop not null;`);

    this.addSql(`alter table "user_permission_overrides" alter column "created_at" type timestamp(6) using ("created_at"::timestamp(6));`);
    this.addSql(`alter table "user_permission_overrides" alter column "created_at" drop not null;`);
    this.addSql(`alter table "user_permission_overrides" alter column "updated_at" type timestamp(6) using ("updated_at"::timestamp(6));`);
    this.addSql(`alter table "user_permission_overrides" alter column "updated_at" drop not null;`);

    this.addSql(`alter table "user_pillar_assignments" add constraint "user_pillar_assignments_pillar_type_check" check("pillar_type" in ('HIGHER_EDUCATION', 'ADVANCED_EDUCATION', 'RESEARCH', 'TECHNICAL_ADVISORY'));`);

    this.addSql(`alter table "user_roles" alter column "assigned_at" type timestamptz(6) using ("assigned_at"::timestamptz(6));`);
    this.addSql(`alter table "user_roles" alter column "assigned_at" drop not null;`);
  }

}
