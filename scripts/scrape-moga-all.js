#!/usr/bin/env node
// scripts/scrape-moga-all.js
//
// Montana Outfitters & Guides Association directory -> candidates JSON, ALL land
// game (not just elk). Every outfitter page embeds schema.org LocalBusiness JSON-LD
// with the outfitter's own email and phone, plus a FAQ answer listing the species
// they guide for. Only hunting outfitters (a land-game species is listed) are kept.
// 800ms between requests. Output feeds scripts/discover-outfitters.js --any-game.
//
// Usage: node scripts/scrape-moga-all.js --out=leads-work/candidates_mt.json
const fs = require('fs');
const BASE = 'https://www.montanaoutfitters.org';
const UA = 'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)';
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '--out=candidates_mt.json').slice(6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LAND = /\b(elk|deer|whitetail|mule deer|bear|antelope|pronghorn|moose|sheep|goat|mountain lion|lion|cougar|turkey|bison|hog|boar|predator|wolf|coyote|big game|upland)\b/i;
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(r.status); return r.text(); };
(async () => {
  const list = await get(`${BASE}/find-an-outfitter`);
  const slugs = [...new Set([...list.matchAll(/href="\/outfitter\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
  console.log(slugs.length, 'outfitters');
  const out = [];
  let i = 0;
  for (const s of slugs) {
    i++;
    try {
      const html = await get(`${BASE}/outfitter/${s}`);
      await sleep(800);
      let biz = null; let species = '';
      for (const b of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        let d; try { d = JSON.parse(b[1]); } catch { continue; }
        if (d['@type'] === 'LocalBusiness') biz = d;
        if (d['@type'] === 'FAQPage') {
          const q = (d.mainEntity || []).find((e) => /What species/i.test(e.name || ''));
          species = q ? q.acceptedAnswer.text : '';
        }
      }
      if (!biz || !biz.email) continue;
      const sp = species.replace(/^.*guides for\s*/i, '').replace(/,?\s*as listed in.*$/i, '');
      if (!LAND.test(sp)) continue;
      out.push({ name: biz.name, email: biz.email.toLowerCase(), phone: biz.telephone || null, state: 'MT', species: sp, source: 'montanaoutfitters.org', trusted: true });
    } catch (e) { /* skip */ }
    if (i % 50 === 0) console.log(i, 'read,', out.length, 'hunting');
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('wrote', OUT, out.length);
})();
