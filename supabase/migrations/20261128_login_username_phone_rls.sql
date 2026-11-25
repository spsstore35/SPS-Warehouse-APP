-- Migration: Add username & phone login support, unique indexes, RLS policies, and login_lookup_profile RPC
-- Safe & idempotent to run in Supabase SQL Editor.

-- 1. Add username and phone columns to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Unique partial indexes (prevents duplicates while allowing NULL/blank)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (LOWER(BTRIM(username)))
  WHERE username IS NOT NULL AND BTRIM(username) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (
    CASE
      WHEN REGEXP_REPLACE(phone, '[^0-9]', '', 'g') ~ '^0020[0-9]{10}$'
        THEN '0' || SUBSTRING(REGEXP_REPLACE(phone, '[^0-9]', '', 'g') FROM 5)
      WHEN REGEXP_REPLACE(phone, '[^0-9]', '', 'g') ~ '^20[0-9]{10}$'
        THEN '0' || SUBSTRING(REGEXP_REPLACE(phone, '[^0-9]', '', 'g') FROM 3)
      ELSE REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
    END
  )
  WHERE phone IS NOT NULL AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') <> '';

-- 3. Row Level Security (RLS) & Grants on public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_insert_policy"
  ON public.profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "profiles_delete_policy"
  ON public.profiles FOR DELETE
  TO anon, authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;

-- 4. RPC function for unified login by Email, Phone Number, or Username
CREATE OR REPLACE FUNCTION public.login_lookup_profile(p_identifier TEXT)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw TEXT := BTRIM(COALESCE(p_identifier, ''));
  v_user TEXT := LOWER(REGEXP_REPLACE(v_raw, '^@+', ''));
  v_digits TEXT := REGEXP_REPLACE(v_raw, '[^0-9]', '', 'g');
  v_norm_phone TEXT;
BEGIN
  IF v_raw = '' THEN
    RETURN;
  END IF;

  IF v_digits ~ '^0020[0-9]{10}$' THEN
    v_norm_phone := '0' || SUBSTRING(v_digits FROM 5);
  ELSIF v_digits ~ '^20[0-9]{10}$' THEN
    v_norm_phone := '0' || SUBSTRING(v_digits FROM 3);
  ELSE
    v_norm_phone := v_digits;
  END IF;

  RETURN QUERY
  SELECT p.*
  FROM public.profiles p
  WHERE LOWER(BTRIM(p.email)) = LOWER(v_raw)
     OR (
       p.username IS NOT NULL
       AND BTRIM(p.username) <> ''
       AND LOWER(BTRIM(p.username)) = v_user
     )
     OR (
       v_norm_phone <> ''
       AND p.phone IS NOT NULL
       AND (
         CASE
           WHEN REGEXP_REPLACE(p.phone, '[^0-9]', '', 'g') ~ '^0020[0-9]{10}$'
             THEN '0' || SUBSTRING(REGEXP_REPLACE(p.phone, '[^0-9]', '', 'g') FROM 5)
           WHEN REGEXP_REPLACE(p.phone, '[^0-9]', '', 'g') ~ '^20[0-9]{10}$'
             THEN '0' || SUBSTRING(REGEXP_REPLACE(p.phone, '[^0-9]', '', 'g') FROM 3)
           ELSE REGEXP_REPLACE(p.phone, '[^0-9]', '', 'g')
         END
       ) = v_norm_phone
     )
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_lookup_profile(TEXT) TO anon, authenticated;
