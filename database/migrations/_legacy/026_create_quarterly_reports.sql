-- Migration 026: Create quarterly_reports table
-- Phase EM-A: University-wide quarterly submission entity
-- ONE record per (fiscal_year, quarter) — represents the entire quarterly report submission

CREATE TABLE IF NOT EXISTS quarterly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INTEGER NOT NULL,
  quarter VARCHAR(2) NOT NULL CHECK (quarter IN ('Q1','Q2','Q3','Q4')),
  title TEXT,
  publication_status VARCHAR(20) DEFAULT 'DRAFT'
    CHECK (publication_status IN ('DRAFT','PENDING_REVIEW','PUBLISHED','REJECTED')),
  submitted_by UUID REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(fiscal_year, quarter)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_quarterly_reports_fiscal_year ON quarterly_reports(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_quarterly_reports_publication_status ON quarterly_reports(publication_status);
CREATE INDEX IF NOT EXISTS idx_quarterly_reports_created_by ON quarterly_reports(created_by);
