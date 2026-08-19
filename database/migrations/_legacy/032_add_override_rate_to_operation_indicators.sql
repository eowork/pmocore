-- Migration 032: Add override_rate column to operation_indicators
-- Phase FY-2: Optional user-controlled rate override for accomplishment_rate
-- When set, replaces computed accomplishment_rate in API response.
-- computed_rate is always recalculated from target/actual and returned separately.
-- Does NOT affect target/actual data or variance calculation.

ALTER TABLE operation_indicators
  ADD COLUMN IF NOT EXISTS override_rate DECIMAL(6,2) NULL;

COMMENT ON COLUMN operation_indicators.override_rate
  IS 'Optional user override for accomplishment rate (%). When set, replaces computed rate in display. Computed rate always recalculated from target/actual separately.';
