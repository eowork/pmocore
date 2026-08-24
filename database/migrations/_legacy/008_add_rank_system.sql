-- Migration: Add Rank-Based Permission System
-- Purpose: Enable hierarchical permission control to prevent privilege escalation
-- Date: 2026-02-12
-- ACE Reference: research.md Section 1.19

-- ============================================================
-- RANK HIERARCHY (Lower number = Higher authority)
-- ============================================================
-- 10  = SuperAdmin (Full system access)
-- 20  = Senior Admin (Cross-module admin)
-- 30  = Module Admin (Single module admin)
-- 50  = Senior Staff (Create/edit, manage junior staff)
-- 70  = Junior Staff (Create/edit own drafts only)
-- 100 = Viewer (Read-only, default)
-- ============================================================

-- ============================================================
-- STEP 1: Add rank_level column to users table
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS rank_level INTEGER DEFAULT 100;

-- Add index for performance on rank-based queries
CREATE INDEX IF NOT EXISTS idx_users_rank_level ON users(rank_level);

-- ============================================================
-- STEP 2: Set rank for existing SuperAdmins
-- ============================================================

UPDATE users u
SET rank_level = 10
FROM user_roles ur
WHERE u.id = ur.user_id
  AND ur.is_superadmin = TRUE
  AND u.rank_level = 100;  -- Only update if still at default

-- ============================================================
-- STEP 3: Set rank for existing Admins (non-SuperAdmin)
-- ============================================================

UPDATE users u
SET rank_level = 20
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE u.id = ur.user_id
  AND r.name = 'Admin'
  AND ur.is_superadmin = FALSE
  AND u.rank_level = 100;  -- Only update if still at default

-- ============================================================
-- STEP 4: Set rank for existing Staff
-- ============================================================

UPDATE users u
SET rank_level = 70
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE u.id = ur.user_id
  AND r.name = 'Staff'
  AND u.rank_level = 100;  -- Only update if still at default

-- ============================================================
-- STEP 5: Add constraint to ensure valid rank levels (idempotent)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_users_rank_level'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_rank_level
      CHECK (rank_level >= 10 AND rank_level <= 100);
  END IF;
END $$;

-- ============================================================
-- STEP 6: Add documentation
-- ============================================================

COMMENT ON COLUMN users.rank_level IS
  'User rank level for permission hierarchy. Lower = higher authority. 10=SuperAdmin, 20=SeniorAdmin, 30=ModuleAdmin, 50=SeniorStaff, 70=JuniorStaff, 100=Viewer';

-- ============================================================
-- STEP 7: Create helper function for rank validation
-- ============================================================

CREATE OR REPLACE FUNCTION can_modify_user(
  actor_id UUID,
  target_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  actor_rank INTEGER;
  target_rank INTEGER;
  actor_is_superadmin BOOLEAN;
BEGIN
  -- Get actor's rank and superadmin status
  SELECT u.rank_level, COALESCE(ur.is_superadmin, FALSE)
  INTO actor_rank, actor_is_superadmin
  FROM users u
  LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_superadmin = TRUE
  WHERE u.id = actor_id;

  -- SuperAdmin can modify anyone
  IF actor_is_superadmin THEN
    RETURN TRUE;
  END IF;

  -- Get target's rank
  SELECT rank_level INTO target_rank
  FROM users
  WHERE id = target_id;

  -- Actor can only modify users with higher rank_level number (lower authority)
  RETURN actor_rank < target_rank;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_modify_user(UUID, UUID) IS
  'Check if actor can modify target user based on rank hierarchy. Returns TRUE if actor has authority.';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Run these to verify migration success:
-- SELECT id, email, rank_level FROM users ORDER BY rank_level;
-- SELECT can_modify_user('actor-uuid', 'target-uuid');
