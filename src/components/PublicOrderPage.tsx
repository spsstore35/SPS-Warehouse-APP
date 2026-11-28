import React, { useEffect, useMemo, useState } from 'react';
import { Captcha, captchaEnabled } from './Captcha';

import { SUPABASE_CONFIG, SUPABASE_PUBLISHABLE_KEY } from '../services/supabaseClient';
const ANON_KEY = SUPABASE_PUBLISHABLE_KEY;
const ENDPOINT = `${SUPABASE_CONFIG.url}/functions/v1/public-order`;
const WHATSAPP = '+201215556301';

interface Variant { id: string; size: string; color: string; hex: string }
interface Item { id: string; name: string; price: number; image: string | null; description: string | null; required_pct: number; variants: Variant[] }
interface CartLine { variantId: string; item: Item; variant: Variant; qty: number }

async function call(body: unknown): Promise<any> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify(body),
  });
  let data: any = {};
  try { data = await res.json(); } catch (_) { /* ignore */ }
  return { ok: res.ok, data };
}
const firstImage = (v: string | null): string | null => {
  if (!v) return null;
  if (v.trim().startsWith('[')) {
    try { const a = JSON.parse(v); return typeof a[0] === 'string' ? a[0] : null; } catch (_) { return null; }
  }
  return v;
};
const money = (n: number) => `${Math.round(n * 100) / 100} EGP`;
const vLabel = (v: Variant) => [v.size && v.size !== 'One Size' ? v.size : '', v.color && v.color !== 'Standard' ? v.color : ''].filter(Boolean).join(' · ') || 'Standard';

