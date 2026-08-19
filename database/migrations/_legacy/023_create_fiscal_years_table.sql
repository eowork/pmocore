-- Migration 023: Create fiscal_years configuration table
-- Phase DO-B: Configurable fiscal year management (SuperAdmin only)
-- BAR1 Compliance: Fiscal years must be dynamically configurable

CREATE TABLE IF NOT EXISTS fiscal_years (
  year INTEGER PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT true,
  label VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default fiscal years
INSERT INTO fiscal_years (year, is_active, label) VALUES
  (2022, true, 'FY 2022'),
  (2023, true, 'FY 2023'),
  (2024, true, 'FY 2024'),
  (2025, true, 'FY 2025'),
  (2026, true, 'FY 2026')
ON CONFLICT (year) DO NOTHING;

-- Index for active fiscal year lookups
CREATE INDEX IF NOT EXISTS idx_fiscal_years_active ON fiscal_years (year) WHERE is_active = true;
