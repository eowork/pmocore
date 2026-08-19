-- Migration 022: Add unique constraint for orphaned indicators
-- Prevents duplicate orphans where pillar_indicator_id IS NULL
-- Phase DK-C: Close migration 021 gap (NULL values bypass unique constraint)

-- ============================================================
-- STEP 1: Check for existing orphan duplicates
-- ============================================================

DO $$
DECLARE
  orphan_duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_duplicate_count
  FROM (
    SELECT operation_id, LOWER(TRIM(particular)), fiscal_year, COUNT(*)
    FROM operation_indicators
    WHERE deleted_at IS NULL AND pillar_indicator_id IS NULL
    GROUP BY operation_id, LOWER(TRIM(particular)), fiscal_year
    HAVING COUNT(*) > 1
  ) dups;

  IF orphan_duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate orphaned indicator records. Review and resolve before applying constraint.', orphan_duplicate_count;
    -- List duplicates for review
    RAISE NOTICE 'Run this query to identify duplicates:';
    RAISE NOTICE 'SELECT operation_id, LOWER(TRIM(particular)) AS name, fiscal_year, COUNT(*)';
    RAISE NOTICE 'FROM operation_indicators WHERE deleted_at IS NULL AND pillar_indicator_id IS NULL';
    RAISE NOTICE 'GROUP BY operation_id, LOWER(TRIM(particular)), fiscal_year HAVING COUNT(*) > 1;';
  ELSE
    RAISE NOTICE 'No orphan duplicates found. Safe to apply constraint.';
  END IF;
END $$;

-- ============================================================
-- STEP 2: Create partial unique index for orphaned indicators
-- Uses `particular` (indicator name) instead of pillar_indicator_id
-- Case-insensitive name matching to prevent near-duplicates
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_operation_indicators_orphan
ON operation_indicators (operation_id, LOWER(TRIM(particular)), fiscal_year)
WHERE deleted_at IS NULL AND pillar_indicator_id IS NULL;

COMMENT ON INDEX uq_operation_indicators_orphan IS
'Phase DK-C: Ensures one orphaned indicator per operation+particular+fiscal_year (case-insensitive name match)';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Run this to verify constraint exists:
-- SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'uq_operation_indicators_orphan';

-- Run this to test constraint:
-- INSERT INTO operation_indicators (operation_id, particular, fiscal_year, created_by)
-- SELECT operation_id, particular, fiscal_year, created_by
-- FROM operation_indicators WHERE pillar_indicator_id IS NULL AND deleted_at IS NULL LIMIT 1;
-- Expected: ERROR - duplicate key violates unique constraint

-- ============================================================
-- SUMMARY
-- ============================================================
-- Migration 021: uq_operation_indicators_quarterly
--   → Prevents duplicates for LINKED indicators (pillar_indicator_id NOT NULL)
--
-- Migration 022: uq_operation_indicators_orphan
--   → Prevents duplicates for ORPHANED indicators (pillar_indicator_id IS NULL)
--
-- Together they ensure NO duplicate indicators exist for any operation + fiscal year.
