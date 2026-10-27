// Shared by the onboarding scripts: look a client up, and turn the raw
// griffin_clients row (what the onboarding form saved) into clean facts.

const { createClient } = require('@supabase/supabase-js');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATE_NAMES = {
  OR: 'Oregon', ID: 'Idaho', WA: 'Washington', MT: 'Montana',
  CA: 'California', WY: 'Wyoming', CO: 'Colorado', UT: 'Utah',
};

function die(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

function connect() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) die('missing SUPABASE_URL / SUPABASE_SERVICE_KEY (run with: node --env-file=.env.local ...)');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ref is the griffin_clients id or part of the business name; must match exactly one.
async function findClient(sb, ref) {
  if (!ref) die('which client? pass the id or part of the business name');
  let q = sb.from('griffin_clients').select('*');
  q = UUID_RE.test(ref) ? q.eq('id', ref) : q.ilike('business_name', `%${ref}%`);
  const { data, error } = await q;
  if (error) die(error.message);
  if (!data || data.length === 0) die(`no client matches "${ref}"`);
  if (data.length > 1) die(`"${ref}" matches ${data.length} clients: ${data.map((c) => `${c.business_name} (${c.id})`).join('; ')}`);
  return data[0];
}

function slugify(s) {
  return String(s || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'client';
}

function clean(s) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t || '';
}

function factsFrom(c) {
  const states = clean(c.region).split(',').map((s) => s.trim()).filter(Boolean);
  const owner = clean(c.full_name);
  return {
    id: c.id,
    slug: slugify(c.business_name),
    business: clean(c.business_name),
    owner,
    ownerFirst: owner.split(' ')[0] || '',
    email: clean(c.email),
    phone: clean(c.phone),
    website: clean(c.website),
    niche: c.niche,
    states,
    stateNames: states.map((s) => STATE_NAMES[s] || s),
    season: clean(c.season_window),
    trip: clean(c.ad_goals),
    audience: clean(c.target_audience),
    scenes: clean(c.product_world),
    voice: clean(c.brand_voice),
    openDates: clean(c.open_dates),
    depositTerms: clean(c.deposit_terms),
    lastSeason: clean(c.last_season_detail),
    promos: clean(c.promos),
    bookingLink: clean(c.booking_link),
    social: clean(c.platforms),
    mailingAddress: clean(c.mailing_address),
    gbpLink: clean(c.gbp_link),
    notes: clean(c.notes),
  };
}

module.exports = { connect, findClient, factsFrom, slugify, die, STATE_NAMES };
