# LDAP Swap Procedure — Test Directory → MIS Active Directory

## Understanding LDAP (for the operator)

*Added T-HOME-CMS-7 (TH7-3) — a beginner-friendly explainer for the MIS meeting. Skip to
"When to use this" below if you just need the swap steps.*

### What LDAP actually is

Think of LDAP as the university's HR/Registrar master list. Without it, PMO CORE would keep its
own private list of usernames and passwords — completely separate from whatever list HR uses, the
library uses, the registrar uses. LDAP flips that: instead of PMO CORE keeping its own roster, it
asks the university's *one* central directory, "does this person exist, and are they active?"
PMO CORE becomes a security guard checking IDs against the master employee list, not an office
keeping its own private one.

### The login journey, step by step

```
You type your credentials into the PMO CORE login page
    ↓
The frontend sends them to the backend
    ↓
The backend asks the LDAP server: "is this a real, active CSU account?"
    ↓
The LDAP server checks the actual university directory
    ↓
Directory replies: "yes, valid" or "no, unknown/inactive"
    ↓
If valid, the backend issues a JWT (a signed digital pass)
    ↓
You're in — the JWT is what your browser presents on every future request
```

### Why MIS wants this

One password to manage instead of dozens across every campus system. Instant access revocation
the moment someone resigns or is terminated — no forgotten stray accounts lingering in some app
nobody remembers. Centralized password-policy enforcement (MIS sets the rules once, everywhere).
A single audit trail instead of piecing together logs from a dozen separate systems.

### The distinction that matters most: authentication vs. authorization

LDAP only ever answers **"who are you."** It never decides what you're allowed to *do* — that
decision stays entirely inside PMO CORE's own roles/permissions tables (`ROLE_PERMISSIONS`,
`user_permission_overrides`, etc. — see `docs/architecture.md`). Concretely: LDAP says "yes, Juan
is a real, active CSU employee." PMO CORE separately says "Juan can edit COI records but cannot
approve them." Two different questions, two different systems — LDAP never touches PMO CORE's
permission model, and it shouldn't.

### Information to request from MIS (bring this list to the meeting)

| Ask MIS for | Why you need it | Beginner translation |
|---|---|---|
| Server address + port | Where to connect | The "phone number" for the directory server |
| Base DN | Where user accounts live in the directory | The folder path to the "Users" folder |
| Bind DN + service account password | A dedicated login *for the app itself* to search the directory | PMO CORE needs its own "reader" account to look people up |
| Search filter / username attribute | Whether login uses email, `sAMAccountName`, or `userPrincipalName` | Do people log in with `juan.delacruz` or `juan.delacruz@carsu.edu.ph`? |
| TLS/SSL requirements | Whether the connection must be encrypted (production: always yes) | Is it a locked, encrypted line or a plain one? |
| Whether it's Active Directory specifically | AD has its own conventions vs. generic LDAP | A slightly different "dialect" of the same protocol |

### Responsibility split

| Developer (this codebase) owns | MIS owns |
|---|---|
| LDAP integration code (`ldap.strategy.ts`, `attemptLdapAuth`) | The LDAP/AD server itself |
| Role mapping, permissions, JWT generation | The service account (bind DN + password) |
| Local-account onboarding/provisioning | SSL certificates |
| Profile synchronization | Firewall rules, network access |
| | Production LDAP credentials |

### What's already prepared vs. what waits on MIS

**Already built and working today, doesn't wait on MIS:** the integration code, the swap
procedure below, and a working test directory (`openldap` container) that proves the whole login
path end-to-end with fake test data. Switching to the real MIS server is designed to be a `.env`
edit + container restart — no code changes.

**Genuinely can't be finished without MIS:** the production connection values above, and a
decision on **account pre-provisioning** (see that section below) — who creates local user rows
and when, relative to go-live.

**Normal, not a red flag:** not having MIS's exact values yet, this far from go-live, is
completely standard for enterprise deployments. Nothing here should be a source of worry — it's
the expected order of operations (build + prove the mechanism first, plug in real values last).

---

## When to use this

After LDAP is proven against the local test directory (T5a), use this
procedure at go-live to point the system at the real MIS/AD server.

The entire swap is a `.env` change + container restart. No code changes.

---

## Current test values (local OpenLDAP)

```env
LDAP_URL=ldap://openldap:389
LDAP_BIND_DN=cn=admin,dc=carsu,dc=edu,dc=ph
LDAP_BIND_PASSWORD=testldapadmin
LDAP_SEARCH_BASE=ou=users,dc=carsu,dc=edu,dc=ph
LDAP_SEARCH_FILTER=(mail={{username}})
LDAP_TLS_REJECT_UNAUTHORIZED=false
```

---

## MIS production values (fill in with MIS team)

```env
LDAP_URL=ldaps://ldap.carsu.edu.ph:636
LDAP_BIND_DN=cn=svc-pmo,ou=ServiceAccounts,dc=carsu,dc=edu,dc=ph
LDAP_BIND_PASSWORD=<service-account-password-from-MIS>
LDAP_SEARCH_BASE=ou=Users,dc=carsu,dc=edu,dc=ph
LDAP_SEARCH_FILTER=(sAMAccountName={{username}})
LDAP_TLS_REJECT_UNAUTHORIZED=true
```

