-- Migration: 012_add_record_assignments_table.sql
-- Purpose: Create junction table for many-to-many record-to-user assignment
-- Phase: AT (ACE v2.4)
-- Date: 2026-02-20

-- ============================================================================
-- JUNCTION TABLE: record_assignments
-- Enables multiple users to be assigned to a single record
-- ============================================================================

CREATE TABLE IF NOT EXISTS record_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(50) NOT NULL CHECK (module IN ('CONSTRUCTION', 'REPAIR', 'OPERATIONS')),
  record_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(module, record_id, user_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_record_assignments_record ON record_assignments(module, record_id);
CREATE INDEX IF NOT EXISTS idx_record_assignments_user ON record_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_record_assignments_assigned_at ON record_assignments(assigned_at DESC);

-- ============================================================================
-- DATA MIGRATION: Copy existing single assignments to junction table
-- Preserves backward compatibility with existing assigned_to column data
-- ============================================================================

-- Migrate Construction Projects assignments
INSERT INTO record_assignments (module, record_id, user_id)
SELECT 'CONSTRUCTION', id, assigned_to
FROM construction_projects
WHERE assigned_to IS NOT NULL
  AND deleted_at IS NULL
ON CONFLICT (module, record_id, user_id) DO NOTHING;

-- Migrate Repair Projects assignments
INSERT INTO record_assignments (module, record_id, user_id)
SELECT 'REPAIR', id, assigned_to
FROM repair_projects
WHERE assigned_to IS NOT NULL
  AND deleted_at IS NULL
ON CONFLICT (module, record_id, user_id) DO NOTHING;

-- Migrate University Operations assignments
INSERT INTO record_assignments (module, record_id, user_id)
SELECT 'OPERATIONS', id, assigned_to
FROM university_operations
WHERE assigned_to IS NOT NULL
  AND deleted_at IS NULL
ON CONFLICT (module, record_id, user_id) DO NOTHING;

-- ============================================================================
-- NOTE: Original assigned_to columns are RETAINED for backward compatibility
-- They will be deprecated in a future migration after full transition
-- ============================================================================
