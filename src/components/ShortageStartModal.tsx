import React, { useState } from 'react';
import type { OrderShortageNote } from '../services/supabaseService';

interface Props {
  note: OrderShortageNote;
  onCancel: () => void;
  onConfirm: (quantity: number, targetDate: string) => void;
}

export default function ShortageStartModal({ note, onCancel, onConfirm }: Props) {
  const [qty, setQty] = useState<number>(note.owed);
  const [date, setDate] = useState<string>(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const tooLow = !qty || qty < note.owed;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 space-y-4 shadow-2xl">
        <div>
          <div className="text-base font-black text-slate-900">Start purchase / production</div>
          <div className="text-xs text-slate-600 mt-1">
            Order #{note.bookingNumber}
            {note.clientName ? ` (${note.clientName})` : ''}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900">
          {note.productName} ({note.size}
          {note.colorName ? ` / ${note.colorName}` : ''})
          <div className="text-[11px] font-mono text-rose-700 mt-1">Still needed: {note.owed} pcs (cannot order less)</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-700">
            Quantity (pcs)
            <input
              type="number"
              min={note.owed}
              value={qty || ''}
              onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-black text-center"
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Target date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs"
            />
          </label>
        </div>
        {tooLow && <div className="text-[11px] font-bold text-rose-700">Quantity must be at least {note.owed}.</div>}
        <div className="text-[11px] text-slate-500">Vendors can be assigned later in Sourcing &amp; Operations.</div>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onCancel} className="py-2.5 rounded-xl bg-slate-200 text-slate-900 font-black text-xs min-h-[44px]">
            Cancel
          </button>
          <button
            type="button"
            disabled={tooLow}
            onClick={() => onConfirm(qty, date)}
            className="py-2.5 rounded-xl bg-emerald-600 disabled:opacity-40 text-white font-black text-xs min-h-[44px]"
          >
            Create purchase batch
          </button>
        </div>
      </div>
    </div>
  );
}
