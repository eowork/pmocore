-- Migration 018: BAR1 Static Hierarchy Schema Enhancement
-- Phase DC-A: Authoritative indicator structure alignment
-- Reference: docs/plan.md Section 1.60
-- Date: 2026-02-27
-- Safe to re-run: YES (all changes are idempotent)

-- ============================================================
-- STEP 1: Add organizational_outcome column
-- Links indicators to their parent Organizational Outcome (OO1, OO2, OO3)
-- ============================================================

ALTER TABLE pillar_indicator_taxonomy
  ADD COLUMN IF NOT EXISTS organizational_outcome VARCHAR(10);

-- Add CHECK constraint for valid OO values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pillar_indicator_taxonomy_oo_check'
  ) THEN
    ALTER TABLE pillar_indicator_taxonomy
      ADD CONSTRAINT pillar_indicator_taxonomy_oo_check
        CHECK (organizational_outcome IN ('OO1', 'OO2', 'OO3'));
  END IF;
END $$;

-- ============================================================
-- STEP 2: Extend indicator_name for full BAR1 text
-- Some indicator names are very long (e.g., Advanced Ed research indicator)
-- ============================================================

ALTER TABLE pillar_indicator_taxonomy
  ALTER COLUMN indicator_name TYPE VARCHAR(500);

-- ============================================================
-- STEP 3: Make uacs_code nullable
-- Not all indicators have UACS codes assigned
-- ============================================================

ALTER TABLE pillar_indicator_taxonomy
  ALTER COLUMN uacs_code DROP NOT NULL;

-- ============================================================
-- STEP 4: Update unit_type CHECK constraint
-- Add WEIGHTED_COUNT for "trainees weighted by length of training"
-- ============================================================

-- Drop existing constraint
ALTER TABLE pillar_indicator_taxonomy
  DROP CONSTRAINT IF EXISTS pillar_indicator_taxonomy_unit_type_check;

-- Add updated constraint with WEIGHTED_COUNT
ALTER TABLE pillar_indicator_taxonomy
  ADD CONSTRAINT pillar_indicator_taxonomy_unit_type_check
    CHECK (unit_type IN ('PERCENTAGE', 'COUNT', 'WEIGHTED_COUNT', 'RATIO', 'SCORE'));

-- ============================================================
-- STEP 5: Create index for OO lookups
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pit_oo
  ON pillar_indicator_taxonomy(organizational_outcome);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Run these to verify migration success:
--
-- Check organizational_outcome column exists:
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'pillar_indicator_taxonomy' AND column_name = 'organizational_outcome';
--
-- Check indicator_name length:
-- SELECT character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'pillar_indicator_taxonomy' AND column_name = 'indicator_name';
-- Expected: 500
--
-- Check uacs_code is nullable:
-- SELECT is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'pillar_indicator_taxonomy' AND column_name = 'uacs_code';
-- Expected: YES
