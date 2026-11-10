#!/usr/bin/env node
// scripts/scrape-guidefitter.js
//
// Collects hunting outfitters per state from Guidefitter's public state listing
// pages (guidefitter.com/hunting/united-states-<state>) into a candidates JSON for
// scripts/discover-outfitters.js. A Guidefitter profile gives the business name,
// town and state but NOT a website or email, so discover-outfitters has to find the
// outfitter's own site (it guesses the domain from the name and only accepts a
// site that names the business, hunts elk and sits in the right state).
//
// robots.txt only disallows /api/. Requests are 700ms apart.
//
// Usage:
//   node scripts/scrape-guidefitter.js --states=ID,OR,MT,WY,CA,WA,CO,UT --out=candidates_gf.json
//   node scripts/discover-outfitters.js --in=candidates_gf.json [--apply]

const fs = require('fs');

const UA = 'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)';
const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const STATES = arg('states', 'ID,OR,MT,WY,CA,WA,CO,UT').split(',');
const OUT = arg('out', 'candidates_gf.json');
const MAX_PAGES = parseInt(arg('max-pages', '40'), 10);
const NAMES = { ID: 'idaho', OR: 'oregon', MT: 'montana', WY: 'wyoming', CA: 'california', WA: 'washington', CO: 'colorado', UT: 'utah' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

// Root-level links that are site navigation, not outfitter profiles.
const NAV = new Set([
  'about-us', 'accessibility-statement', 'blog', 'bragging-wall', 'careers', 'cart', 'contact', 'favicon.ico', 'feed',
  'find-a-fishing-trip', 'find-a-hunting-outfitter', 'fishing-by-region', 'fishing-by-species', 'free-outfitter-page',
  'gear-discounts-for-guides-and-outfitters', 'gear-lists', 'guide-outfitter-associations', 'how-to-become-a-hunting-guide',
  'hunting-licenses-by-state', 'hunts-by-region', 'hunts-by-species', 'insiders', 'insiders-referral-program', 'join', 'legal',
  'manifest.json', 'news', 'old-glory-bank-partnership', 'outdoor-gear-reviews', 'shop', 'community', 'trips', 'sign-in',
  'privacy', 'terms', 'sitemap', 'search', 'hunting', 'fishing', 'hunt', 'trip', 'user', 'win-gear', 'giveaways', 'podcast',
]);

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"');

async function main() {
  const bySlug = new Map();
  for (const st of STATES) {
    const base = `https://guidefitter.com/hunting/united-states-${NAMES[st]}`;
    let empty = 0;
    for (let p = 1; p <= MAX_PAGES; p++) {
      const html = await get(p === 1 ? base : `${base}?page=${p}`);
      await sleep(700);
      if (!html) break;
      const slugs = [...new Set([...html.matchAll(/href="\/([a-z0-9_-]+)"/g)].map((m) => m[1]))].filter((s) => !NAV.has(s));
      const fresh = slugs.filter((s) => !bySlug.has(s));
      fresh.forEach((s) => bySlug.set(s, st));
      console.log(`${st} page ${p}: ${slugs.length} slugs, ${fresh.length} new`);
      empty = fresh.length === 0 ? empty + 1 : 0;
      if (empty >= 2) break;
    }
  }
  console.log(`\n${bySlug.size} profiles; reading each...`);
  const out = [];
  for (const [slug, st] of bySlug) {
    const html = await get(`https://guidefitter.com/${slug}`);
    await sleep(700);
    if (!html) continue;
    const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
    const name = decode(title.replace(/\s*\|\s*Guidefitter.*$/, '')).trim();
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '\n').replace(/\n\s*\n+/g, '\n');
    // "Mt. Pleasant, Utah" appears right after "ago" in the profile header
    const loc = (text.match(/ago\s*\n\s*([^\n]+,\s*[A-Za-z .]+)\s*\n/) || [])[1] || '';
    const stateName = (loc.split(',').pop() || '').trim().toLowerCase();
    const home = Object.entries(NAMES).find(([, n]) => n === stateName);
    if (!name) continue;
    // Only keep outfitters based in one of our states.
    if (!home) continue;
    out.push({ name, state: home[0], city: loc.split(',')[0].trim(), source: `guidefitter.com/${slug}` });
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  const per = {};
  out.forEach((o) => (per[o.state] = (per[o.state] || 0) + 1));
  console.log(`wrote ${OUT}: ${out.length} candidates`, per);
}

main().catch((e) => { console.error(e); process.exit(1); });
