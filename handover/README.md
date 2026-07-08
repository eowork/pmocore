# PMO CORE — Handover Documentation

> **Start here.** This folder is the complete turnover package for PMO CORE
> (Caraga State University's Project Management Office platform). Every document
> below is tracked in git and ships with the repository.

---

## Which document is for you?

| If you are… | Read |
|---|---|
| **MIS Director / decision-maker** coordinating the turnover | `MIS_CHECKLIST.md` — secrets to collect, institutional info to gather, sign-offs needed before go-live |
| **MIS engineer** deploying or operating the system | The four-document sequence below, in order |
| **Content administrator** managing the public homepage | `HOMEPAGE_CMS_GUIDE.md` |
| **Tester** running acceptance testing | `UAT_PROTOCOL.md` |
| **End user** (PMO staff, encoders) | `USER_GUIDE.md` |

## Deploying engineer — reading order

Read these in sequence; each assumes the one before it:

1. **`AMD_RYZEN_SETUP.md`** — prepare a fresh Windows 11 machine (WSL2, Docker) from zero.
   Skip if your machine already runs Docker under WSL2.
2. **`DRYRUN_GUIDE.md`** — clean-room rehearsal: prove the system deploys from
   documentation alone before doing it for real.
3. **`DEPLOYMENT.md`** — the actual production deployment procedure (~30 min on a
   prepared machine).
4. **`RUNBOOK.md`** — day-to-day operations after go-live: start/stop, logs,
   backup/restore, lockout recovery, incident response.

Supporting material for the engineer:

- **`deployment_learning_notes.md`** — concepts handbook (Docker, WSL, networking,
  PostgreSQL) for developers with app experience but limited DevOps exposure.
  Reference, not procedure.
- **`ldap-test/MIS_SWAP.md`** — what LDAP is (beginner-friendly), the local test
  directory, and the exact cutover procedure to MIS Active Directory when its
  connection details arrive. `ldap-test/seed.ldif` is the test directory's seed
  data (referenced by `docker-compose.yml`'s `ldap-test` profile — don't move it
  without updating the compose file).

## Full inventory

| Document | Purpose |
|---|---|
| `README.md` | This index |
| `MIS_CHECKLIST.md` | Institutional handover checklist (secrets, configs, sign-offs) |
| `AMD_RYZEN_SETUP.md` | Fresh-machine preparation (WSL2 + Docker from zero) |
| `DRYRUN_GUIDE.md` | Clean-room deployment rehearsal protocol |
| `DEPLOYMENT.md` | Production deployment procedure |
| `RUNBOOK.md` | Operations: start/stop, backup/restore, incidents |
| `deployment_learning_notes.md` | DevOps concepts handbook |
| `HOMEPAGE_CMS_GUIDE.md` | Homepage Management (public-site CMS) admin guide |
| `UAT_PROTOCOL.md` | User acceptance testing protocol |
| `USER_GUIDE.md` | End-user quick guide |
| `ldap-test/MIS_SWAP.md` | LDAP explainer + test-directory-to-AD cutover |
| `ldap-test/seed.ldif` | LDAP test directory seed (mounted by docker-compose) |

## Beyond this folder

- **`technical-reference/`** (repo root) — for ongoing *development*, not operations:
  the architecture blueprint and the complete database reference (authoritative
  schema, every table's columns, relationships, active-vs-legacy classification).
  Start with `technical-reference/README.md`.
- **`CLAUDE.md` / `AGENTS.md`** (repo root) — configuration for AI coding assistants
  (Claude Code and Codex respectively) used during development. Near-identical
  content; safe to ignore if you don't use those tools, useful context if you do.
- **`docs/`** (repo root, if present locally) — the outgoing developer's *personal*
  working folder: day-to-day planning notes and research history. It is
  intentionally excluded from git and is **not** part of this repository — if you
  cloned from GitHub you won't have it, and nothing in the handover depends on it.
  Everything durable from it was extracted into `technical-reference/`.

---

*Last updated: 2026-07-08 · Outgoing operator: Angelo Alcantara · Turnover deadline: 2026-07-15*
