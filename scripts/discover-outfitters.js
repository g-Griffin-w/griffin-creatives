#!/usr/bin/env node
// scripts/discover-outfitters.js
//
// Turns a list of outfitter NAMES (from a state license PDF, a Forest Service
// permittee page, a tourism directory...) into emailable elk_guide leads.
//
// For each candidate {name, state, website?, phone?, email?, source}:
//   1. website: use the one given, else guess the outfitter's domain from the
//      business name and accept it only if the page actually names the
//      business and talks about hunting/outfitting.
//   2. fetch the outfitter's OWN public pages (homepage + <=3 contact links),
//      honoring a blanket robots.txt Disallow, 1s apart.
//   3. keep only sites that mention elk (same cross-check the Montana
//      scraper uses), then pull the best contact email + a phone number.
//   4. skip anything already in outreach_leads (by email, domain or name).
//
// Dry run by default. --apply inserts the new leads as status='queued'.
//
// Usage:
//   node scripts/discover-outfitters.js --in=candidates.json
//   node scripts/discover-outfitters.js --in=candidates.json --apply
//   options: --limit=N  --concurrency=4  --report=out.json

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const E = require('./enrich-emails-from-sites.js');

const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const APPLY = process.argv.includes('--apply');
const INFILE = arg('in');
const LIMIT = parseInt(arg('limit', '100000'), 10);
const CONCURRENCY = Math.max(1, Math.min(6, parseInt(arg('concurrency', '4'), 10)));
const REPORT = arg('report', null);
const FROM_REPORT = arg('from-report', null);
const EXCLUDE = arg('exclude', '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

function die(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

const GENERIC = new Set([
  'outfitters', 'outfitter', 'outfitting', 'outfit', 'guide', 'guides', 'guiding', 'service', 'services',
  'hunting', 'hunts', 'hunt', 'adventures', 'adventure', 'company', 'co', 'inc', 'llc', 'ltd', 'corp',
  'the', 'and', 'of', 'ranch', 'lodge', 'camp', 'wilderness', 'enterprises', 'unlimited', 'idaho', 'montana',
  'oregon', 'washington',
]);

const tokens = (name) =>
  String(name || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

// A business name that is really a person ("Denney, Dale R") has no usable domain.
function looksLikePerson(name) {
  return !/(outfit|guide|ranch|lodge|llc|inc\b|company|hunt|adventure|wilderness|camp|creek|mountain|river|pack|trail|horse|mule|safari|expedition|resort|enterprise|unlimited|service|co\b)/i.test(name);
}

function guessDomains(name) {
  const toks = tokens(name);
  const core = toks.filter((t) => !['llc', 'inc', 'ltd', 'corp', 'co', 'the', 'and', 'of'].includes(t));
  if (core.length === 0) return [];
  const joined = core.join('');
  const variants = new Set([joined]);
  variants.add(joined.replace(/outfitters$/, 'outfitting'));
  variants.add(joined.replace(/outfitting$/, 'outfitters'));
  variants.add(core.filter((t) => !['llc', 'inc'].includes(t)).join(''));
  const distinct = core.filter((t) => !GENERIC.has(t));
  if (distinct.length) {
    variants.add(distinct[0] + 'outfitters');
    variants.add(distinct.join('') + 'outfitters');
    variants.add(distinct.join('') + 'hunting');
    variants.add(distinct.join('') + 'idaho');
  }
  const out = [];
  for (const v of variants) {
    if (v.length < 6) continue;
    for (const tld of ['com', 'net', 'org']) out.push(`${v}.${tld}`);
  }
  return out.slice(0, 14);
}

const plain = (html) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;|&#\d+;/g, ' ').replace(/\s+/g, ' ');

function nameMatches(name, text) {
  const distinct = tokens(name).filter((t) => !GENERIC.has(t) && t.length > 2);
  const hay = text.toLowerCase();
  if (distinct.length === 0) return /outfitt|hunt|guide/.test(hay);
  const hit = distinct.filter((t) => hay.includes(t)).length;
  return hit / distinct.length >= 0.6 && /outfitt|hunt|guide/.test(hay);
}

async function resolveWebsite(c) {
  const given = E.normalizeSite(c.website);
  if (given) return { url: given, how: 'given' };
  if (looksLikePerson(c.name)) return null;
  for (const d of guessDomains(c.name)) {
    const r = await E.get(`https://${d}/`, 6000);
    if (!r) continue;
    if (nameMatches(c.name, plain(r.html).slice(0, 60000))) {
      try { return { url: new URL(r.url), how: 'guessed' }; } catch { /* ignore */ }
    }
  }
  return null;
}

// A guessed domain must also place the business in the right state, so
// "aceoutfitters.com" can't be some other Ace in another part of the country.
const STATE_RE = {
  ID: /\bIdaho\b|\bID\s*83\d{3}\b|,\s*ID\b/,
  MT: /\bMontana\b|\bMT\s*59\d{3}\b|,\s*MT\b/,
  OR: /\bOregon\b|\bOR\s*97\d{3}\b|,\s*OR\b/,
  WA: /\bWashington\b|\bWA\s*9[89]\d{3}\b|,\s*WA\b/,
  CA: /\bCalifornia\b|\bCA\s*9\d{4}\b|,\s*CA\b/,
};
const inState = (text, st) => (STATE_RE[st] ? STATE_RE[st].test(text) : true);

// "Mentions elk" is not enough (rafting, aviation and map-app sites do). The
// text has to talk about hunting elk AND about guiding/outfitting.
function isElkOutfitter(text) {
  const elkHunt = /\belk\b[^.]{0,90}\b(hunt|hunts|hunting|hunters|season)\b|\b(hunt|hunts|hunting|hunters)\b[^.]{0,90}\belk\b/i;
  const guiding = /\b(outfitter|outfitters|outfitting|guided|guide service|guides?|hunting camp|drop camp|pack trips?)\b/i;
  return elkHunt.test(text) && guiding.test(text);
}

const PHONE = /\(?\b([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-](\d{4})\b/;
function findPhone(htmls) {
  for (const h of htmls) {
    const t = h.match(/href=["']tel:([^"']+)["']/i);
    if (t) { const m = decodeURIComponent(t[1]).match(PHONE); if (m) return `(${m[1]}) ${m[2]}-${m[3]}`; }
  }
  for (const h of htmls) {
    const m = plain(h).match(PHONE);
    if (m) return `(${m[1]}) ${m[2]}-${m[3]}`;
  }
  return null;
}

const SOCIAL = /(jsdelivr|cdnjs|unpkg|googleapis|googletagmanager|facebook|instagram|twitter|x\.com|linkedin|youtube|pinterest|tripadvisor|tiktok|google\.|goo\.gl|yelp|storyblok|fontawesome|jquery|ionicframework|cloudflare|gstatic|schema\.org|w3\.org|visitmt\.com|apple\.com|bing\.com|mailchimp|wixsite|booking\.com)/i;

const cleanTitle = (t) =>
  (t || '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").split(/\s+[|\u2013\u2014]\s+|\s+-\s+/)[0].replace(/\s+/g, ' ').trim();

// A tourism-directory listing page: pull the business name, its own contact
// email + phone, and its website link. These pages are published by the
// businesses themselves for visitors to contact them.
async function readListing(c) {
  const L = await E.get(c.listing, 12000);
  if (!L) return null;
  const html = L.html;
  const og = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || [])[1];
  const ttl = (html.match(/<title[^>]*>([^<]+)</i) || [])[1];
  c.name = c.name || cleanTitle(og || ttl);
  const mt = [...html.matchAll(/href=["']mailto:([^"'>\s?]+)/gi)].map((m) => decodeURIComponent(m[1]).toLowerCase());
  c.email = c.email || mt.find((e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e)) || null;
  const tl = [...html.matchAll(/href=["']tel:([^"']+)/gi)].map((m) => decodeURIComponent(m[1]));
  for (const t of tl) { const m = t.match(PHONE); if (m) { c.phone = c.phone || `(${m[1]}) ${m[2]}-${m[3]}`; break; } }
  const ext = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]).filter((u) => !SOCIAL.test(u));
  c.website = c.website || ext[0] || null;
  c.listingText = plain(html);
  return c;
}

async function process1(c) {
  const out = { name: c.name, state: c.state, source: c.source, listing: c.listing };
  try {
    if (c.listing) {
      const ok = await readListing(c);
      if (!ok) return { ...out, status: 'listing-unreachable' };
      out.name = c.name;
    }
    const site = await resolveWebsite(c);
    if (!site && !c.listingText) return { ...out, status: 'no-website' };
    if (!site) {
      // No website on the listing: judge it from the listing page alone.
      out.mentionsElk = isElkOutfitter(c.listingText);
      out.email = c.email || null;
      out.phone = c.phone || null;
      if (!out.mentionsElk) return { ...out, status: 'no-elk' };
      if (!out.email) return { ...out, status: 'no-email' };
      return { ...out, status: 'ok' };
    }
    out.website = site.url.href;
    out.how = site.how;
    const r = await E.findEmailFor(site.url);
    if (r.skipped) return { ...out, status: 'skipped', reason: r.skipped };
    const text = r.html.map(plain).join(' ') + ' ' + (c.listingText || '');
    if (!out.name || out.name.length < 3) {
      const h = r.html[0] || '';
      const sn = (h.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i) || [])[1] || (h.match(/<title[^>]*>([^<]+)</i) || [])[1];
      out.name = cleanTitle(sn) || domainOf(out.website);
    }
    if (site.how === 'guessed' && !inState(text, c.state)) return { ...out, status: 'wrong-state' };
    out.mentionsElk = isElkOutfitter(text);
    out.phone = c.phone || findPhone(r.html);
    out.email = c.email || r.email || null;
    out.candidates = r.candidates;
    if (!out.mentionsElk) return { ...out, status: 'no-elk' };
    if (!out.email) return { ...out, status: 'no-email' };
    return { ...out, status: 'ok' };
  } catch (e) {
    return { ...out, status: 'error', reason: e.message };
  }
}

const domainOf = (u) => (u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/[/?#].*$/, '').toLowerCase();
const nameKey = (n) => tokens(n).filter((t) => !GENERIC.has(t)).join('');

async function main() {
  if (!INFILE) die('pass --in=candidates.json');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) die('missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const all = JSON.parse(fs.readFileSync(INFILE, 'utf8')).slice(0, LIMIT);
  // PostgREST caps a plain select at 1000 rows; page through the whole table
  // so the duplicate check sees every lead we already hold.
  const have = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('outreach_leads')
      .select('email, company_name, company_website')
      .order('id')
      .range(from, from + 999);
    if (error) die(error.message);
    have.push(...data);
    if (data.length < 1000) break;
  }
  const haveEmail = new Set(have.map((r) => (r.email || '').toLowerCase()));
  const haveDomain = new Set(have.map((r) => domainOf(r.company_website)).filter(Boolean));
  const haveName = new Set(have.map((r) => nameKey(r.company_name || '')).filter((k) => k.length > 3));

  // Drop what we already hold before spending any requests.
  const fresh = all.filter((c) => {
    const k = nameKey(c.name);
    if (k.length > 3 && haveName.has(k)) return false;
    if (c.website && haveDomain.has(domainOf(c.website))) return false;
    if (c.email && haveEmail.has(c.email.toLowerCase())) return false;
    return true;
  });
  console.log(`${all.length} candidates, ${all.length - fresh.length} already in the table, ${fresh.length} to check. ${APPLY ? 'APPLYING' : 'DRY RUN'}\n`);

  let results = [];
  if (FROM_REPORT) {
    results = JSON.parse(fs.readFileSync(FROM_REPORT, 'utf8')).filter(
      (r) => r.status === 'ok' && !EXCLUDE.some((x) => (r.website || '').toLowerCase().includes(x) || (r.email || '').toLowerCase().includes(x)),
    );
    console.log(`Using saved report: ${results.length} ok entr(ies) after exclusions.\n`);
  }
  let next = 0;
  async function worker() {
    while (!FROM_REPORT && next < fresh.length) {
      const c = fresh[next++];
      const r = await process1(c);
      results.push(r);
      const tag = { ok: '✓', 'no-website': '·', 'no-elk': '–', 'no-email': '?', 'wrong-state': 'x', skipped: '!', error: '!' }[r.status];
      console.log(`${tag} ${r.name.padEnd(42)} ${r.status}${r.email ? ' ' + r.email : ''}${r.reason ? ' (' + r.reason + ')' : ''}${r.how === 'guessed' ? ' [guessed ' + domainOf(r.website) + ']' : ''}`);
      await E.sleep(400);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const ok = [];
  const seenEmail = new Set();
  const seenDomain = new Set();
  for (const r of results.filter((x) => x.status === 'ok')) {
    const em = r.email.toLowerCase();
    const dom = domainOf(r.website);
    const nk = nameKey(r.name || '');
    if (haveEmail.has(em) || seenEmail.has(em) || haveDomain.has(dom) || seenDomain.has(dom)) continue;
    if (nk.length > 3 && haveName.has(nk)) continue; // same business already held under another email
    seenEmail.add(em);
    seenDomain.add(dom);
    ok.push(r);
  }
  const tally = results.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  console.log(`\n${ok.length} new emailable elk lead(s). Breakdown: ${JSON.stringify(tally)}`);
  if (REPORT) fs.writeFileSync(REPORT, JSON.stringify(results, null, 1));

  if (!APPLY) return console.log('Dry run: nothing inserted. Re-run with --apply.');
  if (ok.length === 0) return;
  const rows = ok.map((r) => ({
    first_name: '',
    last_name: '',
    email: r.email.toLowerCase(),
    phone: r.phone || null,
    job_title: 'Owner/Outfitter',
    company_name: r.name,
    company_website: /jsdelivr|cdnjs|unpkg|googleapis/i.test(r.website || '') ? null : r.website,
    company_city: null,
    company_state: r.state,
    company_industry: 'Elk Hunting Outfitter',
    niche: 'elk_guide',
    status: 'queued',
  }));
  const { data: ins, error: insErr } = await sb
    .from('outreach_leads')
    .upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
    .select('id');
  if (insErr) die('insert failed: ' + insErr.message);
  console.log(`Inserted ${ins ? ins.length : rows.length} lead(s) as queued.`);
}

main().catch((e) => die(e.message));
