-- Migration 040: Add missing audit columns for MikroORM entity alignment
-- Corrects gap left by Migration 004 (which only covered contractors + funding_sources)
-- Safe to re-run: IF NOT EXISTS guards on all ADD COLUMN statements

-- construction_subcategories: add created_by and updated_by
ALTER TABLE construction_subcategories
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- repair_types: add created_by and updated_by
ALTER TABLE repair_types
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- system_settings: add created_by only (updated_by already exists from baseline schema)
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
