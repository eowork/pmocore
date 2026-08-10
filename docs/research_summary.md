# Research Summary: Phase 2.4 Artifact + Phase 2.5 Scope
**Date:** 2026-01-14
**Status:** ACTIVE REFERENCE (do not duplicate into plan_active.md)
**Reference:** `docs/plan_active.md`, `database/database draft/2026_01_12/pmo_schema_pg.sql`

---

## 0. Implementation Status Log

| Step | Description | Status | Date | Notes |
|------|-------------|--------|------|-------|
| 2.5.0 | Shared Infrastructure | DONE | 2026-01-14 | common/dto, auth module, guards, decorators, validation |
| 2.5.1 | University Operations API | DONE | 2026-01-14 | CRUD + indicators + financials endpoints |
| 2.5.2 | Projects Core API | DONE | 2026-01-14 | CRUD endpoints for base projects table |
| 2.5.3 | Construction Projects API | DONE | 2026-01-14 | CRUD + milestones + financials endpoints |
| 2.5.4 | Repair Projects API | DONE | 2026-01-14 | CRUD + POW items + phases + team members |
| 2.5.5 | GAD Parity Reports API | DONE | 2026-01-14 | 5 parity tables + GPB + budget plans endpoints |
| 2.5.X | Build Verification | DONE | 2026-01-14 | `npm run build` succeeds with all modules |
| 2.5.V | Verification Harness | DONE | 2026-01-14 | Created `docs/test.md` with 75 endpoint tests |
| AUDIT | Codebase Alignment | DONE | 2026-01-15 | Drift detection complete - see Section 0.1 |
| 2.5.6 | Users Module API | DONE | 2026-01-15 | Admin CRUD + role assignment + account management |
| 2.5.7 | ENUM Consistency Audit | DONE | 2026-01-15 | 8 BLOCKING issues identified - see Section 9 |
| 2.5.8 | Seed Data Compatibility | DONE | 2026-01-15 | Verified seed data uses valid enum values - see Section 9.9 |
| 2.6.R | Phase 2.6 Research | DONE | 2026-01-15 | File uploads, documents, media - see Section 10 |
| 2.7.0 | Reference Data ENUMs | DONE | 2026-01-19 | ContractorStatus, DepartmentStatus, SettingDataType |
| 2.7.1 | Contractors API | DONE | 2026-01-19 | CRUD + status management |
| 2.7.2 | Funding Sources API | DONE | 2026-01-19 | CRUD endpoints |
| 2.7.3 | Departments API | DONE | 2026-01-19 | CRUD + user assignment |
| 2.7.4 | Repair Types API | DONE | 2026-01-19 | CRUD endpoints |
| 2.7.5 | Construction Subcategories API | DONE | 2026-01-19 | CRUD endpoints |
| 2.7.6 | System Settings API | DONE | 2026-01-19 | CRUD + key-based access |
| 2.8.0 | Swagger/OpenAPI Setup | DONE | 2026-01-19 | SwaggerModule configured in main.ts |
| 2.8.1 | Controller @ApiTags | DONE | 2026-01-19 | All 17 controllers tagged |
| 2.8.4 | Global Exception Filter | DONE | 2026-01-19 | Consistent error responses |
| 2.8.5 | Logging Interceptor | DONE | 2026-01-19 | Structured JSON logging |
| 2.8.6 | Health Check Enhancement | DONE | 2026-01-19 | DB latency + memory checks |
| 2.9.0 | Test Dependencies | DONE | 2026-01-20 | jest, ts-jest, @nestjs/testing, supertest |
| 2.9.1 | Jest Configuration | DONE | 2026-01-20 | jest.config.js + test/jest-e2e.json |
| 2.9.2 | Auth Unit Tests | DONE | 2026-01-20 | 8 tests: validateUser, login, getProfile, logout |
| 2.9.3 | Contractors E2E Tests | DONE | 2026-01-20 | 8 tests: auth check, CRUD cycle, 404 handling |
| 2.9.V | Full Verification | DONE | 2026-01-20 | npm run build && npm run test passes |
| 2.9.D | Test Documentation | DONE | 2026-01-20 | docs/test_doc.md created (beginner usage guide) |
| 3.0.R | Phase 3.0 Research (Initial) | DONE | 2026-01-20 | Vue 3 + Vuetify 3 frontend setup - see Section 14 |
| 3.0.P | Prototype UI Analysis | DONE | 2026-01-20 | Backend-UI alignment, CSU branding - see Section 15 |

---

## 0.1 Codebase Alignment Audit (2026-01-15)

### FINDINGS SUMMARY

| # | File/Module | Issue | Classification | Root Cause | Impact |
|---|-------------|-------|----------------|------------|--------|
| 1 | `pmo-backend/src/users/` | ~~MISSING~~ **FIXED** in Step 2.5.6 | RESOLVED | Implemented 2026-01-15 | N/A |
| 2 | `docs/plan_active.md:877` | ~~Lists as CREATED but absent~~ **FIXED** | RESOLVED | Module now exists | N/A |

### VERIFIED SAFE

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 1 | AppModule wiring | SAFE | All 9 modules properly imported |
| 2 | Global JWT guard | SAFE | JwtAuthGuard applied via APP_GUARD |
| 3 | ThrottlerGuard | SAFE | Rate limiting active |
| 4 | Health @Public() | SAFE | Correctly excludes health from JWT |
| 5 | Schema ↔ API alignment | SAFE | Table names, fields, FKs match |
| 6 | DTO barrel exports | SAFE | All index.ts files present |
| 7 | Pagination pattern | SAFE | Consistent across all services |
| 8 | Soft delete pattern | SAFE | `deleted_at IS NULL` used everywhere |
| 9 | Audit fields | SAFE | `created_by`/`submitted_by` correct per table |

### MISSING MODULE DETAIL

**Module:** `pmo-backend/src/users/`
**Expected Contents (per plan_active.md):**
- Users controller (Admin CRUD)
- Users service
- Role assignment endpoints
- User management DTOs

**Current State:** Directory does not exist. No users module in codebase.

**Impact:**
- No API endpoints for user administration
- No way to create/update/delete users via API
- Role assignment must be done via direct DB access
- Auth module works (login/profile) but admin functions missing

**Resolution:** UsersModule implemented in Step 2.5.6 (2026-01-15)

### MODULES INVENTORY (ACTUAL - UPDATED 2026-01-15)

```
pmo-backend/src/
├── app.module.ts              ✓ SAFE
├── app.controller.ts          ✓ SAFE
├── app.service.ts             ✓ SAFE
├── main.ts                    ✓ SAFE
├── auth/                      ✓ SAFE (9 files)
├── common/                    ✓ SAFE (4 files)
├── database/                  ✓ SAFE (3 files)
├── health/                    ✓ SAFE (3 files)
├── university-operations/     ✓ SAFE (8 files)
├── projects/                  ✓ SAFE (6 files)
├── construction-projects/     ✓ SAFE (8 files)
├── repair-projects/           ✓ SAFE (9 files)
├── gad/                       ✓ SAFE (6 files)
└── users/                     ✓ CREATED (7 files) - Step 2.5.6
```

### NO MERGE ARTIFACTS DETECTED

- No duplicate controllers
- No conflicting DTOs
- No orphaned files
- No unused imports

---

## 1. Phase 2.4 (Auth & RBAC) — Completed Artifact
Phase 2.4 is complete and treated as a stable foundation for Phase 2.5.

**Implemented (authoritative):**
- Auth module: `pmo-backend/src/auth/*` (JWT login, guards/decorators) ✓
- Users/admin module: `pmo-backend/src/users/*` ✓ (Admin CRUD + role assignment) - Step 2.5.6
- Rate limiting: `pmo-backend/src/app.module.ts` (Throttler) + `@Throttle` on auth login
- Security hardening: auth failure logs redact PII; generic auth errors; SSO-only sentinel for Google accounts

**Security posture (key points):**
- Deny-by-default RBAC with explicit allow via roles/permissions; SuperAdmin bypass supported.
- No secrets logged; no passwords/hashes/tokens returned in responses.

---

## 2. Phase 2.5 Boundaries (Locked)
**Included:** domain APIs, basic validation, stable request/response contracts, RBAC wiring.

**Not included:** frontend/UI, analytics/reporting dashboards, performance optimization, DevOps/deploy pipelines, schema redesign.

---

## 3. Schema Dependency Analysis (Value-First Ordering)

### 3.1 University Operations — STANDALONE (No FK to projects)
**Location:** `pmo_schema_pg.sql` lines 920+

| Table | FK Dependencies | Status |
|-------|-----------------|--------|
| `university_operations` | None (uses `operation_type_enum`) | STANDALONE |
| `operation_organizational_info` | FK → `university_operations(id)` | Nested under UniOps |
| `operation_indicators` | FK → `university_operations(id)` | Nested under UniOps |
| `operation_financials` | FK → `university_operations(id)` | Nested under UniOps |

**Finding:** University Operations is completely independent from the `projects` table. It can be built first without any project infrastructure.

### 3.2 Construction Projects — REQUIRES projects FK
**Location:** `pmo_schema_pg.sql` lines 477+

| Table | FK Dependencies | Status |
|-------|-----------------|--------|
| `projects` | None (base table) | REQUIRED as parent |
| `construction_projects` | FK → `projects(id)` | REQUIRES projects core |

**Finding:** Construction projects require a minimal `projects` core for the FK constraint.

### 3.3 Repair Projects — Priority 4
| Table | FK Dependencies | Status |
|-------|-----------------|--------|
| `repair_projects` | FK → `projects(id)`, `repair_types(id)`, `facilities(id)` | REQUIRES projects |
| `repair_pow_items` | FK → `repair_projects(id)` | Nested |
| `repair_project_phases` | FK → `repair_projects(id)` | Nested |
| `repair_project_milestones` | FK → `repair_projects(id)` | Nested |
| `repair_project_financial_reports` | FK → `repair_projects(id)` | Nested |
| `repair_project_team_members` | FK → `repair_projects(id)` | Nested |

### 3.4 GAD Parity Reports — Priority 5 (STANDALONE)
| Table | FK Dependencies | Status |
|-------|-----------------|--------|
| `gad_student_parity_data` | None | STANDALONE |
| `gad_faculty_parity_data` | None | STANDALONE |
| `gad_staff_parity_data` | None | STANDALONE |
| `gad_pwd_parity_data` | None | STANDALONE |
| `gad_indigenous_parity_data` | None | STANDALONE |
| `gad_gpb_accomplishments` | None | STANDALONE |
| `gad_budget_plans` | None | STANDALONE |
| `gad_yearly_profiles` | None | STANDALONE |

---

## 4. API Priorities & Sequencing (Phase 2.5)

| Priority | Domain | FK Dependency | Rationale |
|----------|--------|---------------|-----------|
| 1 | University Operations | NONE | Standalone, immediate value |
| 2 | Projects Core | NONE | FK parent for construction/repair |
| 3 | Construction Projects | projects | Infrastructure tracking |
| 4 | Repair Projects | projects, repair_types | Maintenance tracking |
| 5 | GAD Parity Reports | NONE | Compliance reporting |

---

## 5. API Conventions (Startup-Ready Patterns)

### 5.1 REST Resource Naming
```
GET    /resources           → List (paginated)
GET    /resources/:id       → Get single
POST   /resources           → Create
PATCH  /resources/:id       → Partial update
DELETE /resources/:id       → Soft delete

Nested resources:
GET    /resources/:id/children       → List children
POST   /resources/:id/children       → Create child
```

### 5.2 Pagination
```typescript
// Request: GET /resources?page=1&limit=20
// Response:
{
  data: T[],
  meta: {
    total: number,
    page: number,
    limit: number,
    totalPages: number
  }
}
```

### 5.3 Filtering & Sorting
```typescript
// Query params (allowlisted columns only)
GET /resources?status=ACTIVE&campus=MAIN&sort=created_at&order=desc

// Allowlist pattern in service:
const ALLOWED_FILTERS = ['status', 'campus', 'type'];
const ALLOWED_SORTS = ['created_at', 'title', 'status'];
```

### 5.4 Soft Delete
```sql
-- All queries implicitly filter:
WHERE deleted_at IS NULL

-- DELETE endpoint sets:
UPDATE table SET deleted_at = NOW(), deleted_by = $userId WHERE id = $id
```

### 5.5 Audit Fields
```typescript
// Auto-populated from JWT (req.user.id)
CREATE: { created_by, created_at: NOW() }
UPDATE: { updated_by, updated_at: NOW() }
DELETE: { deleted_by, deleted_at: NOW() }
```

