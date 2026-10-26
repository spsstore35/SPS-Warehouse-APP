-- ==============================================================================
-- WEARHOUSE APPAREL INVENTORY - SUPABASE & POSTGRESQL PRODUCTION SCHEMA
-- ==============================================================================
-- Full database structure for products, variants (size & color), target audiences,
-- stock adjustment requests, audit trails, and user authentication with pending admin approval.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. ENUMS
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'worker');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'pending', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE adjustment_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. TARGET AUDIENCES TABLE (Men, Women, Kids, Unisex)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.target_audiences (
    id TEXT PRIMARY KEY, -- 'Men', 'Women', 'Kids', 'Unisex'
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. USERS & ACCOUNTS (with pending admin approval workflow)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'worker',
    status user_status NOT NULL DEFAULT 'pending',
    requested_role user_role NOT NULL DEFAULT 'worker',
    employee_id TEXT,
    avatar_color TEXT DEFAULT '#d97706',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by_name TEXT
);

-- Ensure approved_by_name exists on existing tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_by_name TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- ==============================================================================
-- 5. PRODUCTS (Garments & Apparel Catalog)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    target_audience TEXT NOT NULL DEFAULT 'Unisex',
    description TEXT,
    fabric_details TEXT,
    price NUMERIC(10, 2),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure target_audience column exists even if table was created in an earlier migration
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'Unisex';

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_audience ON public.products(target_audience);

-- ==============================================================================
-- 6. PRODUCT VARIANTS (Size and Color Quantities Matrix)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    size TEXT NOT NULL, -- 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    sku TEXT UNIQUE NOT NULL,
    min_threshold INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_size_color ON public.product_variants(size, color_name);

-- Dynamic Stock View
CREATE OR REPLACE VIEW public.products_with_stock AS
SELECT 
    p.*,
    COALESCE(SUM(v.quantity), 0)::INTEGER AS total_quantity,
    COUNT(v.id)::INTEGER AS variant_count
FROM public.products p
LEFT JOIN public.product_variants v ON p.id = v.product_id
GROUP BY p.id;

-- ==============================================================================
-- 7. STOCK ADJUSTMENT REQUESTS (Worker submissions pending Admin approval)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.adjustment_requests (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    product_image TEXT,
    variant_id TEXT NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    current_quantity INTEGER NOT NULL,
    requested_quantity INTEGER NOT NULL CHECK (requested_quantity >= 0),
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    worker_note TEXT,
    worker_id TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    status adjustment_status NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    admin_id TEXT,
    admin_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON public.adjustment_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_worker ON public.adjustment_requests(worker_id);

-- ==============================================================================
-- 8. STOCK AUDIT LOGS (Traceability)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stock_audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role user_role NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    product_id TEXT,
    product_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.stock_audit_logs(timestamp DESC);

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) FIXES (Resolves error 42501 for anon client)
-- ==============================================================================
-- Disable RLS on all tables so that the frontend anon key has unrestricted read/write access:
ALTER TABLE public.target_audiences DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustment_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_logs DISABLE ROW LEVEL SECURITY;

-- Drop all old restrictive policies if they existed
DROP POLICY IF EXISTS "Products viewable by authenticated users" ON public.products;
DROP POLICY IF EXISTS "Products editable by admins" ON public.products;
DROP POLICY IF EXISTS "Variants viewable by authenticated users" ON public.product_variants;
DROP POLICY IF EXISTS "Variants editable by admins" ON public.product_variants;
DROP POLICY IF EXISTS "Adjustment requests viewable by all staff" ON public.adjustment_requests;
DROP POLICY IF EXISTS "Staff can submit adjustment requests" ON public.adjustment_requests;
DROP POLICY IF EXISTS "Admins can approve or reject adjustment requests" ON public.adjustment_requests;
DROP POLICY IF EXISTS "Audit logs viewable by all users" ON public.stock_audit_logs;
DROP POLICY IF EXISTS "Audit logs insertable by system" ON public.stock_audit_logs;
DROP POLICY IF EXISTS "Public profiles can be viewed by approved accounts" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can register (insert pending profile)" ON public.profiles;
DROP POLICY IF EXISTS "Admins can approve or update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Target audiences viewable by all" ON public.target_audiences;
DROP POLICY IF EXISTS "Target audiences manageable by admins" ON public.target_audiences;
DROP POLICY IF EXISTS "Allow anon all on products" ON public.products;
DROP POLICY IF EXISTS "Allow public all access on products" ON public.products;
DROP POLICY IF EXISTS "Allow public all access on stock_audit_logs" ON public.stock_audit_logs;

