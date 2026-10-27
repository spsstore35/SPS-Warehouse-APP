import React from 'react';
import { AuditLogEntry, Product } from '../types/inventory';
import {
  X,
  ShieldCheck,
  UserCheck,
  Clock,
  ArrowRight,
  TrendingUp,
  Package,
  Layers,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';

interface ActivityDetailModalProps {
  log: AuditLogEntry | null;
  product?: Product;
  onClose: () => void;
  onViewProduct?: (productId: string) => void;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  log,
  product,
  onClose,
  onViewProduct,
}) => {
  if (!log) return null;

  const isAdmin = log.actorRole === 'admin';
  const effectiveImage = log.productImage || product?.image || product?.images?.[0];
  const delta = log.delta;
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  // Determine friendly narrative title & summary
  const getFriendlyTitle = () => {
    switch (log.action) {
      case 'stock_adjusted':
        return 'Stock Quantity Adjustment';
      case 'request_approved':
        return 'Approved Staff Stock Adjustment';
      case 'product_created':
        return 'New Item Added to Catalog';
      case 'product_updated':
        return 'Item Details Updated';
      case 'product_deleted':
        return 'Item Removed from Catalog';
      case 'variant_deleted':
        return 'Variant Size Removed';
      case 'account_deleted':
        return 'User Account Deleted';
      default:
        return 'Inventory Activity Record';
    }
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isAdmin
                  ? 'bg-amber-100/80 text-amber-900 border border-amber-300'
                  : 'bg-sky-100/80 text-sky-900 border border-sky-300'
              }`}
            >
              {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">{getFriendlyTitle()}</h3>
              <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>
                  {new Date(log.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Product Banner Card with Image */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center gap-4">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-200/80 border border-slate-300 shrink-0 shadow-sm flex items-center justify-center">
              {effectiveImage ? (
                <img
                  src={effectiveImage}
                  alt={log.productName || 'Product'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon className="w-6 h-6 mb-0.5" />
                  <span className="text-[9px]">No photo</span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-medium">
                {product?.sku && (
                  <span className="font-mono text-amber-700 font-bold">{product.sku}</span>
                )}
                {product?.category && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{product.category}</span>
                  </>
                )}
                {product?.targetAudience && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[10px]">
                      {product.targetAudience}
                    </span>
                  </>
                )}
              </div>

              <h4 className="text-base sm:text-lg font-black text-slate-900 mt-1 truncate">
                {log.productName || product?.name || 'Warehouse Garment'}
              </h4>

              {/* Actor attribution badge */}
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-600">
                <span className="font-bold text-slate-800">{log.actorName}</span>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                  {log.actorRole === 'admin' ? 'Admin Authority' : 'Floor Staff'}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Narrative Explanation Section (Shar7 Tafseely) */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/90 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-700" />
              <span>Detailed Inventory Breakdown (شرح تفصيلي)</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
              {log.variantSize ? (
                <>
                  Inventory for{' '}
                  <strong className="text-slate-950 font-black">
                    "{log.productName || product?.name}"
                  </strong>{' '}
                  was updated. Size{' '}
                  <strong className="text-amber-900 font-black">{log.variantSize}</strong>{' '}
                  {log.variantColor ? `(${log.variantColor})` : ''} was changed from{' '}
                  <span className="font-mono font-bold text-slate-700">
                    {log.oldQuantity ?? 0} units
                  </span>{' '}
                  to{' '}
                  <span className="font-mono font-black text-emerald-700">
                    {log.newQuantity ?? 0} units
                  </span>
                  {delta !== undefined && (
                    <span
                      className={`ml-1 font-bold ${
                        isPositive ? 'text-emerald-700' : isNegative ? 'text-rose-700' : 'text-slate-700'
                      }`}
                    >
                      ({isPositive ? `+${delta}` : delta} units)
                    </span>
                  )}
                  .{' '}
                  {log.totalQuantityAfter !== undefined && (
                    <>
                      The total stock for this item is now{' '}
                      <strong className="font-mono text-slate-950 font-black">
                        {log.totalQuantityAfter} total units
                      </strong>
                      {log.totalQuantityBefore !== undefined && (
                        <span className="text-slate-600">
                          {' '}
                          (previously {log.totalQuantityBefore} units)
                        </span>
                      )}
                      .
                    </>
                  )}
                </>
              ) : (
                log.details || log.summary
              )}
            </p>
          </div>

          {/* Visual Stock Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Box 1: Variant Count Transition */}
            {log.oldQuantity !== undefined && log.newQuantity !== undefined && (
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400">Size Stock</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base font-bold font-mono text-slate-400 line-through">
                    {log.oldQuantity}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-lg font-black font-mono text-slate-900">
                    {log.newQuantity}
                  </span>
                  <span className="text-xs text-slate-500">units</span>
                </div>
                {delta !== undefined && (
                  <span
                    className={`inline-block mt-1 px-1.5 py-0.2 rounded text-[10px] font-black ${
                      isPositive
                        ? 'bg-emerald-100 text-emerald-800'
                        : isNegative
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isPositive ? `+${delta} Added` : `${delta} Deducted`}
                  </span>
                )}
              </div>
            )}

            {/* Box 2: Total Product Stock */}
            {log.totalQuantityAfter !== undefined && (
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Item Stock</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black font-mono text-amber-700">
                    {log.totalQuantityAfter}
                  </span>
                  <span className="text-xs text-slate-500">units</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {log.totalQuantityBefore !== undefined
                    ? `From ${log.totalQuantityBefore} units`
                    : 'Current on hand'}
                </div>
              </div>
            )}

            {/* Box 3: Reason / Classification */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Reason / Type</div>
              <div className="text-xs font-bold text-slate-800 mt-1 line-clamp-2">
                {log.reason || 'Direct Physical Adjustment'}
              </div>
              {log.note && (
                <div className="text-[11px] text-slate-500 mt-1 italic line-clamp-1">
                  "{log.note}"
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          {product && onViewProduct ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewProduct(product.id);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View "{product.name}" in Catalog</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400">Audit record is secured in database log</div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors min-h-[40px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
