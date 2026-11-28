import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Captcha, captchaEnabled } from './Captcha';
import { SUPABASE_CONFIG, SUPABASE_PUBLISHABLE_KEY } from '../services/supabaseClient';

const ENDPOINT = `${SUPABASE_CONFIG.url}/functions/v1/public-order`;
const WHATSAPP = '+201215556301';

interface Variant { id: string; size: string; color: string; hex: string }
interface Item {
  id: string; name: string; price: number; images: string[]; description: string | null;
  required_pct: number; size_chart: string | null; variants: Variant[];
}
interface CartLine { variantId: string; item: Item; variant: Variant; qty: number }
type Pay = 'cash' | 'instapay';

async function call(body: unknown): Promise<any> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify(body),
  });
  let data: any = {};
  try { data = await res.json(); } catch (_) { /* ignore */ }
  return { ok: res.ok, data };
}

const imagesOf = (v: unknown): string[] => {
  if (typeof v !== 'string' || !v) return [];
  if (v.trim().startsWith('[')) {
    try { const a = JSON.parse(v); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch (_) { return []; }
  }
  return [v];
};
const money = (n: number) => `${Math.round(n * 100) / 100} EGP`;
const vLabel = (v: Variant) =>
  [v.size && v.size !== 'One Size' ? v.size : '', v.color && v.color !== 'Standard' ? v.color : ''].filter(Boolean).join(' · ') || 'Standard';

/** Full-screen photo viewer. Swipe sideways (or use arrows) to see every photo. */
const Lightbox: React.FC<{ images: string[]; start?: number; title?: string; onClose: () => void }> = ({ images, start = 0, title, onClose }) => {
  const [i, setI] = useState(start);
  const sc = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sc.current?.scrollTo({ left: start * (sc.current?.clientWidth || 0) });
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const go = (n: number) => {
    const t = Math.max(0, Math.min(images.length - 1, n));
    sc.current?.scrollTo({ left: t * (sc.current?.clientWidth || 0), behavior: 'smooth' });
    setI(t);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-3 text-white">
        <div className="font-bold truncate">{title}{images.length > 1 ? `  ·  ${i + 1}/${images.length}` : ''}</div>
        <button className="w-10 h-10 rounded-full bg-white/20 text-2xl leading-none" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="relative flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
        <div ref={sc} className="h-full flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {images.map((src, k) => (
            <div key={k} className="w-full h-full shrink-0 snap-center flex items-center justify-center p-2">
              <img src={src} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 text-xl" onClick={() => go(i - 1)} aria-label="Previous">‹</button>
            <button className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 text-xl" onClick={() => go(i + 1)} aria-label="Next">›</button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 p-3">
          {images.map((_, k) => <span key={k} className={`w-2 h-2 rounded-full ${k === i ? 'bg-white' : 'bg-white/40'}`} />)}
        </div>
      )}
    </div>
  );
};

