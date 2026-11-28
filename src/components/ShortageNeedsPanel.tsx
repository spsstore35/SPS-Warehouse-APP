import React, { useState } from 'react';
import { AlertTriangle, ShoppingCart, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { OrderShortageNote } from '../services/supabaseService';
import type { ProductionBatch } from '../types/inventory';
import DeliveryEstimateLine from './DeliveryEstimateLine';

export interface LowStockNote {
  productId: string;
  variantId: string;
  productName: string;
  size: string;
  colorName: string;
  quantity: number;
  minThreshold: number;
  hasBatch: boolean;
}

interface Props {
  batches?: ProductionBatch[];
  lowNotes?: LowStockNote[];
  onStartLow?: (n: LowStockNote) => void;
  notes: OrderShortageNote[];
  canAct: boolean;
  onStart: (note: OrderShortageNote) => void;
  /** Big red banner that opens/closes the list (Sourcing page). */
  collapsible?: boolean;
  onOpenItem?: (productId: string) => void;
}

export default function ShortageNeedsPanel({ notes: allNotes, canAct, onStart, lowNotes: allLow = [], onStartLow, batches = [], collapsible = false }: Props) {
  // Only things that still need a batch. Purchases already started drop out.
  const notes = allNotes.filter((n) => !n.hasBatch);
  const lowNotes = allLow.filter((n) => !n.hasBatch);
  const [openList, setOpenList] = useState(false);
  if (notes.length === 0 && lowNotes.length === 0) return null;
  const orderCount = new Set(notes.filter((n) => !n.hasBatch).map((n) => n.bookingId)).size;
  const open = [...notes.filter((n) => !n.hasBatch), ...lowNotes.filter((n) => !n.hasBatch)];
  return (
    <div className={`rounded-2xl border ${collapsible ? 'border-rose-700 bg-rose-100' : 'border-rose-300 bg-rose-50'} p-3.5 space-y-2.5`}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpenList((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm text-left"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {orderCount > 0
              ? `A batch is needed: ${orderCount} order(s) are short on stock`
              : `Needs action: ${open.length} item(s) need purchase / production`}
          </span>
          {openList ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
        </button>
      ) : (
        <div className="flex items-center gap-2 font-black text-rose-950 text-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Needs action: {open.length} item(s) need purchase / production</span>
        </div>
      )}
      <div className="space-y-2" style={collapsible && !openList ? { display: 'none' } : undefined}>
        {[...notes].sort((a, b) => String(a.bookingNumber).localeCompare(String(b.bookingNumber))).map((n, i, arr) => (
          <React.Fragment key={`${n.bookingId}|${n.variantId}`}>
          {collapsible && (i === 0 || arr[i - 1].bookingId !== n.bookingId) && (
            <div className="text-[11px] font-black text-rose-900 pt-1">
              Order #{n.bookingNumber}{n.clientName ? ` (${n.clientName})` : ''}: {arr.filter((x) => x.bookingId === n.bookingId).length} item(s) short
            </div>
          )}
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
              <DeliveryEstimateLine items={[{ productId: n.productId, variantId: n.variantId }]} batches={batches} />
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
          </React.Fragment>
        ))}
        {lowNotes.map((n) => (
          <div
            key={`low|${n.variantId}`}
            className="p-2.5 rounded-xl bg-white border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
          >
            <div className="min-w-0 text-slate-900">
              <span className="font-black">{n.productName}</span> ({n.size}
              {n.colorName ? ` / ${n.colorName}` : ''}) is low:{' '}
              <span className="font-black font-mono">{n.quantity}</span> left (minimum {n.minThreshold}).
              {!n.hasBatch && ' You may need to start manufacturing again.'}
            </div>
            {n.hasBatch ? (
              <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-[11px]">
                <Check className="w-3.5 h-3.5" /> Purchase started
              </span>
            ) : canAct && onStartLow ? (
              <button
                type="button"
                onClick={() => onStartLow(n)}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs min-h-[40px]"
              >
                <ShoppingCart className="w-4 h-4" /> Start purchase
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

export type NeedsKind = 'order' | 'low' | null;

/** Two stat tiles for the Sourcing stat row (same style as the others). */
export function NeedsTiles({ notes, lowNotes, open, setOpen }: { notes: OrderShortageNote[]; lowNotes: LowStockNote[]; open: NeedsKind; setOpen: (k: NeedsKind) => void }) {
  const n = notes.filter((x) => !x.hasBatch).length;
  const l = lowNotes.filter((x) => !x.hasBatch).length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(open === 'order' ? null : 'order')}
        className={`p-4 rounded-xl border text-left ${open === 'order' ? 'bg-rose-100 border-rose-500' : 'bg-white border-slate-200 hover:bg-rose-50'}`}
      >
        <div className="text-xs font-medium text-slate-500">Batch needed</div>
        <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${n > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{n}</div>
      </button>
      <button
        type="button"
        onClick={() => setOpen(open === 'low' ? null : 'low')}
        className={`p-4 rounded-xl border text-left ${open === 'low' ? 'bg-amber-100 border-amber-500' : 'bg-white border-slate-200 hover:bg-amber-50'}`}
      >
        <div className="text-xs font-medium text-slate-500">Low stock</div>
        <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${l > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{l}</div>
      </button>
    </>
  );
}

/** Plain list shown under the stat row when a tile is open. */
export function NeedsList({ kind, productId, notes: allNotes, lowNotes: allLow, canAct, onStart, onStartLow }: {
  kind: NeedsKind; productId?: string; notes: OrderShortageNote[]; lowNotes: LowStockNote[]; canAct: boolean;
  onStart: (n: OrderShortageNote) => void; onStartLow?: (n: LowStockNote) => void;
}) {
  if (!kind) return null;
  const notes = productId ? allNotes.filter((x) => x.productId === productId) : allNotes;
  const lowNotes = productId ? allLow.filter((x) => x.productId === productId) : allLow;
  const btn = 'shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs min-h-[40px]';
  const rows = kind === 'order' ? notes.filter((x) => !x.hasBatch) : lowNotes.filter((x) => !x.hasBatch);
  return (
    <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
      {rows.length === 0 && <div className="p-3 text-xs text-slate-500">Nothing needs a batch here.</div>}
      {kind === 'order' && (rows as OrderShortageNote[]).map((n) => (
        <div key={`${n.bookingId}|${n.variantId}`} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-900">
          <div>
            <span className="font-black">{n.productName}</span> ({n.size}{n.colorName ? ` / ${n.colorName}` : ''}): short <span className="font-black font-mono">{n.owed}</span>
            <div className="text-slate-600">Order #{n.bookingNumber}{n.clientName ? ` (${n.clientName})` : ''}</div>
          </div>
          {canAct ? <button type="button" onClick={() => onStart(n)} className={btn}><ShoppingCart className="w-4 h-4" /> Start batch</button> : <span className="text-[11px] font-bold text-slate-500">View only</span>}
        </div>
      ))}
      {kind === 'low' && (rows as LowStockNote[]).map((n) => (
        <div key={n.variantId} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-900">
          <div>
            <span className="font-black">{n.productName}</span> ({n.size}{n.colorName ? ` / ${n.colorName}` : ''}): <span className="font-black font-mono">{n.quantity}</span> left (minimum {n.minThreshold})
          </div>
          {canAct && onStartLow ? <button type="button" onClick={() => onStartLow(n)} className={btn}><ShoppingCart className="w-4 h-4" /> Start batch</button> : <span className="text-[11px] font-bold text-slate-500">View only</span>}
        </div>
      ))}
    </div>
  );
}
