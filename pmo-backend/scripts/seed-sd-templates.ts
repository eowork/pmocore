/**
 * DDD-A: Supporting-Documents template library seeder.
 *
 * Copies the operator-supplied SHAREABLE blank forms into the served uploads
 * directory and points each `construction_document_types.template_url` at them,
 * so users can download → edit externally → reupload the real forms.
 *
 * Run from pmo-backend/:  npx ts-node scripts/seed-sd-templates.ts
 * Idempotent: copies overwrite, the UPDATE is keyed on type_code. Safe to re-run.
 *
 * NOTE: this is intentionally NOT a MikroORM migration — migrations must not
 * perform filesystem copies and must stay environment-portable (DDD-D2).
 */
import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(
  __dirname,
  '../../docs/references/SHAREABLE SUPPORT DOCUMENTS-20260526T231911Z-3-001',
);
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../uploads');
const DEST = path.join(UPLOAD_DIR, 'coi-templates');

// code → source file (relative to SRC). 005–007 use [DRAFT]; 019 = LUDIP (no SD-ECO prefix).
const MAP: Array<{ code: string; file: string }> = [
  {
    code: 'SD_ECO_001',
    file: 'ORDERS/[SHAREABLE] SD-ECO-ECO-001_Variation Order.docx',
  },
  {
    code: 'SD_ECO_002',
    file: 'ORDERS/[SHAREABLE] SD-ECO-ECO-002_Work Suspension Order.docx',
  },
  {
    code: 'SD_ECO_003',
    file: 'ORDERS/[SHAREABLE] SD-ECO-ECO-003_Work Resumption Order.docx',
  },
  {
    code: 'SD_ECO_004',
    file: 'ORDERS/[SHAREABLE] SD-ECO-ECO-004_Contract Time Extension Order.docx',
  },
  {
    code: 'SD_ECO_005',
    file: 'ORDERS/[DRAFT] SD-ECO-ECO-005_Notice of Non-Compliance.docx',
  },
  {
    code: 'SD_ECO_006',
    file: 'ORDERS/[DRAFT] SD-ECO-ECO-006_Show Cause Order.docx',
  },
  {
    code: 'SD_ECO_007',
    file: 'ORDERS/[DRAFT] SD-ECO-ECO-007_Notice of Termination.docx',
  },
  {
    code: 'SD_ECO_008',
    file: 'REPORTS AND MONITORING/[SHAREABLE] SD-ECO-ECO-008_Construction Logbook.docx',
  },
  {
    code: 'SD_ECO_009',
    file: 'REPORTS AND MONITORING/[SHAREABLE] SD-ECO-ECO-009_Weekly Accomplishment Report.docx',
  },
  {
    code: 'SD_ECO_010',
    file: 'REPORTS AND MONITORING/[SHAREABLE] SD-ECO-ECO-010_Monthly Progress Report.docx',
  },
  {
    code: 'SD_ECO_011',
    file: 'REPORTS AND MONITORING/[SHAREABLE] SD-ECO-ECO-011_Site Instruction.docx',
  },
  {
    code: 'SD_ECO_012',
    file: 'REPORTS AND MONITORING/[SHAREABLE] SD-ECO-ECO-012_Site Inspection Report.docx',
  },
  {
    code: 'SD_ECO_013',
    file: 'REPORTS AND MONITORING/[SHAREABLE] SD-ECO-ECO-013_Project Inspection Report.docx',
  },
  {
    code: 'SD_ECO_014',
    file: 'REPORTS AND MONITORING/[SHAREABLE] SD-ECO-ECO-014_Quality Assessment Report.docx',
  },
  {
    code: 'SD_ECO_015',
    file: 'REPORTS AND MONITORING/[SHAREABLE] SD-ECO-ECO-015_Safety Compliance Report.docx',
  },
  {
    code: 'SD_ECO_016',
    file: 'CERTIFICATIONS AND OTHER DOCUMENTS/[SHAREABLE] SD-ECO-ECO-016_Certificate of Site Inspection.docx',
  },
  {
    code: 'SD_ECO_017',
    file: 'CERTIFICATIONS AND OTHER DOCUMENTS/[SHAREABLE] SD-ECO-ECO-017_Certificate of Completion.docx',
  },
  {
    code: 'SD_ECO_018',
    file: 'CERTIFICATIONS AND OTHER DOCUMENTS/[SHAREABLE] SD-ECO-ECO-018_Certificate of Final Acceptance.docx',
  },
  {
    code: 'SD_ECO_019',
    file: 'CERTIFICATIONS AND OTHER DOCUMENTS/Mandatory Certification - LUDIP.docx',
  },
];

async function main(): Promise<void> {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Source folder not found: ${SRC}`);
  }
  fs.mkdirSync(DEST, { recursive: true });

  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5432,
    database: process.env.DATABASE_NAME || 'pmo_dashboard',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  });
  await client.connect();

  let seeded = 0;
  let missing = 0;
  try {
    for (const { code, file } of MAP) {
      const src = path.join(SRC, file);
      if (!fs.existsSync(src)) {
        console.warn(`MISSING source for ${code}: ${file}`);
        missing++;
        continue;
      }
      const destFile = path.join(DEST, `${code}.docx`);
      fs.copyFileSync(src, destFile);
      const url = `/uploads/coi-templates/${code}.docx`;
      const res = await client.query(
        `UPDATE construction_document_types SET template_url = $1 WHERE type_code = $2`,
        [url, code],
      );
      if (res.rowCount === 0) {
        console.warn(`NO TAXONOMY ROW for ${code} (run migrations first)`);
      } else {
        console.log(`SEEDED ${code} -> ${url}`);
        seeded++;
      }
    }
  } finally {
    await client.end();
  }

  console.log(
    `\nDone. Seeded ${seeded}/${MAP.length} templates. Missing sources: ${missing}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
