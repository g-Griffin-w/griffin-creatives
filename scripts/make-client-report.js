#!/usr/bin/env node
// scripts/make-client-report.js
//
// Builds the monthly client report as one HTML page (print to PDF or email it).
// Numbers we can measure ourselves (review requests, link opens, referrals) are
// pulled from Supabase. Numbers only Google shows (profile views, calls, new
// reviews) you copy from the client's Business Profile dashboard into the input
// file. Missing numbers show as "n/a", never as zero.
//
//   cp reports/EXAMPLE-input.json reports/acme-2026-11.json   # fill it in
//   node --env-file=.env.local scripts/make-client-report.js reports/acme-2026-11.json
//   -> reports/acme-2026-11.html
//
// See REPORT-TEMPLATE.md for where each number comes from.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/make-client-report.js reports/<client>-<YYYY-MM>.json'); process.exit(1); }
const input = JSON.parse(fs.readFileSync(file, 'utf8'));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = (v) => v !== undefined && v !== null && v !== '';
const num = (v) => (has(v) ? Number(v).toLocaleString('en-US') : 'n/a');

function change(cur, prev) {
  if (!has(cur) || !has(prev)) return '';
  const d = Number(cur) - Number(prev);
  if (d === 0) return '<span class="chg">no change</span>';
  return `<span class="chg ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d} vs last month</span>`;
}

