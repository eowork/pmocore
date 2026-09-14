import { Migration } from '@mikro-orm/migrations';

export class Migration20260914062746 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "construction_document_checklist" drop constraint if exists "construction_document_checklist_submission_status_check";`);

    this.addSql(`alter table "operation_financials" drop constraint if exists "operation_financials_expense_class_check";`);

    this.addSql(`alter table "user_pillar_assignments" drop constraint if exists "user_pillar_assignments_pillar_type_check";`);

    this.addSql(`alter table "construction_document_checklist" alter column "submission_status" type varchar(30) using ("submission_status"::varchar(30));`);

    this.addSql(`alter table "construction_projects" alter column "infra_project_uid" type bigint using ("infra_project_uid"::bigint);`);
    this.addSql(`alter table "construction_projects" alter column "infra_project_uid" set default nextval('construction_projects_infra_project_uid_seq'::regclass);`);

    this.addSql(`alter table "operation_financials" alter column "expense_class" type varchar(100) using ("expense_class"::varchar(100));`);

    this.addSql(`alter table "user_pillar_assignments" alter column "pillar_type" type varchar(50) using ("pillar_type"::varchar(50));`);

    // NOT dropped: public.user_has_module_access(uuid, module_type) still depends on
    // this type (see Migration20260914031228's comment) — mikro-orm has no entity-level
    // way to remember this across generations since it's a bare orphaned type with no
    // column referencing it, so every future migration:create will re-propose dropping
    // it. Strip it by hand each time, same as here.
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "construction_document_checklist" add constraint "construction_document_checklist_submission_status_check" check("submission_status" in ('NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'));`);

    this.addSql(`alter table "operation_financials" add constraint "operation_financials_expense_class_check" check("expense_class" in ('PS', 'MOOE', 'CO'));`);

    this.addSql(`alter table "user_pillar_assignments" add constraint "user_pillar_assignments_pillar_type_check" check("pillar_type" in ('HIGHER_EDUCATION', 'ADVANCED_EDUCATION', 'RESEARCH', 'TECHNICAL_ADVISORY'));`);
  }

}
