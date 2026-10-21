// api/send-partner-outreach.js
//
// Daily cron: emails REFERRAL PARTNERS (photographers, insurance agents,
// taxidermists, tack and supply shops) from the separate partner_leads table,
// not the outfitter outreach_leads table.
//
// The email is one plain-text note with one idea: send us any outfitter you
// work with and we'll review their Google profile for free. No AI generation;
// the text is a fixed template so every send is predictable.
//
// Safety:
//   - Only rows with status = 'queued' are sent. Scraped rows start as
//     'review', so nothing goes out until someone sets them to 'queued'.
//   - Small daily batch (PARTNER_BATCH_SIZE, default 10, max 30).
//   - One follow-up, 5 days later, in the same thread. It is skipped if the
//     partner already replied.
//   - Every message carries the same compliance footer as the outfitter emails
//     (name, postal address, reply "stop"). A reply of any kind stops follow-ups.
//
// Usage (Bearer CRON_SECRET required):
//   GET /api/send-partner-outreach              send
//   GET /api/send-partner-outreach?dry_run=1    return the drafts, send nothing
//   GET /api/send-partner-outreach?limit=3      cap the batch

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const BATCH_SIZE = Math.max(1, Math.min(30, parseInt(process.env.PARTNER_BATCH_SIZE, 10) || 10));
const FOLLOWUP_DAYS = 5;
const DELAY_MS_MIN = 5000;
const DELAY_MS_MAX = 15000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const oauth2Client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () => Math.floor(Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN)) + DELAY_MS_MIN;

const STATE_NAMES = {
  OR: 'Oregon', ID: 'Idaho', MT: 'Montana', WA: 'Washington', CA: 'California', WY: 'Wyoming', CO: 'Colorado', UT: 'Utah',
};
const stateName = (s) => STATE_NAMES[String(s || '').toUpperCase()] || s || 'the West';

// What the partner already does for outfitters, in one clause that is true for
// the category without claiming anything specific about the business.
const WHAT_THEY_DO = {
  photographer: 'photographers and videographers who shoot hunts are in a good position to see what outfitters need',
  insurance: 'agents who insure guides and outfitters talk to a lot of outfitters',
  taxidermist: 'taxidermists hear from outfitters and their hunters all season',
  tack_supply: 'tack and supply shops see most of the outfitters in their area',
  supplier: 'outfitters rely on gear and camp equipment from companies like yours',
  other: 'you probably know a lot of outfitters',
};

// What an outfitter might ask us about, so we can refer them back to the partner.
const REFERRAL_TOPIC = {
  photographer: 'photos or video',
  insurance: 'insurance',
  taxidermist: 'taxidermy',
  tack_supply: 'tack or pack gear',
  supplier: 'gear or camp equipment',
  other: 'a business like yours',
};

const firstName = (lead) => {
  const n = String(lead.contact_name || '').trim().split(/\s+/)[0];
  return /^[A-Za-z'’-]{2,}$/.test(n) ? n : 'there';
};

const cleanName = (name) =>
  String(name || '')
    .replace(/[®™©]/g, '')
    .replace(/\s+(LLC|L\.L\.C\.|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Ltd\.?)\.?$/i, '')
    .trim();

const SUBJECT = 'A free Google profile review for your outfitter clients';

function buildFirst(lead) {
  const state = stateName(lead.state);
  const what = WHAT_THEY_DO[lead.category] || WHAT_THEY_DO.other;
  return (
    `Hi ${firstName(lead)},\n\n` +
    `I'm Gabriel with Griffin Creative Labs. We're a small marketing shop that works with elk outfitters in the West.\n\n` +
    `I'm reaching out to ${cleanName(lead.company_name)} because ${what}. A lot of outfitters in ${state} have a Google profile that isn't doing much for them: few photos, few reviews, old details. It's often the first place a hunter looks.\n\n` +
    `Here's a simple offer. If you send me the name of any outfitter you work with, I'll review their Google profile for free and send them three specific fixes. No strings, and they can use it whether or not we ever work together.\n\n` +
    `And when an outfitter I talk to asks about ${REFERRAL_TOPIC[lead.category] || 'a business like yours'}, I'll send them your way.\n\n` +
    `Would that be useful? A one-line reply is plenty.\n\n` +
    `Gabriel\nGriffin Creative Labs · hello@griffincreativelab.com · (503) 779-8493`
  );
}

function buildFollowup(lead) {
  return (
    `Hi ${firstName(lead)},\n\n` +
    `Floating this back up in case it got buried. The offer is simple: send me any outfitter's name and I'll review their Google profile for free and send three fixes.\n\n` +
    `If it's not a fit, just reply "no thanks" and I won't follow up again.\n\n` +
    `Gabriel`
  );
}

// ---------- Gmail helpers ----------
function encodeMimeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?utf-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}
const generateMessageId = (fromEmail) =>
  `<${Date.now()}.${Math.random().toString(36).slice(2)}@${(fromEmail && fromEmail.split('@')[1]) || 'griffincreativelab.com'}>`;
const b64 = (str) => Buffer.from(str, 'utf-8').toString('base64').match(/.{1,76}/g).join('\r\n');

