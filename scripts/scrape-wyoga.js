#!/usr/bin/env node
// scripts/scrape-wyoga.js
//
// Collects Wyoming Outfitters & Guides Association (wyoga.org) outfitter
// members into a candidates JSON for scripts/discover-outfitters.js.
//
// Each member listing page publishes the outfitter's own contact email,
// phone, website, regions and species. WYOGA's robots.txt asks for a 10 second
// crawl delay, which this honors (so ~100 listings take about 20 minutes).
// The association's own address (wyoga@wyoga.org) is excluded.
//
// Usage:
//   node scripts/scrape-wyoga.js --out=candidates_wy.json [--max-pages=12]
//   node scripts/discover-outfitters.js --in=candidates_wy.json [--apply]

const fs = require('fs');

const UA = 'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)';
const DELAY_MS = 10500; // robots.txt: Crawl-delay: 10
const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const OUT = arg('out', 'candidates_wy.json');
const MAX_PAGES = parseInt(arg('max-pages', '12'), 10);
const BASE = 'https://wyoga.org/wyoga-outfitter-members/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");

async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

const plain = (h) =>
  decodeEntities(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

function parseListing(html, url) {
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || (html.match(/<title>([^<]+)</i) || [])[1] || '';
  const name = decodeEntities(title.replace(/<[^>]+>/g, '')).split(/\s+[|–—-]\s+/)[0].trim();
  const mails = [...html.matchAll(/href=["']mailto:([^"'?]+)/gi)]
    .map((m) => decodeEntities(m[1]).toLowerCase().trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) && !/@wyoga\.org$/.test(e));
  const tels = [...html.matchAll(/href=["']tel:([^"']+)/gi)].map((m) => decodeEntities(m[1]).replace(/\D/g, ''));
  const phoneRaw = tels.find((t) => t.length === 10 && t !== '3072652376');
  const phone = phoneRaw ? `(${phoneRaw.slice(0, 3)}) ${phoneRaw.slice(3, 6)}-${phoneRaw.slice(6)}` : null;
  const ext = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((u) => !/(wyoga\.org|byqqp|gmpg\.org|travelwyoming|facebook|instagram|twitter|x\.com|youtube|google|gravatar|wp\.com|wordpress|fontawesome|jquery|cloudflare|schema\.org|w3\.org|paypal|stripe)/i.test(u));
  return {
    name,
    email: mails[0] || null,
    phone,
    website: ext[0] || null,
    listingText: plain(html).slice(0, 8000),
    listing: url,
  };
}

(async () => {
  const links = [];
  for (let p = 1; p <= MAX_PAGES; p++) {
    const html = await get(`${BASE}?_page=${p}&num=20`);
    await sleep(DELAY_MS);
    if (!html) break;
    const found = [...new Set([...html.matchAll(/href="(https:\/\/wyoga\.org\/wyoga-outfitter-members\/listing\/[^"]+)"/g)].map((m) => m[1]))];
    const fresh = found.filter((u) => !links.includes(u));
    console.log(`directory page ${p}: ${found.length} listings (${fresh.length} new)`);
    if (fresh.length === 0) break;
    links.push(...fresh);
  }
  console.log(`\n${links.length} member listings. Fetching each (10s apart)...\n`);

  const cands = [];
  for (const [i, u] of links.entries()) {
    const html = await get(u);
    await sleep(DELAY_MS);
    if (!html) { console.log(`  ${i + 1}/${links.length} unreachable: ${u}`); continue; }
    const c = parseListing(html, u);
    console.log(`  ${i + 1}/${links.length} ${c.name || '(no name)'} | ${c.email || 'no email'} | ${c.website || 'no site'}`);
    cands.push({ name: c.name, email: c.email, phone: c.phone, website: c.website, listingText: c.listingText, state: 'WY', source: 'wyoga' });
    fs.writeFileSync(OUT, JSON.stringify(cands)); // save as we go
  }
  fs.writeFileSync(OUT, JSON.stringify(cands));
  console.log(`\nWrote ${cands.length} candidates to ${OUT}`);
})();
