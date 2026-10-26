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
    id: 'prod_hoodie_01',
    sku: 'WH-HD-450',
    name: 'Heavyweight Boxy Hoodie 450 GSM',
    category: 'Hoodies & Sweatshirts',
    targetAudience: 'Unisex',
    description: '450 GSM ultra-heavy French Terry cotton with relaxed drop-shoulder cut, double-layered hood without drawstrings, and kangaroo front pouch.',
    fabricDetails: '100% French Terry Cotton, Pre-shrunk, Anti-pilling finish',
    price: 38,
    image: getApparelCategoryFallback('Hoodie', '#18181b', 'Heavyweight Boxy Hoodie'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      { id: 'v_hd_blk_s', size: 'S', colorName: 'Pitch Black', colorHex: '#18181b', quantity: 24, sku: 'WH-HD-450-BLK-S', minThreshold: 10 },
      { id: 'v_hd_blk_m', size: 'M', colorName: 'Pitch Black', colorHex: '#18181b', quantity: 38, sku: 'WH-HD-450-BLK-M', minThreshold: 15 },
      { id: 'v_hd_blk_l', size: 'L', colorName: 'Pitch Black', colorHex: '#18181b', quantity: 32, sku: 'WH-HD-450-BLK-L', minThreshold: 15 },
      { id: 'v_hd_blk_xl', size: 'XL', colorName: 'Pitch Black', colorHex: '#18181b', quantity: 20, sku: 'WH-HD-450-BLK-XL', minThreshold: 8 },
    ],
    totalQuantity: 114,
  },
  {
    id: 'prod_tee_02',
    sku: 'WH-TS-220',
    name: 'Drop-Shoulder Vintage Washed Tee',
    category: 'T-Shirts & Tops',
    targetAudience: 'Men',
    description: '220 GSM heavyweight combed organic cotton. Features enzyme garment wash, ribbed collar band, and a wide boxy streetwear drape.',
    fabricDetails: '100% Organic Combed Cotton, Enzyme Washed',
    price: 18,
    image: getApparelCategoryFallback('T-Shirt', '#27272a', 'Vintage Washed Tee'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      { id: 'v_ts_bon_s', size: 'S', colorName: 'Bone White', colorHex: '#f4f4f5', quantity: 30, sku: 'WH-TS-220-BON-S', minThreshold: 15 },
      { id: 'v_ts_bon_m', size: 'M', colorName: 'Bone White', colorHex: '#f4f4f5', quantity: 45, sku: 'WH-TS-220-BON-M', minThreshold: 20 },
      { id: 'v_ts_bon_l', size: 'L', colorName: 'Bone White', colorHex: '#f4f4f5', quantity: 40, sku: 'WH-TS-220-BON-L', minThreshold: 20 },
    ],
    totalQuantity: 115,
  },
  {
    id: 'prod_jeans_03',
    sku: 'WH-JN-014',
    name: 'Raw Selvedge Relaxed Denim Jeans',
    category: 'Pants & Jeans',
    targetAudience: 'Men',
    description: '14oz rigid red-line selvedge denim woven on vintage shuttle looms. Mid-rise with relaxed straight leg, copper rivets, and leather back patch.',
    fabricDetails: '14oz 100% Cotton Raw Indigo Denim, Red-line ID',
    price: 45,
    image: getApparelCategoryFallback('Jeans', '#1e293b', 'Selvedge Denim Jeans'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      { id: 'v_jn_raw_s', size: 'S', colorName: 'Deep Raw Indigo', colorHex: '#1e293b', quantity: 15, sku: 'WH-JN-014-RAW-S', minThreshold: 8 },
      { id: 'v_jn_raw_m', size: 'M', colorName: 'Deep Raw Indigo', colorHex: '#1e293b', quantity: 28, sku: 'WH-JN-014-RAW-M', minThreshold: 10 },
      { id: 'v_jn_raw_l', size: 'L', colorName: 'Deep Raw Indigo', colorHex: '#1e293b', quantity: 25, sku: 'WH-JN-014-RAW-L', minThreshold: 10 },
    ],
    totalQuantity: 68,
  },
];
