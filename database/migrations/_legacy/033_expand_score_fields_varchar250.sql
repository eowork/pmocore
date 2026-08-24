-- Migration 033: Expand operation_indicators score fields from VARCHAR(50) to VARCHAR(250)
-- Phase GX-3 (Directives 347, 348)
-- Date: 2026-04-10
--
-- Rationale:
--   score_q1..score_q4 were constrained to VARCHAR(50) at DB level, but neither
--   the DTO nor the frontend enforced that limit. This created an inconsistent
--   validation boundary. Expanding to VARCHAR(250) accommodates longer score
--   expressions (e.g. "Ave. Passing % of CSU = 83.18% (498/1,034)") and matches
--   the limits now enforced in the DTO and frontend.
--
-- Safety:
--   - Additive-only schema change: larger constraint is backward compatible
--   - No data migration required (max observed length = 31 chars)
--   - No indexes, foreign keys, or computed columns depend on these fields
--   - Reversible: ALTER back to VARCHAR(50) possible if all data ≤ 50 chars

ALTER TABLE operation_indicators
  ALTER COLUMN score_q1 TYPE character varying(250),
  ALTER COLUMN score_q2 TYPE character varying(250),
  ALTER COLUMN score_q3 TYPE character varying(250),
  ALTER COLUMN score_q4 TYPE character varying(250);

-- Verification query (run manually after migration):
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'operation_indicators'
--   AND column_name LIKE 'score_q%'
-- ORDER BY column_name;
