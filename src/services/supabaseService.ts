import { supabase } from './supabaseClient';
import { normalizeRole } from '../utils/security';
import {
  Product,
  ProductVariant,
  AdjustmentRequest,
  AuditLogEntry,
  User,
  Role,
  UserStatus,
  GarmentSize,
  TargetAudience,
  GarmentCategory,
  AdjustmentReason,
  Category,
  Booking,
  BookingItem,
  BookingStatus,
  CalendarItem,
  StoreTeamId,
  Vendor,
  ProductWorkflow,
  ProductStageVendor,
  VendorPriceEntry,
  ProductionBatch,
  OperationStageKey,
  VendorBehaviorTag,
  BookingStockCheckStatus,
  MarketingOffer,
  ProductBudgetProfile,
  BudgetExpenseEntry,
  BudgetExpenseCategory,
  BudgetSettings,
  ScoutSeason,
} from '../types/inventory';

export interface DbConnectionStatus {
  connected: boolean;
  tablesExist: boolean;
  error?: string;
}

/**
 * Paginate through all rows in a Supabase table in batches of 1,000 so large
 * inventories (>1,000 variants / >10,000 units), logs, or bookings are never truncated.
 */
async function fetchAllRows<T = any>(
  table: string,
  options?: {
    select?: string;
    orderColumn?: string;
    ascending?: boolean;
  }
): Promise<{ data: T[]; error: any }> {
  const pageSize = 1000;
  let from = 0;
  const allRows: T[] = [];
  const selectCols = options?.select || '*';

  while (true) {
    let query = supabase.from(table).select(selectCols);
    if (options?.orderColumn) {
      query = query.order(options.orderColumn, { ascending: options.ascending ?? true });
      if (options.orderColumn !== 'id') {
        query = query.order('id', { ascending: true });
      }
    } else {
      query = query.order('id', { ascending: true });
    }

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      return { data: allRows, error };
    }
    if (!data || data.length === 0) {
      break;
    }
    allRows.push(...(data as T[]));
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return { data: allRows, error: null };
}

/**
 * Test connectivity to Supabase and check if tables are created
 */
export async function checkSupabaseConnection(): Promise<DbConnectionStatus> {
  try {
    const { data, error } = await supabase.from('products').select('id').limit(1);

    if (error) {
      // Code 42P01 means relation does not exist (table not created yet)
      if (error.code === '42P01' || error.message.includes('relation "public.products" does not exist')) {
        return { connected: true, tablesExist: false, error: 'Tables not created yet. Please execute the SQL migration script in your Supabase SQL Editor.' };
      }
      if (error.message?.includes('exceed_egress_quota')) {
        return {
          connected: false,
          tablesExist: false,
          error: 'Supabase project is restricted (exceed_egress_quota). In Supabase Dashboard → Organization Billing, upgrade plan / remove spend cap or connect a new Supabase project.',
        };
      }
      return { connected: false, tablesExist: false, error: error.message };
    }

    return { connected: true, tablesExist: true };
  } catch (err: any) {
    return { connected: false, tablesExist: false, error: err?.message || 'Network error connecting to Supabase' };
  }
}

/**
 * CATEGORIES (Dedicated SQL Table & Foreign Key connected to Products)
 */
export async function fetchCategoriesFromDb(): Promise<Category[]> {
  try {
    const { data, error } = await fetchAllRows('categories', {
      orderColumn: 'display_order',
      ascending: true,
    });

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      description: d.description || '',
      displayOrder: d.display_order ?? 0,
      createdAt: d.created_at,
    }));
  } catch (err) {
    console.warn('Error fetching categories from DB:', err);
    return [];
  }
}

export async function createCategoryInDb(category: {
  id: string;
  name: string;
  description?: string;
  displayOrder?: number;
}): Promise<Category> {
  const payload = {
    id: category.id,
    name: category.name.trim(),
    description: category.description?.trim() || null,
    display_order: category.displayOrder ?? 0,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('categories').upsert(payload);
  if (error) throw error;

  return {
    id: payload.id,
    name: payload.name,
    description: payload.description || undefined,
    displayOrder: payload.display_order,
    createdAt: payload.created_at,
  };
}

export async function deleteCategoryFromDb(categoryId: string): Promise<void> {
  // 1. Proactively set category_id to NULL on any products referencing this category
  // This ensures foreign key constraints succeed even before the user applies ON DELETE SET NULL
  try {
    const { error: unassignError } = await supabase
      .from('products')
      .update({ category_id: null })
      .eq('category_id', categoryId);

    if (unassignError) {
      console.warn('Notice when unassigning category from products:', unassignError.message);
    }
  } catch (err) {
    console.warn('Could not unassign products before deleting category:', err);
  }

  // 2. Delete the category record
  const { error } = await supabase.from('categories').delete().eq('id', categoryId);
  if (error) throw error;
}

/**
 * TARGET AUDIENCES (Dedicated SQL Table)
 */
export async function fetchTargetAudiencesFromDb(): Promise<{ id: string; name: string }[]> {
  try {
    const { data, error } = await supabase
      .from('target_audiences')
      .select('id, name')
      .order('display_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
    }));
  } catch {
    return [];
  }
}

/**
 * Common category ID to Display Name resolution map
 */
export const CATEGORY_MAP: Record<string, string> = {
  cat_jackets: 'Jackets & Outerwear',
  cat_hoodies: 'Hoodies & Sweatshirts',
  cat_pants: 'Pants & Jeans',
  cat_tshirts: 'T-Shirts & Tops',
  cat_shorts: 'Shorts & Swim',
  cat_knitwear: 'Knitwear & Sweaters',
  cat_activewear: 'Activewear',
  cat_accessories: 'Accessories',
  jackets: 'Jackets & Outerwear',
  outerwear: 'Jackets & Outerwear',
  hoodies: 'Hoodies & Sweatshirts',
  pants: 'Pants & Jeans',
  jeans: 'Pants & Jeans',
  tshirts: 'T-Shirts & Tops',
  shorts: 'Shorts & Swim',
  knitwear: 'Knitwear & Sweaters',
  activewear: 'Activewear',
  accessories: 'Accessories',
};

/**
 * PRODUCTS & VARIANTS
 */

export async function fetchProductsFromDb(): Promise<Product[]> {
  const { data: productsData, error: prodError } = await fetchAllRows('products', {
    orderColumn: 'created_at',
    ascending: false,
  });

  if (prodError) throw prodError;
  if (!productsData || productsData.length === 0) return [];

  // Query categories table to map any custom category IDs dynamically
  const dynamicCatMap: Record<string, string> = { ...CATEGORY_MAP };
  try {
    const { data: dbCats } = await fetchAllRows('categories', { select: 'id, name' });
    if (dbCats && dbCats.length > 0) {
      dbCats.forEach((c: any) => {
        dynamicCatMap[c.id.toLowerCase()] = c.name;
        dynamicCatMap[c.name.toLowerCase()] = c.name;
      });
    }
  } catch (_e) {}

  const { data: variantsData, error: varError } = await fetchAllRows('product_variants');

  if (varError) throw varError;

  // Group variants by product_id
  const variantsByProdId: Record<string, ProductVariant[]> = {};
  (variantsData || []).forEach((v: any) => {
    if (!variantsByProdId[v.product_id]) {
      variantsByProdId[v.product_id] = [];
    }
    variantsByProdId[v.product_id].push({
      id: v.id,
      size: (v.size || 'One Size') as GarmentSize,
      colorName: v.color_name || 'Standard',
      colorHex: v.color_hex || '#94a3b8',
      quantity: Number(v.quantity) || 0,
      sku: v.sku,
      minThreshold:
        v.min_threshold !== null && v.min_threshold !== undefined
          ? Number(v.min_threshold)
          : undefined,
    });
  });

  return productsData.map((p: any) => {
    const rawVariants = variantsByProdId[p.id] || [];
    
    // Deduplicate variants in memory by size + colorName (keeping the latest one)
    const dedupedVariantsMap = new Map<string, ProductVariant>();
    rawVariants.forEach((v) => {
      const key = `${v.size}_${v.colorName}`.toLowerCase();
      // Keep or update to the one with non-zero stock if duplicate
      if (!dedupedVariantsMap.has(key) || v.quantity > 0) {
        dedupedVariantsMap.set(key, v);
      }
    });
    const variants = Array.from(dedupedVariantsMap.values());
    const totalQuantity = variants.reduce((sum, v) => sum + v.quantity, 0);

    // Resolve category name accurately:
    let resolvedCategory = p.category;
    const catId = p.category_id ? String(p.category_id).trim() : '';
    const catIdLower = catId.toLowerCase();

    if (!resolvedCategory || resolvedCategory === 'T-Shirts & Tops') {
      if (catIdLower && dynamicCatMap[catIdLower]) {
        resolvedCategory = dynamicCatMap[catIdLower];
      }
    }
    if (!resolvedCategory && catIdLower) {
      resolvedCategory = dynamicCatMap[catIdLower] || catId;
    }
    if (resolvedCategory && dynamicCatMap[resolvedCategory.toLowerCase()]) {
      resolvedCategory = dynamicCatMap[resolvedCategory.toLowerCase()];
    }
    if (!resolvedCategory) {
      resolvedCategory = 'Unassigned';
    }

    const resolvedAudience = p.target_audience || p.target_audience_id || 'Men';

    // Parse primary image and multi-image list
    let primaryImage = '';
    let imageList: string[] = [];
    if (p.image_url) {
      if (Array.isArray(p.image_url)) {
        imageList = p.image_url.filter(Boolean);
        primaryImage = imageList[0] || '';
      } else if (typeof p.image_url === 'string' && p.image_url.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(p.image_url);
          if (Array.isArray(parsed) && parsed.length > 0) {
            imageList = parsed.filter(Boolean);
            primaryImage = imageList[0] || '';
          }
        } catch {
          primaryImage = p.image_url;
          imageList = [p.image_url];
        }
      } else {
        primaryImage = p.image_url;
        imageList = [p.image_url];
      }
    }

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      categoryId: p.category_id || undefined,
      category: resolvedCategory as GarmentCategory,
      targetAudience: resolvedAudience as TargetAudience,
      description: p.description || '',
      fabricDetails: p.fabric_details || '',
      price: p.price ? Number(p.price) : undefined,
      image: primaryImage,
      images: imageList,
      variants,
      totalQuantity,
      folder: p.folder || undefined,
      status: (p.status as any) || 'active',
      createdByRole: p.created_by_role || undefined,
      createdByName: p.created_by_name || undefined,
      createdById: p.created_by_id || undefined,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });
}

