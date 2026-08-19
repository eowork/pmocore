-- Migration 021: Add unique constraint for quarterly indicator data
-- Prevents duplicate indicators for same operation + pillar + fiscal year
-- Partial index excludes soft-deleted records
-- Phase DJ-C: Enforce quarterly data uniqueness at database level

-- Check for existing duplicates before creating constraint
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT operation_id, pillar_indicator_id, fiscal_year, COUNT(*)
    FROM operation_indicators
    WHERE deleted_at IS NULL
    GROUP BY operation_id, pillar_indicator_id, fiscal_year
    HAVING COUNT(*) > 1
  ) dups;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate quarterly indicator records. Review and resolve before applying constraint.', duplicate_count;
  END IF;
END $$;

-- Create partial unique index (excludes soft-deleted records)
CREATE UNIQUE INDEX IF NOT EXISTS uq_operation_indicators_quarterly
ON operation_indicators (operation_id, pillar_indicator_id, fiscal_year)
WHERE deleted_at IS NULL;

COMMENT ON INDEX uq_operation_indicators_quarterly IS
'Phase DJ-C: Ensures one indicator record per operation+pillar_indicator+fiscal_year (excluding soft-deleted)';
