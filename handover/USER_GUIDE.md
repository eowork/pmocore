# CSU CORE Dashboard — User Quick Guide

> **Audience:** PMO staff, administrators, and end users
> **System URL:** `http://localhost:3001` (or the domain assigned by MIS)

---

## Logging In

Open the system URL in your browser. Three login methods are available depending on what MIS has configured:

| Method | How | Who |
|---|---|---|
| **Local account** | Enter your username/email and password | pmoadmin, seeded Admin accounts |
| **Google OAuth** | Click "Sign in with Google" | carsu.edu.ph Google accounts |
| **Institutional (LDAP)** | Enter your carsu.edu.ph email and Windows/email password | After MIS activates AD login |

If your account is locked after too many failed attempts, contact a System Admin to unlock it.

---

## Roles and What They Can Do

| Role | Access level |
|---|---|
| **SuperAdmin** | Full access to all modules, all campuses, user management, system settings |
| **Admin** | Full access to assigned modules and campuses; cannot manage system settings |
| **Staff** | Data entry for assigned pillars/operations within their campus |
| **Auditor** | Read-only access to all modules + activity logs |
| **Client** | Read-only access to public dashboards only |
| **Contractor** | Scoped access to assigned construction projects only |

---

## Modules

### COI — Construction of Infrastructure

Tracks construction and repair projects across all campuses.

**Key features:**
- Project list with status, campus, and financial summary
- Per-project detail: Overview, Gallery, Documents, Analytics, Profile
- Public-facing project page (no login required)
- Gallery photo upload and management
- Document checklist and template downloads
- Activity log per project

**Statuses:** Proposal → Planning → Ongoing → Complete / On Hold / Cancelled

**Who enters data:** Admin and Staff with COI module access

---

### University Operations (UO)

Tracks BAR No. 1 (Physical Accomplishment) and BAR No. 2 (Financial Accomplishment) per quarter.

**BAR No. 1 — Physical Accomplishment:**
- Organized by pillar (Governance, Administration, QASS, External Linkages)
- Enter Target and Actual values per indicator per quarter
- Quarterly Report lifecycle: Draft → Pending Review → Published

**BAR No. 2 — Financial Accomplishment:**
- Enter Allotment, Obligation, and Disbursement per program per quarter
- Utilization rate is computed automatically
- Same quarterly report lifecycle applies

**Quarterly Report workflow:**
1. Staff enter data → report is in **Draft**
2. Staff submit for review → report moves to **Pending Review**
3. Admin approves → report is **Published** (data is locked)
4. Admin can Reject → report returns to Draft
5. Admin can Unlock → report returns to Draft for correction
6. Any edit to data while Published auto-reverts the report to Draft

---

### Repairs

Tracks repair and maintenance projects. Similar structure to COI but scoped to repair work.

---

### GAD Parity

Gender and Development parity data entry and reporting.

---

### User Management (Admin/SuperAdmin only)

Accessed via the Users menu item.

**Tasks available:**
- Create new user accounts
- Assign roles
- Set campus and module-level access
- Deactivate or reactivate accounts
- View activity logs per user

---

## Common Tasks

### Change your password

1. Click your profile avatar (top-right corner)
2. Select "Change Password"
3. Enter current password and new password
4. Click Save

### Download a document template

1. Open a COI project → Documents tab
2. Find the document type in the checklist
3. Click the download icon next to the template column
4. A `.docx` file downloads to your computer

### Submit a quarterly report (UO)

1. Navigate to University Operations → Physical or Financial Accomplishment
2. Select the fiscal year and quarter
3. Complete all required data entry
4. Click **"Submit for Review"**
5. An Admin will review and approve or reject

### Upload a photo to COI gallery

1. Open the COI project
2. Click the **Gallery** tab
3. Click **"Upload Photo"**
4. Select an image file (JPG, PNG, WebP supported; max 10 MB)
5. Photo appears in the gallery after upload

### Export / print a report

Reports can be printed from the browser using Ctrl+P / Cmd+P. For formatted Excel/PDF exports, use the export button on the relevant page (where available).

---

## Getting Help

| Issue | Contact |
|---|---|
| Cannot log in / account locked | System Administrator (Admin role) |
| Missing module access | System Administrator |
| Data entry errors (wrong quarter, wrong fiscal year) | System Administrator (can unlock quarterly report) |
| System down or not loading | MIS / server operator |
| Feature request or bug | PMO Director → outgoing operator or successor |

---

## Browser Compatibility

| Browser | Support |
|---|---|
| Chrome 110+ | Fully supported |
| Edge 110+ | Fully supported |
| Firefox 110+ | Supported |
| Safari 16+ | Supported |
| Internet Explorer | Not supported |

Best experience on a laptop or desktop. Mobile browsers are functional but the data tables are optimized for wider screens.