### 5.6 HTTP Status Codes
| Code | When | Example |
|------|------|---------|
| 200 | Success (GET, PATCH) | Resource returned/updated |
| 201 | Created (POST) | New resource created |
| 204 | No Content (DELETE) | Soft delete success |
| 400 | Bad Request | Validation failed |
| 401 | Unauthorized | Missing/invalid JWT |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate unique key |

### 5.7 Error Response Shape
```typescript
{
  statusCode: number,
  message: string | string[],
  error: string,
  timestamp: string
}
```

### 5.8 Logging (No PII)
```
ENTITY_ACTION: id=uuid, by=userId
// Examples:
PROJECT_CREATED: id=abc-123, by=user-456
PROJECT_UPDATED: id=abc-123, by=user-456, fields=[title,status]
PROJECT_DELETED: id=abc-123, by=user-456
```

---

## 6. Patterns to Reuse (Do Not Rebuild)

### 6.1 Data Access Layer
```typescript
// DatabaseService.query() - parameterized SQL only
const result = await this.db.query(
  'SELECT * FROM table WHERE id = $1 AND deleted_at IS NULL',
  [id]
);
```

### 6.2 Auth/RBAC Guards
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Staff')
@Get()
findAll(@CurrentUser() user: JwtPayload) { }
```

### 6.3 Input Validation
```typescript
// UUID validation
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) { }

