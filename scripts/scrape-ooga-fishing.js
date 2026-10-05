#!/usr/bin/env node
// scripts/scrape-ooga-fishing.js
//
// Same proven approach as scrape-ooga-hunting.js, pointed at OOGA's fishing
// directory (oregonoutfitters.org/fishing.html) and filtered to salmon-
// specific guides instead of elk. This page mostly lists inland river guides
// (McKenzie, Deschutes, Rogue) rather than coastal charter operations, so
// the salmon-keyword filter matters even more here — most listings on this
// page are NOT a match for "Oregon coast salmon guide."
//
// Emails are the same Cloudflare-obfuscated format as the hunting page —
// decoded with their own public, documented scheme (a single-byte XOR
// cipher), not a protection bypass.
//
// Usage:
//   node scripts/scrape-ooga-fishing.js --dry-run
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/scrape-ooga-fishing.js

const { createClient } = require('@supabase/supabase-js');

const SOURCE_URL = 'https://www.oregonoutfitters.org/fishing.html';
const NICHE = 'salmon_guide';

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
  console.log(`Parsed ${all.length} total listing(s) from the fishing directory.`);

  const salmonOnly = all.filter((e) => /\bsalmon\b/i.test(e.description) || /\bsalmon\b/i.test(e.name));
  console.log(`\n${salmonOnly.length} mention salmon specifically:`);
  salmonOnly.forEach((e) => console.log(`  - ${e.name} | ${e.email || '(no email found)'} | ${e.website || '(no website found)'}`));

  const withEmail = salmonOnly.filter((e) => e.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email));
  const skippedNoEmail = salmonOnly.length - withEmail.length;
  if (skippedNoEmail > 0) {
    console.log(`\n${skippedNoEmail} salmon guide(s) had no usable email — skipped rather than guessed.`);
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
      job_title: 'Owner/Guide',
      company_name: e.name,
      company_website: e.website || null,
      company_industry: 'Fishing Guide',
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

  console.log(`\nInserted ${rows.length} new salmon_guide lead(s) into outreach_leads.`);
}

main();
