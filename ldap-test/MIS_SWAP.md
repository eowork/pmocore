# LDAP Swap Procedure — Test Directory → MIS Active Directory

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

The login endpoint for LDAP is always `POST /api/auth/ldap` (separate from
the local `POST /api/auth/login`). The frontend login page sends to whichever
endpoint the user selects (local vs institutional).

---

## Swap procedure (WSL terminal)

```bash
# 1. Edit .env — replace the LDAP block with MIS values above
nano /mnt/d/Programming/pmo-dash/pmo-backend/.env

# 2. Recreate backend container (picks up new env vars)
cd /mnt/d/Programming/pmo-dash
docker compose up -d backend

# 3. Verify LDAP strategy registered (look for LdapStrategy in logs)
docker compose logs backend | grep -i ldap

# 4. Test with a known AD account
curl -s -X POST http://localhost:3000/api/auth/ldap \
  -H "Content-Type: application/json" \
  -d '{"username":"<windows-username>","password":"<ad-password>"}'
# Expected: {"access_token":"..."}
```

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
