/**
 * Selective restore of construction-project data from a pg_dump archive.
 *
 * WHY THIS EXISTS
 * pg_restore can pick tables (--table) but never rows. Restoring the construction module
 * from a backup therefore means one of two bad options: restore whole tables and lose
 * every row created in production since the dump, or restore the whole database and lose
 * everything else. Neither is what "put the construction projects back" means.
 *
 * This script takes the third route: the archive is restored into a throwaway STAGING
 * database, and only the rows that belong to construction projects are copied forward,
 * row by row, into the live database.
 *
 * WHAT IS COPIED
 *   construction_projects and every construction_* table carrying a project_id
 *   documents            where documentable_type = 'CONSTRUCTION_PROJECT'
 *   record_assignments   where module in ('CONSTRUCTION','CONSTRUCTION_PROJECT')
 *   activity_logs        where entity_type starts with 'CONSTRUCTION'
 *   the lookup rows those depend on (projects, contractors, funding_sources,
 *   construction_subcategories, construction_document_types)
 *   ONLY the users referenced by the rows above — creators, submitters, reviewers,
 *   uploaders, assignees — never the whole users table
 *
 * USERS ARE MATCHED, NOT DUPLICATED
 * A user is looked up in the target first by id, then by e-mail. Same person carrying a
 * different id in the backup is remapped: every created_by / reviewed_by / uploaded_by
 * value is rewritten to the target's id as the row is copied. Only a user who exists in
 * neither is inserted, and an existing target user is NEVER overwritten — their password,
 * status and roles are left exactly as they are.
 *
 * CONFLICT POLICY
 *   construction data, assignments, logs → UPSERT (the backup wins, per the request to
 *     override existing construction rows)
 *   documents                            → UPSERT by default, or INSERT IF MISSING with
 *     --documents=insert-missing, which leaves a document edited since the backup alone
 *   lookups and users                    → INSERT IF MISSING (target wins)
 *
 * SCHEMA DRIFT IS HANDLED
 * The archive is older than the live schema, so for every table only the columns present
 * in BOTH databases are copied, values move as text and are cast to the live column type
 * on the way in. A column added since the dump keeps its default; a column dropped since
 * is ignored. Both are reported.
 *
 * SAFETY
 *   - DRY RUN by default. Nothing is committed without --apply.
 *   - The whole copy runs in ONE transaction: it either all lands or none of it does.
 *   - A dry run still performs every insert, then rolls back, so the printed counts are
 *     real rather than estimated.
 *   - The staging database is created and dropped by the script; it never writes to the
 *     archive and never deletes a row in the target.
 *
 * USAGE
 *   node scripts/restore-construction-from-dump.js --dump "Database Backups/db.dump"
 *   node scripts/restore-construction-from-dump.js --dump <file> --apply
 *   node scripts/restore-construction-from-dump.js --dump <file> --project <uuid> --apply
 *
 * OPTIONS
 *   --dump <path>          The archive. Required unless --staging-url points at a database
 *                          that already holds a restore.
 *   --apply                Commit. Without it the script rolls back and only reports.
 *   --project <uuid>       Restrict to one project. Repeatable. Default: every project in
 *                          the archive.
 *   --target-url <url>     Live database. Default: DATABASE_URL, else DATABASE_* / POSTGRES_*.
 *   --staging-url <url>    Use an existing staging database instead of restoring one.
 *   --staging-db <name>    Name for the staging database the script creates.
 *   --keep-staging         Leave the staging database behind for inspection.
 *   --missing-users <mode> insert (default) | null | fail — what to do with a referenced
 *                          user that exists in neither database.
 *   --documents <policy>   upsert (default) | insert-missing — how to treat a document
 *                          row that already exists in the target. upsert restores the
 *                          backup's version over it; insert-missing keeps the live row and
 *                          adds only documents the target does not have. Metadata only:
 *                          neither policy touches the stored file.
 *   --skip-activity-logs   Leave the audit trail alone.
 *   --no-user-roles        Do not copy role assignments for users this script inserts.
 */

const { Client } = require('pg');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '../.env') });
  dotenv.config({ path: path.join(__dirname, '../../.env') });
} catch {
  // No dotenv available — rely on the process environment.
}

// ── configuration ───────────────────────────────────────────────────────────

