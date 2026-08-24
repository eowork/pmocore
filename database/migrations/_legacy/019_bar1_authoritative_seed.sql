-- Migration 019: BAR1 Authoritative Indicator Seed
-- Phase DC-B: Replace fabricated indicators with exact BAR1 structure
-- Reference: docs/research.md Section 1.59, docs/plan.md Section 1.60
-- Date: 2026-02-27
-- Safe to re-run: YES (uses UPSERT with ON CONFLICT)

-- ============================================================
-- ORGANIZATIONAL OUTCOME DEFINITIONS
-- ============================================================
-- OO1: Relevant and quality tertiary education ensured to achieve
--      inclusive growth and access of poor but deserving students
--      to quality tertiary education increased
--      → Pillars: HIGHER_EDUCATION, ADVANCED_EDUCATION
--
-- OO2: Higher education research improved to promote economic
--      productivity and innovation
--      → Pillars: RESEARCH
--
-- OO3: Community engagement increased
--      → Pillars: TECHNICAL_ADVISORY
-- ============================================================

-- ============================================================
-- STEP 1: Soft-delete existing fabricated indicators
-- Preserves FK integrity while marking old data inactive
-- ============================================================

UPDATE pillar_indicator_taxonomy
SET is_active = false
WHERE indicator_code LIKE '%-OI-%'
  AND is_active = true;

-- ============================================================
-- STEP 2: HIGHER EDUCATION PROGRAM (OO1) - 4 indicators
-- 2 Outcome + 2 Output
-- ============================================================

INSERT INTO pillar_indicator_taxonomy
  (pillar_type, organizational_outcome, indicator_type, indicator_order,
   indicator_code, indicator_name, unit_type, description, is_active)
VALUES
  ('HIGHER_EDUCATION', 'OO1', 'OUTCOME', 1, 'HE-OC-01',
   'Percentage of first-time licensure exam takers that pass the licensure exams',
   'PERCENTAGE',
   'Measures the quality of graduates through board exam performance. Calculated as: (Number of first-time passers / Total first-time takers) × 100',
   true),

  ('HIGHER_EDUCATION', 'OO1', 'OUTCOME', 2, 'HE-OC-02',
   'Percentage of graduates (2 years prior) that are employed',
   'PERCENTAGE',
   'Measures graduate employability rate within 2 years of graduation. Calculated as: (Employed graduates / Total graduates 2 years prior) × 100',
   true),

  ('HIGHER_EDUCATION', 'OO1', 'OUTPUT', 3, 'HE-OP-01',
   'Percentage of undergraduate students enrolled in CHED-identified and RDC-identified priority programs',
   'PERCENTAGE',
   'Measures alignment with national and regional priority program enrollment. Calculated as: (Students in priority programs / Total undergraduate enrollment) × 100',
   true),

  ('HIGHER_EDUCATION', 'OO1', 'OUTPUT', 4, 'HE-OP-02',
   'Percentage of undergraduate programs with accreditation',
   'PERCENTAGE',
   'Measures program quality through accreditation status. Calculated as: (Accredited programs / Total undergraduate programs) × 100',
   true)

ON CONFLICT (pillar_type, indicator_name) DO UPDATE SET
  organizational_outcome = EXCLUDED.organizational_outcome,
  indicator_type = EXCLUDED.indicator_type,
  indicator_order = EXCLUDED.indicator_order,
  indicator_code = EXCLUDED.indicator_code,
  unit_type = EXCLUDED.unit_type,
  description = EXCLUDED.description,
  is_active = true;

-- ============================================================
-- STEP 3: ADVANCED EDUCATION PROGRAM (OO1) - 3 indicators
-- 1 Outcome + 2 Output
-- ============================================================

INSERT INTO pillar_indicator_taxonomy
  (pillar_type, organizational_outcome, indicator_type, indicator_order,
   indicator_code, indicator_name, unit_type, description, is_active)
VALUES
  ('ADVANCED_EDUCATION', 'OO1', 'OUTCOME', 1, 'AE-OC-01',
   'Percentage of graduate school faculty engaged in research work applied for actively pursuing within the last three (3) years (investigative research, basic and applied scientific research, policy research, social science research)',
   'PERCENTAGE',
   'Measures faculty research engagement in graduate programs. Includes investigative, basic/applied scientific, policy, and social science research conducted within the last 3 years.',
   true),

  ('ADVANCED_EDUCATION', 'OO1', 'OUTPUT', 2, 'AE-OP-01',
   'Percentage of graduate students enrolled in research degree programs',
   'PERCENTAGE',
   'Measures research-oriented enrollment in graduate programs. Calculated as: (Students in research programs / Total graduate enrollment) × 100',
   true),

  ('ADVANCED_EDUCATION', 'OO1', 'OUTPUT', 3, 'AE-OP-02',
   'Percentage of accredited graduate programs',
   'PERCENTAGE',
   'Measures graduate program quality through accreditation. Calculated as: (Accredited graduate programs / Total graduate programs) × 100',
   true)

ON CONFLICT (pillar_type, indicator_name) DO UPDATE SET
  organizational_outcome = EXCLUDED.organizational_outcome,
  indicator_type = EXCLUDED.indicator_type,
  indicator_order = EXCLUDED.indicator_order,
  indicator_code = EXCLUDED.indicator_code,
  unit_type = EXCLUDED.unit_type,
  description = EXCLUDED.description,
  is_active = true;

