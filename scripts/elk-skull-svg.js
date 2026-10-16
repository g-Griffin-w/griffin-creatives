// scripts/elk-skull-svg.js
//
// Procedural elk skull + antlers, drawn as SVG, used as a faint backdrop on
// content slides (1080x1350). No external assets. Antlers are tapered branching
// strokes (main beam + five tines per side, crowned tip); skull is a front-on
// silhouette with eye sockets and nasal opening cut out.
//
//   const svg = skullSvg({ color: '#f0ece3', opacity: 0.12, bg: '#080808' });

const W = 1080;
const H = 1350;

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

// A stroked tapered curve: many short segments with shrinking stroke width.
function taper(points, w0, w1, flip) {
  const out = [];
  const n = points.length - 1;
  for (let i = 0; i < n; i++) {
    const w = w0 + (w1 - w0) * (i / Math.max(1, n - 1));
    const a = points[i];
    const b = points[i + 1];
    const x1 = flip ? W - a[0] : a[0];
    const x2 = flip ? W - b[0] : b[0];
    out.push(
      `<line x1="${x1.toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${x2.toFixed(1)}" y2="${b[1].toFixed(1)}" stroke-width="${w.toFixed(1)}"/>`
    );
  }
  return out.join('');
}

function quadPoints(p0, c, p1, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return pts;
}

function antler(flip) {
  // Main beam: sweeps out from the pedicle, then curves up and back in.
  const seg1 = [[598, 655], [745, 660], [935, 565], [985, 330]];
  const seg2 = [[985, 330], [1010, 225], [995, 140], [915, 62]];
  const beam = [];
  for (let i = 0; i <= 36; i++) beam.push(bez(...seg1, i / 36));
  for (let i = 1; i <= 26; i++) beam.push(bez(...seg2, i / 26));
  let g = taper(beam, 60, 20, flip);

  // Tines leave the beam upward/inward at spaced fractions of seg1/seg2.
  const tine = (p, dx, dy, bend, w0) => {
    const tip = [p[0] + dx, p[1] + dy];
    const ctrl = [p[0] + dx * 0.15 + bend, p[1] + dy * 0.6];
    g += taper(quadPoints(p, ctrl, tip, 14), w0, 5, flip);
  };
  tine(bez(...seg1, 0.04), 46, -300, -10, 34); // brow
  tine(bez(...seg1, 0.18), 30, -330, 8, 32); // bez
  tine(bez(...seg1, 0.42), 4, -340, 14, 30); // trez
  tine(bez(...seg1, 0.70), -30, -300, 14, 28); // royal
  tine(bez(...seg2, 0.30), -70, -150, -12, 24); // sur-royal
  // Crown: the beam tip forks.
  tine(bez(...seg2, 0.78), -70, -50, 10, 20);
  tine(bez(...seg2, 0.55), -46, -96, -4, 20);
  return g;
}

function skullSvg({ color = '#f0ece3', opacity = 0.12, bg = '#080808' } = {}) {
  const left = antler(true);
  const right = antler(false);
  const skull = `
    <path d="M452 712 C432 640 492 600 540 600 C588 600 648 640 628 712 C640 770 632 815 612 850 L468 850 C448 815 440 770 452 712 Z" fill="${color}" stroke="none"/>
    <path d="M472 850 C456 970 478 1135 498 1255 C516 1298 564 1298 582 1255 C602 1135 624 970 608 850 Z" fill="${color}" stroke="none"/>
    <path d="M452 760 C400 790 392 880 438 930 C452 944 466 900 470 850 Z" fill="${color}" stroke="none"/>
    <path d="M628 760 C680 790 688 880 642 930 C628 944 614 900 610 850 Z" fill="${color}" stroke="none"/>
    <circle cx="494" cy="636" r="42" fill="${color}" stroke="none"/>
    <circle cx="586" cy="636" r="42" fill="${color}" stroke="none"/>
    <path d="M440 738 C470 716 504 716 522 740" stroke="${bg}" stroke-width="7" fill="none"/>
    <path d="M640 738 C610 716 576 716 558 740" stroke="${bg}" stroke-width="7" fill="none"/>
    <ellipse cx="488" cy="772" rx="38" ry="30" fill="${bg}" stroke="none"/>
    <ellipse cx="592" cy="772" rx="38" ry="30" fill="${bg}" stroke="none"/>
    <path d="M520 866 C506 940 512 1040 526 1120" stroke="${bg}" stroke-width="5" fill="none"/>
    <path d="M560 866 C574 940 568 1040 554 1120" stroke="${bg}" stroke-width="5" fill="none"/>
    <path d="M540 640 L540 840" stroke="${bg}" stroke-width="5" fill="none"/>
    <ellipse cx="540" cy="1236" rx="38" ry="28" fill="${bg}" stroke="none"/>
    <path d="M500 1180 C520 1160 560 1160 580 1180" stroke="${bg}" stroke-width="5" fill="none"/>
  `;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<g opacity="${opacity}"><g stroke="${color}" stroke-linecap="round" fill="none">${left}${right}</g>${skull}</g>` +
    `</svg>`
  );
}

module.exports = { skullSvg, W, H };