/**
 * PRODUCT PHOTOS (Supabase Storage)
 *
 * Photos used to be saved as long base64 text inside products.image_url, so every
 * data load re-downloaded every photo. They are now uploaded once to the public
 * "product-images" storage bucket and only the short link is saved in the row.
 * File names are a hash of the photo, so browsers can cache them for a year.
 */
export const PRODUCT_IMAGES_BUCKET = 'product-images';

export function isInlineImage(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.startsWith('data:');
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/** Uploads an inline (data:) photo and returns its public link. Other values are returned unchanged. */
export async function uploadProductImage(image: string, productId: string): Promise<string> {
  if (!isInlineImage(image)) return image;
  const blob = await dataUrlToBlob(image);
  const contentType = blob.type || 'image/jpeg';
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const safeId = String(productId).replace(/[^A-Za-z0-9_-]/g, '_');
  const filePath = `products/${safeId}/${await sha256Hex(blob)}.${ext}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(filePath, blob, { contentType, cacheControl: '31536000', upsert: true });
  if (error) throw error;

  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(filePath).data.publicUrl;
}

/** Uploads every inline photo of a product. If an upload fails, that photo is kept inline so saving never breaks. */
async function uploadInlineProductImages(images: string[], productId: string): Promise<string[]> {
  return Promise.all(
    images.map(async (img) => {
      try {
        return await uploadProductImage(img, productId);
      } catch (err: any) {
        console.warn('Photo upload to storage failed, keeping inline copy:', err?.message || err);
        return img;
      }
    })
  );
}

export async function upsertProductToDb(product: Product): Promise<void> {
  // 1. Upsert product (photos are uploaded to storage first; only links are saved)
  const rawImages = product.images && product.images.length > 0
    ? product.images
    : product.image
    ? [product.image]
    : [];
  const imagesToStore = await uploadInlineProductImages(rawImages, product.id);

  const storedImageUrl = imagesToStore.length > 1
    ? JSON.stringify(imagesToStore)
    : (imagesToStore[0] || '');

  const productPayload: Record<string, any> = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category_id: product.categoryId || null,
    folder: product.folder || null,
    target_audience: product.targetAudience || 'Men',
    target_audience_id: product.targetAudience || 'Men',
    description: product.description || '',
    fabric_details: product.fabricDetails || null,
    price: product.price || null,
    image_url: storedImageUrl,
    status: product.status || 'active',
    created_by_role: product.createdByRole || null,
    created_by_name: product.createdByName || null,
    created_by_id: product.createdById || null,
    updated_at: new Date().toISOString(),
  };

  let { error: prodError } = await supabase.from('products').upsert(productPayload);

  // If remote schema does not have folder column yet, strip and retry cleanly
  if (
    prodError &&
    (prodError.message?.includes('folder') || prodError.details?.includes('folder'))
  ) {
    delete productPayload.folder;
    const retry = await supabase.from('products').upsert(productPayload);
    prodError = retry.error;
  }

  // If remote schema does not have status / created_by columns, strip and retry
  if (
    prodError &&
    (prodError.message?.includes('status') ||
      prodError.message?.includes('created_by') ||
      prodError.details?.includes('status') ||
      prodError.details?.includes('created_by'))
  ) {
    delete productPayload.status;
    delete productPayload.created_by_role;
    delete productPayload.created_by_name;
    delete productPayload.created_by_id;
    const retry = await supabase.from('products').upsert(productPayload);
    prodError = retry.error;
  }

  // If remote schema does not have category_id column (legacy flat schema), fallback to 'category' text column
  if (
    prodError &&
    (prodError.message?.includes('category_id') ||
      prodError.details?.includes('category_id') ||
      (prodError as any).code === 'PGRST204')
  ) {
    delete productPayload.category_id;
    productPayload.category = product.category || 'Accessories';
    const retry = await supabase.from('products').upsert(productPayload);
    prodError = retry.error;
  }

  // If remote schema fails because 'category' column is missing from schema cache, remove it
  if (
    prodError &&
    (prodError.message?.includes("'category'") ||
      prodError.details?.includes("'category'") ||
      prodError.message?.includes('category column'))
  ) {
    delete productPayload.category;
    const retry = await supabase.from('products').upsert(productPayload);
    prodError = retry.error;
  }

  // If remote schema has target_audience_id instead of target_audience
  if (
    prodError &&
    (prodError.message?.includes('target_audience') ||
      prodError.details?.includes('target_audience'))
  ) {
    delete productPayload.target_audience;
    productPayload.target_audience_id = product.targetAudience || 'Unisex';
    const retry = await supabase.from('products').upsert(productPayload);
    prodError = retry.error;
  }

  // If remote schema does not have target_audience_id either, remove it
  if (
    prodError &&
    (prodError.message?.includes('target_audience_id') ||
      prodError.details?.includes('target_audience_id'))
  ) {
    delete productPayload.target_audience_id;
    const retry = await supabase.from('products').upsert(productPayload);
    prodError = retry.error;
  }

  if (prodError) throw prodError;

  // 2. Upsert variants & Prune stale variants for this product to prevent duplicate rows
  if (product.variants && product.variants.length > 0) {
    // Deduplicate by size + colorName before sending to Supabase
    const dedupedVariantsMap = new Map<string, ProductVariant>();
    product.variants.forEach((v) => {
      const key = `${v.size}_${v.colorName}`.toLowerCase();
      dedupedVariantsMap.set(key, v);
    });
    const cleanVariants = Array.from(dedupedVariantsMap.values());

    const validVariantIds = cleanVariants.map((v) => v.id);

    // Prune stale variants in database that no longer match the product's variants
    try {
      if (validVariantIds.length > 0) {
        const { data: existingRows } = await supabase
          .from('product_variants')
          .select('id')
          .eq('product_id', product.id);

        if (existingRows && existingRows.length > 0) {
          const toDelete = existingRows
            .map((r) => r.id)
            .filter((id) => !validVariantIds.includes(id));

          for (let i = 0; i < toDelete.length; i += 500) {
            await supabase
              .from('product_variants')
              .delete()
              .in('id', toDelete.slice(i, i + 500));
          }
        }
      }
    } catch (pruneErr) {
      console.warn('Notice pruning stale variants:', pruneErr);
    }

    const variantRows = cleanVariants.map((v) => ({
      id: v.id,
      product_id: product.id,
      size: v.size,
      color_name: v.colorName,
      color_hex: v.colorHex,
      quantity: v.quantity,
      sku: v.sku,
      min_threshold:
        v.minThreshold !== undefined && v.minThreshold !== null && !isNaN(Number(v.minThreshold))
          ? Number(v.minThreshold)
          : null,
      updated_at: new Date().toISOString(),
    }));

    for (let i = 0; i < variantRows.length; i += 500) {
      const { error: varError } = await supabase
        .from('product_variants')
        .upsert(variantRows.slice(i, i + 500));

      if (varError) throw varError;
    }
  }
}

export async function deleteProductFromDb(productId: string): Promise<void> {
  // Cascades in Supabase, but we also proactively clean product_variants
  try {
    await supabase.from('product_variants').delete().eq('product_id', productId);
  } catch {}
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}

export async function deleteProductVariantFromDb(variantId: string): Promise<void> {
  const { error } = await supabase.from('product_variants').delete().eq('id', variantId);
  if (error) throw error;
}

export async function deleteUserFromDb(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
}

export async function updateVariantQuantityInDb(variantId: string, newQuantity: number): Promise<void> {
  const { error } = await supabase
    .from('product_variants')
    .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
    .eq('id', variantId);

  if (error) throw error;
}

/**
 * ADJUSTMENT REQUESTS
 */

export async function fetchAdjustmentRequestsFromDb(): Promise<AdjustmentRequest[]> {
  // Explicit columns: skips product_image (a full photo copy per row). The photo is
  // filled in from the product list in App.tsx instead of being downloaded again.
  const { data, error } = await fetchAllRows('adjustment_requests', {
    select:
      'id, product_id, product_name, variant_id, size, color_name, color_hex, current_quantity, requested_quantity, delta, reason, worker_note, worker_id, worker_name, status, admin_note, admin_id, admin_name, created_at, reviewed_at',
    orderColumn: 'created_at',
    ascending: false,
  });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map((r: any) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    productImage: r.product_image || '',
    variantId: r.variant_id,
    size: r.size as GarmentSize,
    colorName: r.color_name,
    colorHex: r.color_hex,
    currentQuantity: Number(r.current_quantity),
    requestedQuantity: Number(r.requested_quantity),
    delta: Number(r.delta),
    reason: r.reason as AdjustmentReason,
    workerNote: r.worker_note || '',
    workerId: r.worker_id,
    workerName: r.worker_name,
    status: r.status,
    adminNote: r.admin_note || '',
    adminId: r.admin_id || undefined,
    adminName: r.admin_name || undefined,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at || undefined,
  }));
}

export async function createAdjustmentRequestInDb(req: AdjustmentRequest): Promise<void> {
  const { error } = await supabase.from('adjustment_requests').insert({
    id: req.id,
    product_id: req.productId,
    product_name: req.productName,
    // Never store a second full copy of the photo; the app fills it in from the product.
    product_image: isInlineImage(req.productImage) ? null : req.productImage || null,
    variant_id: req.variantId,
    size: req.size,
    color_name: req.colorName,
    color_hex: req.colorHex,
    current_quantity: req.currentQuantity,
    requested_quantity: req.requestedQuantity,
    delta: req.delta,
    reason: req.reason,
    worker_note: req.workerNote || null,
    worker_id: req.workerId,
    worker_name: req.workerName,
    status: req.status,
    created_at: req.createdAt,
  });

  if (error) throw error;
}

export async function updateAdjustmentRequestInDb(
  requestId: string,
  status: 'approved' | 'rejected',
  adminUser?: User,
  adminNote?: string
): Promise<void> {
  const { error } = await supabase
    .from('adjustment_requests')
    .update({
      status,
      admin_note: adminNote || null,
      admin_id: adminUser?.id || null,
      admin_name: adminUser?.name || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) throw error;
}

/**
 * USERS & PROFILES (with Pending Admin Approval)
 */

export async function fetchUsersFromDb(): Promise<User[]> {
  const { data, error } = await fetchAllRows('profiles', {
    orderColumn: 'created_at',
    ascending: false,
  });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map((u: any) => {
    const normalizedRole: Role = normalizeRole(u.role || u.requested_role);
    const normalizedReqRole: Role = normalizeRole(u.requested_role || u.role);

    const parseStringArray = (val: any): string[] | undefined => {
      if (Array.isArray(val)) return val.map(String).filter(Boolean);
      return undefined;
    };

    return {
      id: u.id,
      name: u.full_name || u.name || 'User',
      email: u.email,
      password: u.password_plain || u.password_hash || undefined,
      role: normalizedRole,
      status: (u.status || 'active') as UserStatus,
      requestedRole: normalizedReqRole,
      employeeId: u.employee_id || undefined,
      avatarColor: u.avatar_color || undefined,
      assignedTeams: parseStringArray(u.assigned_teams) as StoreTeamId[] | undefined,
      assignedFare2: parseStringArray(u.assigned_fare2),
      createdAt: u.created_at,
      approvedAt: u.approved_at || undefined,
      approvedBy: u.approved_by_name || undefined,
    };
  });
}

export async function registerUserInDb(data: {
  name: string;
  email: string;
  password?: string;
  requestedRole: Role;
}): Promise<User> {
  // Generate a valid RFC4122 v4 UUID so PostgreSQL UUID primary key accepts it without syntax error (22P02)
  const validUuid = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

  const newUser: User = {
    id: validUuid,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.password || 'password123',
    role: data.requestedRole,
    requestedRole: data.requestedRole,
    status: 'pending', // Awaiting Admin Approval
    employeeId: `WH-REG-${Math.floor(100 + Math.random() * 900)}`,
    avatarColor:
      data.requestedRole === 'full_admin'
        ? '#b45309'
        : data.requestedRole === 'admin'
        ? '#d97706'
        : data.requestedRole === 'leader'
        ? '#059669'
        : '#0284c7',
    createdAt: new Date().toISOString(),
  };

  const { hashPassword } = await import('../utils/security');
  const securePasswordHash = await hashPassword(newUser.password || 'password123');

  const { error } = await supabase.from('profiles').insert({
    id: newUser.id,
    email: newUser.email,
    password_hash: securePasswordHash,
    full_name: newUser.name,
    role: newUser.role,
    status: newUser.status,
    requested_role: newUser.requestedRole,
    employee_id: newUser.employeeId,
    avatar_color: newUser.avatarColor,
    created_at: newUser.createdAt,
  });

  if (error) {
    if (error.message?.includes('enum user_role') || error.message?.includes('"leader"') || error.message?.includes('"full_admin"')) {
      throw new Error(
        `Database enum "user_role" must include 'leader' and 'full_admin'. Run: ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'leader'; ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'full_admin'; in Supabase SQL Editor.`
      );
    }
    throw error;
  }

  try {
    await insertAuditLogInDb({
      id: `audit-reg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      action: 'account_updated',
      actorName: newUser.name,
      actorRole: newUser.requestedRole === 'full_admin' ? 'admin' : newUser.requestedRole || 'worker',
      summary: `New account registration: "${newUser.name}" (${newUser.email}).`,
      details: `New staff member "${newUser.name}" (${newUser.email}) registered and requires administrator approval.`,
      reason: 'New Account Registration',
    });
  } catch {
    // Non-fatal if audit log logging fails
  }

  return newUser;
}

