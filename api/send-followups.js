const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// Follow-up sender
// Sends threaded follow-ups to leads that were emailed but haven't replied.
// DTC: two touches — stage 0 -> follow-up #1 (bump), stage 1 -> follow-up #2 (breakup).
// Guide niches: three touches, each a separate email pitching the next free kit
// item (see GUIDE_* constants and buildGuideFollowup below).
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

// Guide niches (elk_guide / salmon_guide) run a different play: the initial
// email pitches ONE free kit item, and each follow-up pitches the next one as
// its own email (new thread, new subject) so the prospect sees our name four
// times with something useful each time — 4 emails total, 3 days apart.
// The sequence stops on reply (same as DTC) and when the lead signs up at
// /starter-kit, since the drip in send-starter-kit-drip.js takes over then.
const GUIDE_NICHES = new Set(['elk_guide', 'salmon_guide']);
const GUIDE_MAX_STAGE = 3;
const GUIDE_DAYS_BETWEEN = 3;
const isGuideLead = (lead) => GUIDE_NICHES.has(lead.niche);

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

// Guide follow-ups. Email 1 (the rebooking email) is written by send-outreach.js;
// stage 0/1/2 here are emails 2/3/4. Each pitches exactly one free item and
// links to the same signup page — one signup unlocks the whole kit. Copy only
// offers work we'll do after signup; nothing claims it's already done.
const GUIDE_SIGNATURE = '\n\ngabriel\ngriffincreative\ngriffincreativelab.com';

function buildGuideFollowup(lead, stage) {
  const first = firstName(lead);
  const co = companyName(lead);
  const link = `https://www.griffincreativelab.com/starter-kit?lead=${lead.id}`;
  const salmon = lead.niche === 'salmon_guide';

  if (stage === 0) {
    const search = salmon ? 'a guided fishing trip' : 'an elk hunt';
    return {
      subject: `a free google profile set-up for ${co}`,
      body:
        `hi ${first},\n\n` +
        `gabriel from griffincreative again — different free thing this time.\n\n` +
        `when someone searches for ${search}, your google business profile is usually the first thing they see. ` +
        `we'll claim it, fill it out, and set your service area to the country you actually work — ` +
        `the finished thing, not an audit.\n\n` +
        `it's free, and all we need from you is to add us as a manager (two minutes). start here: ${link}` +
        GUIDE_SIGNATURE,
    };
  }
  if (stage === 1) {
    const plan = salmon
      ? `your runs come in two windows a year, and most guides don't have anything ready to send when one opens. ` +
        `we'll map out your whole year around them — pre-run, in-run, off-season — with what to send past clients and when.`
      : `draw results land once a year and it's the one week every tag-holder is paying attention. ` +
        `we'll map out your whole year around it — application window, results week, pre-season, post-season — ` +
        `with what to send past clients and when.`;
    return {
      subject: `a free season calendar for ${co}`,
      body:
        `hi ${first},\n\n` +
        `griffincreative again — another free one, no strings.\n\n` +
        `${plan}\n\n` +
        `yours either way: ${link}` +
        GUIDE_SIGNATURE,
    };
  }
  // stage 2 — fourth and last
  return {
    subject: `a free review-request message for ${co}`,
    body:
      `hi ${first},\n\n` +
      `griffincreative, last free one.\n\n` +
      `guests are happiest the week they get home, and that's the best moment to ask for a review — ` +
      `as long as it takes one tap. we'll write you the message and set up your direct google review link ` +
      `so it's ready for your next trip.\n\n` +
      `free, yours either way: ${link}` +
      GUIDE_SIGNATURE,
  };
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

// Send an in-thread follow-up. Threads via Gmail threadId + RFC
// In-Reply-To/References headers so it lands as a reply, not a new email.
async function sendFollowup({ to, subject, body, threadId, inReplyTo }) {
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
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ];
  // Threading headers — only add when we actually have the original id.
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  const bodyEncoded = Buffer.from(body, 'utf-8')
    .toString('base64')
    .match(/.{1,76}/g)
    .join('\r\n');

  const message = headers.join('\r\n') + '\r\n\r\n' + bodyEncoded;

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
    // Pull sent, un-replied leads whose follow-up is due and who still have
    // touches left. reply_received=false is the auto-stop.
    const nowIso = new Date().toISOString();
    const { data: leads, error: fetchError } = await supabase
      .from('outreach_leads')
      .select('*')
      .eq('status', 'sent')
      .eq('reply_received', false)
      .lt('followup_stage', GUIDE_MAX_STAGE) // widest cap; per-lead cap enforced below
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', nowIso)
      .order('next_followup_at', { ascending: true })
      .limit(batchLimit);

    if (fetchError) {
      return res.status(500).json({ error: 'Supabase fetch failed', detail: fetchError.message });
    }

    if (!leads || leads.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No follow-ups due',
        sent: 0,
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
        const maxStage = guide ? GUIDE_MAX_STAGE : MAX_STAGE;

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
        // Guide follow-ups are their own emails (fresh subject, new thread);
        // DTC follow-ups stay in-thread "Re:" bumps.
        let subject;
        let body;
        if (guide) {
          ({ subject, body } = buildGuideFollowup(lead, stage));
        } else {
          subject = replySubject(lead.email_subject);
          body = buildFollowupBody(lead, stage);
        }
        const newStage = stage + 1;
        const gapDays = guide ? GUIDE_DAYS_BETWEEN : DAYS_TO_FOLLOWUP_2;
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
            // Guide emails go out as new threads so each shows up as its own
            // message in the inbox instead of collapsing under email 1.
            threadId: guide ? null : lead.gmail_thread_id,
            inReplyTo: guide ? null : lead.rfc_message_id,
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
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
