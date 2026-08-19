-- Migration: Add Module Assignment System
-- Purpose: Enable module-scoped admin access control
-- Date: 2026-02-13
-- ACE Reference: research.md Section 1.23 (Module-Scoped Filtering)

-- ============================================================
-- MODULE TYPES
-- ============================================================
-- CONSTRUCTION: Construction/Infrastructure Projects (COI)
-- REPAIR: Repair Projects
-- OPERATIONS: University Operations
-- ALL: Full access to all modules (for SuperAdmin/Senior Admin)
-- ============================================================

-- ============================================================
-- STEP 1: Create module_type enum
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_type') THEN
    CREATE TYPE module_type AS ENUM ('CONSTRUCTION', 'REPAIR', 'OPERATIONS', 'ALL');
  END IF;
END $$;

-- ============================================================
-- STEP 2: Create user_module_assignments table
-- ============================================================

CREATE TABLE IF NOT EXISTS user_module_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module module_type NOT NULL,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate assignments
  -- NOTE: Constraint renamed from uq_user_module to avoid collision with migration 006
  CONSTRAINT uq_user_module_assignment UNIQUE (user_id, module)
);

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS idx_user_module_assignments_user_id
  ON user_module_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_assignments_module
  ON user_module_assignments(module);

-- ============================================================
-- STEP 3: Assign ALL modules to existing SuperAdmins
-- ============================================================

INSERT INTO user_module_assignments (user_id, module, assigned_by)
SELECT DISTINCT u.id, 'ALL'::module_type, u.id
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.is_superadmin = TRUE
  AND u.deleted_at IS NULL
ON CONFLICT (user_id, module) DO NOTHING;

-- ============================================================
-- STEP 4: Assign ALL modules to existing non-SuperAdmin Admins
-- (Default: full access, can be restricted later)
-- ============================================================

INSERT INTO user_module_assignments (user_id, module, assigned_by)
SELECT DISTINCT u.id, 'ALL'::module_type, u.id
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'Admin'
  AND ur.is_superadmin = FALSE
  AND u.deleted_at IS NULL
ON CONFLICT (user_id, module) DO NOTHING;

-- ============================================================
-- STEP 5: Create helper function for module access check
-- ============================================================

CREATE OR REPLACE FUNCTION user_has_module_access(
  p_user_id UUID,
  p_module module_type
) RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN;
BEGIN
  -- Check if user has explicit access to the module or ALL modules
  SELECT EXISTS (
    SELECT 1 FROM user_module_assignments
    WHERE user_id = p_user_id
      AND (module = p_module OR module = 'ALL')
  ) INTO has_access;

  RETURN has_access;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION user_has_module_access(UUID, module_type) IS
  'Check if user has access to the specified module. Returns TRUE if access granted.';

-- ============================================================
-- STEP 6: Add documentation
-- ============================================================

COMMENT ON TABLE user_module_assignments IS
  'Tracks which project modules each admin user can manage. Used for scoped pending review access.';

COMMENT ON COLUMN user_module_assignments.module IS
  'Module type: CONSTRUCTION (COI), REPAIR, OPERATIONS, or ALL (full access)';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Run these to verify migration success:
-- SELECT u.email, uma.module FROM users u JOIN user_module_assignments uma ON u.id = uma.user_id;
-- SELECT user_has_module_access('user-uuid', 'CONSTRUCTION');
