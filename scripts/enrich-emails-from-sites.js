#!/usr/bin/env node
// scripts/enrich-emails-from-sites.js
//
// Finds a real contact email for leads we hold with a website but only a
// placeholder email (status='skipped', email like no-email-on-file+...@
// placeholder.local) — e.g. the Idaho outfitters pulled from an association
// directory that listed phone + website but hid emails.
//
// For each lead it fetches the outfitter's OWN public website (homepage plus
// at most 3 contact/about pages), pulls any mailto: link or visible address,
// and picks the best one. It honors a blanket "Disallow: /" in robots.txt,
// identifies itself, and waits between requests.
//
// Default is a dry run that only prints what it found. --apply writes the
// email onto the row and flips it from skipped to queued.
//
// Usage:
//   node scripts/enrich-emails-from-sites.js                 # dry run
//   node scripts/enrich-emails-from-sites.js --apply         # write + queue
//   node scripts/enrich-emails-from-sites.js --niche=elk_guide --limit=50

const { createClient } = require('@supabase/supabase-js');

const UA = 'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)';
const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const APPLY = process.argv.includes('--apply');
const NICHE = arg('niche', 'elk_guide');
const LIMIT = Math.max(1, parseInt(arg('limit', '100'), 10));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function die(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

async function get(url, ms = 9000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!/text\/html|text\/plain|application\/xhtml/i.test(ct)) return null;
    return { html: (await r.text()).slice(0, 600000), url: r.url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeSite(raw) {
  if (!raw) return null;
  let u = String(raw).trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const url = new URL(u);
    if (/facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com/i.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function robotsAllows(origin) {
  const r = await get(origin + '/robots.txt', 5000);
  if (!r) return true;
  let applies = false;
  for (const line of r.html.split(/\r?\n/)) {
    const l = line.trim();
    if (/^user-agent:\s*\*/i.test(l)) applies = true;
    else if (/^user-agent:/i.test(l)) applies = false;
    else if (applies && /^disallow:\s*\/\s*$/i.test(l)) return false;
  }
  return true;
}

// ---- email extraction ----
const JUNK_DOMAIN = /(sentry|wixpress|wix\.com|example\.|domain\.com|yourdomain|yoursite|email\.com$|godaddy|squarespace|shopify|wordpress|gravatar|schema\.org|w3\.org|googleapis|cloudflare|jquery|bootstrap)/i;
const JUNK_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|name|your|you|user|username|email|example|test|sample|first|firstname|john\.doe|someone)$/i;
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|ico|css|js)$/i;

function decodeCf(hex) {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

function extractEmails(html) {
  const found = new Map(); // email -> {mailto:boolean}
  const add = (e, mailto) => {
    e = e.trim().toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/[),.;:>"'\]]+$/, '');
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)) return;
    const [local, domain] = e.split('@');
    if (IMG_EXT.test(e) || JUNK_DOMAIN.test(domain) || JUNK_LOCAL.test(local)) return;
    const prev = found.get(e);
    found.set(e, { mailto: (prev && prev.mailto) || mailto });
  };
  for (const m of html.matchAll(/href=["']mailto:([^"'>\s]+)["']/gi)) {
    try { add(decodeURIComponent(m[1]), true); } catch { add(m[1], true); }
  }
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) add(decodeCf(m[1]), true);
  for (const m of html.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi)) add(decodeCf(m[1]), true);
  // "name [at] domain [dot] com" style
  const deobf = html.replace(/\s*[\[(]\s*at\s*[\])]\s*/gi, '@').replace(/\s*[\[(]\s*dot\s*[\])]\s*/gi, '.');
  for (const m of deobf.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) add(m[0], false);
  return found;
}

function pickBest(cands, siteHost) {
  const root = siteHost.replace(/^www\./, '');
  const FREE = /(gmail|yahoo|hotmail|outlook|aol|icloud|msn|live|proton|me)\./i;
  const score = ([email, meta]) => {
    const domain = email.split('@')[1];
    let s = 0;
    if (domain === root || domain.endsWith('.' + root)) s += 10; // their own domain
    else if (FREE.test(domain)) s += 5; // small outfitters commonly use these
    if (meta.mailto) s += 4;
    if (/^(info|contact|hunt|hunts|book|booking|bookings|office|outfitter|outfitters)@/.test(email)) s += 1;
    return s;
  };
  return [...cands.entries()].sort((a, b) => score(b) - score(a))[0] || null;
}

