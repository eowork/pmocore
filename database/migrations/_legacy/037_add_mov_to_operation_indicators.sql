-- Migration 037: Add MOV (Means of Verification) to operation_indicators
-- Phase HK: Verification evidence field for physical accomplishment reporting (Directive 139)
-- Date: 2026-04-14
-- Safe to re-run: YES (IF NOT EXISTS)

ALTER TABLE operation_indicators
  ADD COLUMN IF NOT EXISTS mov TEXT;

COMMENT ON COLUMN operation_indicators.mov IS 'Phase HK: Means of Verification — documentary or observable evidence supporting indicator accomplishment claims';
