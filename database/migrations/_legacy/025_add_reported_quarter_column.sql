-- Migration 025: Add reported_quarter discriminator for per-quarter snapshots
-- Phase DY — Quarterly Data Model Architectural Fix
-- Each quarterly submission is an independent record per (operation, indicator, FY, quarter)

-- Step 1: Add reported_quarter discriminator to operation_indicators
ALTER TABLE operation_indicators
  ADD COLUMN IF NOT EXISTS reported_quarter VARCHAR(2)
  CHECK (reported_quarter IN ('Q1','Q2','Q3','Q4'));

-- Step 2: Per-quarter submission status on university_operations
ALTER TABLE university_operations
  ADD COLUMN IF NOT EXISTS status_q1 VARCHAR(20) DEFAULT 'DRAFT'
    CHECK (status_q1 IN ('DRAFT','PENDING_REVIEW','PUBLISHED','REJECTED')),
  ADD COLUMN IF NOT EXISTS status_q2 VARCHAR(20) DEFAULT 'DRAFT'
    CHECK (status_q2 IN ('DRAFT','PENDING_REVIEW','PUBLISHED','REJECTED')),
  ADD COLUMN IF NOT EXISTS status_q3 VARCHAR(20) DEFAULT 'DRAFT'
    CHECK (status_q3 IN ('DRAFT','PENDING_REVIEW','PUBLISHED','REJECTED')),
  ADD COLUMN IF NOT EXISTS status_q4 VARCHAR(20) DEFAULT 'DRAFT'
    CHECK (status_q4 IN ('DRAFT','PENDING_REVIEW','PUBLISHED','REJECTED'));

-- Step 3: Per-quarter unique constraint (applies only to new records with reported_quarter set)
CREATE UNIQUE INDEX IF NOT EXISTS uq_oi_quarterly_per_quarter
ON operation_indicators (operation_id, pillar_indicator_id, fiscal_year, reported_quarter)
WHERE deleted_at IS NULL AND reported_quarter IS NOT NULL;

-- Step 4: Index for efficient quarter filtering
CREATE INDEX IF NOT EXISTS idx_oi_reported_quarter
ON operation_indicators (reported_quarter);
