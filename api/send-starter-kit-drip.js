const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// The Booked Out Starter Kit — opt-in guide drip.
// See LEAD-MAGNETS.md. The flow:
//   cold email (CTA button) -> /starter-kit.html (name + email) -> subscribed
//   -> guide 1 immediately, guides 2-4 every 2 days (days 2/4/6)
//   -> a short Booked Out pitch at the end (day 8).
//
// Two ways in, one function (the Hobby plan caps us at 12 functions):
//   1. Public signup: POST { name, email, lead? } from /starter-kit.html.
//      Saves the subscriber and sends guide 1 right away.
//   2. Cron: daily, Bearer CRON_SECRET. Sends whatever is due, which also
//      covers a signup whose instant send failed.
//      ?dry_run=1 previews without sending.
//
// The guides are DIY — nothing here offers to do the work for free. Doing it
// for them is what Booked Out is.
// ============================================================
const DRIP_INTERVAL_DAYS = 2;
const MAX_PER_RUN = 25;
// Safety valve on the public endpoint: past this many new signups in 24h the
// instant send is skipped and the daily cron handles the rest.
const INSTANT_DAILY_CAP = 150;
const { CALL_URL, CALL_CTA_LABEL, buildCallPitch } = require('../lib/call-pitch');

const GUIDE_BASE = 'https://www.griffincreativelab.com/guides/';
const PRICING_URL = 'https://www.griffincreativelab.com/index.html#pricing';
const CANONICAL_SIGNATURE = '\n\ngabriel\ngriffincreative\ngriffincreativelab.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();

function encodeMimeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?utf-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}

function generateMessageId(fromEmail) {
  const domain = (fromEmail && fromEmail.split('@')[1]) || 'griffincreativelab.com';
  return `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`;
}

const b64 = (str) => Buffer.from(str, 'utf-8').toString('base64').match(/.{1,76}/g).join('\r\n');

// Plain text -> a minimal HTML email, turning the one CTA url into a button.
function textToHtml(body, cta) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const para = (t) => `<p style="margin:0 0 14px">${esc(t).replace(/\n/g, '<br>')}</p>`;
  const button =
    `<p style="margin:22px 0"><a href="${esc(cta.url)}" ` +
    `style="background:#ff4d00;color:#ffffff;text-decoration:none;font-weight:bold;` +
    `padding:13px 24px;border-radius:4px;display:inline-block;font-size:15px">${esc(cta.label)}</a></p>`;
  const html = body
    .split(/\n{2,}/)
    .map((p) => {
      if (p.includes(cta.url)) {
        const rest = p.replace(cta.url, '').trim();
        return (rest ? para(rest) : '') + button;
      }
      return para(p);
    })
    .join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222222;max-width:560px">${html}</div>`;
}

// Compliance footer appended to every outbound message (text + HTML parts):
// who we are, a real postal address, and a working opt-out. A reply of "stop"
// (or any negative reply) is honored: cold leads stop via check-replies'
// reply_received flag; starter-kit subscribers are removed by hand from the
// hello@ inbox (see CLAUDE notes / BACKLOG).
const EMAIL_FOOTER =
  '\n\n\u2014\nGriffin Creative Labs \u00b7 203 SE 7th St, Sublimity, OR 97385\n' +
  'Not for you? Just reply "stop" and I won\'t email you again.';