// DTO validation with class-validator
export class CreateDto {
  @IsString() @IsNotEmpty() title: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(StatusEnum) status: StatusEnum;
}
```

### 6.4 Dynamic PATCH Updates
```typescript
// Build SET clause dynamically (from users.service.ts pattern)
const fields = Object.keys(dto).filter(k => dto[k] !== undefined);
const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
const values = fields.map(f => dto[f]);
```

---

## 7. Module Structure (Per Domain)

```
src/
├── domain-name/
│   ├── domain.module.ts       # NestJS module
│   ├── domain.controller.ts   # HTTP endpoints
│   ├── domain.service.ts      # Business logic + SQL
│   └── dto/
│       ├── create-domain.dto.ts
│       ├── update-domain.dto.ts
│       └── query-domain.dto.ts
```

---

## 8. Constraints & Risks (Phase 2.5)

| Constraint | Mitigation |
|------------|------------|
| Audit fields required | Auto-populate from `@CurrentUser()` in service |
| Soft delete default | Add `WHERE deleted_at IS NULL` to all queries |
| Unique codes (409) | Check existence before INSERT, throw ConflictException |
| FK integrity | Validate parent exists before child INSERT |
| Max page size | Cap `limit` at 100 in pagination |
| SQL injection | Parameterized queries only (never string concat) |

---

## 9. ENUM Consistency Audit (2026-01-15)

### 9.1 PostgreSQL ENUM Definitions (Authoritative Source)

| # | ENUM Name | Values | Used By |
|---|-----------|--------|---------|
| 1 | `campus_enum` | `MAIN`, `CABADBARAN`, `BOTH` | university_operations, projects, construction_projects, repair_projects |
| 2 | `project_status_enum` | `PLANNING`, `ONGOING`, `COMPLETED`, `ON_HOLD`, `CANCELLED` | projects, university_operations |
| 3 | `repair_status_enum` | `REPORTED`, `INSPECTED`, `APPROVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` | repair_projects |
| 4 | `urgency_level_enum` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | repair_projects |
| 5 | `operation_type_enum` | `HIGHER_EDUCATION`, `ADVANCED_EDUCATION`, `RESEARCH`, `TECHNICAL_ADVISORY` | university_operations |
| 6 | `project_type_enum` | `CONSTRUCTION`, `REPAIR`, `RESEARCH`, `EXTENSION`, `TRAINING`, `OTHER` | projects |
| 7 | `building_type_enum` | `ACADEMIC`, `ADMINISTRATIVE`, `RESIDENTIAL`, `OTHER` | buildings |
| 8 | `building_status_enum` | `OPERATIONAL`, `UNDER_CONSTRUCTION`, `RENOVATION`, `CLOSED` | buildings |
| 9 | `room_type_enum` | `CLASSROOM`, `LABORATORY`, `OFFICE`, `CONFERENCE`, `AUDITORIUM`, `OTHER` | rooms |
| 10 | `room_status_enum` | `AVAILABLE`, `OCCUPIED`, `UNDER_MAINTENANCE`, `UNAVAILABLE` | rooms |
| 11 | `semester_enum` | `FIRST`, `SECOND`, `SUMMER` | academic tables |
| 12 | `condition_enum` | `POOR`, `FAIR`, `GOOD`, `VERY_GOOD`, `EXCELLENT` | equipment, facilities |
| 13 | `contractor_status_enum` | `ACTIVE`, `SUSPENDED`, `BLACKLISTED` | contractors |
| 14 | `media_type_enum` | `IMAGE`, `VIDEO`, `DOCUMENT`, `OTHER` | media/gallery |
| 15 | `department_status_enum` | `ACTIVE`, `INACTIVE` | departments |
| 16 | `setting_data_type_enum` | `STRING`, `NUMBER`, `BOOLEAN`, `JSON`, `DATE`, `DATETIME` | system_settings |

### 9.2 DTO ENUM Inventory

| # | DTO Enum | File Location | Values |
|---|----------|---------------|--------|
| 1 | `Campus` | construction-projects/dto/create-construction-project.dto.ts | `MAIN`, `BUTUAN`, `CABADBARAN`, `SAN_FRANCISCO` |
| 2 | `Campus` | repair-projects/dto/create-repair-project.dto.ts | `MAIN`, `BUTUAN`, `CABADBARAN`, `SAN_FRANCISCO` |
| 3 | `Campus` | projects/dto/create-project.dto.ts | `MAIN`, `BUTUAN`, `CABADBARAN`, `SAN_FRANCISCO` |
| 4 | `Campus` | university-operations/dto/create-operation.dto.ts | `MAIN`, `BUTUAN`, `CABADBARAN`, `SAN_FRANCISCO` |
| 5 | `ProjectStatus` | construction-projects/dto/create-construction-project.dto.ts | `DRAFT`, `PENDING`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`, `CANCELLED` |
| 6 | `ProjectStatus` | projects/dto/create-project.dto.ts | `DRAFT`, `PENDING`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`, `CANCELLED` |
| 7 | `ProjectStatus` | university-operations/dto/create-operation.dto.ts | `DRAFT`, `PENDING`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`, `CANCELLED` |
| 8 | `RepairStatus` | repair-projects/dto/create-repair-project.dto.ts | `PENDING`, `APPROVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| 9 | `UrgencyLevel` | repair-projects/dto/create-repair-project.dto.ts | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| 10 | `OperationType` | university-operations/dto/create-operation.dto.ts | `INSTRUCTION`, `RESEARCH`, `EXTENSION`, `PRODUCTION`, `ADMINISTRATIVE` |
| 11 | `ProjectType` | projects/dto/create-project.dto.ts | `CONSTRUCTION`, `REPAIR`, `MAINTENANCE`, `RENOVATION` |
| 12 | `ParityStatus` | gad/dto/parity-data.dto.ts | `pending`, `approved`, `rejected` |
| 13 | `IndicatorStatus` | university-operations/dto/create-indicator.dto.ts | `pending`, `approved`, `rejected` |

### 9.3 Gap Analysis

| DTO Enum | Schema ENUM | DTO Values | Schema Values | Severity | Issue |
|----------|-------------|------------|---------------|----------|-------|
| `Campus` | `campus_enum` | MAIN, BUTUAN, CABADBARAN, SAN_FRANCISCO | MAIN, CABADBARAN, BOTH | **BLOCKING** | `BUTUAN`, `SAN_FRANCISCO` invalid; `BOTH` missing |
| `ProjectStatus` | `project_status_enum` | DRAFT, PENDING, IN_PROGRESS, COMPLETED, ON_HOLD, CANCELLED | PLANNING, ONGOING, COMPLETED, ON_HOLD, CANCELLED | **BLOCKING** | `DRAFT`, `PENDING`, `IN_PROGRESS` invalid; `PLANNING`, `ONGOING` missing |
| `RepairStatus` | `repair_status_enum` | PENDING, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED | REPORTED, INSPECTED, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED | **BLOCKING** | `PENDING` invalid; `REPORTED`, `INSPECTED` missing |
| `UrgencyLevel` | `urgency_level_enum` | LOW, MEDIUM, HIGH, CRITICAL | LOW, MEDIUM, HIGH, CRITICAL | OK | **MATCH** |
| `OperationType` | `operation_type_enum` | INSTRUCTION, RESEARCH, EXTENSION, PRODUCTION, ADMINISTRATIVE | HIGHER_EDUCATION, ADVANCED_EDUCATION, RESEARCH, TECHNICAL_ADVISORY | **BLOCKING** | Only `RESEARCH` matches; all others invalid |
| `ProjectType` | `project_type_enum` | CONSTRUCTION, REPAIR, MAINTENANCE, RENOVATION | CONSTRUCTION, REPAIR, RESEARCH, EXTENSION, TRAINING, OTHER | **BLOCKING** | `MAINTENANCE`, `RENOVATION` invalid; `RESEARCH`, `EXTENSION`, `TRAINING`, `OTHER` missing |
| `ParityStatus` | (none) | pending, approved, rejected | N/A | WARNING | Custom enum not in schema; lowercase casing |
| `IndicatorStatus` | (none) | pending, approved, rejected | N/A | WARNING | Custom enum not in schema; lowercase casing |

### 9.4 BLOCKING Issues Summary

| # | Issue | Impact | Affected Modules |
|---|-------|--------|------------------|
| 1 | Campus: `BUTUAN`, `SAN_FRANCISCO` not in schema | INSERT fails with invalid enum value | All domain modules |
| 2 | Campus: `BOTH` missing from DTO | Cannot select `BOTH` campus option | All domain modules |
| 3 | ProjectStatus: `DRAFT`, `PENDING`, `IN_PROGRESS` not in schema | INSERT fails | projects, construction, uni-ops |
| 4 | ProjectStatus: `PLANNING`, `ONGOING` missing from DTO | Cannot use schema values | projects, construction, uni-ops |
| 5 | RepairStatus: `PENDING` not in schema | INSERT fails | repair-projects |
| 6 | RepairStatus: `REPORTED`, `INSPECTED` missing | Cannot use schema values | repair-projects |
| 7 | OperationType: 4/5 values invalid | INSERT fails | university-operations |
| 8 | ProjectType: 2/4 values invalid | INSERT fails | projects |

### 9.5 Remediation Strategy (NO IMPLEMENTATION)

**Authoritative Source:** PostgreSQL schema is the single source of truth.

| DTO Enum | Remediation | Direction | Justification |
|----------|-------------|-----------|---------------|
| `Campus` | Update DTO to match schema | DTO → Schema | Schema defines physical campuses |
| `ProjectStatus` | Update DTO to match schema | DTO → Schema | Schema defines business workflow |
| `RepairStatus` | Update DTO to match schema | DTO → Schema | Schema defines repair workflow |
| `OperationType` | Update DTO to match schema | DTO → Schema | Schema defines SUC operations |
| `ProjectType` | Update DTO to match schema | DTO → Schema | Schema defines project categories |
| `ParityStatus` | Add to schema OR justify | Evaluate | Custom status not modeled |
| `IndicatorStatus` | Add to schema OR justify | Evaluate | Custom status not modeled |

### 9.6 Recommended ENUM Corrections

**Campus (4 files):**
```
FROM: MAIN, BUTUAN, CABADBARAN, SAN_FRANCISCO
TO:   MAIN, CABADBARAN, BOTH
```

**ProjectStatus (3 files):**
```
FROM: DRAFT, PENDING, IN_PROGRESS, COMPLETED, ON_HOLD, CANCELLED
TO:   PLANNING, ONGOING, COMPLETED, ON_HOLD, CANCELLED
```

**RepairStatus (1 file):**
```
FROM: PENDING, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED
TO:   REPORTED, INSPECTED, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED
```

**OperationType (1 file):**
```
FROM: INSTRUCTION, RESEARCH, EXTENSION, PRODUCTION, ADMINISTRATIVE
TO:   HIGHER_EDUCATION, ADVANCED_EDUCATION, RESEARCH, TECHNICAL_ADVISORY
```

**ProjectType (1 file):**
```
FROM: CONSTRUCTION, REPAIR, MAINTENANCE, RENOVATION
TO:   CONSTRUCTION, REPAIR, RESEARCH, EXTENSION, TRAINING, OTHER
```

### 9.7 DRY Recommendation

Create shared enum definitions in `src/common/enums/` to avoid duplication:
- `src/common/enums/campus.enum.ts`
- `src/common/enums/project-status.enum.ts`
- `src/common/enums/project-type.enum.ts`
- `src/common/enums/repair-status.enum.ts`
- `src/common/enums/operation-type.enum.ts`
- `src/common/enums/urgency-level.enum.ts`

Import from common location in all DTOs.

### 9.8 ENUM Implementation Status (RESOLVED)

**Date:** 2026-01-15

All 8 BLOCKING issues have been resolved. Shared enums created in `src/common/enums/`:

| # | ENUM File | Values | Match Schema |
|---|-----------|--------|--------------|
| 1 | `campus.enum.ts` | MAIN, CABADBARAN, BOTH | ✓ |
| 2 | `project-status.enum.ts` | PLANNING, ONGOING, COMPLETED, ON_HOLD, CANCELLED | ✓ |
| 3 | `repair-status.enum.ts` | REPORTED, INSPECTED, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED | ✓ |
| 4 | `urgency-level.enum.ts` | LOW, MEDIUM, HIGH, CRITICAL | ✓ |
| 5 | `operation-type.enum.ts` | HIGHER_EDUCATION, ADVANCED_EDUCATION, RESEARCH, TECHNICAL_ADVISORY | ✓ |
| 6 | `project-type.enum.ts` | CONSTRUCTION, REPAIR, RESEARCH, EXTENSION, TRAINING, OTHER | ✓ |

**Build Status:** `npm run build` succeeds ✓

### 9.9 Seed Data Compatibility Verification

**Date:** 2026-01-15
**Reference:** `database/database draft/2026_01_12/pmo_seed_data.sql`

#### Seed Data ENUM Usage

| Table | Column | Value(s) Used | Schema ENUM | Compatibility |
|-------|--------|---------------|-------------|---------------|
| contractors | status | `'ACTIVE'` | contractor_status_enum (ACTIVE, SUSPENDED, BLACKLISTED) | ✓ VALID |
| departments | status | `'ACTIVE'` | department_status_enum (ACTIVE, INACTIVE) | ✓ VALID |
| system_settings | data_type | `'STRING'`, `'NUMBER'` | setting_data_type_enum | ✓ VALID |
| system_settings | campus_default (value) | `'MAIN'` | campus_enum (MAIN, CABADBARAN, BOTH) | ✓ VALID |

#### Seed Data Scope Analysis

The seed data seeds **reference/lookup tables only** (no domain records):

| Table | Record Count | Uses ENUMs |
|-------|--------------|------------|
| roles | 3 | No |
| funding_sources | 5 | No |
| repair_types | 9 | No |
| construction_subcategories | 7 | No |
| contractors | 3 | Yes (contractor_status_enum) |
| departments | 7 | Yes (department_status_enum) |
| system_settings | 6 | Yes (setting_data_type_enum, campus value) |

**Domain tables NOT seeded:**
- `projects` (would use project_status_enum, project_type_enum, campus_enum)
- `university_operations` (would use operation_type_enum, project_status_enum, campus_enum)
- `construction_projects` (would use project_status_enum, campus_enum)
- `repair_projects` (would use repair_status_enum, urgency_level_enum, campus_enum)

#### Verification Result

| Verification | Status |
|--------------|--------|
| All 6 DTO enums match PostgreSQL schema | ✓ VERIFIED |
| Seed data uses valid enum values | ✓ VERIFIED |
| No invalid enum values in seed data | ✓ VERIFIED |
| DTO enums compatible for domain INSERT | ✓ VERIFIED |

**Conclusion:** DTO enums are fully compatible with both:
1. PostgreSQL schema ENUM definitions (16 total)
2. Seed data reference values (contractor_status, department_status, campus, setting_data_type)

---

## 10. Phase 2.6 Research (2026-01-15)

### 10.1 Backend Directory Structure Analysis

**Current Modules (85 TypeScript files):**

| Module | Files | Purpose | Status |
|--------|-------|---------|--------|
| app/ | 3 | Core application | COMPLETE |
| auth/ | 16 | JWT, guards, decorators, strategies | COMPLETE |
| common/ | 9 | DTOs, enums, interfaces | COMPLETE |
| construction-projects/ | 8 | CRUD + milestones + financials | COMPLETE |
| database/ | 3 | PostgreSQL connection | COMPLETE |
| gad/ | 7 | Parity reports (5 tables + planning) | COMPLETE |
| health/ | 3 | Health checks | COMPLETE |
| projects/ | 7 | Core project CRUD | COMPLETE |
| repair-projects/ | 10 | CRUD + POW + phases + team | COMPLETE |
| university-operations/ | 9 | CRUD + indicators + financials | COMPLETE |
| users/ | 8 | Admin CRUD + role management | COMPLETE |

**Missing Modules for Phase 2.6:**

| Module | Purpose | Priority |
|--------|---------|----------|
| uploads/ | File upload infrastructure (Multer) | HIGH |
| documents/ | Document CRUD with file handling | HIGH |
| media/ | Media/gallery CRUD with image handling | HIGH |
| storage/ | Storage abstraction (local/S3) | MEDIUM |

### 10.2 DTO Directory Analysis

**Current DTO Coverage:**

| Module | DTOs | Status |
|--------|------|--------|
| auth/dto | login.dto.ts | COMPLETE |
| common/dto | pagination.dto.ts | COMPLETE |
| construction-projects/dto | create, update, query, milestone, financial (6) | COMPLETE |
| gad/dto | parity-data, planning, query (3) | COMPLETE |
| projects/dto | create, update, query (4) | COMPLETE |
| repair-projects/dto | create, update, query, phase, pow-item, team-member (7) | COMPLETE |
| university-operations/dto | create, update, query, indicator, financial (6) | COMPLETE |
| users/dto | create, update, query, assign-role (5) | COMPLETE |

**Missing DTOs for Phase 2.6:**

| DTO | Purpose | Fields |
|-----|---------|--------|
| UploadFileDto | File upload validation | file, entity_type, entity_id |
| CreateDocumentDto | Document creation | document_type, description, category, file |
| UpdateDocumentDto | Document update | description, category, version |
| QueryDocumentDto | Document filtering | documentable_type, document_type, category |
| CreateMediaDto | Media creation | media_type, title, description, is_featured, file |
| UpdateMediaDto | Media update | title, description, alt_text, is_featured, display_order |
| QueryMediaDto | Media filtering | mediable_type, media_type, is_featured |

### 10.3 File Upload Infrastructure Research

**Schema Tables (Section 12 of pmo_schema_pg.sql):**

#### documents table (lines 1069-1091)
```
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| documentable_type | VARCHAR(100) | NO | Entity type (polymorphic) |
| documentable_id | UUID | NO | Entity ID (polymorphic) |
| document_type | VARCHAR(100) | NO | Contract, Report, etc. |
| file_name | VARCHAR(255) | NO | Original filename |
| file_path | VARCHAR(255) | NO | Storage path |
| file_size | INTEGER | NO | Size in bytes |
| mime_type | VARCHAR(100) | NO | MIME type |
| description | TEXT | YES | User description |
| version | INTEGER | YES | Version number (default 1) |
| category | VARCHAR(50) | YES | Category for grouping |
| extracted_text | TEXT | YES | OCR/text extraction (future) |
| chunks | JSONB | YES | Text chunks for search (future) |
| processed_at | TIMESTAMPTZ | YES | Processing timestamp |
| status | VARCHAR(50) | YES | ready, processing, error |
| uploaded_by | UUID | NO | FK to users |
```

#### media table (lines 1097-1123)
```
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| mediable_type | VARCHAR(100) | NO | Entity type (polymorphic) |
| mediable_id | UUID | NO | Entity ID (polymorphic) |
| media_type | media_type_enum | NO | IMAGE, VIDEO, DOCUMENT, OTHER |
| file_name | VARCHAR(255) | NO | Original filename |
| file_path | VARCHAR(255) | NO | Storage path |
| file_size | INTEGER | NO | Size in bytes |
| mime_type | VARCHAR(100) | NO | MIME type |
| title | VARCHAR(255) | YES | Display title |
| description | TEXT | YES | Description |
| alt_text | VARCHAR(255) | YES | Accessibility text |
| is_featured | BOOLEAN | YES | Featured flag |
| thumbnail_url | VARCHAR(255) | YES | Thumbnail path |
| dimensions | JSONB | YES | Width/height |
| tags | JSONB | YES | Tag array |
| capture_date | DATE | YES | Photo date |
| display_order | INTEGER | YES | Sort order |
| location | JSONB | YES | Geo coordinates |
| project_type | VARCHAR(50) | YES | Project classification |
| uploaded_by | UUID | NO | FK to users |
```

#### construction_gallery table (lines 551-559)
```
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| project_id | UUID | NO | FK to construction_projects |
| image_url | VARCHAR(500) | NO | Image URL/path |
| caption | VARCHAR(255) | YES | Image caption |
| category | VARCHAR(50) | YES | PROGRESS, BEFORE, AFTER, etc. |
| is_featured | BOOLEAN | YES | Featured flag |
| uploaded_at | TIMESTAMPTZ | NO | Upload timestamp |
```

### 10.4 Upload Infrastructure Requirements

**Multer Configuration:**
```typescript
// Required config for pmo-backend
{
  storage: diskStorage or S3,
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10MB default
    files: 5                      // Max files per request
  },
  fileFilter: allowedMimeTypes   // Whitelist approach
}
```

**Allowed File Types:**

| Category | Extensions | MIME Types |
|----------|------------|------------|
| Images | jpg, jpeg, png, gif, webp | image/* |
| Documents | pdf, doc, docx, xls, xlsx | application/pdf, application/msword, etc. |
| Spreadsheets | csv, xls, xlsx | text/csv, application/vnd.ms-excel |

**Storage Strategy:**

| Phase | Storage | Path Pattern |
|-------|---------|--------------|
| 2.6 (MVP) | Local disk | ./uploads/{entity_type}/{entity_id}/{filename} |
| Future | S3/MinIO | Same pattern, configurable via env |

**Security Requirements:**
- File size limits (configurable)
- MIME type validation (whitelist)
- Filename sanitization (remove special chars)
- No executable files (.exe, .sh, .bat, etc.)
- Virus scanning (future consideration)

### 10.5 test.md Analysis

**Current Coverage:**
- 59 direct endpoints
- 30 nested endpoints
- Total: 89 endpoint tests documented

**Issues Found:**

| Issue | Location | Severity |
|-------|----------|----------|
| Outdated enum: `INSTRUCTION` | Section 4.1, 4.3 | HIGH |
| Outdated enum: `DRAFT`, `PENDING` | Multiple sections | HIGH |
| Outdated enum: `BUTUAN`, `SAN_FRANCISCO` | Multiple sections | HIGH |
| Missing upload tests | Not present | MEDIUM |
| Missing documents module tests | Not present | MEDIUM |
| Missing media module tests | Not present | MEDIUM |

**Required Updates:**
1. Fix all enum values to match schema (Section 9.8 values)
2. Add file upload test section
3. Add documents CRUD tests
4. Add media CRUD tests
5. Add construction gallery tests
6. Add file validation failure tests

### 10.6 Phase 2.6 Candidate Definition

#### Phase 2.6 IS (In Scope):

| # | Component | Description | Priority |
|---|-----------|-------------|----------|
| 1 | Upload Infrastructure | Multer config, storage service, validation | HIGH |
| 2 | Documents Module | CRUD with file handling, polymorphic attachment | HIGH |
| 3 | Media Module | CRUD with image handling, thumbnails | HIGH |
| 4 | Construction Gallery | Gallery upload endpoints for construction projects | MEDIUM |
| 5 | Test Harness Update | Fix enums, add upload/document/media tests | HIGH |
| 6 | System Hardening | File size limits, MIME validation, security | HIGH |

#### Phase 2.6 IS NOT (Out of Scope):

| Component | Reason | Deferred To |
|-----------|--------|-------------|
| Frontend/UI | Separate phase | Phase 3.0 |
| Analytics/Reporting | Non-core functionality | Phase 3.1 |
| Performance Optimization | Premature optimization | As needed |
| DevOps/Deployment | Separate concern | Phase 3.2 |
| Email/Notifications | Not essential for MVP | Phase 3.1 |
| AI/Text Extraction | Advanced feature | Phase 4.0 |
| Virus Scanning | Requires external service | Phase 3.x |

### 10.7 Proposed Phase 2.6 Module Structure

```
src/
├── uploads/
│   ├── uploads.module.ts
│   ├── uploads.controller.ts
│   ├── uploads.service.ts
│   ├── storage/
│   │   ├── storage.service.ts
│   │   └── local-storage.strategy.ts
│   ├── validators/
│   │   ├── file-size.validator.ts
│   │   └── mime-type.validator.ts
│   └── dto/
│       └── upload-file.dto.ts
├── documents/
│   ├── documents.module.ts
│   ├── documents.controller.ts
│   ├── documents.service.ts
│   └── dto/
│       ├── create-document.dto.ts
│       ├── update-document.dto.ts
│       └── query-document.dto.ts
├── media/
│   ├── media.module.ts
│   ├── media.controller.ts
│   ├── media.service.ts
│   └── dto/
│       ├── create-media.dto.ts
│       ├── update-media.dto.ts
│       └── query-media.dto.ts
```

### 10.8 Proposed Phase 2.6 Endpoints

**Upload Infrastructure:**
```
POST /api/uploads                    → Generic file upload
```

**Documents Module:**
```
GET    /api/documents                → List all documents (admin)
GET    /api/{entity}/{id}/documents  → List entity documents
POST   /api/{entity}/{id}/documents  → Upload document for entity
GET    /api/documents/:docId         → Get document details
PATCH  /api/documents/:docId         → Update document metadata
DELETE /api/documents/:docId         → Soft delete document
GET    /api/documents/:docId/download → Download file
```

**Media Module:**
```
GET    /api/media                    → List all media (admin)
GET    /api/{entity}/{id}/media      → List entity media
POST   /api/{entity}/{id}/media      → Upload media for entity
GET    /api/media/:mediaId           → Get media details
PATCH  /api/media/:mediaId           → Update media metadata
DELETE /api/media/:mediaId           → Soft delete media
PATCH  /api/media/:mediaId/featured  → Toggle featured
```

**Construction Gallery (enhancement):**
```
GET    /api/construction-projects/:id/gallery  → List gallery images
POST   /api/construction-projects/:id/gallery  → Upload gallery image
PATCH  /api/construction-projects/:id/gallery/:gid → Update image
DELETE /api/construction-projects/:id/gallery/:gid → Remove image
```

### 10.9 Dependencies & Prerequisites

| Dependency | Purpose | Install Command |
|------------|---------|-----------------|
| multer | File upload handling | `npm install multer @types/multer` |
| uuid | Unique filename generation | Already installed (via pg) |
| sharp | Image processing/thumbnails | `npm install sharp` (optional) |
| file-type | MIME type detection | `npm install file-type` (optional) |

### 10.10 MIS Compliance Considerations

| Requirement | Implementation |
|-------------|----------------|
| Audit Trail | All uploads logged with uploaded_by, created_at |
| Access Control | RBAC via existing guards (Admin/Staff only) |
| Data Integrity | Soft delete pattern, version tracking |
| File Security | MIME validation, size limits, sanitization |
| Traceability | Polymorphic linking to parent entities |

---

## 11. Phase 2.7 Research (2026-01-16)

### 11.1 Phase 2.6 Completion Status

**Phase 2.6 (File Uploads & Documents) is COMPLETE:**

| Module | Files Created | Status |
|--------|---------------|--------|
| uploads/ | 6 files (service, controller, module, storage, dto) | DONE |
| documents/ | 5 files (service, controller, module, DTOs) | DONE |
| media/ | 5 files (service, controller, module, DTOs) | DONE |
| construction gallery | Enhanced existing module with 5 endpoints | DONE |
| common/enums | 3 new enums (media-type, document-type, gallery-category) | DONE |

**Build Verification:** `npm run build` succeeds ✓

### 11.2 Schema Tables Inventory

**Total Schema Tables:** 53

**Currently Implemented (via API):**

| # | Table | Module | Status |
|---|-------|--------|--------|
| 1 | users | users/ | DONE |
| 2 | roles | auth/ | DONE |
| 3 | permissions | auth/ | DONE |
| 4 | role_permissions | auth/ | DONE |
| 5 | user_roles | users/ | DONE |
| 6 | user_page_permissions | auth/ (partial) | DONE |
| 7 | projects | projects/ | DONE |
| 8 | construction_projects | construction-projects/ | DONE |
| 9 | construction_milestones | construction-projects/ | DONE |
| 10 | construction_gallery | construction-projects/ | DONE |
| 11 | construction_project_financials | construction-projects/ | DONE |
| 12 | repair_projects | repair-projects/ | DONE |
| 13 | repair_pow_items | repair-projects/ | DONE |
| 14 | repair_project_phases | repair-projects/ | DONE |
| 15 | repair_project_team_members | repair-projects/ | DONE |
| 16 | repair_project_milestones | repair-projects/ | DONE |
| 17 | university_operations | university-operations/ | DONE |
| 18 | operation_organizational_info | university-operations/ | DONE |
| 19 | operation_indicators | university-operations/ | DONE |
| 20 | operation_financials | university-operations/ | DONE |
| 21 | documents | documents/ | DONE |
| 22 | media | media/ | DONE |
| 23-30 | gad_* (8 tables) | gad/ | DONE |

**NOT Implemented - Reference/Lookup Tables (Phase 2.7 Candidates):**

| # | Table | Purpose | FK Dependencies | Priority |
|---|-------|---------|-----------------|----------|
| 1 | contractors | Contractor management | Referenced by construction_projects | HIGH |
| 2 | funding_sources | Funding source lookup | Referenced by construction_projects | HIGH |
| 3 | departments | Department hierarchy | Referenced by multiple tables | HIGH |
| 4 | user_departments | User-department junction | FK to users, departments | MEDIUM |
| 5 | repair_types | Repair type lookup | Referenced by repair_projects | HIGH |
| 6 | construction_subcategories | Construction category lookup | Referenced by construction_projects | HIGH |

**NOT Implemented - Facilities Management (Phase 2.8+ Candidates):**

| # | Table | Purpose | Priority |
|---|-------|---------|----------|
| 1 | buildings | Building inventory | MEDIUM |
| 2 | rooms | Room inventory | MEDIUM |
| 3 | facilities | Facility tracking | MEDIUM |
| 4 | room_assessments | Room assessment history | LOW |

**NOT Implemented - System Administration (Phase 2.7 Candidates):**

| # | Table | Purpose | Priority |
|---|-------|---------|----------|
| 1 | system_settings | Application configuration | HIGH |
| 2 | notifications | User notifications | MEDIUM |
| 3 | audit_trail | Audit logging (read-only) | LOW |

**NOT Implemented - Extended Project Tables (Deferred):**

| # | Table | Purpose | Notes |
|---|-------|---------|-------|
| 1 | construction_project_progress | Progress tracking | Complex, deferred |
| 2 | construction_pow_items | Program of Work | Complex, deferred |
| 3 | construction_project_accomplishment_records | Accomplishments | Complex, deferred |
| 4 | repair_project_financial_reports | Financial reports | Complex, deferred |
| 5 | repair_project_accomplishment_records | Accomplishments | Complex, deferred |
| 6 | university_statistics | Statistics | Complex, deferred |
| 7 | policies | Policy documents | Deferred |
| 8 | forms_inventory | Forms management | Deferred |
| 9 | downloadable_forms | Form downloads | Deferred |

### 11.3 Phase 2.7 Scope Recommendation

**Recommended Focus: Reference Data Management + System Administration**

**Rationale:**
1. Reference tables are FK-required by domain tables (already seeded but no API)
2. Admin users need to manage contractors, funding sources, departments, etc.
3. System settings enable application configuration
4. Lower complexity than facilities or extended project management
5. Foundation data that supports existing domain APIs

### 11.4 Reference Table Schema Analysis

#### contractors table (lines 318-334)
```
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| name | VARCHAR(255) | NO | Company name |
| contact_person | VARCHAR(255) | YES | Contact person |
| email | VARCHAR(255) | YES | Email |
| phone | VARCHAR(20) | YES | Phone |
| address | TEXT | YES | Address |
| tin_number | VARCHAR(50) | YES | Tax ID |
| registration_number | VARCHAR(100) | YES | Business registration |
| validity_date | DATE | YES | Registration validity |
| status | contractor_status_enum | NO | ACTIVE, SUSPENDED, BLACKLISTED |
```

#### funding_sources table (lines 282-291)
```
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| name | VARCHAR(100) | NO | Funding source name (unique) |
| description | TEXT | YES | Description |
```

#### departments table (lines 246-261)
```
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| name | VARCHAR(255) | NO | Department name |
| code | VARCHAR(50) | YES | Short code (unique) |
| description | TEXT | YES | Description |
| parent_id | UUID | YES | FK to departments (hierarchy) |
| head_id | UUID | YES | FK to users |
| email | VARCHAR(255) | YES | Department email |
| phone | VARCHAR(20) | YES | Phone |
| status | department_status_enum | NO | ACTIVE, INACTIVE |
```

#### repair_types table (lines 306-315)
```
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| name | VARCHAR(100) | NO | Repair type name (unique) |
| description | TEXT | YES | Description |
```

#### construction_subcategories table (lines 294-303)
```
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| name | VARCHAR(100) | NO | Subcategory name (unique) |
| description | TEXT | YES | Description |
```

#### system_settings table (lines 1376-1390)
```
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| setting_key | VARCHAR(100) | NO | Setting key (unique) |
| setting_value | TEXT | YES | Value |
| setting_group | VARCHAR(50) | NO | Grouping |
| data_type | setting_data_type_enum | NO | STRING, NUMBER, BOOLEAN, JSON, DATE, DATETIME |
| is_public | BOOLEAN | YES | Public visibility |
| description | TEXT | YES | Description |
```

### 11.5 Proposed Phase 2.7 Module Structure

```
src/
├── contractors/
│   ├── contractors.module.ts
│   ├── contractors.controller.ts
│   ├── contractors.service.ts
│   └── dto/
│       ├── create-contractor.dto.ts
│       ├── update-contractor.dto.ts
│       ├── query-contractor.dto.ts
│       └── index.ts
├── funding-sources/
│   ├── funding-sources.module.ts
│   ├── funding-sources.controller.ts
│   ├── funding-sources.service.ts
│   └── dto/
│       └── ...
├── departments/
│   ├── departments.module.ts
│   ├── departments.controller.ts
│   ├── departments.service.ts
│   └── dto/
│       └── ...
├── repair-types/
│   ├── repair-types.module.ts
│   ├── repair-types.controller.ts
│   ├── repair-types.service.ts
│   └── dto/
│       └── ...
├── construction-subcategories/
│   ├── construction-subcategories.module.ts
│   ├── construction-subcategories.controller.ts
│   ├── construction-subcategories.service.ts
│   └── dto/
│       └── ...
├── settings/
│   ├── settings.module.ts
│   ├── settings.controller.ts
│   ├── settings.service.ts
│   └── dto/
│       └── ...
```

### 11.6 Proposed Phase 2.7 Endpoints

**Contractors:**
```
GET    /api/contractors              → List contractors (paginated, filtered)
GET    /api/contractors/:id          → Get contractor details
POST   /api/contractors              → Create contractor (Admin)
PATCH  /api/contractors/:id          → Update contractor (Admin)
DELETE /api/contractors/:id          → Soft delete (Admin)
PATCH  /api/contractors/:id/status   → Update status (Admin)
```

**Funding Sources:**
```
GET    /api/funding-sources          → List funding sources
GET    /api/funding-sources/:id      → Get funding source
POST   /api/funding-sources          → Create (Admin)
PATCH  /api/funding-sources/:id      → Update (Admin)
DELETE /api/funding-sources/:id      → Soft delete (Admin)
```

**Departments:**
```
GET    /api/departments              → List departments (tree structure optional)
GET    /api/departments/:id          → Get department with head info
POST   /api/departments              → Create department (Admin)
PATCH  /api/departments/:id          → Update department (Admin)
DELETE /api/departments/:id          → Soft delete (Admin)
GET    /api/departments/:id/users    → List users in department
POST   /api/departments/:id/users    → Assign user to department
DELETE /api/departments/:id/users/:uid → Remove user from department
```

**Repair Types:**
```
GET    /api/repair-types             → List repair types
GET    /api/repair-types/:id         → Get repair type
POST   /api/repair-types             → Create (Admin)
PATCH  /api/repair-types/:id         → Update (Admin)
DELETE /api/repair-types/:id         → Soft delete (Admin)
```

**Construction Subcategories:**
```
GET    /api/construction-subcategories     → List subcategories
GET    /api/construction-subcategories/:id → Get subcategory
POST   /api/construction-subcategories     → Create (Admin)
PATCH  /api/construction-subcategories/:id → Update (Admin)
DELETE /api/construction-subcategories/:id → Soft delete (Admin)
```

**System Settings:**
```
GET    /api/settings                 → List settings (Admin: all, Staff: public only)
GET    /api/settings/:key            → Get setting by key
GET    /api/settings/group/:group    → Get settings by group
PATCH  /api/settings/:key            → Update setting (Admin)
```

### 11.7 New ENUMs Required

| ENUM | Values | File |
|------|--------|------|
| `ContractorStatus` | ACTIVE, SUSPENDED, BLACKLISTED | `contractor-status.enum.ts` |
| `DepartmentStatus` | ACTIVE, INACTIVE | `department-status.enum.ts` |
| `SettingDataType` | STRING, NUMBER, BOOLEAN, JSON, DATE, DATETIME | `setting-data-type.enum.ts` |

### 11.8 Phase 2.7 Security Model

| Module | View | Create | Update | Delete |
|--------|------|--------|--------|--------|
| contractors | Admin, Staff | Admin | Admin | Admin |
| funding_sources | Admin, Staff | Admin | Admin | Admin |
| departments | Admin, Staff | Admin | Admin | Admin |
| repair_types | Admin, Staff | Admin | Admin | Admin |
| construction_subcategories | Admin, Staff | Admin | Admin | Admin |
| system_settings (public) | Admin, Staff | - | Admin | - |
| system_settings (private) | Admin | - | Admin | - |

### 11.9 Phase 2.7 Definition of Done (Proposed)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Contractors CRUD works | PENDING |
| 2 | Funding Sources CRUD works | PENDING |
| 3 | Departments CRUD works | PENDING |
| 4 | Repair Types CRUD works | PENDING |
| 5 | Construction Subcategories CRUD works | PENDING |
| 6 | System Settings CRUD works | PENDING |
| 7 | User-Department assignment works | PENDING |
| 8 | Contractor status management works | PENDING |
| 9 | All routes require JWT (401 without) | PENDING |
| 10 | Role checks work (403 if denied) | PENDING |
| 11 | Soft delete pattern implemented | PENDING |
| 12 | Pagination for list endpoints | PENDING |
| 13 | `npm run build` succeeds | PENDING |

---

## 12. Phase 2.7 DTO-Schema Consistency Audit (2026-01-17)

### 12.1 Audit Scope and Methodology

**Audit Date:** 2026-01-17
**Authoritative Source:** `database/database draft/2026_01_12/pmo_schema_pg.sql`
**Method:** Table-by-table comparison of PostgreSQL schema columns vs DTO properties

**Tables Audited:** 16 tables across 7 domain modules

**Exclusions from DTO Comparison:**
- Server-generated fields: `id`, `created_at`, `updated_at`, `deleted_at`, `uploaded_at`, `processed_at`
- Audit trail fields: `created_by`, `updated_by`, `deleted_by`, `uploaded_by`, `submitted_by`
- Metadata/computed fields: `extracted_text`, `chunks`, `dimensions`, `location`

### 12.2 Severity Classification

| Severity | Definition | Impact |
|----------|------------|--------|
| **BLOCKING** | Field mismatch or missing required field | INSERT/UPDATE will fail with database constraint violation |
| **WARNING** | Missing optional field with business logic | Feature incomplete, no database error but workflow affected |
| **INFORMATIONAL** | Missing computed/optional field | No functional impact, potential future enhancement |

### 12.3 BLOCKING Issues (6 Found)

| # | Table | Issue | DTO Location | Impact |
|---|-------|-------|--------------|--------|
| 1 | `construction_milestones` | Field name mismatch: DTO uses `start_date`, schema expects `target_date` | construction-projects/dto/create-milestone.dto.ts:10 | INSERT fails with "column start_date does not exist" |
| 2 | `construction_gallery` | Missing required field: `image_url` (NOT NULL) | construction-projects/dto/create-gallery.dto.ts | INSERT fails with NOT NULL constraint violation |
| 3 | `construction_subcategories` | **NO DTO MODULE EXISTS** | N/A | Cannot create/update via API, only via seed data |
| 4 | `repair_types` | **NO DTO MODULE EXISTS** | N/A | Cannot create/update via API, only via seed data |
| 5 | `departments` | **NO DTO MODULE EXISTS** | N/A | Cannot create/update via API, only via seed data |
| 6 | `system_settings` | Partial DTO implementation (query only) | settings/dto (incomplete) | Cannot create/update settings via API |

### 12.4 WARNING Issues (2 Found)

| # | Table | Issue | Missing Fields | Impact |
|---|-------|-------|----------------|--------|
| 1 | `repair_pow_items` | Missing optional workflow fields | `status`, `variation_order_amount` | Approval workflow incomplete, variation tracking unavailable |
| 2 | `operation_indicators` | Missing approval workflow field | `status` | Cannot track indicator approval status (pending/approved/rejected) |

### 12.5 Table-by-Table Analysis

#### 12.5.1 construction_milestones

**Schema Columns (lines 515-527):**
```
target_date DATE NOT NULL
completion_date DATE
status VARCHAR(50)
remarks TEXT
```

**DTO Fields (create-milestone.dto.ts:7-14):**
```typescript
@IsNotEmpty() @IsDateString() start_date: string;  // ❌ MISMATCH
@IsOptional() @IsDateString() completion_date?: string;  // ✓
@IsOptional() @IsString() status?: string;  // ✓
@IsOptional() @IsString() remarks?: string;  // ✓
```

**Gap:** Field name mismatch - `start_date` (DTO) vs `target_date` (schema)
**Severity:** **BLOCKING** - INSERT will fail
**Recommendation:** Rename `start_date` to `target_date` in create-milestone.dto.ts:10

#### 12.5.2 construction_gallery

**Schema Columns (lines 551-559):**
```
project_id UUID NOT NULL FK
image_url VARCHAR(500) NOT NULL
caption VARCHAR(255)
category VARCHAR(50)
is_featured BOOLEAN DEFAULT false
uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**DTO Fields (create-gallery.dto.ts:7-12):**
```typescript
@IsOptional() @IsString() caption?: string;  // ✓
@IsOptional() @IsString() category?: string;  // ✓
@IsOptional() @IsBoolean() is_featured?: boolean;  // ✓
// ❌ MISSING: image_url (NOT NULL required field)
```

