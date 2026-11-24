-- Migration: Add explicit 'full_admin' value to Postgres user_role enum
-- Idempotent SQL safe to run in Supabase SQL Editor.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'full_admin';
  END IF;
END $$;
