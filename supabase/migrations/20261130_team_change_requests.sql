-- Migration: Team Change Requests queue for Staff-to-Admin approval workflow
-- Safe & idempotent to run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.team_change_requests (
  id TEXT PRIMARY KEY,
  team_scope TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by_id TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by_id TEXT,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_team_change_requests_scope_status
  ON public.team_change_requests (team_scope, status);

CREATE INDEX IF NOT EXISTS idx_team_change_requests_requested_by
  ON public.team_change_requests (requested_by_id);

ALTER TABLE public.team_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access on team_change_requests" ON public.team_change_requests;
CREATE POLICY "Allow public all access on team_change_requests"
  ON public.team_change_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_change_requests TO anon, authenticated;
