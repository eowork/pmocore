-- ============================================================
-- PMO Dashboard - Migration: Add Username Column
-- Version: 2.5.0
-- Date: 2026-02-05
-- Authority: ACE_BOOTSTRAP v2.4 - Phase 3 Implementation
-- ============================================================
--
-- Purpose: Add proper username column for authentication
-- Rationale: Virtual username (string concatenation) is unacceptable
--            for government MIS due to:
--            - Performance issues at scale (O(n) vs O(log n))
--            - Edge case failures (special chars, duplicates, name changes)
--            - MIS compliance failures (audit trail ambiguity)
--
-- See: docs/research_auth_strategy_comparison.md for detailed analysis
-- ============================================================

BEGIN;

-- Step 1: Add username column (nullable initially for safe migration)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(100);

-- Step 2: Backfill existing users with sanitized firstname.lastname
-- Remove non-alphanumeric characters except dots, convert to lowercase
UPDATE users
SET username = LOWER(
  REGEXP_REPLACE(
    COALESCE(first_name, '') || '.' || COALESCE(last_name, ''),
    '[^a-z0-9.]',
    '',
    'gi'
  )
)
WHERE username IS NULL;

-- Step 3: Handle empty usernames (edge case: both names empty/null)
UPDATE users
SET username = 'user_' || SUBSTRING(id::text, 1, 8)
WHERE username IS NULL OR username = '' OR username = '.';

-- Step 4: Handle duplicate usernames by adding numeric suffix
-- This ensures uniqueness before adding constraint
DO $$
DECLARE
  dup_username VARCHAR(100);
  user_record RECORD;
  counter INTEGER;
BEGIN
  -- Find all duplicate usernames
  FOR dup_username IN
    SELECT username
    FROM users
    GROUP BY username
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    -- For each duplicate, update all but the first (oldest) record
    FOR user_record IN
      SELECT id, username
      FROM users
      WHERE username = dup_username
      ORDER BY created_at ASC
      OFFSET 1  -- Skip the first (keep original)
    LOOP
      UPDATE users
      SET username = user_record.username || '_' || counter
      WHERE id = user_record.id;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Step 5: Make username NOT NULL after backfill
ALTER TABLE users
  ALTER COLUMN username SET NOT NULL;

-- Step 6: Add unique constraint
ALTER TABLE users
  ADD CONSTRAINT users_username_unique UNIQUE (username);

-- Step 7: Create index for fast lookups (critical for login performance)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Step 8: Create case-insensitive index for LOWER() queries
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));

-- ============================================================
-- Verification Queries
-- ============================================================

-- Check migration success
SELECT
  COUNT(*) as total_users,
  COUNT(username) as users_with_username,
  COUNT(DISTINCT username) as unique_usernames,
  COUNT(*) - COUNT(DISTINCT username) as duplicates_remaining
FROM users;

-- Show sample usernames
SELECT id, email, first_name, last_name, username
FROM users
LIMIT 10;

COMMIT;

-- ============================================================
-- Rollback Script (if needed)
-- ============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_users_username_lower;
-- DROP INDEX IF EXISTS idx_users_username;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique;
-- ALTER TABLE users DROP COLUMN IF EXISTS username;
-- COMMIT;
-- ============================================================
