-- Migration: Add actual_cost column to repair_projects
-- Date: 2026-02-04
-- Research: ACE_BOOTSTRAP v2.4 (docs/research_summary.md)
-- Phase: 3 - Repairs Module Integration Fix

-- Purpose: Add actual_cost column to repair_projects table
--          to align DTO contract with database schema.
--          Fixes HTTP 500 error on UPDATE operations.

BEGIN;

-- Add actual_cost column to repair_projects
ALTER TABLE repair_projects
  ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(15,2);

-- Verify migration
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'repair_projects' 
  AND column_name = 'actual_cost';

COMMIT;

-- Rollback script (if needed):
-- BEGIN;
-- ALTER TABLE repair_projects DROP COLUMN IF EXISTS actual_cost;
-- COMMIT;
