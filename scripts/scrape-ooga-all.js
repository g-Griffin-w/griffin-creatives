#!/usr/bin/env node
// scripts/scrape-ooga-all.js
//
// Oregon Outfitters & Guides Association public hunting directory -> candidates JSON
// for ALL land game (not just elk). Waterfowl-only and fishing listings are dropped.
// Emails on the page are Cloudflare-obfuscated; decoded with Cloudflare's public XOR scheme.
// Usage: node scripts/scrape-ooga-all.js --out=leads-work/candidates_or.json
const fs = require('fs');
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '--out=candidates_or.json').slice(6);
const LAND = /\b(elk|deer|whitetail|bear|antelope|pronghorn|moose|sheep|goat|lion|cougar|turkey|bison|hog|boar|predator|coyote|big game|cougars|bobcat)\b/i;
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

(async () => {
  const r = await fetch('https://www.oregonoutfitters.org/hunting.html', { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)' } });
  const all = parseEntries(await r.text());
  const out = all
    .filter((e) => e.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email) && LAND.test(e.name + ' ' + e.description))
    .map((e) => ({ name: e.name, email: e.email.toLowerCase(), phone: e.phone || null, website: e.website || null, state: 'OR', source: 'oregonoutfitters.org', trusted: true }));
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(all.length, 'listings;', out.length, 'land-game with email ->', OUT);
})();
