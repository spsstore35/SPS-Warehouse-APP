import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Booking, Category, Product, TeamChangeRequest } from '../types/inventory';
import { compressImage } from '../utils/imageCompressor';
import { supabase } from '../services/supabaseClient';
import { Link2, Copy, Check, FileText, ExternalLink, Download } from 'lucide-react';

interface Props {
  products: Product[];
  categories: Category[];
  bookings: Booking[];
  onMarkPaid: (bookingId: string) => void;
  onOpenInvoice: (booking: Booking) => void;
  onOpenOrder: (bookingId: string) => void;
  onShowToast: (msg: string) => void;
  canManage?: boolean;
  onSubmitTeamRequest?: (draft: Omit<TeamChangeRequest, 'id' | 'status' | 'requestedById' | 'requestedByName' | 'requestedAt'>) => void;
}

interface SaleItem {
  product_id: string;
  is_open: boolean;
  required_pct: number;
  size_chart_url?: string | null;
}

const money = (n: number) => `${Math.round(n * 100) / 100} EGP`;

export const PublicSalesView: React.FC<Props> = ({ products, categories, bookings, onMarkPaid, onOpenInvoice, onOpenOrder, onShowToast, canManage = false, onSubmitTeamRequest }) => {
  const [reqKind, setReqKind] = useState('open');
  const [reqProduct, setReqProduct] = useState('');
  const [reqPct, setReqPct] = useState(100);
  const [reqNote, setReqNote] = useState('');
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
  const exportCsv = () => {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const phone = (v: string) => (v && v !== 'N/A' ? `="${v.replace(/"/g, '')}"` : '');
    const team = (b: Booking) => (b.troopGroup === '3ashera 1' ? 'Ashira 1' : b.troopGroup === '3ashera 2' ? 'Ashira 2' : b.troopGroup || '');
    const header = ['Order number', 'Customer', 'Phone', 'Team', 'Raht', 'Items (size x qty)', 'Total EGP', 'To pay now EGP', 'Paid status', 'Date', 'Payment method'];
    const rows = shownOrders.map((b) => [
      b.bookingNumber,
      b.clientName,
      phone(b.clientPhone),
      team(b),
      b.teamName || '',
      b.items.map((i) => `${i.productName}${i.size && i.size !== 'One Size' ? ` (${i.size})` : ''} x${i.quantity}`).join(' | '),
      Math.round(b.total * 100) / 100,
      Math.round((b.depositRequired || 0) * 100) / 100,
      b.depositPaid ? 'Paid' : 'Awaiting payment',
      b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB') : '',
      b.paymentMethod === 'instapay' ? 'Instapay' : b.paymentMethod === 'cash' ? 'Cash' : '',
    ]);
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((c, idx) => (idx === 2 ? String(c) : q(c))).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `public-orders-${orderFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
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
        {canManage ? (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={ordersOpen} onChange={(e) => saveOpen(e.target.checked)} />
          Orders are open (untick to close the whole page at once)
        </label>
        ) : (
          <div className="text-xs text-slate-500">View only. Changes go through a request (below).</div>
        )}
        <p className="text-xs text-slate-500">
          Customers pay by Instapay and send the screenshot to +201215556301. Their order stays &quot;Awaiting payment&quot; and nothing is deducted
          until an admin confirms payment.
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
        <button
          type="button"
          onClick={exportCsv}
          disabled={shownOrders.length === 0}
          className="mb-3 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-black flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Download Excel (CSV) · {shownOrders.length} orders
        </button>
        {orders.length === 0 && <div className="text-sm text-slate-500">No orders yet.</div>}
        {orders.length > 0 && shownOrders.length === 0 && (
          <div className="text-sm text-slate-500">No orders in this group.</div>
        )}
        <div className="space-y-2">
          {shownOrders.map((b) => (
            <div
              key={b.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenOrder(b.id)}
              className="w-full cursor-pointer text-left border border-slate-200 hover:border-slate-300 active:bg-slate-50 rounded-xl px-3.5 py-3 space-y-2.5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black text-slate-900 break-words">{b.clientName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{b.clientPhone}</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">{b.bookingNumber}</div>
                </div>
                <div className="font-black text-slate-900 shrink-0">{money(b.total)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-label="Open invoice"
                  title="Invoice"
                  onClick={(e) => { e.stopPropagation(); onOpenInvoice(b); }}
                  className="w-9 h-9 shrink-0 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 active:scale-95 flex items-center justify-center text-slate-700"
                >
                  <FileText className="w-4 h-4" />
                </button>
                {!canManage && !b.depositPaid && onSubmitTeamRequest && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSubmitTeamRequest({
                        teamScope: 'troops',
                        entityType: 'booking_status',
                        actionType: 'update',
                        targetId: b.id,
                        title: `Confirm payment for Order #${b.bookingNumber}`,
                        summary: `Public Booking order · Client: ${b.clientName} · Total: ${money(b.total)}`,
                        payload: { bookingId: b.id, nextStatus: 'preparing' },
                      });
                    }}
                    className="text-[11px] font-bold px-2.5 py-2 rounded-lg border border-amber-400 text-amber-800 bg-amber-50"
                  >
                    Request Paid
                  </button>
                )}
                <span
                  className={`ml-auto text-[11px] font-black px-2 py-1 rounded-full ${
                    b.depositPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {b.depositPaid ? 'Paid' : 'Awaiting payment'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!canManage && onSubmitTeamRequest && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="font-bold text-slate-900">Request a change</div>
          <p className="text-xs text-slate-500">Goes to the team admin or the full admin. Either one can approve it, and the change happens when they do.</p>
          <select className="w-full border border-slate-300 rounded-lg text-sm px-2 py-2" value={reqKind} onChange={(e) => setReqKind(e.target.value)}>
            <option value="open">Open an item for customers</option>
            <option value="close">Close an item</option>
            <option value="pct">Change an item's pay % (100/70/50)</option>
            <option value="page_open">Open the whole page</option>
            <option value="page_close">Close the whole page</option>
            <option value="other">Other change (write it below)</option>
          </select>
          {['open', 'close', 'pct'].includes(reqKind) && (
            <select className="w-full border border-slate-300 rounded-lg text-sm px-2 py-2" value={reqProduct} onChange={(e) => setReqProduct(e.target.value)}>
              <option value="">Choose item…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {reqKind === 'pct' && (
            <select className="w-full border border-slate-300 rounded-lg text-sm px-2 py-2" value={reqPct} onChange={(e) => setReqPct(Number(e.target.value))}>
              <option value={100}>Pay 100%</option>
              <option value={70}>Pay 70%</option>
              <option value={50}>Pay 50%</option>
            </select>
          )}
          <input className="w-full border border-slate-300 rounded-lg text-sm px-2 py-2" placeholder="Note (optional, required for Other)" value={reqNote} onChange={(e) => setReqNote(e.target.value)} />
          <button
            type="button"
            className="text-xs font-bold px-3 py-2 rounded-lg bg-slate-900 text-white"
            onClick={() => {
              const note = reqNote.trim();
              const prod = products.find((p) => p.id === reqProduct);
              const itemKind = ['open', 'close', 'pct'].includes(reqKind);
              if (itemKind && !prod) return onShowToast('Choose an item first.');
              if (reqKind === 'other' && !note) return onShowToast('Write the change you need.');
              const base = { teamScope: 'troops' as const, actionType: 'update' as const };
              if (itemKind && prod) {
                const label = reqKind === 'open' ? 'Open' : reqKind === 'close' ? 'Close' : `Set pay ${reqPct}% for`;
                onSubmitTeamRequest({
                  ...base,
                  entityType: 'public_sale_item',
                  targetId: prod.id,
                  title: `Public Booking: ${label} "${prod.name}"`,
                  summary: note || 'Public Booking item change',
                  payload: reqKind === 'pct' ? { productId: prod.id, requiredPct: reqPct } : { productId: prod.id, isOpen: reqKind === 'open' },
                });
              } else if (reqKind === 'page_open' || reqKind === 'page_close') {
                onSubmitTeamRequest({
                  ...base,
                  entityType: 'public_sale_settings',
                  title: `Public Booking: ${reqKind === 'page_open' ? 'Open' : 'Close'} the whole page`,
                  summary: note || 'Public Booking page change',
                  payload: { ordersOpen: reqKind === 'page_open' },
                });
              } else {
                onSubmitTeamRequest({
                  ...base,
                  entityType: 'public_sale_other',
                  title: 'Public Booking: change request',
                  summary: note,
                  payload: { note },
                });
              }
              setReqNote('');
            }}
          >
            Send request
          </button>
        </div>
      )}

      {canManage && (
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
      )}
    </div>
  );
};