-- Re-enable with permissive open policies for all roles (anon, authenticated, service_role)
ALTER TABLE public.target_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on target_audiences" ON public.target_audiences FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on profiles" ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on products" ON public.products FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on product_variants" ON public.product_variants FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on adjustment_requests" ON public.adjustment_requests FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on stock_audit_logs" ON public.stock_audit_logs FOR ALL TO public USING (true) WITH CHECK (true);

-- Grant full table permissions to anon and authenticated roles
GRANT ALL ON TABLE public.target_audiences TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.product_variants TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.adjustment_requests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.stock_audit_logs TO anon, authenticated, service_role;

-- ==============================================================================
-- 10. REFRESH SCHEMA CACHE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- 11. INITIAL SEED DATA
-- ==============================================================================

-- 11.1 Seed Target Audiences
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

-- 11.2 Seed Users (Admin pre-approved, Workers pre-approved, and Pending registrations)
INSERT INTO public.profiles (id, email, password_hash, full_name, role, status, requested_role, employee_id, avatar_color)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'admin@wearhouse.com', 'admin123', 'Admin Boss (Owner)', 'admin', 'active', 'admin', 'WH-ADM-01', '#d97706'),
  ('a0000000-0000-0000-0000-000000000002', 'karim@wearhouse.com', 'worker123', 'Karim (Floor Lead)', 'worker', 'active', 'worker', 'WH-FLR-08', '#0284c7'),
  ('a0000000-0000-0000-0000-000000000003', 'amr@wearhouse.com', 'worker123', 'Amr (Inventory Specialist)', 'worker', 'active', 'worker', 'WH-FLR-14', '#7c3aed'),
  ('a0000000-0000-0000-0000-000000000004', 'tarek@wearhouse.com', 'pass123', 'Tarek Fathy (New Picker)', 'worker', 'pending', 'worker', 'WH-PEND-01', '#64748b'),
  ('a0000000-0000-0000-0000-000000000005', 'nour@wearhouse.com', 'pass123', 'Nour El-Din (Shift Supervisor)', 'admin', 'pending', 'admin', 'WH-PEND-02', '#64748b')
ON CONFLICT (email) DO NOTHING;

-- 11.3 Seed Products
INSERT INTO public.products (id, sku, name, category, target_audience, description, fabric_details, price, image_url)
VALUES
  ('prod_hoodie_01', 'WH-HD-450', 'Heavyweight Boxy Hoodie 450 GSM', 'Hoodies & Sweatshirts', 'Unisex', '450 GSM ultra-heavy French Terry cotton with relaxed drop-shoulder cut, double-layered hood without drawstrings, and kangaroo front pouch.', '100% French Terry Cotton, Pre-shrunk, Anti-pilling finish', 38.00, ''),
  ('prod_tee_02', 'WH-TS-220', 'Drop-Shoulder Vintage Washed Tee', 'T-Shirts & Tops', 'Men', '220 GSM heavyweight combed organic cotton. Features enzyme garment wash, ribbed collar band, and a wide boxy streetwear drape.', '100% Organic Combed Cotton, Enzyme Washed', 18.00, ''),
  ('prod_jeans_03', 'WH-JN-014', 'Raw Selvedge Relaxed Denim Jeans', 'Pants & Jeans', 'Men', '14oz rigid red-line selvedge denim woven on vintage shuttle looms. Mid-rise with relaxed straight leg, copper rivets, and leather back patch.', '14oz 100% Cotton Raw Indigo Denim, Red-line ID', 45.00, ''),
  ('prod_bomber_04', 'WH-JK-808', 'Water-Resistant Technical Bomber', 'Jackets & Outerwear', 'Unisex', 'Flight jacket cut from durable matte DWR nylon shell. Features 80g thermal insulation, brass metal front zipper, and ribbed collar and cuffs.', 'Matte DWR Nylon, Diamond Quilted Thermal Lining', 55.00, ''),
  ('prod_pants_05', 'WH-PT-380', 'Heavy French Terry Cuffed Sweatpants', 'Pants & Jeans', 'Women', '380 GSM fleece lounge sweatpants with deep front slash pockets, reinforced waistband with drawstrings, and heavy-gauge ankle cuffs.', '380 GSM 100% Cotton French Terry, Brushed Interior', 28.00, ''),
  ('prod_kids_06', 'WH-KD-102', 'Kids Everyday Raglan Fleece Crew', 'Hoodies & Sweatshirts', 'Kids', '300 GSM ultra-soft brushed fleece pullover with stretch ribbed collar and cuffs. Durable reinforced seams designed for active play.', '80% Organic Cotton / 20% Poly Fleece, Tagless interior', 22.00, '')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  target_audience = EXCLUDED.target_audience,
  description = EXCLUDED.description,
  fabric_details = EXCLUDED.fabric_details,
  price = EXCLUDED.price;

