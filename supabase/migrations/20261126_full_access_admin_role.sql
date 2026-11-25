-- Migration: Add explicit 'full_admin' value to Postgres user_role enum
-- Idempotent SQL safe to run in Supabase SQL Editor.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'full_admin';
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'leader';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_created_by_role_check;
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_created_by_role_check
      CHECK (created_by_role IN ('full_admin', 'admin', 'worker', 'leader'));
  END IF;
END $$;
