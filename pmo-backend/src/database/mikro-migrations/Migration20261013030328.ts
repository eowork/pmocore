import { Migration } from '@mikro-orm/migrations';

export class Migration20261013030328 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create type "upr_status_enum" as enum ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'RETURNED');`,
    );
    this.addSql(
      `create type "challenge_opportunity_type_enum" as enum ('CHALLENGE', 'OPPORTUNITY');`,
    );
    this.addSql(
      `create table "upr_reports" ("id" uuid not null default gen_random_uuid(), "office_name" varchar(150) not null, "fiscal_year" int not null, "quarter" int not null, "unit_office_profile" text not null, "quality_objective" text not null, "status" "upr_status_enum" not null default 'DRAFT', "prepared_by" uuid not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz null, "deleted_at" timestamptz null, constraint "upr_reports_pkey" primary key ("id"), constraint upr_reports_quarter_check check ("quarter" between 1 and 4));`,
    );
    this.addSql(
      `create index "upr_reports_prepared_by_index" on "upr_reports" ("prepared_by");`,
    );
    this.addSql(
      `create unique index "uq_upr_reports_office_period" on "upr_reports" ("office_name", "fiscal_year", "quarter") where "deleted_at" is null;`,
    );

    this.addSql(
      `create table "upr_challenges_opportunities" ("id" uuid not null default gen_random_uuid(), "report_id" uuid not null, "item_type" "challenge_opportunity_type_enum" not null, "description" text not null, "sort_order" int not null, "deleted_at" timestamptz null, constraint "upr_challenges_opportunities_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "upr_challenges_opportunities_report_id_index" on "upr_challenges_opportunities" ("report_id");`,
    );

    this.addSql(
      `create table "upr_best_practices" ("id" uuid not null default gen_random_uuid(), "report_id" uuid not null, "description" text not null, "sort_order" int not null, "deleted_at" timestamptz null, constraint "upr_best_practices_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "upr_best_practices_report_id_index" on "upr_best_practices" ("report_id");`,
    );

    this.addSql(
      `create table "upr_attachments" ("id" uuid not null default gen_random_uuid(), "report_id" uuid null, "uploaded_by" uuid not null, "original_filename" varchar(255) not null, "object_key" varchar(255) not null, "bucket_name" varchar(255) null, "mime_type" varchar(255) null, "file_size" bigint not null, "checksum_sha256" varchar(64) null, "attachment_type" varchar(255) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz null, "deleted_at" timestamptz null, constraint "upr_attachments_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "upr_attachments_report_id_index" on "upr_attachments" ("report_id");`,
    );
    this.addSql(
      `create index "upr_attachments_uploaded_by_index" on "upr_attachments" ("uploaded_by");`,
    );
    this.addSql(
      `alter table "upr_attachments" add constraint "uq_object_key" unique ("object_key");`,
    );

    this.addSql(
      `create table "upr_initiatives" ("id" uuid not null default gen_random_uuid(), "report_id" uuid not null, "title" varchar(150) not null, "description" text not null, "drive_link" text null, "attachment_id" uuid null, "sort_order" int not null, "deleted_at" timestamptz null, constraint "upr_initiatives_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "upr_initiatives_report_id_index" on "upr_initiatives" ("report_id");`,
    );
    this.addSql(
      `alter table "upr_initiatives" add constraint "upr_initiatives_attachment_id_unique" unique ("attachment_id");`,
    );

    this.addSql(
      `alter table "upr_reports" add constraint "upr_reports_prepared_by_foreign" foreign key ("prepared_by") references "users" ("id") on update cascade on delete restrict;`,
    );

    this.addSql(
      `alter table "upr_challenges_opportunities" add constraint "upr_challenges_opportunities_report_id_foreign" foreign key ("report_id") references "upr_reports" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "upr_best_practices" add constraint "upr_best_practices_report_id_foreign" foreign key ("report_id") references "upr_reports" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "upr_attachments" add constraint "upr_attachments_report_id_foreign" foreign key ("report_id") references "upr_reports" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "upr_attachments" add constraint "upr_attachments_uploaded_by_foreign" foreign key ("uploaded_by") references "users" ("id") on update cascade on delete restrict;`,
    );

    this.addSql(
      `alter table "upr_initiatives" add constraint "upr_initiatives_report_id_foreign" foreign key ("report_id") references "upr_reports" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "upr_initiatives" add constraint "upr_initiatives_attachment_id_foreign" foreign key ("attachment_id") references "upr_attachments" ("id") on update cascade on delete set null;`,
    );
  }

  // Written by hand. The migration generator runs with `safe: true`, so it emits no drop
  // statements at all; left alone it produces a down() that creates an unrelated enum and
  // leaves all five tables behind.
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "upr_initiatives" cascade;`);
    this.addSql(`drop table if exists "upr_attachments" cascade;`);
    this.addSql(`drop table if exists "upr_best_practices" cascade;`);
    this.addSql(`drop table if exists "upr_challenges_opportunities" cascade;`);
    this.addSql(`drop table if exists "upr_reports" cascade;`);

    this.addSql(`drop type if exists "challenge_opportunity_type_enum";`);
    this.addSql(`drop type if exists "upr_status_enum";`);
  }
}
