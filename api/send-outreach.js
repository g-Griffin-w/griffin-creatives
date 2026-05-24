const Anthropic = require('@anthropic-ai/sdk');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// Configuration
// ============================================================
const BATCH_SIZE = 25;
const DELAY_MS_MIN = 5000;
const DELAY_MS_MAX = 15000;

// ============================================================
// Clients
// ============================================================
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);
oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// ============================================================
// Cold email prompt (Phase 4 design)
// ============================================================
const COLD_EMAIL_PROMPT = `You are a cold email copywriter for GriffinCreative, a done-for-you AI ad creative agency for small businesses.

Your job: write a personalized cold email using the EXACT template provided. Casual lowercase, direct, no fluff.

LEAD INFO:
- First name: {{first_name}}
- Job title: {{job_title}}
- Company: {{company_name}}
- City: {{company_city}}
- State: {{company_state}}
- Niche: {{niche}}

EMAIL TEMPLATE (follow exactly):
---
Subject: {{first_name}} — 30 seconds?

Hey {{first_name}},

Saw {{company_name}} in {{city}}. How are you handling your ad creative right now?

Most {{niche_term}} I work with hate agencies (and the $5k+/mo bills). Happy to send you a free 5-min Loom audit of your current ads to show what I'd improve — no pitch, just curious if there's a fit.

Yes or no?

Gabriel
GriffinCreative
griffincreativelab.com
---

NICHE TERM mapping:
- roofing → "contractors"
- plumbing → "contractors"
- insurance → "insurance agencies"

DATA HANDLING RULES:
- If first_name is missing or empty → use "there"
- If city is missing or empty → change opening to "Saw {{company_name}} online" (drop the city reference entirely)
- If company_name ends in " LLC", " Inc", " Inc.", " Corp", " Corporation" — drop the suffix in the email for cleaner copy
- If job_title contains "Owner" or "Founder" — keep tone direct
- If job_title contains "CEO" or "President" — slightly more professional but still casual

STYLE RULES:
- Casual lowercase opener ("hey [name]" not "Hi [Name]")
- Total email under 100 words
- NO links in the body
- NO urgency words (URGENT, FREE, LIMITED, ACT NOW)
- NO excessive punctuation or all caps
- The final question must always be a simple yes/no
- Signature exactly: "Gabriel\\nGriffinCreative\\ngriffincreativelab.com"

OUTPUT FORMAT (JSON only, no markdown fences, no preamble):
{
  "subject": "...",
  "body": "..."
}`;

// ============================================================
// Helpers
// ============================================================

// Build the Claude prompt with lead data filled in
function buildPrompt(lead) {
  return COLD_EMAIL_PROMPT
    .replace(/{{first_name}}/g, lead.first_name || '')
    .replace(/{{job_title}}/g, lead.job_title || '')
    .replace(/{{company_name}}/g, lead.company_name || '')
    .replace(/{{company_city}}/g, lead.company_city || '')
    .replace(/{{company_state}}/g, lead.company_state || '')
    .replace(/{{niche}}/g, lead.niche || '');
}

// Parse Claude's JSON response (strip any markdown fences if Claude adds them)
function parseClaudeJson(text) {
  if (!text) throw new Error('Empty response from Claude');
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  return JSON.parse(cleaned);
}

// Generate the personalized email via Claude
async function generateEmail(lead) {
  const prompt = buildPrompt(lead);
  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content[0].text;
  const parsed = parseClaudeJson(text);
  if (!parsed.subject || !parsed.body) {
    throw new Error('Claude returned malformed email (missing subject or body)');
  }
  return parsed;
}

// MIME-encode a header value if it contains non-ASCII characters (RFC 2047).
// Required for Subject lines with em dashes, smart quotes, emojis, etc.
function encodeMimeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const base64 = Buffer.from(value, 'utf-8').toString('base64');
  return `=?utf-8?B?${base64}?=`;
}

// Build raw RFC 2822 email and send via Gmail API
async function sendEmail({ to, subject, body }) {
  const fromEmail = process.env.GMAIL_FROM_EMAIL;
  const fromName = process.env.GMAIL_FROM_NAME;

  const fromHeader = `${encodeMimeHeader(fromName)} <${fromEmail}>`;
  const subjectHeader = encodeMimeHeader(subject);

  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subjectHeader}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ];

  // Base64-encode the body (handles UTF-8 cleanly, matches Content-Transfer-Encoding)
  const bodyEncoded = Buffer.from(body, 'utf-8').toString('base64').match(/.{1,76}/g).join('\r\n');

  const message = headers.join('\r\n') + '\r\n\r\n' + bodyEncoded;

  const encoded = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  return result.data;
}

// Sleep helper
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () =>
  Math.floor(Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN)) + DELAY_MS_MIN;

// ============================================================
// Main handler
// ============================================================
module.exports = async (req, res) => {
  // Bearer token auth (prevents random people from triggering this)
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Optional: ?dry_run=1 generates emails but doesn't send (for testing)
  const dryRun = req.query?.dry_run === '1';

  try {
    // Pull next batch of queued leads
    const { data: leads, error: fetchError } = await supabase
      .from('outreach_leads')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      return res.status(500).json({ error: 'Supabase fetch failed', detail: fetchError.message });
    }

    if (!leads || leads.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No queued leads to process',
        sent: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const results = { sent: 0, failed: 0, dry_run: dryRun, errors: [], drafts: [] };

    for (const lead of leads) {
      try {
        // Generate personalized email
        const { subject, body } = await generateEmail(lead);

        if (dryRun) {
          // Don't actually send — just capture the draft for inspection
          results.drafts.push({
            lead_id: lead.id,
            email: lead.email,
            subject,
            body,
          });
        } else {
          // Send the email
          await sendEmail({ to: lead.email, subject, body });

          // Update Supabase: mark as sent, save the content
          const { error: updateError } = await supabase
            .from('outreach_leads')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              email_subject: subject,
              email_body: body,
            })
            .eq('id', lead.id);

          if (updateError) {
            results.failed++;
            results.errors.push({
              lead_id: lead.id,
              stage: 'supabase_update',
              error: updateError.message,
            });
            continue;
          }

          results.sent++;
        }

        // Throttle (skip on the last iteration)
        if (lead !== leads[leads.length - 1]) {
          await sleep(randomDelay());
        }
      } catch (err) {
        results.failed++;
        results.errors.push({
          lead_id: lead.id,
          email: lead.email,
          stage: 'generate_or_send',
          error: err.message,
        });
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
