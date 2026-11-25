import React, { useEffect, useState } from 'react';
import {
  BatchStageAssignment,
  OperationStageKey,
  Product,
  ProductStageVendor,
  ProductionBatch,
  Vendor,
  VendorBehaviorTag,
  VendorPriceEntry,
} from '../types/inventory';
import { VENDOR_TAG_GROUPS, getStageMeta } from '../utils/sourcing';
import { X, Check, MapPin, Phone, User as UserIcon, Package, Factory, Calendar } from 'lucide-react';

interface GlobalVendorModalProps {
  isOpen: boolean;
  initialVendor?: Vendor | null;
  onClose: () => void;
  onSave: (vendor: Vendor) => void;
}

export const GlobalVendorModal: React.FC<GlobalVendorModalProps> = ({
  isOpen,
  initialVendor,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [tags, setTags] = useState<VendorBehaviorTag[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialVendor) {
      setName(initialVendor.name);
      setLocation(initialVendor.location || '');
      setMapsUrl(initialVendor.mapsUrl || '');
      setContactPerson(initialVendor.contactPerson || '');
      setPhone(initialVendor.phone || '');
      setTags(initialVendor.tags || []);
      setGeneralNotes(initialVendor.generalNotes || '');
    } else {
      setName('');
      setLocation('');
      setMapsUrl('');
      setContactPerson('');
      setPhone('');
      setTags(['regular', 'negotiable', 'on_time', 'easy_smooth']);
      setGeneralNotes('');
    }
    setError('');
  }, [isOpen, initialVendor]);

  if (!isOpen) return null;

  const toggleTag = (tagId: VendorBehaviorTag) => {
    setTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vendor / Factory Name is required.');
      return;
    }
    const vendor: Vendor = {
      id: initialVendor?.id || `vnd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      location: location.trim(),
      mapsUrl: mapsUrl.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      tags,
      generalNotes: generalNotes.trim() || undefined,
      createdAt: initialVendor?.createdAt || new Date().toISOString(),
    };
    onSave(vendor);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-4">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">
              {initialVendor ? 'Edit Vendor Profile' : 'Add Global Vendor'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Vendor / Factory Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Al-Mahalla Textile Mills"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contact Person Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Hany El-Naggar"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone / WhatsApp Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 01012345678"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Location / Address
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Gesr El-Suez Industrial Zone"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Google Maps Link (Optional)
              </label>
              <input
                type="url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="text-xs font-bold text-slate-700">
              Vendor Behavior &amp; Reliability Checkboxes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {VENDOR_TAG_GROUPS.map((grp) => (
                <div
                  key={grp.group}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                >
                  <div className="text-[11px] font-bold text-slate-500">{grp.group}</div>
                  <div className="space-y-1.5">
                    {grp.options.map((opt) => {
                      const checked = tags.includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none min-h-[28px]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTag(opt.id)}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              General Vendor Notes
            </label>
            <textarea
              rows={3}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Payment terms, pickup hours, minimum order notes..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-900 resize-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
            >
              <Check className="w-4 h-4" />
              <span>{initialVendor ? 'Save Vendor Changes' : 'Save Vendor'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface StartBatchModalProps {
  isOpen: boolean;
  product: Product;
  activeStages: OperationStageKey[];
  vendors: Vendor[];
  productStageVendors: ProductStageVendor[];
  priceHistory: VendorPriceEntry[];
  existingBatchCount: number;
  initialBatch?: ProductionBatch | null;
  onClose: () => void;
  onCreateBatch: (batch: ProductionBatch) => void;
}

export const StartBatchModal: React.FC<StartBatchModalProps> = ({
  isOpen,
  product,
  activeStages,
  vendors,
  productStageVendors,
  priceHistory,
  existingBatchCount,
  initialBatch,
  onClose,
  onCreateBatch,
}) => {
  const [batchCode, setBatchCode] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [variantId, setVariantId] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [assignments, setAssignments] = useState<Record<string, BatchStageAssignment>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialBatch) {
      setBatchCode(initialBatch.batchCode);
      setQuantity(initialBatch.quantity);
      setVariantId(initialBatch.variantId || product.variants[0]?.id || '');
      setTargetDate(initialBatch.targetDate || '');

      const mergedAssignments: Record<string, BatchStageAssignment> = {
        ...(initialBatch.stageAssignments || {}),
      };
      activeStages.forEach((stageKey) => {
        if (stageKey === 'stock_in') return;
        if (!mergedAssignments[stageKey]) {
          mergedAssignments[stageKey] = {};
        }
      });
      setAssignments(mergedAssignments);
      setError('');
      return;
    }

    setBatchCode(`Batch #${105 + existingBatchCount}`);
    setQuantity(100);
    setVariantId(product.variants[0]?.id || '');
    const defaultTarget = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    setTargetDate(defaultTarget);

    // Pre-fill each stage with primary vendor and latest recorded price
    const nextAssignments: Record<string, BatchStageAssignment> = {};
    activeStages.forEach((stageKey) => {
      if (stageKey === 'stock_in') return;
      const links = productStageVendors.filter(
        (psv) => psv.productId === product.id && psv.stageKey === stageKey
      );
      const chosen = links.find((l) => l.isPrimary) || links[0];
      if (chosen) {
        const latestPrice = priceHistory
          .filter((ph) => ph.productStageVendorId === chosen.id)
          .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))[0];
        nextAssignments[stageKey] = {
          vendorId: chosen.vendorId,
          cost: latestPrice?.unitPrice,
        };
      } else {
        nextAssignments[stageKey] = {};
      }
    });
    setAssignments(nextAssignments);
    setError('');
  }, [isOpen, initialBatch, product, activeStages, productStageVendors, priceHistory, existingBatchCount]);

  if (!isOpen) return null;

  const productionStages = activeStages.filter((k) => k !== 'stock_in');
  const firstStage = activeStages[0] || 'stock_in';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCode.trim()) {
      setError('Batch Code is required.');
      return;
    }
    if (!quantity || quantity <= 0) {
      setError('Batch quantity must be greater than 0.');
      return;
    }

    const batch: ProductionBatch = initialBatch
      ? {
          ...initialBatch,
          batchCode: batchCode.trim(),
          variantId: variantId || undefined,
          quantity: Math.round(quantity),
          targetDate: targetDate || undefined,
          stageAssignments: assignments,
        }
      : {
          id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          batchCode: batchCode.trim(),
          productId: product.id,
          variantId: variantId || undefined,
          quantity: Math.round(quantity),
          targetDate: targetDate || undefined,
          currentStageKey: firstStage,
          status: 'in_progress',
          stageAssignments: assignments,
          createdAt: new Date().toISOString(),
        };
    onCreateBatch(batch);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-4">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {initialBatch ? 'Edit Open Production Batch' : 'Start New Production Batch'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[340px]">
              {product.name} · SKU {product.sku}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Batch Code *</label>
              <input
                type="text"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="Batch #105"
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Quantity (pcs) *
              </label>
              <input
                type="number"
                min={1}
                value={quantity || ''}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Completion
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </div>

          {product.variants.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Stock-In Variant (for Gard)
              </label>
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    Size {v.size} · {v.colorName} (Current: {v.quantity} pcs)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            <div className="text-xs font-bold text-slate-700">
              Stage Vendors &amp; Expected Unit Costs (auto-defaulted to ★ Primary)
            </div>
            <div className="space-y-2">
              {productionStages.map((stageKey, idx) => {
                const meta = getStageMeta(stageKey);
                const stageLinks = productStageVendors.filter(
                  (psv) => psv.productId === product.id && psv.stageKey === stageKey
                );
                const linkedVendorIds = new Set(stageLinks.map((l) => l.vendorId));
                const stageVendorOptions = [
                  ...vendors.filter((v) => linkedVendorIds.has(v.id)),
                  ...vendors.filter((v) => !linkedVendorIds.has(v.id)),
                ];
                const current = assignments[stageKey] || {};

                return (
                  <div
                    key={stageKey}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="sm:col-span-5">
                      <div className="text-xs font-bold text-slate-900">
                        0{idx + 1}. {meta.shortLabel}
                      </div>
                      <div className="text-[11px] text-slate-500">Cost per {meta.defaultUnit}</div>
                    </div>

                    <div className="sm:col-span-4">
                      <select
                        value={current.vendorId || ''}
                        onChange={(e) => {
                          const vId = e.target.value;
                          const matchingPsv = stageLinks.find((l) => l.vendorId === vId);
                          const latestPrice = matchingPsv
                            ? priceHistory
                                .filter((ph) => ph.productStageVendorId === matchingPsv.id)
                                .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))[0]
                            : undefined;
                          setAssignments((prev) => ({
                            ...prev,
                            [stageKey]: {
                              ...prev[stageKey],
                              vendorId: vId || undefined,
                              cost:
                                latestPrice?.unitPrice !== undefined
                                  ? latestPrice.unitPrice
                                  : prev[stageKey]?.cost,
                            },
                          }));
                        }}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900"
                      >
                        <option value="">Select vendor...</option>
                        {stageVendorOptions.map((v) => {
                          const link = stageLinks.find((l) => l.vendorId === v.id);
                          return (
                            <option key={v.id} value={v.id}>
                              {link?.isPrimary ? `★ ${v.name} (Primary)` : v.name}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={current.cost ?? ''}
                          onChange={(e) =>
                            setAssignments((prev) => ({
                              ...prev,
                              [stageKey]: {
                                ...prev[stageKey],
                                cost: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            }))
                          }
                          placeholder="0.00"
                          className="w-full pl-2.5 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
                          EGP
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
            >
              <Check className="w-4 h-4" />
              <span>{initialBatch ? 'Save Batch Changes' : 'Start Batch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CompleteStockInModalProps {
  batch: ProductionBatch | null;
  product: Product | null;
  vendors: Vendor[];
  onClose: () => void;
  onConfirm: (payload: {
    batchId: string;
    finalQuantity: number;
    variantId: string;
  }) => void;
}

export const CompleteStockInModal: React.FC<CompleteStockInModalProps> = ({
  batch,
  product,
  vendors,
  onClose,
  onConfirm,
}) => {
  const [finalQuantity, setFinalQuantity] = useState<number>(0);
  const [variantId, setVariantId] = useState<string>('');

  useEffect(() => {
    if (!batch || !product) return;
    setFinalQuantity(batch.quantity);
    setVariantId(batch.variantId || product.variants[0]?.id || '');
  }, [batch, product]);

  if (!batch || !product) return null;

  const assignedCostStages = Object.entries(batch.stageAssignments || {}).filter(
    ([, val]) => val?.vendorId && typeof val.cost === 'number' && val.cost > 0
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-700" />
            <h3 className="text-base font-bold text-slate-900">Complete &amp; Stock In (Gard)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-sm text-slate-700">
            Ready to stock in <span className="font-bold text-slate-900">{batch.batchCode}</span>{' '}
            for <span className="font-bold text-slate-900">{product.name}</span>.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Final QC Quantity (pcs)
              </label>
              <input
                type="number"
                min={1}
                value={finalQuantity || ''}
                onChange={(e) => setFinalQuantity(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            {product.variants.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Credit to Size / Color
                </label>
                <select
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      Size {v.size} · {v.colorName} ({v.quantity} in stock)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {assignedCostStages.length > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
              <div className="text-xs font-bold text-emerald-900">
                Auto-logging {assignedCostStages.length} price ledger{' '}
                {assignedCostStages.length === 1 ? 'entry' : 'entries'}:
              </div>
              <div className="space-y-1 text-xs text-emerald-800">
                {assignedCostStages.map(([stageKey, val]) => {
                  const vendorName =
                    vendors.find((v) => v.id === val.vendorId)?.name || 'Vendor';
                  const stageName = getStageMeta(stageKey as OperationStageKey).shortLabel;
                  return (
                    <div key={stageKey} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {stageName} · {vendorName}
                      </span>
                      <span className="font-mono tabular-nums font-bold shrink-0">
                        {val.cost} EGP
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!finalQuantity || finalQuantity <= 0}
              onClick={() =>
                onConfirm({
                  batchId: batch.id,
                  finalQuantity: Math.round(finalQuantity),
                  variantId,
                })
              }
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Stock In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
