-- Phase JH-A: Add target progress columns to support variance tracking on construction projects
-- Adds two nullable DECIMAL(5,2) columns with DEFAULT 100.
-- Both are additive; existing rows backfill with the default.

ALTER TABLE construction_projects
  ADD COLUMN IF NOT EXISTS target_physical_progress DECIMAL(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS target_financial_progress DECIMAL(5,2) DEFAULT 100;