-- ============================================================
-- STEP 4: RESEARCH PROGRAM (OO2) - 3 indicators
-- 1 Outcome + 2 Output
-- ============================================================

INSERT INTO pillar_indicator_taxonomy
  (pillar_type, organizational_outcome, indicator_type, indicator_order,
   indicator_code, indicator_name, unit_type, description, is_active)
VALUES
  ('RESEARCH', 'OO2', 'OUTCOME', 1, 'RP-OC-01',
   'Number of research outputs in the last three years utilized by the industry or by other beneficiaries',
   'COUNT',
   'Measures research impact through industry/beneficiary utilization. Count of research outputs that have been adopted or utilized by external stakeholders within the last 3 years.',
   true),

  ('RESEARCH', 'OO2', 'OUTPUT', 2, 'RP-OP-01',
   'Number of research outputs completed within the year',
   'COUNT',
   'Measures annual research productivity. Total count of completed research projects, papers, or outputs finalized within the fiscal year.',
   true),

  ('RESEARCH', 'OO2', 'OUTPUT', 3, 'RP-OP-02',
   'Percentage of research outputs published in internationally-refereed or CHED-recognized journal within the year',
   'PERCENTAGE',
   'Measures research publication quality. Calculated as: (Published outputs in recognized journals / Total completed outputs) × 100',
   true)

ON CONFLICT (pillar_type, indicator_name) DO UPDATE SET
  organizational_outcome = EXCLUDED.organizational_outcome,
  indicator_type = EXCLUDED.indicator_type,
  indicator_order = EXCLUDED.indicator_order,
  indicator_code = EXCLUDED.indicator_code,
  unit_type = EXCLUDED.unit_type,
  description = EXCLUDED.description,
  is_active = true;

-- ============================================================
-- STEP 5: TECHNICAL ADVISORY & EXTENSION PROGRAM (OO3) - 4 indicators
-- 1 Outcome + 3 Output
-- ============================================================

INSERT INTO pillar_indicator_taxonomy
  (pillar_type, organizational_outcome, indicator_type, indicator_order,
   indicator_code, indicator_name, unit_type, description, is_active)
VALUES
  ('TECHNICAL_ADVISORY', 'OO3', 'OUTCOME', 1, 'TA-OC-01',
   'Number of active partnerships with LGUs, industries, NGOs, NGAs, SMEs, and other stakeholders as a result of extension activities',
   'COUNT',
   'Measures community engagement through active partnerships. Count of formalized partnerships (MOA/MOU) with local government units, industries, NGOs, national government agencies, SMEs, and other stakeholders.',
   true),

  ('TECHNICAL_ADVISORY', 'OO3', 'OUTPUT', 2, 'TA-OP-01',
   'Number of trainees weighted by the length of training',
   'WEIGHTED_COUNT',
   'Measures training reach with duration weighting factor. Calculated as: Sum of (Number of trainees × Training duration in days). Example: 50 trainees × 3 days = 150 weighted trainee-days.',
   true),

  ('TECHNICAL_ADVISORY', 'OO3', 'OUTPUT', 3, 'TA-OP-02',
   'Number of extension programs organized and supported consistent with the SUC''s mandated and priority programs',
   'COUNT',
   'Measures extension program delivery aligned with institutional mandate. Count of extension programs that align with the State University/College mandate and priority areas.',
   true),

  ('TECHNICAL_ADVISORY', 'OO3', 'OUTPUT', 4, 'TA-OP-03',
   'Percentage of beneficiaries who rate the training course/s as satisfactory or higher in terms of quality and relevance',
   'PERCENTAGE',
   'Measures training effectiveness through beneficiary satisfaction. Calculated as: (Beneficiaries rating satisfactory or higher / Total surveyed beneficiaries) × 100',
   true)

ON CONFLICT (pillar_type, indicator_name) DO UPDATE SET
  organizational_outcome = EXCLUDED.organizational_outcome,
  indicator_type = EXCLUDED.indicator_type,
  indicator_order = EXCLUDED.indicator_order,
  indicator_code = EXCLUDED.indicator_code,
  unit_type = EXCLUDED.unit_type,
  description = EXCLUDED.description,
  is_active = true;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Total active indicator count (expected: 14):
-- SELECT COUNT(*) FROM pillar_indicator_taxonomy WHERE is_active = true;

-- Breakdown by pillar (expected: HE:4, AE:3, RP:3, TA:4):
-- SELECT pillar_type, COUNT(*) as indicator_count
-- FROM pillar_indicator_taxonomy
-- WHERE is_active = true
-- GROUP BY pillar_type
-- ORDER BY pillar_type;

-- Breakdown by OO (expected: OO1:7, OO2:3, OO3:4):
-- SELECT organizational_outcome, COUNT(*) as indicator_count
-- FROM pillar_indicator_taxonomy
-- WHERE is_active = true
-- GROUP BY organizational_outcome
-- ORDER BY organizational_outcome;

-- Breakdown by indicator type (expected: OUTCOME:5, OUTPUT:9):
-- SELECT indicator_type, COUNT(*) as indicator_count
-- FROM pillar_indicator_taxonomy
-- WHERE is_active = true
-- GROUP BY indicator_type;

-- Full indicator listing:
-- SELECT pillar_type, organizational_outcome, indicator_type, indicator_order,
--        indicator_code, LEFT(indicator_name, 80) as indicator_name_short, unit_type
-- FROM pillar_indicator_taxonomy
-- WHERE is_active = true
-- ORDER BY organizational_outcome, pillar_type, indicator_order;
