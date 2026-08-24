-- Migration: Add user_permission_overrides table
-- Purpose: Allow Admin to override default role permissions per user per module
-- Date: 2026-02-11

-- Create user_permission_overrides table
-- Note: Uses gen_random_uuid() from pgcrypto extension (project standard)
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key VARCHAR(50) NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id),

  -- Ensure one override per user per module
  CONSTRAINT uq_user_module UNIQUE (user_id, module_key)
);

-- Add indexes for performance
CREATE INDEX idx_user_permission_overrides_user_id ON user_permission_overrides(user_id);
CREATE INDEX idx_user_permission_overrides_module_key ON user_permission_overrides(module_key);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_permission_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_permission_overrides_updated_at
BEFORE UPDATE ON user_permission_overrides
FOR EACH ROW
EXECUTE FUNCTION update_user_permission_overrides_updated_at();

-- Add comments
COMMENT ON TABLE user_permission_overrides IS 'Stores per-user module access overrides (Admin can grant/revoke module access regardless of role defaults)';
COMMENT ON COLUMN user_permission_overrides.module_key IS 'Module identifier: coi, repairs, contractors, funding_sources, university_operations, users';
COMMENT ON COLUMN user_permission_overrides.can_access IS 'TRUE = grant access, FALSE = revoke access (overrides role default)';
