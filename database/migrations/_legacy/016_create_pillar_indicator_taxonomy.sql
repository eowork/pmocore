-- Migration 016: Create Pillar Indicator Taxonomy Table
-- Phase CT: BAR1-compliant fixed indicator taxonomy enforcement
-- Reference: docs/References/phase_1_research_pillar_architecture_2026-02-26.txt
-- Date: 2026-02-26
-- Safe to re-run: YES (all changes are idempotent)

-- ============================================================
-- STEP 1: Create pillar_indicator_taxonomy table
-- Fixed taxonomy for government-aligned BAR1 reporting
-- ============================================================

CREATE TABLE IF NOT EXISTS pillar_indicator_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_type VARCHAR(50) NOT NULL CHECK (
    pillar_type IN ('HIGHER_EDUCATION', 'ADVANCED_EDUCATION', 'RESEARCH', 'TECHNICAL_ADVISORY')
  ),
  indicator_name VARCHAR(255) NOT NULL,
  indicator_code VARCHAR(50),
  uacs_code VARCHAR(50) NOT NULL,
  indicator_order INTEGER NOT NULL,
  indicator_type VARCHAR(20) NOT NULL CHECK (indicator_type IN ('OUTCOME', 'OUTPUT')),
  unit_type VARCHAR(20) NOT NULL CHECK (unit_type IN ('PERCENTAGE', 'COUNT', 'RATIO', 'SCORE')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT uniq_pillar_indicator UNIQUE (pillar_type, indicator_name)
);

-- ============================================================
-- STEP 2: Create indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pit_pillar_type ON pillar_indicator_taxonomy(pillar_type);
CREATE INDEX IF NOT EXISTS idx_pit_active ON pillar_indicator_taxonomy(is_active);
CREATE INDEX IF NOT EXISTS idx_pit_order ON pillar_indicator_taxonomy(pillar_type, indicator_order);

-- ============================================================
-- STEP 3: Seed fixed indicator taxonomy (government-aligned)
-- 4 pillars × 3 indicators = 12 total
-- ============================================================

INSERT INTO pillar_indicator_taxonomy
  (pillar_type, indicator_name, indicator_code, uacs_code, indicator_order, indicator_type, unit_type, description)
VALUES
  -- HIGHER EDUCATION PROGRAM (3 Outcome Indicators)
  ('HIGHER_EDUCATION', 'Student Enrollment Rate', 'HE-OI-001', 'UACS-HE-001', 1, 'OUTCOME', 'PERCENTAGE',
   'Percentage of enrolled students vs target enrollment capacity'),
  ('HIGHER_EDUCATION', 'Graduation Rate', 'HE-OI-002', 'UACS-HE-002', 2, 'OUTCOME', 'PERCENTAGE',
   'Percentage of students graduating within prescribed period'),
  ('HIGHER_EDUCATION', 'Faculty Qualification Level', 'HE-OI-003', 'UACS-HE-003', 3, 'OUTCOME', 'PERCENTAGE',
   'Percentage of faculty members with advanced degrees (Masters/Doctorate)'),

  -- ADVANCED EDUCATION PROGRAM (3 Outcome Indicators)
  ('ADVANCED_EDUCATION', 'Graduate Program Enrollment', 'AE-OI-001', 'UACS-AE-001', 1, 'OUTCOME', 'COUNT',
   'Total number of students enrolled in graduate programs'),
  ('ADVANCED_EDUCATION', 'Research Output per Graduate Student', 'AE-OI-002', 'UACS-AE-002', 2, 'OUTCOME', 'RATIO',
   'Published research papers per enrolled graduate student'),
  ('ADVANCED_EDUCATION', 'Post-Graduate Employment Rate', 'AE-OI-003', 'UACS-AE-003', 3, 'OUTCOME', 'PERCENTAGE',
   'Employment rate of graduates within 6 months of graduation'),

  -- RESEARCH PROGRAM (3 Outcome Indicators)
  ('RESEARCH', 'Number of Research Publications', 'RP-OI-001', 'UACS-RP-001', 1, 'OUTCOME', 'COUNT',
   'Total published research papers in indexed journals'),
  ('RESEARCH', 'Research Grant Acquisition Rate', 'RP-OI-002', 'UACS-RP-002', 2, 'OUTCOME', 'PERCENTAGE',
   'Success rate of research grant applications submitted'),
  ('RESEARCH', 'Industry Partnership Projects', 'RP-OI-003', 'UACS-RP-003', 3, 'OUTCOME', 'COUNT',
   'Number of active industry-academia collaboration projects'),

  -- TECHNICAL ADVISORY & EXTENSION PROGRAM (3 Outcome Indicators)
  ('TECHNICAL_ADVISORY', 'Number of Extension Activities', 'TA-OI-001', 'UACS-TA-001', 1, 'OUTCOME', 'COUNT',
   'Community outreach and extension activities conducted'),
  ('TECHNICAL_ADVISORY', 'Community Partners Served', 'TA-OI-002', 'UACS-TA-002', 2, 'OUTCOME', 'COUNT',
   'Number of community organizations and partners served'),
  ('TECHNICAL_ADVISORY', 'Training Programs Delivered', 'TA-OI-003', 'UACS-TA-003', 3, 'OUTCOME', 'COUNT',
   'Number of training and capability-building programs conducted')

ON CONFLICT (pillar_type, indicator_name) DO NOTHING;

-- ============================================================
-- VERIFICATION: Check seeded data
-- ============================================================

-- Run this to verify:
-- SELECT pillar_type, COUNT(*) as indicator_count
-- FROM pillar_indicator_taxonomy
-- WHERE is_active = true
-- GROUP BY pillar_type
-- ORDER BY pillar_type;
-- Expected: 4 rows, each with indicator_count = 3
