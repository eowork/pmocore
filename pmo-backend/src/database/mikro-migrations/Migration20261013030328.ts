import { Migration } from '@mikro-orm/migrations';

/**
 * Creates the UPR report tables.
 *
 * Every statement is guarded, because these objects can already exist before this migration
 * ever runs: the UPR entities were pushed to development databases with `schema:update --run`
 * while the feature was being built, which creates the same tables, indexes and constraints
 * under the same names but records nothing in mikro_orm_migrations. Unguarded DDL fails there
 * on "type upr_status_enum already exists", and because the migrator runs the whole pending
 * queue in one transaction, that failure rolls back every other migration with it — the
 * database can then never move forward on any boot.
 *
 * The guards make the migration a no-op against such a database and a normal create against a
 * fresh one. Postgres offers `if not exists` for types only through a DO block, and no form of
 * it at all for `add constraint`, hence the two helpers below.
 */
export class Migration20261013030328 extends Migration {
  /** `create type` that tolerates the type already being there. */
  private createEnum(name: string, values: string[]): string {
    const labels = values.map((value) => `'${value}'`).join(', ');
    return `do $$ begin
      if not exists (select 1 from pg_type where typname = '${name}') then
        create type "${name}" as enum (${labels});
      end if;
    end $$;`;
  }

  /** `alter table ... add constraint` that tolerates the constraint already being there. */
  private addConstraint(
    table: string,
    name: string,
    definition: string,
  ): string {
    return `do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conname = '${name}' and conrelid = '"${table}"'::regclass
      ) then
        alter table "${table}" add constraint "${name}" ${definition};
      end if;
    end $$;`;
  }

  override async up(): Promise<void> {
    this.addSql(
      this.createEnum('upr_status_enum', [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'APPROVED',
        'RETURNED',
      ]),
    );
    this.addSql(
      this.createEnum('challenge_opportunity_type_enum', [
        'CHALLENGE',
        'OPPORTUNITY',
      ]),
    );

    this.addSql(
      `create table if not exists "upr_reports" ("id" uuid not null default gen_random_uuid(), "office_name" varchar(150) not null, "fiscal_year" int not null, "quarter" int not null, "unit_office_profile" text not null, "quality_objective" text not null, "status" "upr_status_enum" not null default 'DRAFT', "prepared_by" uuid not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz null, "deleted_at" timestamptz null, constraint "upr_reports_pkey" primary key ("id"), constraint upr_reports_quarter_check check ("quarter" between 1 and 4));`,
    );
    this.addSql(
      `create index if not exists "upr_reports_prepared_by_index" on "upr_reports" ("prepared_by");`,
    );
    this.addSql(
      `create unique index if not exists "uq_upr_reports_office_period" on "upr_reports" ("office_name", "fiscal_year", "quarter") where "deleted_at" is null;`,
    );

    this.addSql(
      `create table if not exists "upr_challenges_opportunities" ("id" uuid not null default gen_random_uuid(), "report_id" uuid not null, "item_type" "challenge_opportunity_type_enum" not null, "description" text not null, "sort_order" int not null, "deleted_at" timestamptz null, constraint "upr_challenges_opportunities_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "upr_challenges_opportunities_report_id_index" on "upr_challenges_opportunities" ("report_id");`,
    );

    this.addSql(
      `create table if not exists "upr_best_practices" ("id" uuid not null default gen_random_uuid(), "report_id" uuid not null, "description" text not null, "sort_order" int not null, "deleted_at" timestamptz null, constraint "upr_best_practices_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "upr_best_practices_report_id_index" on "upr_best_practices" ("report_id");`,
    );

    this.addSql(
      `create table if not exists "upr_attachments" ("id" uuid not null default gen_random_uuid(), "report_id" uuid null, "uploaded_by" uuid not null, "original_filename" varchar(255) not null, "object_key" varchar(255) not null, "bucket_name" varchar(255) null, "mime_type" varchar(255) null, "file_size" bigint not null, "checksum_sha256" varchar(64) null, "attachment_type" varchar(255) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz null, "deleted_at" timestamptz null, constraint "upr_attachments_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "upr_attachments_report_id_index" on "upr_attachments" ("report_id");`,
    );
    this.addSql(
      `create index if not exists "upr_attachments_uploaded_by_index" on "upr_attachments" ("uploaded_by");`,
    );
    this.addSql(
      this.addConstraint(
        'upr_attachments',
        'uq_object_key',
        'unique ("object_key")',
      ),
    );

    this.addSql(
      `create table if not exists "upr_initiatives" ("id" uuid not null default gen_random_uuid(), "report_id" uuid not null, "title" varchar(150) not null, "description" text not null, "drive_link" text null, "attachment_id" uuid null, "sort_order" int not null, "deleted_at" timestamptz null, constraint "upr_initiatives_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "upr_initiatives_report_id_index" on "upr_initiatives" ("report_id");`,
    );
    this.addSql(
      this.addConstraint(
        'upr_initiatives',
        'upr_initiatives_attachment_id_unique',
        'unique ("attachment_id")',
      ),
    );

    this.addSql(
      this.addConstraint(
        'upr_reports',
        'upr_reports_prepared_by_foreign',
        'foreign key ("prepared_by") references "users" ("id") on update cascade on delete restrict',
      ),
    );

    this.addSql(
      this.addConstraint(
        'upr_challenges_opportunities',
        'upr_challenges_opportunities_report_id_foreign',
        'foreign key ("report_id") references "upr_reports" ("id") on update cascade on delete cascade',
      ),
    );

    this.addSql(
      this.addConstraint(
        'upr_best_practices',
        'upr_best_practices_report_id_foreign',
        'foreign key ("report_id") references "upr_reports" ("id") on update cascade on delete cascade',
      ),
    );

    this.addSql(
      this.addConstraint(
        'upr_attachments',
        'upr_attachments_report_id_foreign',
        'foreign key ("report_id") references "upr_reports" ("id") on update cascade on delete cascade',
      ),
    );
    this.addSql(
      this.addConstraint(
        'upr_attachments',
        'upr_attachments_uploaded_by_foreign',
        'foreign key ("uploaded_by") references "users" ("id") on update cascade on delete restrict',
      ),
    );

    this.addSql(
      this.addConstraint(
        'upr_initiatives',
        'upr_initiatives_report_id_foreign',
        'foreign key ("report_id") references "upr_reports" ("id") on update cascade on delete cascade',
      ),
    );
    this.addSql(
      this.addConstraint(
        'upr_initiatives',
        'upr_initiatives_attachment_id_foreign',
        'foreign key ("attachment_id") references "upr_attachments" ("id") on update cascade on delete set null',
      ),
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
