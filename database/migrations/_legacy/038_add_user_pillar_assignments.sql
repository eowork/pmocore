-- Migration 038: User Pillar Assignments for RBAC
-- Phase HN: Pillar-based tab access control (Directive 156)
-- Date: 2026-04-14
-- Safe to re-run: YES (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS user_pillar_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pillar_type VARCHAR(50) NOT NULL,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_pillar UNIQUE (user_id, pillar_type),
  CONSTRAINT chk_pillar_type CHECK (pillar_type IN (
    'HIGHER_EDUCATION', 'ADVANCED_EDUCATION', 'RESEARCH', 'TECHNICAL_ADVISORY'
  ))
);

COMMENT ON TABLE user_pillar_assignments IS 'Phase HN: Pillar-level access assignments for Physical/Financial modules';
