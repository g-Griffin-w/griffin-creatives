const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { CALL_URL, CALL_CTA_LABEL, buildCallPitch } = require('../lib/call-pitch');

// ============================================================
// Follow-up sender
// Sends threaded follow-ups to leads that were emailed but haven't replied.
// DTC: two touches — stage 0 -> follow-up #1 (bump), stage 1 -> follow-up #2 (breakup).
// Guide niches: the same two touches, but both are reminders of the opt-in ask
// (a CTA button to /starter-kit.html) — see buildGuideFollowup below.
// Auto-stops the moment a reply is logged (reply_received=true), because the
// check-replies job flips that flag and this query excludes it.
//
// Timing is driven by next_followup_at (set by send-outreach on the initial
// send, then advanced here). Trigger daily via cron-job.org, AFTER check-replies:
//   POST https://griffincreativelab.com/api/send-followups
//   Header: Authorization: Bearer <CRON_SECRET>
//   ?dry_run=1 to preview without sending. ?limit=N to cap the batch.
//
// DTC follow-up copy intentionally matches the Tier-2 initial email (offer to
// MAKE 2 free ads), so nothing here claims work that wasn't done.
// ============================================================

// Vercel kills the function at ~300s (FUNCTION_INVOCATION_TIMEOUT — happened
// July 14 2026 at follow-up #30 of a 40 batch). Budget ≈ delay + send ≈ 7-9s
// per lead, so keep batch × 9s comfortably under 300s. Override via
// FOLLOWUP_BATCH_SIZE env (clamped 1-30). Progress is saved per-send, so a
// timeout mid-batch loses nothing — the next run picks up the rest.
const BATCH_SIZE = Math.max(
  1,
  Math.min(30, parseInt(process.env.FOLLOWUP_BATCH_SIZE, 10) || 20),
);
const DELAY_MS_MIN = 3000;
const DELAY_MS_MAX = 7000;

// Days between touches. Initial send schedules stage-0 at +3d (in send-outreach).
// After follow-up #1 we schedule follow-up #2 four days later (~day 7 overall).
const DAYS_TO_FOLLOWUP_2 = 4;
const MAX_STAGE = 2; // stop after two follow-ups

// Guide niches (elk_guide / salmon_guide): the guide play is opt-in. Email 1
// (send-outreach.js) explains the four free marketing guides and has a CTA button to
// /starter-kit.html. Follow-ups here are just reminders of that ask, sent to
// people who haven't signed up: a reminder, then a breakup. Same cadence as
// DTC. Once someone signs up the follow-ups stop (below) and the drip in
// send-starter-kit-drip.js delivers the guides.
const GUIDE_NICHES = new Set(['elk_guide', 'salmon_guide']);
const isGuideLead = (lead) => GUIDE_NICHES.has(lead.niche);
// Follow-ups are guide-niche only by default. ~680 stale DTC leads have been
// overdue since July; set FOLLOWUP_INCLUDE_DTC=1 to deliberately include them.
const INCLUDE_DTC = process.env.FOLLOWUP_INCLUDE_DTC === '1';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
);
oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// ============================================================
// Follow-up copy (deterministic — no AI call, keeps cost at $0 per follow-up).
// stage 0 => first follow-up, stage 1 => breakup.
// ============================================================
function firstName(lead) {
  const n = (lead.first_name || '').trim();
  return n || 'there';
}

