-- Migration 041: Add created_by and updated_by audit columns to departments, documents, media
-- Phase HK — ORM Migration Tier 2
-- These columns were expected by existing service code but missing from the schema.

-- departments
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- media
ALTER TABLE media
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