export async function updateUserStatusInDb(
  userId: string,
  status: 'active' | 'rejected',
  adminUser?: User
): Promise<void> {
  const updatePayload: Record<string, any> = {
    status,
    approved_at: status === 'active' ? new Date().toISOString() : null,
    approved_by_name: adminUser?.name || 'Admin',
  };

  let { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);

  // If approved_by_name column is not found in remote database, silently retry without it
  if (
    error &&
    (error.message?.includes('approved_by_name') ||
      error.details?.includes('approved_by_name') ||
      (error as any).code === 'PGRST204')
  ) {
    delete updatePayload.approved_by_name;
    const retry = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId);
    error = retry.error;
  }

  if (error) throw error;
}

export async function updateUserRoleInDb(
  userId: string,
  newRole: Role,
  _adminUser?: User
): Promise<void> {
  const avatarColor =
    newRole === 'full_admin'
      ? '#b45309'
      : newRole === 'admin'
      ? '#d97706'
      : newRole === 'leader'
      ? '#059669'
      : '#0284c7';

  const { error } = await supabase
    .from('profiles')
    .update({
      role: newRole,
      requested_role: newRole,
      avatar_color: avatarColor,
    })
    .eq('id', userId);

  if (error) {
    if (error.message?.includes('enum user_role') || error.message?.includes('"leader"') || error.message?.includes('"full_admin"')) {
      throw new Error(
        `Database enum "user_role" must include 'leader' and 'full_admin'. Run: ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'leader'; ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'full_admin'; in Supabase SQL Editor.`
      );
    }
    throw error;
  }
}

export async function updateUserTeamAssignmentsInDb(
  userId: string,
  assignedTeams: StoreTeamId[],
  assignedFare2: string[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        assigned_teams: assignedTeams,
        assigned_fare2: assignedFare2,
      })
      .eq('id', userId);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Sync error' };
  }
}

/**
 * AUDIT LOGS
 */

export async function fetchAuditLogsFromDb(): Promise<AuditLogEntry[]> {
  const { data, error } = await fetchAllRows('stock_audit_logs', {
    orderColumn: 'timestamp',
    ascending: false,
  });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map(mapAuditLogRow);
}

/**
 * Lightweight activity check used for notifications (runs once a minute).
 * Downloads only audit-log rows written in the last `lookbackMinutes` (usually none)
 * plus three row COUNTS (no row data), instead of re-downloading every table.
 */
export interface ActivitySnapshot {
  recentLogs: AuditLogEntry[];
  pendingRequests: number | null;
  pendingAccounts: number | null;
  pendingBookingRequests: number | null;
}