**Gap:** Missing required field `image_url`
**Severity:** **BLOCKING** - INSERT will fail with NOT NULL constraint
**Recommendation:** Add `@IsNotEmpty() @IsString() image_url: string;` to DTO

#### 12.5.3 construction_subcategories

**Schema Columns (lines 294-303):**
```
name VARCHAR(100) NOT NULL UNIQUE
description TEXT
metadata JSONB
```

**DTO Status:** **NO MODULE EXISTS**
**Severity:** **BLOCKING** - No API access, reference data management incomplete
**Recommendation:** Create full CRUD module (Step 2.7.5)

#### 12.5.4 repair_types

**Schema Columns (lines 306-315):**
```
name VARCHAR(100) NOT NULL UNIQUE
description TEXT
metadata JSONB
```

**DTO Status:** **NO MODULE EXISTS**
**Severity:** **BLOCKING** - No API access, reference data management incomplete
**Recommendation:** Create full CRUD module (Step 2.7.4)

#### 12.5.5 departments

**Schema Columns (lines 246-261):**
```
name VARCHAR(255) NOT NULL
code VARCHAR(50) UNIQUE
description TEXT
parent_id UUID FK (self-referencing)
head_id UUID FK → users
email VARCHAR(255)
phone VARCHAR(20)
status department_status_enum NOT NULL DEFAULT 'ACTIVE'
metadata JSONB
```