/** Lookup tables a construction project points at. Copied only when absent in the target. */
const LOOKUP_TABLES = [
  { table: 'projects', via: 'construction_projects.project_id' },
  { table: 'contractors', via: 'construction_projects.contractor_id' },
  { table: 'funding_sources', via: 'construction_projects.funding_source_id' },
  { table: 'construction_subcategories', via: 'construction_projects.subcategory_id' },
  { table: 'construction_document_types', via: 'construction_document_checklist.document_type_id' },
];

/** Tables scoped by a discriminator plus an id that points back at a project. */
const POLYMORPHIC_TABLES = [
  {
    table: 'documents',
    idColumn: 'documentable_id',
    where: "documentable_type = 'CONSTRUCTION_PROJECT'",
  },
  {
    table: 'record_assignments',
    idColumn: 'record_id',
    where: "module IN ('CONSTRUCTION','CONSTRUCTION_PROJECT')",
  },
  {
    table: 'activity_logs',
    idColumn: 'entity_id',
    where: "entity_type LIKE 'CONSTRUCTION%'",
    optional: true, // skipped by --skip-activity-logs
  },
];

/**
 * Columns that hold a user id.
 *
 * Matched by name rather than by foreign key: the live schema carries only one FK
 * constraint in total, so the relationships are conventions the application enforces, and
 * a name pattern is the only thing that still describes them.
 */
const USER_COLUMN_PATTERN =
  /^(created_by|updated_by|deleted_by|uploaded_by|submitted_by|reviewed_by|approved_by|assigned_to|assigned_by|user_id|verified_by|acknowledged_by|performed_by|added_by)$/;

/** Never treated as a user reference even though the name matches the pattern above. */
const USER_COLUMN_EXCEPTIONS = new Set(['activity_logs.entity_id']);

const CHUNK_SIZE = 200;

// ── argument parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    apply: false,
    dump: null,
    projects: [],
    targetUrl: null,
    stagingUrl: null,
    stagingDb: `coi_restore_staging_${Date.now()}`,
    keepStaging: false,
    missingUsers: 'insert',
    skipActivityLogs: false,
    userRoles: true,
    documents: 'upsert',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--dump') args.dump = argv[++i];
    else if (a === '--project') args.projects.push(argv[++i]);
    else if (a === '--target-url') args.targetUrl = argv[++i];
    else if (a === '--staging-url') args.stagingUrl = argv[++i];
    else if (a === '--staging-db') args.stagingDb = argv[++i];
    else if (a === '--keep-staging') args.keepStaging = true;
    else if (a === '--missing-users') args.missingUsers = argv[++i];
    else if (a === '--documents') args.documents = argv[++i];
    else if (a === '--skip-activity-logs') args.skipActivityLogs = true;
    else if (a === '--no-user-roles') args.userRoles = false;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown option "${a}". Use --help.`);
  }
  if (!['insert', 'null', 'fail'].includes(args.missingUsers)) {
    throw new Error('--missing-users expects insert, null or fail');
  }
  if (!['upsert', 'insert-missing'].includes(args.documents)) {
    throw new Error('--documents expects upsert or insert-missing');
  }
  return args;
}

function envConnection() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'pmo_dashboard',
    user: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  };
}

function connectionFor(url) {
  return url ? { connectionString: url } : envConnection();
}

/** The same server as the target, but pointed at a different database. */
function adminConnection(targetConfig, database) {
  if (targetConfig.connectionString) {
    const u = new URL(targetConfig.connectionString);
    u.pathname = `/${database}`;
    return { connectionString: u.toString() };
  }
  return { ...targetConfig, database };
}

// ── schema helpers ──────────────────────────────────────────────────────────

async function tableColumns(client, table) {
  const res = await client.query(
    `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type
       FROM pg_attribute a
      WHERE a.attrelid = to_regclass($1)
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [`public.${table}`],
  );
  return res.rows;
}

