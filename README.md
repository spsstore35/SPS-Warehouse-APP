# 📦 SPS Apparel Warehouse Management System

A high-performance, real-time apparel inventory and warehouse management system built with **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Supabase (PostgreSQL)**.

Designed for apparel and uniform distribution facilities, SPS Warehouse provides multi-photo framing and cropping, garment size-and-color matrix stock tracking, dual-tier role workflows (Admin vs. Floor Staff), approval queues, and complete day-by-day audit traceability.

---

## 🌟 Key Features

### 1. Garment Catalog & Matrix Inventory
- **Variant Grid**: Manage stock per size (XS, S, M, L, XL, 2XL, 3XL, 4XL) and color with dedicated SKU tracking.
- **Multi-Photo Support**: Upload multiple high-resolution photos per garment, designate cover images, and reorder galleries.
- **Frame & Crop Studio**: In-app framing and cropping with standard aspect ratios:
  - `Square (1:1)`
  - `Apparel (4:5)`
  - `Wide (4:3)`
  - Zoom sliders, pan repositioning, and 90° rotation.
- **Glassy Photo Viewer**: Translucent navigation arrows on garment photos for swift previewing across image sets.
- **Target Audience Filter**: Instant categorization for **Men**, **Women**, **Kids**, and **Unisex**.
- **Dynamic Categories**: Fully customizable category taxonomy with seamless product reassignment.

---

### 2. Dual-Tier Roles & Approval Queues

| Feature | Floor Staff | Admin Authority |
|---|---|---|
| **Browse Inventory** | ✅ View active & pending items | ✅ Full view & editing |
| **Direct Stock Adjustment** | ❌ (Submit adjustment request) | ✅ Immediate real-time update |
| **Add New Garments** | ✅ (Saved as *Pending Approval*) | ✅ Immediate live activation |
| **Approve Garment Submissions** | ❌ | ✅ 1-Click approval & publish |
| **Review Stock Adjustment Requests** | ❌ | ✅ Approve / Reject with notes |
| **Authorize Staff Registrations** | ❌ | ✅ Approve pending staff accounts |
| **Catalog Deletion** | ❌ | ✅ Delete items, sizes, categories, accounts |

---