export const PublicOrderPage: React.FC = () => {
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [ashira, setAshira] = useState('');
  const [team, setTeam] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [pick, setPick] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [token, setToken] = useState('');
  const [capKey, setCapKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ order_number: string; total: number; required: number } | null>(null);

  useEffect(() => {
    document.title = 'SPS Order';
    call({ action: 'list' }).then(({ ok, data }) => {
      if (!ok) return setLoadErr(true);
      setOpen(Boolean(data.open));
      setItems((data.items || []).map((i: Item) => ({ ...i, image: firstImage(i.image) })));
    });
  }, []);

  const total = useMemo(() => cart.reduce((a, l) => a + l.item.price * l.qty, 0), [cart]);
  const required = useMemo(() => cart.reduce((a, l) => a + (l.item.price * l.qty * l.item.required_pct) / 100, 0), [cart]);

  const add = (item: Item) => {
    const vid = pick[item.id] || (item.variants.length === 1 ? item.variants[0].id : '');
    const variant = item.variants.find((v) => v.id === vid);
    if (!variant) return setErr(`Please choose a size for ${item.name}.`);
    setErr('');
    setCart((c) => {
      const ex = c.find((l) => l.variantId === vid);
      if (ex) return c.map((l) => (l.variantId === vid ? { ...l, qty: Math.min(10, l.qty + 1) } : l));
      return [...c, { variantId: vid, item, variant, qty: 1 }];
    });
  };

  const submit = async () => {
    setErr('');
    if (name.trim().length < 2) return setErr('Please type your name.');
    if (phone.replace(/\D/g, '').length < 10) return setErr('Please type a valid phone number.');
    if (!ashira) return setErr('Please choose Ashira 1 or Ashira 2.');
    if (team.trim().length < 2) return setErr('Please type your team name.');
    if (cart.length === 0) return setErr('Please add at least one item.');
    if (captchaEnabled && !token) return setErr('Please complete the "I am human" check.');
    setBusy(true);
    const { ok, data } = await call({
      action: 'submit', name, phone, ashira, team, website, captchaToken: token,
      items: cart.map((l) => ({ variant_id: l.variantId, quantity: l.qty })),
    });
    setBusy(false);
    if (ok && data.ok) return setDone(data);
    setErr(data.message || 'Something went wrong. Please try again.');
    setToken('');
    setCapKey((k) => k + 1);
  };

  const box = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-base bg-white';

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-start justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md w-full space-y-3 mt-6 text-slate-900">
          <div className="text-2xl font-black text-emerald-700">Order received ✔</div>
          <div className="text-sm">Order number: <b>{done.order_number}</b></div>
          <div className="text-sm">Total: <b>{money(done.total)}</b></div>
          <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm space-y-1">
            <div className="font-bold">Next step: pay by Instapay</div>
            <div>Please pay <b>{money(done.required)}</b> by Instapay.</div>
            <div>Then send the transfer screenshot on WhatsApp to <b dir="ltr">{WHATSAPP}</b> with your name and order number.</div>
            <div className="text-xs text-slate-600">Your order is only confirmed after we check your payment.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10 text-slate-900">
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <div className="text-2xl font-black">SPS Store · Order</div>
        {loadErr && <div className="text-sm text-red-700">Could not load the page. Please refresh.</div>}
        {items && !open && <div className="rounded-xl bg-slate-200 p-4 font-semibold">Orders are closed right now.</div>}
        {items && open && items.length === 0 && <div className="rounded-xl bg-slate-200 p-4 font-semibold">No items are open right now.</div>}
        {!items && !loadErr && <div className="text-sm text-slate-500">Loading…</div>}

        {items && open && items.length > 0 && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="font-bold">1. Your details</div>
              <input className={box} placeholder="Full name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              <input className={box} placeholder="Phone number" inputMode="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                {[['3ashera 1', 'Ashira 1'], ['3ashera 2', 'Ashira 2']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setAshira(v)}
                    className={`rounded-xl border-2 py-2.5 font-bold ${ashira === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}>{l}</button>
                ))}
              </div>
              <input className={box} placeholder="Your team name (inside your Ashira)" value={team} maxLength={60} onChange={(e) => setTeam(e.target.value)} />
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} name="website" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
              <div className="font-bold">2. Choose items</div>
              {items.map((it) => (
                <div key={it.id} className="flex gap-3">
                  {it.image ? <img src={it.image} alt={it.name} className="w-24 h-24 object-cover rounded-xl bg-slate-100 shrink-0" /> : <div className="w-24 h-24 rounded-xl bg-slate-100 shrink-0" />}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="font-bold leading-tight">{it.name}</div>
                    <div className="text-sm">{money(it.price)} <span className="text-xs text-slate-500">· pay {it.required_pct}% now</span></div>
                    {it.variants.length > 1 && (
                      <select className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-full" value={pick[it.id] || ''} onChange={(e) => setPick({ ...pick, [it.id]: e.target.value })}>
                        <option value="">Choose size / colour</option>
                        {it.variants.map((v) => <option key={v.id} value={v.id}>{vLabel(v)}</option>)}
                      </select>
                    )}
                    <button type="button" onClick={() => add(it)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-bold">Add</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="font-bold">3. Your order</div>
              {cart.length === 0 && <div className="text-sm text-slate-500">Nothing added yet.</div>}
              {cart.map((l) => (
                <div key={l.variantId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{l.item.name}</div>
                    <div className="text-xs text-slate-500">{vLabel(l.variant)} · {money(l.item.price)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" className="w-7 h-7 rounded-lg border" onClick={() => setCart((c) => c.flatMap((x) => (x.variantId === l.variantId ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))}>−</button>
                    <span className="w-5 text-center font-bold">{l.qty}</span>
                    <button type="button" className="w-7 h-7 rounded-lg border" onClick={() => setCart((c) => c.map((x) => (x.variantId === l.variantId ? { ...x, qty: Math.min(10, x.qty + 1) } : x)))}>+</button>
                  </div>
                </div>
              ))}
              {cart.length > 0 && (
                <div className="border-t pt-2 text-sm space-y-0.5">
                  <div className="flex justify-between"><span>Total</span><b>{money(total)}</b></div>
                  <div className="flex justify-between"><span>Pay now by Instapay</span><b>{money(required)}</b></div>
                </div>
              )}
              <Captcha onToken={setToken} resetKey={capKey} />
              {err && <div className="text-sm text-red-700 font-semibold">{err}</div>}
              <button type="button" disabled={busy} onClick={submit} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-base disabled:opacity-50">
                {busy ? 'Sending…' : 'Send order'}
              </button>
              <div className="text-xs text-slate-500">After sending, you pay by Instapay and send the transfer screenshot on WhatsApp. The order counts only after we confirm the payment.</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