async function tableExists(client, table) {
  const res = await client.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${table}`]);
  return res.rows[0].ok;
}

async function listConstructionChildTables(client) {
  const res = await client.query(
    `SELECT c.relname AS table
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'project_id' AND a.attnum > 0
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname LIKE 'construction%'
        AND c.relname <> 'construction_projects'
      ORDER BY c.relname`,
  );
  return res.rows.map((r) => r.table);
}

/**
 * A single-column UNIQUE constraint on the target, used as a lookup table's natural key.
 *
 * Without this the restore is a coin toss: a contractor or document type that exists in
 * both databases under different ids would either raise a unique violation and abort the
 * whole transaction, or slip through as a duplicate row. Matching on the natural key means
 * the target's copy wins and the archive's id is rewritten wherever it was referenced.
 */
async function naturalKeyOf(client, table) {
  const res = await client.query(
    `SELECT a.attname AS name
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.conrelid = to_regclass($1)
        AND c.contype = 'u'
        AND array_length(c.conkey, 1) = 1
        AND a.attname <> 'id'
      ORDER BY c.conname
      LIMIT 1`,
    [`public.${table}`],
  );
  return res.rows[0]?.name ?? null;
}

function userColumnsOf(table, columns) {
  return columns
    .filter((c) => USER_COLUMN_PATTERN.test(c.name))
    .filter((c) => !USER_COLUMN_EXCEPTIONS.has(`${table}.${c.name}`))
    .map((c) => c.name);
}

// ── copy engine ─────────────────────────────────────────────────────────────

/**
 * Read rows as text and write them back cast to the target's column types.
 *
 * Text is the only representation that survives a schema that has moved on since the
 * dump: a varchar that became an enum, a jsonb default that appeared, a point column —
 * each one casts cleanly from its own text form, and nothing has to be special-cased.
 */
async function copyRows(staging, target, spec, ctx) {
  const {
    table,
    where = 'TRUE',
    params = [],
    policy, // 'upsert' | 'insert-missing'
    conflictColumn = 'id',
  } = spec;

  const result = { table, read: 0, written: 0, skippedColumns: [], missingInTarget: false };

  if (!(await tableExists(staging, table))) {
    result.missingInStaging = true;
    return result;
  }
  if (!(await tableExists(target, table))) {
    result.missingInTarget = true;
    return result;
  }

  const stagingCols = await tableColumns(staging, table);
  const targetCols = await tableColumns(target, table);
  const targetByName = new Map(targetCols.map((c) => [c.name, c]));
  const shared = stagingCols.filter((c) => targetByName.has(c.name));
  result.skippedColumns = stagingCols.filter((c) => !targetByName.has(c.name)).map((c) => c.name);
  result.addedInTarget = targetCols
    .filter((c) => !stagingCols.some((s) => s.name === c.name))
    .map((c) => c.name);
  if (shared.length === 0) return result;

  const selectList = shared.map((c) => `"${c.name}"::text AS "${c.name}"`).join(', ');
  const rows = (await staging.query(`SELECT ${selectList} FROM "${table}" WHERE ${where}`, params))
    .rows;
  result.read = rows.length;
  if (rows.length === 0) return result;

  const userCols = new Set(userColumnsOf(table, shared));
  const names = shared.map((c) => c.name);
  const types = shared.map((c) => targetByName.get(c.name).type);

  const updateAssignments = names
    .filter((n) => n !== conflictColumn)
    .map((n) => `"${n}" = EXCLUDED."${n}"`)
    .join(', ');
  const conflictClause =
    policy === 'upsert' && updateAssignments
      ? `ON CONFLICT ("${conflictColumn}") DO UPDATE SET ${updateAssignments}`
      : `ON CONFLICT ("${conflictColumn}") DO NOTHING`;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const values = [];
    const tuples = [];
    for (const row of chunk) {
      const placeholders = names.map((name, idx) => {
        let value = row[name];
        if (value !== null && userCols.has(name)) value = ctx.remapUser(value);
        if (value !== null) value = ctx.remapRef(table, name, value);
        values.push(value);
        return `$${values.length}::${types[idx]}`;
      });
      tuples.push(`(${placeholders.join(', ')})`);
    }
    const sql =
      `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(', ')}) ` +
      `VALUES ${tuples.join(', ')} ${conflictClause}`;
    const res = await target.query(sql, values);
    result.written += res.rowCount;
  }
  return result;
}

// ── main ────────────────────────────────────────────────────────────────────

function log(line = '') {
  console.log(line);
}

function section(title) {
  log('');
  log(title);
  log('-'.repeat(Math.max(title.length, 60)));
}

async function restoreArchiveToStaging(args, targetConfig, state) {
  const dumpPath = path.resolve(args.dump);
  if (!fs.existsSync(dumpPath)) throw new Error(`Archive not found: ${dumpPath}`);

  const adminCfg = adminConnection(targetConfig, 'postgres');
  const admin = new Client(adminCfg);
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${args.stagingDb}"`);
  } finally {
    await admin.end();
  }
  // Flagged the moment the database exists, not when the restore succeeds: a pg_restore
  // failure used to leave an empty staging database behind on every attempt.
  state.created = true;
  log(`Created staging database ${args.stagingDb}`);

  const stagingCfg = adminConnection(targetConfig, args.stagingDb);
  const restoreArgs = ['--no-owner', '--no-privileges', '--no-comments', '--exit-on-error'];
  if (stagingCfg.connectionString) {
    restoreArgs.push(`--dbname=${stagingCfg.connectionString}`);
  } else {
    restoreArgs.push(
      `--host=${stagingCfg.host}`,
      `--port=${stagingCfg.port}`,
      `--username=${stagingCfg.user}`,
      `--dbname=${stagingCfg.database}`,
    );
  }
  restoreArgs.push(dumpPath);

  const env = { ...process.env };
  if (!stagingCfg.connectionString && stagingCfg.password) env.PGPASSWORD = stagingCfg.password;

  log(`Restoring archive into ${args.stagingDb} (pg_restore)…`);
  const run = spawnSync('pg_restore', restoreArgs, { env, encoding: 'utf8' });
  if (run.error && run.error.code === 'ENOENT') {
    throw new Error(
      'pg_restore is not on PATH. Either install the PostgreSQL client tools, or restore ' +
        'the archive yourself and re-run with --staging-url pointing at that database.',
    );
  }
  // pg_restore reports non-fatal notices on stderr; --exit-on-error makes status the truth.
  if (run.status !== 0) {
    throw new Error(`pg_restore failed (exit ${run.status}):\n${run.stderr}`);
  }
  return stagingCfg;
}