### 3. Day-by-Day Inventory Audit Log
- **Daily View Navigation**: Browse stock changes day by day using `[< Prev Day]` and `[Next Day >]` controls.
- **Calendar Date Picker**: Select any historical date to inspect stock events recorded on that day.
- **Activity Counter**: Visual indicators showing total activities recorded per day.
- **Detailed Activity Modal**: Inspect granular breakdowns including garment thumbnail, exact delta (`e.g., Medium from 0 → 10 units (+10)`), actor authority, and timestamp.
- **Action Filters**: Filter by *Direct Adjustments*, *Approved Requests*, *Catalog Additions*, or *All Types*.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL 15+)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Motion](https://motion.dev/)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)
- A free [Supabase](https://supabase.com/) project

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/sps-warehouse.git
cd sps-warehouse
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## 🗄️ Database Architecture & Schema

Execute the following SQL in your **Supabase SQL Editor** to establish the database schema, foreign key cascade rules, and Row Level Security (RLS) policies.

```sql
-- Enable UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. User Profiles & Staff Registrations
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'worker',
    status TEXT NOT NULL DEFAULT 'pending',
    requested_role TEXT NOT NULL DEFAULT 'worker',
    employee_id TEXT,
    avatar_color TEXT DEFAULT '#d97706',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by_name TEXT
);

-- 3. Products Catalog Table
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    category TEXT,
    target_audience TEXT NOT NULL DEFAULT 'Unisex',
    description TEXT,
    fabric_details TEXT,
    price NUMERIC(10, 2),
    image_url TEXT,
    approval_status TEXT NOT NULL DEFAULT 'approved',
    created_by_worker_id TEXT,
    created_by_worker_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Product Variants (Size & Color Matrix)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    sku TEXT NOT NULL,
    min_threshold INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_prod_size_color UNIQUE (product_id, size, color_name)
);

-- 5. Adjustment Requests (Staff Queue)
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
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    admin_id TEXT,
    admin_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- 6. Stock Audit & Traceability Logs
CREATE TABLE IF NOT EXISTS public.stock_audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT
);

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.adjustment_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.stock_audit_logs(timestamp DESC);

-- 8. Row Level Security (RLS) Configuration
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow insert categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update categories" ON public.categories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete categories" ON public.categories FOR DELETE USING (true);

CREATE POLICY "Allow select products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update products" ON public.products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete products" ON public.products FOR DELETE USING (true);

CREATE POLICY "Allow select product_variants" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Allow insert product_variants" ON public.product_variants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update product_variants" ON public.product_variants FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete product_variants" ON public.product_variants FOR DELETE USING (true);

CREATE POLICY "Allow select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update profiles" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete profiles" ON public.profiles FOR DELETE USING (true);

CREATE POLICY "Allow select adjustment_requests" ON public.adjustment_requests FOR SELECT USING (true);
CREATE POLICY "Allow insert adjustment_requests" ON public.adjustment_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update adjustment_requests" ON public.adjustment_requests FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete adjustment_requests" ON public.adjustment_requests FOR DELETE USING (true);

CREATE POLICY "Allow select stock_audit_logs" ON public.stock_audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert stock_audit_logs" ON public.stock_audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update stock_audit_logs" ON public.stock_audit_logs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete stock_audit_logs" ON public.stock_audit_logs FOR DELETE USING (true);
```

---

## 🔒 Security & Safe Deletions

1. **Foreign Key Protection**: Deleting a product automatically cascades and cleans up associated size/color variants and adjustment requests.
2. **Audit Retention**: When a garment or category is removed, historical logs remain safely preserved (`ON DELETE SET NULL`).
3. **Admin Exclusivity**: Deletion confirmation dialogs (with red `Yes, Delete` action buttons) are strictly reserved for Admin accounts.
4. **Registration Gate**: Floor Staff signups default to `pending` status until verified by an Admin from the Staff Accounts view.

---

## 📁 Project Structure

```text
├── src/
│   ├── components/
│   │   ├── ActivityDetailModal.tsx     # Granular stock audit inspection
│   │   ├── AddProductModal.tsx         # Garment creation + matrix builder
│   │   ├── AuditLogView.tsx            # Day-by-day audit history with date picker
│   │   ├── AuthModal.tsx               # Login & Register modal
│   │   ├── CategoryManagerModal.tsx    # Category taxonomy management
│   │   ├── ImageCropperModal.tsx       # 1:1, 4:5, 4:3 photo framing studio
│   │   ├── Navigation.tsx              # Top navigation header & role indicators
│   │   ├── ProductCard.tsx             # Catalog garment display & quick actions
│   │   ├── ProductDetailModal.tsx      # Size & color matrix inventory manager
│   │   ├── RequestsQueueView.tsx       # Staff adjustment approval queue
│   │   ├── StockAdjustmentModal.tsx    # Single variant adjustment modal
│   │   └── UserManagementView.tsx      # Admin staff approvals & authorizations
│   ├── services/
│   │   ├── supabaseClient.ts           # Supabase client singleton
│   │   └── supabaseService.ts          # CRUD queries & data sync layer
│   ├── types/
│   │   └── inventory.ts                # TypeScript domain models & interfaces
│   ├── App.tsx                         # Root application state & router
│   ├── main.tsx                        # Application mount point
│   └── index.css                       # Tailwind CSS v4 directives
├── supabase_schema.sql                 # Base Supabase PostgreSQL DDL
├── fix_supabase_rls_and_columns.sql    # Migration & cascade fix script
└── package.json                        # Scripts & project dependencies
```

---

## 📄 License
This project is proprietary and built for SPS Warehouse operations.
