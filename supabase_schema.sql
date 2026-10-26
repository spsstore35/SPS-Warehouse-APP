-- ==============================================================================
-- SPS WAREHOUSE APPAREL INVENTORY - SUPABASE & POSTGRESQL PRODUCTION SCHEMA
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
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
    CREATE TYPE target_audience AS ENUM ('Men', 'Women', 'Kids', 'Unisex');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE adjustment_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. CATEGORIES TABLE (Dedicated Table & Connected to Products via Foreign Key)
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Initial Categories if empty
INSERT INTO public.categories (id, name, description, display_order)
VALUES
    ('cat_tshirts', 'T-Shirts & Tops', 'T-shirts, polos, tank tops, and casual tops', 1),
    ('cat_hoodies', 'Hoodies & Sweatshirts', 'Pullover hoodies, zip-ups, crewnecks, and fleeces', 2),
    ('cat_pants', 'Pants & Jeans', 'Denim, trousers, sweatpants, and cargos', 3),
    ('cat_jackets', 'Jackets & Outerwear', 'Coats, windbreakers, varsity jackets, and parkas', 4),
    ('cat_shorts', 'Shorts & Swim', 'Casual shorts, athletic shorts, and swim trunks', 5),
    ('cat_knitwear', 'Knitwear & Sweaters', 'Cardigans, cable knits, and fine wool sweaters', 6),
    ('cat_activewear', 'Activewear', 'Gym apparel, running gear, and technical garments', 7),
    ('cat_accessories', 'Accessories', 'Caps, beanies, socks, and apparel accessories', 8)
ON CONFLICT (id) DO NOTHING;

-- 2. PROFILES & AUTH TABLE (with Pending Admin Approval)
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
    approved_by_name TEXT
);

-- 3. PRODUCTS CATALOG TABLE (Connected to categories via category_id FK)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    target_audience target_audience NOT NULL DEFAULT 'Unisex',
    description TEXT,
    fabric_details TEXT,
    price NUMERIC(10, 2),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If products table already exists in your DB, add category_id column safely
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL;

-- 4. PRODUCT VARIANTS (SIZES & COLORS MATRIX)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL DEFAULT '#18181b',
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    sku TEXT NOT NULL,
    min_threshold INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_prod_size_color UNIQUE (product_id, size, color_name)
);

-- 5. ADJUSTMENT REQUESTS TABLE (Worker submissions to Admin)
CREATE TABLE IF NOT EXISTS public.adjustment_requests (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    product_image TEXT,
    variant_id TEXT NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL DEFAULT '#18181b',
    current_quantity INT NOT NULL,
    requested_quantity INT NOT NULL CHECK (requested_quantity >= 0),
    delta INT NOT NULL,
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

-- 6. STOCK AUDIT LOGS TABLE
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

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.adjustment_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.stock_audit_logs(timestamp DESC);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_logs ENABLE ROW LEVEL SECURITY;

-- OPEN POLICIES FOR ANONYMOUS & AUTHENTICATED ACCESS
DO $$ BEGIN
    CREATE POLICY "Allow public all access on categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public all access on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public all access on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public all access on product_variants" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public all access on adjustment_requests" ON public.adjustment_requests FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public all access on stock_audit_logs" ON public.stock_audit_logs FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