(async () => {
  const [year, mon] = String(input.month).split('-').map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, mon, 1)).toISOString();
  const monthName = new Date(Date.UTC(year, mon - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  let q = supabase.from('griffin_clients').select('id, business_name, full_name');
  q = /^[0-9a-f-]{36}$/i.test(input.client) ? q.eq('id', input.client) : q.ilike('business_name', `%${input.client}%`);
  const { data: clients, error } = await q;
  if (error || !clients || clients.length !== 1) {
    console.error(`Expected exactly one client matching "${input.client}", got ${clients ? clients.length : 0}.`);
    process.exit(1);
  }
  const client = clients[0];

  const inWindow = (col) => (qb) => qb.gte(col, start).lt(col, end);
  const count = async (table, build) => {
    const { count: c } = await build(supabase.from(table).select('*', { count: 'exact', head: true }).eq('guide_client_id', client.id));
    return c || 0;
  };

  const requestsSent = await count('review_requests', inWindow('sent_at'));
  const reminders = await count('review_requests', inWindow('reminder_sent_at'));
  const linkOpens = await count('review_requests', inWindow('clicked_at'));
  const rebookReached = await count('guide_client_contacts', (qb) => qb.in('status', ['sent']));
  const refShared = await count('referrals', inWindow('created_at'));
  const refInquired = await count('referrals', inWindow('inquired_at'));
  const refBooked = await count('referrals', inWindow('booked_at'));

  const g = input.gbp || {};
  const r = input.reviews || {};
  const b = input.bookings || {};
  const list = (items) => (items && items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="muted">Nothing to add this month.</p>');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(client.business_name)} — ${esc(monthName)} Report</title>
<style>
:root{--ink:#16140f;--muted:#6b665c;--line:#e4dfd3;--bg:#fbf9f4;--card:#fff;--accent:#d94300;--up:#1c7a3c;--down:#b3261e}
@media (prefers-color-scheme:dark){:root{--ink:#f0ece3;--muted:#a39d90;--line:#2a2823;--bg:#111;--card:#181714;--accent:#ff6a2a;--up:#6fd08a;--down:#ff8a80}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55}
main{max-width:760px;margin:0 auto;padding:40px 20px 64px}
.kicker{font:600 12px/1 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
h1{font-size:34px;line-height:1.1;margin:10px 0 4px}h2{font-size:18px;margin:34px 0 12px;padding-top:6px;border-top:1px solid var(--line)}
.sub{color:var(--muted);margin:0 0 24px}
.big{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}
.tile b{display:block;font-size:34px;line-height:1.1}.tile span{font-size:13px;color:var(--muted)}
.chg{display:block;font-size:12px;margin-top:4px;color:var(--muted)}.chg.up{color:var(--up)}.chg.down{color:var(--down)}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
td,th{padding:10px 14px;text-align:left;border-top:1px solid var(--line);font-size:15px}th{border-top:0;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
td:last-child,th:last-child{text-align:right}
ul{padding-left:20px;margin:8px 0}li{margin:4px 0}.muted{color:var(--muted)}.note{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--accent);padding:14px 16px;border-radius:6px}
footer{margin-top:40px;font-size:12px;color:var(--muted)}
@media (max-width:560px){.big{grid-template-columns:1fr}}@media print{body{background:#fff}main{padding:0}}
</style></head><body><main>
<span class="kicker">Monthly report</span>
<h1>${esc(client.business_name)}</h1>
<p class="sub">${esc(monthName)} · Griffin Creative Labs</p>

${has(input.summary) ? `<div class="note">${esc(input.summary)}</div>` : ''}

<h2>The month in three numbers</h2>
<div class="big">
  <div class="tile"><b>${num(g.views)}</b><span>People who viewed your Google profile</span>${change(g.views, g.views_prev)}</div>
  <div class="tile"><b>${num(g.calls)}</b><span>Calls from your profile</span>${change(g.calls, g.calls_prev)}</div>
  <div class="tile"><b>${num(r.new)}</b><span>New Google reviews</span></div>
</div>

<h2>What we did this month</h2>
${list(input.work_done)}

<h2>Your Google profile</h2>
<table>
<tr><th>Measure</th><th>This month</th></tr>
<tr><td>Profile views</td><td>${num(g.views)} ${change(g.views, g.views_prev)}</td></tr>
<tr><td>Calls</td><td>${num(g.calls)} ${change(g.calls, g.calls_prev)}</td></tr>
<tr><td>Website clicks</td><td>${num(g.website_clicks)} ${change(g.website_clicks, g.website_clicks_prev)}</td></tr>
<tr><td>Direction requests</td><td>${num(g.direction_requests)}</td></tr>
<tr><td>Photos on your profile</td><td>${num(g.photos)}</td></tr>
<tr><td>Posts published</td><td>${num(g.posts)}</td></tr>
</table>

<h2>Reviews</h2>
<table>
<tr><th>Measure</th><th>This month</th></tr>
<tr><td>Review requests we sent for you</td><td>${num(requestsSent)}</td></tr>
<tr><td>Reminders sent</td><td>${num(reminders)}</td></tr>
<tr><td>Hunters who opened the review link</td><td>${num(linkOpens)}</td></tr>
<tr><td>New reviews on Google</td><td>${num(r.new)}</td></tr>
<tr><td>Total reviews / average rating</td><td>${has(r.total) ? num(r.total) : 'n/a'} / ${has(r.rating) ? esc(r.rating) : 'n/a'}</td></tr>
<tr><td>Reviews we replied to</td><td>${num(r.replied)}</td></tr>
</table>
<p class="muted">Hunters opening the link is a count of clicks, not reviews. Google doesn't tell us who reviewed.</p>

<h2>Past hunters and referrals</h2>
<table>
<tr><th>Measure</th><th>${esc(monthName)}</th></tr>
<tr><td>Past hunters in the rebooking sequence (total reached so far)</td><td>${num(rebookReached)}</td></tr>
<tr><td>Replies to rebooking emails</td><td>${num(input.rebooking && input.rebooking.replies)}</td></tr>
<tr><td>Referrals shared</td><td>${num(refShared)}</td></tr>
<tr><td>Friends who inquired through a referral</td><td>${num(refInquired)}</td></tr>
<tr><td>Referred friends who booked</td><td>${num(refBooked)}</td></tr>
</table>

<h2>Bookings you told us about</h2>
<table>
<tr><th>Measure</th><th>This month</th></tr>
<tr><td>New inquiries</td><td>${num(b.inquiries)}</td></tr>
<tr><td>Hunts booked (deposit received)</td><td>${num(b.booked)}</td></tr>
<tr><td>Where the bookings came from</td><td>${esc(b.sources || 'n/a')}</td></tr>
</table>
<p class="muted">These come from you. We ask each new hunter how they found you so we can see what's working.</p>

<h2>Next month</h2>
${list(input.next_month)}

${has(input.notes) ? `<h2>Notes</h2><p>${esc(input.notes)}</p>` : ''}

<footer>Griffin Creative Labs · hello@griffincreativelab.com · (503) 779-8493. Numbers marked n/a weren't available this month. We don't guess.</footer>
</main></body></html>`;

  const out = file.replace(/\.json$/, '.html');
  fs.writeFileSync(out, html);
  console.log(`Wrote ${out}`);
})().catch((e) => { console.error(e); process.exit(1); });
