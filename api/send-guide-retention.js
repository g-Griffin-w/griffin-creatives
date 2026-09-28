const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// Guide "book next season" retention sender.
//
// This is NOT outreach — outreach_leads/send-outreach.js is OUR cold-prospect
// list. This sends a paying guide client's own APPROVED sequence to THEIR
// past clients (guide_client_contacts), timed to when their season's
// retention_launch_at has actually arrived (niche_seasons) — for salmon
// guides that's the moment the current season closes, per Gabriel
// (2026-09-26): they open next-season booking as soon as this one ends.
//
// Nothing sends unless a human approved the copy first (guide_retention_sequences
// .approved=true, set by scripts/approve-retention-sequence.js) — same gate
// as make-samples.js's --approve for images. This code never calls Claude or
// improvises copy; it only sends what was already reviewed.
//
// Trigger daily via cron-job.org / Vercel cron:
//   POST /api/send-guide-retention
//   Header: Authorization: Bearer <CRON_SECRET>
//   ?dry_run=1 to preview. ?limit=N to cap the batch.
// ============================================================

const BATCH_SIZE = Math.max(
  1,
  Math.min(30, parseInt(process.env.GUIDE_RETENTION_BATCH_SIZE, 10) || 20),
);
const DELAY_MS_MIN = 3000;
const DELAY_MS_MAX = 7000;

// Fallback gap (days) between stages if a drafted "Day N" label can't be
// parsed — keeps the sequence moving instead of silently stalling forever.
const DEFAULT_STAGE_GAP_DAYS = 5;

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

function encodeMimeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const base64 = Buffer.from(value, 'utf-8').toString('base64');
  return `=?utf-8?B?${base64}?=`;
}

function generateMessageId(fromEmail) {
  const domain = (fromEmail && fromEmail.split('@')[1]) || 'griffincreativelab.com';
  const rand = Math.random().toString(36).slice(2);
  return `<${Date.now()}.${rand}@${domain}>`;
}

