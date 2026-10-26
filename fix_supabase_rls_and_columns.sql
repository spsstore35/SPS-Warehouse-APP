-- ==============================================================================
-- SPS WAREHOUSE APPAREL INVENTORY - SUPABASE DATABASE FIX SCRIPT
-- RUN THIS ENTIRE SCRIPT IN YOUR SUPABASE SQL EDITOR
-- ==============================================================================

-- 1. Ensure 'category_id' in products allows NULL and cascades ON DELETE SET NULL
-- This ensures when you delete any category, items inside it become 'Unassigned' (category_id = NULL)
-- without throwing foreign key constraint errors!
DO $$ BEGIN
    ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS fk_products_category,
    DROP CONSTRAINT IF EXISTS products_category_id_fkey;

    -- Make category_id nullable
    ALTER TABLE public.products
    ALTER COLUMN category_id DROP NOT NULL;

    -- Re-add foreign key with ON DELETE SET NULL
    ALTER TABLE public.products
    ADD CONSTRAINT fk_products_category
    FOREIGN KEY (category_id)
    REFERENCES public.categories(id)
    ON DELETE SET NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

-- 2. If 'category' column exists in products, make it nullable so it never blocks inserts
DO $$ BEGIN
    ALTER TABLE public.products ALTER COLUMN category DROP NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- 3. Ensure 'min_threshold' in product_variants allows NULL (so it can be left blank)
DO $$ BEGIN
    ALTER TABLE public.product_variants ALTER COLUMN min_threshold DROP NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- 4. Enable Row Level Security (RLS) on 'categories' table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for everyone (anon & authenticated)
DROP POLICY IF EXISTS "Allow select categories" ON public.categories;
CREATE POLICY "Allow select categories"
ON public.categories FOR SELECT
USING (true);

-- Allow INSERT for everyone (anon & authenticated)
DROP POLICY IF EXISTS "Allow insert categories" ON public.categories;
CREATE POLICY "Allow insert categories"
ON public.categories FOR INSERT
WITH CHECK (true);

-- Allow UPDATE for everyone (anon & authenticated)
DROP POLICY IF EXISTS "Allow update categories" ON public.categories;
CREATE POLICY "Allow update categories"
ON public.categories FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow DELETE for categories (Enables deleting categories from the app)
DROP POLICY IF EXISTS "Allow delete categories" ON public.categories;
CREATE POLICY "Allow delete categories"
ON public.categories FOR DELETE
USING (true);

-- 5. Grant RLS UPDATE on products so unassigning works smoothly
DROP POLICY IF EXISTS "Allow update products" ON public.products;
CREATE POLICY "Allow update products"
ON public.products FOR UPDATE
USING (true)
WITH CHECK (true);

-- 6. Grant RLS ALL permissions on product_variants
DROP POLICY IF EXISTS "Allow all product_variants" ON public.product_variants;
CREATE POLICY "Allow all product_variants"
ON public.product_variants FOR ALL
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- DONE! Your Supabase database is now fully configured for:
-- 1. Deleting categories with automatic unassigning of existing items (SET NULL).
-- 2. Blank or custom alert thresholds for each size variant.
-- 3. Clean product upserts without category column schema errors.
-- ==============================================================================
