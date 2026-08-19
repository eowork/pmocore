-- Migration: Add Record-Level Assignment Support
-- Purpose: Enable delegation via assigned_to FK on module tables
-- Date: 2026-02-18
-- ACE Reference: research.md Section 1.38, plan.md Phase AA

-- ============================================================
-- STEP 1: Add assigned_to column to construction_projects
-- ============================================================

ALTER TABLE construction_projects
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for filtering by assigned user
CREATE INDEX IF NOT EXISTS idx_construction_projects_assigned_to
  ON construction_projects(assigned_to);

-- ============================================================
-- STEP 2: Add assigned_to column to repair_projects
-- ============================================================

ALTER TABLE repair_projects
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for filtering by assigned user
CREATE INDEX IF NOT EXISTS idx_repair_projects_assigned_to
  ON repair_projects(assigned_to);

-- ============================================================
-- STEP 3: Add assigned_to column to university_operations
-- ============================================================

ALTER TABLE university_operations
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for filtering by assigned user
CREATE INDEX IF NOT EXISTS idx_university_operations_assigned_to
  ON university_operations(assigned_to);

-- ============================================================
-- STEP 4: Add comments for documentation
-- ============================================================

COMMENT ON COLUMN construction_projects.assigned_to IS
  'Delegated user who can view (non-PUBLISHED) and edit this record. ON DELETE SET NULL clears assignment if user deleted.';

COMMENT ON COLUMN repair_projects.assigned_to IS
  'Delegated user who can view (non-PUBLISHED) and edit this record. ON DELETE SET NULL clears assignment if user deleted.';

COMMENT ON COLUMN university_operations.assigned_to IS
  'Delegated user who can view (non-PUBLISHED) and edit this record. ON DELETE SET NULL clears assignment if user deleted.';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Run these to verify migration success:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'construction_projects' AND column_name = 'assigned_to';
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'repair_projects' AND column_name = 'assigned_to';
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'university_operations' AND column_name = 'assigned_to';
