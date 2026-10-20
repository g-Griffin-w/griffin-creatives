#!/usr/bin/env node
// scripts/build-state-pages.js
//
// Builds one public page per state with that state's elk application dates,
// plus sitemap.xml and robots.txt. The dates are the 2026 cycle, checked on
// each agency's own site in October 2026 (same data as draw-dates.html and the
// season-calendar guide). Edit the STATES data below, then re-run:
//   node scripts/build-state-pages.js
// Re-check every date each spring when the new cycle posts.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://www.griffincreativelab.com';

// Reuse the site's look: copy the <style> block from the draw-dates page.
const base = fs.readFileSync(path.join(ROOT, 'draw-dates.html'), 'utf8');
const CSS = base.slice(base.indexOf('<style>') + 7, base.indexOf('</style>'));

const STATES = [
  {
    slug: 'oregon', name: 'Oregon', agency: 'ODFW', url: 'https://myodfw.com',
    apply: 'Controlled elk hunt applications are due May 15.',
    results: 'Results come around mid-June.',
    extra: ['Oregon is later than Wyoming, Montana, Colorado and Utah, so its reminder email goes out in mid-April.'],
    send: 'Send the application reminder in mid-April, two to three weeks before May 15.',
  },
  {
    slug: 'idaho', name: 'Idaho', agency: 'IDFG', url: 'https://idfg.idaho.gov',
    apply: 'The application window runs May 1 to June 5.',
    results: 'Results arrive from mid-June to early July.',
    extra: ['Idaho runs a second drawing in August for leftover tags. That is a useful second window to fill open dates.'],
    send: 'Send the application reminder in mid-May, while the window is open, and a note about leftover tags in August.',
  },
  {
    slug: 'montana', name: 'Montana', agency: 'Montana FWP', url: 'https://fwp.mt.gov/buyandapply/hunting-licenses/application-drawing-dates',
    apply: 'The license year starts March 1. Elk permits and nonresident elk combination licenses are due April 1 at 11:45 pm Mountain. The Elk B license drawing is due June 1.',
    results: 'Permit results come in mid-April. Elk B results come in mid-June.',
    extra: ['Montana runs earlier than Oregon or Idaho, so outfitters here should send the reminder in February or early March.', 'The Elk B drawing gives a second window for clients who miss April 1.'],
    send: 'Send the application reminder in mid-February to early March. Treat mid-April as your results week, and use Elk B in June as a second push.',
  },
  {
    slug: 'washington', name: 'Washington', agency: 'WDFW', url: 'https://wdfw.wa.gov',
    apply: 'Special hunt permits, including elk, opened April 20 and closed May 27 in 2026. Multi-season deer and elk tags are sold December 1 through March 31.',
    results: 'Special hunt results come in June. Multi-season results come in April.',
    extra: ['Applications for the 2027 multi-season tags open December 1, 2026.'],
    send: 'Send a note on December 1 for multi-season tags, and a reminder in early May for special hunts.',
  },
  {
    slug: 'california', name: 'California', agency: 'CDFW', url: 'https://wildlife.ca.gov',
    apply: 'The Big Game Drawing opens April 15 and is due at midnight on June 2 every year.',
    results: 'Results come about ten business days after the deadline, around mid-June.',
    extra: ['California uses the same June 2 deadline every year, which makes planning simple.'],
    send: 'Send the application reminder in mid-May, two to three weeks before June 2.',
  },
  {
    slug: 'wyoming', name: 'Wyoming', agency: 'Wyoming Game and Fish', url: 'https://wgfd.wyo.gov',
    apply: 'Applications opened January 2. Nonresident elk applications are due February 2. Resident elk applications are due June 1.',
    results: 'Nonresident results come in spring and resident results in summer.',
    extra: ['February 2 is the earliest nonresident elk deadline of the eight Western states covered here.', 'Applications can be modified or withdrawn through May 8.'],
    send: 'Send the application reminder in December or early January, right after the thank-you emails. For resident clients, send a second reminder in mid-May.',
  },
  {
    slug: 'colorado', name: 'Colorado', agency: 'Colorado Parks and Wildlife', url: 'https://cpw.state.co.us/activities/hunting/big-game/primary-draw',
    apply: 'The 2026 primary draw opened March 1 and closed April 7 at 8 pm Mountain. The secondary draw closes the last business day of June.',
    results: 'Check CPW for the date results are posted.',
    extra: ['Hunters need a qualifying license before they can apply.', 'Licenses left over after the primary draw go to the secondary draw.'],
    send: 'Send the application reminder in mid-March, and a note about the secondary draw in early June.',
  },
  {
    slug: 'utah', name: 'Utah', agency: 'Utah DWR', url: 'https://wildlife.utah.gov',
    apply: 'The 2026 big game drawing ran March 19 to April 23.',
    results: 'Results were sent by May 31.',
    extra: ['Remaining permits went on sale July 7 in 2026, and general-season any-bull elk permits on July 9.', 'Utah moved outfitter and guide registration to the Division of Wildlife Resources in July 2025.'],
    send: 'Send the application reminder in early April, two to three weeks before the drawing closes, and a leftover-permit note in early July.',
  },
];

