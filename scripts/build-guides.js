#!/usr/bin/env node
// scripts/build-guides.js
//
// Generates the four DIY lead-magnet guide pages (+ an index) into guides/*.html.
// Static output, no serverless functions. Run:  node scripts/build-guides.js
//
// Why a generator: the site's Vercel build only ships *.html (see vercel.json),
// so an external stylesheet/script wouldn't deploy. Each page inlines the shared
// CSS/JS instead, and this script keeps them from drifting.
//
// Edit guide content HERE, then re-run. guides/*.md are the plain-text drafts.
//
// The "screens" in the walkthroughs are simplified illustrations, not Google
// screenshots — they're captioned that way on purpose. Swap in real screenshots
// by replacing a <figure>'s inner HTML with an <img>.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'guides');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- shared pieces ----------
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--black:#080808;--white:#f0ece3;--orange:#ff4d00;--gray:#a8a8a8;--card:#111;--card2:#171717;--border:#262626;--ok:#3ecf8e;--bad:#ff6b6b}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{font-family:'DM Sans',sans-serif;background:var(--black);color:var(--white);font-size:18px;line-height:1.7;overflow-x:hidden}
a{color:var(--orange)}
nav{position:sticky;top:0;z-index:50;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;background:rgba(8,8,8,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.logo{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.04em;text-decoration:none;color:var(--white)}
.logo span{color:var(--orange)}
.nav-r{font-size:13px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;color:var(--gray)}
.wrap{max-width:760px;margin:0 auto;padding:0 24px}
.hero{padding-block:64px 40px;position:relative}
.hero::before{content:'';position:absolute;inset:-40px 0 0;background:radial-gradient(ellipse 60% 60% at 40% 30%,rgba(255,77,0,.08),transparent 70%);pointer-events:none}
.tag{font-family:'DM Mono',monospace;font-size:12px;color:var(--orange);letter-spacing:.12em;text-transform:uppercase;display:block;margin-bottom:14px;position:relative}
h1{font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:clamp(48px,9vw,84px);line-height:.98;letter-spacing:.02em;margin-bottom:20px;position:relative}
h1 em{font-style:normal;color:var(--orange)}
.lede{font-size:20px;color:#d6d2c9;max-width:620px;position:relative}
.pills{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px;position:relative}
.pill{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gray);border:1px solid var(--border);padding:7px 12px;border-radius:2px;background:var(--card)}
.pill b{color:var(--white);font-weight:500}
h2{font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:clamp(32px,6vw,44px);letter-spacing:.03em;line-height:1.05;margin:56px 0 14px}
h2 .n{color:var(--orange)}
h3{font-size:19px;font-weight:600;margin:28px 0 8px}
p{margin:0 0 16px;color:#dcd8cf}
ul,ol{margin:0 0 18px 22px;color:#dcd8cf}
li{margin-bottom:8px}
.why{background:var(--card);border:1px solid var(--border);border-left:3px solid var(--orange);padding:26px 28px;margin:8px 0 8px}
.why p:last-child{margin-bottom:0}
.toc{background:var(--card);border:1px solid var(--border);padding:22px 26px;margin:36px 0 0}
.toc .tag{margin-bottom:10px}
.toc ol{margin:0 0 0 20px}
.toc a{color:var(--white);text-decoration:none;border-bottom:1px solid var(--border)}
.toc a:hover{border-color:var(--orange)}
.step{margin-top:60px;scroll-margin-top:80px}
.step-h{display:flex;gap:16px;align-items:center;margin-bottom:14px}
.num{flex:none;width:46px;height:46px;border:2px solid var(--orange);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--orange);line-height:1}
.step-h h2{margin:0}
.callout{border-left:3px solid var(--orange);background:var(--card);padding:16px 20px;margin:18px 0;color:#dcd8cf}
.callout.warn{border-color:var(--bad)}
.callout.ok{border-color:var(--ok)}
.callout b.k{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;display:block;margin-bottom:4px;color:var(--orange)}
.callout.warn b.k{color:var(--bad)} .callout.ok b.k{color:var(--ok)}
.tpl{background:var(--card2);border:1px solid var(--border);margin:18px 0}
.tpl-h{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border);font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)}
.tpl-h button{font:inherit;color:#fff;background:var(--orange);border:0;padding:7px 14px;border-radius:2px;cursor:pointer;letter-spacing:.08em}
.tpl-h button:active{opacity:.8}
.tpl-b{padding:18px 20px;white-space:pre-wrap;font-size:16.5px;color:#ece8df}
.tpl-b .subj{display:block;font-weight:600;margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed var(--border)}
figure.vis{margin:26px 0;background:#0d0d0d;border:1px solid var(--border);border-radius:6px;padding:18px;overflow-x:auto}
figure.vis figcaption{font-size:13.5px;color:var(--gray);margin-top:14px;font-family:'DM Mono',monospace;letter-spacing:.02em}
.screen{background:#fff;color:#202124;border-radius:8px;padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;max-width:560px;margin:0 auto}
.screen .s-search{border:1px solid #dadce0;border-radius:24px;padding:10px 16px;color:#3c4043;margin-bottom:12px}
.screen .s-card{border:1px solid #dadce0;border-radius:8px;padding:14px}
.screen .s-title{font-size:18px;font-weight:600;color:#1a0dab}
.screen .s-sub{color:#5f6368;font-size:14px}
.screen .s-stars{color:#e8710a;margin:2px 0 8px}.screen .s-stars span{color:#5f6368}
.screen .s-links{display:flex;gap:8px;flex-wrap:wrap}
.screen .s-links span{border:1px solid #dadce0;border-radius:16px;padding:5px 12px;font-size:14px;color:#1a73e8}
.screen .s-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:6px 0 14px;border-bottom:1px solid #e8eaed;margin-bottom:12px}
.screen .s-label{font-size:12.5px;letter-spacing:.04em;text-transform:uppercase;color:#5f6368;margin-bottom:8px;font-weight:600}
.screen .s-chips{display:flex;flex-wrap:wrap;gap:8px}
.screen .s-chips span{background:#e8f0fe;color:#174ea6;border-radius:16px;padding:5px 12px;font-size:14px}
.screen .s-chips .add{background:#fff;border:1px dashed #9aa0a6;color:#5f6368}
.toggle{width:44px;height:24px;border-radius:12px;background:#9aa0a6;position:relative;flex:none}
.toggle i{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff}
.toggle.on{background:#1a73e8}.toggle.on i{left:23px}
.s-result{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #eee}
.s-result:last-child{border:0}
.s-result b{color:#1a0dab;font-weight:600}
.s-textarea{border:1px solid #dadce0;border-radius:6px;padding:12px;color:#3c4043;min-height:92px}
.s-count{text-align:right;color:#5f6368;font-size:13px;margin-top:6px}
.s-btn{display:inline-block;background:#1a73e8;color:#fff;border-radius:4px;padding:9px 16px;font-weight:600}
.s-link{margin-top:12px;border:1px solid #dadce0;border-radius:6px;padding:10px 12px;color:#1a73e8;word-break:break-all}
.hl{outline:3px solid var(--orange);outline-offset:3px;border-radius:4px}
.note{color:var(--orange);font-family:'DM Mono',monospace;font-size:13px;margin-top:12px;text-align:center}
.shots{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.shot{aspect-ratio:1;background:linear-gradient(145deg,#1b1b1b,#101010);border:1px solid var(--border);border-radius:4px;padding:10px;display:flex;flex-direction:column;justify-content:space-between;font-size:13px;line-height:1.3}
.shot b{font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:26px;color:var(--orange);line-height:1}
.shot span{color:#d6d2c9}
.cardprint{background:#f5f1e8;color:#1b1b1b;max-width:300px;margin:0 auto;border-radius:6px;padding:20px;text-align:center;font-family:Arial,Helvetica,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.cardprint h4{font-size:18px;margin-bottom:6px}.cardprint p{color:#333;font-size:14px;margin:0 0 12px}.cardprint small{color:#555;font-size:12px}
.phone{background:#e9eef5;color:#111;max-width:340px;margin:0 auto;border-radius:22px;padding:18px 14px;font-family:Arial,Helvetica,sans-serif;font-size:15.5px;line-height:1.4;border:6px solid #1c1c1c}
.phone .bubble{background:#2f80ed;color:#fff;border-radius:18px 18px 4px 18px;padding:12px 14px;margin-left:34px}
.phone .meta{color:#666;font-size:12px;text-align:center;margin-bottom:10px}
.tbl{width:100%;border-collapse:collapse;font-size:15px;min-width:460px}
.tbl th,.tbl td{border:1px solid var(--border);padding:10px 12px;text-align:left}
.tbl th{background:var(--card2);font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gray)}
.tbl td input{width:100%;background:#0d0d0d;border:1px solid var(--border);color:var(--white);padding:8px 10px;font:inherit;border-radius:2px}
.tbl td input:focus{outline:none;border-color:var(--orange)}
.year{min-width:640px;display:grid;grid-template-columns:repeat(12,1fr);gap:4px;font-size:13px}
.year .m{text-align:center;font-family:'DM Mono',monospace;font-size:11.5px;color:var(--gray);padding-bottom:4px;letter-spacing:.06em}
.year .band{padding:10px 8px;border-radius:3px;font-size:13px;line-height:1.3;color:#fff;font-weight:600}
.b1{background:#7a3b10}.b2{background:#8a5a00}.b3{background:#b83c00}.b4{background:#5b4a99}.b5{background:#1f6f54}
.phases{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.phase{background:var(--card2);border:1px solid var(--border);padding:16px 18px;border-radius:4px}
.phase b{display:block;font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:24px;letter-spacing:.04em;color:var(--orange)}
.phase p{margin:4px 0 0;font-size:16px}
.line{display:flex;gap:0;flex-wrap:wrap;margin:6px 0}
.line div{flex:1 1 150px;border-top:3px solid var(--orange);padding:12px 12px 0 0;font-size:15px;line-height:1.4}
.line b{display:block;font-family:'DM Mono',monospace;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray);margin-bottom:4px;font-weight:500}
.mist li{list-style:none;position:relative;padding-left:30px}
.mist{margin-left:0}
.mist li::before{content:'✕';position:absolute;left:0;color:var(--bad);font-weight:700}
.check{background:var(--card);border:1px solid var(--border);padding:26px 28px;margin-top:56px}
.check .bar{height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin:12px 0 18px}
.check .bar i{display:block;height:100%;width:0;background:var(--orange);transition:width .25s}
.chk{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer}
.chk:last-child{border:0}
.chk input{margin-top:6px;width:20px;height:20px;accent-color:var(--orange);flex:none}
.cta{margin:56px 0 0;background:linear-gradient(145deg,#1a0b04,#111);border:1px solid #3a1d0c;padding:34px 30px}
.cta h2{margin:0 0 8px}
.cta p{color:#e3ded4}
.btn{display:inline-block;background:var(--orange);color:#fff;text-decoration:none;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:15px;padding:15px 28px;border-radius:2px;margin-top:6px}
.btn.ghost{background:transparent;border:1px solid var(--border);color:var(--white)}
.pn{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:36px 0 0}
.pn a{color:var(--white);text-decoration:none;border:1px solid var(--border);padding:12px 16px;border-radius:2px;font-size:15px;background:var(--card)}
.pn a:hover{border-color:var(--orange)}
footer{border-top:1px solid var(--border);margin-top:72px;padding:36px 24px;text-align:center;color:#4a4a4a;font-size:14px}
.cards{display:grid;gap:16px;margin-top:28px}
.gc{display:block;background:var(--card);border:1px solid var(--border);padding:24px 26px;text-decoration:none;color:var(--white);border-radius:2px;transition:border-color .2s}
.gc:hover{border-color:var(--orange)}
.gc .tag{margin-bottom:6px}
.gc h3{font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:32px;letter-spacing:.03em;margin:0 0 6px}
.gc p{margin:0;color:var(--gray);font-size:16.5px}
@media(max-width:640px){
 body{font-size:17px}
 .hero{padding-block:44px 28px}
 .shots{grid-template-columns:repeat(2,1fr)}
 .phases{grid-template-columns:1fr}
 .why,.check,.cta{padding:22px 20px}
 .step-h{gap:12px}
 .num{width:40px;height:40px;font-size:23px}
}
@media print{nav,.cta,.pn,footer,.tpl-h button{display:none}body{background:#fff;color:#000}p,li,.tpl-b{color:#000}}
`;

const JS = `
// Warm-lead signal: when a guide is opened from an email link (?lead=<id> or
// ?s=<signup uuid>), log one view. Insert-only via the public anon key; the
// guide_engagement view reads it back server-side. Anonymous visits log nothing.
(function(){
  try {
    var q = new URLSearchParams(location.search);
    var lead = q.get('lead'), sid = q.get('s');
    var body = { guide: document.body.getAttribute('data-guide') };
    if (lead && /^[0-9]{1,12}$/.test(lead)) body.lead_id = Number(lead);
    else if (sid && /^[0-9a-f-]{36}$/i.test(sid)) body.signup_id = sid;
    else return;
    var SB = 'https://gcatvqcntgizjsdoabva.supabase.co';
    var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjYXR2cWNudGdpempzZG9hYnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDIwNTIsImV4cCI6MjA5NDAxODA1Mn0.MvEWq_fB7UxfdSECOou5nnxG5y5qQ9LcYCeB_aXVJW4';
    fetch(SB + '/rest/v1/guide_views', {
      method: 'POST', keepalive: true,
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body)
    }).catch(function(){});
  } catch (e) {}
})();
(function(){
  var KEY = 'gc-guide-' + document.body.getAttribute('data-guide');
  function load(){ try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(e){ return {}; } }
  function save(s){ try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} }
  var state = load();
  var boxes = document.querySelectorAll('.check input[type=checkbox]');
  var bar = document.querySelector('.check .bar i');
  var cnt = document.querySelector('.check .cnt');
  function paint(){
    var done = 0;
    boxes.forEach(function(b){ if (b.checked) done++; });
    if (bar) bar.style.width = boxes.length ? (done / boxes.length * 100) + '%' : '0';
    if (cnt) cnt.textContent = done + ' of ' + boxes.length + ' done';
  }
  boxes.forEach(function(b, i){
    b.checked = !!state['c' + i];
    b.addEventListener('change', function(){ state['c' + i] = b.checked; save(state); paint(); });
  });
  paint();
  document.querySelectorAll('input[data-save]').forEach(function(inp){
    inp.value = state['f_' + inp.getAttribute('data-save')] || '';
    inp.addEventListener('input', function(){ state['f_' + inp.getAttribute('data-save')] = inp.value; save(state); });
  });
  document.querySelectorAll('button[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var el = document.getElementById(btn.getAttribute('data-copy'));
      var text = el.innerText.replace(/\\n{3,}/g, '\\n\\n').trim();
      function done(){ btn.textContent = 'Copied'; setTimeout(function(){ btn.textContent = 'Copy'; }, 1800); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else { fallback(); }
      function fallback(){
        var r = document.createRange(); r.selectNodeContents(el);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        try { document.execCommand('copy'); } catch(e){}
        s.removeAllRanges(); done();
      }
    });
  });
})();
`;

function shell({ slug, title, desc, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Griffin Creative</title>
<meta name="description" content="${esc(desc)}">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body data-guide="${slug}">
<nav>
  <a href="/index.html" class="logo">GRIFFIN<span>CREATIVE</span></a>
  <a href="/guides/index.html" class="nav-r">All 4 guides</a>
</nav>
${body}
<footer>Griffin Creative · griffincreativelab.com</footer>
<script>${JS}</script>
</body>
</html>
`;
}

// ---------- components ----------
let tplCount = 0;
const step = (n, title, html) =>
  `<section class="step" id="s${n}"><div class="step-h"><div class="num">${n}</div><h2>${title}</h2></div>${html}</section>`;
const tip = (html, kind = '', label = 'Tip') =>
  `<div class="callout ${kind}"><b class="k">${label}</b>${html}</div>`;
const warn = (html) => tip(html, 'warn', 'Watch out');
const rule = (html) => tip(html, 'ok', 'Rule');
const fig = (inner, caption, illustration = true) =>
  `<figure class="vis">${inner}<figcaption>${esc(caption)}${illustration ? ' Simplified illustration — your screen may look a little different.' : ''}</figcaption></figure>`;
function tpl(label, text) {
  const id = 't' + ++tplCount;
  return `<div class="tpl"><div class="tpl-h"><span>${esc(label)}</span><button type="button" data-copy="${id}">Copy</button></div><div class="tpl-b" id="${id}">${esc(text)}</div></div>`;
}
function emailTpl(label, subject, text) {
  const id = 't' + ++tplCount;
  return `<div class="tpl"><div class="tpl-h"><span>${esc(label)}</span><button type="button" data-copy="${id}">Copy</button></div><div class="tpl-b" id="${id}"><span class="subj">Subject: ${esc(subject)}</span>${esc(text)}</div></div>`;
}
const list = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const mist = (items) => `<ul class="mist">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const checklist = (items) =>
  `<section class="check"><span class="tag">// Check yourself</span><div class="cnt" style="font-family:'DM Mono',monospace;font-size:13px;color:var(--gray)"></div><div class="bar"><i></i></div>${items
    .map((i) => `<label class="chk"><input type="checkbox"><span>${i}</span></label>`)
    .join('')}</section>`;
const toc = (steps) =>
  `<div class="toc"><span class="tag">// What you'll do</span><ol>${steps
    .map((s, i) => `<li><a href="#s${i + 1}">${s}</a></li>`)
    .join('')}</ol></div>`;

// Order = the order the guides are emailed (see api/send-outreach.js,
// api/send-followups.js, api/send-starter-kit-drip.js). Rebooking first
// because it matches the cold email's hook about past clients.
const GUIDES = [
  { slug: 'rebooking-emails', num: 1, short: 'Rebooking Emails', time: '1 hour' },
  { slug: 'google-business-profile', num: 2, short: 'Google Business Profile', time: '45 min' },
  { slug: 'season-calendar', num: 3, short: 'Season Calendar', time: '30 min' },
  { slug: 'review-requests', num: 4, short: 'Reviews After Every Hunt', time: '20 min' },
];
const G = (slug) => GUIDES.find((x) => x.slug === slug);
function pager(slug) {
  const i = GUIDES.findIndex((x) => x.slug === slug);
  const p = GUIDES[i - 1], n = GUIDES[i + 1];
  return `<div class="pn">${p ? `<a href="/guides/${p.slug}.html">← Guide ${p.num}: ${p.short}</a>` : '<span></span>'}${
    n ? `<a href="/guides/${n.slug}.html">Guide ${n.num}: ${n.short} →</a>` : `<a href="/guides/index.html">All guides</a>`
  }</div>`;
}
const cta = () =>
  `<section class="cta"><span class="tag">// Rather not do this yourself?</span><h2>That's what <em style="font-style:normal;color:var(--orange)">Booked Out</em> is.</h2><p>Everything in this guide, done for you and kept running all season. We build it, we keep it fresh, and we send it on schedule while you're out guiding.</p><a class="btn" href="/index.html#pricing">See how Booked Out works</a></section>`;

function hero(g, title, lede, pills) {
  return `<header class="hero wrap"><span class="tag">// Free Guide ${g.num} of 4</span><h1>${title}</h1><p class="lede">${lede}</p><div class="pills">${pills
    .map(([k, v]) => `<span class="pill">${k}: <b>${v}</b></span>`)
    .join('')}</div></header>`;
}

// ============================================================
// GUIDE 1 — Google Business Profile
// ============================================================
function guide1() {
  const g = G('google-business-profile');
  const steps = [
    'Claim it (and check for duplicates)',
    'Use your real business name',
    'Verify',
    'Set a service area, not a storefront',
    'Pick your categories',
    'Write the description',
    'List each hunt as a service',
    'Add real photos',
    'Make your contact details match',
    'Keep it alive',
  ];
  const body = `
${hero(g, 'SET UP YOUR <em>GOOGLE BUSINESS PROFILE.</em>', 'The free listing that decides whether a hunter calls you or the outfitter next to you.', [['Time', '45 min + verification'], ['Cost', 'Free'], ['Do it', 'Once, then 10 min a month']])}
<main class="wrap">
<div class="why">
<p><b>Why this is the highest-leverage hour you'll spend.</b> A hunter planning a once-a-year trip doesn't call the first outfitter they hear about. They search. For a lot of local searches Google shows a map with three businesses above everything else, including your website, and those three listings get most of the calls.</p>
<p>In the 20 seconds a hunter spends on your listing, they're trying to answer five questions: <i>Is this a real operation? Where's camp? Who's guiding me? What does the country look like? Do guys actually kill elk here?</i> A filled-out profile answers all five before they click through.</p>
</div>
${toc(steps)}

${step(1, 'Claim it, and check for duplicates', `
<p>Search your business name on Google Maps. Then search your <b>old business names and your phone number</b>. Outfitters change names, add partners, and move, and it's common to find two or three stale listings for the same operation. Duplicates split your reviews and confuse Google about which one is real.</p>
${list(['If a listing exists, click <b>“Claim this business.”</b>', 'If you find duplicates, claim the real one, then use “Suggest an edit” to mark the others closed or duplicate.', 'If nothing exists, go to <b>business.google.com</b> and add it.'])}
${fig(`<div class="screen"><div class="s-search">Your Outfitter Name</div><div class="s-card"><div class="s-title">Your Outfitter Name</div><div class="s-sub">Your category · Your town</div><div class="s-stars">★★★★☆ <span>4.6 (23)</span></div><div class="s-links"><span>Website</span><span>Directions</span><span class="hl">Claim this business</span></div></div></div><div class="note">↑ Look for “Claim this business” on your own listing</div>`, "What you're looking for when you search your own name.")}
`)}

${step(2, 'Use your real business name', `
<p>Use the name that's on your sign and your website: <b>“Bear Paw Outfitters,”</b> not “Bear Paw Outfitters | Best Montana Elk Hunting Guide.”</p>
${warn('Stuffing keywords into the business name is against Google’s guidelines and is one of the most common reasons listings get suspended.')}
`)}

${step(3, 'Verify', `
<p>Google offers some mix of postcard, phone call, text, email, or video. Postcards can take a week or more and go to a physical address, so make sure someone actually opens the mail there.</p>
${tip('<b>Start verification first</b>, then finish the rest of this guide while you wait.')}
`)}

${step(4, 'Set a service area, not a storefront', `
<p>Hunters don't drive to your ranch to browse. You're a <b>service-area business</b>, which means you tell Google where you work instead of where you stand.</p>
${list(['<b>Hide your street address.</b> It matters if your camp is also your home.', 'Add the regions you actually hunt: counties, the national forest, unit areas. Not just your mailing-address town.'])}
${fig(`<div class="screen"><div class="s-row"><span>Show business address to customers</span><span class="toggle hl"><i></i></span></div><div class="s-label">Service areas</div><div class="s-chips"><span>Your county, MT</span><span>Your National Forest</span><span>Hunting unit area</span><span class="add">+ Add area</span></div></div><div class="note">↑ Address hidden, areas added</div>`, 'Address off, real hunting areas on.')}
`)}

${step(5, 'Pick your categories', `
<p>Open the primary category dropdown and search <b>“hunting,” “outfitter,”</b> and <b>“guide.”</b> Pick the closest match.</p>
<p>Then do the check most people skip: search <i>“elk hunting outfitter [your region]”</i> and see which category the top three results use. That's what Google is rewarding in your area.</p>
${fig(`<div class="screen"><div class="s-search">elk hunting outfitter [your region]</div><div class="s-result"><b>Outfitter One</b><span class="hl">Category: ________</span></div><div class="s-result"><b>Outfitter Two</b><span class="hl">Category: ________</span></div><div class="s-result"><b>Outfitter Three</b><span class="hl">Category: ________</span></div></div><div class="note">↑ Write down the category under each one</div>`, 'The category sits right under each business name.')}
${tip('Add secondary categories only if they’re true. If you also run fishing trips, add that. Don’t add things you don’t do.')}
`)}

${step(6, 'Write the description', `
<p>You get <b>750 characters</b>. Put the important details first, because the preview cuts off. Say what's included and what isn't. Hunters read that line twice.</p>
${tpl('Description template', "[Camp name] is a family-run elk outfitter guiding [fully guided / semi-guided] [archery and rifle] hunts in [region / units] since [year]. We hunt [public land / private ranch / wilderness] out of a [pack-in camp / lodge], with [number] hunters per week and [ratio] guides. Hunts include [lodging, meals, guide, pack-out, meat care]. Licenses, tags, and transport to camp are not included. Call or book online to reserve [year] dates.")}
${fig(`<div class="screen"><div class="s-label">Business description</div><div class="s-textarea">Your Outfitter is a family-run elk outfitter guiding fully guided archery and rifle hunts in your region since 20XX. <span class="hl">Hunts include lodging, meals, guide and meat care. Tags not included.</span></div><div class="s-count">412 / 750</div></div>`, 'Most important details first. Say what’s included and what isn’t.')}
`)}

${step(7, 'List each hunt as its own service', `
<p>Don't make one vague “Hunting” entry. Create a service for each real hunt with a name, a short description, and a price or “from $X.”</p>
${tpl('Service entry example', "5-Day Guided Archery Elk Hunt, September\nFully guided, [number] hunters per guide, pack-in camp. Includes meals, lodging, guide, and meat care. From $[price].")}
`)}

${step(8, 'Add real photos', `
<p>Hunters want to see what they're buying. Upload <b>15 to 20 real photos</b>. Use this shot list so you don't end up with 15 pictures of the same ridge:</p>
${fig(`<div class="shots">
<div class="shot"><b>1</b><span>Cover photo: the country with camp or horses in frame</span></div>
<div class="shot"><b>2</b><span>Camp: tents or cabins, and the kitchen</span></div>
<div class="shot"><b>3</b><span>Stock: horses or mules loaded and on the trail</span></div>
<div class="shot"><b>4</b><span>Your guides at work: glassing, calling</span></div>
<div class="shot"><b>5</b><span>The hunt: a dawn glassing shot, hunter and guide on a ridge</span></div>
<div class="shot"><b>6</b><span>Success shots: bull down with the hunter (get permission)</span></div>
<div class="shot"><b>7</b><span>Food and fire: the evening in camp</span></div>
<div class="shot"><b>8</b><span>The people: you, your guides, your wrangler</span></div>
</div>`, 'Eight shots to cover. Take a few of each.', false)}
${warn('No stock photos, ever. Hunters can tell, and Google rewards real, recent photos. Add a few new ones each month through the season.')}
`)}

${step(9, 'Make your contact details match', `
<p>Phone, website, and business name should read the <b>same way</b> on your profile, your website, Facebook, and anywhere else you're listed. If you're in the backcountry and can't pick up, say so in the description and set up a voicemail that promises a callback within a day.</p>
`)}

${step(10, 'Keep it alive', `
${list(['<b>Post</b> when you have openings, season updates, or a fresh photo. Two lines is fine.', '<b>Reply to every review</b> within a couple of days. (Guide 4 shows how.)', '<b>Update seasonal details</b> each January: dates, prices, availability.'])}
<p>A profile with recent activity looks alive to Google and to hunters. One that sat untouched for two years looks abandoned.</p>
<h3>The mistakes that cost outfitters the most</h3>
${mist(['Keyword-stuffed business name (suspension risk)', 'Leaving your home address visible', 'Claiming categories that aren’t true', 'Stock photos or brochure shots instead of real ones', 'Never replying to reviews', 'Phone numbers that differ between your site and your profile'])}
`)}

${checklist(['Duplicates searched and sorted out', 'Verified and showing as yours', 'Address hidden, service area set to where you actually hunt', 'Primary category checked against the top results', 'Description written with what’s included and what’s not', 'Each hunt listed as a service with a starting price', '15+ real photos across the shot list', 'Phone, website, and name match everywhere'])}
${cta()}
${pager('google-business-profile')}
</main>`;
  return shell({ slug: g.slug, title: 'Set Up Your Google Business Profile', desc: 'A step-by-step guide for elk outfitters: claim, fill out, and optimize your Google Business Profile so hunters find you first.', body });
}

// ============================================================
// GUIDE 2 — Review requests
// ============================================================
function qrSvg() {
  // Decorative placeholder only (NOT a scannable code) — seeded so output is stable.
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const N = 21, c = 6;
  let out = '';
  const finder = (x, y) => `<rect x="${x * c}" y="${y * c}" width="${7 * c}" height="${7 * c}" fill="#111"/><rect x="${(x + 1) * c}" y="${(y + 1) * c}" width="${5 * c}" height="${5 * c}" fill="#f5f1e8"/><rect x="${(x + 2) * c}" y="${(y + 2) * c}" width="${3 * c}" height="${3 * c}" fill="#111"/>`;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const inF = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
      if (!inF && rnd() > 0.5) out += `<rect x="${x * c}" y="${y * c}" width="${c}" height="${c}" fill="#111"/>`;
    }
  return `<svg viewBox="0 0 ${N * c} ${N * c}" width="120" height="120" role="img" aria-label="Example QR code placeholder">${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}${out}</svg>`;
}

function guide2() {
  const g = G('review-requests');
  const steps = [
    'Get your direct review link',
    'Turn it into a QR code',
    'Save the message',
    'Run it every hunt',
    'Follow the rules',
    'Reply to every review',
    'Track it',
  ];
  const body = `
${hero(g, 'ASK FOR <em>REVIEWS</em> AFTER EVERY HUNT.', 'Happy hunters rarely review on their own. Here is the two-minute habit that fixes that.', [['Setup', '20 min'], ['Per hunter', '2 min'], ['Cost', 'Free']])}
<main class="wrap">
<div class="why">
<p><b>Why reviews decide bookings.</b> Elk hunts are expensive, rare, and hard to undo. A hunter is trusting you with a week of leave, a license, and a lot of money, and they can't try you out first. So they look for proof that other hunters were treated well. They read your reviews, and they read your competitor's.</p>
<p>A hunter who had a great time almost never thinks to leave one. They get home, they're tired, the trip fades into a story. The reviews that show up unprompted tend to skew toward whoever was upset. <b>Asking is the only thing that fixes that.</b></p>
</div>
${tip('<b>What a good review looks like.</b> Not “great guys, 5 stars.” The ones that move a hunter off the fence mention specifics: the hunt type, the guide’s name, how camp was, what happened. “Jake put us on a bull by day two and packed it out himself” does more than ten generic reviews. The message below nudges toward specifics without scripting anything.', '', 'Good to know')}
${toc(steps)}

${step(1, 'Get your direct review link', `
<p>In your Google Business Profile dashboard, find <b>“Ask for reviews”</b> (Google sometimes calls it “Get more reviews”). It gives you a short link that opens your review box directly. Copy it, then <b>test it on your phone</b> so you know it lands where you expect.</p>
${fig(`<div class="screen"><div class="s-label">Your Business Profile</div><div class="s-btn hl">Ask for reviews</div><div class="s-link">https://g.page/r/your-short-link/review</div></div><div class="note">↑ Copy the short link Google gives you</div>`, 'Your short review link lives behind this button.')}
`)}

${step(2, 'Turn it into a QR code', `
<p>Paste the link into any free QR code generator and print the result on a card, a sticker, or a sign for the gear bag or the camp wall. Hand it over at drop-off while they're still happy.</p>
${fig(`<div class="cardprint"><h4>Enjoyed your hunt?</h4><p>Scan to leave a quick review. It helps other hunters find us.</p>${qrSvg()}<br><small>Your Outfitter Name</small></div>`, 'Example card. The code here is a placeholder; make yours from your own link.', false)}
`)}

${step(3, 'Save the message', `
<p>Put this in your phone's notes so it's one tap away. Swap in your name, the hunter's name, and your link.</p>
${fig(`<div class="phone"><div class="meta">Text message</div><div class="bubble">Hey Mike, hope you're settled back in. It was a pleasure having you in camp. If you've got a minute, a quick Google review helps other hunters find us. If you want to mention which hunt you were on and who guided you, that's the stuff other hunters look for: g.page/r/your-link<br><br>Thank you. — Tom</div></div>`, 'How it looks on their phone.', false)}
${tpl('Review request message', "Hey [first name], hope you're settled back in. It was a pleasure having you in camp. If you've got a minute, a quick Google review helps other hunters find us. If you want to mention which hunt you were on and who guided you, that's the stuff other hunters look for: [your link]\nThank you. — [your name]")}
`)}

${step(4, 'Run it every hunt', `
<div class="line">
<div><b>At drop-off</b>Hand them the card. Say one sentence: “If you’ve got a minute when you’re home, this helps other hunters find us.”</div>
<div><b>2–3 days later</b>Send the text. A text is usually the quickest to get a tap. Email too if that's all you have.</div>
<div><b>A week after</b>One gentle reminder, and only one. Then let it go.</div>
</div>
`)}

${step(5, 'Follow the rules', `
${rule('<b>Send it to everyone,</b> not only the hunters you think were happy. Google’s policies prohibit selectively asking for positive reviews only.')}
${warn('<b>Never offer a discount, gift, or free anything in exchange for a review.</b> That’s against Google’s rules and can get your reviews removed.')}
${tip('<b>If a hunt went sideways, call that hunter first.</b> Listen. Then send the same message everyone else gets.', '', 'Good practice')}
${tip('<b>Elk hunting is hard.</b> A hunter who didn’t punch a tag can still have had a great trip. Don’t skip them.', '', 'Good practice')}
`)}

${step(6, 'Reply to every review', `
<p>Every review gets a reply within a couple of days, using their first name and something specific. Hunters reading a bad review care more about how you responded than what it said.</p>
${tpl('Reply to a good review', "Thanks, Mike. That bugle on the ridge on day 3 was something. Glad Jake got you into that bull. Hope to see you again in September.")}
${tpl('Reply to a bad review (stay calm, stay factual, move it offline)', "Mike, I'm sorry the trip didn't go the way you hoped. I'd like to hear more and make it right if I can. Call me at [number] when you get a chance.")}
`)}

${step(7, 'Track it', `
<p>Five minutes a week. It's how you notice the one hunter you forgot.</p>
<figure class="vis"><table class="tbl"><thead><tr><th>Hunter</th><th>Hunt dates</th><th>Text sent</th><th>Reminder</th><th>Reviewed?</th></tr></thead><tbody><tr><td>Mike R.</td><td>Sep 8–13</td><td>Sep 16</td><td>Sep 23</td><td>Yes</td></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></tbody></table><figcaption>A spreadsheet works fine. Copy these columns.</figcaption></figure>
`)}

${checklist(['Review link copied and tested on a phone', 'QR card printed and in the gear bag', 'Message saved in your phone with your link in it', 'Reply habit: every review answered within a couple of days', 'Tracking sheet started'])}
${cta()}
${pager('review-requests')}
</main>`;
  return shell({ slug: g.slug, title: 'Ask for Reviews After Every Hunt', desc: 'A simple system for elk outfitters to get more Google reviews: the link, the QR card, the message, and the rules to stay on the right side of Google.', body });
}

// ============================================================
// GUIDE 3 — Rebooking emails
// ============================================================
function guide3() {
  const g = G('rebooking-emails');
  const steps = ['Build one list', 'Email 1: the thank-you', 'Email 2: the rebook', 'Email 3: the application reminder', 'The one follow-up', 'Get your dates right'];
  const body = `
${hero(g, 'THREE EMAILS THAT <em>BRING PAST CLIENTS BACK.</em>', 'The cheapest booking you will ever get is a hunter who already trusts you. Here is exactly what to send, and when.', [['Time', '1 hour'], ['Per send', '5 min'], ['Cost', 'Free']])}
<main class="wrap">
<div class="why">
<p><b>Why this is the cheapest booking you'll ever get.</b> A past client has already done the hard part. They found you, trusted you, paid, hunted your country, and slept in your camp. Getting a brand-new hunter takes ads, a website, and weeks of back-and-forth. Getting a past client back takes one honest email at the right time.</p>
<p>Most outfitters never send it. The hunter goes home, the season ends, and the next time that hunter hears from them is never. The hunter doesn't forget you. They just book whoever reaches them first.</p>
</div>
<figure class="vis"><div class="line">
<div><b>Hunt ends</b>Within a week: Email 1, the thank-you</div>
<div><b>Dec – Jan</b>Email 2, the rebook</div>
<div><b>~10 days later</b>One short follow-up</div>
<div><b>Spring</b>Email 3, the application reminder</div>
</div><figcaption>The whole sequence at a glance.</figcaption></figure>
${toc(steps)}

${step(1, 'Build one list', `
<p>Put every past client in one spreadsheet: first name, last name, email, the year they hunted, and <b>one detail you remember</b> (the bull they shot, the weather, who they came with). That last column is what makes these sound like you wrote them yourself.</p>
${tip('Send from your own email address, in plain text, with no logo header. It should read like a note from you. A free email tool (MailerLite, Mailchimp) or a mail merge in Gmail or Outlook lets you send to a list and still put their first name at the top.')}
`)}

${step(2, 'Email 1: the thank-you', `
<p><b>Send it within a week of their hunt ending.</b> Goal: stay in their head. <b>No ask in this email.</b></p>
${emailTpl('Template', 'Thank you from [Camp name]', "Hi [first name],\n\nThanks for hunting with us. I keep coming back to [one specific moment: the bull at first light on day four, the long pack out, the night the bugling wouldn't quit].\n\nI'm sorting through photos and will send you the good ones this week. Safe travels home.\n\n[Your name]")}
<h3>Filled in</h3>
${emailTpl('Example', 'Thank you from Bear Paw Outfitters', "Hi Mike,\n\nThanks for hunting with us. I keep coming back to that evening on the ridge when three bulls were screaming at each other and you didn't say a word for ten minutes.\n\nI'm sorting photos and I'll send the good ones this week. Safe travels.\n\nTom")}
`)}

${step(3, 'Email 2: the rebook', `
<p><b>Send it in December or January.</b> Goal: get a date on the calendar before they've committed it somewhere else.</p>
${emailTpl('Template', 'Next season at [Camp name]: dates are open', "Hi [first name],\n\nDates for [year] are open. I've got [number] spots in [month range] and I'm giving past clients first pick before I open them up.\n\nA [deposit amount] deposit holds your spot. If you've got a buddy who's been wanting to try it, bring him. I'll hold two spots together.\n\nReply here and I'll send details.\n\n[Your name]")}
${warn('Only say “first pick” and the spot count if they’re true. Your clients will notice.')}
`)}

${step(4, 'Email 3: the application reminder', `
<p><b>Send it in spring, for draw states only.</b> This is the email that earns trust. You're helping them even if they don't book.</p>
${tip('<b>Timing:</b> send this two to three weeks before your state’s deadline. In Montana that means mid-March (deadline April 1). In Oregon, mid-April (May 15). In California, mid-May (June 2).')}
${emailTpl('Template', 'Tag deadline is [date]', "Hi [first name],\n\nQuick heads up: the [state] elk application deadline is [date]. [Link to your agency's application page]\n\nIf you draw, I'm holding [dates] for you. If you don't, let me know and we'll figure out next year.\n\n[Your name]")}
`)}

${step(5, 'The one follow-up', `
<p>If someone doesn't reply to Email 2 after about ten days, send one line, then stop.</p>
${tpl('Follow-up line', "Wanted to make sure this didn't get buried. Dates are still open if you're thinking about [year].")}
`)}

${step(6, 'Get your dates right', `
<p>Deadlines move year to year, so always confirm them on the agency's own site.</p>
${list([
  '<b>Oregon (ODFW):</b> controlled elk hunt applications are due May 15, with results around mid-June.',
  '<b>Idaho (IDFG):</b> the application window runs May 1 to June 5, with results from mid-June to early July, and a second drawing in August for leftover tags.',
  '<b>Montana (FWP):</b> applications open March 1. Elk combination licenses and elk permits are due <b>April 1</b> (11:45 pm Mountain), with the drawing in mid-April. The Elk B drawing is due June 1, with results in mid-June. Montana runs earlier than Oregon or Idaho.',
  '<b>Washington (WDFW):</b> special hunt permits, including elk, opened April 20 and closed May 27 in 2026, with results in June. Multi-season deer and elk tags are sold December 1 through March 31, with results in April. Applications for 2027 open December 1, 2026.',
  '<b>California (CDFW):</b> elk tags come from the Big Game Drawing, which opens April 15 and is due midnight <b>June 2</b> every year, with results ten business days later (about mid-June).'
])}
<p>These are the 2026 cycle dates, checked on each agency's own site in October 2026. Montana and California haven't posted 2027 dates yet, so confirm yours each year.</p>
<h3>Mistakes to avoid</h3>
${mist(['Writing like a brochure. “We offer premier guided hunting experiences” gets deleted. “I keep thinking about that bull on day four” gets read.', 'Making Email 1 a sales email. The thank-you has to be a thank-you.', 'Sending the rebook email in May. By then they’ve booked, or drawn somewhere else.', 'Burying the deposit and dates. Say the number and the month.'])}
`)}

${checklist(['Past client list built with a “remember this” column', 'Email 1 scheduled for within a week after each hunt', 'Email 2 written with real dates, spots, and deposit', 'Email 3 on the calendar a few weeks before your state’s deadline', 'The ten-day follow-up line saved'])}
${cta()}
${pager('rebooking-emails')}
</main>`;
  return shell({ slug: g.slug, title: 'Three Emails That Bring Past Clients Back', desc: 'Copy-and-paste rebooking emails for elk outfitters: the thank-you, the rebook, and the application reminder, with timing and examples.', body });
}

// ============================================================
// GUIDE 4 — Season calendar
// ============================================================
function guide4() {
  const g = G('season-calendar');
  const steps = ['Fill in your four dates', 'See your year at a glance', 'Follow the year, month by month', 'Put it on your actual calendar'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const bands = [
    ['1 / 3', 'b1', 'Rebook'],
    ['3 / 5', 'b2', 'Remind'],
    ['5 / 7', 'b3', 'Deadline + results'],
    ['7 / 9', 'b4', 'Confirm + prep'],
    ['9 / 12', 'b5', 'In season'],
    ['12 / 13', 'b1', 'Rebook'],
  ];
  const body = `
${hero(g, 'YOUR ELK SEASON <em>MARKETING CALENDAR.</em>', 'Stop scrambling to fill September in August. Show up at the same moments every year, when hunters are deciding.', [['Time', '30 min'], ['Then', 'Follow it all year'], ['Cost', 'Free']])}
<main class="wrap">
<div class="why">
<p><b>Why most outfitters scramble every August.</b> You're busy guiding from September through November. You come home tired in December and don't think about next year. Spring is when you finally notice three open spots in September, and now you're discounting, posting on Facebook, and calling old clients you haven't spoken to in a year.</p>
<p>The fix is to stop marketing when you feel behind. Elk hunters follow a predictable year: they apply in spring, find out in early summer, book in the months around it, and hunt in the fall. If you show up at the same predictable moments every year, you're in front of them when they're deciding.</p>
</div>
<h3 style="margin-top:36px">One idea that changes how you plan</h3>
<p>In a state where elk tags come from a draw, a hunter often <b>can't commit to you until they know whether they drew.</b> That splits your year in two:</p>
<figure class="vis"><div class="phases">
<div class="phase"><b>Before results</b><p>You're selling: “apply, and if you draw I'm holding dates for you.”</p></div>
<div class="phase"><b>After results</b><p>You're selling to people with a tag in hand and a week of leave to spend. The most motivated hunter you'll ever talk to.</p></div>
</div><figcaption>Most outfitters treat these as one phase and talk to everyone the same way. Don't.</figcaption></figure>
${toc(steps)}

${step(1, 'Fill in your four dates', `
<p>Look these up on your state agency's site (<b>ODFW, IDFG, Montana FWP, WDFW, or CDFW</b>) and type them in. They save in this browser so you don't lose them.</p>
<figure class="vis"><table class="tbl"><thead><tr><th>Date</th><th>Yours</th></tr></thead><tbody>
<tr><td>Application deadline</td><td><input data-save="deadline" placeholder="e.g. May 15"></td></tr>
<tr><td>Draw results</td><td><input data-save="results" placeholder="e.g. mid-June"></td></tr>
<tr><td>Season opens</td><td><input data-save="open" placeholder="e.g. Sep 1 (archery)"></td></tr>
<tr><td>Season closes</td><td><input data-save="close" placeholder="e.g. Nov 30"></td></tr>
</tbody></table><figcaption>Archery and rifle often run different dates. Note both.</figcaption></figure>
<figure class="vis"><table class="tbl"><thead><tr><th>State</th><th>Apply by</th><th>Results</th></tr></thead><tbody>
<tr><td>Oregon (ODFW)</td><td>May 15</td><td>Mid-June</td></tr>
<tr><td>Idaho (IDFG)</td><td>May 1 – June 5</td><td>Mid-June to early July (second drawing in August)</td></tr>
<tr><td>Montana (FWP)</td><td>Apr 1 (elk combination and elk permits)<br>Jun 1 (Elk B)</td><td>Mid-April<br>Mid-June</td></tr>
<tr><td>Washington (WDFW)</td><td>May 27 in 2026 (special hunts)<br>Multi-season tags sold Dec 1 – Mar 31</td><td>June<br>April</td></tr>
<tr><td>California (CDFW)</td><td>Midnight June 2, every year</td><td>About ten business days later (mid-June)</td></tr>
</tbody></table><figcaption>The 2026 cycle, checked on each agency's own site. Dates shift, so confirm yours every year.</figcaption></figure>
`)}

${step(2, 'See your year at a glance', `
<figure class="vis"><div class="year">
${months.map((m) => `<div class="m">${m.toUpperCase()}</div>`).join('')}
${bands.map(([col, cls, label]) => `<div class="band ${cls}" style="grid-column:${col}">${label}</div>`).join('')}
</div><figcaption>Five phases, one repeating year. Scroll sideways on a phone.</figcaption></figure>
`)}

${step(3, 'Follow the year, month by month', `
<h3>December: the thank-you and the rebook</h3>
<p>Send thank-you emails to this year's hunters, then the rebooking email (see Guide 1). Look at which dates sold out and which didn't. That tells you what to push.</p>
<h3>January and February: the quiet push</h3>
<p>Update your website and Google profile with next season's dates, prices, and your best photos. Email anyone who didn't answer.</p>
${tpl('Example post', "2026 dates are open. Archery and rifle weeks available. Past clients get first pick through January.")}
<h3>March and April: the application reminder</h3>
<p>A few weeks before your state's deadline, email every past client. You're helping them whether they book or not, and the ones who apply remember who reminded them.</p>
${tip('<b>Montana outfitters, shift this earlier.</b> Your elk combination and permit deadline is April 1 and results come mid-April. Send the reminder in February or early March, and treat mid-April as your results week. The Elk B drawing closes June 1 with results in mid-June, which gives you a second window.', '', 'Montana')}
<h3>May and June: the deadline and the results</h3>
<p>Every hunter is paying attention. Post on your profile around the deadline. The week results come out, reach out to everyone who drew. <b>This is your highest-converting week of the year.</b></p>
${tip('<b>Washington and California</b> sit squarely in this window: Washington\'s special hunt deadline was late May in 2026, and California\'s is June 2 every year with results about ten business days later. Oregon is May 15, Idaho May 1 to June 5.', '', 'Your state')}
${tpl('Message to a hunter who drew', "Congrats on the tag, [first name]. I'm holding [dates] for you. Want me to send details?")}
<h3>July and August: the confirmation</h3>
<p>Confirm your hunters, send prep info (gear list, fitness, what to expect), post pre-season photos, and check for leftover or second-draw tags to fill any openings that are left.</p>
<h3>September through November: the season</h3>
<p>Take photos as you go (ask permission). Send review requests within a few days of each hunt (see Guide 4). Note any cancellations, because a late opening can be filled with a quick post and a call to your list.</p>
<p>Then it starts over in December.</p>
`)}

${step(4, 'Put it on your actual calendar', `
<p>A guide in a folder doesn't help you. Open your calendar and create a <b>recurring reminder for each month's task</b>, with the email or post you need attached. Twenty minutes now means you don't have to remember any of it.</p>
`)}

${checklist(['Your four dates written down for your state', 'Every month’s task on your calendar with a reminder', 'Past client list ready by December', 'You know which of your hunts sell out and which don’t'])}
${cta()}
${pager('season-calendar')}
</main>`;
  return shell({ slug: g.slug, title: 'Your Elk Season Marketing Calendar', desc: 'A month-by-month marketing calendar for elk outfitters built around the tag-draw year, so you stop scrambling to fill September.', body });
}

// ============================================================
// Index
// ============================================================
function index() {
  const blurbs = {
    'rebooking-emails': 'Three copy-and-paste emails: the thank-you, the rebook, and the application reminder.',
    'google-business-profile': 'Claim it, fill it out, and show up when hunters search. Ten steps, with a photo shot list.',
    'season-calendar': 'Your whole marketing year, built around tag-draw timing. Fill in four dates and follow it.',
    'review-requests': 'The link, the QR card, the message, and the rules. Turn happy hunters into reviews.',
  };
  const body = `
<header class="hero wrap"><span class="tag">// Free, no catch</span><h1>THE BOOKED OUT <em>STARTER KIT.</em></h1><p class="lede">Four step-by-step guides for elk outfitters. Follow them yourself and you'll be easier to find, better reviewed, and booked earlier. Each one takes under an hour.</p></header>
<main class="wrap">
<div class="cards">
${GUIDES.map((g) => `<a class="gc" href="/guides/${g.slug}.html"><span class="tag">// Guide ${g.num} of 4 · ${g.time}</span><h3>${g.short}</h3><p>${blurbs[g.slug]}</p></a>`).join('')}
</div>
${cta()}
</main>`;
  return shell({ slug: 'index', title: 'The Booked Out Starter Kit', desc: 'Four free step-by-step guides for elk outfitters: Google Business Profile, reviews, rebooking emails, and a season marketing calendar.', body });
}

// ---------- write ----------
fs.mkdirSync(OUT, { recursive: true });
const files = {
  'index.html': index(),
  'google-business-profile.html': guide1(),
  'review-requests.html': guide2(),
  'rebooking-emails.html': guide3(),
  'season-calendar.html': guide4(),
};
for (const [name, html] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), html);
  console.log('wrote guides/' + name + ' (' + Math.round(html.length / 1024) + ' KB)');
}