async function dropStaging(targetConfig, name) {
  const admin = new Client(adminConnection(targetConfig, 'postgres'));
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    log(`Dropped staging database ${name}`);
  } finally {
    await admin.end();
  }
}

async function buildUserMap(staging, target, projectIds, args, tablePlan) {
  // Every user id mentioned by any row this run will copy.
  const referenced = new Set();
  for (const spec of tablePlan) {
    if (!(await tableExists(staging, spec.table))) continue;
    const cols = userColumnsOf(spec.table, await tableColumns(staging, spec.table));
    if (!cols.length) continue;
    const union = cols.map((c) => `SELECT "${c}"::text AS uid FROM "${spec.table}" WHERE ${spec.where ?? 'TRUE'} AND "${c}" IS NOT NULL`).join(' UNION ');
    const res = await staging.query(union, spec.params ?? []);
    for (const row of res.rows) referenced.add(row.uid);
  }

  const map = new Map();
  const report = { referenced: referenced.size, matchedById: 0, matchedByEmail: 0, inserted: 0, missing: [] };
  if (referenced.size === 0) return { map, report };

  const ids = [...referenced];
  const stagedUsers = (
    await staging.query(
      `SELECT id::text AS id, lower(email) AS email, username FROM users WHERE id::text = ANY($1)`,
      [ids],
    )
  ).rows;
  const stagedById = new Map(stagedUsers.map((u) => [u.id, u]));

  const targetById = new Set(
    (await target.query(`SELECT id::text AS id FROM users WHERE id::text = ANY($1)`, [ids])).rows.map(
      (r) => r.id,
    ),
  );
  const emails = stagedUsers.map((u) => u.email).filter(Boolean);
  const targetByEmail = new Map(
    (
      await target.query(
        `SELECT id::text AS id, lower(email) AS email FROM users WHERE lower(email) = ANY($1)`,
        [emails.length ? emails : ['']],
      )
    ).rows.map((r) => [r.email, r.id]),
  );

  for (const id of ids) {
    if (targetById.has(id)) {
      map.set(id, id);
      report.matchedById++;
      continue;
    }
    const staged = stagedById.get(id);
    const byEmail = staged?.email ? targetByEmail.get(staged.email) : null;
    if (byEmail) {
      map.set(id, byEmail);
      report.matchedByEmail++;
      continue;
    }
    report.missing.push({ id, email: staged?.email ?? null, username: staged?.username ?? null });
  }

  if (report.missing.length) {
    if (args.missingUsers === 'fail') {
      throw new Error(
        `${report.missing.length} referenced user(s) exist in neither database. ` +
          'Re-run with --missing-users insert or --missing-users null.',
      );
    }
    if (args.missingUsers === 'null') {
      for (const m of report.missing) map.set(m.id, null);
    } else {
      const missingIds = report.missing.map((m) => m.id);
      const copied = await copyRows(
        staging,
        target,
        {
          table: 'users',
          where: 'id::text = ANY($1)',
          params: [missingIds],
          policy: 'insert-missing',
        },
        { remapUser: (v) => v },
      );
      report.inserted = copied.written;
      for (const m of report.missing) map.set(m.id, m.id);

      if (args.userRoles && copied.written > 0) {
        // A user with no role cannot log in, so their role assignments come along. Role ids
        // are remapped by role NAME: the reference table is seeded per environment and the
        // ids are not guaranteed to agree between the two databases.
        const roles = (
          await staging.query(
            `SELECT ur.user_id::text AS user_id, r.name
               FROM user_roles ur JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id::text = ANY($1)`,
            [missingIds],
          )
        ).rows;
        let linked = 0;
        for (const row of roles) {
          const res = await target.query(
            `INSERT INTO user_roles (user_id, role_id)
             SELECT $1::uuid, r.id FROM roles r WHERE r.name = $2
             ON CONFLICT DO NOTHING`,
            [row.user_id, row.name],
          );
          linked += res.rowCount;
        }
        report.rolesLinked = linked;
      }
    }
  }

  return { map, report };
}

