#!/usr/bin/env node
// scripts/render-handout.js
//
// One-page, print-ready handout (US Letter, 300 dpi) for events: the five free
// guides plus a QR code. Same stack as the content renderers (satori -> resvg),
// then a PNG and a single-page PDF (the PDF is the PNG as a JPEG, written by hand
// so no PDF library is needed).
//
// Usage: node scripts/render-handout.js
//   -> handouts/ioga-handout.png, handouts/ioga-handout.pdf
//
// The QR code is handouts/qr-ioga.png. It points to
// https://www.griffincreativelab.com/starter-kit.html?src=ioga so signups from the
// handout show up as their own source. To make one for another event, generate a
// new QR for ?src=<event> and change QR_FILE and OUT below.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'api', 'fonts');
const DIN = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf';
const QR_FILE = path.join(ROOT, 'handouts', 'qr-ioga.png');
const OUT = path.join(ROOT, 'handouts', 'ioga-handout');

const W = 850; // 8.5 in at 100 px/in; rendered 3x for 300 dpi
const H = 1100;
const C = { black: '#111111', ink: '#2b2b2b', gray: '#5f5f5f', light: '#8a8a8a', orange: '#ff4d00', rule: '#e4dfd5' };

const GUIDES = [
  { n: '1', title: 'Rebooking emails for past hunters', desc: 'Thank-you, rebook and application-reminder templates.' },
  { n: '2', title: 'Your Google Business Profile', desc: 'Set up and edit your listing so hunters find you. About 45 minutes.' },
  { n: '3', title: 'Season marketing calendar', desc: "Idaho's application dates filled in, and when to email your clients." },
  { n: '4', title: 'Reviews after every hunt', desc: 'Your direct review link, a printable QR card, and the message to send.' },
  { n: '5', title: 'Get found on Google', desc: 'Titles, hunt pages, listings and Search Console. About 45 minutes.' },
];

const h = (type, style, children) => ({ type, props: { style, children } });
const div = (style, children) => h('div', { display: 'flex', ...style }, children);

function row(g, bonus) {
  return div({ alignItems: 'center', marginBottom: 12 }, [
    div({ width: 54, height: 54, backgroundColor: bonus ? '#ffffff' : C.orange, border: bonus ? `3px solid ${C.orange}` : 'none', alignItems: 'center', justifyContent: 'center', marginRight: 20 },
      div({ fontFamily: 'DIN', fontSize: 40, color: bonus ? C.orange : '#ffffff', lineHeight: 1 }, g.n)),
    div({ flexDirection: 'column', width: 640 }, [
      div({ fontSize: 24, fontWeight: 700, color: C.black, lineHeight: 1.15 }, g.title),
      div({ fontSize: 17, color: C.gray, lineHeight: 1.3, marginTop: 3 }, g.desc),
    ]),
  ]);
}

