# PMO CORE — Technical Reference

> **Audience:** MIS engineers doing ongoing development/maintenance after handover.
> **Not this:** step-by-step operational procedures (start/stop, backup/restore, incident
> response, UAT) — those live in `handover/` at the repo root, not here.

This directory holds durable technical reference material extracted from the outgoing developer's
internal working notes (`docs/`, which is intentionally personal/local-only and not part of this
repository — see below) — the parts of it that are genuinely useful to whoever maintains this
codebase next, with the process/governance scaffolding removed.

## Contents

| File | What it is |
|---|---|
| `architecture.md` | Technical blueprint — stack, module structure, conventions. No task history, no in-progress notes. |
| `database/00_DATABASE_REFERENCE.md` | Start here for the database — index into the rest of this folder. |
| `database/01_schema.sql` | Authoritative schema DDL (source of truth: `pmo-backend/schema/coredata_schema.sql`). |
| `database/02_inventory_and_legacy.md` | Every table, classified active vs. legacy. |
| `database/03_table_structures.md` | Per-column detail for all active tables. |
| `database/04_relationships_and_dependencies.md` | Foreign-key relationship map. |
| `database/05_statistics_audit_readiness.md` | Row-count/size profile, audit-readiness notes. |

## Why this exists separately from `docs/`

`docs/` (repo root) is the outgoing developer's personal working folder — day-to-day planning
notes, AI-assisted-development process records, and research history. It's deliberately excluded
from version control (`.gitignore`) because most of it doesn't mean anything without the working
context it was written in. The files in *this* folder are the exception: standalone technical
reference that doesn't depend on that context, so it's tracked in git and ships with the repo.

If something you need isn't here, check `handover/` next (deployment/ops procedures), then ask
the outgoing developer before assuming it doesn't exist.
