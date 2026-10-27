const { createClient } = require('@supabase/supabase-js');
const { clientByKey } = require('../lib/portal');

// ============================================================
// The client's "after the hunt" intake. The outfitter pastes the hunters who
// just left camp (name, email, hunt end date). Each one is queued for a
// review-request email, sent the day after the hunt ends by
// api/send-review-requests.js.
//
//   GET  /api/log-hunters?k=<portal_key>     status for the page
//   POST /api/log-hunters  {k, text}         add hunters, one per line:
//                                            "Name, email, YYYY-MM-DD"
//
// The page that calls this is review-requests.html?k=<portal_key>.
// ============================================================

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const MAX_PER_CALL = 100;
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseLines(text) {
  const rows = [];
  const rejected = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\t|,|;/).map((p) => p.trim()).filter(Boolean);
    const email = parts.find((p) => EMAIL_RE.test(p));
    if (!email) { rejected.push({ line, reason: 'no valid email' }); continue; }
    const date = parts.find((p) => DATE_RE.test(p));
    const name = parts.find((p) => p !== email && p !== date && !/^\d/.test(p)) || '';
    rows.push({ hunter_name: name.slice(0, 80), hunter_email: email.toLowerCase(), hunt_end_date: date || null });
  }
  return { rows, rejected };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const body = req.method === 'POST' ? (typeof req.body === 'string' ? safeJson(req.body) : req.body || {}) : {};
  const k = String((req.method === 'POST' ? body.k : req.query?.k) || '');
  if (!k) return res.status(400).json({ error: 'Missing key' });

  const client = await clientByKey(supabase, k, 'id, business_name, review_url, mailing_address');
  if (!client) return res.status(404).json({ error: 'Link not recognized' });

  if (req.method === 'GET') {
    const { data: rows } = await supabase
      .from('review_requests')
      .select('hunter_name, hunter_email, status, send_at, clicked_at')
      .eq('guide_client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(200);
    const count = (s) => (rows || []).filter((r) => r.status === s).length;
    const { data: mailbox } = await supabase.from('client_mailboxes').select('email').eq('guide_client_id', client.id).eq('status', 'connected').maybeSingle();
    return res.status(200).json({
      business: client.business_name,
      setup_complete: Boolean(client.review_url && client.mailing_address),
      mailbox: mailbox ? mailbox.email : null,
      totals: { queued: count('queued'), sent: count('sent') + count('reminded'), clicked: count('clicked') },
      recent: (rows || []).slice(0, 25).map((r) => ({ name: r.hunter_name, email: r.hunter_email, status: r.status })),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { rows, rejected } = parseLines(body.text);
  if (rows.length === 0) return res.status(400).json({ error: 'No valid hunters found', rejected });
  if (rows.length > MAX_PER_CALL) return res.status(400).json({ error: `Add up to ${MAX_PER_CALL} hunters at a time` });

  // Never re-queue someone who already got a request, or who opted out.
  const { data: existing } = await supabase
    .from('review_requests')
    .select('hunter_email')
    .eq('guide_client_id', client.id)
    .in('hunter_email', rows.map((r) => r.hunter_email));
  const seen = new Set((existing || []).map((r) => r.hunter_email));

  const now = Date.now();
  const toInsert = [];
  const seenNow = new Set();
  for (const r of rows) {
    if (seen.has(r.hunter_email) || seenNow.has(r.hunter_email)) continue;
    seenNow.add(r.hunter_email);
    // Send the day after the hunt ends; if that day has passed, send on the next run.
    const sendAt = r.hunt_end_date ? Math.max(now, new Date(r.hunt_end_date + 'T12:00:00Z').getTime() + DAY_MS) : now;
    toInsert.push({ ...r, guide_client_id: client.id, send_at: new Date(sendAt).toISOString() });
  }

  if (toInsert.length) {
    const { error } = await supabase.from('review_requests').insert(toInsert);
    if (error) return res.status(500).json({ error: 'Could not save' });
  }

  return res.status(200).json({ added: toInsert.length, already_on_list: rows.length - toInsert.length, rejected });
};

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
