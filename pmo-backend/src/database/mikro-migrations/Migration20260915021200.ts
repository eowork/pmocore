import { Migration } from '@mikro-orm/migrations';

export class Migration20260915021200 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "construction_projects" alter column "infra_project_uid" type bigint using ("infra_project_uid"::bigint);`);
    this.addSql(`alter table "construction_projects" alter column "infra_project_uid" set default nextval('construction_projects_infra_project_uid_seq'::regclass);`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "construction_projects" alter column "infra_project_uid" type bigint using ("infra_project_uid"::bigint);`);
    this.addSql(`alter table "construction_projects" alter column "infra_project_uid" set default nextval('construction_projects_infra_project_uid_seq'::regclass);`);
  }

}
