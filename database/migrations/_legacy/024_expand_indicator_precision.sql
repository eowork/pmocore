-- Migration 024: Expand Indicator Precision for Large COUNT/WEIGHTED_COUNT Values
-- Phase DU-A: Expand DECIMAL(10,4) to DECIMAL(12,4) for large-scale operations
-- Date: 2026-03-06
-- Note: Renumbered from 023 to 024 to avoid conflict with fiscal_years migration
-- Safe to re-run: YES (ALTER COLUMN TYPE is idempotent when target type matches)
--
-- Problem: DECIMAL(10,4) max 999999.9999 insufficient for:
--   - WEIGHTED_COUNT indicators (trainee × duration can exceed 1M)
--   - Large extension programs in multi-campus universities
--   - Aggregated quarterly totals in large institutions
--
-- Solution: DECIMAL(12,4) — max 99,999,999.9999 — supports:
--   - PERCENTAGE (0.0000 – 100.0000)
--   - COUNT (0 – 99,999,999)
--   - WEIGHTED_COUNT (0 – 99,999,999)
--   - Multi-campus aggregation
--   - Future growth scenarios
--
-- Example scenarios now supported:
--   - 20,000 trainees × 60 days = 1,200,000 weighted trainee-days
--   - Large institutional headcounts > 1 million
--   - Aggregated extension program metrics

-- Expand all quarterly target columns
ALTER TABLE operation_indicators
  ALTER COLUMN target_q1 TYPE DECIMAL(12,4),
  ALTER COLUMN target_q2 TYPE DECIMAL(12,4),
  ALTER COLUMN target_q3 TYPE DECIMAL(12,4),
  ALTER COLUMN target_q4 TYPE DECIMAL(12,4);

-- Expand all quarterly accomplishment columns
ALTER TABLE operation_indicators
  ALTER COLUMN accomplishment_q1 TYPE DECIMAL(12,4),
  ALTER COLUMN accomplishment_q2 TYPE DECIMAL(12,4),
  ALTER COLUMN accomplishment_q3 TYPE DECIMAL(12,4),
  ALTER COLUMN accomplishment_q4 TYPE DECIMAL(12,4);

-- Expand variance and average columns
ALTER TABLE operation_indicators
  ALTER COLUMN variance TYPE DECIMAL(12,4),
  ALTER COLUMN average_target TYPE DECIMAL(12,4),
  ALTER COLUMN average_accomplishment TYPE DECIMAL(12,4);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify column precision
-- SELECT column_name, data_type, numeric_precision, numeric_scale
-- FROM information_schema.columns
-- WHERE table_name = 'operation_indicators'
--   AND (column_name LIKE '%target%'
--        OR column_name LIKE '%accomplishment%'
--        OR column_name = 'variance')
-- ORDER BY column_name;

-- Expected output:
-- column_name          | data_type | numeric_precision | numeric_scale
-- ---------------------|-----------|-------------------|---------------
-- accomplishment_q1    | numeric   | 12                | 4
-- accomplishment_q2    | numeric   | 12                | 4
-- accomplishment_q3    | numeric   | 12                | 4
-- accomplishment_q4    | numeric   | 12                | 4
-- average_accomplishment | numeric | 12                | 4
-- average_target       | numeric   | 12                | 4
-- target_q1            | numeric   | 12                | 4
-- target_q2            | numeric   | 12                | 4
-- target_q3            | numeric   | 12                | 4
-- target_q4            | numeric   | 12                | 4
-- variance             | numeric   | 12                | 4

-- Test insert with large WEIGHTED_COUNT value
-- INSERT INTO operation_indicators (
--   id, operation_id, particular, fiscal_year, target_q1, created_by
-- ) VALUES (
--   gen_random_uuid(),
--   '{operation-uuid}',
--   'Test WEIGHTED_COUNT',
--   2026,
--   5000000.0000,
--   '{user-uuid}'
-- );
-- Expected: Success (no overflow error)
