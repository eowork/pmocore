-- Migration 028: Create quarterly_report_submissions — append-only submission history log
-- Phase GOV-D: Versioned archive traceability for quarterly report lifecycle events

CREATE TABLE IF NOT EXISTS quarterly_report_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarterly_report_id   UUID NOT NULL REFERENCES quarterly_reports(id),
  fiscal_year           INTEGER NOT NULL,
  quarter               VARCHAR(2) NOT NULL,
  version               INTEGER NOT NULL DEFAULT 1,
  event_type            VARCHAR(30) NOT NULL
    CHECK (event_type IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'REVERTED', 'UNLOCKED')),
  -- Submission metadata snapshot (captured at event time)
  submitted_by          UUID REFERENCES users(id),
  submitted_at          TIMESTAMPTZ,
  -- Review metadata snapshot (captured at event time)
  reviewed_by           UUID REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  review_notes          TEXT,
  -- Who triggered this event
  actioned_by           UUID NOT NULL REFERENCES users(id),
  actioned_at           TIMESTAMPTZ DEFAULT NOW(),
  reason                TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_submissions_report
  ON quarterly_report_submissions(quarterly_report_id);

CREATE INDEX IF NOT EXISTS idx_qr_submissions_fiscal
  ON quarterly_report_submissions(fiscal_year, quarter);

-- Add submission counter to quarterly_reports
ALTER TABLE quarterly_reports
  ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0;
