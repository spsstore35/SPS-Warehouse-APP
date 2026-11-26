-- Custom per-item sourcing pipeline stages & shared Estamba template group columns
-- Safe to run multiple times.

ALTER TABLE public.product_workflows
  ADD COLUMN IF NOT EXISTS custom_stages JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS shared_group_id TEXT,
  ADD COLUMN IF NOT EXISTS shared_group_name TEXT,
  ADD COLUMN IF NOT EXISTS template_source_product_id TEXT;

CREATE INDEX IF NOT EXISTS idx_product_workflows_shared_group
  ON public.product_workflows (shared_group_id);
