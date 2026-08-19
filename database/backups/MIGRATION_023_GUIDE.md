# Migration 023 Execution Guide

**Date:** 2026-03-06
**Phase:** DU (Numeric Overflow Fix)
**Purpose:** Expand DECIMAL(10,4) to DECIMAL(12,4) for large WEIGHTED_COUNT indicators

---

## Prerequisites

- PostgreSQL 11+ installed
- Database: `pmo_dashboard`
- User: `postgres`
- Password: `admin`
- Active database connection

---

## Step 1: Backup Database (REQUIRED)

### Method A: Using psql with backup script (Recommended)

1. Open Command Prompt or PowerShell
2. Navigate to project directory:
   ```cmd
   cd D:\Programming\pmo-dash
   ```

3. Connect to database and run backup script:
   ```cmd
   psql -U postgres -h localhost -d pmo_dashboard -f database/backups/backup_script.sql
   ```

4. Verify backup was created:
   ```cmd
   psql -U postgres -h localhost -d pmo_dashboard -c "SELECT COUNT(*) FROM operation_indicators_backup_023;"
   ```

### Method B: Using pgAdmin GUI

1. Open pgAdmin
2. Connect to localhost server
3. Right-click `pmo_dashboard` database
4. Select **Backup...**
5. Format: **Custom**
6. Filename: `D:\Programming\pmo-dash\database\backups\pmo_dashboard_backup_before_023.backup`
7. Click **Backup**

### Method C: Using pg_dump command line

Find your PostgreSQL installation (usually `C:\Program Files\PostgreSQL\[VERSION]\bin\`):

```cmd
set PGPASSWORD=admin
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -h localhost -d pmo_dashboard -F c -b -v -f database/backups/pmo_dashboard_backup_before_023.backup
```

---

## Step 2: Apply Migration 023

### Using psql (Recommended)

```cmd
cd D:\Programming\pmo-dash
psql -U postgres -h localhost -d pmo_dashboard -f database/migrations/023_expand_indicator_precision.sql
```

### Using pgAdmin Query Tool

1. Open pgAdmin
2. Connect to `pmo_dashboard`
3. Open Query Tool (Tools → Query Tool)
4. Load file: `database/migrations/023_expand_indicator_precision.sql`
5. Click **Execute** (F5)

---

## Step 3: Verify Migration Success

Run this verification query:

```sql
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'operation_indicators'
  AND (column_name LIKE '%target%'
       OR column_name LIKE '%accomplishment%'
       OR column_name = 'variance'
       OR column_name LIKE 'average_%')
ORDER BY column_name;
```

**Expected Output:**

| column_name              | data_type | numeric_precision | numeric_scale |
|--------------------------|-----------|-------------------|---------------|
| accomplishment_q1        | numeric   | 12                | 4             |
| accomplishment_q2        | numeric   | 12                | 4             |
| accomplishment_q3        | numeric   | 12                | 4             |
| accomplishment_q4        | numeric   | 12                | 4             |
| average_accomplishment   | numeric   | 12                | 4             |
| average_target           | numeric   | 12                | 4             |
| target_q1                | numeric   | 12                | 4             |
| target_q2                | numeric   | 12                | 4             |
| target_q3                | numeric   | 12                | 4             |
| target_q4                | numeric   | 12                | 4             |
| variance                 | numeric   | 12                | 4             |

All columns should show **numeric_precision = 12** and **numeric_scale = 4**.

---

## Step 4: Test Large Values

Test inserting a large WEIGHTED_COUNT value:

```sql
-- Find a test indicator
SELECT id, particular, fiscal_year, target_q1
FROM operation_indicators
WHERE pillar_indicator_id IN (
  SELECT id FROM pillar_indicator_taxonomy
  WHERE unit_type = 'WEIGHTED_COUNT'
)
LIMIT 1;

-- Update with large value (e.g., 5 million)
UPDATE operation_indicators
SET target_q1 = 5000000.0000
WHERE id = '{replace-with-actual-id}'
RETURNING id, target_q1;
```

**Expected Result:** Query succeeds, returns `target_q1 = 5000000.0000`

---

## Step 5: Restart Backend Server

```cmd
cd D:\Programming\pmo-dash\pmo-backend
npm run start:dev
```

Check for errors in console output. Server should start successfully.

---

## Step 6: Test API Validation

### Test 1: Valid large value (should succeed)

```bash
curl -X POST http://localhost:3000/api/university-operations/{operationId}/indicators/quarterly \
  -H "Authorization: Bearer {your-token}" \
  -H "Content-Type: application/json" \
  -d "{
    \"pillar_indicator_id\": \"{taxonomy-id}\",
    \"fiscal_year\": 2026,
    \"target_q1\": 5000000
  }"
