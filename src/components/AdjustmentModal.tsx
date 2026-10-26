import React, { useState } from 'react';
import { Product, ProductVariant, AdjustmentReason, User } from '../types/inventory';
import { X, SlidersHorizontal, AlertCircle, ArrowRight, CheckCircle, Plus, Minus, FileText } from 'lucide-react';

interface AdjustmentModalProps {
  product: Product;
  initialVariant?: ProductVariant;
  currentUser: User;
  onClose: () => void;
  onSubmitWorkerRequest: (data: {
    productId: string;
    productName: string;
    productImage: string;
    variantId: string;
    size: ProductVariant['size'];
    colorName: string;
    colorHex: string;
    currentQuantity: number;
    requestedQuantity: number;
    delta: number;
    reason: AdjustmentReason;
    workerNote: string;
  }) => void;
  onAdminDirectAdjust: (data: {
    productId: string;
    variantId: string;
    newQuantity: number;
    reason: string;
    note: string;
  }) => void;
}

const REASONS: AdjustmentReason[] = [
  'Physical Count Discrepancy',
  'Damaged / Defective Garment',
  'New Inbound Shipment Batch',
  'Customer Return Processing',
  'Sample / Marketing Pull',
  'Wrong Tag Correction',
  'Other Correction',
];

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
  product,
  initialVariant,
  currentUser,
  onClose,
  onSubmitWorkerRequest,
  onAdminDirectAdjust,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const defaultVariant = initialVariant || product.variants[0];

  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id || '');
  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) || defaultVariant;

  const currentCount = activeVariant ? activeVariant.quantity : 0;
  const [newCount, setNewCount] = useState<number>(currentCount);
  const [reason, setReason] = useState<AdjustmentReason>('Physical Count Discrepancy');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const delta = newCount - currentCount;

  const handleQuickDelta = (change: number) => {
    const nextVal = Math.max(0, newCount + change);
    setNewCount(nextVal);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newCount < 0 || isNaN(newCount)) {
      setError('Quantity cannot be negative');
      return;
    }

    if (delta === 0) {
      setError('Please change the quantity to record an adjustment (delta is 0)');
      return;
    }

    if (isAdmin) {
      onAdminDirectAdjust({
        productId: product.id,
        variantId: activeVariant.id,
        newQuantity: newCount,
        reason,
        note,
      });
    } else {
      onSubmitWorkerRequest({
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        variantId: activeVariant.id,
        size: activeVariant.size,
        colorName: activeVariant.colorName,
        colorHex: activeVariant.colorHex,
        currentQuantity: currentCount,
        requestedQuantity: newCount,
        delta,
        reason,
        workerNote: note,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Mobile handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-3" />

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isAdmin ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isAdmin ? 'Direct Stock Adjustment' : 'Request Quantity Change'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isAdmin ? 'Admin Master Override' : 'Submits to Admin for approval'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Garment summary banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-white overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-slate-400">Item</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-mono font-semibold text-amber-700">{product.sku}</div>
              <div className="text-sm font-bold text-slate-900 truncate">{product.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{product.description || product.category}</div>
            </div>
          </div>

          {/* Variant Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Select Size & Color Variant:
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
              {product.variants.map((v) => {
                const isSelected = v.id === selectedVariantId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setSelectedVariantId(v.id);
                      setNewCount(v.quantity);
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg text-left text-xs border transition-all ${
                      isSelected
                        ? 'bg-white border-amber-500 text-slate-900 font-bold shadow-sm'
                        : 'bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: v.colorHex }}
                      />
                      <span className="truncate">
                        {v.size} - {v.colorName}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-700 ml-1 font-bold">
                      {v.quantity}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Counts & Delta Calculator */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Current Count</span>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-700">
                  {currentCount} <span className="text-xs font-sans text-slate-400 font-normal">units</span>
                </div>
              </div>

              <div className="text-center">
                <ArrowRight className="w-5 h-5 text-slate-400 mx-auto" />
                <span
                  className={`text-xs font-mono font-bold ${
                    delta > 0
                      ? 'text-emerald-700'
                      : delta < 0
                      ? 'text-rose-700'
                      : 'text-slate-400'
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta === 0 ? '0' : delta}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-bold">New Count</span>
                <div className="text-2xl font-black font-mono tabular-nums text-slate-900">
                  {newCount} <span className="text-xs font-sans text-slate-400 font-normal">units</span>
                </div>
              </div>
            </div>

            {/* Stepper buttons for quick physical count adjustments */}
            <div className="grid grid-cols-6 gap-1.5 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleQuickDelta(-10)}
                className="py-2 text-xs font-mono font-bold rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 shadow-sm"
              >
                -10
              </button>
              <button
                type="button"
                onClick={() => handleQuickDelta(-5)}
                className="py-2 text-xs font-mono font-bold rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 shadow-sm"
              >
                -5
              </button>
              <button
                type="button"
                onClick={() => handleQuickDelta(-1)}
                className="py-2 text-xs font-mono font-bold rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 shadow-sm"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => handleQuickDelta(1)}
                className="py-2 text-xs font-mono font-bold rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 shadow-sm"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => handleQuickDelta(5)}
                className="py-2 text-xs font-mono font-bold rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 shadow-sm"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => handleQuickDelta(10)}
                className="py-2 text-xs font-mono font-bold rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 shadow-sm"
              >
                +10
              </button>
            </div>

            {/* Direct exact input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Or Type Exact Verified Quantity:
              </label>
              <input
                type="number"
                min="0"
                value={newCount}
                onChange={(e) => setNewCount(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Reason for Adjustment:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as AdjustmentReason)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-600"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Worker / Admin Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span>{isAdmin ? 'Adjustment Log Note:' : 'Worker Explanation / Notes:'}</span>
              <span className="text-[10px] text-slate-500 font-normal">Optional</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isAdmin
                  ? 'e.g. Stock count verified by warehouse owner'
                  : 'e.g. Completed morning physical count, packaging damaged on 4 units'
              }
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Workflow Notice */}
          {!isAdmin ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                <strong>Admin Approval Required:</strong> Your adjustment request will be reviewed by the Admin.
                The live inventory total will only update once the Admin approves it.
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5 font-medium">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>
                <strong>Direct Admin Action:</strong> Inventory will update immediately and be recorded in the Stock Audit Log.
              </span>
            </div>
          )}

          {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full py-3.5 px-4 rounded-xl font-black text-sm text-slate-950 flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] min-h-[48px] ${
              isAdmin
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-sky-500 hover:bg-sky-600 text-white'
            }`}
          >
            <span>
              {isAdmin
                ? `Confirm Direct Adjust (${delta > 0 ? `+${delta}` : delta})`
                : `Submit Request (${delta > 0 ? `+${delta}` : delta}) for Admin Approval`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
