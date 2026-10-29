import { supabase } from './supabaseClient';
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
} from '../types/inventory';

export interface DbConnectionStatus {
  connected: boolean;
  tablesExist: boolean;
  error?: string;
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
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });

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
      return [
        { id: 'Men', name: 'Men' },
        { id: 'Women', name: 'Women' },
        { id: 'Kids', name: 'Kids' },
        { id: 'Unisex', name: 'Unisex' },
      ];
    }

    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
    }));
  } catch {
    return [
      { id: 'Men', name: 'Men' },
      { id: 'Women', name: 'Women' },
      { id: 'Kids', name: 'Kids' },
      { id: 'Unisex', name: 'Unisex' },
    ];
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
  const { data: productsData, error: prodError } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (prodError) throw prodError;
  if (!productsData || productsData.length === 0) return [];

  // Query categories table to map any custom category IDs dynamically
  const dynamicCatMap: Record<string, string> = { ...CATEGORY_MAP };
  try {
    const { data: dbCats } = await supabase.from('categories').select('id, name');
    if (dbCats && dbCats.length > 0) {
      dbCats.forEach((c: any) => {
        dynamicCatMap[c.id.toLowerCase()] = c.name;
        dynamicCatMap[c.name.toLowerCase()] = c.name;
      });
    }
  } catch (_e) {}

  const { data: variantsData, error: varError } = await supabase
    .from('product_variants')
    .select('*');

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
      if (typeof p.image_url === 'string' && p.image_url.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(p.image_url);
          if (Array.isArray(parsed) && parsed.length > 0) {
            imageList = parsed;
            primaryImage = parsed[0] || '';
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
      status: (p.status as any) || 'active',
      createdByRole: p.created_by_role || undefined,
      createdByName: p.created_by_name || undefined,
      createdById: p.created_by_id || undefined,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });
}

export async function upsertProductToDb(product: Product): Promise<void> {
  // 1. Upsert product
  const imagesToStore = product.images && product.images.length > 0
    ? product.images
    : product.image
    ? [product.image]
    : [];

  const storedImageUrl = imagesToStore.length > 1
    ? JSON.stringify(imagesToStore)
    : (imagesToStore[0] || product.image || '');

  const productPayload: Record<string, any> = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category_id: product.categoryId || null,
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
        // Fetch current variant IDs in DB for this product
        const { data: existingRows } = await supabase
          .from('product_variants')
          .select('id')
          .eq('product_id', product.id);

        if (existingRows && existingRows.length > 0) {
          const toDelete = existingRows
            .map((r) => r.id)
            .filter((id) => !validVariantIds.includes(id));

          if (toDelete.length > 0) {
            await supabase.from('product_variants').delete().in('id', toDelete);
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
      // Save exact custom threshold, or NULL if left blank
      min_threshold:
        v.minThreshold !== undefined && v.minThreshold !== null && !isNaN(Number(v.minThreshold))
          ? Number(v.minThreshold)
          : null,
      updated_at: new Date().toISOString(),
    }));

    const { error: varError } = await supabase
      .from('product_variants')
      .upsert(variantRows);

    if (varError) throw varError;
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
  const { data, error } = await supabase
    .from('adjustment_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];

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
    product_image: req.productImage,
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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map((u: any) => {
    const rawRole = String(u.role || u.requested_role || '').trim().toLowerCase();
    const normalizedRole: Role = rawRole.includes('admin') ? 'admin' : 'worker';
    const rawReqRole = String(u.requested_role || u.role || '').trim().toLowerCase();
    const normalizedReqRole: Role = rawReqRole.includes('admin') ? 'admin' : 'worker';

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
    avatarColor: data.requestedRole === 'admin' ? '#d97706' : '#0284c7',
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

  if (error) throw error;
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

/**
 * AUDIT LOGS
 */

export async function fetchAuditLogsFromDb(): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('stock_audit_logs')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map((l: any) => ({
    id: l.id,
    timestamp: l.timestamp,
    action: l.action,
    actorName: l.actor_name,
    actorRole: l.actor_role as Role,
    summary: l.summary,
    details: l.details || undefined,
    productId: l.product_id || undefined,
    productName: l.product_name || undefined,
  }));
}

export async function insertAuditLogInDb(log: AuditLogEntry): Promise<void> {
  try {
    const payload: Record<string, any> = {
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      actor_name: log.actorName,
      actor_role: log.actorRole,
      summary: log.summary,
      details: log.details || null,
      product_id: log.productId || null,
      product_name: log.productName || null,
    };

    let { error } = await supabase.from('stock_audit_logs').insert(payload);

    // If foreign key constraint on product_id fails (race condition or missing FK in remote DB),
    // retry inserting without product_id so audit history is never lost
    if (
      error &&
      (error.code === '23503' ||
        error.message?.includes('violates foreign key constraint') ||
        error.message?.includes('stock_audit_logs_product_id_fkey') ||
        error.message?.includes('product_id'))
    ) {
      payload.product_id = null;
      const retry = await supabase.from('stock_audit_logs').insert(payload);
      error = retry.error;
    }

    if (error && !error.message?.includes('row-level security')) {
      // Non-blocking telemetry
    }
  } catch (_err) {
    // Non-blocking telemetry
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

