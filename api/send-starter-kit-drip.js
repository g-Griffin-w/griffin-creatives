const Anthropic = require('@anthropic-ai/sdk');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// The Booked Out Starter Kit — 5-stage drip, one touch every 3 days.
// See LEAD-MAGNETS.md for the full design. Stages 1-4 are the free kit
// items, stage 5 is the pitch for the paid Booked Out plan.
//
// Order matters: the one item that requires an action FROM them (granting
// Google Business Profile access) comes last among the free items, after
// three real deliverables have already built trust.
// ============================================================
const DRIP_INTERVAL_DAYS = 3;
const MAX_PER_RUN = 25;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

const CANONICAL_SIGNATURE = '\n\ngabriel\ngriffincreative\ngriffincreativelab.com';

// Only OR/ID are real-date-verified this session (ODFW/IDFG, Oct 2026
// research). MT/WA/CA fall back to an honest "check your state agency" line
// rather than a fabricated date — see BLUEPRINTS.md honest-capacity pattern.
const SEASON_INFO = {
  OR: { apply: 'by May 15', results: 'mid-June' },
  ID: { apply: 'May 1 through June 5', results: 'mid-June to early July (a second draw runs Aug 5-25 for leftover tags)' },
};

function seasonLineFor(state) {
  const info = SEASON_INFO[state];
  if (info) {
    return `Apply by ${info.apply}, results land ${info.results}.`;
  }
  return `(check your state wildlife agency's own application window and results date — not yet verified on our end for ${state || 'your state'})`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function encodeMimeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?utf-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}

function generateMessageId(fromEmail) {
  const domain = (fromEmail && fromEmail.split('@')[1]) || 'griffincreativelab.com';
  return `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`;
}

