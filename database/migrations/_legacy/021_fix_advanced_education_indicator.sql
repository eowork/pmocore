-- Migration 021: Correct Advanced Education Outcome Indicator Text
-- Phase DR-E: BAR1 compliant full indicator description with sub-items
-- Date: 2026-03-06
-- Safe to re-run: YES (uses UPDATE with WHERE clause)

-- ============================================================
-- STEP 1: Update Advanced Education Outcome Indicator Text
-- The indicator contains sub-items (a) through (d) that must be
-- included for BAR1 compliance
-- ============================================================

UPDATE pillar_indicator_taxonomy
SET indicator_name = 'Percentage of graduate school faculty engaged in research work applied in any of the following: (a) pursuing advanced research degree programs (Ph.D.); (b) actively pursuing within the last three (3) years (investigative research, basic and applied scientific research, policy research, social science research); (c) producing technologies for commercialization or livelihood improvement; (d) whose research work resulted in an innovation or recognized impact',
    description = 'Measures graduate faculty research engagement across four categories: (a) Ph.D. program pursuit, (b) active research within 3 years, (c) technology commercialization, (d) recognized innovation impact. Calculated as: (Faculty meeting any criterion / Total graduate faculty) x 100'
WHERE pillar_type = 'ADVANCED_EDUCATION'
  AND indicator_type = 'OUTCOME'
  AND indicator_code = 'AE-OC-01';

-- ============================================================
-- STEP 2: Correct Organizational Outcome Assignment
-- Advanced Education should be OO2, not OO1
-- ============================================================

UPDATE pillar_indicator_taxonomy
SET organizational_outcome = 'OO2'
WHERE pillar_type = 'ADVANCED_EDUCATION'
  AND is_active = true;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check Advanced Education outcome indicator:
-- SELECT indicator_code, LEFT(indicator_name, 100) as name_preview, organizational_outcome
-- FROM pillar_indicator_taxonomy
-- WHERE pillar_type = 'ADVANCED_EDUCATION' AND indicator_type = 'OUTCOME';

-- Expected result:
-- indicator_code: AE-OC-01
-- name_preview: Percentage of graduate school faculty engaged in research work applied in any of the following: (a) pursuing...
-- organizational_outcome: OO2

-- Verify all Advanced Education indicators have OO2:
-- SELECT indicator_code, organizational_outcome
-- FROM pillar_indicator_taxonomy
-- WHERE pillar_type = 'ADVANCED_EDUCATION' AND is_active = true;
