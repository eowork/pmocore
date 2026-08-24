-- Migration 027: Add unlock request fields to quarterly_reports
-- Phase GOV-A: Governance workflow — post-publication unlock request and authorization

-- Unlock request fields (Staff → Admin request flow)
ALTER TABLE quarterly_reports
  ADD COLUMN IF NOT EXISTS unlock_requested_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS unlock_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unlock_request_reason TEXT;

-- Unlock authorization fields (Admin/SuperAdmin approval)
ALTER TABLE quarterly_reports
  ADD COLUMN IF NOT EXISTS unlocked_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;

-- Index for pending unlock requests (Admin review queue)
CREATE INDEX IF NOT EXISTS idx_quarterly_reports_unlock_requested
  ON quarterly_reports(unlock_requested_by)
  WHERE unlock_requested_by IS NOT NULL;
