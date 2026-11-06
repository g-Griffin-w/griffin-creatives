#!/usr/bin/env node
// scripts/render-brochure.js
//
// Tri-fold (letter fold) brochure: the five free guides boiled down to their key
// steps, plus a QR code. One US Letter sheet, landscape, printed on both sides
// (2-page PDF). Same stack as render-handout.js (satori -> resvg, PDF written by hand).
//
// Usage: node scripts/render-brochure.js
//   -> handouts/ioga-brochure-outside.png, ...-inside.png, ioga-brochure.pdf
//
// Page 1 (outside), left to right: inside flap | back panel (QR + contact) | front cover
// Page 2 (inside), left to right: guides 1+2 | guides 3+4 | guide 5 + "done for you"
//
// Print: double-sided, landscape, "flip on short edge". Black-and-orange design: the black
// field is inset 0.25 in on every side (white border), so any printer can print it
// without bleed or trimming. Fold the left flap in first, then the cover over it.
//
// The QR is handouts/qr-ioga.png (https://www.griffincreativelab.com/starter-kit.html?src=ioga).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'api', 'fonts');
const DIN = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf';
const QR_FILE = path.join(ROOT, 'handouts', 'qr-ioga.png');
const OUT = path.join(ROOT, 'handouts', 'ioga-brochure');

const W = 1100; // 11 in at 100 px/in; rendered 3x for 300 dpi
const H = 850;
const PW = [350, 350, 350];
const PH = 800; // black field is inset 25px (0.25 in) on every side so any printer can print it
const PAD = '44px 32px 40px 32px';
// Black-and-orange: C.black is the MAIN TEXT colour (off-white); C.bg is the black field.
const C = { bg: '#0a0a0a', black: '#f0ece3', ink: '#d6d2c8', gray: '#a9a49a', light: '#8a8a8a', orange: '#ff4d00', rule: '#3a3a3a', wash: '#1a120c' };

const GUIDES = {
  1: { title: 'Rebooking emails', time: 'Three emails and a follow-up', steps: [
    'Build one list of your past hunters',
    'Email 1: the thank-you',
    'Email 2: the rebook',
    'Email 3: the application reminder',
    'Send one follow-up, and get your dates right',
  ] },
  2: { title: 'Your Google Business Profile', time: 'About 45 minutes', steps: [
    'Claim it and check for duplicates',
    'Use your real business name, then verify',
    'Set a service area and pick your categories',
    'List each hunt as its own service',
    'Add real photos, and keep it alive',
  ] },
  3: { title: 'Season marketing calendar', time: 'Fill in four dates', steps: [
    "Fill in your state's four key dates",
    'Before results: "apply, and if you draw I\'m holding dates for you"',
    'After results: sell to hunters with a tag in hand',
    'Follow the year month by month, then put it on your real calendar',
  ] },
  4: { title: 'Reviews after every hunt', time: 'Set it up once', steps: [
    'Get your direct review link',
    'Turn it into a QR code card for camp',
    'Save the message and send it after every hunt',
    'Follow Google\'s rules, and reply to every review',
  ] },
  5: { title: 'Get found on Google', time: 'About 45 minutes', steps: [
    'Search yourself first and see what hunters see',
    "Fix your website's title and description",
    'Give each hunt its own page',
    'Get listed where Google already looks',
    'Set up Search Console (free) and check once a month',
  ] },
};

const DESC = {
  1: 'Thank-you, rebook and application-reminder templates.',
  2: 'Set up and edit your listing so hunters find you. About 45 minutes.',
  3: 'Your application dates filled in, and when to email your clients.',
  4: 'Your direct review link, a printable QR card, and the message to send.',
  5: 'Titles, hunt pages, listings and Search Console. About 45 minutes.',
};

const h = (type, style, children) => ({ type, props: { style, children } });
const div = (style, children) => h('div', { display: 'flex', ...style }, children);
const logo = (size) => div({ fontFamily: 'DIN', fontSize: size, letterSpacing: 2 }, [
  h('span', { color: C.black }, 'GRIFFIN '),
  h('span', { color: C.orange }, 'CREATIVE LABS'),
]);

function panel(w, children, extra) {
  return div({ width: w, height: PH, flexDirection: 'column', padding: PAD, backgroundColor: C.bg, position: 'relative', ...(extra || {}) }, children);
}