export async function fetchActivitySnapshot(lookbackMinutes = 30): Promise<ActivitySnapshot> {
  const sinceIso = new Date(Date.now() - lookbackMinutes * 60_000).toISOString();

  const countOrNull = async (query: PromiseLike<{ count: number | null; error: any }>) => {
    try {
      const { count, error } = await query;
      return error ? null : count ?? 0;
    } catch {
      return null;
    }
  };

  const [logsRes, pendingRequests, pendingAccounts, pendingBookingRequests] = await Promise.all([
    supabase
      .from('stock_audit_logs')
      .select('*')
      .gt('timestamp', sinceIso)
      .order('timestamp', { ascending: false })
      .limit(20),
    countOrNull(
      supabase.from('adjustment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    ),
    countOrNull(
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    ),
    countOrNull(
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .not('pending_deposit_percentage', 'is', null)
    ),
  ]);

  return {
    recentLogs: logsRes.error || !logsRes.data ? [] : logsRes.data.map(mapAuditLogRow),
    pendingRequests,
    pendingAccounts,
    pendingBookingRequests,
  };
}

function mapAuditLogRow(l: any): AuditLogEntry {
  {
    const detailsText = String(l.details || '');
    const summaryText = String(l.summary || '');
    const combined = `${summaryText} ${detailsText} ${l.reason || ''}`;
    const numMatch = combined.match(/SPS-[A-Za-z0-9-]+/i);
    const bookingNum = l.booking_number || (numMatch ? numMatch[0].toUpperCase() : undefined);
    const isOrder = Boolean(bookingNum) || l.action?.includes('booking') || combined.toLowerCase().includes('booking');

    // Parse variant size/color & counts from details text only for inventory/stock logs (never for order/booking records)
    const qtyMatch = !isOrder
      ? detailsText.match(/adjusted from (\d+) to (\d+) units/i) ||
        detailsText.match(/stock changed from (\d+) to (\d+) units/i) ||
        detailsText.match(/(\d+)\s*→\s*(\d+)/)
      : null;
    const totalMatch = !isOrder
      ? detailsText.match(/Total units changed from (\d+) to (\d+)/i)
      : null;
    const sizeColorMatch = !isOrder
      ? detailsText.match(/(?:Size\s+([^\s(]+)|Standard Size)(?:\s*\(([^)]+)\))?/i)
      : null;
    const reasonMatch = detailsText.match(/Reason:\s*([^.\n]+)/i);

    const parsedOldQty = isOrder
      ? undefined
      : l.old_quantity !== null && l.old_quantity !== undefined
      ? Number(l.old_quantity)
      : qtyMatch
      ? Number(qtyMatch[1])
      : undefined;
    const parsedNewQty = isOrder
      ? undefined
      : l.new_quantity !== null && l.new_quantity !== undefined
      ? Number(l.new_quantity)
      : qtyMatch
      ? Number(qtyMatch[2])
      : undefined;
    const parsedDelta = isOrder
      ? undefined
      : l.delta !== null && l.delta !== undefined
      ? Number(l.delta)
      : parsedOldQty !== undefined && parsedNewQty !== undefined
      ? parsedNewQty - parsedOldQty
      : undefined;
    const parsedTotalBefore = isOrder
      ? undefined
      : l.total_quantity_before !== null && l.total_quantity_before !== undefined
      ? Number(l.total_quantity_before)
      : totalMatch
      ? Number(totalMatch[1])
      : undefined;
    const parsedTotalAfter = isOrder
      ? undefined
      : l.total_quantity_after !== null && l.total_quantity_after !== undefined
      ? Number(l.total_quantity_after)
      : totalMatch
      ? Number(totalMatch[2])
      : undefined;

    const parsedSize = isOrder
      ? undefined
      : l.variant_size ||
        (sizeColorMatch
          ? detailsText.includes('Standard Size')
            ? 'Standard Size'
            : sizeColorMatch[1]
          : undefined);
    const parsedColor = isOrder
      ? undefined
      : l.variant_color || (sizeColorMatch && sizeColorMatch[2] ? sizeColorMatch[2] : undefined);
    const parsedReason =
      l.reason ||
      (reasonMatch ? reasonMatch[1].trim() : undefined) ||
      (isOrder && bookingNum ? `Making Order #${bookingNum}` : isOrder ? 'Making Order' : undefined);

    return {
      id: l.id,
      timestamp: l.timestamp,
      action: l.action,
      actorName: l.actor_name,
      actorRole: l.actor_role as Role,
      summary: l.summary,
      details: l.details || undefined,
      productId: l.product_id || undefined,
      productName: l.product_name || undefined,
      productImage: l.product_image || undefined,
      variantSize: parsedSize,
      variantColor: parsedColor,
      oldQuantity: parsedOldQty,
      newQuantity: parsedNewQty,
      delta: parsedDelta,
      totalQuantityBefore: parsedTotalBefore,
      totalQuantityAfter: parsedTotalAfter,
      note: l.note || undefined,
      bookingNumber: bookingNum,
      bookingId: l.booking_id || undefined,
      reason: parsedReason,
    };
  }
}

export async function insertAuditLogInDb(log: AuditLogEntry): Promise<void> {
  try {
    const corePayload: Record<string, any> = {
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      actor_name: log.actorName,
      actor_role: log.actorRole === 'full_admin' ? 'admin' : log.actorRole,
      summary: log.summary,
      details: log.details || null,
      product_id: log.productId || null,
      product_name: log.productName || null,
    };

    const fullPayload: Record<string, any> = {
      ...corePayload,
      reason: log.reason || null,
      variant_size: log.variantSize || null,
      variant_color: log.variantColor || null,
      old_quantity: log.oldQuantity !== undefined ? log.oldQuantity : null,
      new_quantity: log.newQuantity !== undefined ? log.newQuantity : null,
      delta: log.delta !== undefined ? log.delta : null,
      total_quantity_before: log.totalQuantityBefore !== undefined ? log.totalQuantityBefore : null,
      total_quantity_after: log.totalQuantityAfter !== undefined ? log.totalQuantityAfter : null,
      note: log.note || null,
      booking_id: log.bookingId || null,
      booking_number: log.bookingNumber || null,
    };

    let { error } = await supabase.from('stock_audit_logs').insert(fullPayload);

    // If extended columns don't exist in remote table yet, fallback cleanly to core payload
    if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
      const retryCore = await supabase.from('stock_audit_logs').insert(corePayload);
      error = retryCore.error;
    }

    // If foreign key constraint on product_id fails, retry without product_id so audit history is never lost
    if (
      error &&
      (error.code === '23503' ||
        error.message?.includes('violates foreign key constraint') ||
        error.message?.includes('stock_audit_logs_product_id_fkey') ||
        error.message?.includes('product_id'))
    ) {
      corePayload.product_id = null;
      const retry = await supabase.from('stock_audit_logs').insert(corePayload);
      error = retry.error;
    }
  } catch (_err) {
    // Non-blocking
  }
}

export async function clearAuditLogsInDb(): Promise<void> {
  try {
    const { error } = await supabase
      .from('stock_audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.warn('Notice clearing audit logs in Supabase:', error.message);
    }
  } catch (err: any) {
    console.warn('Notice clearing audit logs:', err?.message);
  }
}

/**
 * CLIENT BOOKINGS & QUOTATIONS DATABASE SYNCHRONIZATION
 */

function extractMissingColumnName(error: any): string | null {
  const msg = String(error?.message || '');
  const details = String(error?.details || '');
  // PostgREST PGRST204: "Could not find the 'col_name' column of 'table' in the schema cache"
  const pgrstMatch = msg.match(/Could not find the '([^']+)' column/i);
  if (pgrstMatch?.[1]) return pgrstMatch[1];
  // PostgreSQL 42703: column "col_name" of relation "table" does not exist / column table.col_name does not exist
  const pgMatch =
    msg.match(/column "([^"]+)"/i) ||
    details.match(/column "([^"]+)"/i) ||
    msg.match(/column [a-z_]+\.([a-z0-9_]+) does not exist/i);
  if (pgMatch?.[1]) return pgMatch[1];
  return null;
}