const Step: React.FC<{ n: number; title: string; ar: string; children: React.ReactNode }> = ({ n, title, ar, children }) => (
  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-3">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center shrink-0">{n}</div>
      <div className="leading-tight">
        <div className="font-black text-lg">{title}</div>
        <div className="text-xs text-slate-500" dir="rtl">{ar}</div>
      </div>
    </div>
    {children}
  </section>
);

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
  const [pay, setPay] = useState<Pay | ''>('');
  const [token, setToken] = useState('');
  const [capKey, setCapKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [light, setLight] = useState<{ images: string[]; start: number; title: string } | null>(null);
  const [done, setDone] = useState<{ order_number: string; total: number; required: number; pay: Pay } | null>(null);
  const orderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'SPS Order';
    call({ action: 'list' }).then(({ ok, data }) => {
      if (!ok) return setLoadErr(true);
      setOpen(Boolean(data.open));
      setItems((data.items || []).map((i: any) => ({ ...i, images: imagesOf(i.image) })));
    });
  }, []);

  const total = useMemo(() => cart.reduce((a, l) => a + l.item.price * l.qty, 0), [cart]);
  const required = useMemo(() => cart.reduce((a, l) => a + (l.item.price * l.qty * l.item.required_pct) / 100, 0), [cart]);
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const qtyOf = (vid: string) => cart.find((l) => l.variantId === vid)?.qty || 0;
  const itemQty = (it: Item) => cart.filter((l) => l.item.id === it.id).reduce((a, l) => a + l.qty, 0);
  const chosenVariant = (it: Item) => it.variants.find((v) => v.id === (pick[it.id] || (it.variants.length === 1 ? it.variants[0].id : '')));

  const change = (it: Item, v: Variant, d: number) =>
    setCart((c) => {
      const ex = c.find((l) => l.variantId === v.id);
      if (!ex) return d > 0 ? [...c, { variantId: v.id, item: it, variant: v, qty: 1 }] : c;
      const q = Math.min(10, ex.qty + d);
      return q <= 0 ? c.filter((l) => l.variantId !== v.id) : c.map((l) => (l.variantId === v.id ? { ...l, qty: q } : l));
    });

  const submit = async () => {
    setErr('');
    if (name.trim().length < 2) return setErr('Please type your name. / اكتب اسمك');
    if (phone.replace(/\D/g, '').length < 10) return setErr('Please type a valid phone number. / اكتب رقم تليفون صحيح');
    if (!ashira) return setErr('Please choose Ashira 1 or Ashira 2. / اختار العشيرة');
    if (team.trim().length < 2) return setErr('Please type your team name. / اكتب اسم فريقك');
    if (cart.length === 0) return setErr('Please add at least one item. / اختار منتج واحد على الأقل');
    if (!pay) return setErr('Please choose how you will pay: Cash or Instapay. / اختار طريقة الدفع');
    if (captchaEnabled && !token) return setErr('Please complete the "I am human" check. / أكمل خانة "أنا إنسان"');
    setBusy(true);
    const { ok, data } = await call({
      action: 'submit', name, phone, ashira, team, website, payment: pay, captchaToken: token,
      items: cart.map((l) => ({ variant_id: l.variantId, quantity: l.qty })),
    });
    setBusy(false);
    if (ok && data.ok) { window.scrollTo(0, 0); return setDone({ ...data, pay }); }
    setErr(data.message || 'Something went wrong. Please try again.');
    setToken('');
    setCapKey((k) => k + 1);
  };

  const box = 'w-full border-2 border-slate-200 focus:border-indigo-500 outline-none rounded-2xl px-4 py-3 text-base bg-white';

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-slate-50 p-4 flex items-start justify-center">
        <div className="bg-white rounded-3xl shadow border border-slate-200 p-5 max-w-md w-full space-y-4 mt-6 text-slate-900">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 text-4xl flex items-center justify-center">✓</div>
            <div className="text-2xl font-black text-emerald-700 mt-2">Order received</div>
            <div className="text-sm text-slate-500" dir="rtl">تم استلام طلبك</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Order number</span><b>{done.order_number}</b></div>
            <div className="flex justify-between"><span>Total</span><b>{money(done.total)}</b></div>
            <div className="flex justify-between"><span>To pay now</span><b>{money(done.required)}</b></div>
          </div>
          {done.pay === 'instapay' ? (
            <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 text-sm space-y-2">
              <div className="font-black text-base">Next step: pay by Instapay</div>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Pay <b>{money(done.required)}</b> by Instapay.</li>
                <li>Take a screenshot of the transfer.</li>
                <li>Send it on WhatsApp to <b dir="ltr">{WHATSAPP}</b> with your name and order number.</li>
              </ol>
              <div className="text-xs text-slate-600">Your order counts only after we check your payment.</div>
              <a href={`https://wa.me/${WHATSAPP.replace('+', '')}`} className="block text-center rounded-xl bg-emerald-600 text-white font-bold py-2.5 mt-1">Open WhatsApp</a>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 text-sm space-y-2">
              <div className="font-black text-base">You chose to pay cash</div>
              <div>Please send your name and order number <b>{done.order_number}</b> on WhatsApp to <b dir="ltr">{WHATSAPP}</b> and we will arrange the cash payment with you.</div>
              <div className="text-xs text-slate-600">Your order counts only after we receive your payment.</div>
              <a href={`https://wa.me/${WHATSAPP.replace('+', '')}`} className="block text-center rounded-xl bg-emerald-600 text-white font-bold py-2.5 mt-1">Open WhatsApp</a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      {light && <Lightbox images={light.images} start={light.start} title={light.title} onClose={() => setLight(null)} />}
      <div className="bg-indigo-700 text-white px-4 pt-6 pb-8">
        <div className="max-w-xl mx-auto">
          <div className="text-3xl font-black">SPS Store</div>
          <div className="text-indigo-100 text-sm mt-1">Order your gear in 3 easy steps. No account needed.</div>
          <div className="text-indigo-200 text-xs mt-0.5" dir="rtl">اطلب بسهولة في ٣ خطوات، من غير تسجيل</div>
        </div>
      </div>
      <div className="max-w-xl mx-auto p-3 sm:p-4 space-y-4 -mt-4">
        {loadErr && <div className="rounded-2xl bg-red-50 border border-red-200 text-red-800 p-4 text-sm">Could not load the page. Please refresh.</div>}
        {!items && !loadErr && <div className="rounded-2xl bg-white p-6 text-center text-slate-500">Loading…</div>}
        {items && !open && <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center font-bold">Orders are closed right now.<div className="text-sm text-slate-500 font-normal" dir="rtl">الطلبات مقفولة حاليا</div></div>}
        {items && open && items.length === 0 && <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center font-bold">No items are open right now.<div className="text-sm text-slate-500 font-normal" dir="rtl">مفيش منتجات متاحة حاليا</div></div>}

        {items && open && items.length > 0 && (
          <>
            <Step n={1} title="Your details" ar="بياناتك">
              <input className={box} placeholder="Full name · الاسم بالكامل" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
              <input className={box} placeholder="Phone number · رقم التليفون" inputMode="tel" autoComplete="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                {[['3ashera 1', 'Ashira 1', 'عشيرة ١'], ['3ashera 2', 'Ashira 2', 'عشيرة ٢']].map(([v, l, ar]) => (
                  <button key={v} type="button" onClick={() => setAshira(v)}
                    className={`rounded-2xl border-2 py-3 font-black leading-tight ${ashira === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-800'}`}>
                    {l}<div className="text-[11px] font-normal opacity-80" dir="rtl">{ar}</div>
                  </button>
                ))}
              </div>
              <input className={box} placeholder="Your team name · اسم فريقك" value={team} maxLength={60} onChange={(e) => setTeam(e.target.value)} />
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} name="website" />
            </Step>

            <Step n={2} title="Choose your items" ar="اختار المنتجات">
              <div className="space-y-4">
                {items.map((it) => {
                  const n = itemQty(it);
                  const v = chosenVariant(it);
                  const q = v ? qtyOf(v.id) : 0;
                  return (
                    <div key={it.id} className={`relative rounded-2xl border-2 p-3 transition-colors ${n > 0 ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                      {n > 0 && <div className="absolute -top-2.5 right-3 bg-emerald-600 text-white text-xs font-black rounded-full px-3 py-1 shadow">✓ x{n} added</div>}
                      <div className="flex gap-3">
                        <button type="button" className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-slate-100 shrink-0"
                          onClick={() => it.images.length && setLight({ images: it.images, start: 0, title: it.name })} aria-label="Enlarge photo">
                          {it.images[0] ? <img src={it.images[0]} alt={it.name} className="w-full h-full object-cover" /> : null}
                          {it.images.length > 1 && <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-bold rounded-full px-2 py-0.5">{it.images.length} photos</span>}
                          {it.images.length > 0 && <span className="absolute top-1 left-1 bg-black/50 text-white text-[10px] rounded-full px-1.5 py-0.5">🔍</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="font-black leading-tight">{it.name}</div>
                          <div className="text-lg font-black text-indigo-700">{money(it.price)}</div>
                          <div className="inline-block text-[11px] font-bold bg-amber-100 text-amber-900 rounded-full px-2 py-0.5">Pay {it.required_pct}% now</div>
                          {it.size_chart && (
                            <button type="button" className="block mt-1 text-xs font-bold text-indigo-700 underline"
                              onClick={() => setLight({ images: [it.size_chart!], start: 0, title: `${it.name} · Size chart` })}>📏 Size chart · جدول المقاسات</button>
                          )}
                        </div>
                      </div>
                      {it.variants.length > 1 && (
                        <div className="mt-3">
                          <div className="text-xs font-bold text-slate-600 mb-1">Choose size / colour · اختار المقاس</div>
                          <div className="flex flex-wrap gap-1.5">
                            {it.variants.map((x) => {
                              const inCart = qtyOf(x.id);
                              return (
                                <button key={x.id} type="button" onClick={() => setPick({ ...pick, [it.id]: x.id })}
                                  className={`px-3 py-1.5 rounded-xl border-2 text-sm font-bold ${pick[it.id] === x.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-800'}`}>
                                  {vLabel(x)}{inCart > 0 ? ` (x${inCart})` : ''}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="mt-3">
                        {!v ? (
                          <div className="text-sm text-slate-500 text-center py-2">Choose a size first · اختار المقاس الأول</div>
                        ) : q === 0 ? (
                          <button type="button" onClick={() => change(it, v, 1)} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black text-base active:scale-95">+ Add to my order · أضف</button>
                        ) : (
                          <div className="flex items-center justify-between rounded-xl bg-white border-2 border-emerald-500 px-2 py-1.5">
                            <button type="button" className="w-11 h-11 rounded-xl bg-slate-100 text-2xl font-black" onClick={() => change(it, v, -1)} aria-label="Less">−</button>
                            <div className="text-center"><div className="text-xl font-black">x{q}</div><div className="text-[11px] text-slate-500">{vLabel(v)}</div></div>
                            <button type="button" className="w-11 h-11 rounded-xl bg-indigo-600 text-white text-2xl font-black" onClick={() => change(it, v, 1)} aria-label="More">+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Step>

            <div ref={orderRef}>
              <Step n={3} title="Review and send" ar="راجع وابعت الطلب">
                {cart.length === 0 && <div className="text-sm text-slate-500">Nothing added yet. Add an item above. · لسه مختارتش حاجة</div>}
                {cart.map((l) => (
                  <div key={l.variantId} className="flex items-center justify-between gap-2 text-sm border-b border-slate-100 pb-2">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{l.item.name}</div>
                      <div className="text-xs text-slate-500">{vLabel(l.variant)} · {money(l.item.price)} each</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" className="w-9 h-9 rounded-lg bg-slate-100 text-lg font-black" onClick={() => change(l.item, l.variant, -1)}>−</button>
                      <span className="w-6 text-center font-black">{l.qty}</span>
                      <button type="button" className="w-9 h-9 rounded-lg bg-slate-100 text-lg font-black" onClick={() => change(l.item, l.variant, 1)}>+</button>
                    </div>
                  </div>
                ))}
                {cart.length > 0 && (
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span>Total · الإجمالي</span><b className="text-base">{money(total)}</b></div>
                    <div className="flex justify-between"><span>To pay now · المطلوب دفعه الآن</span><b className="text-base text-indigo-700">{money(required)}</b></div>
                  </div>
                )}

                <div>
                  <div className="font-bold text-sm mb-1.5">How will you pay? · هتدفع إزاي؟</div>
                  <div className="grid grid-cols-2 gap-2">
                    {([['cash', 'Cash', 'كاش', '💵'], ['instapay', 'Instapay', 'إنستاباي', '📱']] as const).map(([v, l, ar, ic]) => (
                      <button key={v} type="button" onClick={() => setPay(v)}
                        className={`rounded-2xl border-2 py-3 font-black leading-tight ${pay === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200'}`}>
                        <div className="text-xl">{ic}</div>{l}<div className="text-[11px] font-normal opacity-80" dir="rtl">{ar}</div>
                      </button>
                    ))}
                  </div>
                  {pay === 'instapay' && (
                    <div className="mt-2 rounded-2xl bg-amber-50 border border-amber-300 p-3 text-sm space-y-1">
                      <div className="font-bold">Pay by Instapay</div>
                      <div>After you send the order, pay <b>{money(required)}</b> by Instapay, then send the transfer screenshot on WhatsApp to <b dir="ltr">{WHATSAPP}</b> with your name and order number.</div>
                    </div>
                  )}
                  {pay === 'cash' && (
                    <div className="mt-2 rounded-2xl bg-amber-50 border border-amber-300 p-3 text-sm">
                      You will pay cash. After you send the order, message us on WhatsApp <b dir="ltr">{WHATSAPP}</b> to arrange it.
                    </div>
                  )}
                </div>

                <Captcha onToken={setToken} resetKey={capKey} />
                {err && <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold p-3">{err}</div>}
                <button type="button" disabled={busy} onClick={submit} className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-lg disabled:opacity-50 active:scale-95">
                  {busy ? 'Sending…' : 'Send my order · ابعت الطلب'}
                </button>
                <div className="text-xs text-slate-500 text-center">Your order counts only after we confirm your payment.</div>
              </Step>
            </div>
          </>
        )}
      </div>

      {items && open && count > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-lg p-3">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <div className="text-sm leading-tight"><b>{count}</b> item{count > 1 ? 's' : ''} · <b>{money(total)}</b></div>
            <button type="button" onClick={() => orderRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-black">Review order ↓</button>
          </div>
        </div>
      )}
    </div>
  );
};
