import { Migration } from '@mikro-orm/migrations';

export class Migration20260907055439 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "roles" drop column "metadata";`);

    this.addSql(
      `alter table "roles" add column "display_name" varchar(255) null, add column "rank" int null, add column "is_system" boolean not null default false, add column "created_by" uuid null, add column "updated_by" uuid null;`,
    );
    this.addSql(
      `alter table "roles" alter column "name" type varchar(100) using ("name"::varchar(100));`,
    );
    this.addSql(`alter table "roles" drop constraint "roles_name_key";`);
    this.addSql(
      `alter table "roles" add constraint "roles_name_unique" unique ("name");`,
    );
  }
}
