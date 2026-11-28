import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Booking, Category, Product } from '../types/inventory';
import { compressImage } from '../utils/imageCompressor';
import { supabase } from '../services/supabaseClient';
import { Link2, Copy, Check, FileText, ExternalLink } from 'lucide-react';

interface Props {
  products: Product[];
  categories: Category[];
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
  size_chart_url?: string | null;
}

const money = (n: number) => `${Math.round(n * 100) / 100} EGP`;

export const PublicSalesView: React.FC<Props> = ({ products, categories, bookings, onMarkPaid, onOpenInvoice, onOpenOrder, onShowToast }) => {
  const [items, setItems] = useState<Record<string, SaleItem>>({});
  const [ordersOpen, setOrdersOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [orderFilter, setOrderFilter] = useState<'all' | 'waiting' | 'paid'>('all');
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/order`;

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('public_sale_items').select('product_id,is_open,required_pct,size_chart_url'),
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
  const shownOrders = orderFilter === 'paid' ? paid : orderFilter === 'waiting' ? waiting : orders;
  const sum = (l: Booking[], f: (b: Booking) => number) => l.reduce((a, b) => a + f(b), 0);

  const sellable = products.filter((p) => (p.price || 0) > 0);
  const groups = useMemo(() => {
    const cats = [...categories].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const out: { id: string; name: string; list: Product[] }[] = cats
      .map((c) => ({ id: c.id, name: c.name, list: sellable.filter((p) => p.categoryId === c.id) }))
      .filter((g) => g.list.length > 0);
    const known = new Set(cats.map((c) => c.id));
    const rest = sellable.filter((p) => !p.categoryId || !known.has(p.categoryId));
    if (rest.length) out.push({ id: 'other', name: 'Other', list: rest });
    return out;
  }, [categories, sellable]);
  const [uploading, setUploading] = useState<string>('');
  const uploadChart = async (productId: string, file: File) => {
    setUploading(productId);
    try {
      const dataUrl = await compressImage(file, 1600, 1600, 0.85);
      const blob = await (await fetch(dataUrl)).blob();
      const path = `size-charts/${productId}-${Date.now()}.jpg`;
      const up = await supabase.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      await saveItem(productId, { size_chart_url: url });
      onShowToast('Size chart saved.');
    } catch (e: any) {
      onShowToast('Could not upload the size chart: ' + (e?.message || 'error'));
    }
    setUploading('');
  };

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

      <div className="grid grid-cols-3 gap-2">
        {([
          ['all', 'All orders', orders],
          ['waiting', 'Awaiting payment', waiting],
          ['paid', 'Paid', paid],
        ] as const).map(([key, label, list]) => (
          <button
            key={key}
            type="button"
            onClick={() => setOrderFilter(key)}
            className={`text-left rounded-xl p-3 border-2 transition-colors ${
              orderFilter === key ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className={`text-[11px] font-semibold ${orderFilter === key ? 'text-slate-300' : 'text-slate-500'}`}>{label}</div>
            <div className="text-lg font-black leading-tight">{list.length}</div>
            <div className="text-xs font-bold">{money(sum(list, (b) => b.total))}</div>
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="font-bold text-slate-900 mb-2">
          Orders from the link{orderFilter === 'paid' ? ' · Paid' : orderFilter === 'waiting' ? ' · Awaiting payment' : ''}
        </div>
        {orders.length === 0 && <div className="text-sm text-slate-500">No orders yet.</div>}
        {orders.length > 0 && shownOrders.length === 0 && (
          <div className="text-sm text-slate-500">No orders in this group.</div>
        )}
        <div className="space-y-2">
          {shownOrders.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onOpenOrder(b.id)}
              className="w-full text-left border border-slate-200 hover:border-slate-300 active:bg-slate-50 rounded-xl px-3.5 py-3 flex items-center justify-between gap-3 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-black text-slate-900 truncate">{b.clientName}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{b.clientPhone}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">{b.bookingNumber}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-black text-slate-900">{money(b.total)}</div>
                <span
                  className={`inline-block mt-1 text-[11px] font-black px-2 py-0.5 rounded-full ${
                    b.depositPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {b.depositPaid ? 'Paid' : 'Awaiting payment'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="font-bold text-slate-900 mb-1">Items on the public page</div>
        <p className="text-xs text-slate-500 mb-2">Tick an item to open it for customers. Choose how much of the price they must pay first.</p>
        {!loaded && <div className="text-sm text-slate-500">Loading…</div>}
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.id}>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">{g.name}</div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl px-3">
                {g.list.map((p) => {
                  const it = items[p.id];
                  const thumb = (p.images && p.images[0]) || p.image;
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-2 text-sm">
                      <input type="checkbox" className="w-5 h-5" checked={Boolean(it?.is_open)} onChange={(e) => saveItem(p.id, { is_open: e.target.checked })} />
                      {thumb ? (
                        <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0" loading="lazy" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{p.name}</div>
                        <div className="text-xs text-slate-500">{money(p.price || 0)}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <label className="text-[11px] font-bold text-indigo-700 cursor-pointer">
                            {uploading === p.id ? 'Uploading…' : it?.size_chart_url ? 'Change size chart' : '+ Size chart'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadChart(p.id, f); e.target.value = ''; }} />
                          </label>
                          {it?.size_chart_url && (
                            <button type="button" className="text-[11px] font-bold text-red-600" onClick={() => saveItem(p.id, { size_chart_url: null })}>Remove</button>
                          )}
                        </div>
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
          ))}
        </div>
      </div>
    </div>
  );
};