export async function fetchBookingsFromDb(): Promise<Booking[]> {
  const { data: bookingsData, error: bookingsError } = await fetchAllRows('bookings', {
    orderColumn: 'created_at',
    ascending: false,
  });

  if (bookingsError) {
    if (bookingsError.message?.includes('does not exist')) {
      return [];
    }
    throw bookingsError;
  }

  if (!bookingsData || bookingsData.length === 0) {
    return [];
  }

  // Explicit columns: skips product_image (a full photo copy per line item).
  // The photo is filled in from the product list in App.tsx instead.
  let { data: itemsData, error: itemsError } = await fetchAllRows('booking_items', {
    select:
      'id, booking_id, product_id, product_name, product_sku, variant_id, size, color_name, color_hex, quantity, unit_price, total_price, available_stock, deficit_quantity, min_threshold, recommended_production',
  });

  if (
    itemsError &&
    (itemsError.code === 'PGRST204' ||
      itemsError.code === '42703' ||
      itemsError.message?.includes('column'))
  ) {
    const fallbackItems = await fetchAllRows('booking_items', {
      select:
        'id, booking_id, product_id, product_name, product_sku, variant_id, size, color_name, color_hex, quantity, unit_price, total_price, available_stock, deficit_quantity',
    });
    itemsData = fallbackItems.data;
    itemsError = fallbackItems.error;
  }

  if (itemsError && !itemsError.message?.includes('does not exist')) {
    console.warn('Notice fetching booking items from DB:', itemsError.message);
  }

  const allItems = itemsData || [];

  return bookingsData.map((b: any) => {
    const lineItems: BookingItem[] = allItems
      .filter((it: any) => it.booking_id === b.id)
      .map((it: any) => ({
        id: it.id,
        productId: it.product_id,
        productName: it.product_name,
        productSku: it.product_sku,
        productImage: it.product_image || undefined,
        variantId: it.variant_id,
        size: it.size as GarmentSize,
        colorName: it.color_name,
        colorHex: it.color_hex,
        quantity: it.quantity,
        unitPrice: Number(it.unit_price) || 0,
        totalPrice: Number(it.total_price) || 0,
        availableStock: it.available_stock ?? 0,
        deficitQuantity: it.deficit_quantity ?? 0,
        minThreshold: it.min_threshold ?? 5,
        recommendedProduction: it.recommended_production ?? 0,
      }));

    return {
      id: b.id,
      bookingNumber: b.booking_number,
      clientName: b.client_name,
      troopGroup: b.troop_group || undefined,
      assignedFare2: b.assigned_fare2 || undefined,
      assignedToId: b.assigned_to_id || undefined,
      assignedToName: b.assigned_to_name || undefined,
      clientPhone: b.client_phone || 'N/A',
      notes: b.notes || undefined,
      items: lineItems,
      subtotal: Number(b.subtotal) || 0,
      discount: Number(b.discount) || 0,
      total: Number(b.total) || 0,
      depositRate: Number(b.deposit_rate) || 0.5,
      depositPercentage: b.deposit_percentage
        ? Number(b.deposit_percentage)
        : b.deposit_rate
        ? Math.round(Number(b.deposit_rate) * 100)
        : 50,
      pendingDepositPercentage: b.pending_deposit_percentage ? Number(b.pending_deposit_percentage) : undefined,
      pendingDepositPercentageBy: b.pending_deposit_percentage_by || undefined,
      pendingDepositPercentageAt: b.pending_deposit_percentage_at || undefined,
      depositRequired: Number(b.deposit_required) || 0,
      depositPaid: Boolean(b.deposit_paid),
      depositPaidAmount: Number(b.deposit_paid_amount) || 0,
      depositPaidAt: b.deposit_paid_at || undefined,
      finalPaidAmount: b.final_paid_amount !== null ? Number(b.final_paid_amount) : undefined,
      finalPaidAt: b.final_paid_at || undefined,
      paymentVerificationRequested: Boolean(b.payment_verification_requested),
      paymentVerificationRequestedBy: b.payment_verification_requested_by || undefined,
      paymentVerificationRequestedAt: b.payment_verification_requested_at || undefined,
      paymentVerificationNote: b.payment_verification_note || undefined,
      status: (b.status || 'pending') as BookingStatus,
      stockCheckStatus: (b.stock_check_status as BookingStockCheckStatus) || undefined,
      inventoryDeducted: Boolean(b.inventory_deducted),
      createdById: b.created_by_id,
      createdByName: b.created_by_name,
      createdByRole: b.created_by_role as Role,
      createdAt: b.created_at,
      updatedAt: b.updated_at || b.created_at,
    };
  });
}

export async function insertBookingInDb(booking: Booking): Promise<void> {
  const bookingPayload: Record<string, any> = {
    id: booking.id,
    booking_number: booking.bookingNumber,
    client_name: booking.clientName,
    troop_group: booking.troopGroup || null,
    assigned_fare2: booking.assignedFare2 || null,
    assigned_to_id: booking.assignedToId || null,
    assigned_to_name: booking.assignedToName || null,
    client_phone: booking.clientPhone || 'N/A',
    notes: booking.notes || null,
    subtotal: booking.subtotal,
    discount: booking.discount,
    total: booking.total,
    deposit_rate: booking.depositRate,
    deposit_percentage: booking.depositPercentage ?? (booking.depositRate ? Math.round(booking.depositRate * 100) : 50),
    pending_deposit_percentage: booking.pendingDepositPercentage || null,
    pending_deposit_percentage_by: booking.pendingDepositPercentageBy || null,
    pending_deposit_percentage_at: booking.pendingDepositPercentageAt || null,
    deposit_required: booking.depositRequired,
    deposit_paid: booking.depositPaid,
    deposit_paid_amount: booking.depositPaidAmount || 0,
    deposit_paid_at: booking.depositPaidAt || null,
    final_paid_amount: booking.finalPaidAmount || 0,
    final_paid_at: booking.finalPaidAt || null,
    payment_verification_requested: Boolean(booking.paymentVerificationRequested),
    payment_verification_requested_by: booking.paymentVerificationRequestedBy || null,
    payment_verification_requested_at: booking.paymentVerificationRequestedAt || null,
    payment_verification_note: booking.paymentVerificationNote || null,
    status: booking.status,
    stock_check_status: booking.stockCheckStatus || null,
    inventory_deducted: booking.inventoryDeducted,
    created_by_id: booking.createdById,
    created_by_name: booking.createdByName,
    created_by_role: booking.createdByRole,
    created_at: booking.createdAt,
    updated_at: booking.updatedAt,
  };

  let bookingErr: any = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    const res = await supabase.from('bookings').upsert(bookingPayload);
    bookingErr = res.error;
    if (!bookingErr) break;

    if (
      bookingErr.code === 'PGRST204' ||
      bookingErr.code === '42703' ||
      bookingErr.message?.includes('Could not find the')
    ) {
      const missingCol = extractMissingColumnName(bookingErr);
      if (missingCol && missingCol in bookingPayload) {
        delete bookingPayload[missingCol];
        continue;
      }
      // Fallback strip known optional columns if message format wasn't matched
      const optionalCols = [
        'stock_check_status',
        'assigned_fare2',
        'assigned_to_id',
        'assigned_to_name',
        'payment_verification_requested',
        'payment_verification_requested_by',
        'payment_verification_requested_at',
        'payment_verification_note',
        'pending_deposit_percentage',
        'pending_deposit_percentage_by',
        'pending_deposit_percentage_at',
        'deposit_percentage',
        'troop_group',
      ];
      let removedAny = false;
      for (const col of optionalCols) {
        if (col in bookingPayload) {
          delete bookingPayload[col];
          removedAny = true;
        }
      }
      if (removedAny) continue;
    }

    if (
      (bookingErr.code === '22P02' || bookingErr.message?.includes('user_role')) &&
      (bookingPayload.created_by_role === 'full_admin' || bookingPayload.created_by_role === 'leader')
    ) {
      bookingPayload.created_by_role = bookingPayload.created_by_role === 'full_admin' ? 'admin' : 'worker';
      continue;
    }
    break;
  }

  if (bookingErr) {
    console.warn('Notice inserting booking in Supabase:', bookingErr.message);
    throw bookingErr;
  }

  // Cleanly replace line items so any removed items during an Admin edit are removed in DB
  const { error: delItemsErr } = await supabase
    .from('booking_items')
    .delete()
    .eq('booking_id', booking.id);
  if (delItemsErr) {
    console.warn('Notice clearing old booking items in Supabase:', delItemsErr.message);
  }

  if (booking.items && booking.items.length > 0) {
    let itemsPayload: Record<string, any>[] = booking.items.map((it) => ({
      id: it.id,
      booking_id: booking.id,
      product_id: it.productId,
      product_name: it.productName,
      product_sku: it.productSku,
      // Never store a second full copy of the photo; the app fills it in from the product.
      product_image: isInlineImage(it.productImage) ? null : it.productImage || null,
      variant_id: it.variantId,
      size: it.size,
      color_name: it.colorName,
      color_hex: it.colorHex,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      total_price: it.totalPrice,
      available_stock: it.availableStock,
      deficit_quantity: it.deficitQuantity,
      min_threshold: it.minThreshold ?? 5,
      recommended_production: it.recommendedProduction ?? 0,
      created_at: booking.createdAt,
    }));

    let itemsErr: any = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await supabase.from('booking_items').upsert(itemsPayload);
      itemsErr = res.error;
      if (!itemsErr) break;
      if (
        itemsErr.code === 'PGRST204' ||
        itemsErr.code === '42703' ||
        itemsErr.message?.includes('Could not find the')
      ) {
        const missingCol = extractMissingColumnName(itemsErr);
        if (missingCol && missingCol in itemsPayload[0]) {
          itemsPayload = itemsPayload.map((row) => {
            const copy = { ...row };
            delete copy[missingCol];
            return copy;
          });
          continue;
        }
      }
      break;
    }

    if (itemsErr) {
      console.warn('Notice inserting booking items in Supabase:', itemsErr.message);
      throw itemsErr;
    }
  }
}

