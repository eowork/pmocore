-- Phase JT-E-1 — additive Auditor role seed.
-- Roles in this system are DB-stored rows in `roles` (no backend enum exists).
-- Auditor is read-only across all modules + read access to activity_logs (Phase JT-D).

INSERT INTO roles (name, display_name, description, rank, is_system, created_at, updated_at)
VALUES (
  'Auditor',
  'Auditor',
  'Read-only access across all modules plus access to activity logs.',
  90,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;
