export type Role = 'full_admin' | 'admin' | 'worker' | 'leader';
export type UserStatus = 'active' | 'pending' | 'rejected';

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
  username?: string;
  phone?: string;
  status: UserStatus;
  requestedRole?: Role;
  employeeId?: string;
  avatarColor?: string;
  assignedTeams?: StoreTeamId[];
  /** Teams where this person is team_admin (from user_teams). Staff teams are the rest of assignedTeams. */
  adminTeams?: StoreTeamId[];
  assignedFare2?: string[];
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
  folder?: string; // Sub-folder inside 'Others' category (e.g. 'Wegla', 'Pins & Badges', 'Wa3d', etc.)
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
  | 'Other Correction'
  | (string & {});

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
    | 'account_updated'
    | 'role_changed'
    | 'request_approved'
    | 'request_rejected'
    | 'staff_approved'
    | 'staff_rejected'
    | 'booking_created'
    | 'booking_updated'
    | 'booking_deleted'
    | 'booking_status_changed'
    | 'booking_deposit_paid'
    | 'booking_payment_verification_requested'
    | 'team_change_request';
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

export type BookingStockCheckStatus =
  | 'in_stock'
  | 'needs_production'
  | 'in_production'
  | 'ready_for_handover';

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
  source?: string; // 'public_link' for orders from the public order page
  teamName?: string;
  paymentMethod?: string;
  troopGroup?: string; // Ashbal, Zahrat, Kashafeen, Morshedat, 3ashera 1, 3ashera 2, Afrad
  assignedFare2?: string; // Resolved Scout Fera2 sub-team (Ashbal..3ashera 2) for Afrad / Unassigned or specific orders
  assignedToId?: string;
  assignedToName?: string;
  sharedWithId?: string; // one extra person sharing the order task (booking only)
  sharedWithName?: string;
  waSentAt?: string; // when the invoice PDF was sent on WhatsApp
  waSentByName?: string;
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
  paymentVerificationRequested?: boolean;
  paymentVerificationRequestedBy?: string;
  paymentVerificationRequestedAt?: string;
  paymentVerificationNote?: string;
  status: BookingStatus;
  stockCheckStatus?: BookingStockCheckStatus;
  inventoryDeducted: boolean;
  createdById: string;
  createdByName: string;
  createdByRole: Role;
  createdAt: string;
  updatedAt: string;
}

export type CalendarItemType = 'event' | 'task';

export type BoardColumnStatus = 'upcoming' | 'in_progress' | 'done';

export type StoreTeamId =
  | 'purchases'
  | 'troops'
  | 'inventory'
  | 'calendar'
  | 'marketing'
  | 'budgeting';

