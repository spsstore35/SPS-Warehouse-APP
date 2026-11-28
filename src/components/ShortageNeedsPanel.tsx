import React from 'react';
import { AlertTriangle, ShoppingCart, Check } from 'lucide-react';
import type { OrderShortageNote } from '../services/supabaseService';

interface Props {
  notes: OrderShortageNote[];
  canAct: boolean;
  onStart: (note: OrderShortageNote) => void;
}

export default function ShortageNeedsPanel({ notes, canAct, onStart }: Props) {
  if (notes.length === 0) return null;
  const open = notes.filter((n) => !n.hasBatch);
  return (
    <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 font-black text-rose-950 text-sm">
        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
        <span>Needs action: {open.length} item(s) waiting for stock</span>
      </div>
      <div className="space-y-2">
        {notes.map((n) => (
          <div
            key={`${n.bookingId}|${n.variantId}`}
            className="p-2.5 rounded-xl bg-white border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
          >
            <div className="min-w-0 text-slate-900">
              <span className="font-black">Order #{n.bookingNumber}</span>
              {n.clientName ? ` (${n.clientName})` : ''} needs{' '}
              <span className="font-black font-mono">{n.owed}</span> x {n.productName} ({n.size}
              {n.colorName ? ` / ${n.colorName}` : ''}).
              {!n.hasBatch && ' We must start manufacturing / purchasing.'}
            </div>
            {n.hasBatch ? (
              <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-[11px]">
                <Check className="w-3.5 h-3.5" /> Purchase started
              </span>
            ) : canAct ? (
              <button
                type="button"
                onClick={() => onStart(n)}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs min-h-[40px]"
              >
                <ShoppingCart className="w-4 h-4" /> Start purchase ({n.owed}+)
              </button>
            ) : (
              <span className="shrink-0 text-[11px] font-bold text-slate-500">View only</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
