-- ============================================================
-- PMO Dashboard — BAR1 Pillar-Indicator Taxonomy Seed
-- ============================================================
-- Authoritative 14-indicator BAR1 taxonomy, extracted from the live
-- dev database (active rows only) on 2026-06-22. This is the canonical
-- source for fresh Docker deployments — migration 019 is NOT usable
-- (it targets a dropped `organizational_outcome` column and omits the
-- now-required `uacs_code`). uacs_code is intentionally '' (empty) to
-- match the live data while satisfying the entity's NOT NULL constraint.
--
-- Idempotent: inserts only when no active taxonomy rows exist.
-- Safe to run against the running container:
--   docker compose exec -T postgres psql -U postgres -d pmo_dashboard < database/scripts/taxonomy_seed.sql
-- ============================================================

INSERT INTO pillar_indicator_taxonomy
  (pillar_type, indicator_name, indicator_code, uacs_code, indicator_order, indicator_type, unit_type, description, is_active)
SELECT v.* FROM (VALUES
  ('HIGHER_EDUCATION', 'Percentage of first-time licensure exam takers that pass the licensure exams', 'HE-OC-01', '', 1, 'OUTCOME', 'PERCENTAGE', 'Measures the quality of graduates through board exam performance. Calculated as: (Number of first-time passers / Total first-time takers) × 100', true),
  ('HIGHER_EDUCATION', 'Percentage of graduates (2 years prior) that are employed', 'HE-OC-02', '', 2, 'OUTCOME', 'PERCENTAGE', 'Measures graduate employability rate within 2 years of graduation. Calculated as: (Employed graduates / Total graduates 2 years prior) × 100', true),
  ('HIGHER_EDUCATION', 'Percentage of undergraduate students enrolled in CHED-identified and RDC-identified priority programs', 'HE-OP-01', '', 3, 'OUTPUT', 'PERCENTAGE', 'Measures alignment with national and regional priority program enrollment. Calculated as: (Students in priority programs / Total undergraduate enrollment) × 100', true),
  ('HIGHER_EDUCATION', 'Percentage of undergraduate programs with accreditation', 'HE-OP-02', '', 4, 'OUTPUT', 'PERCENTAGE', 'Measures program quality through accreditation status. Calculated as: (Accredited programs / Total undergraduate programs) × 100', true),
  ('ADVANCED_EDUCATION', 'Percentage of graduate school faculty engaged in research work applied in any of the following:
a. pursuing advanced research degree programs (Ph.D.) or
b. actively pursuing within the last three (3) years (investigative research, basic and applied scientific research, policy research, social science research) or
c. producing technologies for commercialization or livelihood improvement or
d. whose research work resulted in an extension program', 'AE-OC-01', '', 1, 'OUTCOME', 'PERCENTAGE', 'Measures faculty research engagement in graduate programs. Includes investigative, basic/applied scientific, policy, and social science research conducted within the last 3 years.', true),
  ('ADVANCED_EDUCATION', 'Percentage of graduate students enrolled in research degree programs', 'AE-OP-01', '', 2, 'OUTPUT', 'PERCENTAGE', 'Measures research-oriented enrollment in graduate programs. Calculated as: (Students in research programs / Total graduate enrollment) × 100', true),
  ('ADVANCED_EDUCATION', 'Percentage of accredited graduate programs', 'AE-OP-02', '', 3, 'OUTPUT', 'PERCENTAGE', 'Measures graduate program quality through accreditation. Calculated as: (Accredited graduate programs / Total graduate programs) × 100', true),
  ('RESEARCH', 'Number of research outputs in the last three years utilized by the industry or by other beneficiaries', 'RP-OC-01', '', 1, 'OUTCOME', 'COUNT', 'Measures research impact through industry/beneficiary utilization. Count of research outputs that have been adopted or utilized by external stakeholders within the last 3 years.', true),
  ('RESEARCH', 'Number of research outputs completed within the year', 'RP-OP-01', '', 2, 'OUTPUT', 'COUNT', 'Measures annual research productivity. Total count of completed research projects, papers, or outputs finalized within the fiscal year.', true),
  ('RESEARCH', 'Percentage of research outputs published in internationally-refereed or CHED-recognized journal within the year', 'RP-OP-02', '', 3, 'OUTPUT', 'PERCENTAGE', 'Measures research publication quality. Calculated as: (Published outputs in recognized journals / Total completed outputs) × 100', true),
  ('TECHNICAL_ADVISORY', 'Number of active partnerships with LGUs, industries, NGOs, NGAs, SMEs, and other stakeholders as a result of extension activities', 'TA-OC-01', '', 1, 'OUTCOME', 'COUNT', 'Measures community engagement through active partnerships. Count of formalized partnerships (MOA/MOU) with local government units, industries, NGOs, national government agencies, SMEs, and other stakeholders.', true),
  ('TECHNICAL_ADVISORY', 'Number of trainees weighted by the length of training', 'TA-OP-01', '', 2, 'OUTPUT', 'WEIGHTED_COUNT', 'Measures training reach with duration weighting factor. Calculated as: Sum of (Number of trainees × Training duration in days). Example: 50 trainees × 3 days = 150 weighted trainee-days.', true),
  ('TECHNICAL_ADVISORY', 'Number of extension programs organized and supported consistent with the SUC''s mandated and priority programs', 'TA-OP-02', '', 3, 'OUTPUT', 'COUNT', 'Measures extension program delivery aligned with institutional mandate. Count of extension programs that align with the State University/College mandate and priority areas.', true),
  ('TECHNICAL_ADVISORY', 'Percentage of beneficiaries who rate the training course/s as satisfactory or higher in terms of quality and relevance', 'TA-OP-03', '', 4, 'OUTPUT', 'PERCENTAGE', 'Measures training effectiveness through beneficiary satisfaction. Calculated as: (Beneficiaries rating satisfactory or higher / Total surveyed beneficiaries) × 100', true)
) AS v(pillar_type, indicator_name, indicator_code, uacs_code, indicator_order, indicator_type, unit_type, description, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM pillar_indicator_taxonomy WHERE is_active = true
);
