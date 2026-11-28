// Vercel serverless function: checks the Budgeting passcode on the server.
import crypto from 'node:crypto';

const sha = (s) => crypto.createHash('sha256').update(s).digest();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const configured = (process.env.BUDGETING_PASSCODE || '').trim();
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
  const raw = typeof body.passcode === 'string' ? body.passcode.trim() : '';
  if (!raw) return res.status(400).json({ error: 'Please enter the budgeting passcode.' });
  if (!configured) return res.status(409).json({ error: 'Budgeting passcode has not been set up yet.' });
  if (!crypto.timingSafeEqual(sha(raw), sha(configured))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return res.status(401).json({ error: 'Incorrect budgeting passcode. Please try again.' });
  }
  return res.status(200).json({ unlocked: true });
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
