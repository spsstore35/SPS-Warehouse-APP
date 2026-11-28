import React, { useState } from 'react';
import type { OrderShortageNote } from '../services/supabaseService';
import type { Vendor } from '../types/inventory';

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
  vendors: Vendor[];
  canManageVendors: boolean;
  onAddVendor: (vendor: Vendor) => void;
  onCancel: () => void;
  onConfirm: (quantity: number, targetDate: string, vendorId?: string) => void;
}

export default function ShortageStartModal({ currentStock = 0, minStock, groupOrders, note, mode = 'order', suggestedQty, leftInStock, vendors, canManageVendors, onAddVendor, onCancel, onConfirm }: Props) {
  const [vendorId, setVendorId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const addVendor = () => {
    const name = newName.trim();
    if (!name) return;
    const v: Vendor = {
      id: `vendor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      location: newLocation.trim(),
      phone: newPhone.trim() || undefined,
      tags: [],
      createdAt: new Date().toISOString(),
    };
    onAddVendor(v);
    setVendorId(v.id);
    setAdding(false);
    setNewName('');
    setNewPhone('');
    setNewLocation('');
  };
  const [qty, setQty] = useState<number>(suggestedQty ?? note.owed);
  const [date, setDate] = useState<string>(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
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
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-700">
            Quantity (pcs)
            <input
              type="number"
              min={minQty}
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
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Vendor / supplier
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="">Not chosen yet (assign later in Sourcing)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.location ? ` - ${v.location}` : ''}
                </option>
              ))}
            </select>
          </label>
          {vendors.length === 0 && !canManageVendors && (
            <div className="text-[11px] text-slate-500">The vendor list is managed by the Purchases admin. Leave it open and they assign it in Sourcing.</div>
          )}
          {canManageVendors && !adding && (
            <button type="button" onClick={() => setAdding(true)} className="text-[11px] font-black text-emerald-700 underline">
              + Add a new vendor
            </button>
          )}
          {canManageVendors && adding && (
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Vendor name" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone (optional)" className="px-3 py-2 rounded-lg border border-slate-300 text-xs" />
                <input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="Location (optional)" className="px-3 py-2 rounded-lg border border-slate-300 text-xs" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addVendor} disabled={!newName.trim()} className="px-3 py-1.5 rounded-lg bg-emerald-600 disabled:opacity-40 text-white text-xs font-black">
                  Save vendor
                </button>
                <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg bg-slate-200 text-xs font-black text-slate-900">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-slate-800 space-y-1">
          {mode !== 'low' && <div>Needed: <span className="font-black font-mono">{note.owed}</span></div>}
          {suggested !== undefined && suggested > note.owed && (
            <div>
              Suggested: <span className="font-black font-mono">{suggested}</span> so you keep {suggested - note.owed} in stock (minimum is {minStock}).{' '}
              <button type="button" onClick={() => setQty(suggested)} className="font-black text-sky-700 underline">Use suggested</button>
            </div>
          )}
          <div>Stock after receiving: <span className="font-black font-mono">{stockAfter}</span>{minStock && minStock > 0 && stockAfter < minStock ? ` (below the minimum of ${minStock})` : ''}</div>
          <div className="text-slate-500">This is only a hint. You can order any quantity from the minimum up.</div>
        </div>
        {tooLow && <div className="text-[11px] font-bold text-rose-700">Quantity must be at least {minQty}.</div>}
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onCancel} className="py-2.5 rounded-xl bg-slate-200 text-slate-900 font-black text-xs min-h-[44px]">
            Cancel
          </button>
          <button
            type="button"
            disabled={tooLow}
            onClick={() => onConfirm(qty, date, vendorId || undefined)}
            className="py-2.5 rounded-xl bg-emerald-600 disabled:opacity-40 text-white font-black text-xs min-h-[44px]"
          >
            Create purchase batch
          </button>
        </div>
      </div>
    </div>
  );
}
