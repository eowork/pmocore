-- Migration: Add audit columns to contractors and funding_sources tables
-- Date: 2026-02-04
-- Research: ACE_BOOTSTRAP v2.4 (docs/research_summary.md)
-- Issue: Backend services expect created_by/updated_by columns that don't exist
-- Impact: CREATE and UPDATE operations fail with HTTP 500

BEGIN;

-- =============================================
-- 1. Add audit columns to contractors table
-- =============================================

ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Add foreign key constraints (optional, for referential integrity)
-- Note: Using REFERENCES users(id) without ON DELETE CASCADE
-- to preserve audit trail even if user is deleted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contractors_created_by'
  ) THEN
    ALTER TABLE contractors
      ADD CONSTRAINT fk_contractors_created_by
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contractors_updated_by'
  ) THEN
    ALTER TABLE contractors
      ADD CONSTRAINT fk_contractors_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id);
  END IF;
END $$;

-- =============================================
-- 2. Add audit columns to funding_sources table
-- =============================================

ALTER TABLE funding_sources
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_funding_sources_created_by'
  ) THEN
    ALTER TABLE funding_sources
      ADD CONSTRAINT fk_funding_sources_created_by
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_funding_sources_updated_by'
  ) THEN
    ALTER TABLE funding_sources
      ADD CONSTRAINT fk_funding_sources_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id);
  END IF;
END $$;

-- =============================================
-- 3. Verify migration
-- =============================================

SELECT
  'contractors' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'contractors'
  AND column_name IN ('created_by', 'updated_by')

UNION ALL

SELECT
  'funding_sources' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'funding_sources'
  AND column_name IN ('created_by', 'updated_by');

COMMIT;

-- =============================================
-- Rollback script (if needed):
-- =============================================
-- BEGIN;
-- ALTER TABLE contractors DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE contractors DROP COLUMN IF EXISTS updated_by;
-- ALTER TABLE funding_sources DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE funding_sources DROP COLUMN IF EXISTS updated_by;
-- COMMIT;
