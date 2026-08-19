-- Phase JY-B — Add Phase JU-B entity columns missing from construction_pow_items.
-- The table was bootstrapped from a draft schema before Phase JU-B added these
-- fields to the entity.  All additions use IF NOT EXISTS for idempotency.

ALTER TABLE construction_pow_items
  ADD COLUMN IF NOT EXISTS progress               DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS sort_order             INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date             DATE,
  ADD COLUMN IF NOT EXISTS end_date               DATE,
  ADD COLUMN IF NOT EXISTS project_duration       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS variance               DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS estimated_project_cost DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW();

COMMENT ON COLUMN construction_pow_items.progress               IS 'Percent completion of this POW item (0–100)';
COMMENT ON COLUMN construction_pow_items.sort_order             IS 'Display order (ascending); ORM orders by sort_order ASC, created_at ASC';
COMMENT ON COLUMN construction_pow_items.estimated_project_cost IS 'Total estimated cost (material + labor, or standalone)';
COMMENT ON COLUMN construction_pow_items.variance               IS 'Variance between estimated and actual cost';
