-- Migration: Allow optional email on public.profiles (register/create account by phone number or username alone)
-- Safe & idempotent to run in Supabase SQL Editor.

-- 1. Allow NULL email addresses and ensure username/phone columns exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

-- 2. Replace strict NOT NULL unique constraint with a partial unique index for non-empty emails
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_key;

UPDATE public.profiles
SET email = NULL
WHERE BTRIM(COALESCE(email, '')) = '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx
  ON public.profiles (LOWER(BTRIM(email)))
  WHERE email IS NOT NULL AND BTRIM(email) <> '';

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

-- 3. Require at least one login identifier (email OR username OR phone)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_at_least_one_contact_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_at_least_one_contact_check
  CHECK (
    (email IS NOT NULL AND BTRIM(email) <> '') OR
    (username IS NOT NULL AND BTRIM(username) <> '') OR
    (phone IS NOT NULL AND BTRIM(phone) <> '')
  );

-- 4. Update unified login lookup RPC to handle NULL/empty email safely
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
  WHERE (
        p.email IS NOT NULL
        AND BTRIM(p.email) <> ''
        AND LOWER(BTRIM(p.email)) = LOWER(v_raw)
      )
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