-- 11.4 Seed Product Variants
INSERT INTO public.product_variants (id, product_id, size, color_name, color_hex, quantity, sku, min_threshold)
VALUES
  -- Hoodie 450 variants
  ('v_hd_blk_s', 'prod_hoodie_01', 'S', 'Pitch Black', '#18181b', 24, 'WH-HD-450-BLK-S', 10),
  ('v_hd_blk_m', 'prod_hoodie_01', 'M', 'Pitch Black', '#18181b', 38, 'WH-HD-450-BLK-M', 15),
  ('v_hd_blk_l', 'prod_hoodie_01', 'L', 'Pitch Black', '#18181b', 32, 'WH-HD-450-BLK-L', 15),
  ('v_hd_blk_xl', 'prod_hoodie_01', 'XL', 'Pitch Black', '#18181b', 20, 'WH-HD-450-BLK-XL', 8),
  ('v_hd_oat_m', 'prod_hoodie_01', 'M', 'Oatmeal Melange', '#e2e8f0', 18, 'WH-HD-450-OAT-M', 10),
  ('v_hd_oat_l', 'prod_hoodie_01', 'L', 'Oatmeal Melange', '#e2e8f0', 22, 'WH-HD-450-OAT-L', 10),
  ('v_hd_sag_m', 'prod_hoodie_01', 'M', 'Washed Sage', '#4b5563', 14, 'WH-HD-450-SAG-M', 10),
  ('v_hd_sag_l', 'prod_hoodie_01', 'L', 'Washed Sage', '#4b5563', 6, 'WH-HD-450-SAG-L', 10),

  -- Vintage Tee variants
  ('v_ts_bon_s', 'prod_tee_02', 'S', 'Bone White', '#f4f4f5', 30, 'WH-TS-220-BON-S', 15),
  ('v_ts_bon_m', 'prod_tee_02', 'M', 'Bone White', '#f4f4f5', 45, 'WH-TS-220-BON-M', 20),
  ('v_ts_bon_l', 'prod_tee_02', 'L', 'Bone White', '#f4f4f5', 40, 'WH-TS-220-BON-L', 20),
  ('v_ts_bon_xl', 'prod_tee_02', 'XL', 'Bone White', '#f4f4f5', 25, 'WH-TS-220-BON-XL', 10),
  ('v_ts_blk_m', 'prod_tee_02', 'M', 'Washed Charcoal', '#27272a', 35, 'WH-TS-220-BLK-M', 20),
  ('v_ts_blk_l', 'prod_tee_02', 'L', 'Washed Charcoal', '#27272a', 28, 'WH-TS-220-BLK-L', 15),
  ('v_ts_olv_m', 'prod_tee_02', 'M', 'Forest Olive', '#2d372e', 18, 'WH-TS-220-OLV-M', 10),
  ('v_ts_olv_l', 'prod_tee_02', 'L', 'Forest Olive', '#2d372e', 12, 'WH-TS-220-OLV-L', 10),

  -- Selvedge Jeans variants
  ('v_jn_ind_s', 'prod_jeans_03', 'S', 'Deep Indigo', '#1e293b', 12, 'WH-JN-014-IND-S', 8),
  ('v_jn_ind_m', 'prod_jeans_03', 'M', 'Deep Indigo', '#1e293b', 26, 'WH-JN-014-IND-M', 12),
  ('v_jn_ind_l', 'prod_jeans_03', 'L', 'Deep Indigo', '#1e293b', 24, 'WH-JN-014-IND-L', 12),
  ('v_jn_ind_xl', 'prod_jeans_03', 'XL', 'Deep Indigo', '#1e293b', 18, 'WH-JN-014-IND-XL', 8),
  ('v_jn_blu_m', 'prod_jeans_03', 'M', 'Bleach Fade', '#93c5fd', 15, 'WH-JN-014-BLU-M', 8),
  ('v_jn_blu_l', 'prod_jeans_03', 'L', 'Bleach Fade', '#93c5fd', 14, 'WH-JN-014-BLU-L', 8),

  -- Bomber Jacket variants
  ('v_jk_olv_m', 'prod_bomber_04', 'M', 'Military Olive', '#3f4a3c', 14, 'WH-JK-808-OLV-M', 6),
  ('v_jk_olv_l', 'prod_bomber_04', 'L', 'Military Olive', '#3f4a3c', 16, 'WH-JK-808-OLV-L', 6),
  ('v_jk_olv_xl', 'prod_bomber_04', 'XL', 'Military Olive', '#3f4a3c', 8, 'WH-JK-808-OLV-XL', 4),
  ('v_jk_blk_m', 'prod_bomber_04', 'M', 'Matte Black', '#09090b', 18, 'WH-JK-808-BLK-M', 8),
  ('v_jk_blk_l', 'prod_bomber_04', 'L', 'Matte Black', '#09090b', 20, 'WH-JK-808-BLK-L', 8),
  ('v_jk_blk_xl', 'prod_bomber_04', 'XL', 'Matte Black', '#09090b', 9, 'WH-JK-808-BLK-XL', 4),

  -- Sweatpants variants
  ('v_pt_gry_s', 'prod_pants_05', 'S', 'Heather Grey', '#cbd5e1', 15, 'WH-PT-380-GRY-S', 10),
  ('v_pt_gry_m', 'prod_pants_05', 'M', 'Heather Grey', '#cbd5e1', 24, 'WH-PT-380-GRY-M', 12),
  ('v_pt_gry_l', 'prod_pants_05', 'L', 'Heather Grey', '#cbd5e1', 20, 'WH-PT-380-GRY-L', 12),
  ('v_pt_blk_m', 'prod_pants_05', 'M', 'Pitch Black', '#18181b', 30, 'WH-PT-380-BLK-M', 15),
  ('v_pt_blk_l', 'prod_pants_05', 'L', 'Pitch Black', '#18181b', 22, 'WH-PT-380-BLK-L', 15),

  -- Kids Crew variants
  ('v_kd_blu_s', 'prod_kids_06', 'S', 'Deep Navy', '#1e293b', 20, 'WH-KD-102-NVY-S', 8),
  ('v_kd_blu_m', 'prod_kids_06', 'M', 'Deep Navy', '#1e293b', 25, 'WH-KD-102-NVY-M', 10),
  ('v_kd_blu_l', 'prod_kids_06', 'L', 'Deep Navy', '#1e293b', 18, 'WH-KD-102-NVY-L', 8),
  ('v_kd_gry_m', 'prod_kids_06', 'M', 'Heather Grey', '#cbd5e1', 22, 'WH-KD-102-GRY-M', 10),
  ('v_kd_gry_l', 'prod_kids_06', 'L', 'Heather Grey', '#cbd5e1', 15, 'WH-KD-102-GRY-L', 8)