/**
 * Copy the lookup rows a construction project depends on, and return the id translations.
 *
 * Rows already present in the target — by id or by natural key — are left untouched; only
 * genuinely new ones are inserted. The returned map is what lets construction_projects
 * point at the target's own contractor / funding source / document type rows rather than
 * dragging the archive's ids in behind them.
 */
async function reconcileLookups(staging, target, projectIds, ctx) {
  const refMaps = new Map(); // "table.column" -> Map(archiveId -> targetId)
  const rows = [];

  for (const lookup of LOOKUP_TABLES) {
    const { table, via } = lookup;
    const [srcTable, srcCol] = via.split('.');
    const entry = { table, via, read: 0, matched: 0, inserted: 0, key: null, skipped: null };

    if (!(await tableExists(staging, table)) || !(await tableExists(target, table))) {
      entry.skipped = (await tableExists(staging, table)) ? 'not in target' : 'not in archive';
      rows.push(entry);
      continue;
    }
    if (!(await tableExists(staging, srcTable))) {
      entry.skipped = 'referencing table not in archive';
      rows.push(entry);
      continue;
    }

    const scope =
      srcTable === 'construction_projects'
        ? 'AND id::text = ANY($1)'
        : 'AND project_id::text = ANY($1)';
    const needed = (
      await staging.query(
        `SELECT DISTINCT "${srcCol}"::text AS id FROM "${srcTable}"
          WHERE "${srcCol}" IS NOT NULL ${scope}`,
        [projectIds],
      )
    ).rows.map((r) => r.id);
    entry.read = needed.length;
    if (!needed.length) {
      rows.push(entry);
      continue;
    }

    const key = await naturalKeyOf(target, table);
    entry.key = key;

    const selectCols = key ? `id::text AS id, "${key}"::text AS k` : 'id::text AS id';
    const archiveRows = (
      await staging.query(`SELECT ${selectCols} FROM "${table}" WHERE id::text = ANY($1)`, [needed])
    ).rows;

    const targetRows = (await target.query(`SELECT ${selectCols} FROM "${table}"`)).rows;
    const targetIds = new Set(targetRows.map((r) => r.id));
    const targetByKey = new Map(
      key ? targetRows.filter((r) => r.k !== null).map((r) => [r.k, r.id]) : [],
    );

    const map = new Map();
    const toInsert = [];
    for (const row of archiveRows) {
      if (targetIds.has(row.id)) {
        map.set(row.id, row.id);
        entry.matched++;
      } else if (key && row.k !== null && targetByKey.has(row.k)) {
        map.set(row.id, targetByKey.get(row.k));
        entry.matched++;
      } else {
        toInsert.push(row.id);
        map.set(row.id, row.id);
      }
    }

    if (toInsert.length) {
      const copied = await copyRows(
        staging,
        target,
        {
          table,
          where: 'id::text = ANY($1)',
          params: [toInsert],
          policy: 'insert-missing',
        },
        ctx,
      );
      entry.inserted = copied.written;
      entry.skippedColumns = copied.skippedColumns;
      entry.addedInTarget = copied.addedInTarget;
    }

    refMaps.set(`${srcTable}.${srcCol}`, map);
    rows.push(entry);
  }

  return { refMaps, rows };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (args.help) {
    log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    process.exit(0);
  }
  if (!args.dump && !args.stagingUrl) {
    console.error('Either --dump <archive> or --staging-url <url> is required. Use --help.');
    process.exit(1);
  }

  const targetConfig = connectionFor(args.targetUrl);
  const target = new Client(targetConfig);
  await target.connect();

  let stagingCfg = args.stagingUrl ? { connectionString: args.stagingUrl } : null;
  const stagingState = { created: false };
  let staging = null;
  let committed = false;

  try {
    const ident = (
      await target.query(
        `SELECT current_database() AS db, current_user AS usr, inet_server_addr()::text AS host`,
      )
    ).rows[0];
    log('=== SELECTIVE CONSTRUCTION RESTORE ===');
    log(`Target    : ${ident.db} as ${ident.usr}${ident.host ? ` at ${ident.host}` : ''}`);
    log(`Mode      : ${args.apply ? 'APPLY (will commit)' : 'DRY RUN (rolls back)'}`);
    log(`Archive   : ${args.dump ?? '(using existing staging database)'}`);
    log(
      `Documents : ${args.documents}${
        args.documents === 'upsert'
          ? ' (a document edited since the backup is reverted to the backup version)'
          : ' (documents already in the target are left untouched)'
      }`,
    );

    if (!(await tableExists(target, 'construction_projects'))) {
      throw new Error(
        'The target has no construction_projects table — this does not look like the PMO database.',
      );
    }

    if (!stagingCfg) {
      stagingCfg = await restoreArchiveToStaging(args, targetConfig, stagingState);
    }
    staging = new Client(stagingCfg);
    await staging.connect();

    // ── which projects ──
    const projectFilter = args.projects.length ? 'id::text = ANY($1)' : 'TRUE';
    const projectParams = args.projects.length ? [args.projects] : [];
    const projectIds = (
      await staging.query(
        `SELECT id::text AS id FROM construction_projects WHERE ${projectFilter}`,
        projectParams,
      )
    ).rows.map((r) => r.id);

    section('SCOPE');
    log(`Construction projects in archive : ${projectIds.length}`);
    if (projectIds.length === 0) throw new Error('No construction projects matched — nothing to do.');

    const childTables = await listConstructionChildTables(staging);
    log(`Child tables (project_id)        : ${childTables.length}`);

    // ── the copy plan, in dependency order ──
    const idsParam = [projectIds];
    const plan = [];
    plan.push({
      table: 'construction_projects',
      policy: 'upsert',
      where: 'id::text = ANY($1)',
      params: idsParam,
    });
    for (const table of childTables) {
      plan.push({ table, policy: 'upsert', where: 'project_id::text = ANY($1)', params: idsParam });
    }
    for (const poly of POLYMORPHIC_TABLES) {
      if (poly.optional && args.skipActivityLogs) continue;
      plan.push({
        table: poly.table,
        // Only documents are configurable: a stale assignment or log line is harmless to
        // overwrite, whereas a document row may have been re-uploaded since the backup.
        policy: poly.table === 'documents' ? args.documents : 'upsert',
        where: `${poly.where} AND "${poly.idColumn}"::text = ANY($1)`,
        params: idsParam,
      });
    }

    // ── users first: the map has to exist before any row is rewritten ──
    await target.query('BEGIN');

    section('USERS');
    const { map: userMap, report: userReport } = await buildUserMap(
      staging,
      target,
      projectIds,
      args,
      plan,
    );
    log(`Referenced by construction rows : ${userReport.referenced}`);
    log(`Already present, same id        : ${userReport.matchedById}`);
    log(`Matched by e-mail, id remapped  : ${userReport.matchedByEmail}`);
    log(`Inserted as new users           : ${userReport.inserted}`);
    if (userReport.rolesLinked !== undefined) log(`Role assignments linked         : ${userReport.rolesLinked}`);
    if (args.missingUsers === 'null' && userReport.missing.length) {
      log(`Set to NULL (not in either DB)  : ${userReport.missing.length}`);
    }
    if (userReport.matchedByEmail > 0) {
      log('');
      log('Remapped users (backup id → live id):');
      for (const [from, to] of userMap) {
        if (to && from !== to) log(`  ${from} → ${to}`);
      }
    }

    const refMapsRef = { maps: new Map() };
    const ctx = {
      remapUser(value) {
        if (value === null) return null;
        return userMap.has(value) ? userMap.get(value) : value;
      },
      remapRef(table, column, value) {
        const map = refMapsRef.maps.get(`${table}.${column}`);
        if (!map) return value;
        return map.has(value) ? map.get(value) : value;
      },
    };

    // ── lookups, before anything that points at them ──
    section('LOOKUPS');
    const { refMaps, rows: lookupRows } = await reconcileLookups(staging, target, projectIds, ctx);
    refMapsRef.maps = refMaps;
    log('table'.padEnd(34) + 'needed'.padStart(8) + 'matched'.padStart(9) + 'inserted'.padStart(10) + '  matched on');
    for (const r of lookupRows) {
      log(
        r.table.padEnd(34) +
          String(r.read).padStart(8) +
          String(r.matched).padStart(9) +
          String(r.inserted).padStart(10) +
          '  ' +
          (r.skipped ? `(${r.skipped})` : `id${r.key ? ` + ${r.key}` : ''}`),
      );
    }
    const remapped = [...refMaps.entries()].flatMap(([via, map]) =>
      [...map.entries()].filter(([from, to]) => from !== to).map(([from, to]) => `  ${via}: ${from} → ${to}`),
    );
    if (remapped.length) {
      log('');
      log('Lookup ids rewritten to the target\'s own rows:');
      remapped.forEach((line) => log(line));
    }

    // ── copy ──
    section('TABLES');
    log('table'.padEnd(46) + 'read'.padStart(8) + 'written'.padStart(10) + '  policy');
    const results = [];
    for (const spec of plan) {
      const res = await copyRows(staging, target, spec, ctx);
      results.push({ ...res, policy: spec.policy });
      const label = res.missingInStaging
        ? '(not in archive)'
        : res.missingInTarget
          ? '(not in target)'
          : spec.policy;
      log(
        spec.table.padEnd(46) +
          String(res.read).padStart(8) +
          String(res.written).padStart(10) +
          '  ' +
          label,
      );
    }

    const drifted = results.filter((r) => r.skippedColumns?.length || r.addedInTarget?.length);
    if (drifted.length) {
      section('SCHEMA DRIFT (archive vs live)');
      for (const r of drifted) {
        if (r.skippedColumns.length) log(`${r.table}: in archive only, not copied → ${r.skippedColumns.join(', ')}`);
        if (r.addedInTarget.length) log(`${r.table}: added since the archive, left at default → ${r.addedInTarget.join(', ')}`);
      }
    }

    const totalWritten = results.reduce((sum, r) => sum + r.written, 0);
    section('RESULT');
    log(`Rows written : ${totalWritten}`);

    if (args.apply) {
      await target.query('COMMIT');
      committed = true;
      log('COMMITTED.');
    } else {
      await target.query('ROLLBACK');
      log('DRY RUN — transaction rolled back, nothing was changed. Re-run with --apply.');
    }
  } catch (err) {
    try {
      await target.query('ROLLBACK');
    } catch {
      // The transaction may never have opened.
    }
    console.error('');
    console.error(`FAILED: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (staging) await staging.end();
    await target.end();
    if (stagingState.created && !args.keepStaging) {
      try {
        await dropStaging(targetConfig, args.stagingDb);
      } catch (err) {
        console.error(`Could not drop staging database ${args.stagingDb}: ${err.message}`);
      }
    } else if (stagingState.created) {
      log(`Staging database kept: ${args.stagingDb}`);
    }
    if (committed) log('Restore complete.');
  }
}

main();
