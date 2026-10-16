#!/usr/bin/env node
// scripts/render-content-slides.js
//
// Renders a social carousel (1080x1350, 4:5) to PNGs with the same stack the
// ad renderer uses (satori -> resvg), no browser needed.
//
// Usage:
//   node scripts/render-content-slides.js content-posts/post-01.json
//   -> writes content-posts/post-01/slide-01.png ... slide-NN.png
//
// Spec JSON: { "slug": "post-01", "slides": [ { "layout": "hook|text|big|list|cta", ... } ] }
// Fonts: DIN Condensed Bold (macOS system font, closest to Bebas Neue) for
// headlines, Lato (api/fonts) for body. Colors match the site.

const fs = require('fs');
const path = require('path');
const { skullSvg } = require('./elk-skull-svg');

const W = 1080;
const H = 1350;
const C = { black: '#080808', white: '#f0ece3', orange: '#ff4d00', gray: '#8a8a8a' };

const FONT_DIR = path.join(__dirname, '..', 'api', 'fonts');
const DIN = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf';

// satori element helper
const h = (type, style, children) => ({
  type,
  props: { style, children },
});
const div = (style, children) => h('div', { display: 'flex', ...style }, children);
const line = (text, style) => div({ ...style }, text);

// Faint elk-skull backdrop (data-URI SVG, drawn in elk-skull-svg.js).
// Backdrop (black-and-white elk imagery in content-posts/assets/):
//   elk-skull-front.jpg   front-view skull
//   elk-skull-side.jpg    side-profile skull
//   elk-skull-antlers.jpg antlers close-up
//   elk-skull-tracks.jpg  hoof-print trail
// Each slide shows ONE image full-bleed, rotating front -> side -> antlers ->
// tracks. The LAST slide always shows all four together (feathered collage).
// Override per slide with slide.bg = "front" | "side" | "antlers" | "tracks" |
// "all" | "none". If the photos are missing, the drawn vector skull is used.
const ASSET_DIR = path.join(__dirname, '..', 'content-posts', 'assets');
const ORDER = ['front', 'side', 'antlers', 'tracks'];
const BACKDROP_OPACITY = 0.7; // collage (all four)
const SINGLE_OPACITY = { front: 0.62, side: 0.62, antlers: 0.42, tracks: 0.72 }; // one image per slide
const SINGLE = { front: null, side: null, antlers: null, tracks: null };
const TILE_W = 580;
const TILE_H = 725;
// Tile top-left corners (corners of the 1080x1350 canvas, overlapping in the middle).
const SPOTS = [
  [0, 0],
  [500, 0],
  [0, 625],
  [500, 625],
];
const VECTOR_URI = 'data:image/svg+xml;base64,' + Buffer.from(skullSvg({ opacity: 0.11 })).toString('base64');
const BACKDROP_ROT = [null, null, null, null];
let CURRENT_BG = 'front'; // 'front'|'side'|'antlers'|'tracks'|'all'|'none'
async function loadBackdrops() {
  const sharp = require('sharp');
  const files = ORDER.map((k) => ['jpg', 'jpeg', 'png'].map((e) => path.join(ASSET_DIR, `elk-skull-${k}.${e}`)).find((x) => fs.existsSync(x)));
  if (files.some((f) => !f)) return; // fall back to the vector skull
  for (const [i, k] of ORDER.entries()) {
    const buf = await sharp(files[i]).grayscale().resize(W, H, { fit: 'cover', kernel: 'lanczos3' }).jpeg({ quality: 90 }).toBuffer();
    SINGLE[k] = 'data:image/jpeg;base64,' + buf.toString('base64');
  }
  // Feather mask: soft elliptical alpha so each tile fades into black at its edges.
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${TILE_H}"><defs><radialGradient id="g" cx="50%" cy="50%" r="62%"><stop offset="0.6" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  const tiles = [];
  for (const f of files) {
    const t = await sharp(f)
      .grayscale()
      .resize(TILE_W, TILE_H, { fit: 'cover', kernel: 'lanczos3' })
      .ensureAlpha()
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    tiles.push(t);
  }
  for (let rot = 0; rot < 4; rot++) {
    const layers = tiles.map((t, k) => ({
      input: t,
      left: SPOTS[(k + rot) % 4][0],
      top: SPOTS[(k + rot) % 4][1],
      blend: 'lighten',
    }));
    const buf = await sharp({ create: { width: W, height: H, channels: 3, background: '#000000' } })
      .composite(layers)
      .jpeg({ quality: 90 })
      .toBuffer();
    BACKDROP_ROT[rot] = 'data:image/jpeg;base64,' + buf.toString('base64');
  }
}
const backdrop = () => h('img', { position: 'absolute', top: 0, left: 0, width: W, height: H }, undefined);

