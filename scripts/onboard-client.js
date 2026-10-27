#!/usr/bin/env node
// scripts/onboard-client.js
//
// One entry point for the manual steps of onboarding a guide client.
//
//   new      create the client row + portal key, print the onboarding link
//   status   what's done and what's missing, plus the client's links
//   import   move the past-client list they pasted into the form into
//            guide_client_contacts (cleans, dedupes, reports skipped rows)
//   set      store the Google review link / mailing address
//
// Usage (run from the repo root):
//   node --env-file=.env.local scripts/onboard-client.js new --business="Battle Creek Outfitters" --email=tom@example.com [--name="Tom Early"] [--phone=...] [--niche=elk_guide] [--plan=booked_out]
//   node --env-file=.env.local scripts/onboard-client.js status "battle creek"
//   node --env-file=.env.local scripts/onboard-client.js import "battle creek" [--dry]
//   node --env-file=.env.local scripts/onboard-client.js set "battle creek" --review-url=https://... [--mailing-address="..."]
//
// <client> is the griffin_clients id or part of the business name.

const { connect, findClient, die } = require('../lib/client-facts');

const SITE = 'https://www.griffincreativelab.com';
const NICHES = ['elk_guide', 'salmon_guide'];
const PLANS = ['get_found', 'full_season', 'booked_out'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function flags(args) {
  const out = {};
  for (const a of args) {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

async function portalKey(sb, clientId) {
  const { data } = await sb.from('client_portal_keys').select('portal_key').eq('guide_client_id', clientId).maybeSingle();
  if (data) return data.portal_key;
  const { data: created, error } = await sb.from('client_portal_keys').insert({ guide_client_id: clientId }).select('portal_key').single();
  if (error) die(error.message);
  return created.portal_key;
}

// ---- past-client list parsing ------------------------------------------
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const DATE_US = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;

function normDate(s) {
  if (DATE_ISO.test(s)) return s;
  const m = s.match(DATE_US);
  if (!m) return null;
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

// Accepts comma, tab or semicolon separated lines, with or without a header
// row, in any column order. Finds the email, date and phone by their shape.
function parseHunters(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  const skipped = [];
  lines.forEach((line, i) => {
    const cells = line.split(/\t|;|,/).map((c) => c.trim().replace(/^"|"$/g, '')).filter(Boolean);
    const email = cells.find((c) => EMAIL_RE.test(c));
    if (!email) {
      // a header row has no email on it; anything else is a bad line
      if (!(i === 0 && /email/i.test(line))) skipped.push({ line: i + 1, text: line.slice(0, 60), reason: 'no valid email' });
      return;
    }
    const date = cells.map(normDate).find(Boolean) || null;
    const phone = cells.find((c) => c !== email && !normDate(c) && /^[+()\d\s.-]{7,}$/.test(c)) || null;
    const name = cells.find((c) => c !== email && c !== phone && !normDate(c)) || '';
    if (!name) { skipped.push({ line: i + 1, text: line.slice(0, 60), reason: 'no name' }); return; }
    rows.push({ name, email: email.toLowerCase(), phone, last_trip_date: date });
  });
  return { rows, skipped };
}

// ---- commands -----------------------------------------------------------
async function cmdNew(sb, f) {
  if (!f.business || !f.email) die('usage: new --business="..." --email=... [--name] [--phone] [--niche=elk_guide] [--plan=booked_out]');
  if (!EMAIL_RE.test(f.email)) die('--email is not a valid email');
  const niche = f.niche || 'elk_guide';
  const plan = f.plan || 'booked_out';
  if (!NICHES.includes(niche)) die(`--niche must be one of: ${NICHES.join(', ')}`);
  if (!PLANS.includes(plan)) die(`--plan must be one of: ${PLANS.join(', ')}`);
  const { data, error } = await sb
    .from('griffin_clients')
    .insert({ business_name: f.business, email: f.email.toLowerCase(), full_name: f.name || null, phone: f.phone || null, niche, plan })
    .select('id')
    .single();
  if (error) die(/duplicate key/i.test(error.message) ? `a client with email ${f.email} already exists` : error.message);
  await portalKey(sb, data.id);
  console.log(`Created ${f.business} (${data.id}).\n`);
  console.log('Send them this onboarding link:');
  console.log(`  ${SITE}/onboarding.html?cid=${data.id}\n`);
  console.log(`Then check progress with:  node --env-file=.env.local scripts/onboard-client.js status "${f.business}"`);
}

async function cmdStatus(sb, ref) {
  const c = await findClient(sb, ref);
  const key = await portalKey(sb, c.id);
  const count = async (table, extra) => {
    let q = sb.from(table).select('*', { count: 'exact', head: true }).eq('guide_client_id', c.id);
    if (extra) q = extra(q);
    const { count: n } = await q;
    return n || 0;
  };
  const { data: mailbox } = await sb.from('client_mailboxes').select('email, status').eq('guide_client_id', c.id).maybeSingle();
  const contacts = await count('guide_client_contacts');
  const approved = await count('guide_retention_sequences', (q) => q.eq('approved', true));
  let photos = 0;
  try { photos = JSON.parse(c.product_image_urls || '[]').length; } catch { /* leave 0 */ }
  const pending = parseHunters(c.past_clients_csv).rows.length;

  const mark = (ok) => (ok ? '[x]' : '[ ]');
  const lines = [];
  const todo = [];
  const row = (ok, label, note, fix) => {
    lines.push(`${mark(ok)} ${label}${note ? '  ' + note : ''}`);
    if (!ok && fix) todo.push(fix);
  };

  console.log(`${c.business_name}  (${c.id})  ${c.niche || '?'} / ${c.plan || '?'}\n`);
  row(c.onboarding_complete, 'Onboarding form submitted', '', 'Send them the onboarding link.');
  row(photos >= 3, 'Photos uploaded', `${photos} (want 12)`, 'Ask for at least 12 real hunt photos.');
  row(c.gbp_manager_added === 'yes', 'Google profile: we are a Manager', `exists=${c.gbp_exists || '?'} manager=${c.gbp_manager_added || '?'}`, 'Do manager access / verification on the kickoff call (screen share).');
  row(Boolean(c.review_url), 'Google review link saved', c.review_url || '', 'Copy it from Business Profile > Ask for reviews, then run: set --review-url=...');
  row(Boolean(c.mailing_address), 'Mailing address saved', c.mailing_address || '', 'Ask for it, then run: set --mailing-address="..."');
  const canConnect = ['gmail', 'workspace'].includes(c.email_provider);
  row(mailbox && mailbox.status === 'connected', 'Mailbox connected', mailbox ? `${mailbox.email} (${mailbox.status})` : `provider=${c.email_provider || '?'}${canConnect ? '' : ' (sends from hello@ instead)'}`, canConnect ? 'Send the connect-mailbox link below.' : null);
  row(contacts > 0, 'Past-client list imported', `${contacts} in sending list, ${pending} rows pasted in form`, pending ? 'Run: import' : 'Ask for their past-client list.');
  row(approved > 0, 'Rebooking sequence approved', `${approved} approved`, `Run: node --env-file=.env.local scripts/draft-retention-sequence.js --client="${c.business_name}", fill any [brackets], then approve-retention-sequence.js.`);
  console.log(lines.join('\n'));

  const facts = [['open_dates', 'open dates'], ['deposit_terms', 'deposit terms'], ['last_season_detail', 'last-season moment'], ['booking_link', 'booking link']];
  const missing = facts.filter(([k]) => !c[k]).map(([, l]) => l);
  console.log(`\nFacts for the packets: ${missing.length ? 'missing ' + missing.join(', ') : 'all present'}`);

  console.log('\nLinks for the client:');
  console.log(`  Onboarding form : ${SITE}/onboarding.html?cid=${c.id}`);
  console.log(`  Connect mailbox : ${SITE}/api/connect-mailbox?k=${key}`);
  console.log(`  Hunter intake   : ${SITE}/review-requests.html?k=${key}`);
  if (todo.length) {
    console.log('\nNext:');
    todo.slice(0, 4).forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  } else {
    console.log('\nNothing left on the checklist.');
  }
}

async function cmdImport(sb, ref, f) {
  const c = await findClient(sb, ref);
  if (!c.niche) die('this client has no niche yet. Has the onboarding form been submitted?');
  if (!c.past_clients_csv) die('no past-client list on this client. Nothing to import.');
  const { rows, skipped } = parseHunters(c.past_clients_csv);
  const { data: existing } = await sb.from('guide_client_contacts').select('email').eq('guide_client_id', c.id);
  const have = new Set((existing || []).map((r) => String(r.email).toLowerCase()));
  const seen = new Set();
  const fresh = [];
  let dupes = 0;
  for (const r of rows) {
    if (have.has(r.email) || seen.has(r.email)) { dupes++; continue; }
    seen.add(r.email);
    fresh.push({ guide_client_id: c.id, niche: c.niche, contact_name: r.name, email: r.email, phone: r.phone, last_trip_date: r.last_trip_date, status: 'queued' });
  }
  console.log(`${rows.length} usable row(s): ${fresh.length} new, ${dupes} already on the list.`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length}:`);
    skipped.forEach((s) => console.log(`  line ${s.line}: ${s.reason}  "${s.text}"`));
  }
  if (f.dry) return console.log('\nDry run. Nothing was written.');
  if (fresh.length === 0) return console.log('Nothing to add.');
  const { error } = await sb.from('guide_client_contacts').insert(fresh);
  if (error) die(error.message);
  console.log(`\nAdded ${fresh.length} contact(s). They are queued; the daily send only emails them once a rebooking sequence is approved.`);
}

async function cmdSet(sb, ref, f) {
  const c = await findClient(sb, ref);
  const update = {};
  if (f['review-url']) {
    if (!/^https:\/\//.test(f['review-url'])) die('--review-url must start with https://');
    update.review_url = f['review-url'];
  }
  if (f['mailing-address']) update.mailing_address = f['mailing-address'];
  if (!Object.keys(update).length) die('nothing to set. Pass --review-url=... and/or --mailing-address="..."');
  const { error } = await sb.from('griffin_clients').update(update).eq('id', c.id);
  if (error) die(error.message);
  console.log(`Updated ${c.business_name}: ${Object.keys(update).join(', ')}.`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const ref = rest.find((a) => !a.startsWith('--'));
  const f = flags(rest);
  const sb = connect();
  if (cmd === 'new') return cmdNew(sb, f);
  if (cmd === 'status') return cmdStatus(sb, ref);
  if (cmd === 'import') return cmdImport(sb, ref, f);
  if (cmd === 'set') return cmdSet(sb, ref, f);
  die('commands: new | status | import | set  (see the header of this file)');
}

if (require.main === module) main().catch((err) => die(err.message));
module.exports = { parseHunters, normDate };
