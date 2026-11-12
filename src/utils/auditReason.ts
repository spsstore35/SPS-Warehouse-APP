import { AuditLogEntry } from '../types/inventory';

/**
 * Extracts a clear, human-friendly reason / type for any stock audit log entry,
 * optimized for notification titles and audit cards (e.g. "Staff Request 70% Deposit",
 * "Making Order #SPS-09112601").
 */
export function formatAuditLogReason(log: AuditLogEntry): string {
  // If an explicit meaningful reason was provided (e.g. "Wrong Tag Correction", "Physical Count Discrepancy", "Damaged / Defective Garment", or custom text), always honor it first!
  if (
    log.reason &&
    log.reason.trim() !== '' &&
    !log.reason.toLowerCase().includes('direct physical adjustment')
  ) {
    return log.reason.trim();
  }

  const combined = `${log.summary || ''} ${log.details || ''} ${log.reason || ''}`.toLowerCase();

  // Extract booking reference if present
  const bookingMatch = (log.bookingNumber || log.details || log.summary || '').match(/SPS-\d+/i);
  const bookingNum = log.bookingNumber || (bookingMatch ? bookingMatch[0].toUpperCase() : undefined);

  // 1. Staff Deposit Change Request (Matches user example: "Staff Request 70% Deposit")
  if (
    combined.includes('staff requested changing') ||
    combined.includes('staff request: change deposit') ||
    combined.includes('awaiting admin approval') ||
    (combined.includes('staff') && combined.includes('deposit') && combined.includes('pending'))
  ) {
    const match = combined.match(/to (\d+)%/i) || combined.match(/(\d+)%/);
    const pct = match ? match[1] : undefined;
    return pct ? `Staff Request ${pct}% Deposit` : 'Staff Deposit Request';
  }

  // 2. Deposit terms updated by admin / confirmed
  if (
    combined.includes('updated required deposit') ||
    combined.includes('deposit terms updated') ||
    combined.includes('confirmed deposit change') ||
    combined.includes('approved staff deposit')
  ) {
    const match = combined.match(/to (\d+)%/i) || combined.match(/(\d+)%/);
    const pct = match ? match[1] : undefined;
    return pct ? `Deposit Terms Updated (${pct}%)` : 'Deposit Terms Updated';
  }

  // 3. User account / role changes
  if (
    log.action === 'role_changed' ||
    log.action === 'account_updated' ||
    log.action === 'account_deleted' ||
    log.action === 'staff_approved' ||
    log.action === 'staff_rejected' ||
    combined.includes('worker to admin') ||
    combined.includes('admin to worker')
  ) {
    if (combined.includes('new account') || combined.includes('registration') || log.reason?.toLowerCase().includes('registration')) {
      return 'New Account Registration';
    }
    if (combined.includes('worker to admin')) return 'Role Changed: Worker → Admin';
    if (combined.includes('admin to worker')) return 'Role Changed: Admin → Worker';
    if (log.action === 'staff_approved' || combined.includes('approved staff')) return 'Staff Account Approved';
    if (log.action === 'account_deleted') return 'User Account Removed';
    return 'User Role & Permissions Update';
  }

  // 4. Order creation (Matches user example: "Making Order #SPS-09112601")
  if (
    log.action === 'booking_created' ||
    combined.includes('booking created') ||
    combined.includes('created booking') ||
    combined.includes('making order')
  ) {
    return bookingNum ? `Making Order #${bookingNum}` : 'Making Order';
  }

  // 5. Booking status change (delivered, handover, preparing)
  if (
    log.action === 'booking_status_changed' ||
    log.action === 'booking_deposit_paid' ||
    combined.includes('delivered') ||
    combined.includes('preparing') ||
    combined.includes('deposit paid')
  ) {
    if (combined.includes('delivered') || combined.includes('handover')) {
      return bookingNum ? `Order #${bookingNum} Delivered` : 'Order Delivered';
    }
    if (combined.includes('deposit paid') || combined.includes('received')) {
      return bookingNum ? `Order #${bookingNum} Deposit Paid` : 'Deposit Received';
    }
    return bookingNum ? `Order #${bookingNum} Status Update` : 'Order Status Update';
  }

  // 6. Product catalog management
  if (log.action === 'product_created' || log.action === 'product_submitted') {
    return `Added New Item: ${log.productName || 'Catalog Product'}`;
  }
  if (log.action === 'product_deleted') {
    return `Removed Item: ${log.productName || 'Catalog Product'}`;
  }
  if (log.action === 'product_updated') {
    return `Updated Item: ${log.productName || 'Catalog Product'}`;
  }
  if (log.action === 'variant_deleted') {
    return `Variant Removed: ${log.productName || 'Garment Variant'}`;
  }

  // 7. Stock adjustments (defaults to "Stock Adjustment: {Item Name}")
  if (log.action === 'stock_adjusted' || log.action === 'request_approved' || log.delta !== undefined) {
    const prodName = log.productName || 'Inventory';
    return `Stock Adjustment: ${prodName}`;
  }

  // 8. Explicit reason if provided and not generic
  if (log.reason && log.reason !== 'Direct Physical Adjustment') {
    return log.reason;
  }

  // 9. If booking exists
  if (bookingNum) {
    return `Order #${bookingNum} Record`;
  }

  // 10. Fallback
  return log.summary ? log.summary.slice(0, 45) : 'Inventory Activity Log';
}
