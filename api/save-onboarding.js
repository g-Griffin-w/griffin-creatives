// Vercel Serverless Function: POST /api/save-onboarding
//
// Saves the onboarding form for the client whose link carries ?cid=<griffin_clients.id>.
// The form used to write to griffin_clients straight from the browser with the
// public anon key, which meant anyone holding that key could read or edit every
// client row. This endpoint uses the service key and only accepts the fields
// the form collects, so those anon policies can be removed.
//
// Body: { cid, fields: { <column>: value, ... } }

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// column -> max length. Only these can be written from the form.
const FIELDS = {
  full_name: 120,
  email: 200,
  phone: 40,
  business_name: 160,
  website: 300,
  niche: 40,
  region: 60,
  season_window: 20,
  plan: 20,
  ad_goals: 1000,
  target_audience: 2000,
  product_world: 2000,
  brand_voice: 80,
  past_clients_csv: 300000,
  promos: 1000,
  product_image_urls: 20000,
  logo_url: 500,
  brand_colors: 200,
  gbp_link: 500,
  gbp_exists: 20,
  gbp_manager_added: 20,
  platforms: 500,
  booking_link: 500,
  notes: 3000,
  mailing_address: 300,
  email_provider: 40,
  open_dates: 1500,
  deposit_terms: 1500,
  last_season_detail: 1500,
};

const ENUMS = {
  niche: ['salmon_guide', 'elk_guide'],
  plan: ['get_found', 'full_season', 'booked_out'],
  gbp_exists: ['yes', 'no', 'not_sure', ''],
  gbp_manager_added: ['yes', 'no', 'not_sure', 'na', ''],
  email_provider: ['gmail', 'workspace', 'outlook', 'yahoo', 'other', 'not_sure', ''],
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  const { cid, fields } = body || {};
  if (typeof cid !== 'string' || !UUID_RE.test(cid)) return res.status(400).json({ error: 'Missing or invalid client link' });
  if (!fields || typeof fields !== 'object') return res.status(400).json({ error: 'Missing fields' });

  const update = {};
  for (const [col, max] of Object.entries(FIELDS)) {
    if (!(col in fields)) continue;
    const v = fields[col];
    if (v === null || v === undefined) { update[col] = null; continue; }
    if (typeof v !== 'string') return res.status(400).json({ error: `Invalid value for ${col}` });
    const s = v.trim();
    if (s.length > max) return res.status(400).json({ error: `${col} is too long` });
    if (ENUMS[col] && !ENUMS[col].includes(s)) return res.status(400).json({ error: `Invalid value for ${col}` });
    update[col] = s;
  }

  if (update.email !== undefined && !EMAIL_RE.test(update.email)) return res.status(400).json({ error: 'Please enter a valid email address' });

  // Uploaded files must live under this client's own folder.
  const paths = [];
  if (update.logo_url) paths.push(update.logo_url);
  if (update.product_image_urls) {
    try {
      const arr = JSON.parse(update.product_image_urls);
      if (!Array.isArray(arr)) throw new Error('not an array');
      paths.push(...arr);
    } catch { return res.status(400).json({ error: 'Invalid photo list' }); }
  }
  if (paths.some((p) => typeof p !== 'string' || !p.startsWith(cid + '/') || p.includes('..'))) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  const { data: existing } = await supabase.from('griffin_clients').select('id').eq('id', cid).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'This onboarding link is not recognized. Email hello@griffincreativelab.com for a new one.' });

  update.onboarding_complete = true;
  const { error } = await supabase.from('griffin_clients').update(update).eq('id', cid);
  if (error) {
    if (/griffin_clients_email_key|duplicate key/i.test(error.message)) {
      return res.status(409).json({ error: 'That email is already on another account. Use the email we have on file, or contact us.' });
    }
    console.error('save-onboarding error:', error.message);
    return res.status(500).json({ error: 'Could not save. Please try again or email hello@griffincreativelab.com.' });
  }
  return res.status(200).json({ ok: true });
};
