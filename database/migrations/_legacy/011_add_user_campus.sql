-- Migration: Add Campus Column to Users Table
-- Purpose: Enable office-scoped record visibility for Staff users
-- Date: 2026-02-18
-- ACE Reference: research.md Section 1.37.C, 1.39, plan.md Phase Y

-- ============================================================
-- STEP 1: Add campus column to users table (idempotent)
-- ============================================================

DO $$
BEGIN
  -- Check if column already exists before adding
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'campus'
  ) THEN
    ALTER TABLE users ADD COLUMN campus TEXT;
    RAISE NOTICE 'Column "campus" added to users table';
  ELSE
    RAISE NOTICE 'Column "campus" already exists on users table';
  END IF;
END $$;

-- ============================================================
-- STEP 2: Create index for filtering by campus (idempotent)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_campus ON users(campus);

-- ============================================================
-- STEP 3: Add documentation comment (only if column exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'campus'
  ) THEN
    COMMENT ON COLUMN users.campus IS
      'User office/campus assignment for record visibility scoping. Staff users see records matching their campus + own records. Admin/SuperAdmin bypass campus scoping.';
    RAISE NOTICE 'Comment added to users.campus column';
  END IF;
END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Run this to verify migration success:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name = 'campus';

-- To assign campus to users:
-- UPDATE users SET campus = 'Main Campus' WHERE id = '...';
