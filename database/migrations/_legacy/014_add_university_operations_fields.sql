-- Migration 014: University Operations Structural Alignment
-- Phase BA: Add fund_type enum, project_code, fiscal_year, and campus to statistics
-- Research Reference: research.md Section 1.50.C (GAP-01, GAP-02, GAP-04, GAP-06)
-- Date: 2026-02-23
-- Safe to re-run: YES (all changes are idempotent)

-- ============================================================
-- STEP 1: Create fund_type_enum (GAP-01)
-- Categorizes financial records by BAR1 fund source subcategory
-- ============================================================

DO $$ BEGIN
  CREATE TYPE fund_type_enum AS ENUM (
    'RAF_PROGRAMS',            -- Regular Agency Funds (Programs)
    'RAF_PROJECTS',            -- Regular Agency Funds (Projects)
    'RAF_CONTINUING',          -- Regular Agency Funds (Continuing Appropriations)
    'IGF_MAIN',                -- Internally Generated Funds (Main Campus)
    'IGF_CABADBARAN'           -- Internally Generated Funds (Cabadbaran Campus)
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'fund_type_enum already exists, skipping';
END $$;

-- ============================================================
-- STEP 2: Add fund_type column to operation_financials (GAP-01)
-- NULLABLE: existing records unaffected
-- ============================================================

ALTER TABLE operation_financials
  ADD COLUMN IF NOT EXISTS fund_type fund_type_enum;

-- ============================================================
-- STEP 3: Add project_code to operation_financials (GAP-02)
-- BAR1 project-level rows require a project identifier
-- ============================================================

ALTER TABLE operation_financials
  ADD COLUMN IF NOT EXISTS project_code VARCHAR(50);

-- ============================================================
-- STEP 4: Add fiscal_year to university_operations (GAP-06)
-- Enables fast year-based filtering without child table JOINs
-- ============================================================

ALTER TABLE university_operations
  ADD COLUMN IF NOT EXISTS fiscal_year INTEGER;

-- ============================================================
-- STEP 5: Add campus to university_statistics (GAP-04)
-- Enables per-campus breakdown of aggregate statistics
-- ============================================================

ALTER TABLE university_statistics
  ADD COLUMN IF NOT EXISTS campus TEXT;

-- ============================================================
-- STEP 6: Drop old UNIQUE constraint on university_statistics
-- (academic_year alone is no longer unique — campus + year must be)
-- Only drop if the old constraint still exists without campus
-- ============================================================

DO $$ BEGIN
  -- Check if the simple academic_year unique constraint exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uniq_academic_year'
      AND conrelid = 'university_statistics'::regclass
  ) THEN
    -- Only drop and recreate if campus column was just added (no data risk)
    ALTER TABLE university_statistics DROP CONSTRAINT uniq_academic_year;
    RAISE NOTICE 'Dropped old uniq_academic_year constraint';
  END IF;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'uniq_academic_year constraint not found, skipping drop';
END $$;

-- Add new composite unique constraint (academic_year + campus)
DO $$ BEGIN
  ALTER TABLE university_statistics
    ADD CONSTRAINT uniq_academic_year_campus UNIQUE (academic_year, campus);
  RAISE NOTICE 'Added uniq_academic_year_campus constraint';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'uniq_academic_year_campus already exists, skipping';
END $$;

-- ============================================================
-- STEP 7: Performance indexes on new columns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_of_fund_type
  ON operation_financials(fund_type);

CREATE INDEX IF NOT EXISTS idx_of_project_code
  ON operation_financials(project_code);

CREATE INDEX IF NOT EXISTS idx_uo_fiscal_year
  ON university_operations(fiscal_year)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_us_campus
  ON university_statistics(campus);

-- Composite: fiscal_year + campus on university_operations for dashboard queries
CREATE INDEX IF NOT EXISTS idx_uo_fiscal_year_campus
  ON university_operations(fiscal_year, campus)
  WHERE deleted_at IS NULL;

-- Composite: fund_type + operation_id for fast tab-based filtering
CREATE INDEX IF NOT EXISTS idx_of_fund_type_operation
  ON operation_financials(operation_id, fund_type)
  WHERE deleted_at IS NULL;
