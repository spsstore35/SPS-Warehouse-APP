import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, AdjustmentReason, User } from '../types/inventory';
import { X, SlidersHorizontal, AlertCircle, ArrowRight, CheckCircle, Plus, Minus } from 'lucide-react';

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

  // Deduplicate variants
  const dedupedMap = new Map<string, ProductVariant>();
  product.variants.forEach((v) => {
    const key = `${v.size}_${v.colorName}`.toLowerCase();
    if (!dedupedMap.has(key) || v.quantity > 0) {
      dedupedMap.set(key, v);
    }
  });
  const variants = Array.from(dedupedMap.values());

  const defaultVariant = initialVariant || variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id || '');

  const activeVariant =
    variants.find((v) => v.id === selectedVariantId) || defaultVariant || variants[0];

  const currentCount = activeVariant ? activeVariant.quantity : 0;

  // Colors list
  const uniqueColors = Array.from(
    new Map(variants.map((v) => [v.colorName, v])).values()
  );

  const [selectedColor, setSelectedColor] = useState<string>(
    activeVariant?.colorName || uniqueColors[0]?.colorName || 'Standard'
  );

  // Exact typed quantity: MUST BE BLANK BY DEFAULT as requested
  const [exactCountInput, setExactCountInput] = useState<string>('');
  // Stepper delta accumulated
  const [stepperDelta, setStepperDelta] = useState<number>(0);

  const [reason, setReason] = useState<AdjustmentReason>('Physical Count Discrepancy');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // Whenever variant changes, keep typed input blank
  useEffect(() => {
    setExactCountInput('');
    setStepperDelta(0);
    setError('');
  }, [selectedVariantId]);

  // Compute final new count
  const effectiveNewCount =
    exactCountInput.trim() !== ''
      ? Math.max(0, parseInt(exactCountInput, 10) || 0)
      : Math.max(0, currentCount + stepperDelta);

  const delta = effectiveNewCount - currentCount;

  const handleStepDelta = (change: number) => {
    if (exactCountInput.trim() !== '') {
      // If user typed a value, step from that value
      const base = parseInt(exactCountInput, 10) || 0;
      const next = Math.max(0, base + change);
      setExactCountInput(String(next));
    } else {
      // Step from currentCount
      setStepperDelta((prev) => prev + change);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (effectiveNewCount < 0 || isNaN(effectiveNewCount)) {
      setError('Quantity cannot be negative');
      return;
    }

    if (delta === 0) {
      setError('Please type or adjust the verified quantity (current count is already ' + currentCount + ')');
      return;
    }

    if (isAdmin) {
      onAdminDirectAdjust({
        productId: product.id,
        variantId: activeVariant.id,
        newQuantity: effectiveNewCount,
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
        requestedQuantity: effectiveNewCount,
        delta,
        reason,
        workerNote: note,
      });
    }

    onClose();
  };

  // Filter sizes for chosen color
  const sizesForColor = uniqueColors.length > 1
    ? variants.filter((v) => v.colorName === selectedColor)
    : variants;

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
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">
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
              <div className="text-[11px] text-slate-500 truncate">
                {activeVariant.size !== 'One Size' ? `Size ${activeVariant.size}` : ''}{' '}
                {activeVariant.colorName !== 'Standard' ? `· ${activeVariant.colorName}` : ''}
              </div>
            </div>
          </div>

          {/* Color Selector on Top (if multi-color) */}
          {uniqueColors.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                1. Select Color:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {uniqueColors.map((col) => {
                  const isColSelected = selectedColor === col.colorName;
                  return (
                    <button
                      key={col.colorName}
                      type="button"
                      onClick={() => {
                        setSelectedColor(col.colorName);
                        // Pick first variant of this color
                        const firstOfCol = variants.find((v) => v.colorName === col.colorName);
                        if (firstOfCol) {
                          setSelectedVariantId(firstOfCol.id);
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isColSelected
                          ? 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: col.colorHex }}
                      />
                      <span>{col.colorName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sizes for Selected Color */}
          {variants.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                {uniqueColors.length > 1 ? '2. Select Size:' : 'Select Size Variant:'}
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {sizesForColor.map((v) => {
                  const isSelected = v.id === selectedVariantId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`p-2.5 rounded-xl text-center border transition-all ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900 text-white shadow-sm font-black'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 font-bold'
                      }`}
                    >
                      <div className="text-xs">{v.size !== 'One Size' ? `Size ${v.size}` : 'Standard'}</div>
                      <div className={`text-[11px] font-mono mt-0.5 ${isSelected ? 'text-amber-300' : 'text-slate-500'}`}>
                        {v.quantity} units
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                  {effectiveNewCount} <span className="text-xs font-sans text-slate-400 font-normal">units</span>
                </div>
              </div>
            </div>

            {/* Stepper buttons: Only -1 and +1 as requested (removed -10, -5, +5, +10) */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleStepDelta(-1)}
                className="py-2.5 text-xs font-bold rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
                <span>-1 Unit</span>
              </button>
              <button
                type="button"
                onClick={() => handleStepDelta(1)}
                className="py-2.5 text-xs font-bold rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+1 Unit</span>
              </button>
            </div>

            {/* Direct exact input: Kept blank by default so user can type freely */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Or Type Exact Verified Quantity:
              </label>
              <input
                type="number"
                min="0"
                value={exactCountInput}
                onChange={(e) => setExactCountInput(e.target.value)}
                placeholder="Type quantity here (e.g. 15)"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 placeholder:font-sans placeholder:text-slate-400 placeholder:text-xs placeholder:font-normal focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
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

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider flex items-center justify-between">
              <span>{isAdmin ? 'Adjustment Log Note:' : 'Worker Explanation:'}</span>
              <span className="text-[10px] text-slate-500 font-normal">Optional</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isAdmin
                  ? 'e.g. Verified during physical inventory walk'
                  : 'e.g. Packaging defect found on 2 garments'
              }
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Notice */}
          {!isAdmin ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                <strong>Admin Review Required:</strong> This adjustment will appear in the Admin approval queue before inventory counts update.
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5 font-medium">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>
                <strong>Direct Action:</strong> Inventory updates immediately in Supabase and logs to Audit history.
              </span>
            </div>
          )}

          {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-sm min-h-[46px] ${
              isAdmin
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-sky-500 hover:bg-sky-600 text-white'
            }`}
          >
            <span>
              {isAdmin
                ? `Confirm Direct Adjust (${delta > 0 ? `+${delta}` : delta})`
                : `Submit Request (${delta > 0 ? `+${delta}` : delta}) for Approval`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
