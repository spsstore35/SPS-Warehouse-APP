import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import fs from 'fs';
import * as webpush from 'web-push';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

// VAPID Credentials for Web Push Protocol (read strictly from environment)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY?.trim() || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim() || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT?.trim() || 'mailto:spsstore35@gmail.com';
const VAPID_CONFIG_ERROR =
  'Missing required VAPID environment variables: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set.';
const isVapidConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (isVapidConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.error(`[Web Push Disabled] ${VAPID_CONFIG_ERROR}`);
}

// Server-side Budgeting Passcode (env overrides any claimed first-run hash)
const ENV_BUDGETING_PASSCODE = process.env.BUDGETING_PASSCODE?.trim() || '';
let claimedBudgetingHash: string | null = null;

function hashPasscodeScrypt(passcode: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(passcode, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPasscodeScrypt(passcode: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    const [salt, expectedHex] = storedHash.split(':');
    if (!salt || !expectedHex) return resolve(false);
    crypto.scrypt(passcode, salt, 64, (err, derivedKey) => {
      if (err) return resolve(false);
      const expectedBuf = Buffer.from(expectedHex, 'hex');
      if (expectedBuf.length !== derivedKey.length) return resolve(false);
      resolve(crypto.timingSafeEqual(expectedBuf, derivedKey));
    });
  });
}

function verifyEnvPasscode(submitted: string, configured: string): boolean {
  const a = crypto.createHash('sha256').update(submitted).digest();
  const b = crypto.createHash('sha256').update(configured).digest();
  return crypto.timingSafeEqual(a, b);
}

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
  if (!isVapidConfigured) {
    throw new Error(VAPID_CONFIG_ERROR);
  }
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
    return `Stock Adjustment: "${row.product_name || 'Inventory'}"`;
  }

  return row.reason && row.reason !== 'Direct Physical Adjustment' ? row.reason : (row.summary || 'Warehouse Update');
}

// 24/7 Background Polling & Real-Time Listener on Server Container
let seenLogIds = new Set<string>();
let isInitialized = false;

async function setupServerBackgroundSync() {
  if (!isVapidConfigured) return;
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

    // Background Safety Polling Check (every 5 seconds) - Pure HTTP polling, NO WebSocket connections
    setInterval(async () => {
      if (!isInitialized) return;
      try {
        // 1. Check for new audit logs
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

        // 2. Check for pending registration profiles
        const { data: pendingProfiles } = await supabase
          .from('profiles')
          .select('*')
          .eq('status', 'pending')
          .limit(5);

        if (pendingProfiles) {
          for (const profile of pendingProfiles) {
            const profileKey = `profile-${profile.id}`;
            if (!seenLogIds.has(profileKey)) {
              seenLogIds.add(profileKey);
              await broadcastPushNotification({
                title: 'New Account Registration',
                body: `"${profile.full_name || 'New Staff'}" (${profile.email}) registered and requires admin approval.`,
                tag: profileKey,
                data: { view: 'account-approvals' },
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
    if (!isVapidConfigured) {
      return res.status(503).json({ error: VAPID_CONFIG_ERROR });
    }
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  // API 2: Register device Push Subscription
  app.post('/api/push/subscribe', (req, res) => {
    if (!isVapidConfigured) {
      return res.status(503).json({ error: VAPID_CONFIG_ERROR });
    }
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


  // Only a signed-in full_admin / admin (team_admin) may trigger pushes from this server.
  const requireStaffAdmin: express.RequestHandler = async (req, res, next) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'Sign in required' });
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: u, error } = await userClient.auth.getUser(token);
      if (error || !u?.user) return res.status(401).json({ error: 'Invalid session' });
      const { data: role } = await userClient.rpc('app_role');
      if (role !== 'full_admin' && role !== 'admin') return res.status(403).json({ error: 'Not allowed' });
      next();
    } catch {
      res.status(401).json({ error: 'Invalid session' });
    }
  };

  // API 3: Send Test Web Push to verify background notifications
  app.post('/api/push/test', requireStaffAdmin, async (req, res) => {
    if (!isVapidConfigured) {
      return res.status(503).json({ error: VAPID_CONFIG_ERROR });
    }
    const { title, body } = req.body;
    await broadcastPushNotification({
      title: title || 'SPS Warehouse',
      body: body || 'This is an Alert Message confirming app notifications are working fine.',
      tag: 'test-push-' + Date.now(),
      data: { view: 'audit-log' },
    });
    res.json({ success: true, message: `Pushed to ${subscriptions.length} registered device(s)` });
  });

  // API 4: Trigger Web Push from application actions
  app.post('/api/push/send', requireStaffAdmin, async (req, res) => {
    if (!isVapidConfigured) {
      return res.status(503).json({ error: VAPID_CONFIG_ERROR });
    }
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

  // Budgeting passcode status, first-run claim, and server-side verification
  app.get('/api/budgeting/status', (_req, res) => {
    const mode = ENV_BUDGETING_PASSCODE
      ? 'env'
      : claimedBudgetingHash
      ? 'claimed'
      : 'unclaimed';
    res.json({ mode });
  });

  app.post('/api/budgeting/claim', async (req, res) => {
    if (ENV_BUDGETING_PASSCODE || claimedBudgetingHash) {
      return res.status(409).json({ error: 'Budgeting passcode is already configured.' });
    }
    const raw = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (raw.length < 4) {
      return res.status(400).json({ error: 'Passcode must be at least 4 characters.' });
    }
    try {
      claimedBudgetingHash = await hashPasscodeScrypt(raw);
      return res.json({ unlocked: true });
    } catch {
      return res.status(500).json({ error: 'Failed to store budgeting passcode.' });
    }
  });

  app.post('/api/budgeting/verify', async (req, res) => {
    const raw = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!raw) {
      return res.status(400).json({ error: 'Please enter the budgeting passcode.' });
    }
    if (ENV_BUDGETING_PASSCODE) {
      if (!verifyEnvPasscode(raw, ENV_BUDGETING_PASSCODE)) {
        return res.status(401).json({ error: 'Incorrect budgeting passcode. Please try again.' });
      }
      return res.json({ unlocked: true });
    }
    if (!claimedBudgetingHash) {
      return res.status(409).json({ error: 'Budgeting passcode has not been set up yet.' });
    }
    const isMatch = await verifyPasscodeScrypt(raw, claimedBudgetingHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect budgeting passcode. Please try again.' });
    }
    return res.json({ unlocked: true });
  });

  // Mount Vite development middlewares or production static files
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    // Serve a zero-WebSocket /@vite/client shim so HMR is completely silent
    // and never triggers "WebSocket closed without opened" rejections on Cloud Run.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript');
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
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