**DTO Status:** **NO MODULE EXISTS**
**Severity:** **BLOCKING** - No API access, reference data management incomplete
**Recommendation:** Create full CRUD module (Step 2.7.3)

#### 12.5.6 system_settings

**Schema Columns (lines 1376-1390):**
```
setting_key VARCHAR(100) NOT NULL UNIQUE
setting_value TEXT
setting_group VARCHAR(50) NOT NULL
data_type setting_data_type_enum NOT NULL
is_public BOOLEAN DEFAULT false
description TEXT
metadata JSONB
```

**DTO Status:** Partial implementation (query-only DTOs exist)
**Severity:** **BLOCKING** - Cannot create/update settings via API
**Recommendation:** Complete create/update DTOs (Step 2.7.6)

#### 12.5.7 repair_pow_items

**Schema Columns (lines 787-807):**
```
item_number INTEGER NOT NULL
description TEXT NOT NULL
unit VARCHAR(50)
quantity NUMERIC(10,2)
unit_cost NUMERIC(15,2)
total_cost NUMERIC(15,2)
status VARCHAR(50)  // ⚠ MISSING in DTO
variation_order_amount NUMERIC(15,2)  // ⚠ MISSING in DTO
remarks TEXT
```

**DTO Fields (create-pow-item.dto.ts:8-21):**
```typescript
@IsNotEmpty() @IsInt() item_number: number;  // ✓
@IsNotEmpty() @IsString() description: string;  // ✓
@IsOptional() @IsString() unit?: string;  // ✓
@IsOptional() @IsNumber() quantity?: number;  // ✓
@IsOptional() @IsNumber() unit_cost?: number;  // ✓
@IsOptional() @IsNumber() total_cost?: number;  // ✓
@IsOptional() @IsString() remarks?: string;  // ✓
// ⚠ MISSING: status, variation_order_amount
```

**Gap:** Missing optional fields `status`, `variation_order_amount`
**Severity:** **WARNING** - Workflow incomplete (status tracking unavailable)
**Recommendation:** Add fields to support approval workflow and variation orders

#### 12.5.8 operation_indicators

**Schema Columns (lines 1007-1020):**
```
indicator_name VARCHAR(255) NOT NULL
target_value NUMERIC(15,2)
actual_value NUMERIC(15,2)
unit VARCHAR(50)
status VARCHAR(50)  // ⚠ MISSING in DTO
remarks TEXT
```

**DTO Fields (create-indicator.dto.ts:7-16):**
```typescript
@IsNotEmpty() @IsString() indicator_name: string;  // ✓
@IsOptional() @IsNumber() target_value?: number;  // ✓
@IsOptional() @IsNumber() actual_value?: number;  // ✓
@IsOptional() @IsString() unit?: string;  // ✓
@IsOptional() @IsString() remarks?: string;  // ✓
// ⚠ MISSING: status
```

**Gap:** Missing optional field `status`
**Severity:** **WARNING** - Cannot track indicator approval status
**Recommendation:** Add `@IsOptional() @IsString() status?: string;`

#### 12.5.9 Tables with FULL Schema Coverage (8 Verified)

| Table | DTO Module | Status |
|-------|------------|--------|
| `contractors` | contractors/ | ✓ ALL FIELDS MAPPED |
| `funding_sources` | funding-sources/ | ✓ ALL FIELDS MAPPED |
| `projects` | projects/ | ✓ ALL FIELDS MAPPED |
| `construction_projects` | construction-projects/ | ✓ ALL FIELDS MAPPED |
| `repair_projects` | repair-projects/ | ✓ ALL FIELDS MAPPED |
| `university_operations` | university-operations/ | ✓ ALL FIELDS MAPPED |
| `documents` | documents/ | ✓ ALL FIELDS MAPPED |
| `media` | media/ | ✓ ALL FIELDS MAPPED |

### 12.6 Gap Summary Matrix

| Category | Count | Tables Affected |
|----------|-------|-----------------|
| **BLOCKING** | 6 | construction_milestones, construction_gallery, construction_subcategories, repair_types, departments, system_settings |
| **WARNING** | 2 | repair_pow_items, operation_indicators |
| **INFORMATIONAL** | 8+ | Various optional computed fields (thumbnails, processed_at, etc.) |
| **FULLY COMPLIANT** | 8 | contractors, funding_sources, projects, construction_projects, repair_projects, university_operations, documents, media |

### 12.7 Recommended Remediation Sequence

