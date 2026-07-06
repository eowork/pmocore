# CSU CORE Dashboard — User Acceptance Testing Protocol

> **Audience:** MIS Successor and PMO Stakeholders
> **Purpose:** Formal UAT sign-off before official go-live
> **Minimum testers:** 1 PMO staff encoder + 1 MIS staff
> **Estimated time:** 2–3 hours per tester

---

## 1. Scope

This protocol covers the core user-facing workflows of CSU CORE. It is not exhaustive — it validates that the system is fit for institutional use. Edge cases and advanced configurations are out of scope.

**Modules covered:**
- Authentication (local login, Google OAuth, LDAP institutional login)
- COI — Construction of Infrastructure (project list, detail, gallery, public view)
- University Operations — Physical Accomplishment (BAR No. 1 data entry)
- University Operations — Financial Accomplishment (BAR No. 2 data entry)
- User Management (create user, assign role and campus)

---

## 2. Test Environment

| Item | Value |
|---|---|
| URL | `http://<server-ip>:3001` (or production URL) |
| Test date | |
| Backend version | Check `GET /health` → `version` field |
| Database | Production data loaded |
| Test accounts | Provided by MIS successor |

---

## 3. Test Scenarios

Mark each row: **P** (Pass) · **F** (Fail) · **N/A** (Not applicable)

### 3A — Authentication

| # | Scenario | Steps | Expected Result | Result | Notes |
|---|---|---|---|---|---|
| A1 | Local login — valid credentials | Enter `pmoadmin` username + correct password → click Login | JWT issued, redirect to Dashboard | | |
| A2 | Local login — wrong password | Enter valid username + wrong password | Error: "Invalid credentials" or similar; no JWT issued | | |
| A3 | Local login — rate limiting | Attempt login 6 times with wrong password in under 1 minute | 6th attempt returns HTTP 429 "Too Many Requests" | | |
| A4 | Google OAuth — CSU account | Click "Sign in with Google" → authenticate with `@carsu.edu.ph` account | JWT issued, redirect to Dashboard | | |
| A5 | Google OAuth — non-CSU account | Click "Sign in with Google" → authenticate with `@gmail.com` account | Access denied with domain restriction message | | |
| A6 | LDAP institutional login | Enter CSU institutional credentials on LDAP login form | JWT issued, redirect to Dashboard | | |
| A7 | Session expiry | Leave session idle 8+ hours | Next page navigation redirects to Login | | |
| A8 | Logout | Click Logout | Session cleared, redirect to Login page | | |

---

### 3B — COI Module

| # | Scenario | Steps | Expected Result | Result | Notes |
|---|---|---|---|---|---|
| B1 | Project list loads | Navigate to COI → Projects | List of construction projects displayed with status chips | | |
| B2 | Create project | Click New Project → fill required fields → Save | Project appears in list with PROPOSAL status | | |
| B3 | Edit project | Open a project → Edit → change project name → Save | Name updated on project detail page | | |
| B4 | Upload gallery image | Open a project → Gallery tab → Upload → select JPG file | Image appears in gallery | | |
| B5 | Document authentication | Attempt to access a document file URL directly in browser | HTTP 403 Forbidden (documents require login) | | |
| B6 | Gallery image accessible | Access a gallery image URL directly in browser | Image loads (images are public) | | |
| B7 | Public project page | Navigate to `/coi/public` | Project list visible without login | | |
| B8 | Analytics tab | Navigate to COI → Analytics | Charts render with project data | | |
| B9 | Status filter | Apply "Ongoing" status filter | Only ongoing projects shown; chip appears | | |

---

### 3C — University Operations — Physical (BAR No. 1)

| # | Scenario | Steps | Expected Result | Result | Notes |
|---|---|---|---|---|---|
| C1 | Page loads | Navigate to University Operations → Physical | Pillar sections with indicators visible | | |
| C2 | Select quarter | Select Q1 from quarter selector | Indicator rows update to Q1 data | | |
| C3 | Enter actual value | Click an indicator row → enter Actual value → Save | Value persisted; page does not error | | |
| C4 | BAR report view | Click "View BAR No. 1" | Report renders with Q1 data | | |
| C5 | Submit for review | Click Submit Quarter → confirm | Quarter status changes to PENDING_REVIEW | | |

---

### 3D — University Operations — Financial (BAR No. 2)

| # | Scenario | Steps | Expected Result | Result | Notes |
|---|---|---|---|---|---|
| D1 | Page loads | Navigate to University Operations → Financial | Financial table with appropriation columns visible | | |
| D2 | Enter obligation | Click a row → enter Obligation value → Save | Value persisted; utilization rate auto-computed | | |
| D3 | Analytics tab | Click Analytics tab | Bar charts and utilization rate chart render | | |
| D4 | BAR report view | Click "View BAR No. 2" | Report renders with financial data | | |

---

### 3E — User Management

| # | Scenario | Steps | Expected Result | Result | Notes |
|---|---|---|---|---|---|
| E1 | User list | Navigate to Users | All active users listed with roles | | |
| E2 | Create user | Click New User → fill name, email, role, campus → Save | User appears in list with correct role | | |
| E3 | Assign module access | Open a user → Permissions tab → enable COI module → Save | User can access COI after re-login | | |
| E4 | Deactivate user | Open a user → Deactivate | User can no longer log in | | |
| E5 | Role restriction | Log in as Staff user → attempt to access User Management | Access denied / menu option hidden | | |

---

### 3F — Non-Functional

| # | Scenario | Expected Result | Result | Notes |
|---|---|---|---|---|
| F1 | Backup ran | Check `/var/log/pmo-backup.log` — last entry less than 24 hours ago | Log shows completed backup | | |
| F2 | Health endpoint | `GET /health` returns `{"status":"ok",...}` | HTTP 200 with healthy database check | | |
| F3 | Swagger hidden | Navigate to `/api/docs` in production | HTTP 404 (Swagger disabled in production) | | |
| F4 | Direct DB port blocked | `telnet <server-ip> 5432` from an external machine | Connection refused | | |
| F5 | Page load time | Navigate between pages | Pages load within 3 seconds on campus LAN | | |

---

## 4. Defect Log

Use this table to record any failures from Section 3.

| # | Test ID | Actual Result | Severity | Screenshot | Status |
|---|---|---|---|---|---|
| 1 | | | S1 / S2 / S3 / S4 | | Open / Resolved |
| 2 | | | | | |
| 3 | | | | | |

**Severity guide:**
- **S1** — System unusable, data loss, security breach
- **S2** — Core feature broken (cannot submit reports, cannot log in)
- **S3** — Feature partially broken, workaround exists
- **S4** — Cosmetic issue, minor inconvenience

---

## 5. UAT Sign-Off

All S1 and S2 defects must be resolved before signing. S3/S4 may be deferred at PMO Director discretion.

| Role | Name | Date | Result | Signature |
|---|---|---|---|---|
| PMO Staff Tester | | | ☐ Accepted ☐ Rejected | |
| MIS Staff Tester | | | ☐ Accepted ☐ Rejected | |
| PMO Director | | | ☐ Approved for Go-Live ☐ Hold | |
| MIS Director | | | ☐ Approved for Go-Live ☐ Hold | |

**Go-live may proceed when all four signatures are obtained with "Accepted / Approved."**

---

## 6. Notes

*(Space for testers to record observations, edge cases, and recommendations not captured above)*
