-- Migration 029: Add expense_class column to operation_financials
-- Phase ET-A: Required for BAR No. 2 financial reporting (PS/MOOE/CO categorization)
-- Research Reference: research.md Section 1.99, Finding ET-6
-- Date: 2026-03-17
-- Safe to re-run: YES (all changes are idempotent)

-- ============================================================
-- STEP 1: Add expense_class column
-- NULLABLE: existing records unaffected
-- CHECK constraint enforces valid values
-- ============================================================

ALTER TABLE operation_financials
  ADD COLUMN IF NOT EXISTS expense_class VARCHAR(4);

-- Add CHECK constraint (idempotent via exception handler)
DO $$ BEGIN
  ALTER TABLE operation_financials
    ADD CONSTRAINT chk_expense_class
    CHECK (expense_class IN ('PS', 'MOOE', 'CO'));
  RAISE NOTICE 'Added chk_expense_class constraint';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'chk_expense_class constraint already exists, skipping';
END $$;

-- ============================================================
-- STEP 2: Performance indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_of_expense_class
  ON operation_financials(expense_class);

-- Composite: operation_id + expense_class for pillar-level grouping
CREATE INDEX IF NOT EXISTS idx_of_operation_expense
  ON operation_financials(operation_id, expense_class)
  WHERE deleted_at IS NULL;
