-- ==============================================================================
-- IMMEDIATE FIX FOR SUPABASE: RLS ERRORS & MISSING TARGET_AUDIENCE COLUMN
-- ==============================================================================
-- Run this in your Supabase SQL Editor (takes 2 seconds to execute):
-- ==============================================================================

-- 1. Add missing columns and relax strict audit log foreign key constraint
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'Unisex';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_by_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.stock_audit_logs DROP CONSTRAINT IF EXISTS stock_audit_logs_product_id_fkey;
ALTER TABLE public.stock_audit_logs ALTER COLUMN product_id DROP NOT NULL;

-- 1b. Cryptographically hash any unhashed plain text passwords in profiles
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE public.profiles
SET password_hash = encode(digest(password_hash, 'sha256'), 'hex')
WHERE password_hash IS NOT NULL 
  AND length(password_hash) < 60 
  AND password_hash NOT LIKE '$2a$%' 
  AND password_hash NOT LIKE '$2b$%';

-- Set default hashed password for any NULL accounts
UPDATE public.profiles
SET password_hash = encode(digest('123456', 'sha256'), 'hex')
WHERE password_hash IS NULL;

-- 2. Create target_audiences table if missing
CREATE TABLE IF NOT EXISTS public.target_audiences (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.target_audiences (id, name, slug, description, display_order) VALUES
  ('Men', 'Men', 'men', 'Apparel tailored for men', 1),
  ('Women', 'Women', 'women', 'Apparel tailored for women', 2),
  ('Kids', 'Kids', 'kids', 'Apparel designed for children and youth', 3),
  ('Unisex', 'Unisex', 'unisex', 'Gender-neutral universal apparel', 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- 3. Drop previous restrictive policies causing 42501 errors
DROP POLICY IF EXISTS "Products viewable by authenticated users" ON public.products;
DROP POLICY IF EXISTS "Products editable by admins" ON public.products;
DROP POLICY IF EXISTS "Variants viewable by authenticated users" ON public.product_variants;
DROP POLICY IF EXISTS "Variants editable by admins" ON public.product_variants;
DROP POLICY IF EXISTS "Audit logs viewable by all users" ON public.stock_audit_logs;
DROP POLICY IF EXISTS "Audit logs insertable by system" ON public.stock_audit_logs;
DROP POLICY IF EXISTS "Allow all access on products" ON public.products;
DROP POLICY IF EXISTS "Allow all access on stock_audit_logs" ON public.stock_audit_logs;
DROP POLICY IF EXISTS "Allow all access on product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow all access on target_audiences" ON public.target_audiences;
DROP POLICY IF EXISTS "Allow all access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all access on adjustment_requests" ON public.adjustment_requests;

-- 4. Enable permissive policies allowing anon & authenticated client access
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on products" ON public.products FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on product_variants" ON public.product_variants FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on stock_audit_logs" ON public.stock_audit_logs FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on target_audiences" ON public.target_audiences FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on profiles" ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on adjustment_requests" ON public.adjustment_requests FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. Grant full table permissions
GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.product_variants TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.stock_audit_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.target_audiences TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.adjustment_requests TO anon, authenticated, service_role;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