```

**Expected:** 201 Created

### Test 2: Exceeds validation limit (should fail)

```bash
curl -X POST http://localhost:3000/api/university-operations/{operationId}/indicators/quarterly \
  -H "Authorization: Bearer {your-token}" \
  -H "Content-Type: application/json" \
  -d "{
    \"pillar_indicator_id\": \"{taxonomy-id}\",
    \"fiscal_year\": 2026,
    \"target_q1\": 100000000
  }"
```

**Expected:** 400 Bad Request with message:
```json
{
  "statusCode": 400,
  "message": ["target_q1 must not be greater than 99999999"],
  "error": "Bad Request"
}
```

### Test 3: Negative value (should fail)

```bash
curl -X POST http://localhost:3000/api/university-operations/{operationId}/indicators/quarterly \
  -H "Authorization: Bearer {your-token}" \
  -H "Content-Type: application/json" \
  -d "{
    \"pillar_indicator_id\": \"{taxonomy-id}\",
    \"fiscal_year\": 2026,
    \"target_q1\": -100
  }"
```

**Expected:** 400 Bad Request with message:
```json
{
  "statusCode": 400,
  "message": ["target_q1 must not be less than 0"],
  "error": "Bad Request"
}
```

---

## Rollback Procedure (If Migration Fails)

### Option 1: Restore from backup table

```sql
-- Connect to database
psql -U postgres -h localhost -d pmo_database

-- Restore from backup table
UPDATE operation_indicators
SET target_q1 = b.target_q1,
    target_q2 = b.target_q2,
    target_q3 = b.target_q3,
    target_q4 = b.target_q4,
    accomplishment_q1 = b.accomplishment_q1,
    accomplishment_q2 = b.accomplishment_q2,
    accomplishment_q3 = b.accomplishment_q3,
    accomplishment_q4 = b.accomplishment_q4
FROM operation_indicators_backup_023 b
WHERE operation_indicators.id = b.id;
```

### Option 2: Restore from pg_dump backup

```cmd
set PGPASSWORD=admin
"C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -U postgres -h localhost -d pmo_dashboard -c -v database/backups/pmo_dashboard_backup_before_023.backup
```

### Option 3: Rollback to DECIMAL(10,4)

```sql
-- Revert precision back to DECIMAL(10,4)
ALTER TABLE operation_indicators
  ALTER COLUMN target_q1 TYPE DECIMAL(10,4),
  ALTER COLUMN target_q2 TYPE DECIMAL(10,4),
  ALTER COLUMN target_q3 TYPE DECIMAL(10,4),
  ALTER COLUMN target_q4 TYPE DECIMAL(10,4),
  ALTER COLUMN accomplishment_q1 TYPE DECIMAL(10,4),
  ALTER COLUMN accomplishment_q2 TYPE DECIMAL(10,4),
  ALTER COLUMN accomplishment_q3 TYPE DECIMAL(10,4),
  ALTER COLUMN accomplishment_q4 TYPE DECIMAL(10,4),
  ALTER COLUMN variance TYPE DECIMAL(10,4),
  ALTER COLUMN average_target TYPE DECIMAL(10,4),
  ALTER COLUMN average_accomplishment TYPE DECIMAL(10,4);
```

---

## Troubleshooting

### Error: "psql: command not found"

**Solution:** Add PostgreSQL bin directory to PATH or use full path:
```cmd
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -d pmo_dashboard
```

### Error: "password authentication failed"

**Solution:** Check `.env` file for correct DATABASE_PASSWORD (currently: `admin`)

### Error: "database does not exist"

**Solution:** Verify database name in `.env` (should be: `pmo_dashboard`)

### Error: "numeric field overflow" (after migration)

**Solution:** This should NOT occur after migration. If it does:
1. Verify migration applied correctly (check numeric_precision = 12)
2. Check that backend restarted with latest code
3. Review logs for actual error message

---

## Success Criteria

✅ Backup created successfully
✅ Migration applied without errors
✅ All columns show numeric_precision = 12
✅ Large value test (5,000,000) succeeds
✅ Backend restarts without errors
✅ Validation correctly rejects values > 99,999,999
✅ Validation correctly rejects negative values
✅ UI can enter and save large WEIGHTED_COUNT values

---

## Files Modified by This Migration

- `operation_indicators.target_q1` → DECIMAL(12,4)
- `operation_indicators.target_q2` → DECIMAL(12,4)
- `operation_indicators.target_q3` → DECIMAL(12,4)
- `operation_indicators.target_q4` → DECIMAL(12,4)
- `operation_indicators.accomplishment_q1` → DECIMAL(12,4)
- `operation_indicators.accomplishment_q2` → DECIMAL(12,4)
- `operation_indicators.accomplishment_q3` → DECIMAL(12,4)
- `operation_indicators.accomplishment_q4` → DECIMAL(12,4)
- `operation_indicators.variance` → DECIMAL(12,4)
- `operation_indicators.average_target` → DECIMAL(12,4)
- `operation_indicators.average_accomplishment` → DECIMAL(12,4)

---

**Questions or Issues?** Check `docs/research_phase_du.md` for technical analysis.