function page(qrUri) {
  return div({ width: W, height: H, backgroundColor: '#ffffff', flexDirection: 'column', fontFamily: 'Lato', position: 'relative' }, [
    div({ height: 16, backgroundColor: C.orange, width: W }, ''),
    div({ flexDirection: 'column', padding: '34px 56px 0 56px' }, [
      div({ justifyContent: 'space-between', alignItems: 'center' }, [
        div({ fontFamily: 'DIN', fontSize: 32, letterSpacing: 3, color: C.black }, [
          h('span', { color: C.black }, 'GRIFFIN '),
          h('span', { color: C.orange }, 'CREATIVE LABS'),
        ]),
        div({ fontSize: 14, letterSpacing: 2, color: C.light, fontWeight: 700 }, 'MARKETING FOR ELK OUTFITTERS'),
      ]),
      div({ flexDirection: 'column', marginTop: 26 }, [
        div({ fontFamily: 'DIN', fontSize: 90, lineHeight: 0.98, color: C.black, letterSpacing: 1 }, 'FIVE FREE MARKETING'),
        div({ fontFamily: 'DIN', fontSize: 90, lineHeight: 0.98, color: C.black, letterSpacing: 1 }, 'GUIDES FOR IDAHO'),
        div({ fontFamily: 'DIN', fontSize: 90, lineHeight: 0.98, color: C.orange, letterSpacing: 1 }, 'ELK OUTFITTERS.'),
      ]),
      div({ fontSize: 20, color: C.ink, lineHeight: 1.35, marginTop: 16, marginBottom: 22, width: 738 },
        'Step by step, with copy-and-paste templates. Work through them in any order.'),
      ...GUIDES.map((g) => row(g, false)),
    ]),
    // QR block
    div({ position: 'absolute', left: 56, top: 792, width: 738, alignItems: 'center' }, [
      div({ width: 214, height: 214, border: `3px solid ${C.black}`, padding: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginRight: 30 },
        { type: 'img', props: { src: qrUri, width: 184, height: 184, style: { width: 184, height: 184 } } }),
      div({ flexDirection: 'column', width: 470 }, [
        div({ fontFamily: 'DIN', fontSize: 62, lineHeight: 1, color: C.black, letterSpacing: 1 }, 'SCAN TO GET'),
        div({ fontFamily: 'DIN', fontSize: 62, lineHeight: 1, color: C.orange, letterSpacing: 1 }, 'ALL FIVE, FREE.'),
        div({ fontSize: 18, color: C.gray, lineHeight: 1.35, marginTop: 12 }, 'Or go to griffincreativelab.com/starter-kit.html. Free. Just a name and email, no card.'),
      ]),
    ]),
    // footer
    div({ position: 'absolute', left: 0, top: 1070, width: W, height: 30, backgroundColor: C.orange }, ''),
    div({ position: 'absolute', left: 56, top: 1052 - 22, width: 738, justifyContent: 'space-between', alignItems: 'center', fontSize: 16, color: C.ink },
      [
        div({ fontWeight: 700 }, 'Gabriel Wigginton  ·  (503) 779-8493  ·  hello@griffincreativelab.com'),
        div({ color: C.light }, 'Sublimity, Oregon'),
      ]),
  ]);
}

// Minimal one-page PDF (US Letter) holding one JPEG.
function pdfFromJpeg(jpeg, wPx, hPx) {
  const objs = [];
  const add = (s) => { objs.push(Buffer.isBuffer(s) ? s : Buffer.from(s, 'latin1')); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  const img = Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, 'latin1'),
    jpeg,
    Buffer.from('\nendstream', 'latin1'),
  ]);
  objs.push(img);
  const content = 'q 612 0 0 792 0 0 cm /Im0 Do Q';
  add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const parts = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets = [];
  let pos = parts[0].length;
  objs.forEach((o, i) => {
    offsets.push(pos);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), o, Buffer.from('\nendobj\n', 'latin1')]);
    parts.push(b);
    pos += b.length;
  });
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { xref += `${String(o).padStart(10, '0')} 00000 n \n`; });
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}

(async () => {
  const sharp = require('sharp');
  const satori = (await import('satori')).default;
  const { Resvg } = require('@resvg/resvg-js');
  const fonts = [
    { name: 'Lato', data: fs.readFileSync(path.join(FONT_DIR, 'Lato-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Lato', data: fs.readFileSync(path.join(FONT_DIR, 'Lato-Bold.ttf')), weight: 700, style: 'normal' },
    { name: 'Lato', data: fs.readFileSync(path.join(FONT_DIR, 'Lato-Black.ttf')), weight: 900, style: 'normal' },
    { name: 'DIN', data: fs.readFileSync(DIN), weight: 400, style: 'normal' },
  ];
  const qrUri = 'data:image/png;base64,' + fs.readFileSync(QR_FILE).toString('base64');
  const svg = await satori(page(qrUri), { width: W, height: H, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W * 3 } }).render().asPng();
  fs.writeFileSync(OUT + '.png', png);
  const jpeg = await sharp(png).flatten({ background: '#ffffff' }).jpeg({ quality: 95 }).toBuffer();
  const meta = await sharp(png).metadata();
  fs.writeFileSync(OUT + '.pdf', pdfFromJpeg(jpeg, meta.width, meta.height));
  console.log('wrote', path.relative(process.cwd(), OUT + '.png'), `${meta.width}x${meta.height}`);
  console.log('wrote', path.relative(process.cwd(), OUT + '.pdf'));
})().catch((e) => { console.error(e); process.exit(1); });
