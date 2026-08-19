-- Migration 016b: Align pillar_type to operation_type_enum
-- Phase CY: Type alignment fix for migration 018 compatibility
-- Date: 2026-02-27
-- Reference: docs/References/phase_cy_migration_type_mismatch_research_2026-02-27.txt
-- Safe to re-run: YES (idempotent)
--
-- ROOT CAUSE:
-- Migration 016 defined pillar_type as VARCHAR(50) with CHECK constraint
-- But university_operations.operation_type uses operation_type_enum
-- This causes type mismatch error in migration 018:
--   ERROR: operator does not exist: operation_type_enum = character varying
--
-- SOLUTION:
-- Convert pillar_type from VARCHAR(50) to operation_type_enum
-- All existing values are valid enum members, so conversion is safe

-- ============================================================
-- STEP 1: Drop the CHECK constraint (redundant after enum conversion)
-- ============================================================
-- PostgreSQL auto-generates constraint name as: tablename_columnname_check

ALTER TABLE pillar_indicator_taxonomy
  DROP CONSTRAINT IF EXISTS pillar_indicator_taxonomy_pillar_type_check;

-- ============================================================
-- STEP 2: Convert VARCHAR(50) to operation_type_enum
-- ============================================================
-- USING clause performs explicit cast from text to enum
-- This is safe because all 4 values match exactly:
--   HIGHER_EDUCATION, ADVANCED_EDUCATION, RESEARCH, TECHNICAL_ADVISORY

DO $$
BEGIN
  -- Check if column is already operation_type_enum (idempotent)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pillar_indicator_taxonomy'
      AND column_name = 'pillar_type'
      AND udt_name = 'operation_type_enum'
  ) THEN
    RAISE NOTICE 'pillar_type is already operation_type_enum, skipping conversion';
  ELSE
    -- Perform the type conversion
    ALTER TABLE pillar_indicator_taxonomy
      ALTER COLUMN pillar_type TYPE operation_type_enum
      USING pillar_type::operation_type_enum;
    RAISE NOTICE 'Converted pillar_type from VARCHAR to operation_type_enum';
  END IF;
END $$;

-- ============================================================
-- STEP 3: Add documentation comment
-- ============================================================

COMMENT ON COLUMN pillar_indicator_taxonomy.pillar_type IS
'Phase CY: Changed from VARCHAR(50) to operation_type_enum for type consistency with university_operations.operation_type. Migration 016b applied 2026-02-27.';

-- ============================================================
-- VERIFICATION (run manually to confirm)
-- ============================================================
-- SELECT
--   column_name,
--   udt_name,
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'pillar_indicator_taxonomy'
--   AND column_name = 'pillar_type';
-- Expected: udt_name = 'operation_type_enum'

-- SELECT pillar_type, COUNT(*) FROM pillar_indicator_taxonomy GROUP BY pillar_type;
-- Expected: 4 rows, each showing enum value with count = 3