function guide(n) {
  const g = GUIDES[n];
  return div({ flexDirection: 'column', marginBottom: 34 }, [
    div({ alignItems: 'center', marginBottom: 12 }, [
      div({ width: 52, height: 52, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0 },
        div({ fontFamily: 'DIN', fontSize: 40, color: '#ffffff', lineHeight: 1 }, String(n))),
      div({ flexDirection: 'column', width: 220 }, [
        div({ fontSize: 21, fontWeight: 700, color: C.black, lineHeight: 1.12 }, g.title),
      ]),
    ]),
    div({ fontSize: 14, color: C.gray, lineHeight: 1.3, marginBottom: 6 }, DESC[n]),
    ...g.steps.map((s) => div({ marginTop: 9, alignItems: 'flex-start' }, [
      div({ width: 8, height: 8, backgroundColor: C.orange, marginTop: 7, marginRight: 11, flexShrink: 0 }, ''),
      div({ fontSize: 17, color: C.ink, lineHeight: 1.28, width: 266 }, s),
    ])),
  ]);
}

// ---------- outside ----------
function flap() {
  const item = (n, text, tag) => div({ alignItems: 'flex-start', marginBottom: 30 }, [
    div({ fontFamily: 'DIN', fontSize: 64, color: C.orange, lineHeight: 0.9, width: 50, flexShrink: 0 }, n),
    div({ flexDirection: 'column', width: 236 }, [
      div({ fontSize: 19, fontWeight: 700, color: C.black, lineHeight: 1.25 }, text),
      div({ fontSize: 13, color: C.light, marginTop: 4 }, tag),
    ]),
  ]);
  return panel(PW[0], [
    div({ fontFamily: 'DIN', fontSize: 22, letterSpacing: 3, color: C.orange }, 'START HERE'),
    div({ flexDirection: 'column', marginTop: 8, marginBottom: 30 }, [
      ...['IF YOU DO ONLY', 'THREE THINGS', 'THIS WEEK:'].map((t) => div({ fontFamily: 'DIN', fontSize: 58, lineHeight: 0.98, color: C.black }, t)),
    ]),
    item('1', 'Search your own name on Google and see what a hunter sees.', 'Guide 5'),
    item('2', 'Claim your Google Business Profile.', 'Guide 2'),
    item('3', "Send last year's hunters a thank-you email.", 'Guide 1'),
    div({ flexGrow: 1 }, ''),
    div({ fontSize: 14, color: C.gray, lineHeight: 1.35, borderTop: `2px solid ${C.rule}`, paddingTop: 12 },
      'Each guide takes about an hour or less. Work through them in any order.'),
  ]);
}