const page = (s) => {
  const others = STATES.filter((o) => o.slug !== s.slug)
    .map((o) => `<a href="elk-application-dates-${o.slug}.html">${o.name}</a>`).join(' · ');
  const title = `${s.name} Elk Application Dates (2026 Cycle) — Griffin Creative`;
  const desc = `${s.name} elk application and drawing dates for the 2026 cycle, plus when ${s.name} outfitters should email past clients. Checked on ${s.agency}'s site in October 2026.`;
  const extra = s.extra.map((e) => `<li>${e}</li>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${SITE}/elk-application-dates-${s.slug}.html">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}
.facts { list-style: none; max-width: 720px; margin: 0 auto 10px; padding: 0 40px; }
.facts li { background: var(--card); border: 1px solid var(--border); padding: 18px 22px; margin-bottom: 10px; font-size: 15px; line-height: 1.6; }
.facts b { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--orange); letter-spacing: 0.1em; text-transform: uppercase; display: block; margin-bottom: 4px; font-weight: 500; }
.more { max-width: 720px; margin: 0 auto; padding: 0 40px 30px; font-size: 13px; color: var(--gray); line-height: 2; }
.more a { color: var(--orange); text-decoration: none; }
@media(max-width: 700px) { .facts, .more { padding-left: 20px; padding-right: 20px; } }
</style>
</head>
<body>
<nav><a href="index.html" class="logo">GRIFFIN<span>CREATIVE</span></a></nav>
<div class="page-header"><div class="page-header-inner">
<span class="sec-tag">// ${s.name} Elk</span>
<h1>${s.name.toUpperCase()} ELK<br><span class="accent">APPLICATION DATES.</span></h1>
<p>The 2026 cycle, checked on <a href="${s.url}" rel="noopener" target="_blank" style="color:var(--orange);text-decoration:none;">${s.agency}</a>'s site in October 2026, and when to email your past clients.</p>
</div></div>
<ul class="facts">
<li><b>Apply by</b>${s.apply}</li>
<li><b>Results</b>${s.results}</li>
<li><b>When to email your clients</b>${s.send}</li>
${extra}
</ul>
<div class="more"><p><b>These are 2026 cycle dates.</b> Dates change from year to year, so confirm on the agency's site before you tell a client. Not legal or licensing advice.</p></div>
<div class="wrap"><div class="cta-box"><h2>FOUR FREE GUIDES FOR ${s.name.toUpperCase()} OUTFITTERS</h2>
<p>Get found by new hunters on Google, collect reviews after every hunt, plan your season around ${s.name}'s dates, and bring past hunters back. Name and email, no card. The first guide lands right away.</p>
<a class="cta-btn" href="starter-kit.html?src=web">Get the free guides</a></div></div>
<div class="more"><p>Other states: <a href="draw-dates.html">All eight states</a> · ${others}</p><p><a href="scorecard.html">Take the free booking scorecard</a></p></div>
<footer><p>Griffin Creative — griffincreativelab.com</p></footer>
</body>
</html>
`;
};

for (const s of STATES) fs.writeFileSync(path.join(ROOT, `elk-application-dates-${s.slug}.html`), page(s));

const urls = ['', 'starter-kit.html', 'draw-dates.html', 'scorecard.html', ...STATES.map((s) => `elk-application-dates-${s.slug}.html`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}/${u}</loc></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
// The guides are the lead magnet and the API/onboarding pages are not for search.
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /guides/\nDisallow: /api/\nDisallow: /onboarding.html\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`wrote ${STATES.length} state pages, sitemap.xml, robots.txt`);
