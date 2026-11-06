#!/usr/bin/env node
// scripts/render-gbp-posts.js
//
// Google Business Profile post images (1200x900, 4:3), black and orange with an
// elk-skull backdrop, like the Instagram posts but with no "swipe" or page numbers.
// Usage: node scripts/render-gbp-posts.js   ->  gbp-images/posts/*.jpg
// The copy for each post is in GBP-POSTS.md.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTDIR = path.join(ROOT, 'gbp-images', 'posts');
const FONT_DIR = path.join(ROOT, 'api', 'fonts');
const DIN = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf';
const ASSET = (k) => path.join(ROOT, 'content-posts', 'assets', `elk-skull-${k}.jpg`);
const W = 1200, H = 900;
const C = { white: '#f0ece3', orange: '#ff4d00', gray: '#cfcac0' };

const POSTS = [
  { slug: 'post-1-five-guides', skull: 'front', white: ['FIVE FREE MARKETING', 'GUIDES FOR'], orange: ['OUTFITTERS.'], sub: 'Google profile, reviews, rebooking emails, season calendar, and getting found on Google.' },
  { slug: 'post-2-thank-you-email', skull: 'antlers', white: ['6 WAYS TO OPEN YOUR'], orange: ['THANK-YOU EMAIL.'], sub: "Start with a real moment from the hunt. From our free rebooking guide." },
  { slug: 'post-3-reviews', skull: 'side', white: ['GET A REVIEW'], orange: ['AFTER EVERY HUNT.'], sub: 'Your direct review link, a QR card for camp, and the message to send.' },
  { slug: 'post-4-idaho-dates', skull: 'tracks', white: ['IDAHO ELK:'], orange: ['MAY 1 TO JUNE 5.'], sub: "The 2026 controlled-hunt application window. 2027 dates aren't posted yet." },
  { slug: 'post-5-google-listing', skull: 'front', white: ['5 QUESTIONS A HUNTER', 'ASKS ON YOUR'], orange: ['GOOGLE LISTING.'], sub: 'A filled-out profile answers all five before they ever click your website.' },
];

const h = (type, style, children) => ({ type, props: { style, children } });
const div = (style, children) => h('div', { display: 'flex', ...style }, children);

function tree(p) {
  return div({ width: W, height: H, flexDirection: 'column', padding: '64px 80px', fontFamily: 'Lato' }, [
    div({ fontFamily: 'DIN', fontSize: 34, letterSpacing: 3 }, [
      h('span', { color: C.white }, 'GRIFFIN '), h('span', { color: C.orange }, 'CREATIVE LABS'),
    ]),
    div({ flexGrow: 1 }, ''),
    div({ flexDirection: 'column', width: 880 }, [
      ...p.white.map((t) => div({ fontFamily: 'DIN', fontSize: 100, lineHeight: 1, color: C.white }, t)),
      ...p.orange.map((t) => div({ fontFamily: 'DIN', fontSize: 100, lineHeight: 1, color: C.orange }, t)),
      div({ fontSize: 34, lineHeight: 1.35, color: C.gray, marginTop: 30, width: 720 }, p.sub),
    ]),
    div({ flexGrow: 1 }, ''),
    div({ fontSize: 28, color: C.white, fontWeight: 700 }, 'griffincreativelab.com'),
  ]);
}

(async () => {
  const sharp = require('sharp');
  const satori = (await import('satori')).default;
  const { Resvg } = require('@resvg/resvg-js');
  const fonts = [
    { name: 'Lato', data: fs.readFileSync(path.join(FONT_DIR, 'Lato-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Lato', data: fs.readFileSync(path.join(FONT_DIR, 'Lato-Bold.ttf')), weight: 700, style: 'normal' },
    { name: 'DIN', data: fs.readFileSync(DIN), weight: 400, style: 'normal' },
  ];
  fs.mkdirSync(OUTDIR, { recursive: true });
  for (const f of fs.readdirSync(OUTDIR)) fs.unlinkSync(path.join(OUTDIR, f));
  for (const p of POSTS) {
    const skull = await sharp(ASSET(p.skull)).resize({ width: 900, height: 900, fit: 'cover' }).linear(0.5, 0).toBuffer();
    // fade the skull in from the left so there is no visible edge
    const fade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#080808" stop-opacity="1"/><stop offset="0.45" stop-color="#080808" stop-opacity="0"/></linearGradient></defs><rect width="900" height="900" fill="url(#g)"/></svg>`);
    const base = await sharp({ create: { width: W, height: H, channels: 3, background: '#080808' } })
      .composite([{ input: skull, left: 300, top: 0 }, { input: fade, left: 300, top: 0 }]).png().toBuffer();
    const svg = await satori(tree(p), { width: W, height: H, fonts });
    const text = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
    await sharp(base).composite([{ input: text, left: 0, top: 0 }]).jpeg({ quality: 92 }).toFile(path.join(OUTDIR, p.slug + '.jpg'));
    console.log('wrote', path.join('gbp-images/posts', p.slug + '.jpg'));
  }
})().catch((e) => { console.error(e); process.exit(1); });
