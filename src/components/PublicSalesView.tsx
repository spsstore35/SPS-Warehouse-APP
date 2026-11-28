import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Booking, Product } from '../types/inventory';
import { supabase } from '../services/supabaseClient';
import { Link2, Copy, Check, FileText, ExternalLink } from 'lucide-react';

interface Props {
  products: Product[];
  bookings: Booking[];
  onMarkPaid: (bookingId: string) => void;
  onOpenInvoice: (booking: Booking) => void;
  onOpenOrder: (bookingId: string) => void;
  onShowToast: (msg: string) => void;
}

interface SaleItem {
  product_id: string;
  is_open: boolean;
  required_pct: number;
}

const money = (n: number) => `${Math.round(n * 100) / 100} EGP`;

export const PublicSalesView: React.FC<Props> = ({ products, bookings, onMarkPaid, onOpenInvoice, onOpenOrder, onShowToast }) => {
  const [items, setItems] = useState<Record<string, SaleItem>>({});
  const [ordersOpen, setOrdersOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/order`;

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('public_sale_items').select('product_id,is_open,required_pct'),
      supabase.from('sale_settings').select('orders_open').eq('id', 1).maybeSingle(),
    ]);
    const map: Record<string, SaleItem> = {};
    (a.data || []).forEach((r: any) => (map[r.product_id] = r));
    setItems(map);
    if (b.data) setOrdersOpen(Boolean(b.data.orders_open));
    setLoaded(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const saveItem = async (productId: string, patch: Partial<SaleItem>) => {
    const cur = items[productId] || { product_id: productId, is_open: false, required_pct: 100 };
    const next = { ...cur, ...patch };
    setItems((p) => ({ ...p, [productId]: next }));
    const { error } = await supabase.from('public_sale_items').upsert({ ...next, updated_at: new Date().toISOString() });
    if (error) {
      onShowToast('Could not save: ' + error.message);
      load();
    }
  };
  const saveOpen = async (v: boolean) => {
    setOrdersOpen(v);
    const { error } = await supabase.from('sale_settings').update({ orders_open: v }).eq('id', 1);
    if (error) {
      onShowToast('Could not save: ' + error.message);
      load();
    }
  };

  const orders = useMemo(
    () =>
      bookings
        .filter((b) => b.source === 'public_link')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [bookings]
  );
  const paid = orders.filter((b) => b.depositPaid);
  const waiting = orders.filter((b) => !b.depositPaid);
  const sum = (l: Booking[], f: (b: Booking) => number) => l.reduce((a, b) => a + f(b), 0);

  const sellable = products.filter((p) => (p.price || 0) > 0);

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Link2 className="w-5 h-5 text-indigo-600" /> Public order link
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <code className="text-xs bg-slate-100 rounded-lg px-2 py-1.5 break-all">{link}</code>
          <button
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white flex items-center gap-1"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy
          </button>
          <a className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1" href={link} target="_blank" rel="noreferrer">
            <ExternalLink className="w-3.5 h-3.5" /> Preview
          </a>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={ordersOpen} onChange={(e) => saveOpen(e.target.checked)} />
          Orders are open (untick to close the whole page at once)
        </label>
        <p className="text-xs text-slate-500">
          Customers pay by Instapay and send the screenshot to +201215556301. Their order stays &quot;Awaiting payment&quot; and nothing is deducted
          until you tap Paid.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ['Orders', String(orders.length)],
          ['Awaiting payment', `${waiting.length} · ${money(sum(waiting, (b) => b.total))}`],
          ['Paid', `${paid.length} · ${money(sum(paid, (b) => b.total))}`],
          ['All orders total', money(sum(orders, (b) => b.total))],
        ].map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-[11px] text-slate-500 font-semibold">{k}</div>
            <div className="text-sm font-black text-slate-900">{v}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="font-bold text-slate-900 mb-2">Orders from the link</div>
        {orders.length === 0 && <div className="text-sm text-slate-500">No orders yet.</div>}
        <div className="space-y-2">
          {orders.map((b) => (
            <div key={b.id} className="border border-slate-200 rounded-xl p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="font-bold">
                    {b.clientName} <span className="text-slate-500 font-normal">· {b.clientPhone}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    {b.bookingNumber} · {b.troopGroup === '3ashera 1' ? 'Ashira 1' : b.troopGroup === '3ashera 2' ? 'Ashira 2' : b.troopGroup} · Team: {b.teamName || '-'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {b.items.map((i) => `${i.quantity}× ${i.productName}${i.size && i.size !== 'One Size' ? ` (${i.size})` : ''}`).join(', ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black">{money(b.total)}</div>
                  <div className="text-xs text-slate-600">To pay now: {money(b.depositRequired)}</div>
                  <div className={`text-xs font-bold ${b.depositPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {b.depositPaid ? 'Paid' : 'Awaiting payment'}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {!b.depositPaid && (
                  <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white" onClick={() => onMarkPaid(b.id)}>
                    Paid
                  </button>
                )}
                <button className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1" onClick={() => onOpenInvoice(b)}>
                  <FileText className="w-3.5 h-3.5" /> Invoice
                </button>
                <button className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300" onClick={() => onOpenOrder(b.id)}>
                  Order details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="font-bold text-slate-900 mb-1">Items on the public page</div>
        <p className="text-xs text-slate-500 mb-2">Tick an item to open it for customers. Choose how much of the price they must pay first.</p>
        {!loaded && <div className="text-sm text-slate-500">Loading…</div>}
        <div className="divide-y divide-slate-100">
          {sellable.map((p) => {
            const it = items[p.id];
            return (
              <div key={p.id} className="flex items-center gap-3 py-2 text-sm">
                <input type="checkbox" checked={Boolean(it?.is_open)} onChange={(e) => saveItem(p.id, { is_open: e.target.checked })} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-slate-500">{money(p.price || 0)}</div>
                </div>
                <select
                  className="border border-slate-300 rounded-lg text-xs px-2 py-1"
                  value={it?.required_pct ?? 100}
                  onChange={(e) => saveItem(p.id, { required_pct: Number(e.target.value) })}
                >
                  <option value={100}>Pay 100%</option>
                  <option value={70}>Pay 70%</option>
                  <option value={50}>Pay 50%</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
