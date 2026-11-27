-- ==============================================================================
-- SPS WAREHOUSE - SQL SEED DATA (Extracted from Removed Client Mockups/Seeds)
-- Run this in Supabase SQL Editor if you want to insert the starter data into
-- your PostgreSQL database. Safe and idempotent (ON CONFLICT DO NOTHING).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure 'leader' and 'full_admin' roles exist on user_role enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'leader';
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'full_admin';
  END IF;
END $$;

-- 1. INITIAL ADMIN ACCOUNT: removed. No password is stored in this repo anymore.
--    Create the first full_admin with the helper in 20261202_auth_rls_v3.sql (docs/AUTH_RLS_SETUP.md).

-- 2. CATEGORIES
INSERT INTO public.categories (id, name, description, display_order, created_at)
VALUES
  ('cat_tshirts', 'T-Shirts & Tops', 'T-shirts, polos, tank tops, and casual tops', 1, NOW()),
  ('cat_hoodies', 'Hoodies & Sweatshirts', 'Pullover hoodies, zip-ups, crewnecks, and fleeces', 2, NOW()),
  ('cat_pants', 'Pants & Jeans', 'Denim, trousers, sweatpants, and cargos', 3, NOW()),
  ('cat_jackets', 'Jackets & Outerwear', 'Coats, windbreakers, varsity jackets, and parkas', 4, NOW()),
  ('cat_shorts', 'Shorts & Swim', 'Casual shorts, athletic shorts, and swim trunks', 5, NOW()),
  ('cat_knitwear', 'Knitwear & Sweaters', 'Cardigans, cable knits, and fine wool sweaters', 6, NOW()),
  ('cat_activewear', 'Activewear', 'Gym apparel, running gear, and technical garments', 7, NOW()),
  ('cat_accessories', 'Accessories', 'Caps, beanies, socks, and apparel accessories', 8, NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. OTHERS CATEGORY FOLDERS & SUB-FOLDERS
INSERT INTO public.others_folders (path)
VALUES
  ('Wegla'),
  ('Pins & Badges'),
  ('Wa3d'),
  ('Accessories'),
  ('Souvenirs'),
  ('Sharat hewayat'),
  ('Sharat hewayat / Ashbal'),
  ('Sharat hewayat / Kashafeen'),
  ('Sharat hewayat / Zahrat'),
  ('Sharat hewayat / Morshedat')
ON CONFLICT (path) DO NOTHING;

-- 4. STARTER INVENTORY PRODUCTS
INSERT INTO public.products (
  id,
  sku,
  name,
  category_id,
  category,
  target_audience,
  description,
  fabric_details,
  price,
  image_url,
  created_at,
  updated_at
)
VALUES
  (
    'prod_tshirt_class_b',
    'SPS-TS-01',
    'T-Shirt Class B (تيشيرت كشفي)',
    'cat_tshirts',
    'T-Shirts & Tops',
    'Unisex',
    'Official Saint Paul Scouts Class B activity t-shirt. High-durability combed cotton with embroidered scout lily emblem.',
    '100% Combed Cotton 220 GSM, Anti-shrinkage',
    250.00,
    NULL,
    NOW(),
    NOW()
  ),
  (
    'prod_scout_shirt_amees',
    'SPS-SH-02',
    'Scout Shirt - Amees (قميص كشفي رسمي)',
    'cat_tshirts',
    'T-Shirts & Tops',
    'Unisex',
    'Official Saint Paul Scouts uniform shirt (Amees) with front chest utility pockets, epaulets, and reinforced seams for badges.',
    'Durable Poly-Cotton Twill, Crease-resistant',
    280.00,
    NULL,
    NOW(),
    NOW()
  ),
  (
    'prod_hoodie_01',
    'SPS-HD-03',
    'Scout Winter Heavyweight Hoodie 450 GSM',
    'cat_hoodies',
    'Hoodies & Sweatshirts',
    'Unisex',
    '450 GSM ultra-heavy French Terry cotton with embroidered Saint Paul Scouts emblem on chest.',
    '100% French Terry Cotton, Pre-shrunk, Anti-pilling',
    450.00,
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- 5. STARTER PRODUCT VARIANTS (SIZES & COLORS)
INSERT INTO public.product_variants (
  id,
  product_id,
  size,
  color_name,
  color_hex,
  quantity,
  sku,
  min_threshold,
  created_at,
  updated_at
)
VALUES
  ('v_ts_olv_s',  'prod_tshirt_class_b',    'S',  'Forest Olive', '#4a5d23', 18, 'SPS-TS-OLV-S',  10, NOW(), NOW()),
  ('v_ts_olv_m',  'prod_tshirt_class_b',    'M',  'Forest Olive', '#4a5d23', 24, 'SPS-TS-OLV-M',  12, NOW(), NOW()),
  ('v_ts_olv_l',  'prod_tshirt_class_b',    'L',  'Forest Olive', '#4a5d23', 30, 'SPS-TS-OLV-L',  12, NOW(), NOW()),
  ('v_ts_olv_xl', 'prod_tshirt_class_b',    'XL', 'Forest Olive', '#4a5d23', 15, 'SPS-TS-OLV-XL', 8,  NOW(), NOW()),
  ('v_sh_khk_s',  'prod_scout_shirt_amees', 'S',  'Khaki Beige',  '#c2a677', 20, 'SPS-SH-KHK-S',  8,  NOW(), NOW()),
  ('v_sh_khk_m',  'prod_scout_shirt_amees', 'M',  'Khaki Beige',  '#c2a677', 35, 'SPS-SH-KHK-M',  15, NOW(), NOW()),
  ('v_sh_khk_l',  'prod_scout_shirt_amees', 'L',  'Khaki Beige',  '#c2a677', 28, 'SPS-SH-KHK-L',  12, NOW(), NOW()),
  ('v_sh_khk_xl', 'prod_scout_shirt_amees', 'XL', 'Khaki Beige',  '#c2a677', 14, 'SPS-SH-KHK-XL', 6,  NOW(), NOW()),
  ('v_hd_blk_s',  'prod_hoodie_01',         'S',  'Pitch Black',  '#18181b', 16, 'SPS-HD-BLK-S',  8,  NOW(), NOW()),
  ('v_hd_blk_m',  'prod_hoodie_01',         'M',  'Pitch Black',  '#18181b', 25, 'SPS-HD-BLK-M',  10, NOW(), NOW()),
  ('v_hd_blk_l',  'prod_hoodie_01',         'L',  'Pitch Black',  '#18181b', 20, 'SPS-HD-BLK-L',  10, NOW(), NOW()),
  ('v_hd_blk_xl', 'prod_hoodie_01',         'XL', 'Pitch Black',  '#18181b', 12, 'SPS-HD-BLK-XL', 5,  NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. SOURCING & PRODUCTION OPERATIONS: MASTER VENDOR DIRECTORY
INSERT INTO public.vendors (
  id,
  name,
  location,
  maps_url,
  contact_person,
  phone,
  tags,
  general_notes,
  created_at
)
VALUES
  (
    'vnd_mahalla_textile',
    'Al-Mahalla Textile Mills (El-Naggar)',
    'Gesr El-Suez Industrial Zone, Bldg 14, Cairo',
    'https://maps.google.com/?q=Gesr+El+Suez+Industrial+Zone+Cairo',
    'Hany El-Naggar',
    '01012345678',
    '["regular", "negotiable", "on_time", "easy_smooth"]'::jsonb,
    'Reliable combed cotton 220 GSM and French Terry supplier. Delivers rolls directly by microbus if >= 3 toobs.',
    NOW()
  ),
  (
    'vnd_shubra_cotton',
    'Shubra Knitwear & Cotton',
    'Shubra El-Kheima Textile Market, Gate 3',
    'https://maps.google.com/?q=Shubra+El+Kheima+Cairo',
    'Mina Farouk',
    '01229876543',
    '["occasional", "fixed_price", "delays", "easy_smooth"]'::jsonb,
    'Good backup for Forest Olive and Navy dyes when El-Naggar is out of stock. Confirm GSM weight on scale.',
    NOW()
  ),
  (
    'vnd_elsalam_cutting',
    'El-Salam Cutting & Tasnee'' Workshop',
    'El-Marg Workshop District, Street 9, Cairo',
    'https://maps.google.com/?q=El+Marg+Cairo',
    'Abou Youssef',
    '01145678901',
    '["regular", "negotiable", "on_time", "easy_smooth"]'::jsonb,
    'Handles laser/electric knife bulk cutting for S to 3XL size patterns.',
    NOW()
  ),
  (
    'vnd_hany_tarzy',
    'Ustaz Hany Tailor Studio (Tarzy)',
    'Ain Shams Textile Alley, 2nd Floor, Cairo',
    'https://maps.google.com/?q=Ain+Shams+Cairo',
    'Ustaz Hany',
    '01098765432',
    '["regular", "negotiable", "on_time", "easy_smooth"]'::jsonb,
    'Clean overlock stitching, collar reinforcement, and Scout emblem placement.',
    NOW()
  ),
  (
    'vnd_cairo_pack',
    'Cairo Pack & Polybags',
    'Bab El-Shaariya Packaging Market, Cairo',
    'https://maps.google.com/?q=Bab+El+Shaariya+Cairo',
    'Karim Adel',
    '01277654321',
    '["regular", "fixed_price", "on_time", "easy_smooth"]'::jsonb,
    'Shared packaging vendor for self-seal polybags, size labels, and SPS kraft tags.',
    NOW()
  ),
  (
    'vnd_muski_imports',
    'Al-Muski Costume & Scout Imports',
    'Haret El-Yahood / Al-Muski Wholesale, Cairo',
    'https://maps.google.com/?q=El+Muski+Cairo',
    'Sayed El-Masry',
    '01122334455',
    '["regular", "negotiable", "on_time", "difficult"]'::jsonb,
    'Wholesale importer for costume wigs, badges, and event props. Count every carton before paying.',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- 7. PRODUCT WORKFLOW FOR STARTER T-SHIRT
INSERT INTO public.product_workflows (id, product_id, workflow_type, active_stages, updated_at)
VALUES (
  'wf_prod_tshirt_class_b',
  'prod_tshirt_class_b',
  'manufactured',
  '["raw_material", "manufacturing", "tailor", "packaging", "stock_in"]'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 8. STAGE-SPECIFIC VENDOR LINKS FOR STARTER T-SHIRT
INSERT INTO public.product_stage_vendors (
  id,
  product_id,
  stage_key,
  vendor_id,
  is_primary,
  approx_order_qty,
  order_script_notes
)
VALUES
  (
    'psv_prod_tshirt_class_b_raw_1',
    'prod_tshirt_class_b',
    'raw_material',
    'vnd_mahalla_textile',
    TRUE,
    '60 meters (3 toobs)',
    'Request 220 GSM combed cotton, pre-shrunk finish, color-fastness check, and matching rib collar roll.'
  ),
  (
    'psv_prod_tshirt_class_b_raw_2',
    'prod_tshirt_class_b',
    'raw_material',
    'vnd_shubra_cotton',
    FALSE,
    '40 meters (2 toobs)',
    'Backup fabric roll if El-Naggar has dye delay. Weigh each toob on pickup before loading.'
  ),
  (
    'psv_prod_tshirt_class_b_cut_1',
    'prod_tshirt_class_b',
    'manufacturing',
    'vnd_elsalam_cutting',
    TRUE,
    '100 pieces per batch',
    'Use SPS standard pattern grading (20 S, 30 M, 35 L, 15 XL). Bundle by size with chalk marks on inside hem.'
  ),
  (
    'psv_prod_tshirt_class_b_tailor_1',
    'prod_tshirt_class_b',
    'tailor',
    'vnd_hany_tarzy',
    TRUE,
    '100 pieces',
    'Double-needle shoulder seam + 4-thread overlock + clean steam press before folding.'
  ),
  (
    'psv_prod_tshirt_class_b_pack_1',
    'prod_tshirt_class_b',
    'packaging',
    'vnd_cairo_pack',
    TRUE,
    '100 polybags + size stickers',
    '30x40cm self-adhesive clear polybag with woven SPS size sticker on upper right corner.'
  )
ON CONFLICT (id) DO NOTHING;

-- 9. VENDOR PRICE HISTORY
INSERT INTO public.vendor_price_history (
  id,
  product_stage_vendor_id,
  purchase_date,
  unit_price,
  quantity,
  notes
)
VALUES
  ('ph_seed_1', 'psv_prod_tshirt_class_b_raw_1',    CURRENT_DATE - 32, 135.00, '60 meters', 'Batch #101 combed cotton rolls'),
  ('ph_seed_2', 'psv_prod_tshirt_class_b_raw_1',    CURRENT_DATE - 14, 142.00, '80 meters', 'Seasonal cotton mill adjustment'),
  ('ph_seed_3', 'psv_prod_tshirt_class_b_raw_2',    CURRENT_DATE - 14, 148.00, '40 meters', 'Urgent backup pickup'),
  ('ph_seed_4', 'psv_prod_tshirt_class_b_cut_1',    CURRENT_DATE - 14,  18.00, '100 pcs',   'Pattern cut & size bundling'),
  ('ph_seed_5', 'psv_prod_tshirt_class_b_tailor_1', CURRENT_DATE - 14,  38.00, '100 pcs',   'Full stitching + finishing'),
  ('ph_seed_6', 'psv_prod_tshirt_class_b_pack_1',   CURRENT_DATE - 14,   6.00, '100 bags',  'Bags + size stickers')
ON CONFLICT (id) DO NOTHING;

-- 10. SAMPLE ACTIVE PRODUCTION BATCH
INSERT INTO public.production_batches (
  id,
  batch_code,
  product_id,
  variant_id,
  quantity,
  target_date,
  current_stage_key,
  status,
  stage_assignments,
  created_at
)
VALUES (
  'batch_seed_104',
  'Batch #104',
  'prod_tshirt_class_b',
  'v_ts_olv_s',
  100,
  CURRENT_DATE + 7,
  'manufacturing',
  'in_progress',
  '{
    "raw_material": {"vendorId": "vnd_mahalla_textile", "cost": 142, "notes": "3 toobs delivered"},
    "manufacturing": {"vendorId": "vnd_elsalam_cutting", "cost": 18, "notes": "Cutting scheduled"},
    "tailor": {"vendorId": "vnd_hany_tarzy", "cost": 38},
    "packaging": {"vendorId": "vnd_cairo_pack", "cost": 6}
  }'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;
