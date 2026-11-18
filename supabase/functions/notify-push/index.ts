// Supabase Edge Function: notify-push
//
// Sends Web Push alerts to every registered device (phones and computers),
// even when the SPS Warehouse app is closed.
//
// Called by database triggers (see supabase/migrations/*_push_and_photos.sql) when:
//   - a new activity entry is written to stock_audit_logs
//   - a staff member submits a stock adjustment request
//   - a new account registers and is waiting for approval
//
// Secrets (set with `supabase secrets set`, never committed):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_WEBHOOK_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET')!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type Alert = { title: string; body: string; tag: string; data: Record<string, unknown>; actorName?: string };

// Same wording rules the app uses for activity titles.
function formatReason(row: any): string {
  const combined = `${row.summary || ''} ${row.details || ''} ${row.reason || ''}`.toLowerCase();
  const m = combined.match(/sps-[a-z0-9-]+/i);
  const bookingNum = row.booking_number || (m ? m[0].toUpperCase() : undefined);

  if (row.reason && row.reason.trim() !== '' && !row.reason.toLowerCase().includes('direct physical adjustment')) {
    return row.reason.trim();
  }
  if (combined.includes('staff requested changing') || (combined.includes('staff') && combined.includes('deposit'))) {
    const pct = (combined.match(/to (\d+)%/i) || combined.match(/(\d+)%/))?.[1];
    return pct ? `Staff Request ${pct}% Deposit` : 'Staff Deposit Request';
  }
  if (combined.includes('updated required deposit') || combined.includes('deposit terms updated')) {
    const pct = (combined.match(/to (\d+)%/i) || combined.match(/(\d+)%/))?.[1];
    return pct ? `Deposit Terms Updated (${pct}%)` : 'Deposit Terms Updated';
  }
  if (row.action === 'booking_created' || combined.includes('making order')) {
    return bookingNum ? `Making Order #${bookingNum}` : 'Making Order';
  }
  if (row.action === 'stock_adjusted' || row.action === 'request_approved') {
    return `Stock Adjustment: "${row.product_name || 'Inventory'}"`;
  }
  return row.summary || 'Warehouse Update';
}

function buildAlert(table: string, record: any): Alert | null {
  if (!record) return null;
  if (table === 'stock_audit_logs') {
    return {
      title: formatReason(record),
      body: record.summary || record.details || 'New warehouse activity recorded.',
      // Same tag the app uses, so an open app never shows the same alert twice.
      tag: `sps-audit-log-${record.id}`,
      data: { view: 'audit-log', logId: record.id, bookingId: record.booking_number || record.booking_id },
      actorName: record.actor_name,
    };
  }
  if (table === 'adjustment_requests' && record.status === 'pending') {
    return {
      title: 'Stock Adjustment Request',
      body: `${record.worker_name || 'A staff member'} requested ${record.product_name || 'a product'} (${record.size || ''} / ${record.color_name || ''}): ${record.current_quantity} → ${record.requested_quantity}.`,
      tag: `sps-stock-req-${record.id}`,
      data: { view: 'stock-approvals' },
      actorName: record.worker_name,
    };
  }
  if (table === 'profiles' && record.status === 'pending') {
    return {
      title: 'New Account Registration',
      body: `"${record.full_name || 'New staff member'}" (${record.email || ''}) registered and needs administrator approval.`,
      tag: `sps-staff-req-${record.id}`,
      data: { view: 'account-approvals' },
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  // { test: true } sends a test alert to every device (used once after setup).
  const alert: Alert | null = payload.test
    ? { title: 'SPS Warehouse', body: 'Background notifications are working.', tag: `sps-test-${Date.now()}`, data: { view: 'audit-log' } }
    : buildAlert(payload.table, payload.record);
  if (!alert) return Response.json({ sent: 0, skipped: 'not a notifiable change' });

  const { data: subs, error } = await supabase.from('push_subscriptions').select('endpoint, subscription, user_email');
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Don't alert people about their own actions.
  let actorEmails = new Set<string>();
  if (alert.actorName) {
    const { data: actors } = await supabase.from('profiles').select('email').eq('full_name', alert.actorName);
    actorEmails = new Set((actors || []).map((a: any) => String(a.email || '').toLowerCase()));
  }

  const body = JSON.stringify({
    title: alert.title,
    body: alert.body,
    tag: alert.tag,
    icon: '/sps-logo.png',
    badge: '/sps-logo.png',
    data: alert.data,
  });

  const dead: string[] = [];
  let sent = 0;
  await Promise.allSettled(
    (subs || [])
      .filter((s: any) => !s.user_email || !actorEmails.has(String(s.user_email).toLowerCase()))
      .map(async (s: any) => {
        try {
          await webpush.sendNotification(s.subscription, body, { TTL: 60 * 60 * 24 });
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.endpoint);
          else console.warn('Push failed:', err?.statusCode, err?.body || err?.message);
        }
      })
  );

  // Remove devices that uninstalled the app or turned notifications off.
  if (dead.length > 0) await supabase.from('push_subscriptions').delete().in('endpoint', dead);

  return Response.json({ sent, removed: dead.length });
});