// Parses "Day 0" / "Day 5" -> 0 / 5. Returns null if the label doesn't match
// (a human editing the approved copy could rename these) so the caller can
// fall back to DEFAULT_STAGE_GAP_DAYS rather than crash.
function parseDayLabel(label) {
  const m = String(label || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function daysUntilNextStage(emails, stageIndex) {
  const cur = parseDayLabel(emails[stageIndex]?.send_day);
  const next = parseDayLabel(emails[stageIndex + 1]?.send_day);
  if (cur == null || next == null || next <= cur) return DEFAULT_STAGE_GAP_DAYS;
  return next - cur;
}

async function sendRetentionEmail({ to, subject, body, threadId, inReplyTo }) {
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
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  const bodyEncoded = Buffer.from(body, 'utf-8').toString('base64').match(/.{1,76}/g).join('\r\n');
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () => Math.floor(Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN)) + DELAY_MS_MIN;

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dryRun = req.query?.dry_run === '1';
  const rawLimit = parseInt(req.query?.limit, 10);
  const batchLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(BATCH_SIZE, rawLimit)) : BATCH_SIZE;

  try {
    const today = new Date().toISOString().slice(0, 10);

    // Which niches have a season whose retention window has actually opened?
    // This gates ONLY brand-new (stage 0) sends — a sequence already in
    // motion just keeps following its own next_send_at below.
    const { data: openSeasons, error: seasonErr } = await supabase
      .from('niche_seasons')
      .select('niche, season_year')
      .lte('retention_launch_at', today);
    if (seasonErr) return res.status(500).json({ error: 'niche_seasons fetch failed', detail: seasonErr.message });

    const openNiches = [...new Set((openSeasons || []).map((s) => s.niche))];
    // Most recent season_year per niche — if two rows are both "open"
    // (e.g. last season's tail plus this season already seeded), the
    // approved sequence to use is the newest one.
    const latestSeasonYearByNiche = {};
    for (const s of openSeasons || []) {
      if (!latestSeasonYearByNiche[s.niche] || s.season_year > latestSeasonYearByNiche[s.niche]) {
        latestSeasonYearByNiche[s.niche] = s.season_year;
      }
    }

    const nowIso = new Date().toISOString();
    const queries = [
      // Brand-new sends: stage 0, never touched, niche's window is open.
      supabase
        .from('guide_client_contacts')
        .select('*')
        .eq('status', 'queued')
        .eq('sequence_stage', 0)
        .in('niche', openNiches.length ? openNiches : ['__none__'])
        .limit(batchLimit),
      // In-flight sequences: just follow next_send_at, same as send-followups.js.
      supabase
        .from('guide_client_contacts')
        .select('*')
        .eq('status', 'sent')
        .gt('sequence_stage', 0)
        .not('next_send_at', 'is', null)
        .lte('next_send_at', nowIso)
        .limit(batchLimit),
    ];
    const [freshRes, followupRes] = await Promise.all(queries);
    if (freshRes.error) return res.status(500).json({ error: 'contacts fetch failed', detail: freshRes.error.message });
    if (followupRes.error) return res.status(500).json({ error: 'contacts fetch failed', detail: followupRes.error.message });

    const contacts = [...(freshRes.data || []), ...(followupRes.data || [])].slice(0, batchLimit);

    if (contacts.length === 0) {
      return res.status(200).json({ success: true, message: 'No retention sends due', sent: 0, timestamp: nowIso });
    }

    // Cache approved sequences per guide_client_id — several contacts share one.
    const sequenceCache = new Map();
    async function getApprovedSequence(guideClientId, niche) {
      const cacheKey = guideClientId;
      if (sequenceCache.has(cacheKey)) return sequenceCache.get(cacheKey);
      const seasonYear = latestSeasonYearByNiche[niche];
      const { data, error } = await supabase
        .from('guide_retention_sequences')
        .select('emails, approved')
        .eq('guide_client_id', guideClientId)
        .eq('niche', niche)
        .eq('season_year', seasonYear)
        .eq('approved', true)
        .maybeSingle();
      const result = error ? null : data;
      sequenceCache.set(cacheKey, result);
      return result;
    }

    const results = { sent: 0, failed: 0, skipped_unapproved: 0, dry_run: dryRun, errors: [], drafts: [] };

    for (const contact of contacts) {
      try {
        const sequence = await getApprovedSequence(contact.guide_client_id, contact.niche);
        if (!sequence || !Array.isArray(sequence.emails) || sequence.emails.length === 0) {
          // No approved copy for this client yet — never invent a send.
          results.skipped_unapproved++;
          continue;
        }

        const stage = contact.sequence_stage || 0;
        const email = sequence.emails[stage];
        if (!email) {
          // Sequence exhausted — mark done, nothing left to send.
          if (!dryRun) {
            await supabase.from('guide_client_contacts').update({ next_send_at: null }).eq('id', contact.id);
          }
          continue;
        }

        const newStage = stage + 1;
        const hasNext = Boolean(sequence.emails[newStage]);
        const nextAt = hasNext
          ? new Date(Date.now() + daysUntilNextStage(sequence.emails, stage) * 24 * 60 * 60 * 1000).toISOString()
          : null;

        if (dryRun) {
          results.drafts.push({
            contact_id: contact.id,
            email: contact.email,
            guide_client_id: contact.guide_client_id,
            stage,
            subject: email.subject,
            body: email.body,
            next_send_at: nextAt,
          });
        } else {
          const sendResult = await sendRetentionEmail({
            to: contact.email,
            subject: email.subject,
            body: email.body,
            threadId: contact.gmail_thread_id,
            inReplyTo: contact.rfc_message_id,
          });

          const { error: updateError } = await supabase
            .from('guide_client_contacts')
            .update({
              status: 'sent',
              sequence_stage: newStage,
              next_send_at: nextAt,
              gmail_thread_id: contact.gmail_thread_id || sendResult.threadId || null,
              rfc_message_id: contact.rfc_message_id || null,
            })
            .eq('id', contact.id);

          if (updateError) {
            results.failed++;
            results.errors.push({ contact_id: contact.id, stage: 'supabase_update', error: updateError.message });
            continue;
          }
          results.sent++;
        }

        if (!dryRun && contact !== contacts[contacts.length - 1]) {
          await sleep(randomDelay());
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ contact_id: contact.id, email: contact.email, stage: 'send', error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      batch_size: contacts.length,
      open_niches: openNiches,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
