import { Migration } from '@mikro-orm/migrations';

/**
 * Adds the future-goals section and the date an initiative was conducted.
 *
 * Guarded the same way as Migration20261013030328: the UPR tables were pushed to development
 * databases with `schema:update --run` while the feature was being built, so these objects can
 * already exist with nothing recorded in mikro_orm_migrations.
 */
export class Migration20261019030114_add_conducted_date_upr extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "upr_future_goals" ("id" uuid not null default gen_random_uuid(), "report_id" uuid not null, "initiative" text not null, "target_date_of_completion" date null, "outcomes" text[] not null, "sort_order" int not null, "deleted_at" timestamptz null, constraint "upr_future_goals_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "upr_future_goals_report_id_index" on "upr_future_goals" ("report_id");`,
    );
    this.addSql(`do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conname = 'upr_future_goals_report_id_foreign'
          and conrelid = '"upr_future_goals"'::regclass
      ) then
        alter table "upr_future_goals"
          add constraint "upr_future_goals_report_id_foreign"
          foreign key ("report_id") references "upr_reports" ("id")
          on update cascade on delete cascade;
      end if;
    end $$;`);

    this.addSql(
      `alter table "upr_initiatives" add column if not exists "date_conducted" timestamptz not null default now();`,
    );

    // The generator also wanted to drop "users".chk_users_rank_level and to recreate
    // upr_reports_quarter_check with the same rule written differently. Both were removed by
    // hand. chk_users_rank_level is a live guard that ships in schema/coredata_schema.sql and
    // no entity models it, so the differ reads it as unwanted every time it runs; dropping it
    // here would take rank_level validation off production and up() would never put it back.
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "upr_initiatives" drop column if exists "date_conducted";`,
    );
    this.addSql(`drop table if exists "upr_future_goals" cascade;`);
  }
}
