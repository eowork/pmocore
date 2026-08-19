-- Migration 017: Add Pillar Indicator FK to operation_indicators
-- Phase CT: Link operation_indicators to fixed taxonomy
-- Reference: docs/References/phase_1_research_pillar_architecture_2026-02-26.txt
-- Date: 2026-02-26
-- Safe to re-run: YES (all changes are idempotent)

-- ============================================================
-- STEP 1: Add pillar_indicator_id column (nullable during migration)
-- ============================================================

ALTER TABLE operation_indicators
  ADD COLUMN IF NOT EXISTS pillar_indicator_id UUID REFERENCES pillar_indicator_taxonomy(id);

-- ============================================================
-- STEP 2: Create index for FK lookups
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_oi_pillar_indicator
  ON operation_indicators(pillar_indicator_id);

-- ============================================================
-- STEP 3: Attempt to auto-map existing indicators to taxonomy
-- This maps free-text indicators to seeded taxonomy by name match
-- ============================================================

UPDATE operation_indicators oi
SET pillar_indicator_id = pit.id
FROM pillar_indicator_taxonomy pit
WHERE LOWER(TRIM(oi.particular)) = LOWER(TRIM(pit.indicator_name))
  AND oi.pillar_indicator_id IS NULL
  AND oi.deleted_at IS NULL;

-- ============================================================
-- STEP 4: Mark orphaned records (indicators not in taxonomy)
-- These need manual review before constraint enforcement
-- ============================================================

UPDATE operation_indicators
SET remarks = COALESCE(remarks || ' | ', '') || '[ORPHANED: No taxonomy match - requires manual mapping]'
WHERE pillar_indicator_id IS NULL
  AND deleted_at IS NULL
  AND remarks NOT LIKE '%ORPHANED%';

-- ============================================================
-- STEP 5: Report orphaned indicators (for review)
-- ============================================================

-- Run this to identify orphans:
-- SELECT id, particular, fiscal_year, operation_id, created_at
-- FROM operation_indicators
-- WHERE pillar_indicator_id IS NULL AND deleted_at IS NULL;

-- ============================================================
-- NOTE: NOT NULL constraint enforcement (MANUAL STEP)
-- ============================================================

-- After verifying all records are mapped (or orphans cleaned up):
-- ALTER TABLE operation_indicators
--   ALTER COLUMN pillar_indicator_id SET NOT NULL;

-- This is a MANUAL step to run after data cleanup.
-- Do NOT run automatically to prevent data loss.
