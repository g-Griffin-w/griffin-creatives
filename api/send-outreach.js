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

Your job: write a personalized cold email using the EXACT structure below, with a NICHE-SPECIFIC hook in the second paragraph. Casual lowercase, direct, no fluff.

LEAD INFO:
- First name: {{first_name}}
- Job title: {{job_title}}
- Company: {{company_name}}
- City: {{company_city}}
- State: {{company_state}}
- Niche: {{niche}}

SUBJECT (all niches):
thought on {{company_name}}

EMAIL STRUCTURE (all niches — write the body in exactly this order):

Paragraph 1 (greeting):
hi {{first_name}},

Paragraph 2 (niche-specific empathy hook — pick the one matching the lead's niche from NICHE HOOKS below)

Paragraph 3 (shared pitch — write this exactly, do not change wording):
we built an automated creative pipeline at griffincreative that delivers ad scripts, email sequences, social content, and visual content — all tailored to your business and dropped in a google drive within 48 hours. tiers run $700–$3,500/mo depending on volume. no contracts, month-to-month.

Paragraph 4 (shared close — write this exactly, do not change wording):
happy to record a free 5-min video auditing your site and outreach with 3-4 specific things i'd change if you were a client. want one?

Paragraph 5 (signature — write this exactly):
gabriel
griffincreative

NICHE HOOKS (use the one matching {{niche}}):

- If niche is "insurance" OR "insurance_independent":
  "found {{company_name}} while looking at independent agencies in {{city}}. competing for local business against State Farm and Allstate's national ad budgets with no in-house marketing team is brutal."

- If niche is "mortgage_broker" OR "mortgage":
  "found {{company_name}} while looking at independent brokers in {{city}}. rates move and deal flow swings hard — most brokers are still leaning on realtor referrals to bridge the gap, and that well dries up fast when the market shifts."

- If niche is "roofing":
  "found {{company_name}} while looking at roofing contractors in {{city}}. between storm-chaser competition and rising lead costs from angi and home advisor, most roofers are paying way too much for leads they don't even own."

- If niche is "plumbing":
  "found {{company_name}} while looking at plumbing contractors in {{city}}. paying $50–150 per shared lead from angi or home advisor — on a service call that might only pay $200 — is brutal margin and an unstable pipeline."

- If niche is missing, empty, or anything else:
  "found {{company_name}} while looking at small business owners in {{city}}. most owners we work with are either overpaying a marketing agency or trying to do creative themselves between jobs — neither scales."

DATA HANDLING RULES:
- If first_name is missing or empty → use "there"
- If company_city is missing or empty → drop the "in {{city}}" phrase entirely from the hook (keep the rest of the sentence intact)
- If company_name ends in " LLC", " Inc", " Inc.", " Corp", " Corporation" — drop the suffix in the body (keep full legal name in subject)
- Keep the company name in the subject EXACTLY as provided

STYLE RULES:
- Casual lowercase throughout — never capitalize a sentence-start "i" or any line opener
- "i'd" stays lowercase
- Total email body under 140 words
- NO links anywhere in the body
- NO urgency words (URGENT, FREE, LIMITED, ACT NOW)
- NO exclamation points, no all caps, no smart quotes
- Use em dashes (—) not hyphens for inline asides
- The final question must be a simple yes/no ("want one?")
- Paragraphs separated by a single blank line

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