// Same footer as api/send-outreach.js: who we are, a postal address, opt-out.
const EMAIL_FOOTER =
  '\n\n—\nGriffin Creative Labs · 203 SE 7th St, Sublimity, OR 97385\n' +
  'Not for you? Just reply "stop" and I won\'t email you again.';

async function sendEmail({ to, subject, body, threadId, inReplyTo }) {
  const fromEmail = process.env.GMAIL_FROM_EMAIL;
  const fromName = process.env.GMAIL_FROM_NAME;
  const rfcMessageId = generateMessageId(fromEmail);
  const headers = [
    `From: ${encodeMimeHeader(fromName)} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    `Message-ID: ${rfcMessageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ];
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`);
  const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + b64(body + EMAIL_FOOTER))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const requestBody = { raw };
  if (threadId) requestBody.threadId = threadId;
  const result = await gmail.users.messages.send({ userId: 'me', requestBody });
  return { ...result.data, rfcMessageId };
}

// true = someone other than us wrote in the thread, false = no reply, null = couldn't check.
async function threadHasReply(threadId) {
  if (!threadId) return null;
  const ours = (process.env.GMAIL_FROM_EMAIL || '').toLowerCase();
  try {
    const t = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'metadata', metadataHeaders: ['From'] });
    for (const m of t.data.messages || []) {
      const from = ((m.payload?.headers || []).find((h) => h.name === 'From') || {}).value || '';
      if (ours && !from.toLowerCase().includes(ours)) return true;
    }
    return false;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if ((req.headers.authorization || '') !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const dryRun = req.query?.dry_run === '1';
  const rawLimit = parseInt(req.query?.limit, 10);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(BATCH_SIZE, rawLimit)) : BATCH_SIZE;
  const out = { dry_run: dryRun, first_sent: 0, followups_sent: 0, replies_found: 0, failed: 0, errors: [], drafts: [] };

  try {
    // 1) Follow-ups that are due. Skip anyone who replied (or whose thread we can't verify).
    const { data: due, error: dueErr } = await supabase
      .from('partner_leads')
      .select('*')
      .eq('status', 'sent')
      .eq('followup_stage', 0)
      .eq('reply_received', false)
      .lte('next_followup_at', new Date().toISOString())
      .limit(limit);
    if (dueErr) throw new Error(dueErr.message);

    for (const lead of due || []) {
      try {
        const replied = await threadHasReply(lead.gmail_thread_id);
        if (replied === true) {
          out.replies_found++;
          if (!dryRun) {
            await supabase.from('partner_leads').update({ reply_received: true, status: 'replied', replied_at: new Date().toISOString() }).eq('id', lead.id);
          }
          continue;
        }
        if (replied === null) continue; // can't verify, so don't risk a second email
        const subject = /^re:/i.test(lead.email_subject || '') ? lead.email_subject : `Re: ${lead.email_subject || SUBJECT}`;
        const body = buildFollowup(lead);
        if (dryRun) {
          out.drafts.push({ kind: 'followup', email: lead.email, subject, body });
          continue;
        }
        await sendEmail({ to: lead.email, subject, body, threadId: lead.gmail_thread_id, inReplyTo: lead.rfc_message_id });
        await supabase.from('partner_leads').update({ followup_stage: 1, next_followup_at: null }).eq('id', lead.id);
        out.followups_sent++;
        await sleep(randomDelay());
      } catch (err) {
        out.failed++;
        out.errors.push({ id: lead.id, stage: 'followup', error: err.message });
      }
    }

    // 2) First emails to queued partners.
    const room = Math.max(0, limit - out.followups_sent);
    // A dry run may preview rows in another status (e.g. ?status=review). Real sends only use 'queued'.
    const wantStatus = dryRun && req.query?.status ? String(req.query.status) : 'queued';
    const { data: queued, error: qErr } = room
      ? await supabase.from('partner_leads').select('*').eq('status', wantStatus).order('created_at', { ascending: true }).limit(room)
      : { data: [], error: null };
    if (qErr) throw new Error(qErr.message);

    for (const lead of queued || []) {
      try {
        const body = buildFirst(lead);
        if (dryRun) {
          out.drafts.push({ kind: 'first', email: lead.email, company: lead.company_name, category: lead.category, state: lead.state, subject: SUBJECT, body });
          continue;
        }
        const sent = await sendEmail({ to: lead.email, subject: SUBJECT, body });
        const { error: upErr } = await supabase
          .from('partner_leads')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            email_subject: SUBJECT,
            email_body: body,
            gmail_thread_id: sent.threadId || null,
            rfc_message_id: sent.rfcMessageId || null,
            followup_stage: 0,
            next_followup_at: new Date(Date.now() + FOLLOWUP_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', lead.id);
        if (upErr) {
          out.failed++;
          out.errors.push({ id: lead.id, stage: 'update', error: upErr.message });
          continue;
        }
        out.first_sent++;
        if (lead !== queued[queued.length - 1]) await sleep(randomDelay());
      } catch (err) {
        out.failed++;
        out.errors.push({ id: lead.id, email: lead.email, stage: 'first', error: err.message });
      }
    }

    return res.status(200).json({ success: true, ...out, timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, ...out });
  }
};

// A batch of 10 with 5-15 s pauses between sends takes under 3 minutes.
module.exports.config = { maxDuration: 300 };
