-- Migration 030: Fix quarterly_reports unique constraint for soft deletes
-- Phase FE-1: Replace absolute UNIQUE(fiscal_year, quarter) with partial unique index
-- that only enforces uniqueness on active (non-deleted) records.
--
-- Root cause: soft-deleted rows block INSERT for the same (fiscal_year, quarter)
-- because the original constraint includes all rows regardless of deleted_at.

-- Step 1: Drop the absolute unique constraint
ALTER TABLE quarterly_reports DROP CONSTRAINT IF EXISTS quarterly_reports_fiscal_year_quarter_key;

-- Step 2: Create partial unique index (PostgreSQL standard for soft-delete patterns)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quarterly_reports_unique_active
  ON quarterly_reports(fiscal_year, quarter)
  WHERE deleted_at IS NULL;