function frame(i, total, body, foot) {
  return div(
    {
      position: 'relative',
      width: W,
      height: H,
      backgroundColor: C.black,
      color: C.white,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '70px 80px',
      fontFamily: 'Lato',
    },
    [
      CURRENT_BG === 'none' ? '' : { type: 'img', props: { src: (CURRENT_BG === 'all' ? BACKDROP_ROT[0] : SINGLE[CURRENT_BG]) || VECTOR_URI, width: W, height: H, style: { position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover', opacity: (CURRENT_BG === 'all' ? BACKDROP_ROT[0] : SINGLE[CURRENT_BG]) ? (CURRENT_BG === 'all' ? BACKDROP_OPACITY : SINGLE_OPACITY[CURRENT_BG]) : 1 } } },
      div({ justifyContent: 'space-between', alignItems: 'center', width: '100%' }, [
        div({ fontFamily: 'DIN', fontSize: 34, letterSpacing: 2, color: C.white }, [
          h('span', { color: C.white }, 'GRIFFIN\u00A0'),
          h('span', { color: C.orange }, 'CREATIVE LABS'),
        ]),
        div({ fontSize: 24, color: C.gray, letterSpacing: 2 }, i && total ? `${i} / ${total}` : ''),
      ]),
      div({ flexDirection: 'column', width: '100%' }, body),
      div({ height: 60, alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
        div({ fontSize: 28, color: C.gray }, foot || 'griffincreativelab.com'),
        i < total
          ? div({ fontSize: 30, color: C.orange, fontWeight: 700 }, 'SWIPE  →')
          : div({ fontSize: 28, color: C.gray }, ''),
      ]),
    ]
  );
}

const label = (t) =>
  div({ fontFamily: 'DIN', fontSize: 46, color: C.orange, letterSpacing: 4, marginBottom: 36 }, t);

function render(slide, i, total) {
  switch (slide.layout) {
    case 'hook':
      return frame(
        i,
        total,
        [
          ...slide.white.map((t) => line(t, { fontFamily: 'DIN', fontSize: 190, lineHeight: 1.0, color: C.white })),
          div({ height: 40 }, ''),
          ...slide.orange.map((t) => line(t, { fontFamily: 'DIN', fontSize: 190, lineHeight: 1.0, color: C.orange })),
        ]
      );
    case 'text':
      return frame(i, total, [
        label(slide.label),
        ...slide.lines.map((t, k) =>
          line(t, {
            fontSize: k === 0 && slide.firstBig ? 78 : 46,
            fontWeight: k === 0 && slide.firstBig ? 900 : 400,
            lineHeight: 1.3,
            color: k === 0 && slide.firstBig ? C.white : '#d6d2c8',
            marginBottom: 28,
          })
        ),
      ]);
    case 'big':
      return frame(i, total, [
        label(slide.label),
        line(slide.big, { fontFamily: 'DIN', fontSize: 300, lineHeight: 0.95, color: C.orange, marginBottom: 30 }),
        ...slide.lines.map((t) => line(t, { fontSize: 44, lineHeight: 1.35, color: '#d6d2c8', marginBottom: 24 })),
      ]);
    case 'list':
      return frame(i, total, [
        label(slide.label),
        ...slide.items.map((t, k) =>
          div({ alignItems: 'center', marginBottom: 44 }, [
            div(
              { fontFamily: 'DIN', fontSize: 130, color: C.orange, width: 120, lineHeight: 1 },
              String(k + 1)
            ),
            div({ fontSize: 56, fontWeight: 900, color: C.white, lineHeight: 1.15 }, t),
          ])
        ),
        line(slide.note, { fontSize: 38, color: '#d6d2c8', marginTop: 10 }),
      ]);
    case 'dates':
      return frame(i, total, [
        label(slide.label),
        line(slide.title, { fontSize: slide.compact ? 38 : 44, fontWeight: 900, color: C.white, marginBottom: slide.compact ? 24 : 34, lineHeight: 1.2 }),
        ...slide.rows.map((r) =>
          div(
            { justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #222222', paddingBottom: slide.compact ? 8 : 14, marginBottom: slide.compact ? 12 : 18 },
            [
              div({ fontFamily: 'DIN', fontSize: slide.compact ? 62 : 74, color: C.white, letterSpacing: 2 }, r[0]),
              div({ fontFamily: 'DIN', fontSize: slide.compact ? 72 : 86, color: C.orange, letterSpacing: 2 }, r[1]),
            ]
          )
        ),
        line(slide.note, { fontSize: slide.compact ? 28 : 32, color: C.gray, marginTop: 12, lineHeight: 1.35 }),
        line(slide.closer, { fontSize: slide.compact ? 36 : 40, color: '#d6d2c8', marginTop: 16, lineHeight: 1.35 }),
      ]);
    case 'bullets':
      return frame(i, total, [
        label(slide.label),
        line(slide.title, { fontSize: 58, fontWeight: 900, color: C.white, lineHeight: 1.15, marginBottom: 44 }),
        ...slide.items.map((t) =>
          div({ alignItems: 'flex-start', marginBottom: 26 }, [
            div({ width: 22, height: 22, backgroundColor: C.orange, marginTop: 16, marginRight: 28 }, ''),
            div({ fontSize: 42, color: '#e3dfd5', lineHeight: 1.3, width: 800 }, t),
          ])
        ),
      ]);
    case 'steps':
      return frame(i, total, [
        label(slide.label),
        ...slide.items.map((it, k) =>
          div({ alignItems: 'flex-start', marginBottom: 38 }, [
            div({ fontFamily: 'DIN', fontSize: 110, color: C.orange, width: 110, lineHeight: 1 }, String(k + 1)),
            div({ flexDirection: 'column', width: 790 }, [
              div({ fontSize: 48, fontWeight: 900, color: C.white, lineHeight: 1.15 }, it[0]),
              it[1] ? div({ fontSize: 33, color: '#c9c5ba', lineHeight: 1.35, marginTop: 8 }, it[1]) : '',
            ]),
          ])
        ),
      ]);
    case 'timeline':
      return frame(i, total, [
        label(slide.label),
        ...slide.rows.map((r) =>
          div(
            { flexDirection: 'column', borderLeft: '6px solid ' + C.orange, paddingLeft: 30, marginBottom: 40 },
            [
              div({ fontFamily: 'DIN', fontSize: 64, color: C.orange, letterSpacing: 2, lineHeight: 1 }, r[0]),
              div({ fontSize: 44, fontWeight: 700, color: C.white, lineHeight: 1.25, marginTop: 8 }, r[1]),
            ]
          )
        ),
        slide.note ? line(slide.note, { fontSize: 32, color: C.gray, marginTop: 6 }) : '',
      ]);
    case 'template':
      return frame(i, total, [
        label(slide.label),
        line(slide.sub, { fontSize: 36, color: '#c9c5ba', lineHeight: 1.3, marginBottom: 30 }),
        div(
          {
            flexDirection: 'column',
            backgroundColor: '#121212',
            borderLeft: '8px solid ' + C.orange,
            padding: '36px 40px',
          },
          [
            div({ fontSize: 30, color: C.orange, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }, 'SUBJECT'),
            div({ fontSize: 40, color: C.white, fontWeight: 900, lineHeight: 1.2, marginBottom: 28 }, slide.subject),
            ...slide.body.map((t) => div({ fontSize: 35, color: '#e3dfd5', lineHeight: 1.4, marginBottom: 20 }, t)),
          ]
        ),
        slide.note ? line(slide.note, { fontSize: 31, color: C.gray, marginTop: 24, lineHeight: 1.35 }) : '',
      ]);
    case 'checklist':
      return frame(i, total, [
        label(slide.label),
        ...slide.items.map((it) =>
          div({ alignItems: 'flex-start', marginBottom: 36 }, [
            div({ width: 34, height: 34, border: '4px solid ' + C.orange, marginTop: 10, marginRight: 26 }, ''),
            div({ flexDirection: 'column', width: 800 }, [
              div({ fontSize: 46, fontWeight: 900, color: C.white, lineHeight: 1.2 }, it[0]),
              it[1] ? div({ fontSize: 33, color: '#c9c5ba', lineHeight: 1.35, marginTop: 6 }, it[1]) : '',
            ]),
          ])
        ),
      ]);
    case 'cta':
      return frame(
        i,
        total,
        [
          ...slide.headline.map((t) => line(t, { fontFamily: 'DIN', fontSize: 170, lineHeight: 1.0, color: C.white })),
          div({ height: 36 }, ''),
          line(slide.body, { fontSize: 42, lineHeight: 1.35, color: '#d6d2c8', marginBottom: 56 }),
          div(
            {
              backgroundColor: C.orange,
              color: C.white,
              fontFamily: 'DIN',
              fontSize: 76,
              letterSpacing: 3,
              padding: '26px 54px',
              alignSelf: 'flex-start',
            },
            slide.button
          ),
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
    console.error('usage: node scripts/render-content-slides.js <spec.json>');
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
  const total = spec.slides.length;
  for (const [idx, slide] of spec.slides.entries()) {
    CURRENT_BG = slide.bg || (idx === total - 1 ? 'all' : ORDER[idx % ORDER.length]);
    const pos = slide.pos || [idx + 1, total];
    const svg = await satori(render(slide, pos[0], pos[1]), { width: W, height: H, fonts });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
    const file = path.join(outDir, `slide-${String(idx + 1).padStart(2, '0')}.png`);
    fs.writeFileSync(file, png);
    console.log('wrote', path.relative(process.cwd(), file));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
