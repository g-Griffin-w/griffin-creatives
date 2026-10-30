#!/usr/bin/env node
// scripts/make-gbp-images.js
//
// Renders the Google Business Profile images into gbp-images/:
//   cover.jpg  1024x576 (16:9)  slogan over the elk-skull backdrop
// (the logo is drawn by scripts/make-gbp-logo.js)
// Same stack as render-content-slides.js (satori -> resvg), same fonts.

const fs = require('fs');
const path = require('path');

const C = { black: '#080808', white: '#f0ece3', orange: '#ff4d00', gray: '#8a8a8a' };
const FONT_DIR = path.join(__dirname, '..', 'api', 'fonts');
const DIN = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf';
const ASSET = path.join(__dirname, '..', 'content-posts', 'assets');
const OUT = path.join(__dirname, '..', 'gbp-images');

const h = (type, style, children) => ({ type, props: { style, children } });
const div = (style, children) => h('div', { display: 'flex', ...style }, children);
const uri = (file) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ASSET, file)).toString('base64');

async function main() {
  const satori = (await import('satori')).default;
  const { Resvg } = require('@resvg/resvg-js');
  const fonts = [
    { name: 'Lato', data: fs.readFileSync(path.join(FONT_DIR, 'Lato-Bold.ttf')), weight: 700, style: 'normal' },
    { name: 'DIN', data: fs.readFileSync(DIN), weight: 400, style: 'normal' },
  ];
  fs.mkdirSync(OUT, { recursive: true });

  const brand = (size) =>
    div({ fontFamily: 'DIN', fontSize: size, letterSpacing: 2 }, [
      h('span', { color: C.white }, 'GRIFFIN '),
      h('span', { color: C.orange }, 'CREATIVE LABS'),
    ]);

  const cover = div(
    { position: 'relative', width: 1024, height: 576, backgroundColor: C.black, flexDirection: 'column', justifyContent: 'center', padding: '0 64px' },
    [
      { type: 'img', props: { src: uri('elk-skull-front.jpg'), width: 1024, height: 576, style: { position: 'absolute', top: 0, left: 0, width: 1024, height: 576, objectFit: 'cover', opacity: 0.5 } } },
      div({ marginBottom: 22 }, [brand(34)]),
      div({ fontFamily: 'DIN', fontSize: 104, lineHeight: 1, color: C.white, letterSpacing: 1 }, 'FILL YOUR CALENDAR.'),
      div({ fontFamily: 'DIN', fontSize: 104, lineHeight: 1, color: C.orange, letterSpacing: 1 }, 'EVERY SEASON.'),
      div({ fontFamily: 'Lato', fontWeight: 700, fontSize: 26, color: '#d6d2c8', marginTop: 26 }, 'Marketing for elk outfitters  ·  griffincreativelab.com'),
    ]
  );
  const sharp = require('sharp');
  const render = async (el, w, hgt) => new Resvg(await satori(el, { width: w, height: hgt, fonts }), { fitTo: { mode: 'width', value: w } }).render().asPng();
  fs.writeFileSync(path.join(OUT, 'cover.jpg'), await sharp(await render(cover, 1024, 576)).jpeg({ quality: 92 }).toBuffer());
  console.log('wrote gbp-images/cover.jpg');
}
main().catch((e) => { console.error(e); process.exit(1); });
