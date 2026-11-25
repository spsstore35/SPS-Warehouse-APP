import React, { useState } from 'react';
import { X, Copy, Check, Download, Database, Terminal, Sparkles } from 'lucide-react';

interface SqlSchemaViewerModalProps {
  onClose: () => void;
}

export const SqlSchemaViewerModal: React.FC<SqlSchemaViewerModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'migration' | 'full'>('migration');

  const migrationSql = `-- ==============================================================================
-- SPS WAREHOUSE - SAFE INCREMENTAL MIGRATION SQL (FOR EXISTING SUPABASE DB)
-- Run this in Supabase SQL Editor to sync all recent Team, Scout Fera2,
-- Booking Assignment, and Calendar Board changes without dropping any data.
-- ==============================================================================

-- 1. Ensure 'leader' and 'full_admin' roles exist on user_role enum & bookings role check
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'leader';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'full_admin';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_created_by_role_check;
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_created_by_role_check
      CHECK (created_by_role IN ('full_admin', 'admin', 'worker', 'leader'));
  END IF;
END $$;

-- 2. Add Username, Phone, Store Team (6 teams) & Scout Fera2 assignment columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_teams JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_fare2 JSONB NOT NULL DEFAULT '[]'::jsonb;

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

-- 3. Add Troop Group, Scout Fera2, Assigned Member, and Payment Verification columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS troop_group TEXT,
  ADD COLUMN IF NOT EXISTS assigned_fare2 TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_verification_requested BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_verification_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS payment_verification_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_verification_note TEXT;

-- 4. Ensure Store Calendar Events & Team Board table + columns exist
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'event' CHECK (item_type IN ('event', 'task')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  board_status TEXT,
  team TEXT,
  assigned_to_id TEXT,
  assigned_to_name TEXT,
  troop_group TEXT,
  location TEXT,
  notes TEXT,
  created_by_id TEXT,
  created_by_name TEXT NOT NULL DEFAULT 'Staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS board_status TEXT,
  ADD COLUMN IF NOT EXISTS team TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
  ADD COLUMN IF NOT EXISTS troop_group TEXT;

-- 5. Scout Fera2 Default Leaders table (6 Fera2 -> Default Assigned Account)
CREATE TABLE IF NOT EXISTS public.scout_fera2_leaders (
  fare2_id TEXT PRIMARY KEY,
  leader_user_id TEXT NOT NULL,
  leader_user_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Others Category Folders table
CREATE TABLE IF NOT EXISTS public.others_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Helpful performance indexes for Teams, Scout Fera2 & Assignments
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_fare2 ON public.bookings (assigned_fare2);
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_to_id ON public.bookings (assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_team ON public.calendar_events (team);
CREATE INDEX IF NOT EXISTS idx_calendar_events_troop_group ON public.calendar_events (troop_group);
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_to_id ON public.calendar_events (assigned_to_id);

-- 8. Row Level Security & Policies (safe to re-run)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_fera2_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.others_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE TO anon, authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;

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
  IF v_raw = '' THEN RETURN; END IF;
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
     OR (p.username IS NOT NULL AND BTRIM(p.username) <> '' AND LOWER(BTRIM(p.username)) = v_user)
     OR (
       v_norm_phone <> '' AND p.phone IS NOT NULL AND (
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

DROP POLICY IF EXISTS "Allow public all access on calendar_events" ON public.calendar_events;
CREATE POLICY "Allow public all access on calendar_events" ON public.calendar_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access on scout_fera2_leaders" ON public.scout_fera2_leaders;
CREATE POLICY "Allow public all access on scout_fera2_leaders" ON public.scout_fera2_leaders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access on others_folders" ON public.others_folders;
CREATE POLICY "Allow public all access on others_folders" ON public.others_folders FOR ALL USING (true) WITH CHECK (true);`;

  const fullSchemaSql = `-- ==============================================================================
-- WEARHOUSE APPAREL INVENTORY - SUPABASE & POSTGRESQL PRODUCTION SCHEMA
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
CREATE TYPE user_role AS ENUM ('full_admin', 'admin', 'worker', 'leader');
CREATE TYPE user_status AS ENUM ('active', 'pending', 'rejected');
CREATE TYPE target_audience AS ENUM ('Men', 'Women', 'Kids', 'Unisex');
CREATE TYPE adjustment_status AS ENUM ('pending', 'approved', 'rejected');

-- 1. CATEGORIES TABLE
CREATE TABLE public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PROFILES & AUTH WITH PENDING APPROVAL + TEAM & FERA2 ASSIGNMENTS
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    phone TEXT,
    password_hash TEXT,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'worker',
    status user_status NOT NULL DEFAULT 'pending',
    requested_role user_role NOT NULL DEFAULT 'worker',
    employee_id TEXT,
    avatar_color TEXT DEFAULT '#d97706',
    assigned_teams JSONB NOT NULL DEFAULT '[]'::jsonb,
    assigned_fare2 JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id),
    approved_by_name TEXT
);

-- PRODUCTS CATALOG (Connected to categories via category_id FK)
CREATE TABLE public.products (
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
    folder TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OTHERS CATEGORY FOLDERS, SUB-FOLDERS & SUB-SUB-FOLDERS
CREATE TABLE IF NOT EXISTS public.others_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRODUCT VARIANTS (SIZES & COLORS)
CREATE TABLE public.product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    sku TEXT UNIQUE NOT NULL,
    min_threshold INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ADJUSTMENT REQUESTS (WORKER COUNT CHANGES REQUIRING ADMIN APPROVAL)
CREATE TABLE public.adjustment_requests (
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

-- AUDIT TRAIL
CREATE TABLE public.stock_audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role user_role NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT
);

-- 6. CLIENT BOOKINGS (BULK ORDERS, SCOUT FERA2 ROUTING & ADVANCE PAYMENT WORKFLOW)
CREATE TABLE public.bookings (
    id TEXT PRIMARY KEY,
    booking_number TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    troop_group TEXT,
    assigned_fare2 TEXT,
    assigned_to_id TEXT,
    assigned_to_name TEXT,
    client_phone TEXT NOT NULL DEFAULT 'N/A',
    notes TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    deposit_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.50,
    deposit_percentage INTEGER NOT NULL DEFAULT 50, -- 50%, 70%, 100% upfront
    pending_deposit_percentage INTEGER, -- staff requested percentage awaiting admin approval
    pending_deposit_percentage_by TEXT,
    pending_deposit_percentage_at TIMESTAMPTZ,
    deposit_required NUMERIC(12, 2) NOT NULL DEFAULT 0,
    deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
    deposit_paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    deposit_paid_at TIMESTAMPTZ,
    final_paid_amount NUMERIC(12, 2) DEFAULT 0,
    final_paid_at TIMESTAMPTZ,
    payment_verification_requested BOOLEAN NOT NULL DEFAULT FALSE,
    payment_verification_requested_by TEXT,
    payment_verification_requested_at TIMESTAMPTZ,
    payment_verification_note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'delivered', 'done')),
    inventory_deducted BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id TEXT NOT NULL,
    created_by_name TEXT NOT NULL,
    created_by_role TEXT NOT NULL DEFAULT 'worker',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. BOOKING ITEMS (LINE ITEMS WITH DEFICIT & QUOTA)
CREATE TABLE public.booking_items (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    product_sku TEXT NOT NULL,
    product_image TEXT,
    variant_id TEXT NOT NULL,
    size TEXT NOT NULL,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    available_stock INTEGER NOT NULL DEFAULT 0,
    deficit_quantity INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 5,
    recommended_production INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. STORE CALENDAR EVENTS & TEAM BOARD TASKS
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'event' CHECK (item_type IN ('event', 'task')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TEXT,
    end_time TEXT,
    all_day BOOLEAN NOT NULL DEFAULT FALSE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    board_status TEXT,
    team TEXT,
    assigned_to_id TEXT,
    assigned_to_name TEXT,
    troop_group TEXT,
    location TEXT,
    notes TEXT,
    created_by_id TEXT,
    created_by_name TEXT NOT NULL DEFAULT 'Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. SCOUT FERA2 LEADERS (DEFAULT OWNER FOR EACH OF THE 6 FERA2)
CREATE TABLE IF NOT EXISTS public.scout_fera2_leaders (
    fare2_id TEXT PRIMARY KEY,
    leader_user_id TEXT NOT NULL,
    leader_user_name TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.others_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_fera2_leaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all access on categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on product_variants" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on adjustment_requests" ON public.adjustment_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on stock_audit_logs" ON public.stock_audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on booking_items" ON public.booking_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on others_folders" ON public.others_folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on calendar_events" ON public.calendar_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on scout_fera2_leaders" ON public.scout_fera2_leaders FOR ALL USING (true) WITH CHECK (true);`;

  const sqlContent = activeTab === 'migration' ? migrationSql : fullSchemaSql;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const blob = new Blob([sqlContent], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab === 'migration' ? 'supabase_migration_update.sql' : 'supabase_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Supabase &amp; PostgreSQL Database SQL
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Run the Migration SQL on an existing database, or Full Schema for a fresh setup
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs + Instructions banner */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-xs">
              <button
                type="button"
                onClick={() => setActiveTab('migration')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'migration'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Update Migration SQL (Existing DB)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('full')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'full'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Full Fresh Schema</span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-100 shadow-sm transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download .sql</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Terminal className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {activeTab === 'migration'
                ? 'Safe to run on your live Supabase database: adds Team/Scout Fera2 columns on profiles & bookings, creates scout_fera2_leaders & calendar_events if missing.'
                : 'Complete schema for setting up a brand new Supabase database from scratch.'}
            </span>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-950 font-mono text-xs text-slate-200 leading-relaxed max-h-[60vh]">
          <pre className="whitespace-pre-wrap">{sqlContent}</pre>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {activeTab === 'migration' ? 'Incremental Supabase migration script' : 'Full PostgreSQL schema'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