function back(qrUri) {
  return panel(PW[1], [
    div({ flexDirection: 'column', marginBottom: 20 }, [
      div({ fontFamily: 'DIN', fontSize: 52, lineHeight: 1, color: C.black, letterSpacing: 1 }, 'SCAN TO GET'),
      div({ fontFamily: 'DIN', fontSize: 52, lineHeight: 1, color: C.orange, letterSpacing: 1 }, 'ALL FIVE, FREE.'),
    ]),
    div({ width: 270, height: 270, border: `4px solid ${C.orange}`, padding: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
      { type: 'img', props: { src: qrUri, width: 238, height: 238, style: { width: 238, height: 238 } } }),
    div({ fontSize: 14, fontWeight: 700, color: C.black, marginTop: 14, alignSelf: 'center' }, 'griffincreativelab.com/starter-kit.html'),
    div({ fontSize: 13, color: C.gray, marginTop: 3, alignSelf: 'center' }, 'Just a name and email. No card.'),
    div({ flexGrow: 1 }, ''),
    div({ flexDirection: 'column', borderTop: `2px solid ${C.rule}`, paddingTop: 14 }, [
      div({ fontSize: 14, color: C.ink, lineHeight: 1.35 }, "We're a marketing agency that works with outfitters in the West. These guides are part of what we do for our clients."),
      div({ fontSize: 14, fontWeight: 700, color: C.black, marginTop: 12 }, 'Gabriel Wigginton'),
      div({ fontSize: 14, color: C.ink, marginTop: 2 }, '(503) 779-8493'),
      div({ fontSize: 14, color: C.ink, marginTop: 2 }, 'hello@griffincreativelab.com'),
      div({ fontSize: 12, color: C.light, marginTop: 8 }, 'Griffin Creative Labs, Sublimity, Oregon'),
    ]),
  ]);
}

function cover() {
  return panel(PW[2], [
    logo(26),
    div({ flexDirection: 'column', marginTop: 84 }, [
      div({ fontFamily: 'DIN', fontSize: 68, lineHeight: 1, color: C.black, whiteSpace: 'nowrap' }, 'FIVE FREE'),
      div({ fontFamily: 'DIN', fontSize: 68, lineHeight: 1, color: C.black, whiteSpace: 'nowrap' }, 'MARKETING'),
      div({ fontFamily: 'DIN', fontSize: 68, lineHeight: 1, color: C.black, whiteSpace: 'nowrap' }, 'GUIDES FOR'),
      div({ fontFamily: 'DIN', fontSize: 68, lineHeight: 1, color: C.orange, whiteSpace: 'nowrap' }, 'OUTFITTERS.'),
    ]),
    div({ fontSize: 18, color: C.ink, lineHeight: 1.35, marginTop: 24, width: 290 }, 'Step by step, with copy-and-paste templates. Start with any one.'),
    div({ flexGrow: 1 }, ''),
    div({ backgroundColor: C.orange, padding: '12px 16px', alignItems: 'center', justifyContent: 'center' },
      div({ fontFamily: 'DIN', fontSize: 30, letterSpacing: 2, color: '#ffffff' }, 'OPEN TO SEE ALL FIVE')),
  ]);
}

// ---------- inside ----------
function insideA() { return panel(PW[0], [guide(1), guide(2)]); }
function insideB() { return panel(PW[1], [guide(3), guide(4)]); }
function insideC() {
  return panel(PW[2], [
    guide(5),
    div({ flexGrow: 1 }, ''),
    div({ flexDirection: 'column', backgroundColor: C.wash, border: `3px solid ${C.orange}`, padding: '16px 18px' }, [
      div({ fontFamily: 'DIN', fontSize: 34, lineHeight: 1, color: C.black, letterSpacing: 1 }, 'WANT IT DONE FOR YOU?'),
      div({ fontSize: 14, color: C.ink, lineHeight: 1.35, marginTop: 8 },
        'We set up and run your Google profile, ask your past hunters for reviews, email them at the right times so they rebook, and more. Everything stays yours.'),
      div({ fontSize: 15, fontWeight: 700, color: C.black, marginTop: 10 }, 'Call or text Gabriel: (503) 779-8493'),
    ]),
  ]);
}

const sheet = (panels) => div({ width: W, height: H, padding: 25, backgroundColor: '#ffffff', fontFamily: 'Lato' },
  div({ width: W - 50, height: PH, flexDirection: 'row', backgroundColor: C.bg }, panels));

// Minimal multi-page PDF (US Letter landscape), one JPEG per page.
function pdfFromJpegs(jpegs, wPx, hPx, pw = 792, ph = 612) {
  const n = jpegs.length;
  const objs = [];
  objs.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1'));
  objs.push(Buffer.from(`<< /Type /Pages /Kids [${jpegs.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${n} >>`, 'latin1'));
  jpegs.forEach((jpeg, i) => {
    const pageNo = 3 + 3 * i, imgNo = 4 + 3 * i, contNo = 5 + 3 * i;
    objs.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${imgNo} 0 R >> >> /Contents ${contNo} 0 R >>`, 'latin1'));
    objs.push(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, 'latin1'),
      jpeg,
      Buffer.from('\nendstream', 'latin1'),
    ]));
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    objs.push(Buffer.from(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`, 'latin1'));
    void pageNo; void contNo;
  });
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
  const pages = [
    ['outside', sheet([flap(), back(qrUri), cover()])],
    ['inside', sheet([insideA(), insideB(), insideC()])],
  ];
  const jpegs = [];
  let meta;
  for (const [name, tree] of pages) {
    const svg = await satori(tree, { width: W, height: H, fonts });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: W * 3 } }).render().asPng();
    fs.writeFileSync(`${OUT}-${name}.png`, png);
    meta = await sharp(png).metadata();
    jpegs.push(await sharp(png).flatten({ background: '#ffffff' }).jpeg({ quality: 95 }).toBuffer());
    console.log('wrote', path.relative(process.cwd(), `${OUT}-${name}.png`), `${meta.width}x${meta.height}`);
  }
  fs.writeFileSync(OUT + '.pdf', pdfFromJpegs(jpegs, meta.width, meta.height));
  console.log('wrote', path.relative(process.cwd(), OUT + '.pdf'));
})().catch((e) => { console.error(e); process.exit(1); });