// text + HTML (with a button) when `cta` is given, plain text otherwise.
async function sendEmail({ to, subject, body, cta }) {
  body = body + EMAIL_FOOTER;
  const fromEmail = process.env.GMAIL_FROM_EMAIL;
  const fromName = process.env.GMAIL_FROM_NAME;
  const headers = [
    `From: ${encodeMimeHeader(fromName)} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    `Message-ID: ${generateMessageId(fromEmail)}`,
    'MIME-Version: 1.0',
  ];
  let message;
  if (cta) {
    const boundary = `=_gc_${Math.random().toString(36).slice(2)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    message =
      headers.join('\r\n') + '\r\n\r\n' +
      `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(body)}\r\n` +
      `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(textToHtml(body, cta))}\r\n` +
      `--${boundary}--`;
  } else {
    headers.push('Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64');
    message = headers.join('\r\n') + '\r\n\r\n' + b64(body);
  }
  const encoded = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
}

// Business name when this signup came from a tracked outreach link. A cold
// social signup has none — the copy below doesn't depend on it.
async function getCompanyName(signup) {
  if (!signup.outreach_lead_id) return '';
  const { data: lead } = await supabase
    .from('outreach_leads')
    .select('company_name')
    .eq('id', signup.outreach_lead_id)
    .maybeSingle();
  return (lead && lead.company_name) || '';
}

// ---------- Stage content ----------
// Returns { subject, body, cta }. Deterministic — no AI spend.
// Stage 1 is sent on signup; 2-4 every DRIP_INTERVAL_DAYS; 5 is the pitch: a
// call pitch for people who signed up from our outreach email (fromOutreach),
// the Booked Out pricing pitch for everyone else.
const PS = '\n\nps — if you ever want to see how we\'d run all of this for you, just reply "booked out".';

function buildStageEmail(stage, { first, companyName, q, fromOutreach }) {
  const hi = `hi ${first || 'there'},\n\n`;
  const forCo = companyName ? ` for ${companyName}` : '';
  const guide = (slug) => `${GUIDE_BASE}${slug}.html${q}`;

  switch (stage) {
    case 1: {
      const url = guide('rebooking-emails');
      return {
        subject: `your free rebooking guide${forCo}`,
        body:
          hi +
          `you're in. guide 1 of 4 is right here — the email most outfitters never send: the rebooking email.\n\n` +
          `it's step by step, with copy-and-paste templates for the thank-you, the rebook, and the application reminder:\n\n` +
          `${url}\n\n` +
          `the other three land over the next week, one every couple of days.` +
          CANONICAL_SIGNATURE,
        cta: { url, label: 'Read guide 1' },
      };
    }
    case 2: {
      const url = guide('google-business-profile');
      return {
        subject: `guide 2 of 4: your google business profile`,
        body:
          hi +
          `guide 2 of 4. when someone searches for an elk hunt, your google business profile is usually the first thing they see.\n\n` +
          `this walks you through claiming it, picking the right category, and filling it out — ten steps, about 45 minutes:\n\n` +
          `${url}` +
          PS +
          CANONICAL_SIGNATURE,
        cta: { url, label: 'Read guide 2' },
      };
    }
    case 3: {
      const url = guide('season-calendar');
      return {
        subject: `guide 3 of 4: your season marketing calendar`,
        body:
          hi +
          `guide 3 of 4. fill in four dates from your state agency and follow a month-by-month plan built around tag-draw timing:\n\n` +
          `${url}\n\n` +
          `one more to go.` +
          PS +
          CANONICAL_SIGNATURE,
        cta: { url, label: 'Read guide 3' },
      };
    }
    case 4: {
      const url = guide('review-requests');
      return {
        subject: `guide 4 of 4: reviews after every hunt`,
        body:
          hi +
          `last guide. the link, a printable qr card, the message to send, and the google rules to stay on the right side of:\n\n` +
          `${url}` +
          PS +
          CANONICAL_SIGNATURE,
        cta: { url, label: 'Read guide 4' },
      };
    }
    case 5:
      if (fromOutreach) {
        return {
          subject: `15 minutes on getting you seen year round?`,
          body: buildCallPitch({ first }),
          cta: { url: CALL_URL, label: CALL_CTA_LABEL },
        };
      }
      return {
        subject: `the four free marketing guides, and what's next`,
        body:
          hi +
          `that's the whole kit — your google profile, reviews, a season calendar, and rebooking emails. that's new hunters finding you and past hunters coming back. ` +
          `everything in them you can do yourself, and they're yours either way.\n\n` +
          `the catch is that it's all ongoing: new dates every year, reviews after every hunt, the profile kept fresh, ` +
          `the rebooking email on time. if you'd rather not run that on top of guiding, that's what booked out is — ` +
          `we run all of it for you year round, and then some. those four marketing guides are only a slice of what's in it. ` +
          `and you can cancel anytime.\n\n` +
          `how it works: ${PRICING_URL}\n\n` +
          `or just reply and tell me where you're at.` +
          CANONICAL_SIGNATURE,
        cta: { url: PRICING_URL, label: 'See how Booked Out works' },
      };
    default:
      throw new Error(`unknown drip stage ${stage}`);
  }
}

// Sends the next stage to one signup and advances its state.
async function deliverNextStage(signup, { dryRun = false } = {}) {
  const companyName = await getCompanyName(signup);
  const first = (signup.name || '').trim().split(/\s+/)[0];
  const nextStage = signup.drip_stage + 1;
  // ?lead / ?s let the guide page log who opened it (guide_engagement view).
  const q = signup.outreach_lead_id ? `?lead=${signup.outreach_lead_id}` : `?s=${signup.id}`;
  const { subject, body, cta } = buildStageEmail(nextStage, { first, companyName, q, fromOutreach: Boolean(signup.outreach_lead_id) });

  if (dryRun) return { email: signup.email, stage: nextStage, subject, body };

  await sendEmail({ to: signup.email, subject, body, cta });
  const { error: updateErr } = await supabase
    .from('lead_magnet_signups')
    .update({
      drip_stage: nextStage,
      next_drip_at: nextStage < 5 ? daysFromNow(DRIP_INTERVAL_DAYS) : null,
    })
    .eq('id', signup.id);
  if (updateErr) throw new Error(`supabase update failed: ${updateErr.message}`);
  return { email: signup.email, stage: nextStage, subject };
}

// ============================================================
// Public signup (POST { name, email, lead?, website? })
// ============================================================
// Where a signup came from, when it isn't an outreach email (?src= on the signup page).
const SRC_MAP = { gads: 'google_ads', web: 'website', scorecard: 'scorecard', meta: 'meta_ads' };

async function handleSignup(req, res) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: real people never see or fill this field.
  if (body.website) return res.status(200).json({ ok: true });

  const name = String(body.name || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  if (!name || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter your name and a valid email.' });
  }
  const leadId = /^[0-9]{1,12}$/.test(String(body.lead || '')) ? Number(body.lead) : null;

  const row = {
    name,
    email,
    outreach_lead_id: leadId,
    source: leadId ? 'outreach_email' : (SRC_MAP[body.src] || 'social'),
    drip_stage: 0,
    next_drip_at: new Date().toISOString(),
  };
  let { data: signup, error } = await supabase.from('lead_magnet_signups').insert(row).select('*').single();

  // A tampered or stale ?lead= id: keep the signup, drop the link.
  if (error && error.code === '23503') {
    ({ data: signup, error } = await supabase
      .from('lead_magnet_signups')
      .insert({ ...row, outreach_lead_id: null, source: 'social' })
      .select('*')
      .single());
  }
  // Already subscribed: don't re-send guide 1.
  if (error && error.code === '23505') return res.status(200).json({ ok: true, already: true });
  if (error) {
    console.error('signup insert failed:', error.message);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }

  // Instant first guide. If this fails the row stays at stage 0 and the daily
  // cron sends it, so the signup is never lost.
  try {
    const { count } = await supabase
      .from('lead_magnet_signups')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', daysFromNow(-1));
    if ((count || 0) <= INSTANT_DAILY_CAP) await deliverNextStage(signup);
  } catch (err) {
    console.error('instant send failed (cron will retry):', err.message);
  }
  return res.status(200).json({ ok: true });
}

// ============================================================
// Main handler
// ============================================================
module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    if (req.method === 'POST') return handleSignup(req, res);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dryRun = req.query?.dry_run === '1';

  try {
    const { data: due, error: fetchErr } = await supabase
      .from('lead_magnet_signups')
      .select('*')
      .lt('drip_stage', 5)
      .lte('next_drip_at', new Date().toISOString())
      .order('next_drip_at', { ascending: true })
      .limit(MAX_PER_RUN);

    if (fetchErr) return res.status(500).json({ error: 'Supabase fetch failed', detail: fetchErr.message });
    if (!due || due.length === 0) {
      return res.status(200).json({ success: true, processed: 0, message: 'nothing due' });
    }

    const results = { processed: 0, failed: 0, dry_run: dryRun, errors: [], drafts: [] };

    for (const signup of due) {
      try {
        const out = await deliverNextStage(signup, { dryRun });
        if (dryRun) results.drafts.push(out);
        results.processed++;
        if (!dryRun && signup !== due[due.length - 1]) await sleep(4000);
      } catch (err) {
        results.failed++;
        results.errors.push({ signup_id: signup.id, email: signup.email, error: err.message });
      }
    }

    return res.status(200).json({ success: true, ...results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
