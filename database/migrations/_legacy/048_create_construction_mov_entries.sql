-- Phase KO-A: Means of Verification (MOV) evidence entries
-- Stores URL-only evidence links attached to either project milestones or timeline entries.
-- Polymorphic relation: `related_entity_id` references either
--   construction_milestones(id) OR construction_timeline_entries(id)
-- Validation enforced at service layer (no DB FK).

CREATE TABLE IF NOT EXISTS construction_mov_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  related_entity_type VARCHAR(20) NOT NULL
    CHECK (related_entity_type IN ('MILESTONE', 'TIMELINE_ENTRY')),
  related_entity_id UUID NOT NULL,
  mov_link TEXT NOT NULL,
  mov_title VARCHAR(255) NOT NULL,
  mov_description TEXT,
  evidence_category VARCHAR(50) NOT NULL DEFAULT 'other',
  entry_date DATE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mov_entries_project_id
  ON construction_mov_entries(project_id);

CREATE INDEX IF NOT EXISTS idx_mov_entries_entity
  ON construction_mov_entries(related_entity_type, related_entity_id);
