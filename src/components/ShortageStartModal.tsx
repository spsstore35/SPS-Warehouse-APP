import { batchLabel } from '../utils/sourcing';
import React, { useState } from 'react';
import type { OrderShortageNote } from '../services/supabaseService';
import type { ProductionBatch } from '../types/inventory';

interface Props {
  note: OrderShortageNote;
  /** Several orders for the same item: one batch covers all of them. */
  groupOrders?: OrderShortageNote[];
  /** Current warehouse stock and the item's minimum stock, for the advisory hint. */
  currentStock?: number;
  minStock?: number;
  mode?: 'order' | 'low';
  suggestedQty?: number;
  leftInStock?: number;
  /** Days the item usually takes (slowest finished batch + safety). Undefined = no history yet: no date is shown. */
  estimate?: { days: number; baseDays: number; safety: number } | null;
  /** Open batches of the SAME ITEM (any size/color) still at the first stage with no money spent. */
  mergeTargets?: ProductionBatch[];
  onMerge?: (batch: ProductionBatch, quantity: number) => void;
  onCancel: () => void;
  onConfirm: (quantity: number, targetDate?: string) => void;
}

export default function ShortageStartModal({ currentStock = 0, minStock, groupOrders, note, mode = 'order', suggestedQty, leftInStock, estimate, mergeTargets = [], onMerge, onCancel, onConfirm }: Props) {
  const [qty, setQty] = useState<number>(suggestedQty ?? note.owed);
  const [date, setDate] = useState<string>(estimate ? new Date(Date.now() + estimate.days * 86400000).toISOString().slice(0, 10) : '');
  const [pickMerge, setPickMerge] = useState(false);
  const minQty = mode === 'low' ? 1 : note.owed;
  const tooLow = !qty || qty < minQty;
  const reservedForOrders = mode === 'low' ? 0 : note.owed;
  const stockAfter = Math.max(0, currentStock + (qty || 0) - reservedForOrders);
  const suggested = mode === 'low' ? undefined : minStock && minStock > 0 ? note.owed + Math.max(0, minStock - currentStock) : undefined;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 space-y-4 shadow-2xl">
        <div>
          <div className="text-base font-black text-slate-900">Start purchase / production</div>
          <div className="text-xs text-slate-600 mt-1">
            {mode === 'low'
              ? 'Low stock: restock'
              : groupOrders && groupOrders.length > 1
              ? `${groupOrders.length} orders: ` + groupOrders.map((o) => `#${o.bookingNumber} (${o.owed})`).join(', ')
              : `Order #${note.bookingNumber}${note.clientName ? ` (${note.clientName})` : ''}`}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900">
          {note.productName} ({note.size}
          {note.colorName ? ` / ${note.colorName}` : ''})
          <div className="text-[11px] font-mono text-rose-700 mt-1">
            {mode === 'low' ? `Only ${leftInStock ?? 0} left in stock. Choose any quantity.` : `Still needed: ${note.owed} pcs in total (cannot order less; you can order more)`}
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Quantity (pcs)
            <input
              type="number"
              min={minQty}
              value={qty || ''}
              onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-black text-center"
            />
          </label>
          {estimate && (
            <label className="block text-xs font-bold text-slate-700">
              Estimated about {estimate.baseDays} days (+{estimate.safety} safety), receive around
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs"
              />
            </label>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-slate-800 space-y-1">
          {mode !== 'low' && <div>Needed: <span className="font-black font-mono">{note.owed}</span></div>}
          {suggested !== undefined && suggested > note.owed && (
            <div>
              Suggestion only: <span className="font-black font-mono">{suggested}</span>. You need {note.owed} for the orders, plus {suggested - note.owed} more so your stock stays at the safe minimum ({minStock}) after receiving and you don't run out right away.{' '}
              <button type="button" onClick={() => setQty(suggested)} className="font-black text-sky-700 underline">Use {suggested}</button>
            </div>
          )}
          <div>Stock after receiving: <span className="font-black font-mono">{stockAfter}</span>{minStock && minStock > 0 && stockAfter < minStock ? ` (below the minimum of ${minStock})` : ''}</div>
          <div className="text-slate-500">This is only a hint. You can order any quantity from the minimum up.</div>
        </div>
        {tooLow && <div className="text-[11px] font-bold text-rose-700">Quantity must be at least {minQty}.</div>}
        <button
          type="button"
          disabled={tooLow}
          onClick={() => onConfirm(qty, date || undefined)}
          className="w-full py-2.5 rounded-xl bg-emerald-600 disabled:opacity-40 text-white font-black text-xs min-h-[44px]"
        >
          Create purchase batch
        </button>
        {onMerge && (
          <>
            <button
              type="button"
              disabled={tooLow}
              onClick={() => setPickMerge((v) => !v)}
              className="w-full py-2.5 rounded-xl bg-sky-600 disabled:opacity-40 text-white font-black text-xs min-h-[44px]"
            >
              Merge into existing batch
            </button>
            {pickMerge && (
              <div className="space-y-1.5">
                {mergeTargets.length === 0 ? (
                  <div className="text-[11px] font-bold text-slate-700">
                    No open batch of this item to merge into. A batch must still be at its first stage with no money spent (any size/color is fine).
                  </div>
                ) : (
                  mergeTargets.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onMerge(b, qty)}
                      className="w-full text-left px-3 py-2.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-xs font-bold text-slate-900"
                    >
                      Add {qty} pcs to {batchLabel(b)} ({b.quantity} pcs now) = {b.quantity + qty} pcs
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
        <button type="button" onClick={onCancel} className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-900 font-black text-xs min-h-[44px]">
          Cancel
        </button>
      </div>
    </div>
  );
}