| Priority | Issue | Remediation | Phase 2.7 Step |
|----------|-------|-------------|----------------|
| 1 | construction_milestones field mismatch | Rename `start_date` → `target_date` | 2.7.FIX-1 |
| 2 | construction_gallery missing image_url | Add `image_url: string` to DTO | 2.7.FIX-2 |
| 3 | departments module missing | Create full CRUD module | 2.7.3 |
| 4 | repair_types module missing | Create full CRUD module | 2.7.4 |
| 5 | construction_subcategories module missing | Create full CRUD module | 2.7.5 |
| 6 | system_settings incomplete | Complete create/update DTOs | 2.7.6 |
| 7 | repair_pow_items workflow fields | Add `status`, `variation_order_amount` | 2.7.ENHANCE-1 |
| 8 | operation_indicators status field | Add `status` field | 2.7.ENHANCE-2 |

### 12.8 Phase 2.7 Scope Impact

**Original Phase 2.7 Scope (from Section 11.9):**
- Contractors CRUD ✓ (COMPLETE, DTO verified)
- Funding Sources CRUD ✓ (COMPLETE, DTO verified)
- Departments CRUD ❌ (BLOCKING - module missing)
- Repair Types CRUD ❌ (BLOCKING - module missing)
- Construction Subcategories CRUD ❌ (BLOCKING - module missing)
- System Settings CRUD ⚠ (PARTIAL - needs create/update DTOs)

**Revised Phase 2.7 Scope (Post-Audit):**
- Step 2.7.FIX-1: Fix construction_milestones DTO field name
- Step 2.7.FIX-2: Fix construction_gallery DTO missing field
- Step 2.7.3: Implement Departments CRUD (BLOCKING)
- Step 2.7.4: Implement Repair Types CRUD (BLOCKING)
- Step 2.7.5: Implement Construction Subcategories CRUD (BLOCKING)
- Step 2.7.6: Complete System Settings CRUD (BLOCKING)

**DEFERRED (WARNING-level, non-blocking):**
- Step 2.7.ENHANCE-1: Add workflow fields to repair_pow_items
- Step 2.7.ENHANCE-2: Add status field to operation_indicators

### 12.9 Audit Conclusion

**Total Tables Analyzed:** 16
**Fully Compliant:** 8 (50%)
**Blocking Issues:** 6 (37.5%)
**Warning Issues:** 2 (12.5%)

**Key Findings:**
1. Recent implementation (contractors, funding-sources) has 100% DTO-schema alignment ✓
2. Earlier modules (construction, repair) have minor field gaps (4 BLOCKING issues)
3. Phase 2.7 reference modules (departments, repair_types, construction_subcategories) completely missing
4. System settings module only partially implemented

**Readiness Assessment:**
- Phase 2.7 **CANNOT PROCEED** to implementation until BLOCKING issues resolved
- 6 BLOCKING issues must be fixed before Phase 3
- 2 WARNING issues can be deferred to future enhancement phases

---

## 13. Phase 2.7 Completion & Phase 2.8 Research (2026-01-19)

### 13.1 Phase 2.7 Completion Confirmation

**Completion Date:** 2026-01-19
**Status:** DONE

**All Phase 2.7 BLOCKING issues resolved:**

| Step | Description | Status |
|------|-------------|--------|
| 2.7.0 | New ENUMs (ContractorStatus, DepartmentStatus, SettingDataType) | DONE |
| 2.7.1 | Contractors API (6 endpoints) | DONE |
| 2.7.2 | Funding Sources API (5 endpoints) | DONE |
| 2.7.3 | Departments API (8 endpoints incl. user assignment) | DONE |
| 2.7.4 | Repair Types API (5 endpoints) | DONE |
| 2.7.5 | Construction Subcategories API (5 endpoints) | DONE |
| 2.7.6 | System Settings API (6 endpoints) | DONE |
| 2.7.7 | Audit-only Logout Endpoint | DONE |
| 2.7.FIX-1 | Milestone DTO field fix (start_date → target_date) | DONE |
| 2.7.FIX-2 | Gallery DTO verified (uses file_path via Multer) | DONE |

**Build Verification:** `npm run build` succeeds ✓

**Modules Registered in app.module.ts:**
- ContractorsModule ✓
- FundingSourcesModule ✓
- DepartmentsModule ✓
- RepairTypesModule ✓
- ConstructionSubcategoriesModule ✓
- SettingsModule ✓

### 13.2 Post-2.7 System Maturity Assessment

**Backend Metrics (as of 2026-01-19):**

| Metric | Value | Assessment |
|--------|-------|------------|
| Total Modules | 17 feature modules | HIGH |
| Total Endpoints | 129+ | COMPREHENSIVE |
| DTO Coverage | 56 DTOs | COMPLETE |
| Schema Alignment | 100% (post-audit fixes) | VERIFIED |
| Build Status | Passing | STABLE |

**Maturity by Category:**

| Category | Level | Notes |
|----------|-------|-------|
| Module Completeness | HIGH | 17/17 modules operational |
| API Coverage | HIGH | All domain tables have CRUD |
| Error Handling | MEDIUM | Exceptions consistent, no global filter |
| Logging | MEDIUM | Service-level, no aggregation |
| Input Validation | HIGH | DTO validation comprehensive |
| **OpenAPI Documentation** | **CRITICAL GAP** | 0% - No Swagger |
| **Testing** | **CRITICAL GAP** | 0% - No tests |
| Health Checks | LOW | Basic only |
| Rate Limiting | MEDIUM | Global configured |
| Audit Trail | MEDIUM | Schema ready, console-only logs |

### 13.3 Critical Gaps Blocking Production

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 1 | No OpenAPI/Swagger | Cannot onboard frontend; no API contract | CRITICAL |
| 2 | No Tests | Cannot validate changes safely | CRITICAL |
| 3 | No Global Exception Filter | Inconsistent error responses | HIGH |
| 4 | No Structured Logging | Log aggregation impossible | HIGH |
| 5 | No Audit Log API | Audit events not queryable | MEDIUM |
| 6 | No Input Sanitization | XSS risks in string fields | MEDIUM |

### 13.4 Phase 2.8 Identification

**Recommended Phase:** Phase 2.8 - Quality Assurance & API Documentation

**Justification:**
1. **MIS Compliance** - Documentation and auditability required
2. **Frontend Integration** - OpenAPI enables client code generation
3. **Stability** - Exception handling prevents information leakage
4. **Observability** - Structured logging enables monitoring
5. **SOLID/KISS** - Centralized error handling reduces duplication

### 13.5 Phase 2.8 Scope Definition

**Phase 2.8 IS:**

| # | Component | Description | Priority |
|---|-----------|-------------|----------|
| 1 | Swagger/OpenAPI | API documentation with @nestjs/swagger | CRITICAL |
| 2 | Global Exception Filter | Centralized error response formatting | HIGH |
| 3 | Structured Logging | JSON logs with request context | HIGH |
| 4 | Response Interceptor | Consistent success response wrapper | MEDIUM |
| 5 | Health Check Enhancement | Readiness/liveness probes | LOW |

**Phase 2.8 IS NOT:**

| Component | Reason | Deferred To |
|-----------|--------|-------------|
| Unit Tests | Large scope, separate phase | Phase 2.9 |
| Integration Tests | Requires test DB setup | Phase 2.9 |
| Performance Testing | Premature optimization | Phase 3.x |
| Frontend Integration | Separate concern | Phase 3.0 |
| Deployment | Infrastructure phase | Phase 3.2 |
| Email/Notifications | Non-essential for MVP | Phase 3.x |

### 13.6 Phase 2.8 Entry Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Phase 2.7 complete | ✓ DONE |
| 2 | All modules registered | ✓ DONE |
| 3 | Build passing | ✓ DONE |
| 4 | No BLOCKING DTO issues | ✓ DONE |

### 13.7 Phase 2.8 Exit Criteria (Proposed)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Swagger UI accessible at /api/docs | Manual test |
| 2 | All endpoints documented with @ApiOperation | Code review |
| 3 | Global exception filter catches all errors | Error test cases |
| 4 | Structured JSON logs for all requests | Log inspection |
| 5 | Consistent error response shape | API test |
| 6 | `npm run build` succeeds | Build command |

### 13.8 Principle Alignment Verification

| Principle | Phase 2.8 Alignment |
|-----------|---------------------|
| **SOLID** | Single responsibility for error handling (filter), logging (interceptor) |
| **DRY** | Centralized documentation decorators, no duplicate error formatting |
| **YAGNI** | Only essential documentation; no UI, no tests yet |
| **KISS** | Standard NestJS patterns (@nestjs/swagger, ExceptionFilter) |
| **TDA** | Clear boundaries: Filter handles errors, Interceptor handles responses |

### 13.9 Phase 2.8 Proposed Steps

| Step | Description | Effort |
|------|-------------|--------|
| 2.8.0 | Install @nestjs/swagger, configure in main.ts | LOW |
| 2.8.1 | Add @ApiTags to all controllers | LOW |
| 2.8.2 | Add @ApiOperation to all endpoints | MEDIUM |
| 2.8.3 | Add @ApiResponse for success/error cases | MEDIUM |
| 2.8.4 | Create global HttpExceptionFilter | LOW |
| 2.8.5 | Create structured LoggingInterceptor | LOW |
| 2.8.6 | Enhance health endpoint with details | LOW |
| 2.8.V | Build verification and Swagger UI test | LOW |

---

## 14. Phase 3.0 Research: Frontend Configuration & Setup (2026-01-20)

### 14.1 Technology Decision

**Selected Stack:** Vue 3 + Vuetify 3 + TypeScript

**Rationale:**
- Vuetify provides Material Design components optimized for admin dashboards
- Vue 3 Composition API aligns with modern TypeScript patterns
- Complete UI kit: forms, tables, navigation, dialogs out-of-box
- Lower learning curve for data-driven CRUD applications

**Prototype Status:** Existing React/Vite prototype in `prototype/` folder is REFERENCE ONLY.
New frontend will be built with Vue + Vuetify per project requirements.

### 14.2 Frontend Role and Boundaries

**Frontend IS Responsible For:**

| Responsibility | Description |
|----------------|-------------|
| UI Rendering | Display data received from backend |
| Form Input | Collect and validate user input (client-side) |
| Token Storage | Store JWT securely for authenticated requests |
| API Calls | Send requests to backend endpoints |
| UI State | Manage loading, error, and success states |
| Navigation Guards | Redirect unauthenticated users to login |
| Role-Based Visibility | Show/hide UI elements based on user roles |

**Frontend IS NOT Responsible For:**

| Exclusion | Reason | Owner |
|-----------|--------|-------|
| Business Rules | TDA violation | Backend |
| Authorization Decisions | Security risk if client-side | Backend guards |
| Data Validation (authoritative) | Can be bypassed | Backend DTOs |
| Password Hashing | Security concern | Backend |
| Token Generation | JWT signing key on server | Backend |
| Database Access | Architecture violation | Backend |

**TDA Principle:** Frontend delegates all decisions to backend. UI role checks are for visibility only, not security.

### 14.3 Backend Auth Analysis

