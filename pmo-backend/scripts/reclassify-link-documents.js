/**
 * Reclassify untyped external-link documents.
 *
 * Until the attachment hub gained a document-type selector, every external link it
 * created was stored with the placeholder document_type 'link'. Such a row is invisible
 * to every type-based view — a Drive MOV for the Program of Works could never appear
 * under Program of Works, only in the flat attachment list. New links now carry a real
 * type; this script repairs the rows created before that.
 *
 * It is DRY RUN by default: nothing is written unless --apply is passed.
 *
 * Usage
 *   node scripts/reclassify-link-documents.js                          # preview every project
 *   node scripts/reclassify-link-documents.js --project <uuid>         # preview one project
 *   node scripts/reclassify-link-documents.js --apply                  # write inferred types
 *   node scripts/reclassify-link-documents.js --map <docId>=POW --apply # force one document
 *   node scripts/reclassify-link-documents.js --map-file mapping.json --apply
 *   node scripts/reclassify-link-documents.js --default OTHER --apply  # type the leftovers
 *   node scripts/reclassify-link-documents.js --revert --apply         # undo a previous run
 *
 * Options
 *   --apply                 Perform the update. Without it the script only reports.
 *   --project <uuid>        Restrict to one construction project.
 *   --from <TYPE>           Source type to sweep (default 'link'). Also useful for
 *                           legacy generic types such as 'attachment' or 'mov'.
 *   --map <docId>=<CODE>    Explicit type for one document. Repeatable. Beats inference.
 *   --map-file <path>       JSON object of { "<docId>": "<CODE>" }. Beats inference.
 *   --default <CODE>        Type applied to documents no rule could classify.
 *   --allow-unknown-code    Skip validation against construction_document_types.
 *   --revert                Restore the previous type for rows this script changed.
 *
 * Every change records its origin in documents.metadata:
 *   { "reclassifiedFrom": "link", "reclassifiedAt": "...", "reclassifiedBy": "...",
 *     "reclassifiedReason": "keyword:pow" }
 * so --revert can put the rows back exactly, and an auditor can see which rows a script
 * touched rather than a person.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// The backend reads DATABASE_* inside Docker; the repo root .env holds POSTGRES_* for
// Compose. Load both so the script works from the host and from inside the container.
//
// dotenv is only a transitive dependency here, and a production image may not expose it.
// Missing env files or a missing dotenv are both fine: the connection settings can come
// from the real environment instead, which is how the container runs.
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '../.env') });
  dotenv.config({ path: path.join(__dirname, '../../.env') });
} catch {
  // No dotenv available — rely on the process environment.
}

const SCRIPT_NAME = 'scripts/reclassify-link-documents.js';

/**
 * Keyword rules, most specific first.
 *
 * Short tokens are matched on word boundaries: a bare 'pow' substring would classify
 * "Power layout.pdf" as a Program of Works, which is exactly the kind of mistake the old
 * Overview panel made.
 */
const RULES = [
  { code: 'CERTIFICATE_OF_COMPLETION', patterns: [/certificate of completion/i, /cert\.? of completion/i, /\bcoc\b/i] },
  { code: 'FINAL_COMPLETION_INSPECTION', patterns: [/final completion inspection/i] },
  { code: 'FEASIBILITY_STUDY', patterns: [/feasibility/i] },
  { code: 'POW', patterns: [/program of works?/i, /\bpow\b/i, /bill of quantities/i, /\bboq\b/i] },
  { code: 'NTP', patterns: [/notice to proceed/i, /\bntp\b/i] },
  { code: 'AS_BUILT_PLAN', patterns: [/as[- ]built/i] },
  { code: 'VARIATION_ORDERS', patterns: [/variation order/i] },
  { code: 'TIME_EXTENSIONS', patterns: [/time extension/i] },
  { code: 'SWA', patterns: [/statement of work accomplished/i, /\bswa\b/i] },
  { code: 'STE', patterns: [/statement of time elapsed/i, /\bste\b/i] },
  { code: 'PROGRESS_BILLING', patterns: [/progress report/i, /progress billing/i, /\bbilling\b/i] },
  { code: 'PROJECT_PROFILE', patterns: [/project profile/i, /\bprofile\b/i] },
];

