#!/usr/bin/env node
// scripts/search-audit.js
//
// Two-minute search audit of a prospect's website for call prep (BLUEPRINTS.md #3,
// lead-magnet mode). Prints what Google can read from the home page: title and
// description, headings, schema, image alt text, phone as text, and the nav pages.
// It only reads the public page. Maps and Google Business Profile still need a
// manual look on a phone (see SEARCH-AUDITS.md).
//
// Usage: node scripts/search-audit.js https://example.com

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('usage: node scripts/search-audit.js <url>');
    process.exit(1);
  }
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '');
  const text = strip(body);

  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || [])[1];
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1]));
  const imgs = html.match(/<img[^>]*>/gi) || [];
  const phone = text.match(/\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/g);

  const links = new Map();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = strip(m[2]);
    if (label && !/^(tel:|mailto:|#|javascript:)/i.test(m[1]) && label.length < 40) links.set(m[1], label);
  }

  const row = (k, v) => console.log(k.padEnd(18) + v);
  row('status', `${res.status} (${res.url})`);
  row('title', `${title || 'NONE'}  [${title.length} chars; about 60 is what shows]`);
  row('meta description', desc ? `${desc}  [${desc.length} chars]` : 'NONE');
  row('canonical', /rel=["']canonical/i.test(html) ? 'yes' : 'NO');
  row('social preview', `${(html.match(/property=["']og:/gi) || []).length} og tags`);
  row('schema (JSON-LD)', `${(html.match(/application\/ld\+json/gi) || []).length} block(s)`);
  row('h1', h1s.length ? `${h1s.length}: ${[...new Set(h1s)].join(' | ')}${h1s.length > 1 && new Set(h1s).size < h1s.length ? '  [DUPLICATE]' : ''}` : 'NONE');
  row('images', `${imgs.length}; ${imgs.filter((i) => !/alt=["'][^"']+["']/i.test(i)).length} without alt text`);
  row('words on page', String(text.split(' ').length));
  row('phone as text', phone ? [...new Set(phone)].join(', ') : 'NOT FOUND');
  row('mentions', ['review', 'testimonial', '2027', '2026', 'price', '\\$\\d'].map((k) => `${k.replace('\\\\', '')}:${(text.match(new RegExp(k, 'gi')) || []).length}`).join('  '));
  row('google map/reviews', /google\.com\/maps|g\.page|maps\.app\.goo\.gl/i.test(html) ? 'link found' : 'no link');
  row('social links', ['facebook', 'instagram', 'youtube'].filter((s) => new RegExp(s + '\\.com', 'i').test(html)).join(', ') || 'none');
  console.log('\nnav pages (' + links.size + '):');
  for (const [u, l] of [...links].slice(0, 30)) console.log('  ' + l.padEnd(32) + u);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