function companyName(lead) {
  let name = (lead.company_name || '').trim();
  name = name.replace(/[®™©]/g, '').trim();
  name = name
    .replace(
      /\s+(LLC|L\.L\.C\.|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Company|Ltd\.?|Limited)\.?$/i,
      '',
    )
    .trim();
  if (name.length > 3 && /[A-Z]/.test(name) && !/[a-z]/.test(name)) {
    name = name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name || 'your brand';
}

const SIGNATURE = '\n\ngabriel';

function buildFollowupBody(lead, stage) {
  const first = firstName(lead);
  const co = companyName(lead);
  if (stage === 0) {
    // Follow-up #1 — gentle bump, re-states the free-ads offer.
    return (
      `hi ${first} — floating this back up.\n\n` +
      `still happy to make ${co} 2 free ads from your product photos — finished, ` +
      `ready to run, and yours to keep whether we ever work together or not.\n\n` +
      `want me to put them together?` +
      SIGNATURE
    );
  }
  // Follow-up #2 — breakup / close-the-loop.
  return (
    `hey ${first}, last note from me on this.\n\n` +
    `want me to make those 2 free ads for ${co}, or should i close it out? ` +
    `either way is totally fine — just don't want to keep landing in your inbox.` +
    SIGNATURE
  );
}

// Guide follow-ups: reminders of the opt-in ask. The guides themselves are
// never sent here — only to people who sign up. The guides are written for elk
// outfitters; salmon_guide has none yet, so those leads are skipped in the
// handler.
const GUIDE_SIGNATURE = '\n\ngabriel\ngriffincreative\ngriffincreativelab.com';
const GUIDE_CTA_LABEL = 'Get the 4 free marketing guides';
const signupUrl = (lead) => `https://www.griffincreativelab.com/starter-kit.html?lead=${lead.id}`;
// Leads emailed before Oct 12 2026 got the old ask-first pitch, which never
// explained the guides. Their first follow-up is the explanation.
const sawGuideIntro = (lead) => (lead.email_body || '').includes('starter-kit');
// Leads emailed on or after Oct 21 2026 got the short question email (no link).
const ELK_ASK = 'Want me to send them over?';
const sawQuestion = (lead) => (lead.email_body || '').includes(ELK_ASK);

function buildGuideFollowup(lead, stage) {
  const first = firstName(lead);
  const url = signupUrl(lead);
  const list = 'Google Business Profile setup and edits, a rebooking email sequence, a marketing season calendar, and a review system for after every hunt';

  if (stage === 0 && sawQuestion(lead)) {
    return (
      `Hey ${first} \u2014 floating this back up.\n\n` +
      `The four free marketing guides are still yours if you want them: ${list}. ` +
      `Just reply "send" and I'll send the first one, or grab them here with your name and email:\n\n` +
      `${url}\n\n` +
      `Gabriel\nGriffin Creative Labs`
    );
  }
  if (stage === 0 && !sawGuideIntro(lead)) {
    return (
      `hi ${first},\n\n` +
      `following up on my note — here's the simpler version of what i offered. we put together four free ` +
      `step-by-step guides for elk outfitters: ${list}.\n\n` +
      `sign up with your name and email and the first one lands right away, with the other three over the next week. no catch:\n\n` +
      `${url}` +
      GUIDE_SIGNATURE
    );
  }
  if (stage === 0) {
    return (
      `hi ${first} — floating this back up.\n\n` +
      `the four free marketing guides are still yours if you want them: ${list}. ` +
      `just your name and email, and the first one lands right away:\n\n` +
      `${url}` +
      GUIDE_SIGNATURE
    );
  }
  return (
    `hey ${first}, last note from me on this.\n\n` +
    `if the guides aren't useful, no worries at all — i won't keep landing in your inbox. ` +
    `if they are, it takes about ten seconds:\n\n` +
    `${url}` +
    GUIDE_SIGNATURE
  );
}

// ============================================================
// Helpers
// ============================================================

// MIME-encode a header value if it contains non-ASCII characters (RFC 2047).
function encodeMimeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const base64 = Buffer.from(value, 'utf-8').toString('base64');
  return `=?utf-8?B?${base64}?=`;
}

// Build a "Re:" subject without stacking "Re: Re:".
function replySubject(original) {
  const base = (original || 'quick follow-up').trim();
  return /^re:/i.test(base) ? base : `Re: ${base}`;
}

// Generate a fresh Message-ID for this follow-up (we still thread via
// In-Reply-To/References pointing at the original stored rfc_message_id).
function generateMessageId(fromEmail) {
  const domain = (fromEmail && fromEmail.split('@')[1]) || 'griffincreativelab.com';
  const rand = Math.random().toString(36).slice(2);
  return `<${Date.now()}.${rand}@${domain}>`;
}

// Plain text -> a minimal HTML email, turning the one CTA url into a button.
// The plain-text part is always sent too, so text-only clients see the url.
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

const b64 = (str) => Buffer.from(str, 'utf-8').toString('base64').match(/.{1,76}/g).join('\r\n');

// Compliance footer appended to every outbound message (text + HTML parts):
// who we are, a real postal address, and a working opt-out. A reply of "stop"
// (or any negative reply) is honored: cold leads stop via check-replies'
// reply_received flag; starter-kit subscribers are removed by hand from the
// hello@ inbox (see CLAUDE notes / BACKLOG).
const EMAIL_FOOTER =
  '\n\n\u2014\nGriffin Creative Labs \u00b7 203 SE 7th St, Sublimity, OR 97385\n' +
  'Not for you? Just reply "stop" and I won\'t email you again.';

