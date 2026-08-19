-- Migration 015: Fix operation_indicators Column Precision
-- Phase BB: Expand DECIMAL(5,2) to DECIMAL(10,4) for headcount and ratio support
-- Research Reference: research.md Section 1.50.C (GAP-03)
-- Date: 2026-02-23
-- Safe to re-run: YES (ALTER COLUMN TYPE is idempotent when target type matches)
--
-- Problem: DECIMAL(5,2) allows max 999.99
-- University Operations indicators include headcount values (e.g., 8450 students)
-- which overflow this type, causing INSERT/UPDATE failures for large counts.
--
-- Solution: DECIMAL(10,4) — max 999999.9999 — supports both:
--   - Percentages (0.0000 – 100.0000)
--   - Headcounts (0 – 999999)
--   - Ratios (e.g., 0.8750 = 87.50%)

-- Expand all quarterly target columns
ALTER TABLE operation_indicators
  ALTER COLUMN target_q1 TYPE DECIMAL(10,4),
  ALTER COLUMN target_q2 TYPE DECIMAL(10,4),
  ALTER COLUMN target_q3 TYPE DECIMAL(10,4),
  ALTER COLUMN target_q4 TYPE DECIMAL(10,4);

-- Expand all quarterly accomplishment columns
ALTER TABLE operation_indicators
  ALTER COLUMN accomplishment_q1 TYPE DECIMAL(10,4),
  ALTER COLUMN accomplishment_q2 TYPE DECIMAL(10,4),
  ALTER COLUMN accomplishment_q3 TYPE DECIMAL(10,4),
  ALTER COLUMN accomplishment_q4 TYPE DECIMAL(10,4);

-- Expand variance and average columns
ALTER TABLE operation_indicators
  ALTER COLUMN variance TYPE DECIMAL(10,4),
  ALTER COLUMN average_target TYPE DECIMAL(10,4),
  ALTER COLUMN average_accomplishment TYPE DECIMAL(10,4);
