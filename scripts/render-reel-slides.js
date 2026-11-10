#!/usr/bin/env node
// scripts/render-reel-slides.js
//
// Renders Reel background slides (1080x1920, 9:16) to PNGs: same stack and
// look as render-content-slides.js (satori -> resvg, elk-skull backdrops).
// Text stays inside Instagram's Reel safe zone (clear of the top bar and the
// caption/buttons at the bottom).
//
// Usage:
//   node scripts/render-reel-slides.js content-posts/<spec>.json
//   -> writes content-posts/<slug>/slide-01.png ...
//
// Layouts: hook {white[], orange[], sub} · topic {n, label, head[], example, tag?} · cta {top, big, body, foot}

const fs = require('fs');
const path = require('path');

const W = 1080;
const H = 1920;
const C = { black: '#080808', white: '#f0ece3', orange: '#ff4d00', gray: '#8a8a8a' };
const FONT_DIR = path.join(__dirname, '..', 'api', 'fonts');
const DIN = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf';
const ASSET_DIR = path.join(__dirname, '..', 'content-posts', 'assets');
const ORDER = ['front', 'side', 'antlers', 'tracks'];
const OPACITY = { front: 0.5, side: 0.5, antlers: 0.4, tracks: 0.6, all: 0.65 };
const BG = {};

const h = (type, style, children) => ({ type, props: { style, children } });
const div = (style, children) => h('div', { display: 'flex', ...style }, children);
const line = (text, style) => div({ ...style }, text);

async function loadBackdrops() {
  const sharp = require('sharp');
  const files = ORDER.map((k) => ['jpg', 'jpeg', 'png'].map((e) => path.join(ASSET_DIR, `elk-skull-${k}.${e}`)).find((x) => fs.existsSync(x)));
  if (files.some((f) => !f)) return;
  for (const [i, k] of ORDER.entries()) {
    const buf = await sharp(files[i]).grayscale().resize(W, H, { fit: 'cover', kernel: 'lanczos3' }).jpeg({ quality: 90 }).toBuffer();
    BG[k] = 'data:image/jpeg;base64,' + buf.toString('base64');
  }
  // Collage for the last slide: four feathered tiles stacked down the frame.
  const TW = 760;
  const TH = 1000;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}"><defs><radialGradient id="g" cx="50%" cy="50%" r="62%"><stop offset="0.6" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  const spots = [[0, 0], [320, 0], [0, 920], [320, 920]];
  const layers = [];
  for (const [k, f] of files.entries()) {
    const t = await sharp(f).grayscale().resize(TW, TH, { fit: 'cover', kernel: 'lanczos3' }).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    layers.push({ input: t, left: spots[k][0], top: spots[k][1], blend: 'lighten' });
  }
  const buf = await sharp({ create: { width: W, height: H, channels: 3, background: '#000000' } }).composite(layers).jpeg({ quality: 90 }).toBuffer();
  BG.all = 'data:image/jpeg;base64,' + buf.toString('base64');
}

const brand = () =>
  div({ fontFamily: 'DIN', fontSize: 40, letterSpacing: 3 }, [
    h('span', { color: C.white }, 'GRIFFIN '),
    h('span', { color: C.orange }, 'CREATIVE LABS'),
  ]);

