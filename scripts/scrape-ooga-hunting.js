#!/usr/bin/env node
// scripts/scrape-ooga-hunting.js
//
// Scrapes Oregon Outfitters & Guides Association's public hunting directory
// (oregonoutfitters.org/hunting.html) for elk-specific outfitters and inserts
// them into outreach_leads as niche='elk_guide', status='queued'. Replaces
// Apollo as the lead source for this niche (subscription canceled
// 2026-10-01) — OOGA's directory is real, member-verified, and gives direct
// contact info with no enrichment/bulk-match step needed.
//
// The page mixes elk outfitters in with waterfowl/upland-bird guides, so
// this filters to listings whose name or description actually mentions elk
// — a keyword match, not a guarantee, so the printed list is worth a human
// glance before trusting it blind.
//
// Emails on this page are Cloudflare-obfuscated, not plain mailto: links — a
// basic curl/fetch sees only a hex string. This decodes them itself using
// Cloudflare's own public, documented scheme (a single-byte XOR cipher), not
// a protection bypass — these are public business contact emails shown
// specifically so site visitors can reach them.
//
// Usage:
//   node scripts/scrape-ooga-hunting.js --dry-run
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/scrape-ooga-hunting.js

const { createClient } = require('@supabase/supabase-js');

const SOURCE_URL = 'https://www.oregonoutfitters.org/hunting.html';
const NICHE = 'elk_guide';

function die(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

function cfDecodeEmail(hex) {
  try {
    const key = parseInt(hex.substr(0, 2), 16);
    let out = '';
    for (let i = 2; i < hex.length; i += 2) {
      out += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ key);
    }
    return out;
  } catch {
    return '';
  }
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&bull;/g, '•')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Each member is one <h2 class="wsite-content-title"...>...</h2> block,
// immediately followed by a <div class="paragraph"...>description</div> —
// confirmed against the real fetched HTML, not guessed from rendered text.
function parseEntries(html) {
  const blocks = html.split('<h2 class="wsite-content-title"').slice(1);
  const entries = [];
  for (const block of blocks) {
    const h2Match = block.match(/^[^>]*>([\s\S]*?)<\/h2>/);
    if (!h2Match) continue;
    const h2Html = h2Match[1];

    const phoneMatch = h2Html.match(/tel:(\d+)/);
    const phone = phoneMatch ? phoneMatch[1] : '';

    const emailHexMatch = h2Html.match(/email-protection#([0-9a-f]+)/);
    const email = emailHexMatch ? cfDecodeEmail(emailHexMatch[1]) : '';

    const websiteMatches = [...h2Html.matchAll(/href="(https?:\/\/[^"]+)"/g)]
      .map((m) => m[1])
      .filter((u) => !u.includes('ogpa.org'));
    const website = websiteMatches[0] || '';

    let name = stripTags(h2Html);
    if (phone) {
      const formatted = phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
      const cut = name.indexOf(formatted);
      if (cut > -1) name = name.slice(0, cut);
    }
    name = name.replace(/[•\s]+$/, '').trim();

    const descMatch = block.match(/<div class="paragraph"[^>]*>([\s\S]*?)<\/div>/);
    const description = descMatch ? stripTags(descMatch[1]) : '';

    if (name) entries.push({ name, phone, email, website, description });
  }
  return entries;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`Fetching ${SOURCE_URL}...`);
  const resp = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)' },
  });
  if (!resp.ok) die(`fetch failed: ${resp.status}`);
  const html = await resp.text();

  const all = parseEntries(html);
  console.log(`Parsed ${all.length} total listing(s) from the hunting directory.`);

  const elkOnly = all.filter((e) => /\belk\b/i.test(e.description) || /\belk\b/i.test(e.name));
  console.log(`\n${elkOnly.length} mention elk specifically:`);
  elkOnly.forEach((e) => console.log(`  - ${e.name} | ${e.email || '(no email found)'} | ${e.website || '(no website found)'}`));

  const withEmail = elkOnly.filter((e) => e.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email));
  const skippedNoEmail = elkOnly.length - withEmail.length;
  if (skippedNoEmail > 0) {
    console.log(`\n${skippedNoEmail} elk outfitter(s) had no usable email — skipped rather than guessed.`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing inserted.');
    return;
  }
  if (withEmail.length === 0) {
    console.log('\nNothing to insert.');
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
    existingRows.map((r) =>
      (r.company_website || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase(),
    ),
  );

  const rows = [];
  for (const e of withEmail) {
    const domain = e.website
      ? e.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase()
      : '';
    if (domain && existingDomains.has(domain)) {
      console.log(`  skip (already contacted): ${e.name}`);
      continue;
    }
    rows.push({
      first_name: '',
      last_name: '',
      email: e.email.toLowerCase(),
      job_title: 'Owner/Outfitter',
      company_name: e.name,
      company_website: e.website || null,
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

  console.log(`\nInserted ${rows.length} new elk_guide lead(s) into outreach_leads.`);
}

main();
