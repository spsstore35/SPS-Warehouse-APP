import React, { useState } from 'react';
import type { ProductionBatch } from '../types/inventory';
import { estimateProductionDays, addDaysIso } from '../utils/deliveryEstimate';

const KEY = 'sps_delivery_safety_days';
const readSafety = (): number => {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v >= 0 && localStorage.getItem(KEY) !== null ? v : 14;
  } catch {
    return 14;
  }
};

interface Props {
  items: { productId: string; variantId?: string }[];
  batches: ProductionBatch[];
}

/** "Estimated delivery: ~N days (+14 safety) = date" from the actual durations of earlier batches. */
export default function DeliveryEstimateLine({ items, batches }: Props) {
  const [safety, setSafety] = useState<number>(readSafety);
  const [manual, setManual] = useState<number>(0);
  const ests = items.map((i) => estimateProductionDays(batches, i.productId, i.variantId));
  const known = ests.filter(Boolean) as NonNullable<(typeof ests)[number]>[];
  const missing = ests.length - known.length;
  // The slowest item decides the promise date; we use the longest time seen before (not the average) to stay safe.
  const base = known.length ? Math.max(...known.map((k) => k.max)) : manual;
  const total = base > 0 ? base + safety : 0;
  const samples = known.length ? Math.min(...known.map((k) => k.count)) : 0;
  const fromSteps = known.every((k) => k.fromSteps);

  return (
    <div className="mt-1.5 p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-950 space-y-1">
      <div className="font-bold">
        {base > 0 ? (
          <>
            Estimated delivery: ~{base} days (+{safety} safety) = {addDaysIso(total)}
          </>
        ) : (
          <>Estimated delivery: no data yet. Type your own number of days:</>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(known.length === 0 || missing > 0) && (
          <label className="inline-flex items-center gap-1">
            {known.length === 0 ? 'Days' : 'Items without history, your days'}
            <input
              type="number"
              min={0}
              value={manual || ''}
              onChange={(e) => setManual(Math.max(0, Number(e.target.value) || 0))}
              className="w-16 px-1.5 py-1 rounded border border-indigo-300 bg-white font-mono"
            />
          </label>
        )}
        <label className="inline-flex items-center gap-1">
          Safety days
          <input
            type="number"
            min={0}
            value={safety}
            onChange={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0);
              setSafety(v);
              try {
                localStorage.setItem(KEY, String(v));
              } catch {
                /* ignore */
              }
            }}
            className="w-14 px-1.5 py-1 rounded border border-indigo-300 bg-white font-mono"
          />
        </label>
        {known.length > 0 && (
          <span className="text-indigo-800">
            Based on the slowest of {samples} earlier batch(es){fromSteps ? ' (Steps & costs dates)' : ' (batch start to stock-in)'}.
          </span>
        )}
      </div>
      {known.length > 0 && missing > 0 && base > 0 && manual > base && (
        <div className="font-bold">Your own number is longer, so use ~{manual} days (+{safety}) = {addDaysIso(manual + safety)}.</div>
      )}
    </div>
  );
}
