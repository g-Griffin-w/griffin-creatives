const Anthropic = require('@anthropic-ai/sdk');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// Reply tracker
// Matches inbound Gmail replies to sent outreach_leads, classifies intent,
// and writes reply_received / replied_at / reply_text / reply_intent back to
// Supabase so per-niche decision gates are measurable.
//
// Trigger daily via cron-job.org (after the send job):
//   POST https://griffincreativelab.com/api/check-replies
//   Header: Authorization: Bearer <CRON_SECRET>
//   Add ?dry_run=1 to preview matches without writing.
//
// NOTE: this needs a Gmail refresh token with READ scope
// (gmail.readonly or gmail.modify). The send job only needs gmail.send, so you
// may have to re-consent with the readonly scope added before this works.
// ============================================================

const LOOKBACK_DAYS = 21;
const MAX_MESSAGES = 200;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// Extract the bare email address from a raw "From" header value.
function parseFromAddress(headerValue = '') {
  const angle = headerValue.match(/<([^>]+)>/);
  return (angle ? angle[1] : headerValue).trim().toLowerCase();
}

// Classify a reply with Haiku. Cheap, single word out. Failures -> 'unknown'.
async function classifyIntent(text) {
  if (!text) return 'unknown';
  try {
    const msg = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content:
            'Classify this reply to a cold email as exactly one word: ' +
            '"positive" (interested, wants the samples, asks a question), ' +
            '"neutral" (auto-reply, out-of-office, forwarded, vague), or ' +
            '"negative" (not interested, unsubscribe, annoyed).\n\nReply:\n"""' +
            String(text).slice(0, 800) +
            '"""\n\nOne word:',
        },
      ],
    });
    const w = (msg.content[0]?.text || '').toLowerCase();
    if (w.includes('positive')) return 'positive';
    if (w.includes('negative')) return 'negative';
    if (w.includes('neutral')) return 'neutral';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dryRun = req.query?.dry_run === '1';

  try {
    // 1. Pull sent leads that haven't been marked as replied yet.
    const { data: leads, error: fetchError } = await supabase
      .from('outreach_leads')
      .select('id,email,company_name,niche')
      .eq('status', 'sent')
      .eq('reply_received', false);

    if (fetchError) {
      return res.status(500).json({ error: 'Supabase fetch failed', detail: fetchError.message });
    }

    const byEmail = new Map();
    for (const lead of leads || []) {
      if (lead.email) byEmail.set(lead.email.toLowerCase(), lead);
    }

    if (byEmail.size === 0) {
      return res.status(200).json({
        success: true,
        message: 'No sent leads awaiting a reply',
        matched: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. List recent inbox messages.
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: `in:inbox newer_than:${LOOKBACK_DAYS}d`,
      maxResults: MAX_MESSAGES,
    });
    const messages = list.data.messages || [];

    const results = {
      scanned: messages.length,
      matched: 0,
      updated: 0,
      dry_run: dryRun,
      hits: [],
      errors: [],
    };
    const handledLeadIds = new Set();

    // 3. For each inbound message, see if the sender is one of our sent leads.
    for (const ref of messages) {
      try {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: ref.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject'],
        });
        const headers = full.data.payload?.headers || [];
        const fromHeader = (headers.find((h) => h.name === 'From') || {}).value || '';
        const fromAddr = parseFromAddress(fromHeader);

        const lead = byEmail.get(fromAddr);
        if (!lead || handledLeadIds.has(lead.id)) continue;
        handledLeadIds.add(lead.id);
        results.matched++;

        const snippet = full.data.snippet || '';
        const intent = dryRun ? 'skipped' : await classifyIntent(snippet);

        results.hits.push({
          lead_id: lead.id,
          email: fromAddr,
          company: lead.company_name,
          niche: lead.niche,
          intent,
          snippet: snippet.slice(0, 160),
        });

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('outreach_leads')
            .update({
              reply_received: true,
              replied_at: new Date().toISOString(),
              reply_text: snippet.slice(0, 2000),
              reply_intent: intent,
            })
            .eq('id', lead.id);

          if (updateError) {
            results.errors.push({ lead_id: lead.id, error: updateError.message });
          } else {
            results.updated++;
          }
        }
      } catch (err) {
        results.errors.push({ message_id: ref.id, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
