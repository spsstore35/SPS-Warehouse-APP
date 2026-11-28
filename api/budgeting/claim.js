// The passcode is set by the owner in the server settings (BUDGETING_PASSCODE), never from the app.
export default function handler(req, res) {
  res.status(409).json({ error: 'Budgeting passcode is managed in the server settings.' });
}
