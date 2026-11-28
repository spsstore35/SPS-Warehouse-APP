import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Captcha, captchaEnabled } from './Captcha';
import { SUPABASE_CONFIG, SUPABASE_PUBLISHABLE_KEY } from '../services/supabaseClient';

const ENDPOINT = `${SUPABASE_CONFIG.url}/functions/v1/public-order`;
const WHATSAPP = '+201215556301';
const fmt = (str: string, v: Record<string, string | number>) => str.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

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


type Lang = 'ar' | 'en';
const OLIVE = '#566524';
const GOLD = '#F5B316';
const T: Record<Lang, Record<string, string>> = {
  en: {
    brand: 'SPS Store', sub: 'Order your gear in 3 easy steps. No account needed.',
    s1: 'Your details', s2: 'Choose your items', s3: 'Review and send',
    name: 'Full name', phone: 'Phone number', ash1: '3ashera 1', ash2: '3ashera 2', team: 'Your team name',
    loading: 'Loading…', loadErr: 'Could not load the page. Please refresh.', closed: 'Orders are closed right now.', none: 'No items are open right now.',
    addedTag: 'added', payNow: 'Pay {p}% now', photos: 'photos', sizeChart: 'Size chart', chooseSize: 'Choose size / colour', chooseFirst: 'Choose a size first',
    add: '+ Add to my order', less: 'Less', more: 'More', empty: 'Nothing added yet. Add an item above.', each: 'each',
    total: 'Total', toPay: 'To pay now', howPay: 'How will you pay?', cash: 'Cash', instapay: 'Instapay',
    instaTitle: 'Pay by Instapay', instaText: 'After you send the order, pay {a} by Instapay, then send the transfer screenshot on WhatsApp to {w} with your name and order number.',
    cashText: 'You will pay cash. After you send the order, message us on WhatsApp {w} to arrange it.',
    send: 'Send my order', sending: 'Sending…', note: 'Your order counts only after we confirm your payment.',
    items1: 'item', itemsN: 'items', review: 'Review order',
    eName: 'Please type your name.', ePhone: 'Please type a valid phone number.', eAsh: 'Please choose 3ashera 1 or 3ashera 2.', eTeam: 'Please type your team name.',
    eCart: 'Please add at least one item.', ePay: 'Please choose how you will pay: Cash or Instapay.', eCaptcha: 'Please complete the "I am human" check.',
    eGeneric: 'Something went wrong. Please try again.', eRate: 'Too many orders. Please try again later.', eItem: 'One of the items is not available anymore. Please refresh the page.',
    doneTitle: 'Order received', orderNo: 'Order number', next: 'Next step: pay by Instapay',
    i1: 'Pay {a} by Instapay.', i2: 'Take a screenshot of the transfer.', i3: 'Send it on WhatsApp to {w} with your name and order number.',
    cashTitle: 'You chose to pay cash', cashDone: 'Please send your name and order number {n} on WhatsApp to {w} and we will arrange the cash payment with you.',
    countsAfter: 'Your order counts only after we check your payment.', countsAfterCash: 'Your order counts only after we receive your payment.', wa: 'Open WhatsApp',
    close: 'Close', enlarge: 'Enlarge photo', lang: 'العربية', egp: 'EGP', photosOf: 'of',
  },
  ar: {
    brand: 'متجر SPS', sub: 'اطلب مستلزماتك في 3 خطوات بسيطة. من غير تسجيل.',
    s1: 'بياناتك', s2: 'اختار المنتجات', s3: 'راجع وابعت الطلب',
    name: 'الاسم بالكامل', phone: 'رقم التليفون', ash1: 'عشيرة 1', ash2: 'عشيرة 2', team: 'اسم فريقك',
    loading: 'جاري التحميل…', loadErr: 'مقدرناش نحمل الصفحة. حاول تعمل تحديث.', closed: 'الطلبات مقفولة حاليا.', none: 'مفيش منتجات متاحة حاليا.',
    addedTag: 'تمت الإضافة', payNow: 'ادفع {p}% دلوقتي', photos: 'صور', sizeChart: 'جدول المقاسات', chooseSize: 'اختار المقاس / اللون', chooseFirst: 'اختار المقاس الأول',
    add: '+ أضف لطلبي', less: 'أقل', more: 'أكتر', empty: 'لسه مضفتش حاجة. أضف منتج من فوق.', each: 'للقطعة',
    total: 'الإجمالي', toPay: 'المطلوب دفعه دلوقتي', howPay: 'هتدفع إزاي؟', cash: 'كاش', instapay: 'إنستاباي',
    instaTitle: 'الدفع بإنستاباي', instaText: 'بعد ما تبعت الطلب، ادفع {a} بإنستاباي، وبعدين ابعت صورة التحويل على واتساب على {w} مع اسمك ورقم الطلب.',
    cashText: 'هتدفع كاش. بعد ما تبعت الطلب، كلمنا على واتساب {w} عشان نرتب معاك.',
    send: 'ابعت الطلب', sending: 'جاري الإرسال…', note: 'طلبك بيتحسب بس بعد ما نتأكد من الدفع.',
    items1: 'منتج', itemsN: 'منتجات', review: 'راجع الطلب',
    eName: 'اكتب اسمك من فضلك.', ePhone: 'اكتب رقم تليفون صحيح.', eAsh: 'اختار عشيرة 1 أو عشيرة 2.', eTeam: 'اكتب اسم فريقك.',
    eCart: 'اختار منتج واحد على الأقل.', ePay: 'اختار طريقة الدفع: كاش أو إنستاباي.', eCaptcha: 'أكمل خانة "أنا مش روبوت".',
    eGeneric: 'حصلت مشكلة. حاول تاني.', eRate: 'طلبات كتير. حاول تاني بعد شوية.', eItem: 'منتج من اللي اخترتهم مبقاش متاح. اعمل تحديث للصفحة.',
    doneTitle: 'تم استلام طلبك', orderNo: 'رقم الطلب', next: 'الخطوة الجاية: الدفع بإنستاباي',
    i1: 'ادفع {a} بإنستاباي.', i2: 'خد صورة (سكرين شوت) للتحويل.', i3: 'ابعتها على واتساب على {w} مع اسمك ورقم الطلب.',
    cashTitle: 'اخترت الدفع كاش', cashDone: 'ابعت اسمك ورقم الطلب {n} على واتساب على {w} ونرتب معاك الدفع كاش.',
    countsAfter: 'طلبك بيتحسب بس بعد ما نتأكد من الدفع.', countsAfterCash: 'طلبك بيتحسب بس بعد ما نستلم الدفع.', wa: 'افتح واتساب',
    close: 'إغلاق', enlarge: 'كبّر الصورة', lang: 'English', egp: 'جنيه', photosOf: 'من',
  },
};

