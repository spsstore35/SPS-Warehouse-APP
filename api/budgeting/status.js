// Vercel serverless function: tells the app how the Budgeting passcode is set up.
// The passcode itself lives only in the BUDGETING_PASSCODE environment variable (server side).
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const configured = Boolean((process.env.BUDGETING_PASSCODE || '').trim());
  res.status(200).json({ mode: configured ? 'env' : 'unclaimed' });
}