### Key differences from test config

| Setting | Test | MIS/AD | Why different |
|---------|------|--------|---------------|
| `LDAP_URL` | `ldap://openldap:389` | `ldaps://ldap.carsu.edu.ph:636` | Production uses LDAPS (TLS on port 636) |
| `LDAP_BIND_DN` | `cn=admin,...` | `cn=svc-pmo,ou=ServiceAccounts,...` | MIS provisions a dedicated service account |
| `LDAP_SEARCH_FILTER` | `(mail={{username}})` | `(sAMAccountName={{username}})` | AD users log in with Windows username, not email |
| `LDAP_TLS_REJECT_UNAUTHORIZED` | `false` | `true` | Production requires valid TLS cert |

---

## How the login flow changes for users

| Auth method | Login form input | What to type |
|-------------|-----------------|--------------|
| Local | identifier + password | `pmoadmin` + local password |
| LDAP (test) | username + password | `meoangelo.alcantara@carsu.edu.ph` + `testldap123` |
| LDAP (MIS/AD) | username + password | `meoangelo.alcantara` (Windows username) + AD password |

> **Corrected (T-HOME-CMS-6, 2026-07-08):** the frontend has NO login-mode
> selector. Every browser login posts to the single unified
> `POST /api/auth/login` endpoint, which routes automatically:
>
> - Account **has** a local `password_hash` → local bcrypt check only
>   (LDAP is never consulted for that account).
> - Account has **no** local `password_hash` → LDAP authentication.
>
> Users never choose an auth method — routing is decided by how the account
> was provisioned (see "Account pre-provisioning" below).
> `POST /api/auth/ldap` still exists as a separate diagnostic endpoint
> (Passport `passport-ldapauth` strategy) — useful for isolating LDAP
> connectivity problems from account-provisioning problems, but real users
> never reach it through the UI.

---

## Swap procedure (WSL terminal)

```bash
# 1. Edit .env — replace the LDAP block with MIS values above
nano /mnt/d/Programming/pmo-dash/pmo-backend/.env

# 2. Recreate backend container (picks up new env vars)
cd /mnt/d/Programming/pmo-dash
docker compose --env-file ./pmo-backend/.env up -d backend

# 3. Verify LDAP strategy registered (look for LdapStrategy in logs)
docker compose --env-file ./pmo-backend/.env logs backend | grep -i ldap

# 4a. Isolate LDAP connectivity (diagnostic endpoint — bypasses local-hash logic)
curl -s -X POST http://localhost:3000/api/auth/ldap \
  -H "Content-Type: application/json" \
  -d '{"username":"<windows-username>","password":"<ad-password>"}'
# Expected: {"access_token":"..."}

# 4b. Test the REAL user path (what the browser login form actually calls) —
#     requires the account to exist locally with NO password_hash (see below)
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"<windows-username>","password":"<ad-password>"}'
# Expected: {"access_token":"..."}
# If this returns 401 while 4a succeeds, the account either has a local
# password_hash set (local-only routing) or does not exist locally — see
# "Account pre-provisioning" below.
```

---

## Account pre-provisioning (REQUIRED before any LDAP user can log in)

There is **no auto-provisioning on first LDAP login.** After LDAP accepts the
credentials, the backend looks up a local `users` row by email and **fails
closed** (`NO_LOCAL_ACCOUNT`) if none exists. For every CSU account MIS grants
access to, someone must — before that person's first login:

1. Create the local `users` row (email matching the directory's mail/UPN
   attribute, name, campus) with **`password_hash` left NULL/empty** — this is
   what makes the unified login route the account to LDAP.
2. Assign a role + module access the normal way (Users admin page /
   access-request flow).

Rules of thumb:

- **LDAP-designated accounts must never be given a local password.** Setting
  one silently converts the account to local-only authentication — the
  unified endpoint stops consulting LDAP for it.
- **Break-glass accounts (e.g. `pmoadmin`) keep a local password on purpose**
  and authenticate locally even when LDAP is live. Do not "test LDAP" with
  them — use a genuinely LDAP-only account.
- Go-live checklist item: agree with MIS **who** creates the local rows and
  **when**, relative to the directory cutover.

---

## Information to request from MIS before go-live

- LDAP server hostname and port (636 for LDAPS, 389 for plain)
- Service account DN and password (for bind)
- Search base DN (the OU where user accounts live)
- Attribute name for username (`sAMAccountName` or `mail` or `userPrincipalName`)
- LDAPS certificate (to install if self-signed)
- Whether `userPrincipalName` (email format) or `sAMAccountName` (short name) is the login identifier

---

## Rollback

If MIS LDAP fails at go-live, revert `.env` to the previous values and
restart the backend. Local auth (`POST /api/auth/login`) is always available
as fallback and is unaffected by LDAP configuration.
