// Supabase Edge Function: public-order
//
// The ONLY door of the public (no-login) order page. Two actions:
//   { action: "list" }    -> open items (name, price, image, sizes/colors). Never stock, cost or other orders.
//   { action: "submit" }  -> creates a "pending" order (nothing is counted until an admin marks it paid).
// There is deliberately NO way to look up or list orders from here.
//
// Deploy with "Verify JWT" OFF. Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided),
// TURNSTILE_SECRET_KEY (already set for auth-gate), ALLOWED_ORIGIN (https://sps-warehouse.vercel.app).

import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://sps-warehouse.vercel.app';
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ip = (req: Request) =>
  req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

async function logEvent(kind: string, identifier: string | null, ipAddr: string, detail: Record<string, unknown> = {}) {
  await admin.from('security_events').insert({ kind, identifier, ip: ipAddr, detail });
}

async function captchaOk(token: unknown, ipAddr: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return false; // public form is never open without a captcha
  if (typeof token !== 'string' || !token || token.length > 4096) return false;
  const form = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ipAddr });
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    return Boolean((await r.json()).success);
  } catch (_) {
    return false;
  }
}

async function since(col: 'ip' | 'phone' | null, val: string | null, minutes: number): Promise<number> {
  const t = new Date(Date.now() - minutes * 60_000).toISOString();
  let q = admin.from('public_order_attempts').select('id', { count: 'exact', head: true }).gte('created_at', t);
  if (col && val) q = q.eq(col, val);
  const { count } = await q;
  return count || 0;
}

const MSG: Record<string, string> = {
  closed: 'Orders are closed right now.',
  bad_name: 'Please type your full name.',
  bad_phone: 'Please type a valid phone number.',
  bad_ashira: 'Please choose Ashira 1 or Ashira 2.',
  bad_team: 'Please type your team name.',
  bad_items: 'Please choose at least one item.',
  bad_qty: 'Quantity must be between 1 and 10.',
  bad_item: 'One of the items is not available anymore. Please refresh the page.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const origin = req.headers.get('origin');
  if (origin && origin !== ALLOWED_ORIGIN) return json({ error: 'forbidden' }, 403);
  const addr = ip(req);
  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > 20_000) return json({ error: 'too_large' }, 413);
    body = JSON.parse(raw);
  } catch (_) {
    return json({ error: 'bad_request' }, 400);
  }

  if (body.action === 'list') {
    if ((await since('ip', addr, 1)) > 60) return json({ error: 'rate' }, 429);
    const { data: st } = await admin.from('sale_settings').select('orders_open').eq('id', 1).single();
    const { data: open } = await admin.from('public_sale_items').select('product_id, required_pct, sort').eq('is_open', true).order('sort');
    if (!open || open.length === 0) return json({ open: Boolean(st?.orders_open), items: [] });
    const ids = open.map((o) => o.product_id);
    const { data: prods } = await admin.from('products').select('id, name, price, image_url, description').in('id', ids).eq('status', 'active');
    const { data: vars } = await admin.from('product_variants').select('id, product_id, size, color_name, color_hex').in('product_id', ids);
    const items = open
      .map((o) => {
        const p = (prods || []).find((x) => x.id === o.product_id);
        if (!p || !p.price || Number(p.price) <= 0) return null;
        return {
          id: p.id,
          name: p.name,
          price: Number(p.price),
          image: p.image_url || null,
          description: p.description || null,
          required_pct: o.required_pct,
          variants: (vars || []).filter((v) => v.product_id === p.id).map((v) => ({ id: v.id, size: v.size, color: v.color_name, hex: v.color_hex })),
        };
      })
      .filter(Boolean);
    return json({ open: Boolean(st?.orders_open), items });
  }

  if (body.action === 'submit') {
    // Honeypot: real people never fill this hidden field. Pretend success, store nothing.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      await logEvent('public_order_honeypot', null, addr);
      return json({ ok: true, order_number: 'SPS-00000000', total: 0, required: 0 });
    }
    const phoneKey = String(body.phone || '').replace(/\D/g, '').slice(-10);
    const { data: st } = await admin.from('sale_settings').select('*').eq('id', 1).single();
    if (!st?.orders_open) return json({ error: 'closed', message: MSG.closed }, 400);

    const [nIp, nPhone, nDay] = await Promise.all([
      since('ip', addr, 60),
      phoneKey ? since('phone', phoneKey, 60) : Promise.resolve(0),
      since(null, null, 24 * 60),
    ]);
    if (nIp >= st.max_per_ip_hour || (phoneKey && nPhone >= st.max_per_phone_hour) || nDay >= st.max_per_day) {
      await logEvent('public_order_rate_limited', phoneKey || null, addr, { nIp, nPhone, nDay });
      return json({ error: 'rate', message: 'Too many orders. Please try again later.' }, 429);
    }
    if (!(await captchaOk(body.captchaToken, addr))) {
      await logEvent('public_order_captcha_failed', phoneKey || null, addr);
      return json({ error: 'captcha', message: 'Please complete the "I am human" check again.' }, 400);
    }
    // Count the attempt now (even if it fails below) so bad payloads cannot be retried endlessly.
    await admin.from('public_order_attempts').insert({ ip: addr, phone: phoneKey || null });

    const items = Array.isArray(body.items)
      ? body.items.slice(0, 15).map((i: any) => ({ variant_id: String(i?.variant_id ?? ''), quantity: Number(i?.quantity) }))
      : [];
    const { data, error } = await admin.rpc('public_order_create', {
      p: { name: String(body.name ?? ''), phone: String(body.phone ?? ''), ashira: String(body.ashira ?? ''), team: String(body.team ?? ''), items },
    });
    if (error) {
      const code = Object.keys(MSG).find((k) => (error.message || '').includes(k));
      if (!code) await logEvent('public_order_error', phoneKey || null, addr, { message: String(error.message).slice(0, 200) });
      return json({ error: code || 'failed', message: code ? MSG[code] : 'Something went wrong. Please try again.' }, 400);
    }
    return json({ ok: true, order_number: data.order_number, total: data.total, required: data.required });
  }
  return json({ error: 'bad_request' }, 400);
});