export async function updateBookingInDb(
  bookingId: string,
  updates: Partial<Booking>
): Promise<void> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.stockCheckStatus !== undefined) payload.stock_check_status = updates.stockCheckStatus || null;
  if (updates.clientName !== undefined) payload.client_name = updates.clientName;
  if (updates.clientPhone !== undefined) payload.client_phone = updates.clientPhone;
  if (updates.troopGroup !== undefined) payload.troop_group = updates.troopGroup;
  if (updates.assignedFare2 !== undefined) payload.assigned_fare2 = updates.assignedFare2 || null;
  if (updates.assignedToId !== undefined) payload.assigned_to_id = updates.assignedToId || null;
  if (updates.assignedToName !== undefined) payload.assigned_to_name = updates.assignedToName || null;
  if (updates.inventoryDeducted !== undefined) payload.inventory_deducted = updates.inventoryDeducted;
  if (updates.depositRate !== undefined) payload.deposit_rate = updates.depositRate;
  if (updates.depositPercentage !== undefined) payload.deposit_percentage = updates.depositPercentage;
  if (updates.pendingDepositPercentage !== undefined) payload.pending_deposit_percentage = updates.pendingDepositPercentage;
  if (updates.pendingDepositPercentageBy !== undefined) payload.pending_deposit_percentage_by = updates.pendingDepositPercentageBy;
  if (updates.pendingDepositPercentageAt !== undefined) payload.pending_deposit_percentage_at = updates.pendingDepositPercentageAt;
  if (updates.depositRequired !== undefined) payload.deposit_required = updates.depositRequired;
  if (updates.depositPaid !== undefined) payload.deposit_paid = updates.depositPaid;
  if (updates.depositPaidAmount !== undefined) payload.deposit_paid_amount = updates.depositPaidAmount;
  if (updates.depositPaidAt !== undefined) payload.deposit_paid_at = updates.depositPaidAt;
  if (updates.finalPaidAmount !== undefined) payload.final_paid_amount = updates.finalPaidAmount;
  if (updates.finalPaidAt !== undefined) payload.final_paid_at = updates.finalPaidAt;
  if (updates.paymentVerificationRequested !== undefined) {
    payload.payment_verification_requested = Boolean(updates.paymentVerificationRequested);
  }
  if (updates.paymentVerificationRequestedBy !== undefined) {
    payload.payment_verification_requested_by = updates.paymentVerificationRequestedBy || null;
  }
  if (updates.paymentVerificationRequestedAt !== undefined) {
    payload.payment_verification_requested_at = updates.paymentVerificationRequestedAt || null;
  }
  if (updates.paymentVerificationNote !== undefined) {
    payload.payment_verification_note = updates.paymentVerificationNote || null;
  }
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.subtotal !== undefined) payload.subtotal = updates.subtotal;
  if (updates.discount !== undefined) payload.discount = updates.discount;
  if (updates.total !== undefined) payload.total = updates.total;

  let error: any = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    const res = await supabase.from('bookings').update(payload).eq('id', bookingId);
    error = res.error;
    if (!error) break;
    if (
      error.code === 'PGRST204' ||
      error.code === '42703' ||
      error.message?.includes('Could not find the')
    ) {
      const missingCol = extractMissingColumnName(error);
      if (missingCol && missingCol in payload) {
        delete payload[missingCol];
        continue;
      }
    }
    break;
  }
  if (error) {
    console.warn('Supabase updateBooking error:', error?.message);
    throw error;
  }
}

export async function deleteBookingFromDb(bookingId: string): Promise<void> {
  const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
  if (error) {
    console.warn('Supabase deleteBooking error:', error.message);
    throw error;
  }
}

/**
 * OTHERS SUB-FOLDERS & SUB-SUB-FOLDERS
 */
export async function fetchOthersFoldersFromDb(): Promise<string[] | null> {
  try {
    const { data, error } = await supabase
      .from('others_folders')
      .select('path')
      .order('created_at', { ascending: true });

    if (error) {
      // Table not created yet -> signal null so caller uses built-in defaults + local storage
      return null;
    }

    if (!data) return [];
    return data
      .map((row: any) => String(row.path || '').trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

export async function syncOthersFoldersToDb(
  folders: string[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const uniqueFolders = Array.from(
      new Set(
        folders
          .map((f) =>
            f
              .split('/')
              .map((s) => s.trim())
              .filter(Boolean)
              .join(' / ')
          )
          .filter((f) => Boolean(f) && f.toLowerCase() !== 'all items')
      )
    );

    const { error: checkErr } = await supabase.from('others_folders').select('path').limit(1);
    if (checkErr) {
      return { ok: false, error: checkErr.message };
    }

    const { data: existingRows, error: fetchErr } = await supabase
      .from('others_folders')
      .select('path');
    if (fetchErr) {
      return { ok: false, error: fetchErr.message };
    }

    const existingSet = new Set((existingRows || []).map((r: any) => String(r.path)));
    const targetSet = new Set(uniqueFolders);

    const toDelete = Array.from(existingSet).filter((p) => !targetSet.has(p));
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('others_folders')
        .delete()
        .in('path', toDelete);
      if (delErr) {
        console.warn('Supabase others_folders delete notice:', delErr.message);
        return { ok: false, error: delErr.message };
      }
    }

    if (uniqueFolders.length > 0) {
      const payload = uniqueFolders.map((path) => ({ path }));
      const { error: upsertErr } = await supabase
        .from('others_folders')
        .upsert(payload, { onConflict: 'path' });

      if (upsertErr) {
        // Fallback if remote others_folders table was created without UNIQUE(path)
        const toInsert = uniqueFolders.filter((p) => !existingSet.has(p));
        if (toInsert.length > 0) {
          const { error: insErr } = await supabase
            .from('others_folders')
            .insert(toInsert.map((path) => ({ path })));
          if (insErr) {
            console.warn('Supabase others_folders insert notice:', insErr.message);
            return { ok: false, error: insErr.message };
          }
        } else {
          console.warn('Supabase others_folders upsert notice:', upsertErr.message);
          return { ok: false, error: upsertErr.message };
        }
      }
    }

    return { ok: true };
  } catch (err: any) {
    console.warn('Notice syncing Others folders to Supabase:', err?.message);
    return { ok: false, error: err?.message || 'Sync error' };
  }
}

/**
 * CALENDAR EVENTS & TASKS
 */

export async function fetchCalendarEventsFromDb(): Promise<CalendarItem[] | null> {
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) {
      // Table not created yet -> signal null so caller retains local storage seamlessly
      return null;
    }

    if (!data) return [];
    return data.map((row: any) => ({
      id: String(row.id),
      title: String(row.title || ''),
      itemType: row.item_type === 'task' ? 'task' : 'event',
      startDate: String(row.start_date),
      endDate: String(row.end_date || row.start_date),
      startTime: row.start_time || undefined,
      endTime: row.end_time || undefined,
      allDay: Boolean(row.all_day),
      completed: Boolean(row.completed),
      boardStatus:
        row.board_status === 'upcoming' ||
        row.board_status === 'in_progress' ||
        row.board_status === 'done'
          ? row.board_status
          : row.completed
          ? 'done'
          : undefined,
      team: row.team || undefined,
      assignedToId: row.assigned_to_id || undefined,
      assignedToName: row.assigned_to_name || undefined,
      troopGroup: row.troop_group || undefined,
      location: row.location || undefined,
      notes: row.notes || undefined,
      linkedBookingId: row.linked_booking_id || undefined,
      linkedBatchId: row.linked_batch_id || undefined,
      linkedOfferId: row.linked_offer_id || undefined,
      workflowStage: row.workflow_stage || undefined,
      createdById: String(row.created_by_id || ''),
      createdByName: String(row.created_by_name || 'Staff'),
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
    }));
  } catch {
    return null;
  }
}

export async function upsertCalendarEventToDb(
  item: CalendarItem
): Promise<{ ok: boolean; error?: string }> {
  try {
    const basePayload = {
      id: item.id,
      title: item.title,
      item_type: item.itemType,
      start_date: item.startDate,
      end_date: item.endDate || item.startDate,
      start_time: item.allDay ? null : item.startTime || null,
      end_time: item.allDay ? null : item.endTime || null,
      all_day: Boolean(item.allDay),
      completed: Boolean(item.completed),
      troop_group: item.troopGroup || null,
      location: item.location || null,
      notes: item.notes || null,
      created_by_id: item.createdById || null,
      created_by_name: item.createdByName || 'Staff',
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    };

    const withTeamPayload = {
      ...basePayload,
      team: item.team || null,
      assigned_to_id: item.assignedToId || null,
      assigned_to_name: item.assignedToName || null,
    };

    const fullPayload = {
      ...withTeamPayload,
      board_status: item.boardStatus || (item.completed ? 'done' : 'upcoming'),
      linked_booking_id: item.linkedBookingId || null,
      linked_batch_id: item.linkedBatchId || null,
      linked_offer_id: item.linkedOfferId || null,
      workflow_stage: item.workflowStage || null,
    };

    let { error } = await supabase.from('calendar_events').upsert(fullPayload);

    // Fallback cleanly if linked_* columns aren't added yet
    if (
      error &&
      (error.message?.includes('linked_') ||
        error.message?.includes('workflow_stage') ||
        (error as any).code === 'PGRST204' ||
        (error as any).code === '42703')
    ) {
      const retryBoard = await supabase.from('calendar_events').upsert({
        ...withTeamPayload,
        board_status: item.boardStatus || (item.completed ? 'done' : 'upcoming'),
      });
      error = retryBoard.error;
    }

    // Fallback cleanly if board_status column isn't added yet
    if (
      error &&
      (error.message?.includes('board_status') ||
        (error as any).code === 'PGRST204' ||
        (error as any).code === '42703')
    ) {
      const retryTeam = await supabase.from('calendar_events').upsert(withTeamPayload);
      error = retryTeam.error;
    }

    // If team / assigned_to_* columns haven't been added yet on live Supabase, retry base payload cleanly
    if (
      error &&
      (error.message?.includes('team') ||
        error.message?.includes('assigned_to') ||
        (error as any).code === 'PGRST204' ||
        (error as any).code === '42703')
    ) {
      const retry = await supabase.from('calendar_events').upsert(basePayload);
      error = retry.error;
    }

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Sync error' };
  }
}