// Send an in-thread follow-up. Threads via Gmail threadId + RFC
// In-Reply-To/References headers so it lands as a reply, not a new email.
// With `cta` ({url, label}) it goes out multipart/alternative with a button.
async function sendFollowup({ to, subject, body, threadId, inReplyTo, cta }) {
  body = body + EMAIL_FOOTER;
  const fromEmail = process.env.GMAIL_FROM_EMAIL;
  const fromName = process.env.GMAIL_FROM_NAME;

  const fromHeader = `${encodeMimeHeader(fromName)} <${fromEmail}>`;
  const subjectHeader = encodeMimeHeader(subject);
  const newMessageId = generateMessageId(fromEmail);

  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subjectHeader}`,
    `Message-ID: ${newMessageId}`,
    'MIME-Version: 1.0',
  ];
  // Threading headers — only add when we actually have the original id.
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

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

  const encoded = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const requestBody = { raw: encoded };
  if (threadId) requestBody.threadId = threadId;

  const result = await gmail.users.messages.send({ userId: 'me', requestBody });
  return result.data;
}

// Independent safeguard: look at the real Gmail thread and detect whether the
// lead already replied. This protects us even if check-replies.js is down or the
// reply_received flag is stale — we never want to follow up (or breakup-email)
// someone who already answered.
// Returns: true (reply found), false (no reply), or null (couldn't check —
// e.g. missing read scope). Caller decides how to treat null.
async function threadHasInboundReply(threadId) {
  if (!threadId) return null;
  const ourEmail = (process.env.GMAIL_FROM_EMAIL || '').toLowerCase();
  try {
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'metadata',
      metadataHeaders: ['From'],
    });
    const msgs = thread.data.messages || [];
    for (const m of msgs) {
      const headers = m.payload?.headers || [];
      const from = (headers.find((h) => h.name === 'From') || {}).value || '';
      const fromLc = from.toLowerCase();
      // A message whose From is NOT us == an inbound reply in the thread.
      if (ourEmail && !fromLc.includes(ourEmail)) return true;
    }
    return false;
  } catch {
    return null; // e.g. token lacks read scope — can't verify
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () =>
  Math.floor(Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN)) + DELAY_MS_MIN;

// ============================================================
// Call pitch for people who have the guides
// ============================================================
// The same call pitch the drip sends its signups at the end: 10-15 minutes by
// phone, button to the Calendly phone event. One per lead (call_pitch_sent_at).
// Two ways in:
//  - replied "send": the auto-reply (check-replies) gave them the guides, and
//    the pitch follows CALL_PITCH_AFTER_DAYS later;
//  - opened a guide page from an emailed link (guide_views, any guide except
//    the signup page): the pitch follows a day after the open. Only opens from
//    CALL_PITCH_VIEWS_SINCE on count, so old opens aren't pitched retroactively.
// People who signed up through the emailed link get theirs from the drip
// instead, so they are skipped here. If the lead wrote anything after our last
// email (the last message in the thread is not ours), a person handles it and
// nothing is sent.
const CALL_PITCH_VIEWS_SINCE = '2026-10-29T00:00:00Z';
const CALL_PITCH_AFTER_VIEW_HOURS = 20;
const CALL_PITCH_AFTER_DAYS = 3;
const CALL_PITCH_MAX_AGE_DAYS = 30;
const CALL_PITCH_BATCH = 10;

// { lastIsOurs, replyTo } from the real Gmail thread, or null if unreadable.
async function readThreadEnd(threadId) {
  const ourEmail = (process.env.GMAIL_FROM_EMAIL || '').toLowerCase();
  try {
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'metadata',
      metadataHeaders: ['From'],
    });
    const froms = (thread.data.messages || []).map((m) => {
      const v = ((m.payload?.headers || []).find((h) => h.name === 'From') || {}).value || '';
      const addr = (v.match(/<([^>]+)>/) || [null, v])[1].trim().toLowerCase();
      return addr;
    });
    if (froms.length === 0) return null;
    const inbound = froms.filter((a) => a && a !== ourEmail);
    return {
      lastIsOurs: froms[froms.length - 1] === ourEmail,
      replyTo: inbound.length ? inbound[inbound.length - 1] : null,
    };
  } catch {
    return null;
  }
}

async function sendGuideCallPitches({ dryRun }) {
  const out = { due: 0, sent: 0, skipped: 0, errors: [], drafts: [] };
  try {
    const day = 24 * 60 * 60 * 1000;
    const { data: repliers, error } = await supabase
      .from('outreach_leads')
      .select('*')
      .not('guides_sent_at', 'is', null)
      .is('call_pitch_sent_at', null)
      .lte('guides_sent_at', new Date(Date.now() - CALL_PITCH_AFTER_DAYS * day).toISOString())
      .gte('guides_sent_at', new Date(Date.now() - CALL_PITCH_MAX_AGE_DAYS * day).toISOString())
      .order('guides_sent_at', { ascending: true })
      .limit(CALL_PITCH_BATCH);
    if (error) throw new Error(error.message);

    const { data: views, error: viewsError } = await supabase
      .from('guide_views')
      .select('lead_id')
      .not('lead_id', 'is', null)
      .neq('guide', 'signup-page')
      .gte('created_at', CALL_PITCH_VIEWS_SINCE)
      .lte('created_at', new Date(Date.now() - CALL_PITCH_AFTER_VIEW_HOURS * 60 * 60 * 1000).toISOString());
    if (viewsError) throw new Error(viewsError.message);
    const viewerIds = [...new Set((views || []).map((v) => v.lead_id))];
    let openers = [];
    if (viewerIds.length > 0) {
      const { data, error: openersError } = await supabase
        .from('outreach_leads')
        .select('*')
        .in('id', viewerIds)
        .eq('reply_received', false)
        .is('call_pitch_sent_at', null)
        .limit(CALL_PITCH_BATCH);
      if (openersError) throw new Error(openersError.message);
      openers = data || [];
    }

    const seen = new Set();
    const leads = [...(repliers || []), ...openers]
      .filter((l) => (seen.has(l.id) ? false : seen.add(l.id)))
      .slice(0, CALL_PITCH_BATCH);
    out.due = leads.length;
    if (out.due === 0) return out;

    const { data: signups } = await supabase
      .from('lead_magnet_signups')
      .select('outreach_lead_id')
      .in('outreach_lead_id', leads.map((l) => l.id));
    const onDrip = new Set((signups || []).map((r) => r.outreach_lead_id));

    for (const lead of leads) {
      try {
        if (onDrip.has(lead.id) || lead.reply_intent === 'negative' || !lead.gmail_thread_id) {
          out.skipped++;
          continue;
        }
        const end = await readThreadEnd(lead.gmail_thread_id);
        if (!end || !end.lastIsOurs) {
          out.skipped++;
          continue;
        }
        const to = end.replyTo || lead.email;
        const first = String(lead.first_name || '').trim().split(/\s+/)[0];
        const body = buildCallPitch({ first });
        const subject = replySubject(lead.email_subject);
        if (dryRun) {
          out.drafts.push({ lead_id: lead.id, to, company_name: lead.company_name, subject, body });
          continue;
        }
        const { data: claimed, error: claimError } = await supabase
          .from('outreach_leads')
          .update({ call_pitch_sent_at: new Date().toISOString() })
          .eq('id', lead.id)
          .is('call_pitch_sent_at', null)
          .select('id');
        if (claimError || !claimed || claimed.length === 0) continue;
        try {
          await sendFollowup({
            to,
            subject,
            body,
            threadId: lead.gmail_thread_id,
            inReplyTo: lead.rfc_message_id,
            cta: { url: CALL_URL, label: CALL_CTA_LABEL },
          });
          out.sent++;
        } catch (err) {
          await supabase.from('outreach_leads').update({ call_pitch_sent_at: null }).eq('id', lead.id);
          throw err;
        }
        await sleep(randomDelay());
      } catch (err) {
        out.errors.push({ lead_id: lead.id, stage: 'call_pitch', error: err.message });
      }
    }
  } catch (err) {
    out.errors.push({ stage: 'call_pitch_query', error: err.message });
  }
  return out;
}

// ============================================================
// Main handler
// ============================================================
module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dryRun = req.query?.dry_run === '1';
  const rawLimit = parseInt(req.query?.limit, 10);
  const batchLimit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(BATCH_SIZE, rawLimit))
    : BATCH_SIZE;

  try {
    const callPitches = await sendGuideCallPitches({ dryRun });

    // Pull sent, un-replied leads whose follow-up is due and who still have
    // touches left. reply_received=false is the auto-stop.
    const nowIso = new Date().toISOString();
    let q = supabase
      .from('outreach_leads')
      .select('*')
      .eq('status', 'sent')
      .eq('reply_received', false)
      .lt('followup_stage', MAX_STAGE)
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', nowIso)
      .order('next_followup_at', { ascending: true })
      .limit(batchLimit);
    if (!INCLUDE_DTC) q = q.in('niche', Array.from(GUIDE_NICHES));
    const { data: leads, error: fetchError } = await q;

    if (fetchError) {
      return res.status(500).json({ error: 'Supabase fetch failed', detail: fetchError.message });
    }

    if (!leads || leads.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No follow-ups due',
        sent: 0,
        call_pitches: callPitches,
        timestamp: nowIso,
      });
    }

    const results = { sent: 0, failed: 0, skipped_replied: 0, skipped_signed_up: 0, dry_run: dryRun, errors: [], drafts: [] };

    // Guide leads who already signed up at /starter-kit are in the drip now —
    // stop the cold sequence so they don't get both. Matched by the lead id the
    // tracked link carries, plus the lead's own email as a fallback.
    const signedUpIds = new Set();
    const signedUpEmails = new Set();
    const guideLeads = leads.filter(isGuideLead);
    if (guideLeads.length > 0) {
      const [byLead, byEmail] = await Promise.all([
        supabase.from('lead_magnet_signups').select('outreach_lead_id').in('outreach_lead_id', guideLeads.map((l) => l.id)),
        supabase.from('lead_magnet_signups').select('email').in('email', guideLeads.map((l) => l.email)),
      ]);
      (byLead.data || []).forEach((r) => signedUpIds.add(r.outreach_lead_id));
      (byEmail.data || []).forEach((r) => signedUpEmails.add((r.email || '').toLowerCase()));
    }

    for (const lead of leads) {
      try {
        const guide = isGuideLead(lead);
        const maxStage = MAX_STAGE;

        // No salmon guides exist yet — never send elk guides to a salmon lead.
        if (lead.niche === 'salmon_guide') {
          if (!dryRun) {
            await supabase.from('outreach_leads').update({ next_followup_at: null }).eq('id', lead.id);
          }
          continue;
        }

        // A DTC lead already at its cap shouldn't be here, but never send past it.
        if ((lead.followup_stage || 0) >= maxStage) {
          if (!dryRun) {
            await supabase.from('outreach_leads').update({ next_followup_at: null }).eq('id', lead.id);
          }
          continue;
        }

        if (guide && (signedUpIds.has(lead.id) || signedUpEmails.has((lead.email || '').toLowerCase()))) {
          results.skipped_signed_up++;
          if (!dryRun) {
            await supabase.from('outreach_leads').update({ next_followup_at: null }).eq('id', lead.id);
          }
          continue;
        }

        // Safeguard: if the real Gmail thread shows the lead already replied,
        // never follow up. Flip reply_received so the state is corrected too.
        const replied = await threadHasInboundReply(lead.gmail_thread_id);
        if (replied === true) {
          results.skipped_replied++;
          if (!dryRun) {
            await supabase
              .from('outreach_leads')
              .update({
                reply_received: true,
                replied_at: lead.replied_at || new Date().toISOString(),
                next_followup_at: null,
              })
              .eq('id', lead.id);
          }
          continue;
        }

        const stage = lead.followup_stage || 0;
        // Follow-ups stay in-thread "Re:" replies to email 1. Guide leads get
        // the opt-in reminder (with a CTA button); DTC keeps its own copy.
        const subject = replySubject(lead.email_subject);
        const body = guide ? buildGuideFollowup(lead, stage) : buildFollowupBody(lead, stage);
        const cta = guide ? { url: signupUrl(lead), label: GUIDE_CTA_LABEL } : null;
        const newStage = stage + 1;
        const gapDays = DAYS_TO_FOLLOWUP_2;
        // Schedule the next touch only if we haven't hit the cap.
        const nextAt =
          newStage < maxStage
            ? new Date(Date.now() + gapDays * 24 * 60 * 60 * 1000).toISOString()
            : null;

        if (dryRun) {
          results.drafts.push({
            lead_id: lead.id,
            email: lead.email,
            company_name: lead.company_name,
            stage,
            subject,
            body,
            next_followup_at: nextAt,
            has_thread: Boolean(lead.gmail_thread_id),
          });
        } else {
          await sendFollowup({
            to: lead.email,
            subject,
            body,
            threadId: lead.gmail_thread_id,
            inReplyTo: lead.rfc_message_id,
            cta,
          });

          const { error: updateError } = await supabase
            .from('outreach_leads')
            .update({
              followup_stage: newStage,
              next_followup_at: nextAt,
            })
            .eq('id', lead.id);

          if (updateError) {
            results.failed++;
            results.errors.push({ lead_id: lead.id, stage: 'supabase_update', error: updateError.message });
            continue;
          }
          results.sent++;
        }

        if (!dryRun && lead !== leads[leads.length - 1]) {
          await sleep(randomDelay());
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ lead_id: lead.id, email: lead.email, stage: 'send', error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      batch_size: leads.length,
      ...results,
      call_pitches: callPitches,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