export interface CalendarItem {
  id: string;
  title: string;
  itemType: CalendarItemType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  allDay: boolean;
  completed: boolean;
  boardStatus?: BoardColumnStatus;
  team?: StoreTeamId;
  teams?: StoreTeamId[];
  isAllTeams?: boolean;
  assignedToId?: string;
  assignedToName?: string;
  troopGroup?: string;
  location?: string;
  notes?: string;
  linkedBookingId?: string;
  linkedBatchId?: string;
  linkedOfferId?: string;
  workflowStage?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type VendorBehaviorTag =
  | 'regular'
  | 'occasional'
  | 'negotiable'
  | 'fixed_price'
  | 'on_time'
  | 'delays'
  | 'easy_smooth'
  | 'difficult';

export interface Vendor {
  id: string;
  name: string;
  location: string;
  mapsUrl?: string;
  contactPerson?: string;
  phone?: string;
  tags: VendorBehaviorTag[];
  generalNotes?: string;
  createdAt: string;
}

export type WorkflowType = 'manufactured' | 'ready_made';

export type StandardOperationStageKey =
  | 'raw_material'
  | 'manufacturing'
  | 'tailor'
  | 'supplier_sourcing'
  | 'packaging'
  | 'stock_in';

export type OperationStageKey = StandardOperationStageKey | (string & {});

export interface CustomStageDefinition {
  key: string;
  label: string;
  shortLabel?: string;
  description?: string;
  defaultUnit?: string;
}

export interface ProductWorkflow {
  id: string;
  productId: string;
  workflowType: WorkflowType;
  activeStages: OperationStageKey[];
  customStages?: Record<string, CustomStageDefinition>;
  stageLeadTimes?: Record<string, number>;
  sharedGroupId?: string;
  sharedGroupName?: string;
  templateSourceProductId?: string;
  updatedAt?: string;
}

export interface WorkflowTemplateApplication {
  sourceProductId: string;
  targetProductId: string;
  mode: 'same_all' | 'pipeline_only' | 'unlink';
  sharedGroupName?: string;
}

export interface ProductStageVendor {
  id: string;
  productId: string;
  stageKey: OperationStageKey;
  vendorId: string;
  isPrimary: boolean;
  approxOrderQty: string;
  orderScriptNotes: string;
}

export interface VendorPriceEntry {
  id: string;
  productStageVendorId: string;
  purchaseDate: string; // YYYY-MM-DD
  unitPrice: number;
  quantity: string;
  notes?: string;
}

export interface BatchCostLine {
  id: string;
  kind: 'purchase' | 'transport' | 'other';
  label: string; // what was bought / which trip
  amount: number; // EGP
  from?: string; // transport: from where
  to?: string; // transport: to where
  note?: string;
}

export interface BatchStageAssignment {
  leadTimeDays?: number; // ready-made: days the supplier needs for THIS order (typed each time)
  unitsPerBox?: number; // ready-made: pieces in one box/carton
  boxes?: number; // ready-made: number of boxes ordered
  startedAt?: string; // YYYY-MM-DD
  endedAt?: string; // YYYY-MM-DD
  costLines?: BatchCostLine[];
  vendorId?: string;
  customVendorName?: string;
  cost?: number; // price per unit (meter / piece ...)
  unitQty?: number; // how many units were bought (e.g. 14 meters)
  totalCost?: number;
  notes?: string;
  completedAt?: string;
}

export interface ProductionBatch {
  id: string;
  batchCode: string;
  productId: string;
  variantId?: string;
  quantity: number;
  /** Pieces per size/colour when one batch covers several variants of the same item (variantId -> pcs). Adds up to quantity. */
  variantQty?: Record<string, number>;
  targetDate?: string;
  currentStageKey: OperationStageKey;
  status: 'in_progress' | 'completed';
  stageAssignments: Record<string, BatchStageAssignment>;
  linkedBookingId?: string;
  linkedBookingNumber?: string;
  /** Other orders (same item) covered by this one batch. */
  extraBookingIds?: string[];
  extraBookingNumbers?: string[];
  requestedByTeam?: string;
  createdAt: string;
  completedAt?: string;
}

export type MarketingOfferType = 'percentage' | 'fixed_price' | 'bundle_note';
export type MarketingOfferStatus = 'active' | 'scheduled' | 'paused' | 'ended';

export interface MarketingOffer {
  id: string;
  productId: string;
  title: string;
  offerType: MarketingOfferType;
  discountPercent: number;
  offerPrice?: number;
  badgeText: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: MarketingOfferStatus;
  notes?: string;
  createdById?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export type BudgetExpenseCategory =
  | 'production_extras'
  | 'packaging'
  | 'transport'
  | 'rent_utilities'
  | 'marketing'
  | 'hardship_subsidy'
  | 'other';

export interface ProductBudgetProfile {
  productId: string;
  manufacturingCost: number;
  extraPrepCost: number;
  targetMarginPercent?: number;
  hardshipDiscountType?: 'percentage' | 'fixed_amount';
  hardshipDiscountValue?: number;
  notes?: string;
  updatedAt: string;
}

export interface BudgetExpenseEntry {
  id: string;
  title: string;
  category: BudgetExpenseCategory;
  amount: number;
  expenseDate: string; // YYYY-MM-DD
  linkedProductId?: string;
  notes?: string;
  createdByName?: string;
  createdAt: string;
}

export interface BudgetSettings {
  id: string;
  cashOnHand?: number;
  reserveBuffer: number;
  updatedAt: string;
}

export interface ScoutSeason {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  colorHex?: string;
  notes?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Fare2LeaderAssignment {
  userId: string;
  userName: string;
}

export interface ShortageBatchConfig {
  productId: string;
  variantId: string;
  quantity: number;
  stageAssignments: Record<string, BatchStageAssignment>;
  targetDate?: string;
  extraBookingIds?: string[];
  extraBookingNumbers?: string[];
}

export type TeamRequestEntityType =
  | 'calendar_item'
  | 'scout_season'
  | 'booking_create'
  | 'booking_edit'
  | 'booking_delete'
  | 'booking_status'
  | 'public_sale_item'
  | 'public_sale_settings'
  | 'public_sale_other'
  | 'sourcing_vendor'
  | 'sourcing_workflow'
  | 'sourcing_stage_vendor'
  | 'sourcing_price'
  | 'sourcing_batch'
  | 'sourcing_stock_in'
  | 'sourcing_template'
  | 'marketing_offer'
  | 'budget_profile'
  | 'budget_expense'
  | 'budget_settings'
  | 'budget_price'
  | 'category';

export interface TeamChangeRequest {
  id: string;
  teamScope: StoreTeamId;
  entityType: TeamRequestEntityType;
  actionType: 'create' | 'update' | 'delete';
  title: string;
  summary: string;
  payload: any;
  targetId?: string;
  status: ApprovalStatus;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  adminNote?: string;
}
