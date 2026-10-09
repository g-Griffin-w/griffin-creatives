#!/usr/bin/env node
// scripts/scrape-moga-elk.js
//
// Scrapes the Montana Outfitters & Guides Association's real elk-hunting
// directory (montanaoutfitters.org) and inserts verified leads into
// outreach_leads as niche='elk_guide', status='queued'. This is a much
// stronger source than the Oregon/Idaho ones: every outfitter's own page
// embeds a clean schema.org LocalBusiness JSON-LD block with name,
// telephone, email, and address — no Cloudflare obfuscation, no manual
// browsing needed, and it's public structured data meant for exactly this
// kind of machine consumption (the same markup search engines read).
//
// Two-stage fetch, since contact info only lives on each outfitter's own
// page, not the listing:
//   1. GET /find-an-outfitter?species=Elk  -> extract every /outfitter/<slug>
//   2. GET /outfitter/<slug> for each      -> parse the LocalBusiness JSON-LD
//
// Rate-limited (800ms between requests) since this hits ~150 individual
// pages on someone else's server, not a bulk API.
//
// Usage:
//   node scripts/scrape-moga-elk.js --dry-run [--limit=30]
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/scrape-moga-elk.js [--limit=30]

const { createClient } = require('@supabase/supabase-js');

const BASE = 'https://www.montanaoutfitters.org';
const NICHE = 'elk_guide';
const DEFAULT_LIMIT = 30; // matches the realistic send-capacity cap used elsewhere (pull-leads.js)

function die(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)' },
  });
  if (!resp.ok) throw new Error(`fetch failed (${resp.status}) for ${url}`);
  return resp.text();
}

async function getElkSlugs() {
  const html = await fetchText(`${BASE}/find-an-outfitter?species=Elk`);
  const matches = [...html.matchAll(/href="\/outfitter\/([a-z0-9-]+)"/g)].map((m) => m[1]);
  return [...new Set(matches)];
}

// Parses the schema.org LocalBusiness JSON-LD block every outfitter page
// embeds — real structured data, not scraped-and-guessed HTML.
function parseLocalBusiness(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    let data;
    try {
      data = JSON.parse(b[1]);
    } catch {
      continue;
    }
    if (data['@type'] === 'LocalBusiness') return data;
  }
  return null;
}

// Cross-check against the FAQPage block's species answer so a stale/mis-tagged
// listing doesn't slip through just because it was present in the ?species=Elk
// results.
function mentionsElk(html) {
  const faqMatch = html.match(/"What species does[^"]*"\s*,\s*"acceptedAnswer":\{"@type":"Answer","text":"([^"]*)"/);
  if (!faqMatch) return true; // no FAQ block found — don't block on something that isn't there
  return /\belk\b/i.test(faqMatch[1]);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.slice(8), 10)) : DEFAULT_LIMIT;

  console.log(`Fetching elk-outfitter list from ${BASE}/find-an-outfitter?species=Elk ...`);
  const slugs = await getElkSlugs();
  console.log(`Found ${slugs.length} elk outfitter(s) listed. Fetching up to ${limit} detail page(s)...\n`);

  const results = [];
  for (const slug of slugs) {
    if (results.length >= limit) break;
    try {
      const html = await fetchText(`${BASE}/outfitter/${slug}`);
      const biz = parseLocalBusiness(html);
      if (!biz) {
        console.log(`  skip (no LocalBusiness data): ${slug}`);
        await sleep(800);
        continue;
      }
      if (!mentionsElk(html)) {
        console.log(`  skip (FAQ doesn't actually mention elk): ${biz.name}`);
        await sleep(800);
        continue;
      }
      const email = (biz.email || '').toLowerCase().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.log(`  skip (no usable email): ${biz.name}`);
        await sleep(800);
        continue;
      }
      results.push({
        name: biz.name || slug,
        email,
        phone: biz.telephone || '',
        website: biz.url || `${BASE}/outfitter/${slug}`,
        city: biz.address?.addressLocality || '',
        state: biz.address?.addressRegion || 'MT',
      });
      console.log(`  ✓ ${biz.name} | ${email} | ${biz.telephone || '(no phone)'}`);
    } catch (err) {
      console.log(`  error on ${slug}: ${err.message}`);
    }
    await sleep(800);
  }

  console.log(`\n${results.length} verified lead(s) with usable email.`);

  if (dryRun) {
    console.log('\n--dry-run: nothing inserted.');
    return;
  }
  if (results.length === 0) {
    console.log('Nothing to insert.');
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) die('missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: existingRows, error: fetchErr } = await sb
    .from('outreach_leads')
    .select('company_website')
    .not('company_website', 'is', null);
  if (fetchErr) die(`Supabase fetch (existing domains) failed: ${fetchErr.message}`);
  const existingDomains = new Set(
    existingRows.map((r) => (r.company_website || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase()),
  );

  const rows = [];
  for (const r of results) {
    const domain = r.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();
    if (existingDomains.has(domain)) {
      console.log(`  skip (already contacted): ${r.name}`);
      continue;
    }
    rows.push({
      first_name: '',
      last_name: '',
      email: r.email,
      phone: r.phone || null,
      job_title: 'Owner/Outfitter',
      company_name: r.name,
      company_website: r.website,
      company_city: r.city || null,
      company_state: r.state,
      company_industry: 'Elk Hunting Outfitter',
      niche: NICHE,
      status: 'queued',
    });
  }

  if (rows.length === 0) {
    console.log('\nNothing new to insert after dedupe.');
    return;
  }

  const { error: insertErr } = await sb.from('outreach_leads').insert(rows);
  if (insertErr) die(`Supabase insert failed: ${insertErr.message}`);

  console.log(`\nInserted ${rows.length} new elk_guide lead(s) (Montana) into outreach_leads.`);
}

main().catch((err) => die(err.message));
