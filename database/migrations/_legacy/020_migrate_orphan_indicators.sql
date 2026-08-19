-- Migration 020: Migrate Orphan Indicators to Fixed Taxonomy
-- Phase CX-F: Maps existing operation_indicators records to the pillar_indicator_taxonomy
--
-- Background:
-- - Legacy system allowed dynamic indicator creation
-- - New architecture requires indicators linked to fixed taxonomy via pillar_indicator_id
-- - Orphan indicators (pillar_indicator_id IS NULL) need mapping
--
-- IMPORTANT: This migration MUST run AFTER migrations 018 and 019
-- - 018 adds organizational_outcome column to taxonomy
-- - 019 seeds 14 authoritative BAR1 indicators
-- - 020 (this file) maps legacy indicators to new taxonomy
--
-- Date: 2026-02-27
-- Reference: docs/References/phase_cx_plan_section_1_55.md

-- Step 1: Identify orphan indicators (for reporting)
-- Run this SELECT first to see what will be affected
/*
SELECT
    i.id AS indicator_id,
    i.particular,
    i.uacs_code,
    i.pillar_indicator_id,
    o.id AS operation_id,
    o.operation_type,
    o.title AS operation_title
FROM operation_indicators i
JOIN university_operations o ON i.operation_id = o.id
WHERE i.pillar_indicator_id IS NULL
ORDER BY o.operation_type, i.particular;
*/

-- Step 2: Auto-map orphans by UACS code + operation_type match
-- This attempts to match indicators to taxonomy entries based on UACS code
UPDATE operation_indicators i
SET pillar_indicator_id = t.id
FROM university_operations o, pillar_indicator_taxonomy t
WHERE i.operation_id = o.id
  AND i.pillar_indicator_id IS NULL
  AND i.uacs_code = t.uacs_code
  AND o.operation_type = t.pillar_type;

-- Step 3: Auto-map by indicator name similarity (if UACS didn't match)
-- This catches indicators that have matching names but different/missing UACS codes
UPDATE operation_indicators i
SET pillar_indicator_id = t.id
FROM university_operations o, pillar_indicator_taxonomy t
WHERE i.operation_id = o.id
  AND i.pillar_indicator_id IS NULL
  AND o.operation_type = t.pillar_type
  AND (
    LOWER(TRIM(i.particular)) = LOWER(TRIM(t.indicator_name))
    OR LOWER(TRIM(i.particular)) LIKE LOWER(TRIM(t.indicator_name)) || '%'
    OR LOWER(TRIM(t.indicator_name)) LIKE LOWER(TRIM(i.particular)) || '%'
  );

-- Step 4: Report remaining orphans (manual intervention needed)
-- Any indicators still without pillar_indicator_id after steps 2 and 3
-- need manual review and mapping
/*
SELECT
    i.id AS indicator_id,
    i.particular,
    i.uacs_code,
    o.operation_type,
    o.title AS operation_title,
    'NEEDS_MANUAL_MAPPING' AS status
FROM operation_indicators i
JOIN university_operations o ON i.operation_id = o.id
WHERE i.pillar_indicator_id IS NULL
ORDER BY o.operation_type, i.particular;
*/

-- Step 5: Create index for efficient taxonomy lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_operation_indicators_pillar_indicator_id
ON operation_indicators(pillar_indicator_id);

-- Step 6: Add comment documenting the migration
COMMENT ON COLUMN operation_indicators.pillar_indicator_id IS
'Phase CX-F: Foreign key to pillar_indicator_taxonomy. All indicators must be linked to fixed taxonomy entries. Legacy orphan indicators have been migrated by migration 020.';
