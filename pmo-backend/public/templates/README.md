# Document Templates (Served at `/templates`)

These files are served publicly (no auth) via `app.useStaticAssets` in `src/main.ts`.
The `construction_document_types.template_url` column points here as `/templates/{type_code}.docx`.

## Operator Action — Copy SHAREABLE templates here

Copy the `[SHAREABLE]` `.docx` files from
`docs/references/SHAREABLE SUPPORT DOCUMENTS-20260526T231911Z-3-001/`
into this folder, renaming each to its `type_code`:

| Source File                                                           | Target Filename |
| --------------------------------------------------------------------- | --------------- |
| ORDERS/[SHAREABLE] SD-ECO-ECO-001_Variation Order.docx                | SD_ECO_001.docx |
| ORDERS/[SHAREABLE] SD-ECO-ECO-002_Work Suspension Order.docx          | SD_ECO_002.docx |
| ORDERS/[SHAREABLE] SD-ECO-ECO-003_Work Resumption Order.docx          | SD_ECO_003.docx |
| ORDERS/[SHAREABLE] SD-ECO-ECO-004_Contract Time Extension Order.docx  | SD_ECO_004.docx |
| REPORTS/[SHAREABLE] SD-ECO-ECO-008_Construction Logbook.docx          | SD_ECO_008.docx |
| REPORTS/[SHAREABLE] SD-ECO-ECO-009_Weekly Accomplishment Report.docx  | SD_ECO_009.docx |
| REPORTS/[SHAREABLE] SD-ECO-ECO-010_Monthly Progress Report.docx       | SD_ECO_010.docx |
| REPORTS/[SHAREABLE] SD-ECO-ECO-011_Site Instruction.docx              | SD_ECO_011.docx |
| REPORTS/[SHAREABLE] SD-ECO-ECO-012_Site Inspection Report.docx        | SD_ECO_012.docx |
| REPORTS/[SHAREABLE] SD-ECO-ECO-013_Project Inspection Report.docx     | SD_ECO_013.docx |
| REPORTS/[SHAREABLE] SD-ECO-ECO-014_Quality Assessment Report.docx     | SD_ECO_014.docx |
| REPORTS/[SHAREABLE] SD-ECO-ECO-015_Safety Compliance Report.docx      | SD_ECO_015.docx |
| CERTS/[SHAREABLE] SD-ECO-ECO-016_Certificate of Site Inspection.docx  | SD_ECO_016.docx |
| CERTS/[SHAREABLE] SD-ECO-ECO-017_Certificate of Completion.docx       | SD_ECO_017.docx |
| CERTS/[SHAREABLE] SD-ECO-ECO-018_Certificate of Final Acceptance.docx | SD_ECO_018.docx |

DRAFT-only types (SD*ECO_005/006/007), LUDIP (SD_ECO_019), ECO forms (F_ECO*\*),
and CPES types have no shareable template and are intentionally omitted.
