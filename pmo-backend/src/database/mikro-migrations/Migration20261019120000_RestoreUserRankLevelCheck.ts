import { Migration } from '@mikro-orm/migrations';

/**
 * Restores users.chk_users_rank_level where it is missing.
 *
 * The first version of Migration20261019030114 carried a generated
 * `alter table "users" drop constraint chk_users_rank_level` — the differ emits it because no
 * entity models the check, not because anyone meant to remove it. That version ran on
 * development before the statement was taken out, so those databases lost the guard while a
 * database built from schema/coredata_schema.sql still has it.
 *
 * Guarded, so it repairs the databases that lost it and is a no-op everywhere else.
 */
export class Migration20261019120000_RestoreUserRankLevelCheck extends Migration {
  override async up(): Promise<void> {
    this.addSql(`do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conname = 'chk_users_rank_level' and conrelid = '"users"'::regclass
      ) then
        alter table "users" add constraint chk_users_rank_level
          check ((rank_level >= 10) and (rank_level <= 100));
      end if;
    end $$;`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "users" drop constraint if exists chk_users_rank_level;`,
    );
  }
}
