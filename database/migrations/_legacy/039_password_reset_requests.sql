-- Migration 039: Password Reset Requests
-- Phase HQ: Admin-driven password reset workflow (Directive 175)
-- Date: 2026-04-15
-- Safe to re-run: YES (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_prr_status ON password_reset_requests(status);