function parseArgs(argv) {
  const args = {
    apply: false,
    revert: false,
    allowUnknownCode: false,
    project: null,
    from: 'link',
    default: null,
    map: {},
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--revert') args.revert = true;
    else if (a === '--allow-unknown-code') args.allowUnknownCode = true;
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--from') args.from = argv[++i];
    else if (a === '--default') args.default = argv[++i];
    else if (a === '--map') {
      const pair = argv[++i] || '';
      const eq = pair.indexOf('=');
      if (eq < 0) throw new Error(`--map expects <docId>=<TYPE_CODE>, received "${pair}"`);
      args.map[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    } else if (a === '--map-file') {
      const file = argv[++i];
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      Object.assign(args.map, parsed);
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown option "${a}". Use --help.`);
    }
  }
  return args;
}

function buildPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'pmo_dashboard',
    user: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  });
}

/** Text a rule is matched against: title, description and the link target itself. */
function haystack(row) {
  return [row.file_name, row.description, decodeURIComponent(row.file_path || '')]
    .filter(Boolean)
    .join(' ');
}

function classify(row) {
  const text = haystack(row);
  for (const rule of RULES) {
    const hit = rule.patterns.find((p) => p.test(text));
    if (hit) return { code: rule.code, reason: `keyword:${hit.source}` };
  }
  return null;
}

function truncate(value, max) {
  const s = String(value == null ? '' : value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

async function loadValidCodes(pool) {
  const res = await pool.query(
    `SELECT type_code FROM construction_document_types WHERE is_active`,
  );
  return new Set(res.rows.map((r) => r.type_code));
}

async function selectCandidates(pool, args) {
  const params = [args.from];
  let where = `document_type = $1`;
  if (args.project) {
    params.push(args.project);
    where += ` AND documentable_id = $${params.length}`;
  }
  const res = await pool.query(
    `SELECT id, documentable_id, document_type, file_name, file_path, mime_type,
            description, created_at, metadata
       FROM documents
      WHERE documentable_type = 'CONSTRUCTION_PROJECT'
        AND deleted_at IS NULL
        AND ${where}
      ORDER BY documentable_id, created_at`,
    params,
  );
  return res.rows;
}

async function selectRevertable(pool, args) {
  const params = [];
  let where = `metadata ? 'reclassifiedFrom'`;
  if (args.project) {
    params.push(args.project);
    where += ` AND documentable_id = $${params.length}`;
  }
  const res = await pool.query(
    `SELECT id, documentable_id, document_type, file_name, file_path, description, metadata
       FROM documents
      WHERE documentable_type = 'CONSTRUCTION_PROJECT'
        AND deleted_at IS NULL
        AND ${where}
      ORDER BY documentable_id, created_at`,
    params,
  );
  return res.rows;
}

async function runReclassify(pool, args) {
  const rows = await selectCandidates(pool, args);
  console.log(`Documents with document_type = '${args.from}': ${rows.length}`);
  if (args.project) console.log(`Restricted to project ${args.project}`);
  if (rows.length === 0) return { updated: 0, unresolved: 0 };

  const validCodes = args.allowUnknownCode ? null : await loadValidCodes(pool);

  const planned = [];
  const unresolved = [];
  for (const row of rows) {
    let target = null;
    if (args.map[row.id]) target = { code: args.map[row.id], reason: 'explicit:--map' };
    else target = classify(row);
    if (!target && args.default) target = { code: args.default, reason: 'default' };

    if (!target) {
      unresolved.push(row);
      continue;
    }
    if (validCodes && !validCodes.has(target.code)) {
      throw new Error(
        `Type code "${target.code}" for document ${row.id} is not an active construction_document_types row. ` +
          `Fix the mapping or pass --allow-unknown-code.`,
      );
    }
    planned.push({ row, target });
  }

  console.log('');
  console.log('PLANNED CHANGES');
  console.log('-'.repeat(110));
  for (const { row, target } of planned) {
    console.log(
      `${row.id}  ${truncate(row.file_name, 34).padEnd(34)}  ${args.from} -> ${target.code.padEnd(28)}  ${target.reason}`,
    );
  }
  if (planned.length === 0) console.log('(none)');

  if (unresolved.length) {
    console.log('');
    console.log('UNRESOLVED — no rule matched, left untouched. Use --map or --default.');
    console.log('-'.repeat(110));
    for (const row of unresolved) {
      console.log(
        `${row.id}  ${truncate(row.file_name, 34).padEnd(34)}  ${truncate(row.file_path, 48)}`,
      );
    }
  }

  if (!args.apply) {
    console.log('');
    console.log(`DRY RUN — nothing written. ${planned.length} row(s) would change. Re-run with --apply.`);
    return { updated: 0, unresolved: unresolved.length };
  }
  if (planned.length === 0) {
    console.log('');
    console.log('Nothing to apply.');
    return { updated: 0, unresolved: unresolved.length };
  }

  const client = await pool.connect();
  let updated = 0;
  try {
    await client.query('BEGIN');
    for (const { row, target } of planned) {
      const audit = JSON.stringify({
        reclassifiedFrom: row.document_type,
        reclassifiedTo: target.code,
        reclassifiedAt: new Date().toISOString(),
        reclassifiedBy: SCRIPT_NAME,
        reclassifiedReason: target.reason,
      });
      const res = await client.query(
        `UPDATE documents
            SET document_type = $1,
                metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                updated_at = NOW()
          WHERE id = $3
            AND document_type = $4`,
        [target.code, audit, row.id, row.document_type],
      );
      updated += res.rowCount;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('');
  console.log(`APPLIED — ${updated} row(s) updated, ${unresolved.length} left unresolved.`);
  return { updated, unresolved: unresolved.length };
}

async function runRevert(pool, args) {
  const rows = await selectRevertable(pool, args);
  console.log(`Documents carrying a reclassification record: ${rows.length}`);
  if (rows.length === 0) return { updated: 0 };

  console.log('');
  console.log('PLANNED REVERTS');
  console.log('-'.repeat(110));
  for (const row of rows) {
    console.log(
      `${row.id}  ${truncate(row.file_name, 34).padEnd(34)}  ${row.document_type} -> ${row.metadata.reclassifiedFrom}`,
    );
  }

  if (!args.apply) {
    console.log('');
    console.log(`DRY RUN — nothing written. ${rows.length} row(s) would revert. Re-run with --apply.`);
    return { updated: 0 };
  }

  const client = await pool.connect();
  let updated = 0;
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const res = await client.query(
        `UPDATE documents
            SET document_type = $1,
                metadata = metadata - 'reclassifiedFrom' - 'reclassifiedTo'
                                    - 'reclassifiedAt'   - 'reclassifiedBy'
                                    - 'reclassifiedReason',
                updated_at = NOW()
          WHERE id = $2`,
        [row.metadata.reclassifiedFrom, row.id],
      );
      updated += res.rowCount;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('');
  console.log(`REVERTED — ${updated} row(s) restored.`);
  return { updated };
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
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    process.exit(0);
  }

  const pool = buildPool();
  try {
    const who = await pool.query('SELECT current_database() AS db, current_user AS usr');
    console.log(`=== RECLASSIFY LINK DOCUMENTS ===`);
    console.log(`Database: ${who.rows[0].db} as ${who.rows[0].usr}`);
    console.log(`Mode: ${args.revert ? 'revert' : 'reclassify'} / ${args.apply ? 'APPLY' : 'dry run'}`);
    console.log('');

    if (args.revert) await runRevert(pool, args);
    else await runReclassify(pool, args);
  } catch (err) {
    console.error('');
    console.error(`FAILED: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
