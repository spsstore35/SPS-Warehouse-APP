export type Role = 'admin' | 'worker';
export type UserStatus = 'active' | 'pending' | 'rejected';

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  password?: string;
  status: UserStatus;
  requestedRole?: Role;
  employeeId?: string;
  avatarColor?: string;
  createdAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  displayOrder?: number;
  createdAt?: string;
}

export type GarmentCategory = string;

export type GarmentSize = 
  | 'XS' 
  | 'S' 
  | 'M' 
  | 'L' 
  | 'XL' 
  | '2XL' 
  | '3XL' 
  | 'One Size' 
  | (string & {});

export interface ColorVariant {
  name: string;
  hex: string;
}

export interface ProductVariant {
  id: string;
  size: GarmentSize;
  colorName: string;
  colorHex: string;
  quantity: number;
  sku: string;
  minThreshold?: number; // low stock warning
}

export type TargetAudience = 'Men' | 'Women' | 'Kids' | 'Unisex';

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId?: string;
  category: GarmentCategory;
  targetAudience: TargetAudience;
  description: string;
  fabricDetails?: string;
  price?: number; // wholesale / retail tag
  image: string; // Primary image / Base64 or fallback SVG
  images?: string[]; // Multiple photos for the product
  variants: ProductVariant[];
  totalQuantity: number;
  location?: string; // e.g. "Rack B-04 / Shelf 2"
  status?: 'active' | 'pending' | 'rejected';
  createdByRole?: Role;
  createdByName?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export type AdjustmentReason = 
  | 'Physical Count Discrepancy'
  | 'Damaged / Defective Garment'
  | 'New Inbound Shipment Batch'
  | 'Customer Return Processing'
  | 'Sample / Marketing Pull'
  | 'Wrong Tag Correction'
  | 'Other Correction';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface AdjustmentRequest {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  variantId: string;
  size: GarmentSize;
  colorName: string;
  colorHex: string;
  currentQuantity: number;
  requestedQuantity: number;
  delta: number; // e.g. +5 or -2
  reason: AdjustmentReason;
  workerNote?: string;
  workerId: string;
  workerName: string;
  status: ApprovalStatus;
  adminNote?: string;
  adminId?: string;
  adminName?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action:
    | 'stock_adjusted'
    | 'product_created'
    | 'product_submitted'
    | 'product_updated'
    | 'product_deleted'
    | 'variant_deleted'
    | 'account_deleted'
    | 'request_approved'
    | 'request_rejected'
    | 'staff_approved'
    | 'staff_rejected'
    | 'booking_created'
    | 'booking_status_changed'
    | 'booking_deposit_paid';
  actorName: string;
  actorRole: Role;
  summary: string;
  details?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  variantSize?: string;
  variantColor?: string;
  oldQuantity?: number;
  newQuantity?: number;
  delta?: number;
  totalQuantityBefore?: number;
  totalQuantityAfter?: number;
  reason?: string;
  note?: string;
  bookingId?: string;
  bookingNumber?: string;
  bookingItems?: BookingItem[];
}

export type BookingStatus = 'pending' | 'preparing' | 'delivered' | 'done';

export interface BookingItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImage?: string;
  variantId: string;
  size: GarmentSize;
  colorName: string;
  colorHex: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  availableStock: number;
  deficitQuantity: number;
  minThreshold?: number;
  recommendedProduction?: number;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  clientName: string;
  clientPhone: string;
  notes?: string;
  items: BookingItem[];
  subtotal: number;
  discount: number;
  total: number;
  depositRate: number; // e.g. 0.5 (50%), 0.7 (70%), 1.0 (100%)
  depositPercentage?: number; // 50, 70, 100, or custom
  pendingDepositPercentage?: number; // Staff requested deposit percentage awaiting admin approval
  pendingDepositPercentageBy?: string; // Name of staff who requested change
  pendingDepositPercentageAt?: string; // Request timestamp
  depositRequired: number; // total * depositRate
  depositPaid: boolean;
  depositPaidAmount: number;
  depositPaidAt?: string;
  finalPaidAmount?: number;
  finalPaidAt?: string;
  status: BookingStatus;
  inventoryDeducted: boolean;
  createdById: string;
  createdByName: string;
  createdByRole: Role;
  createdAt: string;
  updatedAt: string;
}