async function findEmailFor(siteUrl) {
  const origin = siteUrl.origin;
  if (!(await robotsAllows(origin))) return { skipped: 'robots disallows crawling' };

  const pages = [];
  const home = await get(siteUrl.href);
  if (!home) return { skipped: 'site unreachable' };
  pages.push(home);

  // Follow up to 3 contact-ish links from the homepage, else try common paths.
  const links = new Set();
  for (const m of home.html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const h = m[1];
    if (/contact|about|reach|book|inquir/i.test(h) && !/^(mailto|tel|javascript):/i.test(h)) {
      try {
        const u = new URL(h, home.url);
        if (u.origin === origin && !IMG_EXT.test(u.pathname)) links.add(u.href);
      } catch { /* ignore */ }
    }
  }
  const targets = [...links].slice(0, 3);
  if (targets.length === 0) {
    for (const p of ['/contact', '/contact-us', '/contact.html']) targets.push(origin + p);
  }
  for (const t of targets) {
    await sleep(900);
    const pg = await get(t);
    if (pg) pages.push(pg);
  }

  const all = new Map();
  for (const pg of pages) for (const [e, meta] of extractEmails(pg.html)) {
    const prev = all.get(e);
    all.set(e, { mailto: (prev && prev.mailto) || meta.mailto });
  }
  const best = pickBest(all, siteUrl.hostname);
  return { email: best ? best[0] : null, candidates: [...all.keys()], pages: pages.length, html: pages.map((p) => p.html) };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) die('missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: leads, error } = await sb
    .from('outreach_leads')
    .select('id, company_name, company_website, email, phone, status')
    .eq('niche', NICHE)
    .eq('status', 'skipped')
    .like('email', '%@placeholder.local')
    .not('company_website', 'is', null)
    .order('id')
    .limit(LIMIT);
  if (error) die(error.message);
  console.log(`${leads.length} lead(s) with a website but no email. ${APPLY ? 'APPLYING' : 'DRY RUN'}\n`);

  const { data: existing } = await sb.from('outreach_leads').select('email');
  const taken = new Set((existing || []).map((r) => (r.email || '').toLowerCase()));

  let found = 0;
  const results = [];
  for (const lead of leads) {
    const site = normalizeSite(lead.company_website);
    if (!site) {
      console.log(`  - ${lead.company_name}: no usable website (${lead.company_website})`);
      continue;
    }
    const r = await findEmailFor(site);
    if (r.skipped) {
      console.log(`  - ${lead.company_name}: skipped (${r.skipped})`);
    } else if (!r.email) {
      console.log(`  - ${lead.company_name}: no email found on ${r.pages} page(s)`);
    } else if (taken.has(r.email)) {
      console.log(`  - ${lead.company_name}: ${r.email} already in table, skipping`);
    } else {
      found++;
      console.log(`  ✓ ${lead.company_name}: ${r.email}${r.candidates.length > 1 ? `   (others: ${r.candidates.filter((c) => c !== r.email).join(', ')})` : ''}`);
      results.push({ lead, email: r.email });
      taken.add(r.email);
    }
    await sleep(1000);
  }

  console.log(`\n${found} email(s) found out of ${leads.length}.`);
  if (!APPLY) return console.log('Dry run: nothing written. Re-run with --apply to queue these.');

  for (const { lead, email } of results) {
    const { error: upErr } = await sb
      .from('outreach_leads')
      .update({ email, status: 'queued' })
      .eq('id', lead.id)
      .eq('status', 'skipped');
    if (upErr) console.log(`  ! ${lead.company_name}: update failed: ${upErr.message}`);
  }
  console.log(`Queued ${results.length} lead(s).`);
}

module.exports = { get, normalizeSite, robotsAllows, extractEmails, pickBest, findEmailFor, sleep, UA };

if (require.main === module) {
  main().catch((e) => die(e.message));
}
