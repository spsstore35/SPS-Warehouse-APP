import { supabase } from './supabaseClient';
import {
  Product,
  ProductVariant,
  AdjustmentRequest,
  AuditLogEntry,
  User,
  Role,
  GarmentSize,
  TargetAudience,
  GarmentCategory,
  AdjustmentReason,
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
 * PRODUCTS & VARIANTS
 */

export async function fetchProductsFromDb(): Promise<Product[]> {
  const { data: productsData, error: prodError } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (prodError) throw prodError;
  if (!productsData || productsData.length === 0) return [];

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
      size: v.size as GarmentSize,
      colorName: v.color_name,
      colorHex: v.color_hex,
      quantity: Number(v.quantity) || 0,
      sku: v.sku,
      minThreshold: v.min_threshold,
    });
  });

  return productsData.map((p: any) => {
    const variants = variantsByProdId[p.id] || [];
    const totalQuantity = variants.reduce((sum, v) => sum + v.quantity, 0);

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category as GarmentCategory,
      targetAudience: (p.target_audience || 'Unisex') as TargetAudience,
      description: p.description || '',
      fabricDetails: p.fabric_details || '',
      price: p.price ? Number(p.price) : undefined,
      image: p.image_url || '',
      variants,
      totalQuantity,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });
}

export async function upsertProductToDb(product: Product): Promise<void> {
  // 1. Upsert product
  const productPayload: Record<string, any> = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    target_audience: product.targetAudience || 'Unisex',
    description: product.description,
    fabric_details: product.fabricDetails || null,
    price: product.price || null,
    image_url: product.image,
    updated_at: new Date().toISOString(),
  };

  let { error: prodError } = await supabase.from('products').upsert(productPayload);

  // If remote schema does not have target_audience column yet, retry without it
  if (
    prodError &&
    (prodError.message?.includes('target_audience') ||
      prodError.details?.includes('target_audience') ||
      (prodError as any).code === 'PGRST204')
  ) {
    delete productPayload.target_audience;
    const retry = await supabase.from('products').upsert(productPayload);
    prodError = retry.error;
  }

  if (prodError) throw prodError;

  // 2. Upsert variants
  if (product.variants && product.variants.length > 0) {
    const variantRows = product.variants.map((v) => ({
      id: v.id,
      product_id: product.id,
      size: v.size,
      color_name: v.colorName,
      color_hex: v.colorHex,
      quantity: v.quantity,
      sku: v.sku,
      min_threshold: v.minThreshold ?? 10,
      updated_at: new Date().toISOString(),
    }));

    const { error: varError } = await supabase
      .from('product_variants')
      .upsert(variantRows);

    if (varError) throw varError;
  }
}

export async function deleteProductFromDb(productId: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', productId);
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

  return data.map((u: any) => ({
    id: u.id,
    name: u.full_name,
    email: u.email,
    password: u.password_plain || u.password_hash || undefined,
    role: u.role as Role,
    status: u.status,
    requestedRole: (u.requested_role || u.role) as Role,
    employeeId: u.employee_id || undefined,
    avatarColor: u.avatar_color || undefined,
    createdAt: u.created_at,
    approvedAt: u.approved_at || undefined,
    approvedBy: u.approved_by_name || undefined,
  }));
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
