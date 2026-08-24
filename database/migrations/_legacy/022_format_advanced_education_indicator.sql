-- Migration 022: Format Advanced Education Indicator with Line Breaks
-- Phase DS-C: BAR1 compliant enumerated sub-items display
-- Date: 2026-03-06
-- Safe to re-run: YES (uses UPDATE with WHERE clause)
-- Note: This supersedes migration 021's indicator_name content

-- ============================================================
-- STEP 1: Update Advanced Education Outcome Indicator Text
-- Sub-items (a) through (d) formatted on separate lines
-- with "or" conjunctions for BAR1 compliance
-- ============================================================

UPDATE pillar_indicator_taxonomy
SET indicator_name = 'Percentage of graduate school faculty engaged in research work applied in any of the following:
(a) pursuing advanced research degree programs (Ph.D.); or
(b) actively pursuing within the last three (3) years (investigative research, basic and applied scientific research, policy research, social science research); or
(c) producing technologies for commercialization or livelihood improvement; or
(d) whose research work resulted in an innovation, community impact, or recognized research contribution',
    description = 'Measures graduate faculty research engagement across four categories: (a) Ph.D. program pursuit, (b) active research within 3 years, (c) technology commercialization, (d) recognized innovation/community impact. Calculated as: (Faculty meeting any criterion / Total graduate faculty) x 100'
WHERE pillar_type = 'ADVANCED_EDUCATION'
  AND indicator_type = 'OUTCOME'
  AND indicator_code = 'AE-OC-01';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check that newlines are preserved:
-- SELECT indicator_code,
--        indicator_name,
--        POSITION(E'\n' IN indicator_name) as first_newline_pos
-- FROM pillar_indicator_taxonomy
-- WHERE indicator_code = 'AE-OC-01';

-- Expected: first_newline_pos > 0 (indicates newline present)

-- Count lines in indicator text:
-- SELECT indicator_code,
--        LENGTH(indicator_name) - LENGTH(REPLACE(indicator_name, E'\n', '')) + 1 as line_count
-- FROM pillar_indicator_taxonomy
-- WHERE indicator_code = 'AE-OC-01';

-- Expected: line_count = 5 (1 header + 4 sub-items)