export async function deleteCalendarEventFromDb(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Sync error' };
  }
}

/**
 * SCOUT FERA2 LEADERS
 */
export async function fetchFare2LeadersFromDb(): Promise<
  Record<string, { userId: string; userName: string }> | null
> {
  try {
    const { data, error } = await supabase
      .from('scout_fera2_leaders')
      .select('fare2_id, leader_user_id, leader_user_name');

    if (error) return null;
    const map: Record<string, { userId: string; userName: string }> = {};
    (data || []).forEach((row: any) => {
      if (row.fare2_id && row.leader_user_id) {
        map[String(row.fare2_id)] = {
          userId: String(row.leader_user_id),
          userName: String(row.leader_user_name || ''),
        };
      }
    });
    return map;
  } catch {
    return null;
  }
}

export async function upsertFare2LeaderInDb(
  fare2Id: string,
  leader: { userId: string; userName: string } | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!leader) {
      const { error } = await supabase
        .from('scout_fera2_leaders')
        .delete()
        .eq('fare2_id', fare2Id);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
    const { error } = await supabase.from('scout_fera2_leaders').upsert({
      fare2_id: fare2Id,
      leader_user_id: leader.userId,
      leader_user_name: leader.userName,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Sync error' };
  }
}

/**
 * SOURCING & PRODUCTION OPERATIONS
 * Relational tables: vendors, product_workflows, product_stage_vendors, vendor_price_history, production_batches
 */

export async function fetchSourcingDataFromDb(): Promise<{
  tablesReady: boolean;
  vendors: Vendor[];
  workflows: ProductWorkflow[];
  stageVendors: ProductStageVendor[];
  priceHistory: VendorPriceEntry[];
  batches: ProductionBatch[];
} | null> {
  try {
    const [vRes, wfRes, psvRes, phRes, bRes] = await Promise.all([
      fetchAllRows('vendors', { orderColumn: 'created_at', ascending: false }),
      fetchAllRows('product_workflows', { orderColumn: 'id', ascending: true }),
      fetchAllRows('product_stage_vendors', { orderColumn: 'id', ascending: true }),
      fetchAllRows('vendor_price_history', { orderColumn: 'purchase_date', ascending: false }),
      fetchAllRows('production_batches', { orderColumn: 'created_at', ascending: false }),
    ]);

    if (vRes.error || wfRes.error || psvRes.error || phRes.error || bRes.error) {
      return null;
    }

    const vendors: Vendor[] = (vRes.data || []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name || ''),
      location: String(r.location || ''),
      mapsUrl: r.maps_url || undefined,
      contactPerson: r.contact_person || undefined,
      phone: r.phone || undefined,
      tags: Array.isArray(r.tags) ? (r.tags as VendorBehaviorTag[]) : [],
      generalNotes: r.general_notes || undefined,
      createdAt: String(r.created_at || new Date().toISOString()),
    }));

    const workflows: ProductWorkflow[] = (wfRes.data || []).map((r: any) => ({
      id: String(r.id),
      productId: String(r.product_id),
      workflowType: r.workflow_type === 'ready_made' ? 'ready_made' : 'manufactured',
      activeStages: Array.isArray(r.active_stages)
        ? (r.active_stages as OperationStageKey[])
        : [],
      updatedAt: r.updated_at || undefined,
    }));

    const stageVendors: ProductStageVendor[] = (psvRes.data || []).map((r: any) => ({
      id: String(r.id),
      productId: String(r.product_id),
      stageKey: r.stage_key as OperationStageKey,
      vendorId: String(r.vendor_id),
      isPrimary: Boolean(r.is_primary),
      approxOrderQty: String(r.approx_order_qty || ''),
      orderScriptNotes: String(r.order_script_notes || ''),
    }));

    const priceHistory: VendorPriceEntry[] = (phRes.data || []).map((r: any) => ({
      id: String(r.id),
      productStageVendorId: String(r.product_stage_vendor_id),
      purchaseDate: String(r.purchase_date || '').slice(0, 10),
      unitPrice: Number(r.unit_price || 0),
      quantity: String(r.quantity || ''),
      notes: r.notes || '',
    }));

    const batches: ProductionBatch[] = (bRes.data || []).map((r: any) => ({
      id: String(r.id),
      batchCode: String(r.batch_code || ''),
      productId: String(r.product_id),
      variantId: r.variant_id || undefined,
      quantity: Number(r.quantity || 0),
      targetDate: r.target_date ? String(r.target_date).slice(0, 10) : undefined,
      currentStageKey: r.current_stage_key as OperationStageKey,
      status: r.status === 'completed' ? 'completed' : 'in_progress',
      stageAssignments:
        r.stage_assignments && typeof r.stage_assignments === 'object' ? r.stage_assignments : {},
      linkedBookingId: r.linked_booking_id || undefined,
      linkedBookingNumber: r.linked_booking_number || undefined,
      requestedByTeam: r.requested_by_team || undefined,
      createdAt: String(r.created_at || new Date().toISOString()),
      completedAt: r.completed_at || undefined,
    }));

    return {
      tablesReady: true,
      vendors,
      workflows,
      stageVendors,
      priceHistory,
      batches,
    };
  } catch {
    return null;
  }
}

export async function upsertVendorToDb(vendor: Vendor): Promise<void> {
  const { error } = await supabase.from('vendors').upsert({
    id: vendor.id,
    name: vendor.name,
    location: vendor.location || '',
    maps_url: vendor.mapsUrl || null,
    contact_person: vendor.contactPerson || null,
    phone: vendor.phone || null,
    tags: vendor.tags || [],
    general_notes: vendor.generalNotes || null,
    created_at: vendor.createdAt,
  });
  if (error) throw error;
}

export async function deleteVendorFromDb(vendorId: string): Promise<void> {
  const { error } = await supabase.from('vendors').delete().eq('id', vendorId);
  if (error) throw error;
}

export async function upsertProductWorkflowToDb(wf: ProductWorkflow): Promise<void> {
  const { error } = await supabase.from('product_workflows').upsert(
    {
      id: wf.id,
      product_id: wf.productId,
      workflow_type: wf.workflowType,
      active_stages: wf.activeStages,
      updated_at: wf.updatedAt || new Date().toISOString(),
    },
    { onConflict: 'product_id' }
  );
  if (error) throw error;
}

export async function upsertProductStageVendorToDb(psv: ProductStageVendor): Promise<void> {
  const { error } = await supabase.from('product_stage_vendors').upsert({
    id: psv.id,
    product_id: psv.productId,
    stage_key: psv.stageKey,
    vendor_id: psv.vendorId,
    is_primary: Boolean(psv.isPrimary),
    approx_order_qty: psv.approxOrderQty || '',
    order_script_notes: psv.orderScriptNotes || '',
  });
  if (error) throw error;
}

export async function deleteProductStageVendorFromDb(psvId: string): Promise<void> {
  const { error } = await supabase.from('product_stage_vendors').delete().eq('id', psvId);
  if (error) throw error;
}

export async function insertVendorPriceEntryToDb(entry: VendorPriceEntry): Promise<void> {
  const { error } = await supabase.from('vendor_price_history').upsert({
    id: entry.id,
    product_stage_vendor_id: entry.productStageVendorId,
    purchase_date: entry.purchaseDate,
    unit_price: entry.unitPrice,
    quantity: entry.quantity || '',
    notes: entry.notes || '',
  });
  if (error) throw error;
}