const imagesOf = (v: unknown): string[] => {
  if (typeof v !== 'string' || !v) return [];
  if (v.trim().startsWith('[')) {
    try { const a = JSON.parse(v); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch (_) { return []; }
  }
  return [v];
};
const vLabel = (v: Variant) =>
  [v.size && v.size !== 'One Size' ? v.size : '', v.color && v.color !== 'Standard' ? v.color : ''].filter(Boolean).join(' · ') || 'Standard';
const ERR_KEYS: Record<string, string> = { rate: 'eRate', captcha: 'eCaptcha', closed: 'closed', bad_name: 'eName', bad_phone: 'ePhone', bad_ashira: 'eAsh', bad_team: 'eTeam', bad_items: 'eCart', bad_payment: 'ePay', bad_item: 'eItem' };

const Lightbox: React.FC<{ images: string[]; start?: number; title?: string; closeLabel: string; onClose: () => void }> = ({ images, start = 0, title, closeLabel, onClose }) => {
  const [i, setI] = useState(start);
  const sc = useRef<HTMLDivElement>(null);
  useEffect(() => {
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
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" dir="ltr" onClick={onClose}>
      <div className="flex items-center justify-between p-3 text-white">
        <div className="font-bold truncate">{title}{images.length > 1 ? `  ·  ${i + 1}/${images.length}` : ''}</div>
        <button className="w-10 h-10 rounded-full bg-white/20 text-2xl leading-none" onClick={onClose} aria-label={closeLabel}>×</button>
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
            <button className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 text-xl" onClick={() => go(i - 1)}>‹</button>
            <button className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 text-xl" onClick={() => go(i + 1)}>›</button>
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

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-3">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full text-white font-black flex items-center justify-center shrink-0" style={{ background: OLIVE }}>{n}</div>
      <div className="font-black text-lg">{title}</div>
    </div>
    {children}
  </section>
);

export const PublicOrderPage: React.FC = () => {
  const [lang, setLang] = useState<Lang>(() => ((typeof localStorage !== 'undefined' && localStorage.getItem('sps_order_lang')) === 'ar' ? 'ar' : 'en'));
  const t = (k: string, v: Record<string, string | number> = {}) => fmt(T[lang][k] ?? k, v);
  const money = (n: number) => `${Math.round(n * 100) / 100} ${T[lang].egp}`;
  const toggleLang = () => {
    const n: Lang = lang === 'ar' ? 'en' : 'ar';
    setLang(n);
    try { localStorage.setItem('sps_order_lang', n); } catch (_) { /* ignore */ }
  };
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
  const [token, setTokenState] = useState('');
  const tokenRef = useRef('');
  const setToken = (v: string) => { tokenRef.current = v; setTokenState(v); };
  const [capKey, setCapKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [light, setLight] = useState<{ images: string[]; start: number; title: string } | null>(null);
  const [done, setDone] = useState<{ order_number: string; total: number; required: number; pay: Pay } | null>(null);
  const orderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = t('brand');
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  useEffect(() => {
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
    if (name.trim().length < 2) return setErr(t('eName'));
    if (phone.replace(/\D/g, '').length < 10) return setErr(t('ePhone'));
    if (!ashira) return setErr(t('eAsh'));
    if (team.trim().length < 2) return setErr(t('eTeam'));
    if (cart.length === 0) return setErr(t('eCart'));
    if (!pay) return setErr(t('ePay'));
    setBusy(true);
    if (captchaEnabled) {
      // The check runs quietly in the background; give it a few seconds to finish.
      for (let k = 0; k < 24 && !tokenRef.current; k++) await new Promise((r) => setTimeout(r, 250));
      if (!tokenRef.current) { setBusy(false); return setErr(t('eCaptcha')); }
    }
    const { ok, data } = await call({
      action: 'submit', name, phone, ashira, team, website, payment: pay, captchaToken: tokenRef.current,
      items: cart.map((l) => ({ variant_id: l.variantId, quantity: l.qty })),
    });
    setBusy(false);
    if (ok && data.ok) { window.scrollTo(0, 0); return setDone({ ...data, pay }); }
    setErr(t(ERR_KEYS[data.error] || 'eGeneric'));
    setToken('');
    setCapKey((k) => k + 1);
  };

  const box = 'w-full border-2 border-slate-200 focus:border-[#566524] outline-none rounded-2xl px-4 py-3 text-base bg-white';
  const wa = `https://wa.me/${WHATSAPP.replace('+', '')}`;
  const withWa = (str: string) => str.split('\u0000').map((part, i, a) => <React.Fragment key={i}>{part}{i < a.length - 1 ? <b dir="ltr">{WHATSAPP}</b> : null}</React.Fragment>);
  const LangBtn = (
    <button type="button" onClick={toggleLang} className="rounded-full bg-white/95 text-sm font-black px-4 py-1.5 shadow" style={{ color: OLIVE }}>
      {T[lang].lang}
    </button>
  );
  const rootDir = lang === 'ar' ? 'rtl' : 'ltr';

  if (done) {
    return (
      <div dir={rootDir} className="min-h-screen bg-[#FBF8EE] p-4 flex items-start justify-center">
        <div className="bg-white rounded-3xl shadow border border-slate-200 p-5 max-w-md w-full space-y-4 mt-6 text-slate-900">
          <div className="flex justify-end">{LangBtn}</div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full text-4xl flex items-center justify-center text-white" style={{ background: OLIVE }}>✓</div>
            <div className="text-2xl font-black mt-2" style={{ color: OLIVE }}>{t('doneTitle')}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>{t('orderNo')}</span><b dir="ltr">{done.order_number}</b></div>
            <div className="flex justify-between"><span>{t('total')}</span><b>{money(done.total)}</b></div>
            <div className="flex justify-between"><span>{t('toPay')}</span><b>{money(done.required)}</b></div>
          </div>
          <div className="rounded-2xl border-2 p-4 text-sm space-y-2" style={{ background: '#FFF6D6', borderColor: GOLD }}>
            {done.pay === 'instapay' ? (
              <>
                <div className="font-black text-base">{t('next')}</div>
                <ol className="list-decimal ms-5 space-y-1">
                  <li>{t('i1', { a: money(done.required) })}</li>
                  <li>{t('i2')}</li>
                  <li>{withWa(t('i3', { w: '\u0000' }))}</li>
                </ol>
                <div className="text-xs text-slate-600">{t('countsAfter')}</div>
              </>
            ) : (
              <>
                <div className="font-black text-base">{t('cashTitle')}</div>
                <div>{withWa(t('cashDone', { n: done.order_number, w: '\u0000' }))}</div>
                <div className="text-xs text-slate-600">{t('countsAfterCash')}</div>
              </>
            )}
            <a href={wa} className="block text-center rounded-xl text-white font-bold py-2.5 mt-1" style={{ background: OLIVE }}>{t('wa')}</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={rootDir} className="min-h-screen bg-[#FBF8EE] pb-28 text-slate-900">
      {light && <Lightbox images={light.images} start={light.start} title={light.title} closeLabel={t('close')} onClose={() => setLight(null)} />}
      <div className="text-white px-4 pt-4 pb-9" style={{ background: OLIVE }}>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/sps-logo.png" alt="SPS" className="w-16 h-16 rounded-2xl bg-white p-1.5 object-contain shrink-0" />
              <div className="text-2xl sm:text-3xl font-black truncate">{t('brand')}</div>
            </div>
            {LangBtn}
          </div>
          <div className="text-sm mt-3" style={{ color: '#F7E7B0' }}>{t('sub')}</div>
        </div>
        <div className="h-1 mt-4 rounded-full max-w-xl mx-auto" style={{ background: GOLD }} />
      </div>
      <div className="max-w-xl mx-auto p-3 sm:p-4 space-y-4 -mt-4">
        {loadErr && <div className="rounded-2xl bg-red-50 border border-red-200 text-red-800 p-4 text-sm">{t('loadErr')}</div>}
        {!items && !loadErr && <div className="rounded-2xl bg-white p-6 text-center text-slate-500">{t('loading')}</div>}
        {items && !open && <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center font-bold">{t('closed')}</div>}
        {items && open && items.length === 0 && <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center font-bold">{t('none')}</div>}

        {items && open && items.length > 0 && (
          <>
            <Step n={1} title={t('s1')}>
              <input className={box} placeholder={t('name')} value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
              <input className={box} placeholder={t('phone')} inputMode="tel" autoComplete="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                {[['3ashera 1', t('ash1')], ['3ashera 2', t('ash2')]].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setAshira(v)}
                    className={`rounded-2xl border-2 py-3 font-black ${ashira === v ? 'text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                    style={ashira === v ? { background: OLIVE, borderColor: OLIVE } : undefined}>{l}</button>
                ))}
              </div>
              <input className={box} placeholder={t('team')} value={team} maxLength={60} onChange={(e) => setTeam(e.target.value)} />
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} name="website" />
            </Step>

            <Step n={2} title={t('s2')}>
              <div className="space-y-4">
                {items.map((it) => {
                  const n = itemQty(it);
                  const v = chosenVariant(it);
                  const q = v ? qtyOf(v.id) : 0;
                  return (
                    <div key={it.id} className={`relative rounded-2xl border-2 p-3 transition-colors ${n > 0 ? 'bg-[#F4F7E8]' : 'border-slate-200 bg-white'}`} style={n > 0 ? { borderColor: OLIVE } : undefined}>
                      {n > 0 && <div className="absolute -top-2.5 end-3 text-white text-xs font-black rounded-full px-3 py-1 shadow" style={{ background: OLIVE }}>✓ x{n} {t('addedTag')}</div>}
                      <div className="flex gap-3">
                        <button type="button" className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-slate-100 shrink-0"
                          onClick={() => it.images.length && setLight({ images: it.images, start: 0, title: it.name })} aria-label={t('enlarge')}>
                          {it.images[0] ? <img src={it.images[0]} alt={it.name} className="w-full h-full object-cover" /> : null}
                          {it.images.length > 1 && <span className="absolute bottom-1 end-1 bg-black/60 text-white text-[10px] font-bold rounded-full px-2 py-0.5">{it.images.length} {t('photos')}</span>}
                          {it.images.length > 0 && <span className="absolute top-1 start-1 bg-black/50 text-white text-[10px] rounded-full px-1.5 py-0.5">🔍</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="font-black leading-tight">{it.name}</div>
                          <div className="text-lg font-black" style={{ color: OLIVE }}>{money(it.price)}</div>
                          <div className="inline-block text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: '#FDEBB0', color: '#6B4E00' }}>{t('payNow', { p: it.required_pct })}</div>
                          {it.size_chart && (
                            <button type="button" className="block mt-1 text-xs font-bold underline" style={{ color: OLIVE }}
                              onClick={() => setLight({ images: [it.size_chart!], start: 0, title: `${it.name} · ${t('sizeChart')}` })}>📏 {t('sizeChart')}</button>
                          )}
                        </div>
                      </div>
                      {it.variants.length > 1 && (
                        <div className="mt-3">
                          <div className="text-xs font-bold text-slate-600 mb-1">{t('chooseSize')}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {it.variants.map((x) => {
                              const inCart = qtyOf(x.id);
                              const sel = pick[it.id] === x.id;
                              return (
                                <button key={x.id} type="button" onClick={() => setPick({ ...pick, [it.id]: x.id })}
                                  className={`px-3 py-1.5 rounded-xl border-2 text-sm font-bold ${sel ? 'text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                                  style={sel ? { background: OLIVE, borderColor: OLIVE } : undefined}>
                                  {vLabel(x)}{inCart > 0 ? ` (x${inCart})` : ''}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="mt-3">
                        {!v ? (
                          <div className="text-sm text-slate-500 text-center py-2">{t('chooseFirst')}</div>
                        ) : q === 0 ? (
                          <button type="button" onClick={() => change(it, v, 1)} className="w-full py-3 rounded-xl text-white font-black text-base active:scale-95" style={{ background: OLIVE }}>{t('add')}</button>
                        ) : (
                          <div className="flex items-center justify-between rounded-xl bg-white border-2 px-2 py-1.5" style={{ borderColor: OLIVE }}>
                            <button type="button" className="w-11 h-11 rounded-xl bg-slate-100 text-2xl font-black" onClick={() => change(it, v, -1)} aria-label={t('less')}>−</button>
                            <div className="text-center"><div className="text-xl font-black">x{q}</div><div className="text-[11px] text-slate-500">{vLabel(v)}</div></div>
                            <button type="button" className="w-11 h-11 rounded-xl text-white text-2xl font-black" style={{ background: OLIVE }} onClick={() => change(it, v, 1)} aria-label={t('more')}>+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Step>

            <div ref={orderRef}>
              <Step n={3} title={t('s3')}>
                {cart.length === 0 && <div className="text-sm text-slate-500">{t('empty')}</div>}
                {cart.map((l) => (
                  <div key={l.variantId} className="flex items-center justify-between gap-2 text-sm border-b border-slate-100 pb-2">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{l.item.name}</div>
                      <div className="text-xs text-slate-500">{vLabel(l.variant)} · {money(l.item.price)} {t('each')}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
                      <button type="button" className="w-9 h-9 rounded-lg bg-slate-100 text-lg font-black" onClick={() => change(l.item, l.variant, -1)}>−</button>
                      <span className="w-6 text-center font-black">{l.qty}</span>
                      <button type="button" className="w-9 h-9 rounded-lg bg-slate-100 text-lg font-black" onClick={() => change(l.item, l.variant, 1)}>+</button>
                    </div>
                  </div>
                ))}
                {cart.length > 0 && (
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span>{t('total')}</span><b className="text-base">{money(total)}</b></div>
                    <div className="flex justify-between"><span>{t('toPay')}</span><b className="text-base" style={{ color: OLIVE }}>{money(required)}</b></div>
                  </div>
                )}

                <div>
                  <div className="font-bold text-sm mb-1.5">{t('howPay')}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {([['cash', t('cash'), '💵'], ['instapay', t('instapay'), '📱']] as const).map(([v, l, ic]) => (
                      <button key={v} type="button" onClick={() => setPay(v)}
                        className={`rounded-2xl border-2 py-3 font-black ${pay === v ? 'text-white' : 'bg-white border-slate-200'}`}
                        style={pay === v ? { background: OLIVE, borderColor: OLIVE } : undefined}>
                        <div className="text-xl">{ic}</div>{l}
                      </button>
                    ))}
                  </div>
                  {pay === 'instapay' && (
                    <div className="mt-2 rounded-2xl border p-3 text-sm space-y-1" style={{ background: '#FFF6D6', borderColor: GOLD }}>
                      <div className="font-bold">{t('instaTitle')}</div>
                      <div>{withWa(t('instaText', { a: money(required), w: '\u0000' }))}</div>
                    </div>
                  )}
                  {pay === 'cash' && (
                    <div className="mt-2 rounded-2xl border p-3 text-sm" style={{ background: '#FFF6D6', borderColor: GOLD }}>
                      {withWa(t('cashText', { w: '\u0000' }))}
                    </div>
                  )}
                </div>

                <Captcha quiet onToken={setToken} resetKey={capKey} />
                {err && <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold p-3">{err}</div>}
                <button type="button" disabled={busy} onClick={submit} className="w-full py-4 rounded-2xl text-white font-black text-lg disabled:opacity-50 active:scale-95" style={{ background: OLIVE }}>
                  {busy ? t('sending') : t('send')}
                </button>
                <div className="text-xs text-slate-500 text-center">{t('note')}</div>
              </Step>
            </div>
          </>
        )}
      </div>

      {items && open && count > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-lg p-3">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <div className="text-sm leading-tight"><b>{count}</b> {count > 1 ? t('itemsN') : t('items1')} · <b>{money(total)}</b></div>
            <button type="button" onClick={() => orderRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-5 py-2.5 rounded-xl text-white font-black" style={{ background: OLIVE }}>{t('review')} ↓</button>
          </div>
        </div>
      )}
    </div>
  );
};