function frame(bg, body, foot) {
  return div(
    { position: 'relative', width: W, height: H, backgroundColor: C.black, color: C.white, flexDirection: 'column', fontFamily: 'Lato' },
    [
      BG[bg] ? { type: 'img', props: { src: BG[bg], width: W, height: H, style: { position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover', opacity: OPACITY[bg] } } } : '',
      // dark wash so the type always reads
      div({ position: 'absolute', top: 0, left: 0, width: W, height: H, backgroundColor: 'rgba(8,8,8,0.35)' }, ''),
      // top safe zone, then brand
      div({ position: 'absolute', top: 250, left: 80 }, brand()),
      div({ position: 'absolute', top: 400, left: 80, width: 920, height: 1100, flexDirection: 'column', justifyContent: 'center' }, body),
      foot ? div({ position: 'absolute', top: 1560, left: 80, fontSize: 30, color: C.gray, letterSpacing: 2 }, foot) : '',
    ]
  );
}

function render(slide, idx, total) {
  const bg = slide.layout === 'cta' ? 'all' : ORDER[idx % ORDER.length];
  switch (slide.layout) {
    case 'hook':
      return frame(bg, [
        ...slide.white.map((t) => line(t, { fontFamily: 'DIN', fontSize: 170, lineHeight: 1.0, color: C.white })),
        div({ height: 36 }, ''),
        ...slide.orange.map((t) => line(t, { fontFamily: 'DIN', fontSize: 190, lineHeight: 1.0, color: C.orange })),
        div({ height: 50 }, ''),
        line(slide.sub, { fontSize: 44, color: '#d6d2c8', fontWeight: 700 }),
      ]);
    case 'topic':
      return frame(bg, [
        div({ alignItems: 'baseline', marginBottom: 40 }, [
          div({ fontFamily: 'DIN', fontSize: 330, color: C.orange, lineHeight: 0.85, marginRight: 36 }, slide.n),
          div({ fontFamily: 'DIN', fontSize: 66, color: C.orange, letterSpacing: 4, width: 600, lineHeight: 1.05 }, slide.label),
        ]),
        ...slide.head.map((t) => line(t, { fontFamily: 'DIN', fontSize: 150, lineHeight: 1.0, color: C.white })),
        div({ height: 56 }, ''),
        div({ flexDirection: 'column', borderLeft: '8px solid ' + C.orange, paddingLeft: 32 }, [
          slide.tag ? div({ fontSize: 28, color: C.orange, fontWeight: 700, letterSpacing: 3, marginBottom: 10 }, slide.tag) : '',
          div({ fontSize: 46, color: '#e3dfd5', lineHeight: 1.35 }, slide.example),
        ]),
      ]);
    case 'cta':
      return frame(
        bg,
        [
          line(slide.top, { fontFamily: 'DIN', fontSize: 150, lineHeight: 1.0, color: C.white, letterSpacing: 4 }),
          div({ backgroundColor: C.orange, color: C.white, fontFamily: 'DIN', fontSize: 330, lineHeight: 1.0, letterSpacing: 6, padding: '10px 50px', alignSelf: 'flex-start', marginTop: 20, marginBottom: 40 }, slide.big),
          line(slide.body, { fontSize: 56, fontWeight: 700, lineHeight: 1.3, color: '#e3dfd5' }),
        ],
        slide.foot
      );
    default:
      throw new Error('unknown layout ' + slide.layout);
  }
}

(async () => {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error('usage: node scripts/render-reel-slides.js <spec.json>');
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const outDir = path.join(path.dirname(specPath), spec.slug);
  fs.mkdirSync(outDir, { recursive: true });

  const satori = (await import('satori')).default;
  const { Resvg } = require('@resvg/resvg-js');
  const fonts = [
    { name: 'Lato', data: fs.readFileSync(path.join(FONT_DIR, 'Lato-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Lato', data: fs.readFileSync(path.join(FONT_DIR, 'Lato-Bold.ttf')), weight: 700, style: 'normal' },
    { name: 'Lato', data: fs.readFileSync(path.join(FONT_DIR, 'Lato-Black.ttf')), weight: 900, style: 'normal' },
    { name: 'DIN', data: fs.readFileSync(DIN), weight: 400, style: 'normal' },
  ];

  await loadBackdrops();
  for (const [idx, slide] of spec.slides.entries()) {
    const svg = await satori(render(slide, idx, spec.slides.length), { width: W, height: H, fonts });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
    const file = path.join(outDir, `slide-${String(idx + 1).padStart(2, '0')}.png`);
    fs.writeFileSync(file, png);
    console.log('wrote', path.relative(process.cwd(), file));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
