-- Migration 036: Add narrative fields to operation_indicators
-- Phase HE: APR/UPR-aligned narrative data entry (Directive 386)
-- Reference: docs/plan.md Phase HE, research.md Section 2.63 HE-D
-- Date: 2026-04-13
-- Safe to re-run: YES (IF NOT EXISTS)

-- Catch-Up Plan: remediation actions for indicators that missed their targets
ALTER TABLE operation_indicators
  ADD COLUMN IF NOT EXISTS catch_up_plan TEXT;

-- Facilitating Factors: conditions that enabled achievement of targets
ALTER TABLE operation_indicators
  ADD COLUMN IF NOT EXISTS facilitating_factors TEXT;

-- Ways Forward: recommended next steps and improvements
ALTER TABLE operation_indicators
  ADD COLUMN IF NOT EXISTS ways_forward TEXT;

COMMENT ON COLUMN operation_indicators.catch_up_plan IS 'Phase HE: Catch-up plan narrative for APR/UPR reporting (Not Met Targets)';
COMMENT ON COLUMN operation_indicators.facilitating_factors IS 'Phase HE: Facilitating factors narrative for APR/UPR reporting (Met Targets)';
COMMENT ON COLUMN operation_indicators.ways_forward IS 'Phase HE: Ways forward narrative for APR/UPR reporting';
