import { batchLabel } from '../utils/sourcing';
import React, { useEffect, useState } from 'react';
import {
  BatchStageAssignment,
  CustomStageDefinition,
  OperationStageKey,
  Product,
  ProductStageVendor,
  ProductWorkflow,
  ProductionBatch,
  Vendor,
  VendorBehaviorTag,
  VendorPriceEntry,
  WorkflowTemplateApplication,
} from '../types/inventory';
import { VENDOR_TAG_GROUPS, getStageMeta } from '../utils/sourcing';
import {
  X,
  Check,
  MapPin,
  Phone,
  User as UserIcon,
  Package,
  Factory,
  Calendar,
  Copy,
  Link2,
  Unlink,
  Search,
  ArrowRight,
  Layers,
  Clock,
  AlertCircle,
} from 'lucide-react';

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
  customStages?: Record<string, CustomStageDefinition>;
  stageLeadTimes?: Record<string, number>;
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
  customStages,
  stageLeadTimes,
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
  const [variantQtyDraft, setVariantQtyDraft] = useState<Record<string, number> | null>(null);
  const [variantId, setVariantId] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [assignments, setAssignments] = useState<Record<string, BatchStageAssignment>>({});
  const [error, setError] = useState('');
  // Ready-made purchase details (stored on the supplier stage): units per box, boxes, lead time for this order.
  const isReadyMade = activeStages.includes('supplier_sourcing');
  const [unitsPerBox, setUnitsPerBox] = useState<number>(0);
  const [boxes, setBoxes] = useState<number>(0);
  const [leadDays, setLeadDays] = useState<number>(0);

  const totalLeadDays = activeStages.reduce(
    (sum, k) => sum + Math.max(0, Number(stageLeadTimes?.[k] || 0)),
    0
  );

  useEffect(() => {
    if (!isOpen) return;
    if (initialBatch) {
      setBatchCode(initialBatch.batchCode);
      setQuantity(initialBatch.quantity);
      setVariantQtyDraft(initialBatch.variantQty && Object.keys(initialBatch.variantQty).length > 1 ? { ...initialBatch.variantQty } : null);
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
      const rm = mergedAssignments['supplier_sourcing'];
      setUnitsPerBox(Number(rm?.unitsPerBox) || 0);
      setBoxes(Number(rm?.boxes) || 0);
      setLeadDays(Number(rm?.leadTimeDays) || 0);
      setError('');
      return;
    }

    setBatchCode(`Batch #${105 + existingBatchCount}`);
    setQuantity(100);
    setVariantQtyDraft(null);
    setVariantId(product.variants[0]?.id || '');
    const leadDaysToAdd = totalLeadDays > 0 ? totalLeadDays : 7;
    const defaultTarget = new Date(Date.now() + leadDaysToAdd * 86400000)
      .toISOString()
      .slice(0, 10);
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
  }, [
    isOpen,
    initialBatch,
    product,
    activeStages,
    totalLeadDays,
    productStageVendors,
    priceHistory,
    existingBatchCount,
  ]);

  if (!isOpen) return null;

  const productionStages = activeStages.filter((k) => k !== 'stock_in');
  const firstStage = activeStages[0] || 'stock_in';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCode.trim()) {
      setError('Batch Code is required.');
      return;
    }
    const breakdown: Record<string, number> | undefined = variantQtyDraft
      ? (Object.fromEntries(
          Object.entries(variantQtyDraft)
            .map(([k, n]) => [k, Math.max(0, Math.round(Number(n) || 0))] as [string, number])
            .filter(([, n]) => n > 0)
        ) as Record<string, number>)
      : undefined;
    const finalQty = breakdown ? Object.values(breakdown).reduce((s, n) => s + n, 0) : quantity;
    if (!finalQty || finalQty <= 0) {
      setError('Batch quantity must be greater than 0.');
      return;
    }

    if (isReadyMade && (unitsPerBox > 0 || boxes > 0 || leadDays > 0)) {
      assignments['supplier_sourcing'] = {
        ...(assignments['supplier_sourcing'] || {}),
        unitsPerBox: unitsPerBox > 0 ? unitsPerBox : undefined,
        boxes: boxes > 0 ? boxes : undefined,
        leadTimeDays: leadDays > 0 ? leadDays : undefined,
      };
    }
    const batch: ProductionBatch = initialBatch
      ? {
          ...initialBatch,
          batchCode: batchCode.trim(),
          variantId: variantId || undefined,
          quantity: Math.round(finalQty),
          variantQty: breakdown && Object.keys(breakdown).length > 1 ? breakdown : undefined,
          targetDate: targetDate || undefined,
          stageAssignments: assignments,
        }
      : {
          id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          batchCode: batchCode.trim(),
          productId: product.id,
          variantId: variantId || undefined,
          quantity: Math.round(finalQty),
          variantQty: breakdown && Object.keys(breakdown).length > 1 ? breakdown : undefined,
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

            {isReadyMade && (
              <div className="col-span-full p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-2">
                <div className="text-xs font-black text-indigo-900">Ready-made purchase (from a supplier)</div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[11px] font-bold text-slate-700">
                    Units per box
                    <input
                      type="number"
                      min={0}
                      value={unitsPerBox || ''}
                      onChange={(e) => {
                        const u = Math.max(0, Number(e.target.value) || 0);
                        setUnitsPerBox(u);
                        if (u > 0 && boxes > 0) setQuantity(u * boxes);
                      }}
                      className="mt-0.5 w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </label>
                  <label className="text-[11px] font-bold text-slate-700">
                    Number of boxes
                    <input
                      type="number"
                      min={0}
                      value={boxes || ''}
                      onChange={(e) => {
                        const b = Math.max(0, Number(e.target.value) || 0);
                        setBoxes(b);
                        if (b > 0 && unitsPerBox > 0) setQuantity(unitsPerBox * b);
                      }}
                      className="mt-0.5 w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </label>
                  <label className="text-[11px] font-bold text-slate-700">
                    Supplier needs (days)
                    <input
                      type="number"
                      min={0}
                      value={leadDays || ''}
                      onChange={(e) => {
                        const d = Math.max(0, Number(e.target.value) || 0);
                        setLeadDays(d);
                        if (d > 0) setTargetDate(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10));
                      }}
                      className="mt-0.5 w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </label>
                </div>
                <div className="text-[11px] text-slate-600">
                  {unitsPerBox > 0 && boxes > 0 ? `${boxes} box(es) x ${unitsPerBox} = ${unitsPerBox * boxes} pcs. ` : ''}
                  Lead time is typed per order and sets the target date below (you can still change it). Choose the supplier in the stage list. When received, the goods go straight into stock.
                </div>
              </div>
            )}

            {variantQtyDraft ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity per size / color (pcs) *
                </label>
                <div className="space-y-1.5">
                  {Object.entries(variantQtyDraft).map(([vid, q]) => {
                    const vv = product.variants.find((x) => x.id === vid);
                    return (
                      <div key={vid} className="flex items-center gap-2">
                        <span className="flex-1 text-xs font-semibold text-slate-800">{vv ? `Size ${vv.size} · ${vv.colorName}` : 'Item'}</span>
                        <input
                          type="number"
                          min={0}
                          value={q || ''}
                          onChange={(e) => setVariantQtyDraft({ ...variantQtyDraft, [vid]: Number(e.target.value) })}
                          className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                      </div>
                    );
                  })}
                  <div className="text-xs font-bold text-slate-900">
                    Total: {Object.values(variantQtyDraft).reduce((s, n) => s + (Number(n) || 0), 0)} pcs
                  </div>
                </div>
              </div>
            ) : (
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
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Completion{' '}
                {totalLeadDays > 0 && (
                  <span className="font-mono text-indigo-700">(~{totalLeadDays}d est.)</span>
                )}
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
                const meta = getStageMeta(stageKey, customStages);
                const estDays = Number(stageLeadTimes?.[stageKey] || 0);
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
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>
                          0{idx + 1}. {meta.shortLabel}
                        </span>
                        {estDays > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-mono">
                            {estDays}d
                          </span>
                        )}
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
                    <div className="sm:col-span-12 flex flex-wrap items-center gap-2 text-[11px] text-slate-700">
                      <label className="inline-flex items-center gap-1">
                        {meta.defaultUnit}s
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={current.unitQty ?? ''}
                          onChange={(e) =>
                            setAssignments((prev) => ({
                              ...prev,
                              [stageKey]: { ...prev[stageKey], unitQty: e.target.value === '' ? undefined : Number(e.target.value) },
                            }))
                          }
                          className="w-20 px-2 py-1 border border-slate-300 rounded-lg font-mono"
                        />
                      </label>
                      {typeof current.cost === 'number' && (current.unitQty || 0) > 0 && (
                        <span className="font-mono font-bold text-slate-900">
                          {current.cost.toLocaleString()} EGP x {(current.unitQty as number).toLocaleString()} {meta.defaultUnit} = {(current.cost * (current.unitQty as number)).toLocaleString()} EGP
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {(() => {
            const total = productionStages.reduce((sum, k) => {
              const a = assignments[k];
              return sum + (a && typeof a.cost === 'number' && (a.unitQty || 0) > 0 ? a.cost * (a.unitQty as number) : 0);
            }, 0);
            return total > 0 ? (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-black text-emerald-900">
                Batch total so far: {total.toLocaleString()} EGP
              </div>
            ) : null;
          })()}

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
  customStages?: Record<string, CustomStageDefinition>;
  vendors: Vendor[];
  onClose: () => void;
  onConfirm: (payload: {
    batchId: string;
    finalQuantity: number;
    variantId: string;
    parts?: { variantId: string; qty: number }[];
  }) => void;
}

export const CompleteStockInModal: React.FC<CompleteStockInModalProps> = ({
  batch,
  product,
  customStages,
  vendors,
  onClose,
  onConfirm,
}) => {
  const [finalQuantity, setFinalQuantity] = useState<number>(0);
  const [variantId, setVariantId] = useState<string>('');
  const [partsDraft, setPartsDraft] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!batch || !product) return;
    setPartsDraft(batch.variantQty && Object.keys(batch.variantQty).length > 1 ? { ...batch.variantQty } : null);
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
            Ready to stock in <span className="font-bold text-slate-900">{batchLabel(batch)}</span>{' '}
            for <span className="font-bold text-slate-900">{product.name}</span>.
          </div>

          {partsDraft && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700">Final quantity received per size / color (pcs)</div>
              {Object.entries(partsDraft).map(([vid, q]) => {
                const vv = product.variants.find((x) => x.id === vid);
                return (
                  <div key={vid} className="flex items-center gap-2">
                    <span className="flex-1 text-xs font-semibold text-slate-800">{vv ? `Size ${vv.size} · ${vv.colorName} (${vv.quantity} in stock)` : 'Item'}</span>
                    <input
                      type="number"
                      min={0}
                      value={q || ''}
                      onChange={(e) => setPartsDraft({ ...partsDraft, [vid]: Number(e.target.value) })}
                      className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                );
              })}
              <div className="text-xs font-bold text-slate-900">Total: {Object.values(partsDraft).reduce((s, n) => s + (Number(n) || 0), 0)} pcs. Each size goes to its own stock.</div>
            </div>
          )}

          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${partsDraft ? 'hidden' : ''}`}>
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
                    vendors.find((v) => v.id === val.vendorId)?.name ||
                    val.customVendorName ||
                    'Vendor';
                  const stageName = getStageMeta(
                    stageKey as OperationStageKey,
                    customStages
                  ).shortLabel;
                  return (
                    <div key={stageKey} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {stageName} · {vendorName}
                      </span>
                      <span className="font-mono tabular-nums font-bold shrink-0">
                        {val.cost} EGP/unit
                        {val.totalCost ? ` (${val.totalCost.toLocaleString()} EGP total)` : ''}
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
              disabled={partsDraft ? Object.values(partsDraft).reduce((s, n) => s + (Number(n) || 0), 0) <= 0 : !finalQuantity || finalQuantity <= 0}
              onClick={() => {
                if (partsDraft) {
                  const parts = Object.entries(partsDraft).map(([vid, q]) => ({ variantId: vid, qty: Math.max(0, Math.round(Number(q) || 0)) })).filter((p) => p.qty > 0);
                  onConfirm({
                    batchId: batch.id,
                    finalQuantity: parts.reduce((s, p) => s + p.qty, 0),
                    variantId: parts[0]?.variantId || variantId,
                    parts,
                  });
                  return;
                }
                onConfirm({
                  batchId: batch.id,
                  finalQuantity: Math.round(finalQuantity),
                  variantId,
                });
              }}
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

interface ApplyWorkflowTemplateModalProps {
  isOpen: boolean;
  targetProduct: Product;
  targetWorkflow: ProductWorkflow;
  products: Product[];
  stageVendors: ProductStageVendor[];
  getEffectiveWorkflow: (product: Product) => ProductWorkflow;
  onClose: () => void;
  onApply: (payload: WorkflowTemplateApplication) => void;
}

export const ApplyWorkflowTemplateModal: React.FC<ApplyWorkflowTemplateModalProps> = ({
  isOpen,
  targetProduct,
  targetWorkflow,
  products,
  stageVendors,
  getEffectiveWorkflow,
  onClose,
  onApply,
}) => {
  const [search, setSearch] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [mode, setMode] = useState<'same_all' | 'pipeline_only'>('same_all');
  const [groupName, setGroupName] = useState('');

  const candidateProducts = products.filter(
    (p) => p.id !== targetProduct.id && p.status !== 'pending'
  );

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setSelectedSourceId('');
    setMode('same_all');
    setGroupName(
      targetWorkflow.sharedGroupName ||
        `${targetProduct.category || targetProduct.name} Shared Estamba`
    );
  }, [isOpen, targetProduct, targetWorkflow.sharedGroupName]);

  const selectedSourceProduct = candidateProducts.find((p) => p.id === selectedSourceId) || null;
  const selectedSourceWf = selectedSourceProduct
    ? getEffectiveWorkflow(selectedSourceProduct)
    : null;

  useEffect(() => {
    if (!selectedSourceProduct || !selectedSourceWf) return;
    if (selectedSourceWf.sharedGroupName) {
      setGroupName(selectedSourceWf.sharedGroupName);
    } else if (!targetWorkflow.sharedGroupName) {
      const base =
        selectedSourceProduct.category && selectedSourceProduct.category !== 'Others'
          ? `${selectedSourceProduct.category} Shared Estamba`
          : `${selectedSourceProduct.name} Estamba`;
      setGroupName(base);
    }
  }, [selectedSourceId, selectedSourceProduct, selectedSourceWf, targetWorkflow.sharedGroupName]);

  if (!isOpen) return null;

  const q = search.trim().toLowerCase();
  const filteredCandidates = candidateProducts
    .filter((p) => {
      if (!q) return true;
      const wf = getEffectiveWorkflow(p);
      return `${p.name} ${p.sku} ${p.category} ${wf.sharedGroupName || ''}`
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => {
      const aSameCat = a.category === targetProduct.category ? 0 : 1;
      const bSameCat = b.category === targetProduct.category ? 0 : 1;
      if (aSameCat !== bSameCat) return aSameCat - bSameCat;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-4 flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
              <Copy className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                Use Template / Shared Estamba
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Copy pipeline or sync vendors from another item onto{' '}
                <strong className="text-slate-800">{targetProduct.name}</strong>
              </p>
            </div>
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

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {targetWorkflow.sharedGroupId && (
            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <Link2 className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-indigo-950">
                    Currently Linked: {targetWorkflow.sharedGroupName || 'Shared Estamba Group'}
                  </div>
                  <div className="text-[11px] text-indigo-700 mt-0.5">
                    Any stage, vendor, ordering script, or price updates sync automatically across all items in this group.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onApply({
                    sourceProductId: targetProduct.id,
                    targetProductId: targetProduct.id,
                    mode: 'unlink',
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 self-start sm:self-center"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Unlink Item</span>
              </button>
            </div>
          )}

          {/* Step 1: Pick source product */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800">
                1. Choose Source Item (Estamba)
              </label>
              <span className="text-[11px] text-slate-500">
                {filteredCandidates.length} items available
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name, SKU, category, or shared group..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filteredCandidates.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No matching items found.
                </div>
              ) : (
                filteredCandidates.map((cand) => {
                  const candWf = getEffectiveWorkflow(cand);
                  const candVendorCount = new Set(
                    stageVendors
                      .filter((psv) => psv.productId === cand.id)
                      .map((psv) => psv.vendorId)
                  ).size;
                  const isChosen = selectedSourceId === cand.id;

                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => setSelectedSourceId(cand.id)}
                      className={`w-full text-left p-3 flex items-start justify-between gap-3 transition-colors ${
                        isChosen ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-bold truncate ${
                              isChosen ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {cand.name}
                          </span>
                          <span
                            className={`text-[10px] font-mono ${
                              isChosen ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {cand.sku}
                          </span>
                          {candWf.sharedGroupId && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                                isChosen
                                  ? 'bg-indigo-500/30 text-indigo-100'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              <Link2 className="w-2.5 h-2.5" />
                              <span>{candWf.sharedGroupName || 'Shared Group'}</span>
                            </span>
                          )}
                        </div>

                        <div
                          className={`text-[11px] flex items-center gap-1 flex-wrap ${
                            isChosen ? 'text-slate-200' : 'text-slate-500'
                          }`}
                        >
                          {candWf.activeStages.map((stKey, idx) => (
                            <React.Fragment key={stKey}>
                              <span>{getStageMeta(stKey, candWf.customStages).shortLabel}</span>
                              {idx < candWf.activeStages.length - 1 && (
                                <ArrowRight className="w-2.5 h-2.5 opacity-60 shrink-0" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      <div
                        className={`text-[11px] font-mono shrink-0 text-right ${
                          isChosen ? 'text-slate-200' : 'text-slate-600'
                        }`}
                      >
                        <div>{candWf.activeStages.length} stages</div>
                        <div>{candVendorCount} vendors</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Step 2: Same Everything vs Estamba Only */}
          {selectedSourceProduct && selectedSourceWf && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-800">
                2. Same Everything or Estamba Only?
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('same_all')}
                  className={`text-left p-3.5 rounded-xl border transition-all space-y-1.5 ${
                    mode === 'same_all'
                      ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/15'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Same Everything (Sync All)</span>
                    </span>
                    {mode === 'same_all' && (
                      <Check className="w-4 h-4 text-indigo-700 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Copies pipeline stages AND all vendors, ordering scripts &amp; prices, and links them live. Editing any item in the group automatically updates all linked items (stock &amp; batches stay separate).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('pipeline_only')}
                  className={`text-left p-3.5 rounded-xl border transition-all space-y-1.5 ${
                    mode === 'pipeline_only'
                      ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-700" />
                      <span>Estamba Only (Stages Only)</span>
                    </span>
                    {mode === 'pipeline_only' && (
                      <Check className="w-4 h-4 text-slate-900 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Copies only the pipeline flowchart stages from{' '}
                    <strong>{selectedSourceProduct.name}</strong>. Vendors, prices, and future edits remain independent.
                  </p>
                </button>
              </div>

              {mode === 'same_all' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Shared Estamba Group Name
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Folar Variants Group"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold min-h-[38px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedSourceProduct}
            onClick={() => {
              if (!selectedSourceProduct) return;
              onApply({
                sourceProductId: selectedSourceProduct.id,
                targetProductId: targetProduct.id,
                mode,
                sharedGroupName: mode === 'same_all' ? groupName.trim() || undefined : undefined,
              });
            }}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5 min-h-[38px]"
          >
            <Check className="w-4 h-4" />
            <span>
              {mode === 'same_all' ? 'Link & Sync Everything' : 'Copy Pipeline Estamba'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface AdvanceStageModalProps {
  batch: ProductionBatch | null;
  product: Product | null;
  currentStageKey: OperationStageKey | null;
  nextStageKey: OperationStageKey | null;
  customStages?: Record<string, CustomStageDefinition>;
  stageLeadTimes?: Record<string, number>;
  vendors: Vendor[];
  productStageVendors: ProductStageVendor[];
  priceHistory: VendorPriceEntry[];
  onClose: () => void;
  onConfirm: (payload: {
    batchId: string;
    stageKey: OperationStageKey;
    nextStageKey: OperationStageKey;
    assignment: BatchStageAssignment;
  }) => void;
}

export const AdvanceStageModal: React.FC<AdvanceStageModalProps> = ({
  batch,
  product,
  currentStageKey,
  nextStageKey,
  customStages,
  stageLeadTimes,
  vendors,
  productStageVendors,
  priceHistory,
  onClose,
  onConfirm,
}) => {
  const [vendorMode, setVendorMode] = useState<'directory' | 'custom'>('directory');
  const [vendorId, setVendorId] = useState('');
  const [customVendorName, setCustomVendorName] = useState('');
  const [costType, setCostType] = useState<'total' | 'unit'>('total');
  const [costInput, setCostInput] = useState('');
  const [noExternalCost, setNoExternalCost] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!batch || !product || !currentStageKey) return;
    const existing = batch.stageAssignments?.[currentStageKey];
    const stageLinks = productStageVendors.filter(
      (psv) => psv.productId === product.id && psv.stageKey === currentStageKey
    );
    const primaryLink = stageLinks.find((l) => l.isPrimary) || stageLinks[0];

    if (existing?.customVendorName && !existing?.vendorId) {
      setVendorMode('custom');
      setCustomVendorName(existing.customVendorName);
      setVendorId('');
    } else {
      setVendorMode('directory');
      setVendorId(existing?.vendorId || primaryLink?.vendorId || '');
      setCustomVendorName('');
    }

    if (typeof existing?.totalCost === 'number' && existing.totalCost > 0) {
      setCostType('total');
      setCostInput(String(existing.totalCost));
      setNoExternalCost(false);
    } else if (typeof existing?.cost === 'number' && existing.cost > 0) {
      setCostType('unit');
      setCostInput(String(existing.cost));
      setNoExternalCost(false);
    } else {
      setCostType('total');
      setCostInput('');
      setNoExternalCost(false);
    }

    setNotes(existing?.notes || '');
    setError('');
  }, [batch, product, currentStageKey, productStageVendors]);

  if (!batch || !product || !currentStageKey || !nextStageKey) return null;

  const currentMeta = getStageMeta(currentStageKey, customStages);
  const nextMeta = getStageMeta(nextStageKey, customStages);
  const estDays = Number(stageLeadTimes?.[currentStageKey] || 0);

  const stageLinks = productStageVendors.filter(
    (psv) => psv.productId === product.id && psv.stageKey === currentStageKey
  );
  const linkedVendorIds = new Set(stageLinks.map((l) => l.vendorId));
  const orderedVendors = [
    ...vendors.filter((v) => linkedVendorIds.has(v.id)),
    ...vendors.filter((v) => !linkedVendorIds.has(v.id)),
  ];

  const qty = Math.max(1, Number(batch.quantity) || 1);
  const parsedNum = Number(costInput);
  const hasValidPositiveCost =
    costInput.trim() !== '' && !isNaN(parsedNum) && parsedNum > 0;

  const computedUnitCost = noExternalCost
    ? 0
    : !hasValidPositiveCost
    ? 0
    : costType === 'total'
    ? Math.round((parsedNum / qty) * 100) / 100
    : Math.round(parsedNum * 100) / 100;

  const computedTotalCost = noExternalCost
    ? 0
    : !hasValidPositiveCost
    ? 0
    : costType === 'total'
    ? Math.round(parsedNum * 100) / 100
    : Math.round(parsedNum * qty * 100) / 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (vendorMode === 'directory' && !vendorId) {
      setError('Choose which vendor did this stage, or switch to "Other / Custom Name" to enter who did it.');
      return;
    }
    if (vendorMode === 'custom' && !customVendorName.trim()) {
      setError('Enter the vendor, workshop, or person name who completed this stage.');
      return;
    }
    if (!noExternalCost && !hasValidPositiveCost) {
      setError('Enter how much this stage cost (EGP) before moving to the next pipeline stage.');
      return;
    }

    onConfirm({
      batchId: batch.id,
      stageKey: currentStageKey,
      nextStageKey,
      assignment: {
        vendorId: vendorMode === 'directory' ? vendorId : undefined,
        customVendorName: vendorMode === 'custom' ? customVendorName.trim() : undefined,
        cost: computedUnitCost,
        totalCost: computedTotalCost,
        notes: notes.trim() || undefined,
        completedAt: new Date().toISOString(),
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-4">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">
              Complete Stage &amp; Advance Batch
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {batchLabel(batch)} ({batch.quantity} pcs) · {product.name}
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
          {/* Transition Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Completing Stage
              </div>
              <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                {currentMeta.label}
              </div>
              {estDays > 0 && (
                <div className="inline-flex items-center gap-1 text-[11px] text-indigo-700 font-semibold mt-1">
                  <Clock className="w-3 h-3" />
                  <span>Est. duration: {estDays} days</span>
                </div>
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0 text-right">
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
                Moving To
              </div>
              <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                {nextMeta.shortLabel}
              </div>
            </div>
          </div>

          {/* Required Field 1: Vendor or Custom Person */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-bold text-slate-800">
                1. Done At Which Vendor / Person? *
              </label>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setVendorMode('directory')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    vendorMode === 'directory'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Registered Vendor
                </button>
                <button
                  type="button"
                  onClick={() => setVendorMode('custom')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    vendorMode === 'custom'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Other / Person Name
                </button>
              </div>
            </div>

            {vendorMode === 'directory' ? (
              <select
                value={vendorId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setVendorId(nextId);
                  setError('');
                  if (!costInput && nextId) {
                    const matchLink = stageLinks.find((l) => l.vendorId === nextId);
                    const latest = matchLink
                      ? priceHistory
                          .filter((ph) => ph.productStageVendorId === matchLink.id)
                          .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))[0]
                      : undefined;
                    if (latest?.unitPrice) {
                      setCostType('unit');
                      setCostInput(String(latest.unitPrice));
                    }
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
              >
                <option value="">Select vendor...</option>
                {orderedVendors.map((v) => {
                  const lnk = stageLinks.find((l) => l.vendorId === v.id);
                  return (
                    <option key={v.id} value={v.id}>
                      {lnk?.isPrimary ? `★ ${v.name} (Primary)` : v.name}
                      {v.location ? ` — ${v.location}` : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                value={customVendorName}
                onChange={(e) => {
                  setCustomVendorName(e.target.value);
                  setError('');
                }}
                placeholder="Write workshop, supplier, or person name (e.g. Abu Tarek Workshop, In-House)..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            )}
          </div>

          {/* Required Field 2: Cost (EGP) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-bold text-slate-800">
                2. How Much Did This Stage Cost? (EGP) *
              </label>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  disabled={noExternalCost}
                  onClick={() => setCostType('total')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors disabled:opacity-50 ${
                    costType === 'total'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Total Stage Cost
                </button>
                <button
                  type="button"
                  disabled={noExternalCost}
                  onClick={() => setCostType('unit')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors disabled:opacity-50 ${
                    costType === 'unit'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Per {currentMeta.defaultUnit}
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                min={0}
                step="0.01"
                disabled={noExternalCost}
                value={noExternalCost ? '0' : costInput}
                onChange={(e) => {
                  setCostInput(e.target.value);
                  setError('');
                }}
                placeholder={
                  costType === 'total'
                    ? `Total EGP paid for ${qty} pcs...`
                    : `Cost in EGP per ${currentMeta.defaultUnit}...`
                }
                className="w-full pl-3.5 pr-12 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono tabular-nums font-bold text-slate-900 focus:outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                EGP
              </span>
            </div>

            {hasValidPositiveCost && !noExternalCost && (
              <div className="text-[11px] font-mono text-slate-600 flex items-center justify-between px-1">
                <span>
                  Per {currentMeta.defaultUnit}: <strong>{computedUnitCost} EGP</strong>
                </span>
                <span>
                  Total ({qty} pcs): <strong>{computedTotalCost.toLocaleString()} EGP</strong>
                </span>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none pt-0.5">
              <input
                type="checkbox"
                checked={noExternalCost}
                onChange={(e) => {
                  setNoExternalCost(e.target.checked);
                  setError('');
                }}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span>Internal / no cash cost for this stage (0 EGP)</span>
            </label>
          </div>

          {/* Optional Stage Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Stage Notes / Receipt Ref (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Invoice #, quality note, actual days taken..."
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
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
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 min-h-[40px]"
            >
              <span>Save &amp; Move to {nextMeta.shortLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
