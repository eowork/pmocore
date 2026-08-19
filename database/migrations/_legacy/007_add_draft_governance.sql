-- Migration: Add Draft Governance Support
-- Purpose: Enable Staff to create drafts that require Admin approval for publishing
-- Date: 2026-02-12
-- ACE Reference: research.md Section 1.18

-- ============================================================
-- STEP 1: Create publication status enum
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publication_status_enum') THEN
    CREATE TYPE publication_status_enum AS ENUM (
      'DRAFT',           -- Created by Staff, awaiting review
      'PENDING_REVIEW',  -- Submitted for Admin review
      'PUBLISHED',       -- Approved, visible in reports
      'REJECTED'         -- Rejected by Admin, requires revision
    );
  END IF;
END $$;

-- ============================================================
-- STEP 2: Add draft governance columns to construction_projects
-- ============================================================

ALTER TABLE construction_projects
  ADD COLUMN IF NOT EXISTS publication_status publication_status_enum DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Index for filtering by publication status
CREATE INDEX IF NOT EXISTS idx_construction_projects_publication_status
  ON construction_projects(publication_status);

-- ============================================================
-- STEP 3: Add draft governance columns to repair_projects
-- ============================================================

ALTER TABLE repair_projects
  ADD COLUMN IF NOT EXISTS publication_status publication_status_enum DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Index for filtering by publication status
CREATE INDEX IF NOT EXISTS idx_repair_projects_publication_status
  ON repair_projects(publication_status);

-- ============================================================
-- STEP 4: Add draft governance columns to university_operations
-- ============================================================

ALTER TABLE university_operations
  ADD COLUMN IF NOT EXISTS publication_status publication_status_enum DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Index for filtering by publication status
CREATE INDEX IF NOT EXISTS idx_university_operations_publication_status
  ON university_operations(publication_status);

-- ============================================================
-- STEP 5: Add comments for documentation
-- ============================================================

COMMENT ON COLUMN construction_projects.publication_status IS
  'Publication workflow state: DRAFT (Staff-created), PENDING_REVIEW, PUBLISHED (Admin-approved), REJECTED';
COMMENT ON COLUMN construction_projects.submitted_by IS
  'User who submitted the record for review';
COMMENT ON COLUMN construction_projects.submitted_at IS
  'Timestamp when record was submitted for review';
COMMENT ON COLUMN construction_projects.reviewed_by IS
  'Admin who reviewed/published the record';
COMMENT ON COLUMN construction_projects.reviewed_at IS
  'Timestamp when record was reviewed';
COMMENT ON COLUMN construction_projects.review_notes IS
  'Notes from reviewer (especially for rejections)';

-- Same comments for repair_projects
COMMENT ON COLUMN repair_projects.publication_status IS
  'Publication workflow state: DRAFT (Staff-created), PENDING_REVIEW, PUBLISHED (Admin-approved), REJECTED';
COMMENT ON COLUMN repair_projects.submitted_by IS
  'User who submitted the record for review';
COMMENT ON COLUMN repair_projects.submitted_at IS
  'Timestamp when record was submitted for review';
COMMENT ON COLUMN repair_projects.reviewed_by IS
  'Admin who reviewed/published the record';
COMMENT ON COLUMN repair_projects.reviewed_at IS
  'Timestamp when record was reviewed';
COMMENT ON COLUMN repair_projects.review_notes IS
  'Notes from reviewer (especially for rejections)';

-- Same comments for university_operations
COMMENT ON COLUMN university_operations.publication_status IS
  'Publication workflow state: DRAFT (Staff-created), PENDING_REVIEW, PUBLISHED (Admin-approved), REJECTED';
COMMENT ON COLUMN university_operations.submitted_by IS
  'User who submitted the record for review';
COMMENT ON COLUMN university_operations.submitted_at IS
  'Timestamp when record was submitted for review';
COMMENT ON COLUMN university_operations.reviewed_by IS
  'Admin who reviewed/published the record';
COMMENT ON COLUMN university_operations.reviewed_at IS
  'Timestamp when record was reviewed';
COMMENT ON COLUMN university_operations.review_notes IS
  'Notes from reviewer (especially for rejections)';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Run these to verify migration success:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'construction_projects' AND column_name LIKE '%publication%';