async function sendEmail({ to, subject, body }) {
  const fromEmail = process.env.GMAIL_FROM_EMAIL;
  const fromName = process.env.GMAIL_FROM_NAME;
  const headers = [
    `From: ${encodeMimeHeader(fromName)} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    `Message-ID: ${generateMessageId(fromEmail)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ];
  const bodyEncoded = Buffer.from(body, 'utf-8').toString('base64').match(/.{1,76}/g).join('\r\n');
  const message = headers.join('\r\n') + '\r\n\r\n' + bodyEncoded;
  const encoded = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
}

// Pull real lead context when this signup came from a tracked outreach link.
// Returns sensible generic fallbacks for a cold social signup instead of
// blocking — every stage must still read as a real, finished thing.
async function getBusinessContext(signup) {
  if (!signup.outreach_lead_id) {
    return { companyName: 'your business', state: '', niche: 'elk_guide' };
  }
  const { data: lead } = await supabase
    .from('outreach_leads')
    .select('company_name, company_state, niche')
    .eq('id', signup.outreach_lead_id)
    .maybeSingle();
  if (!lead) return { companyName: 'your business', state: '', niche: 'elk_guide' };
  return {
    companyName: lead.company_name || 'your business',
    state: lead.company_state || '',
    niche: lead.niche || 'elk_guide',
  };
}

// ---------- Stage content builders ----------
// Each returns { subject, body }. Stages 1, 3, 4, 5 are deterministic
// templates (no AI spend). Stage 2 is the one Claude call per signup.

function stage1_reviewRequest({ companyName }) {
  const subject = `item 1: your review-request template`;
  const body = `hey,

first thing from the starter kit — a review-request message plus how to get your own direct review link, ready to use after your very next hunt.

the message (text or email, your call):

"hey — really glad we got to put you on one this season. if you've got 60 seconds, a review helps other hunters find us just as much as word of mouth does: [your review link]"

to get your own direct link: open your Google Business Profile (or search "${companyName} google business profile" if you haven't claimed it yet), tap "get more reviews," and it hands you a shareable link instantly — paste that in place of [your review link] above. works as a text, an email, or printed as a QR code for camp.

next thing lands in a few days.`;
  return { subject, body: body + CANONICAL_SIGNATURE };
}

async function stage2_emailSequence({ companyName, state, niche }) {
  const activity = niche === 'salmon_guide' ? 'salmon fishing guide' : 'elk hunting outfitter';
  const prompt = `You are drafting a real, finished "book next season" email for ${companyName}, a real ${activity}${state ? ` in ${state}` : ''}. This is being delivered as a free, finished lead magnet to a business that just signed up for it — not a demo, not a sample with placeholders. Write ONE short email (under 120 words) that ${companyName} could send to their own past clients, to be sent the week their season ends, asking them to lock in next season's dates before someone else takes their spot. Casual, warm, lowercase style (never capitalize a sentence-starting "i"), no fluff, no invented facts about ${companyName} beyond what's given, no exclamation points. End with a short, direct call to reply or book. Output JSON only: {"subject": "...", "body": "..."}`;
  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = msg.content.find((b) => b.type === 'text');
  const cleaned = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  const parsed = JSON.parse(cleaned.slice(first, last + 1));

  const subject = `item 2: your "book next season" email`;
  const body = `here's item 2 — a real email ${companyName} can send past clients, yours to use starting now:

---
subject: ${parsed.subject}

${parsed.body}
---

paste that into whatever you already send from. next thing lands in a few days.`;
  return { subject, body: body + CANONICAL_SIGNATURE };
}

function stage3_campaignCalendar({ companyName, state }) {
  const subject = `item 3: your campaign calendar`;
  const body = `item 3 — a real month-by-month calendar for ${companyName}, built off ${state ? state + "'s" : 'your state\'s'} actual tag-draw timing:

PRE-DRAW (apr-may) — push past clients to apply now. ${seasonLineFor(state)}
RESULTS WINDOW (jun-jul) — tag-holders feel real urgency here. heaviest window for both new leads and past-client booking.
PRE-SEASON (aug-sep) — get real trip photos flowing, Google profile fresh.
IN-SEASON (sep-nov) — light touch, let bookings run, collect proof for next year.
POST-SEASON (dec) — send the book-next-season email (item 2) before anyone else gets to your client list first.

next thing lands in a few days — the last one needs a quick action from you.`;
  return { subject, body: body + CANONICAL_SIGNATURE };
}

function stage4_gbpAsk({ companyName }) {
  const subject = `item 4: let's actually set up your Google profile`;
  const body = `last free item — and it's the one we can't do without you.

we'll claim, fill out, and optimize ${companyName}'s Google Business Profile for free — not an audit, the finished thing: right category, service area set to your real hunting units, a few seeded questions people actually search.

to do it we need to be added as a manager. two minutes:
1. open business.google.com
2. select ${companyName} (or claim it if you haven't yet)
3. settings -> managers -> add hello@griffincreativelab.com

reply once it's done and we'll have it finished within a couple days.`;
  return { subject, body: body + CANONICAL_SIGNATURE };
}

function stage5_pitch({ companyName }) {
  const subject = `the last thing`;
  const body = `that's the full kit — a real review system, a real retention email, a real season calendar, and (once you add us) a real Google profile.

all four were free, no catch, and they're yours either way.

here's the thing: all four of those are a one-time setup. the actual hard part is doing it again every season, catching next year's draw dates, sending the retention email on time, keeping proof content flowing before bookings slow down.

that's the whole job for Booked Out — $2,800/mo, we run all of it ongoing instead of ${companyName} doing it once and letting it go stale. no contract, 90-day guarantee: if we don't get you at least one booked client in 90 days, you get it back.

want to talk it through? reply here or book a time: griffincreativelab.com#contact`;
  return { subject, body: body + CANONICAL_SIGNATURE };
}

async function buildStageEmail(stage, ctx) {
  switch (stage) {
    case 1: return stage1_reviewRequest(ctx);
    case 2: return stage2_emailSequence(ctx);
    case 3: return stage3_campaignCalendar(ctx);
    case 4: return stage4_gbpAsk(ctx);
    case 5: return stage5_pitch(ctx);
    default: throw new Error(`unknown drip stage ${stage}`);
  }
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

    const results = { processed: 0, failed: 0, dry_run: dryRun, errors: [] };

    for (const signup of due) {
      try {
        const ctx = await getBusinessContext(signup);
        const nextStage = signup.drip_stage + 1;
        const { subject, body } = await buildStageEmail(nextStage, ctx);

        if (!dryRun) {
          await sendEmail({ to: signup.email, subject, body });
          const nextDripAt = nextStage < 5
            ? new Date(Date.now() + DRIP_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
            : null;
          const { error: updateErr } = await supabase
            .from('lead_magnet_signups')
            .update({ drip_stage: nextStage, next_drip_at: nextDripAt })
            .eq('id', signup.id);
          if (updateErr) throw new Error(`supabase update failed: ${updateErr.message}`);
        }

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
