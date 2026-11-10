import express from 'express';
import path from 'path';
import fs from 'fs';
import * as webpush from 'web-push';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

// VAPID Credentials for Web Push Protocol
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BJMQAYWtCOp3egNjp-tbFtWvthIBCtRuDDH64erBwhqxkOecZMvkwt9ybmI2I9MXn2rnTq6ivNDd4w_bjB4338Q';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'tVKxIFHtxsxqEQpNklGXR0qluII-xzICl32jYW2E7K4';
const VAPID_SUBJECT = 'mailto:spsstore35@gmail.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Supabase Configuration for Server-Side 24/7 Background Listening
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tvlfxyfbyhotqgigurec.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2bGZ4eWZieWhvdHFnaWd1cmVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NTg3MjAsImV4cCI6MjEwODUzNDcyMH0.st0wVPcahaEhl1pA0MslvyduQZSo9Bu_rMWboG1LGJo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Persistence for Web Push Subscriptions
const SUBS_FILE = path.resolve(process.cwd(), 'push-subscriptions.json');

interface StoredSubscription {
  subscription: webpush.PushSubscription;
  userEmail?: string;
  createdAt: string;
}

let subscriptions: StoredSubscription[] = [];

try {
  if (fs.existsSync(SUBS_FILE)) {
    const raw = fs.readFileSync(SUBS_FILE, 'utf-8');
    subscriptions = JSON.parse(raw);
  }
} catch (err) {
  console.warn('Could not read existing push subscriptions:', err);
  subscriptions = [];
}

const saveSubscriptions = () => {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save push subscriptions:', err);
  }
};

// Helper: Broadcast Web Push to all registered devices (Android, Desktop, iOS)
async function broadcastPushNotification(payload: {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}) {
  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag || `sps-alert-${Date.now()}`,
    icon: payload.icon || '/sps-logo.png',
    badge: payload.badge || '/sps-logo.png',
    data: payload.data || { url: '/' },
  });

  const deadEndpoints: string[] = [];

  const promises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(sub.subscription, jsonPayload);
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription has expired or user revoked it
        deadEndpoints.push(sub.subscription.endpoint);
      } else {
        console.warn('Failed to push to device:', err.message || err);
      }
    }
  });

  await Promise.allSettled(promises);

  if (deadEndpoints.length > 0) {
    subscriptions = subscriptions.filter((s) => !deadEndpoints.includes(s.subscription.endpoint));
    saveSubscriptions();
  }
}

// Format readable reason for background notifications
function formatReason(row: any): string {
  const combined = `${row.summary || ''} ${row.details || ''} ${row.reason || ''}`.toLowerCase();
  const bookingNum = row.booking_number || (combined.match(/sps-\d+/i) ? combined.match(/sps-\d+/i)![0].toUpperCase() : undefined);

  if (combined.includes('staff requested changing') || combined.includes('staff request: change deposit') || (combined.includes('staff') && combined.includes('deposit'))) {
    const match = combined.match(/to (\d+)%/i) || combined.match(/(\d+)%/);
    const pct = match ? match[1] : undefined;
    return pct ? `Staff Request ${pct}% Deposit` : 'Staff Deposit Request';
  }

  if (combined.includes('updated required deposit') || combined.includes('deposit terms updated') || combined.includes('approved staff deposit')) {
    const match = combined.match(/to (\d+)%/i) || combined.match(/(\d+)%/);
    const pct = match ? match[1] : undefined;
    return pct ? `Deposit Terms Updated (${pct}%)` : 'Deposit Terms Updated';
  }

  if (combined.includes('new account') || combined.includes('registration') || row.action === 'account_updated') {
    return 'New Account Registration';
  }

  if (row.action === 'booking_created' || combined.includes('booking created') || combined.includes('making order')) {
    return bookingNum ? `Making Order #${bookingNum}` : 'Making Order';
  }

  if (row.action === 'stock_adjusted' || row.action === 'request_approved') {
    if (row.reason && row.reason.trim() !== '' && !row.reason.toLowerCase().includes('direct physical adjustment')) {
      return row.reason.trim();
    }
    return `Stock Adjustment: ${row.product_name || 'Inventory'}`;
  }

  return row.reason && row.reason !== 'Direct Physical Adjustment' ? row.reason : (row.summary || 'Warehouse Update');
}

