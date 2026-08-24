-- Phase JU-A-1 — additive milestone enhancement.

ALTER TABLE construction_milestones
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS actual_start_date DATE,
  ADD COLUMN IF NOT EXISTS progress DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS category VARCHAR(50);

COMMENT ON COLUMN construction_milestones.progress IS 'Percent completion of this milestone (0-100)';
COMMENT ON COLUMN construction_milestones.category IS 'Optional grouping: SITE_PREPARATION, STRUCTURAL, ARCHITECTURAL, MEP, FINISHING, OTHER';
