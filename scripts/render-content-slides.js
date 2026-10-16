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

function frame(i, total, body, foot) {
  return div(
    {
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

  const total = spec.slides.length;
  for (const [idx, slide] of spec.slides.entries()) {
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