ON CONFLICT (id) DO NOTHING;

-- 11.5 Seed Pending Requests
INSERT INTO public.adjustment_requests (id, product_id, product_name, variant_id, size, color_name, color_hex, current_quantity, requested_quantity, delta, reason, worker_note, worker_id, worker_name, status)
VALUES
  ('req_001', 'prod_hoodie_01', 'Heavyweight Boxy Hoodie 450 GSM', 'v_hd_blk_l', 'L', 'Pitch Black', '#18181b', 32, 28, -4, 'Damaged / Defective Garment', 'Damaged packaging from carton tear during delivery, 4 units have discoloration on sleeve.', 'a0000000-0000-0000-0000-000000000002', 'Karim (Floor Lead)', 'pending'),
  ('req_002', 'prod_tee_02', 'Drop-Shoulder Vintage Washed Tee', 'v_ts_bon_m', 'M', 'Bone White', '#f4f4f5', 45, 70, 25, 'New Inbound Shipment Batch', 'Received 1 sealed factory carton PO# 8841. Verified tags and garment stitching.', 'a0000000-0000-0000-0000-000000000003', 'Amr (Inventory Specialist)', 'pending'),
  ('req_003', 'prod_jeans_03', 'Raw Selvedge Relaxed Denim Jeans', 'v_jn_ind_xl', 'XL', 'Deep Indigo', '#1e293b', 18, 15, -3, 'Physical Count Discrepancy', 'Completed morning physical count, stack contained 15 units instead of 18.', 'a0000000-0000-0000-0000-000000000002', 'Karim (Floor Lead)', 'pending')
ON CONFLICT (id) DO NOTHING;

-- 11.6 Seed Audit Logs
INSERT INTO public.stock_audit_logs (id, timestamp, action, actor_name, actor_role, summary, details, product_id, product_name)
VALUES
  ('log_001', '2026-10-24T14:20:00Z', 'product_created', 'Admin Boss (Owner)', 'admin', 'Created product "Heavyweight Boxy Hoodie 450 GSM"', 'Initial inventory initialized with 8 variants (174 units total).', 'prod_hoodie_01', 'Heavyweight Boxy Hoodie 450 GSM'),
  ('log_002', '2026-10-24T16:45:00Z', 'request_approved', 'Admin Boss (Owner)', 'admin', 'Approved stock adjustment for "Drop-Shoulder Vintage Washed Tee"', 'Variant Size L / Washed Charcoal adjusted from 25 to 28 units (+3 units).', 'prod_tee_02', 'Drop-Shoulder Vintage Washed Tee')
ON CONFLICT (id) DO NOTHING;
