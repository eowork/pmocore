-- Migration 034: Add override_variance column to operation_indicators
-- Phase GZ (revised from GY): Annual-Only Override Model (Directive 362)
-- Date: 2026-04-10
--
-- Rationale:
--   The annual variance override complements the existing override_rate (migration 032).
--   Together they allow users to enter published BAR1 total values when they diverge
--   from system-computed results (due to agency-specific rounding, adjustments, etc.).
--
--   Per-quarter override columns (originally planned in GY) were removed from this
--   migration because quarterly T/A values are directly editable, making per-quarter
--   overrides redundant (KISS — Directive 358).
--
-- Design:
--   - override_variance: annual-level variance override (DECIMAL 8,2 = ±999999.99)
--   - Existing override_rate (annual, migration 032) is PRESERVED
--   - NULL means "use computed value"
--   - Analytics pipeline (getPillarSummary, getQuarterlyTrend) MUST NOT use this column
--
-- Safety:
--   - Additive-only: no existing columns modified or removed
--   - No data migration required
--   - No indexes, foreign keys, or computed columns affected

ALTER TABLE operation_indicators
  ADD COLUMN IF NOT EXISTS override_variance DECIMAL(8,2) NULL;

COMMENT ON COLUMN operation_indicators.override_variance
  IS 'Optional annual override for variance (actual - target). When set, replaces computed annual variance in display. Does not affect stored target/actual values.';

-- Verification query (run manually after migration):
-- SELECT column_name, data_type, numeric_precision, numeric_scale
-- FROM information_schema.columns
-- WHERE table_name = 'operation_indicators'
--   AND column_name LIKE 'override_%'
-- ORDER BY column_name;
