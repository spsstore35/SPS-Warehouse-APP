import React, { useState } from 'react';
import { X, Copy, Check, Download, Database, ExternalLink, Terminal } from 'lucide-react';

interface SqlSchemaViewerModalProps {
  onClose: () => void;
}

export const SqlSchemaViewerModal: React.FC<SqlSchemaViewerModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);

  // Read or provide full SQL script
  const sqlContent = `-- ==============================================================================
-- WEARHOUSE APPAREL INVENTORY - SUPABASE & POSTGRESQL PRODUCTION SCHEMA
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'worker');
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

-- PROFILES & AUTH WITH PENDING APPROVAL
CREATE TABLE public.profiles (
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
    approved_by UUID REFERENCES public.profiles(id)
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all access on categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on product_variants" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on adjustment_requests" ON public.adjustment_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on stock_audit_logs" ON public.stock_audit_logs FOR ALL USING (true) WITH CHECK (true);

-- SEED DATA (ADMIN, WORKERS, CLOTHING ITEMS & VARIANTS)
INSERT INTO public.profiles (email, password_hash, full_name, role, status, requested_role, employee_id)
VALUES 
  ('admin@wearhouse.com', crypt('admin123', gen_salt('bf')), 'Admin Boss (Owner)', 'admin', 'active', 'admin', 'WH-ADM-01'),
  ('karim@wearhouse.com', crypt('worker123', gen_salt('bf')), 'Karim (Floor Lead)', 'worker', 'active', 'worker', 'WH-FLR-08'),
  ('amr@wearhouse.com', crypt('worker123', gen_salt('bf')), 'Amr (Inventory Specialist)', 'worker', 'active', 'worker', 'WH-FLR-14'),
  ('tarek@wearhouse.com', crypt('pass123', gen_salt('bf')), 'Tarek Fathy', 'worker', 'pending', 'worker', 'WH-PEND-01');

INSERT INTO public.products (id, sku, name, category, target_audience, description, fabric_details, price)
VALUES
  ('prod_hoodie_01', 'WH-HD-450', 'Heavyweight Boxy Hoodie 450 GSM', 'Hoodies & Sweatshirts', 'Unisex', '450 GSM ultra-heavy French Terry cotton with relaxed drop-shoulder cut.', '100% French Terry Cotton', 38.00),
  ('prod_tee_02', 'WH-TS-220', 'Drop-Shoulder Vintage Washed Tee', 'T-Shirts & Tops', 'Men', '220 GSM heavyweight combed organic cotton.', '100% Organic Combed Cotton', 18.00),
  ('prod_jeans_03', 'WH-JN-014', 'Raw Selvedge Relaxed Denim Jeans', 'Pants & Jeans', 'Men', '14oz rigid red-line selvedge denim woven on vintage shuttle looms.', '14oz 100% Cotton Raw Indigo Denim', 45.00),
  ('prod_bomber_04', 'WH-JK-808', 'Water-Resistant Technical Bomber', 'Jackets & Outerwear', 'Unisex', 'Flight jacket cut from durable matte DWR nylon shell.', 'Matte DWR Nylon', 55.00),
  ('prod_pants_05', 'WH-PT-380', 'Heavy French Terry Cuffed Sweatpants', 'Pants & Jeans', 'Women', '380 GSM fleece lounge sweatpants.', '380 GSM 100% Cotton French Terry', 28.00),
  ('prod_kids_06', 'WH-KD-102', 'Kids Everyday Raglan Fleece Crew', 'Hoodies & Sweatshirts', 'Kids', '300 GSM ultra-soft brushed fleece pullover.', '80% Cotton / 20% Poly Fleece', 22.00);`;

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
    a.download = 'supabase_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Supabase & PostgreSQL Database SQL Schema
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Complete database tables, RLS policies, and seed data for Supabase
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

        {/* Instructions banner */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Copy and run this in your <strong>Supabase SQL Editor</strong> to deploy all tables, roles, and initial products.
            </span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
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

        {/* Code Content */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-950 font-mono text-xs text-slate-200 leading-relaxed max-h-[60vh]">
          <pre className="whitespace-pre-wrap">{sqlContent}</pre>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Saved to root project as <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800">supabase_schema.sql</code>
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
