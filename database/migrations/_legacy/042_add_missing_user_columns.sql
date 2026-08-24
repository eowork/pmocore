-- Migration 042: Add Missing Columns to users Table (Phase HU)
-- Purpose: Correct schema drift between User entity and DB. INSERT/UPDATE crashes
--          caused by entity properties referencing columns that do not exist.
-- Date: 2026-04-21
-- Safe to re-run: YES (IF NOT EXISTS guards)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

COMMENT ON COLUMN users.status IS 'Phase HU: user lifecycle status (ACTIVE, INACTIVE, SUSPENDED)';
COMMENT ON COLUMN users.updated_by IS 'Phase HU: audit — user id of last updater';
COMMENT ON COLUMN users.created_by IS 'Phase HU: audit — user id of creator';
