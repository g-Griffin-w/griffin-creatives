#!/usr/bin/env node
// scripts/make-gbp-logo.js
//
// Outfitter-style round badge: antlers over a skull, ring, arched tagline.
//   gbp-images/logo.png              720x720, black square (Google crops it to a circle)
//   gbp-images/logo-transparent.png  2000x2000, badge only
//   gbp-images/logo.svg              vector, text outlines not included (needs DIN Condensed)

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.join(__dirname, '..', 'gbp-images');
const DIN = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf';
const ORANGE = '#ff4d00';
const CREAM = '#f0ece3';
const BLACK = '#080808';

// One antler (left side); the right is mirrored around x=500. Every beam and
// tine is a filled shape that tapers to a sharp point.
const cubic = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
};
const sample = (seg, n = 24) => Array.from({ length: n + 1 }, (_, i) => cubic(...seg, i / n));
function taper(pts, w0, w1) {
  const L = [];
  const R = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const t = i / (pts.length - 1);
    const w = (w0 + (w1 - w0) * Math.pow(t, 1.15)) / 2;
    L.push([p[0] + nx * w, p[1] + ny * w]);
    R.push([p[0] - nx * w, p[1] - ny * w]);
  });
  const f = (q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  return `M ${f(L[0])} ` + L.slice(1).map((q) => `L ${f(q)}`).join(' ') + ' ' + R.reverse().map((q) => `L ${f(q)}`).join(' ') + ' Z';
}
const BEAM = [
  [[468, 590], [395, 578], [300, 540], [262, 430]],
  [[262, 430], [236, 355], [246, 270], [296, 190]],
];
const TINES = [
  [[[436, 578], [396, 530], [384, 468], [408, 404]], 24],
  [[[376, 560], [334, 508], [322, 448], [346, 384]], 26],
  [[[312, 522], [266, 470], [254, 410], [278, 346]], 26],
  [[[268, 436], [220, 398], [204, 340], [226, 280]], 24],
  [[[296, 190], [270, 162], [262, 128], [284, 92]], 22],
  [[[296, 190], [312, 164], [332, 148], [362, 138]], 18],
];
const antler = () =>
  `<path d="${taper([...sample(BEAM[0]), ...sample(BEAM[1]).slice(1)], 50, 5)}"/>` +
  TINES.map(([seg, w]) => `<path d="${taper(sample(seg), w, 0)}"/>`).join('');

// Realistic elk skull, front-on: broad brow with coronets, deep orbits with raised
// rims, a nasal bridge into a long muzzle. Shaded with a bone gradient and a
// lighting filter (blurred alpha as height + noise grain) so it reads as carved
// relief, not flat shapes. Antlers get the same filter with a tan-to-ivory ramp.
const SK = {
  half: 'M 500 556 C 520 553, 546 557, 561 570 C 582 590, 586 620, 576 644 C 569 663, 557 677, 551 700 C 547 726, 549 752, 539 778 C 533 794, 518 802, 500 802',
};
const skullHalf = (d) => `<path d="${d} L 500 556 Z"/>`;
const mir = (inner) => `<g transform="translate(1000,0) scale(-1,1)">${inner}</g>`;
const cav = (d) => `<path d="${d}" fill="url(#cavity)" stroke="#d8ceb6" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/>`;
const ORBIT = 'M 524 598 C 534 584, 556 588, 564 606 C 570 622, 560 640, 545 642 C 530 642, 518 628, 520 612 C 520 606, 521 602, 524 598 Z';
const NOSE = 'M 500 692 C 515 692, 524 714, 522 744 C 520 766, 510 780, 500 780 C 490 780, 480 766, 478 744 C 476 714, 485 692, 500 692 Z';
const both = (inner) => inner + mir(inner);
const skull = () => `
  <g filter="url(#bone)" fill="url(#boneGrad)">
    ${skullHalf(SK.half)}${mir(skullHalf(SK.half))}
    <ellipse cx="452" cy="573" rx="22" ry="15" transform="rotate(-20 452 573)"/>
    <ellipse cx="548" cy="573" rx="22" ry="15" transform="rotate(20 548 573)"/>
  </g>
  ${both(cav(ORBIT))}
  ${both('<path d="M 520 590 C 534 574, 560 578, 570 600" fill="none" stroke="#fff6e0" stroke-width="4" stroke-linecap="round" opacity="0.55"/>')}
  ${cav(NOSE)}
  <g fill="none" stroke="#1b1710" stroke-linecap="round">
    <path d="M 500 566 L 500 708" stroke-width="2.4" opacity="0.65"/>
    ${both('<path d="M 518 640 C 516 664, 508 688, 505 708" stroke-width="2.6" opacity="0.7"/>')}
    ${both('<path d="M 556 650 C 556 672, 548 690, 541 706" stroke-width="3" opacity="0.6"/>')}
    ${both('<path d="M 520 590 C 516 576, 510 568, 504 562" stroke-width="2.2" opacity="0.5"/>')}
    ${both('<path d="M 523 790 L 524 780 M 512 797 L 513 785" stroke-width="2.4" opacity="0.7"/>')}
  </g>
  ${both('<ellipse cx="546" cy="690" rx="4" ry="6" fill="#1b1710" opacity="0.85"/>')}`;