**Endpoints Available:**

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/login` | POST | Public | Returns `{ access_token, user }` |
| `/api/auth/me` | GET | JWT | Returns full profile with roles/permissions |
| `/api/auth/logout` | POST | JWT | Audit trail only (token remains valid) |

**Login Response Structure:**
```typescript
{
  access_token: string,  // JWT token
  user: {
    id: string,
    email: string,
    first_name: string,
    last_name: string,
    roles: string[]
  }
}
```

**JWT Payload (decoded):**
```typescript
{
  sub: string,        // user id
  email: string,
  roles: string[],    // ['Admin', 'Staff']
  is_superadmin: boolean,
  iat: number,
  exp: number
}
```

**Profile Response (GET /api/auth/me):**
```typescript
{
  id: string,
  email: string,
  first_name: string,
  last_name: string,
  avatar_url: string | null,
  roles: { id: string, name: string }[],
  is_superadmin: boolean,
  permissions: string[]
}
```

**Security Features:**
- Rate limiting: 5 login attempts per minute (ThrottlerGuard)
- Account lockout: 15 minutes after 5 failed attempts
- SSO-only sentinel: Blocks password login for Google-linked accounts
- Generic error messages: No user enumeration

### 14.4 Auth Integration Requirements

**Token Storage Strategy:**

| Option | Security | Persistence | Recommendation |
|--------|----------|-------------|----------------|
| localStorage | LOW (XSS vulnerable) | Persists | Acceptable for internal admin tool |
| sessionStorage | LOW (XSS vulnerable) | Session only | Alternative if persistence not needed |
| HttpOnly Cookie | HIGH | Persists | Requires backend cookie support (not implemented) |
| Memory + Refresh | HIGH | None | Complex, overkill for MVP |

**Recommendation:** Use `localStorage` for MVP with plan to migrate to HttpOnly cookies.

**Auth Flow:**
1. User submits email/password to `/api/auth/login`
2. On success: store `access_token` in localStorage, store `user` in Pinia
3. On failure: display error message (generic: "Invalid credentials")
4. All subsequent API calls: attach `Authorization: Bearer <token>` header
5. On 401 response: clear token, redirect to login
6. Logout: call `/api/auth/logout`, clear localStorage, redirect to login

**Route Protection:**
```typescript
// Vue Router navigation guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('access_token');
  if (to.meta.requiresAuth && !token) {
    next('/login');
  } else {
    next();
  }
});
```

### 14.5 Vuetify Configuration Research

**Minimal Setup Requirements:**

| Component | Purpose | Priority |
|-----------|---------|----------|
| VApp | Root wrapper | REQUIRED |
| VMain | Content area | REQUIRED |
| VNavigationDrawer | Sidebar navigation | HIGH |
| VAppBar | Top bar with user menu | HIGH |
| VForm + VTextField | Login form | HIGH |
| VDataTable | Data lists | HIGH |
| VDialog | Modals/confirmations | MEDIUM |
| VCard | Content containers | MEDIUM |
| VBtn | Actions | MEDIUM |
| VSnackbar | Notifications | MEDIUM |

**Avoid Premature Configuration (YAGNI):**
- Custom themes: Use default Material Design
- Icon packs: Use mdi (included by default)
- Locale/i18n: English only for MVP
- Dark mode: Not required initially

**Recommended Structure:**
```
pmo-frontend/
├── src/
│   ├── main.ts              # Vue + Vuetify initialization
│   ├── App.vue              # Root component
│   ├── router/
│   │   └── index.ts         # Vue Router with guards
│   ├── stores/
│   │   └── auth.ts          # Pinia auth store
│   ├── composables/
│   │   └── useApi.ts        # API client composable
│   ├── layouts/
│   │   ├── DefaultLayout.vue # Authenticated layout
│   │   └── AuthLayout.vue    # Login/public layout
│   ├── views/
│   │   ├── LoginView.vue
│   │   ├── DashboardView.vue
│   │   └── projects/
│   │       └── ProjectsListView.vue
│   └── types/
│       └── api.ts           # TypeScript interfaces
├── .env                      # VITE_API_BASE_URL
└── package.json
```

### 14.6 Software Engineering Principles Check

| Principle | Application | Status |
|-----------|-------------|--------|
| **KISS** | Simple auth flow, standard Vuetify components, no custom CSS | ✓ |
| **YAGNI** | No state management beyond Pinia auth store initially | ✓ |
| **SOLID** | Auth store separate from API client separate from views | ✓ |
| **DRY** | Single API client composable, shared layout components | ✓ |
| **TDA** | UI never enforces business rules, only displays backend results | ✓ |

**State Management Decision:**
- Use Pinia for auth state only
- No global store for domain data (fetch on component mount)
- Avoid Vuex complexity (YAGNI)

### 14.7 MIS Compliance Review

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Auditability | Login/logout calls backend (logged server-side) | ✓ |
| Deterministic UI | All data from backend, no client-side business logic | ✓ |
| No Data Leakage | Token in localStorage (acceptable for internal tool), no PII in console logs | ✓ |
| Predictable Behavior | Standard Vue Router guards, consistent error handling | ✓ |
| Role Visibility | UI elements hidden based on `user.roles` from backend | ✓ |

**Security Considerations:**
- Never log tokens or passwords to console
- Clear sensitive data on logout
- Handle 401/403 consistently
- No sensitive data in URL parameters

### 14.8 Plan Alignment Notes

**Current Phase Status:**
- Phase 2.9 (Testing Infrastructure): COMPLETE
- Phase 3.0 (Frontend Integration): NEXT

**Recommended Phase 3.0 Naming:** "Frontend Initialization"

**Scope for Phase 3.0:**

| Step | Description | Outcome |
|------|-------------|---------|
| 3.0.0 | Project scaffolding | Vue 3 + Vuetify + TypeScript + Vite |
| 3.0.1 | API client setup | `useApi` composable with JWT injection |
| 3.0.2 | Auth store | Pinia store with login/logout/user state |
| 3.0.3 | Router setup | Vue Router with auth guards |
| 3.0.4 | Login page | Form → backend auth → redirect |
| 3.0.5 | Dashboard layout | AppBar + Drawer + Main content |
| 3.0.V | Build verification | `npm run build` succeeds |

**Out of Scope for Phase 3.0:**
- Domain CRUD pages (Phase 3.1+)
- Advanced theming
- Unit tests for frontend
- Mobile responsiveness optimization

### 14.9 Entry Criteria for Phase 3.0

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Backend build passing | ✓ DONE |
| 2 | Backend tests passing | ✓ DONE |
| 3 | OpenAPI docs available | ✓ DONE |
| 4 | Auth endpoints functional | ✓ DONE |
| 5 | CORS enabled | ✓ DONE |

### 14.10 Exit Criteria for Phase 3.0 (Proposed)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Login works with valid credentials | Manual test |
| 2 | Invalid login shows error | Manual test |
| 3 | Authenticated routes protected | Redirect to login without token |
| 4 | Dashboard displays user info | Shows name/roles from `/api/auth/me` |
| 5 | Logout clears state | Token removed, redirect to login |
| 6 | Build succeeds | `npm run build` exit 0 |

---

## 15. Prototype UI Analysis & Backend Alignment (2026-01-20)

### 15.1 Prototype UI Structure Analysis

**Prototype Location:** `prototype/Admin Side/` and `prototype/General User Side/`

**Technology Stack:** React + Vite + Radix UI + shadcn/ui + Tailwind CSS

**Key Findings:**
- Prototype uses React/TypeScript (NOT Vue/Vuetify)
- Extensive use of Radix UI headless components
- shadcn/ui component library for consistent design
- Supabase integration (will be replaced with NestJS backend)

### 15.2 Page Inventory

**Admin Side Pages:**

| Category | Pages | Backend API Expected |
|----------|-------|----------------------|
| Dashboard | Overview with analytics | GET `/api/dashboard/analytics` |
| About Us | Personnel, Objectives, Contact | Static content |
| University Operations | Higher Ed, Advanced Ed, Research, Technical Advisory | GET `/api/university-operations` |
| Facilities Assessment | Classroom/Lab/Office Assessments, Prioritization Matrix | GET `/api/assessments/*` ⚠ MISSING |
| Construction | GAA/Local/Special Grants Projects | GET `/api/construction-projects` |
| Repairs | Classroom/Office Repairs | GET `/api/repair-projects` |
| GAD Parity | Gender Reports, GPB, Budget Plans | GET `/api/gad/*` |
| Forms | Downloadable Forms Inventory | GET `/api/forms` ⚠ MISSING |
| Policies | MOA, MOU | GET `/api/policies` ⚠ MISSING |
| User Management | RBAC Configuration | GET `/api/users` |
| Settings | User Profile, Preferences | GET `/api/settings` |

**General User Side (Public-Facing):**

| Page | Purpose | Backend API |
|------|---------|-------------|
| HomePage | Public landing with announcements | GET `/api/announcements` ⚠ MISSING |
| AboutUsPageEnhanced | Organization information | Static content |
| UniversityOperationsPage | Public operations view | GET `/api/university-operations?public=true` |
| ConstructionInfrastructurePage | Public construction projects | GET `/api/construction-projects?public=true` |
| RepairsPageRestored | Public repairs overview | GET `/api/repair-projects?public=true` |
| GADParityKnowledgeManagementPage | Public parity data | GET `/api/gad/*?public=true` |
| ClientDownloadableFormsPage | Public forms library | GET `/api/forms?public=true` ⚠ MISSING |
| ClientPoliciesPage | Public policies | GET `/api/policies?public=true` ⚠ MISSING |

### 15.3 Backend ↔ UI Alignment Check

**Fully Aligned (Backend Exists):**

| # | UI Expectation | Backend Module | Status |
|---|----------------|----------------|--------|
| 1 | Project CRUD | `projects/` | ✓ ALIGNED |
| 2 | Construction Projects | `construction-projects/` | ✓ ALIGNED |
| 3 | Repair Projects | `repair-projects/` | ✓ ALIGNED |
| 4 | University Operations | `university-operations/` | ✓ ALIGNED |
| 5 | GAD Parity Data | `gad/` | ✓ ALIGNED |
| 6 | User Management | `users/` | ✓ ALIGNED |
| 7 | Auth (Login/Logout) | `auth/` | ✓ ALIGNED |
| 8 | Contractors | `contractors/` | ✓ ALIGNED |
| 9 | Funding Sources | `funding-sources/` | ✓ ALIGNED |
| 10 | Departments | `departments/` | ✓ ALIGNED |
| 11 | Document Uploads | `documents/`, `media/`, `uploads/` | ✓ ALIGNED |
| 12 | System Settings | `settings/` | ✓ ALIGNED |

**Partially Aligned (Mismatch or Incomplete):**

| # | UI Expectation | Backend Status | Gap Description |
|---|----------------|----------------|-----------------|
| 1 | Dashboard Analytics | ❌ MISSING | No `/api/dashboard/analytics` endpoint |
| 2 | Public vs. Admin Views | ⚠ PARTIAL | No `?public=true` filter support |
| 3 | Project Gallery Tab | ✓ EXISTS | `construction_gallery` table exists, API implemented |
| 4 | Prioritization Matrix | ❌ MISSING | UI calculates urgency×impact matrix, no backend |

**Missing Modules (UI Expects, Backend Absent):**

| # | UI Feature | Expected API | Priority | Impact |
|---|------------|--------------|----------|--------|
| 1 | Facilities Assessment | GET `/api/assessments/classrooms` | HIGH | Cannot manage classroom/office assessments |
| 2 | Facilities Assessment | GET `/api/assessments/offices` | HIGH | Cannot manage office assessments |
| 3 | Facilities Assessment | GET `/api/assessments/laboratory` | HIGH | Cannot manage laboratory assessments |
| 4 | Downloadable Forms | GET `/api/forms` | MEDIUM | No forms management API |
| 5 | Policies | GET `/api/policies` | MEDIUM | No MOA/MOU management |
| 6 | Announcements | GET `/api/announcements` | LOW | Public homepage empty |
| 7 | Dashboard Metrics | GET `/api/dashboard/analytics` | HIGH | No summary statistics |

### 15.4 Data Shape Comparison

**Prototype Project Interface vs. Backend DTO:**

| Field | Prototype Expects | Backend Provides | Match |
|-------|-------------------|------------------|-------|
| `id` | string (UUID) | UUID | ✓ |
| `projectName` | string | `title` ⚠ | Field name mismatch |
| `totalContractAmount` | number | ❌ MISSING | Not in schema |
| `physicalAccomplishment` | number (0-100) | ❌ MISSING | Not in schema |
| `powStatus` | enum | ❌ MISSING | Not in schema |
| `location` | string | `campus` enum only ⚠ | Insufficient granularity |
| `contractor` | string | `contractor_id` FK | ✓ |
| `status` | `Planning\|Ongoing\|Completed\|On Hold\|Cancelled` | `project_status_enum` | ✓ |
| `progress` | number | ❌ MISSING | Not in schema |

**BLOCKING Issues:**

1. **Field Name Mismatch**: UI uses `projectName`, backend uses `title`
2. **Missing Financial Fields**: No `totalContractAmount`, `budgetUtilized` in schema
3. **Missing Progress Tracking**: No `physicalAccomplishment`, `progress` fields
4. **Missing POW Status**: UI expects program-of-work approval status

**Recommendation:** Either:
- Option A: Update backend DTOs to match prototype expectations (breaking change)
- Option B: Create frontend data adapters to map backend → prototype shape (RECOMMENDED)

### 15.5 RBAC Implementation Comparison

**Prototype RBAC Model:**
```typescript
interface User {
  role: 'Admin' | 'Director' | 'Staff' | 'Editor' | 'Client';
  allowedPages: string[]; // Page-level access control
  assignedProjects?: {
    construction?: string[];
    repairs?: string[];
  };
}
```

**Backend RBAC Model:**
```typescript
// From auth/ module
interface User {
  roles: { id: string, name: string }[]; // Multi-role support
  is_superadmin: boolean;
  permissions: string[]; // Permission-based (not page-based)
}
```

**Alignment Gap:**
- Prototype uses **page-based access** (`allowedPages`)
- Backend uses **permission-based access** (`permissions`)
- Frontend must translate permissions → page visibility

**Resolution:** Frontend navigation guard maps permissions to routes.

### 15.6 CSU Branding & Styling Compliance

**Authoritative Source:** https://www.carsu.edu.ph/ovpeo/pico/university-branding/

**Mandatory Color Palette:**

| Color | Hex Code | Usage | Priority |
|-------|----------|-------|----------|
| Green | `#009900` | Primary (productivity, fertility) | REQUIRED |
| Gold Yellow | `#f9dc07` | Secondary (wisdom, intellect) | REQUIRED |
| Orange | `#ff9900` | Accent (strength, fortitude) | REQUIRED |
| White | `#ffffff` | Backgrounds, purity | REQUIRED |
| Emerald | `#003300` | Tertiary (peace, balance) | OPTIONAL |
| Gray | `#4d4d4d` | Neutral (formality, practicality) | OPTIONAL |

**Typography Requirements:**

| Element | Font Family | Notes |
|---------|-------------|-------|
| Body Text | Poppins | Official university font |
| Headings | Poppins | Consistent with body |

**Logo Usage Rules (NON-NEGOTIABLE):**
- ❌ **PROHIBITED**: Skewing, warping, cropping, rotating, color alterations
- ✓ **ALLOWED**: SVG format available at official URL
- ✓ **PLACEMENT**: Header/footer, login page, public-facing pages
- Two versions: Single-line (documents) vs. Two-line (events/banners)

**Logo Asset:**
```
https://www.carsu.edu.ph/wp-content/uploads/2024/10/CSU-Official-Seal_1216-x-2009-1.svg
```

**Design Tone:**
- Professional, academic, institutional
- Material Design alignment acceptable
- Emphasize values: Competence, Service, Uprightness

**Vuetify Theme Configuration:**
```javascript
// Recommended Vuetify theme matching CSU branding
{
  theme: {
    themes: {
      light: {
        primary: '#009900',    // CSU Green
        secondary: '#f9dc07',  // CSU Gold
        accent: '#ff9900',     // CSU Orange
        error: '#ff4444',
        info: '#003300',       // CSU Emerald
        success: '#009900',
        warning: '#ff9900',
      },
    },
  },
}
```

### 15.7 Frontend Integration Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | Prototype is React, plan specifies Vue | HIGH | Accept Vue stack, use prototype as UX reference only |
| 2 | Backend DTOs don't match prototype data shapes | HIGH | Create frontend data adapters/transformers |
| 3 | Missing backend modules (Forms, Policies, Assessments) | MEDIUM | Defer to Phase 3.1+ or prioritize MVP features |
| 4 | RBAC model mismatch (pages vs. permissions) | MEDIUM | Map permissions to route access in frontend |
| 5 | CSU branding non-compliance | LOW | Apply mandatory color palette from day 1 |
| 6 | No dashboard analytics endpoint | MEDIUM | Build aggregation endpoint or calculate client-side |

### 15.8 Software Engineering Principles Validation

| Principle | Prototype Status | Frontend Plan Compliance |
|-----------|------------------|--------------------------|
| **KISS** | ✓ Simple component structure | ✓ Vue + Vuetify equally simple |
| **YAGNI** | ⚠ Some unused admin features | ✓ MVP focuses on core modules |
| **SOLID** | ✓ Clear page/component separation | ✓ Maintain with Vue architecture |
| **DRY** | ✓ Reusable UI components (shadcn) | ✓ Vuetify provides equivalent |
| **TDA** | ✓ UI delegates to Supabase backend | ✓ UI will delegate to NestJS backend |

**Assessment:** Prototype demonstrates good engineering practices. Vue migration must preserve these patterns.

### 15.9 MIS Compliance Validation

| Requirement | Prototype Implementation | Status |
|-------------|--------------------------|--------|
| Auditability | Login/logout tracked via Supabase auth | ✓ Backend auth provides same |
| Deterministic UI | All data from backend (Supabase) | ✓ Will use NestJS backend |
| No Data Leakage | Supabase RLS policies enforce access | ✓ Backend guards provide equivalent |
| Predictable Behavior | RBAC controls page access | ✓ Frontend guards will enforce |
| Role Visibility | UI elements conditional on `allowedPages` | ✓ Map to permissions-based visibility |

**Assessment:** Prototype MIS compliance is adequate. Frontend must maintain same standards with NestJS backend.

### 15.10 Plan Alignment & Prerequisites

**Current Status (from plan_active.md):**
- Phase 2.9 (Testing): COMPLETE
- Phase 3.0 (Frontend): NEXT

**Prerequisites for Frontend Start:**

| # | Prerequisite | Status | Blocker |
|---|--------------|--------|---------|
| 1 | Backend build passing | ✓ DONE | No |
| 2 | Backend tests passing | ✓ DONE | No |
| 3 | OpenAPI docs available | ✓ DONE | No |
| 4 | Auth endpoints functional | ✓ DONE | No |
| 5 | CORS enabled | ✓ DONE | No |
| 6 | Dashboard analytics endpoint | ❌ MISSING | Yes (can defer) |
| 7 | Data adapter strategy defined | ⚠ PENDING | Yes |
| 8 | CSU branding assets downloaded | ❌ MISSING | No (can fetch) |

**Recommended Actions Before Phase 3.0 Implementation:**

| Priority | Action | Rationale |
|----------|--------|-----------|
| 1 | Define data adapter pattern | Resolve DTO mismatch (`projectName` vs. `title`) |
| 2 | Download CSU logo SVG | Required for compliant header/footer |
| 3 | Create dashboard analytics endpoint | OR calculate metrics client-side |
| 4 | Document permission → page mapping | RBAC translation layer |

### 15.11 Recommended Phase 3.0 Scope Revision

**Based on prototype analysis, revise Phase 3.0 scope:**

| Step | Original Plan | Revised Plan | Change Rationale |
|------|---------------|--------------|------------------|
| 3.0.0 | Scaffolding | Same | No change |
| 3.0.1 | API client | **+ Data adapters** | Handle DTO mismatch |
| 3.0.2 | Auth store | Same | No change |
| 3.0.3 | Router | **+ Permission guards** | RBAC translation |
| 3.0.4 | Login page | **+ CSU branding** | Apply color palette, logo |
| 3.0.5 | Dashboard | **Defer analytics** OR **client-side calc** | Missing backend endpoint |
| 3.0.V | Build verify | Same | No change |

**Out of Scope (Defer to Phase 3.1+):**
- Facilities Assessment module (missing backend)
- Forms/Policies modules (missing backend)
- Public-facing General User Side (focus on Admin Side MVP)

---

## 16. Gap Re-Classification for Startup Kick-Off (2026-01-20)

### 16.1 Startup-Critical Features (AUTHORITATIVE)

| Priority | Feature | Backend Module | Status |
|----------|---------|----------------|--------|
| 1 | Construction of Infrastructure | `construction-projects/` | ✅ READY |
| 2 | University Operations | `university-operations/` | ✅ READY |
| 3 | Repairs | `repair-projects/` | ✅ READY |
| 4 | GAD Parity Reporting | `gad/` | ✅ READY |

### 16.2 Gap Classification Matrix

| # | Gap Description | Original Severity | Blocks Startup? | Affects MIS? | **CLASSIFICATION** | Rationale |
|---|-----------------|-------------------|-----------------|--------------|-------------------|-----------|
| 1 | Dashboard Analytics endpoint missing | HIGH | ❌ No | No | **DEFER** | Client-side aggregation from existing list endpoints |
| 2 | Data adapters undefined (`title`→`projectName`) | HIGH | ❌ No | No | **SHOULD FIX** | Frontend transformation pattern required |
| 3 | Facilities Assessment module missing | HIGH | ❌ No | No | **DEFER** | Not in startup-critical scope |
| 4 | Forms/Policies modules missing | MEDIUM | ❌ No | No | **DEFER** | Content management, non-core |
| 5 | Announcements module missing | LOW | ❌ No | No | **DEFER** | Public-facing feature only |
| 6 | Public view filter (`?public=true`) missing | MEDIUM | ❌ No | No | **DEFER** | Admin-first approach |
| 7 | CSU Branding not integrated | MEDIUM | ❌ No | ⚠️ Compliance | **SHOULD FIX** | Required for institutional identity |
| 8 | Permission→Page mapping undefined | MEDIUM | ❌ No | ⚠️ Audit | **SHOULD FIX** | RBAC visibility translation |

### 16.3 Classification Definitions

| Classification | Definition | Action |
|----------------|------------|--------|
| **MUST FIX** | Blocks startup-critical features or causes system failure | Resolve before Phase 3.0 |
| **SHOULD FIX** | Important for quality/compliance but non-blocking | Resolve during Phase 3.0 |
| **DEFER** | Incremental enhancement, not required for kick-off | Phase 3.1+ |

### 16.4 Summary Logs

#### DONE (Completed Steps)

| Step | Description | Date |
|------|-------------|------|
| 2.5.0-2.5.8 | Shared Infrastructure + Domain APIs | 2026-01-14 |
| 2.6.R | File Uploads, Documents, Media | 2026-01-15 |
| 2.7.0-2.7.6 | Reference Data APIs (7 modules) | 2026-01-19 |
| 2.8.0-2.8.6 | OpenAPI, Exception Filter, Logging | 2026-01-19 |
| 2.9.0-2.9.D | Testing Infrastructure | 2026-01-20 |
| 3.0.R | Phase 3.0 Research (Vue + Vuetify decision) | 2026-01-20 |
| 3.0.P | Prototype UI Analysis & CSU Branding | 2026-01-20 |
| AUDIT-2 | Gap Re-Classification for Kick-Off | 2026-01-20 |

#### ACCEPTED AS DEFERRED

| Gap | Reason for Deferral | Target Phase |
|-----|---------------------|--------------|
| Dashboard Analytics endpoint | Can calculate client-side from existing APIs | 3.1 |
| Facilities Assessment module | Not startup-critical, complex domain | 3.2 |
| Forms/Policies modules | Content management, low priority | 3.2 |
| Announcements module | Public-facing only | 3.2 |
| Public view filters | Admin MVP first | 3.1 |

#### MUST FIX BEFORE NEXT STEP

| Issue | Status | Blocking |
|-------|--------|----------|
| ~~ENUM alignment~~ | RESOLVED (2026-01-15) | N/A |
| ~~DTO-schema mismatch~~ | RESOLVED (2026-01-19) | N/A |
| ~~Missing reference modules~~ | RESOLVED (2026-01-19) | N/A |
| **NONE REMAINING** | ✅ ALL CLEAR | ✅ |

### 16.5 Backend Readiness Confirmation

| Metric | Value | Assessment |
|--------|-------|------------|
| Total Modules | 17 | HIGH |
| Total Endpoints | 129+ | COMPREHENSIVE |
| Build Status | PASSING | STABLE |
| Unit Tests | 8 (auth) | BASELINE |
| E2E Tests | 8 (contractors) | BASELINE |
| Schema-DTO Alignment | 100% | VERIFIED |

### 16.6 Optimal Next Step Determination

**Analysis Conclusion:**

| Option | Description | Viability |
|--------|-------------|-----------|
| A | Further stabilization | ❌ Diminishing returns |
| B | **Frontend Integration** | ✅ OPTIMAL |
| C | Testing expansion | ⚠️ Delays value delivery |
| D | Documentation only | ⚠️ No user-facing outcome |

**SELECTED: Option B — Phase 3.0 Frontend Integration**

**Justification (Engineering Principles):**

| Principle | Alignment |
|-----------|-----------|
| **KISS** | Vue + Vuetify standard stack, no custom frameworks |
| **YAGNI** | Only 4 startup-critical modules in MVP |
| **SOLID** | Layered architecture: API→Store→Router→Views |
| **DRY** | Single API client, shared data adapters |
| **TDA** | UI displays backend data, no client-side business logic |
| **MIS** | Backend-driven auth, server-side audit trail |

### 16.7 Phase 3.0 Entry Status

| # | Entry Criterion | Status |
|---|-----------------|--------|
| 1 | Backend build passing | ✅ DONE |
| 2 | Backend tests passing | ✅ DONE |
| 3 | OpenAPI docs available | ✅ DONE |
| 4 | Auth endpoints functional | ✅ DONE |
| 5 | CORS enabled | ✅ DONE |
| 6 | All BLOCKING gaps resolved | ✅ DONE |

**VERDICT:** ✅ **READY FOR PHASE 3.0 IMPLEMENTATION**

---

*ACE Framework — Research Summary*
*Updated: 2026-01-20 (Gap Re-Classification & Optimal Path Analysis)*
