-- Phase JT-D-4 — activity logging infrastructure (additive table)

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs (created_at DESC);