// 24/7 Background Polling & Real-Time Listener on Server Container
let seenLogIds = new Set<string>();
let isInitialized = false;

async function setupServerBackgroundSync() {
  try {
    // 1. Initial load of existing logs so we don't spam notifications on server start
    const { data: initialLogs } = await supabase
      .from('stock_audit_logs')
      .select('id')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (initialLogs) {
      initialLogs.forEach((l) => seenLogIds.add(l.id));
    }
    isInitialized = true;

    // 2. Real-Time Postgres Channel
    supabase
      .channel('server-db-monitor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_audit_logs' }, (payload) => {
        const newLog = payload.new;
        if (newLog && !seenLogIds.has(newLog.id)) {
          seenLogIds.add(newLog.id);
          const title = formatReason(newLog);
          const body = newLog.summary || newLog.details || 'New warehouse inventory activity recorded.';
          broadcastPushNotification({
            title,
            body,
            tag: `audit-${newLog.id}`,
            data: { view: 'audit-log', bookingId: newLog.booking_number },
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
        const profile = payload.new;
        if (profile && profile.status === 'pending') {
          broadcastPushNotification({
            title: 'New Account Registration',
            body: `"${profile.full_name || 'New Staff'}" (${profile.email}) registered and requires admin approval.`,
            tag: `profile-${profile.id}`,
            data: { view: 'account-approvals' },
          });
        }
      })
      .subscribe();

    // 3. Periodic Safety Check (every 5 seconds) to catch any DB activity if WebSocket drops
    setInterval(async () => {
      if (!isInitialized) return;
      try {
        const { data: recentLogs } = await supabase
          .from('stock_audit_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(15);

        if (recentLogs) {
          for (const log of recentLogs) {
            if (!seenLogIds.has(log.id)) {
              seenLogIds.add(log.id);
              const title = formatReason(log);
              const body = log.summary || log.details || 'New warehouse inventory activity recorded.';
              await broadcastPushNotification({
                title,
                body,
                tag: `audit-${log.id}`,
                data: { view: 'audit-log', bookingId: log.booking_number },
              });
            }
          }
        }
      } catch (err) {
        // Silent catch for intermittent network hiccup
      }
    }, 5000);
  } catch (err) {
    console.error('Error initializing server background sync:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API 1: Public VAPID Key
  app.get('/api/push/public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  // API 2: Register device Push Subscription
  app.post('/api/push/subscribe', (req, res) => {
    const { subscription, userEmail } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const exists = subscriptions.some((s) => s.subscription.endpoint === subscription.endpoint);
    if (!exists) {
      subscriptions.push({
        subscription,
        userEmail,
        createdAt: new Date().toISOString(),
      });
      saveSubscriptions();
    }

    res.json({ success: true, count: subscriptions.length });
  });

  // API 3: Send Test Web Push to verify background notifications
  app.post('/api/push/test', async (req, res) => {
    const { title, body } = req.body;
    await broadcastPushNotification({
      title: title || 'Staff Request 70% Deposit',
      body: body || 'Order #SPS-09112601: Staff requested changing upfront deposit from 50% to 70%.',
      tag: 'test-push-' + Date.now(),
      data: { view: 'audit-log' },
    });
    res.json({ success: true, message: `Pushed to ${subscriptions.length} registered device(s)` });
  });

  // API 4: Trigger Web Push from application actions
  app.post('/api/push/send', async (req, res) => {
    const { title, body, tag, data } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    await broadcastPushNotification({
      title,
      body: body || '',
      tag: tag || `push-${Date.now()}`,
      data: data || { url: '/' },
    });

    res.json({ success: true });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      subscriptionsCount: subscriptions.length,
    });
  });

  // Mount Vite development middlewares or production static files
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SPS Warehouse Full-Stack Server running at http://0.0.0.0:${PORT}`);
    setupServerBackgroundSync();
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