export async function upsertProductionBatchToDb(batch: ProductionBatch): Promise<void> {
  const corePayload = {
    id: batch.id,
    batch_code: batch.batchCode,
    product_id: batch.productId,
    variant_id: batch.variantId || null,
    quantity: batch.quantity,
    target_date: batch.targetDate || null,
    current_stage_key: batch.currentStageKey,
    status: batch.status,
    stage_assignments: batch.stageAssignments || {},
    created_at: batch.createdAt,
    completed_at: batch.completedAt || null,
  };
  let { error } = await supabase.from('production_batches').upsert({
    ...corePayload,
    linked_booking_id: batch.linkedBookingId || null,
    linked_booking_number: batch.linkedBookingNumber || null,
    requested_by_team: batch.requestedByTeam || null,
  });
  if (
    error &&
    (error.message?.includes('linked_booking') ||
      error.message?.includes('requested_by_team') ||
      (error as any).code === 'PGRST204' ||
      (error as any).code === '42703')
  ) {
    const retry = await supabase.from('production_batches').upsert(corePayload);
    error = retry.error;
  }
  if (error) throw error;
}

export async function deleteProductionBatchFromDb(batchId: string): Promise<void> {
  const { error } = await supabase.from('production_batches').delete().eq('id', batchId);
  if (error) throw error;
}

/**
 * MARKETING OFFERS & PROMOTIONS
 */
export async function fetchMarketingOffersFromDb(): Promise<MarketingOffer[] | null> {
  try {
    const { data, error } = await fetchAllRows('marketing_offers', {
      orderColumn: 'created_at',
      ascending: false,
    });
    if (error) return null;
    return (data || []).map((r: any) => ({
      id: String(r.id),
      productId: String(r.product_id),
      title: String(r.title || ''),
      offerType:
        r.offer_type === 'fixed_price' || r.offer_type === 'bundle_note'
          ? r.offer_type
          : 'percentage',
      discountPercent: Number(r.discount_percent || 0),
      offerPrice: r.offer_price !== null && r.offer_price !== undefined ? Number(r.offer_price) : undefined,
      badgeText: String(r.badge_text || 'Special Offer'),
      startDate: String(r.start_date || '').slice(0, 10),
      endDate: String(r.end_date || '').slice(0, 10),
      status:
        r.status === 'scheduled' || r.status === 'paused' || r.status === 'ended'
          ? r.status
          : 'active',
      notes: r.notes || undefined,
      createdById: r.created_by_id || undefined,
      createdByName: r.created_by_name || undefined,
      createdAt: String(r.created_at || new Date().toISOString()),
      updatedAt: String(r.updated_at || new Date().toISOString()),
    }));
  } catch {
    return null;
  }
}

export async function upsertMarketingOfferToDb(offer: MarketingOffer): Promise<void> {
  const { error } = await supabase.from('marketing_offers').upsert({
    id: offer.id,
    product_id: offer.productId,
    title: offer.title,
    offer_type: offer.offerType,
    discount_percent: offer.discountPercent,
    offer_price: offer.offerPrice ?? null,
    badge_text: offer.badgeText || 'Special Offer',
    start_date: offer.startDate,
    end_date: offer.endDate,
    status: offer.status,
    notes: offer.notes || null,
    created_by_id: offer.createdById || null,
    created_by_name: offer.createdByName || null,
    created_at: offer.createdAt,
    updated_at: offer.updatedAt,
  });
  if (error) throw error;
}

export async function deleteMarketingOfferFromDb(offerId: string): Promise<void> {
  const { error } = await supabase.from('marketing_offers').delete().eq('id', offerId);
  if (error) throw error;
}

/**
 * BUDGETING, UNIT ECONOMICS & LIQUIDITY
 */
export async function fetchBudgetingDataFromDb(): Promise<{
  profiles: Record<string, ProductBudgetProfile>;
  expenses: BudgetExpenseEntry[];
  settings: BudgetSettings | null;
} | null> {
  try {
    const [profRes, expRes, setRes] = await Promise.all([
      fetchAllRows('product_budget_profiles', { orderColumn: 'updated_at', ascending: false }),
      fetchAllRows('budget_expenses', { orderColumn: 'expense_date', ascending: false }),
      supabase.from('budget_settings').select('*').eq('id', 'default').maybeSingle(),
    ]);

    if (profRes.error || expRes.error || setRes.error) {
      return null;
    }

    const profiles: Record<string, ProductBudgetProfile> = {};
    (profRes.data || []).forEach((r: any) => {
      if (!r.product_id) return;
      profiles[String(r.product_id)] = {
        productId: String(r.product_id),
        manufacturingCost: Number(r.manufacturing_cost || 0),
        extraPrepCost: Number(r.extra_prep_cost || 0),
        targetMarginPercent:
          r.target_margin_percent !== null && r.target_margin_percent !== undefined
            ? Number(r.target_margin_percent)
            : undefined,
        hardshipDiscountType:
          r.hardship_discount_type === 'fixed_amount' || r.hardship_discount_type === 'percentage'
            ? r.hardship_discount_type
            : undefined,
        hardshipDiscountValue:
          r.hardship_discount_value !== null && r.hardship_discount_value !== undefined
            ? Number(r.hardship_discount_value)
            : undefined,
        notes: r.notes || undefined,
        updatedAt: String(r.updated_at || new Date().toISOString()),
      };
    });

    const expenses: BudgetExpenseEntry[] = (expRes.data || []).map((r: any) => ({
      id: String(r.id),
      title: String(r.title || ''),
      category: (r.category || 'other') as BudgetExpenseCategory,
      amount: Number(r.amount || 0),
      expenseDate: String(r.expense_date || '').slice(0, 10),
      linkedProductId: r.linked_product_id || undefined,
      notes: r.notes || undefined,
      createdByName: r.created_by_name || undefined,
      createdAt: String(r.created_at || new Date().toISOString()),
    }));

    const settings: BudgetSettings | null = setRes.data
      ? {
          id: 'default',
          cashOnHand:
            setRes.data.cash_on_hand !== null && setRes.data.cash_on_hand !== undefined
              ? Number(setRes.data.cash_on_hand)
              : undefined,
          reserveBuffer: Number(setRes.data.reserve_buffer || 0),
          updatedAt: String(setRes.data.updated_at || new Date().toISOString()),
        }
      : null;

    return { profiles, expenses, settings };
  } catch {
    return null;
  }
}

export async function upsertProductBudgetProfileToDb(profile: ProductBudgetProfile): Promise<void> {
  const { error } = await supabase.from('product_budget_profiles').upsert({
    product_id: profile.productId,
    manufacturing_cost: profile.manufacturingCost,
    extra_prep_cost: profile.extraPrepCost,
    target_margin_percent: profile.targetMarginPercent ?? null,
    hardship_discount_type: profile.hardshipDiscountType ?? null,
    hardship_discount_value: profile.hardshipDiscountValue ?? null,
    notes: profile.notes || null,
    updated_at: profile.updatedAt,
  });
  if (error) throw error;
}

export async function upsertBudgetExpenseToDb(expense: BudgetExpenseEntry): Promise<void> {
  const { error } = await supabase.from('budget_expenses').upsert({
    id: expense.id,
    title: expense.title,
    category: expense.category,
    amount: expense.amount,
    expense_date: expense.expenseDate,
    linked_product_id: expense.linkedProductId || null,
    notes: expense.notes || null,
    created_by_name: expense.createdByName || null,
    created_at: expense.createdAt,
  });
  if (error) throw error;
}

export async function deleteBudgetExpenseFromDb(expenseId: string): Promise<void> {
  const { error } = await supabase.from('budget_expenses').delete().eq('id', expenseId);
  if (error) throw error;
}

export async function upsertBudgetSettingsToDb(settings: BudgetSettings): Promise<void> {
  const { error } = await supabase.from('budget_settings').upsert({
    id: settings.id || 'default',
    cash_on_hand: settings.cashOnHand ?? null,
    reserve_buffer: settings.reserveBuffer || 0,
    updated_at: settings.updatedAt,
  });
  if (error) throw error;
}

/**
 * CALENDAR SCOUT SEASONS / TIME FRAMES
 */
export async function fetchScoutSeasonsFromDb(): Promise<ScoutSeason[] | null> {
  try {
    const { data, error } = await fetchAllRows('scout_seasons', {
      orderColumn: 'start_date',
      ascending: false,
    });
    if (error || !data) return null;
    return data.map((r: any) => ({
      id: String(r.id),
      name: String(r.name || ''),
      startDate: String(r.start_date || '').slice(0, 10),
      endDate: String(r.end_date || '').slice(0, 10),
      colorHex: r.color_hex || undefined,
      notes: r.notes || undefined,
      createdByName: r.created_by_name || undefined,
      createdAt: String(r.created_at || new Date().toISOString()),
      updatedAt: String(r.updated_at || new Date().toISOString()),
    }));
  } catch {
    return null;
  }
}

export async function upsertScoutSeasonToDb(season: ScoutSeason): Promise<void> {
  const { error } = await supabase.from('scout_seasons').upsert({
    id: season.id,
    name: season.name,
    start_date: season.startDate,
    end_date: season.endDate,
    color_hex: season.colorHex || null,
    notes: season.notes || null,
    created_by_name: season.createdByName || null,
    created_at: season.createdAt,
    updated_at: season.updatedAt,
  });
  if (error) throw error;
}

export async function deleteScoutSeasonFromDb(seasonId: string): Promise<void> {
  const { error } = await supabase.from('scout_seasons').delete().eq('id', seasonId);
  if (error) throw error;
}

