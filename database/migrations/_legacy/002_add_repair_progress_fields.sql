-- Migration: Add progress tracking fields to repair_projects
-- Date: 2026-01-29
-- Research: ACE-R9 (docs/research_summary.md Section 28)
-- Phase: 3.1.2 - Full Migration Support (Option C)

-- Purpose: Add physical_progress and financial_progress fields to repair_projects table
--          for consistency with construction_projects and enable progress tracking.
--          Also add FK constraint for referential integrity on deleted_by.

BEGIN;

-- Add progress fields to repair_projects (consistency with construction_projects)
ALTER TABLE repair_projects
  ADD COLUMN IF NOT EXISTS physical_progress DECIMAL(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS financial_progress DECIMAL(5,2) DEFAULT 0.00;

-- Add FK constraint for referential integrity
-- Note: Use IF NOT EXISTS equivalent by checking constraint existence first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deleted_by_user'
  ) THEN
    ALTER TABLE repair_projects
      ADD CONSTRAINT fk_deleted_by_user
      FOREIGN KEY (deleted_by) REFERENCES users(id);
  END IF;
END $$;

-- Verify migration
SELECT COUNT(*) as total_repairs,
       COUNT(CASE WHEN physical_progress = 0.00 THEN 1 END) as with_zero_physical,
       COUNT(CASE WHEN financial_progress = 0.00 THEN 1 END) as with_zero_financial
FROM repair_projects;

COMMIT;

-- Rollback script (if needed):
-- BEGIN;
-- ALTER TABLE repair_projects DROP COLUMN IF EXISTS physical_progress;
-- ALTER TABLE repair_projects DROP COLUMN IF EXISTS financial_progress;
-- ALTER TABLE repair_projects DROP CONSTRAINT IF EXISTS fk_deleted_by_user;
-- COMMIT;
