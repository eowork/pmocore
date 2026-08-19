-- Migration 031: Enable per-quarter indicator records
-- Phase FL — Record-Level Quarter Isolation (Corrected Business Rule)
--
-- Problem: Migration 021 created uq_operation_indicators_quarterly on
-- (operation_id, pillar_indicator_id, fiscal_year) — allows only ONE record
-- per indicator per FY. This blocks per-quarter snapshot records.
--
-- Migration 025 added reported_quarter column and uq_oi_quarterly_per_quarter
-- on (operation_id, pillar_indicator_id, fiscal_year, reported_quarter) —
-- designed for per-quarter model but blocked by 021's constraint.
--
-- Fix: Drop 021's constraint. Backfill reported_quarter for existing records.

-- Step 1: Drop the constraint that blocks per-quarter records
DROP INDEX IF EXISTS uq_operation_indicators_quarterly;

-- Step 2: Backfill existing records — set reported_quarter where NULL
-- Default to 'Q1' for existing records. Operator may adjust if needed.
UPDATE operation_indicators
SET reported_quarter = 'Q1'
WHERE reported_quarter IS NULL AND deleted_at IS NULL;

-- Step 3: Verify uq_oi_quarterly_per_quarter (from migration 025) is still intact
-- This constraint enforces: one record per (operation_id, pillar_indicator_id, fiscal_year, reported_quarter)
-- No action needed — just a verification note.

COMMENT ON INDEX uq_oi_quarterly_per_quarter IS
'Phase FL: Per-quarter record isolation — one snapshot record per indicator per FY per quarter';
