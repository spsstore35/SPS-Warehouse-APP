import { Product, AdjustmentRequest, AuditLogEntry, User, Category } from '../types/inventory';
import { getApparelCategoryFallback } from '../utils/imageCompressor';

// Initial Categories for the dedicated categories table & catalog
export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat_tshirts', name: 'T-Shirts & Tops', description: 'T-shirts, polos, tank tops, and casual tops', displayOrder: 1 },
  { id: 'cat_hoodies', name: 'Hoodies & Sweatshirts', description: 'Pullover hoodies, zip-ups, crewnecks, and fleeces', displayOrder: 2 },
  { id: 'cat_pants', name: 'Pants & Jeans', description: 'Denim, trousers, sweatpants, and cargos', displayOrder: 3 },
  { id: 'cat_jackets', name: 'Jackets & Outerwear', description: 'Coats, windbreakers, varsity jackets, and parkas', displayOrder: 4 },
  { id: 'cat_shorts', name: 'Shorts & Swim', description: 'Casual shorts, athletic shorts, and swim trunks', displayOrder: 5 },
  { id: 'cat_knitwear', name: 'Knitwear & Sweaters', description: 'Cardigans, cable knits, and fine wool sweaters', displayOrder: 6 },
  { id: 'cat_activewear', name: 'Activewear', description: 'Gym apparel, running gear, and technical garments', displayOrder: 7 },
  { id: 'cat_accessories', name: 'Accessories', description: 'Caps, beanies, socks, and apparel accessories', displayOrder: 8 },
];

// Initial Users - Only active admin account for fallback if offline
export const INITIAL_USERS: User[] = [
  {
    id: 'user_admin_01',
    name: 'Admin Boss (Owner)',
    role: 'admin',
    email: 'admin@wearhouse.com',
    password: 'admin123',
    status: 'active',
    requestedRole: 'admin',
    employeeId: 'WH-ADM-01',
    avatarColor: '#d97706',
    createdAt: new Date().toISOString(),
  },
];

// Completely clean empty states - All mockup data removed as requested!
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_REQUESTS: AdjustmentRequest[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

// Template garments available if user clicks "Seed Initial Catalog into Supabase"
export const SEED_CATALOG_DATA: Product[] = [
  {
    id: 'prod_tshirt_class_b',
    sku: 'SPS-TS-01',
    name: 'T-Shirt Class B (تيشيرت كشفي)',
    category: 'T-Shirts & Tops',
    targetAudience: 'Unisex',
    description: 'Official Saint Paul Scouts Class B activity t-shirt. High-durability combed cotton with embroidered scout lily emblem.',
    fabricDetails: '100% Combed Cotton 220 GSM, Anti-shrinkage',
    price: 250,
    image: getApparelCategoryFallback('T-Shirt', '#3f4f24', 'T-Shirt Class B'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      { id: 'v_ts_olv_s', size: 'S', colorName: 'Forest Olive', colorHex: '#4a5d23', quantity: 18, sku: 'SPS-TS-OLV-S', minThreshold: 10 },
      { id: 'v_ts_olv_m', size: 'M', colorName: 'Forest Olive', colorHex: '#4a5d23', quantity: 24, sku: 'SPS-TS-OLV-M', minThreshold: 12 },
      { id: 'v_ts_olv_l', size: 'L', colorName: 'Forest Olive', colorHex: '#4a5d23', quantity: 30, sku: 'SPS-TS-OLV-L', minThreshold: 12 },
      { id: 'v_ts_olv_xl', size: 'XL', colorName: 'Forest Olive', colorHex: '#4a5d23', quantity: 15, sku: 'SPS-TS-OLV-XL', minThreshold: 8 },
    ],
    totalQuantity: 87,
  },
  {
    id: 'prod_scout_shirt_amees',
    sku: 'SPS-SH-02',
    name: 'Scout Shirt - Amees (قميص كشفي رسمي)',
    category: 'T-Shirts & Tops',
    targetAudience: 'Unisex',
    description: 'Official Saint Paul Scouts uniform shirt (Amees) with front chest utility pockets, epaulets, and reinforced seams for badges.',
    fabricDetails: 'Durable Poly-Cotton Twill, Crease-resistant',
    price: 280,
    image: getApparelCategoryFallback('Shirt', '#d4a373', 'Official Scout Shirt Amees'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      { id: 'v_sh_khk_s', size: 'S', colorName: 'Khaki Beige', colorHex: '#c2a677', quantity: 20, sku: 'SPS-SH-KHK-S', minThreshold: 8 },
      { id: 'v_sh_khk_m', size: 'M', colorName: 'Khaki Beige', colorHex: '#c2a677', quantity: 35, sku: 'SPS-SH-KHK-M', minThreshold: 15 },
      { id: 'v_sh_khk_l', size: 'L', colorName: 'Khaki Beige', colorHex: '#c2a677', quantity: 28, sku: 'SPS-SH-KHK-L', minThreshold: 12 },
      { id: 'v_sh_khk_xl', size: 'XL', colorName: 'Khaki Beige', colorHex: '#c2a677', quantity: 14, sku: 'SPS-SH-KHK-XL', minThreshold: 6 },
    ],
    totalQuantity: 97,
  },
  {
    id: 'prod_hoodie_01',
    sku: 'SPS-HD-03',
    name: 'Scout Winter Heavyweight Hoodie 450 GSM',
    category: 'Hoodies & Sweatshirts',
    targetAudience: 'Unisex',
    description: '450 GSM ultra-heavy French Terry cotton with embroidered Saint Paul Scouts emblem on chest.',
    fabricDetails: '100% French Terry Cotton, Pre-shrunk, Anti-pilling',
    price: 450,
    image: getApparelCategoryFallback('Hoodie', '#18181b', 'Scout Winter Hoodie'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      { id: 'v_hd_blk_s', size: 'S', colorName: 'Pitch Black', colorHex: '#18181b', quantity: 16, sku: 'SPS-HD-BLK-S', minThreshold: 8 },
      { id: 'v_hd_blk_m', size: 'M', colorName: 'Pitch Black', colorHex: '#18181b', quantity: 25, sku: 'SPS-HD-BLK-M', minThreshold: 10 },
      { id: 'v_hd_blk_l', size: 'L', colorName: 'Pitch Black', colorHex: '#18181b', quantity: 20, sku: 'SPS-HD-BLK-L', minThreshold: 10 },
      { id: 'v_hd_blk_xl', size: 'XL', colorName: 'Pitch Black', colorHex: '#18181b', quantity: 12, sku: 'SPS-HD-BLK-XL', minThreshold: 5 },
    ],
    totalQuantity: 73,
  },
];