// Centerpiece: a realistic elk image dropped in as gbp-images/elk-emblem.png
// (cream with luminance as alpha, 161:200 portrait) wins; otherwise the drawn vector elk is used.
const EMBLEM = path.join(OUT, 'elk-emblem.png');
// The photo is split in two so the antlers can be bigger and the skull smaller:
// each layer scales about the join point J (where the antlers meet the skull).
const J = [500, 508];
const ANTLER_SCALE = 1.2;
const SKULL_SCALE = 0.88;
const DROP = 46; // moves the whole piece down so the tips clear the arc text
const SKULL_BOX = 'M 436 496 H 565 V 1000 H 436 Z';
const scaleAbout = (k) => `translate(0 ${DROP}) translate(${J[0]} ${J[1]}) scale(${k}) translate(${-J[0]} ${-J[1]})`;
const art = () => {
  if (!fs.existsSync(EMBLEM)) return '';
  const img = `<image href="data:image/png;base64,${fs.readFileSync(EMBLEM).toString('base64')}" x="252" y="140" width="496" height="600" preserveAspectRatio="xMidYMid meet"/>`;
  return `<defs>
    <clipPath id="antC"><path clip-rule="evenodd" d="M 0 0 H 1000 V 1000 H 0 Z ${SKULL_BOX}"/></clipPath>
    <clipPath id="skC"><path d="${SKULL_BOX}"/></clipPath>
  </defs>
  <g transform="${scaleAbout(ANTLER_SCALE)}"><g clip-path="url(#antC)">${img}</g></g>
  <g transform="${scaleAbout(SKULL_SCALE)}"><g clip-path="url(#skC)">${img}</g></g>`;
};

function badgeSvg({ size, background }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000">
  ${background ? `<rect width="1000" height="1000" fill="${BLACK}"/>` : ''}
  <circle cx="500" cy="500" r="478" fill="${BLACK}" stroke="${ORANGE}" stroke-width="16"/>
  <circle cx="500" cy="500" r="446" fill="none" stroke="${CREAM}" stroke-width="3"/>
  <defs>
    <linearGradient id="boneGrad" gradientUnits="userSpaceOnUse" x1="418" y1="0" x2="582" y2="0">
      <stop offset="0" stop-color="#7a7060"/><stop offset="0.22" stop-color="#c4b99f"/>
      <stop offset="0.5" stop-color="#efe8d4"/><stop offset="0.78" stop-color="#c4b99f"/><stop offset="1" stop-color="#7a7060"/>
    </linearGradient>
    <linearGradient id="antlerGrad" gradientUnits="userSpaceOnUse" x1="0" y1="90" x2="0" y2="600">
      <stop offset="0" stop-color="#f3ecd8"/><stop offset="0.55" stop-color="#cdbf9f"/><stop offset="1" stop-color="#8f7d58"/>
    </linearGradient>
    <radialGradient id="cavity" cx="0.5" cy="0.5" r="0.6">
      <stop offset="0" stop-color="#050504"/><stop offset="0.7" stop-color="#0d0b08"/><stop offset="1" stop-color="#2a241a"/>
    </radialGradient>
    <filter id="bone" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.07 0.03" numOctaves="4" seed="7" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="noiseA"/>
      <feComposite in="blur" in2="noiseA" operator="arithmetic" k1="0" k2="1" k3="0.3" k4="0" result="height"/>
      <feDiffuseLighting in="height" surfaceScale="8" diffuseConstant="1.15" lighting-color="#ffffff" result="light"><feDistantLight azimuth="235" elevation="52"/></feDiffuseLighting>
      <feComposite in="SourceGraphic" in2="light" operator="arithmetic" k1="1.45" k2="0" k3="0" k4="0" result="lit"/>
      <feComposite in="lit" in2="SourceAlpha" operator="in"/>
    </filter>
    <path id="top" d="M 102 500 A 398 398 0 0 1 898 500"/>
    <path id="bot" d="M 102 500 A 398 398 0 0 0 898 500"/>
  </defs>
  ${art()}
  <text font-family="DIN Condensed" font-weight="bold" font-size="46" letter-spacing="9" fill="${ORANGE}" text-anchor="middle">
    <textPath href="#top" startOffset="50%">MARKETING FOR OUTFITTERS</textPath>
  </text>
  <text x="500" y="842" font-family="DIN Condensed" font-weight="bold" font-size="124" letter-spacing="6" fill="${CREAM}" text-anchor="middle">GRIFFIN</text>
  <text x="500" y="894" font-family="DIN Condensed" font-weight="bold" font-size="46" letter-spacing="9" fill="${ORANGE}" text-anchor="middle">CREATIVE LABS</text>
</svg>`;
}

const png = (svg, size) =>
  new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { fontFiles: [DIN], loadSystemFonts: false, defaultFontFamily: 'DIN Condensed' },
  })
    .render()
    .asPng();

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'logo.svg'), badgeSvg({ size: 1000, background: false }));
fs.writeFileSync(path.join(OUT, 'logo.png'), png(badgeSvg({ size: 720, background: true }), 720));
fs.writeFileSync(path.join(OUT, 'logo-transparent.png'), png(badgeSvg({ size: 2000, background: false }), 2000));
console.log('wrote gbp-images/logo.png, logo-transparent.png, logo.svg');
