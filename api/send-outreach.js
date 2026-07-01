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
const COLD_EMAIL_PROMPT = `You are a cold email copywriter for GriffinCreative, a done-for-you creative studio that turns DTC e-commerce brands' own product photos into finished, ready-to-upload ads.

Your job: write a FRIENDLY, SHORT, personalized cold email using the EXACT structure below. The SECOND paragraph must feel hand-written for THIS specific brand — grounded in what they actually sell. Casual lowercase, warm, direct, no fluff. The whole point is to feel like a real person offering something genuinely useful for free.

LEAD INFO:
- First name: {{first_name}}
- Job title: {{job_title}}
- Company: {{company_name}}
- City: {{company_city}}
- State: {{company_state}}
- Niche: {{niche}}

PRODUCT CONTEXT (scraped live from their website — may be empty):
{{product_context}}

SUBJECT (all niches):
a couple free ads for {{company_name}}?

EMAIL STRUCTURE (write the body in exactly this order):

Paragraph 1 (greeting):
hi {{first_name}},

Paragraph 2 (personalized hook — ONE natural, human line, max two sentences):
- IF PRODUCT CONTEXT is present and specific enough to tell what they sell: open by naming the SPECIFIC product or product category {{company_name}} actually sells (from PRODUCT CONTEXT), then say their product photos are too good to only be running a handful of ad variations. Reference the REAL product only — never a generic category example, never a product they don't sell.
- IF PRODUCT CONTEXT is empty or too thin to tell what they sell: use the NICHE HOOK below that matches {{niche}}.
Do not list products or sound like a database — write it like a person who actually looked at their site.

Paragraph 3 (shared pitch — write this exactly, do not change wording):
here's the idea: we turn your existing product photos into finished, ready-to-upload static ads — designed with the copy right on the image, in every placement ratio. not concepts or briefs — actual files in your google drive within 48 hours, ready to test before your current winners burn out.

Paragraph 4 (shared free-sample offer — write this exactly, do not change wording — this is the FINAL paragraph of the body):
want me to make you 2 free samples? you send nothing — i'll pull a product from your site, design 2 finished static ads, and they're yours to run whether or not we ever work together.

CLOSE (write exactly, on its own line as the last line of the body):
sound good?

DO NOT include a signature, sign-off, name, brand name, or anything else after "sound good?". The body MUST end with "sound good?". A canonical signature is appended automatically by the system.

NICHE HOOKS (fallback for paragraph 2 ONLY when PRODUCT CONTEXT is empty — use the one matching {{niche}}):

- fishing_outdoor:
  "found {{company_name}} while looking at standout fishing and outdoor brands — and your gear shots are honestly too good to only be running a handful of ad variations."

- food_beverage:
  "found {{company_name}} while looking at fast-growing food and beverage brands — and your product shots are honestly too good to only be running a handful of ad variations."

- supplements:
  "found {{company_name}} while looking at standout supplement brands — and your product shots are honestly too good to only be running a handful of ad variations."

- anything else, missing, or "dtc_general":
  "found {{company_name}} while looking at fast-growing e-commerce brands — and your product photos are honestly too good to only be running a handful of ad variations."

DATA HANDLING RULES:
- If first_name is missing or empty → use "there"
- If company_name ends in " LLC", " Inc", " Inc.", " Corp", " Corporation" — drop the suffix in the body (keep full legal name in subject)
- Keep the company name in the subject EXACTLY as provided
- Never invent or assume a product. Only reference products that appear in PRODUCT CONTEXT. If it is empty, use the niche hook instead.

STYLE RULES:
- Casual lowercase throughout — never capitalize a sentence-start "i" or any line opener
- "i'd" / "i'll" stay lowercase
- Friendly and warm, never salesy or pushy
- Total email body under 130 words
- NO links anywhere in the body
- NO urgency words (URGENT, FREE in caps, LIMITED, ACT NOW)
- NO exclamation points, no all caps, no smart quotes
- Use em dashes (—) not hyphens for inline asides
- The final line must be exactly "sound good?"
- Paragraphs separated by a single blank line

OUTPUT FORMAT (JSON only, no markdown fences, no preamble):
{
  "subject": "...",
  "body": "..."
}`;

// ============================================================
// Helpers
// ============================================================

// Clean a raw Apollo company name for use in the email:
//   - Strip trademark / copyright / registered symbols (®, ™, ©)
//   - Drop common legal suffixes (LLC, Inc, Corp, etc.)
//   - Convert ALL-CAPS names to Title Case (HOMEMASTERS -> Homemasters),
//     but leave intentional mixed-case (iRoofing, RoofersCoffeeShop) alone.
function sanitizeCompanyName(raw) {
  if (!raw) return '';
  let name = raw.trim();
  name = name.replace(/[®™©]/g, '').trim();
  name = name.replace(
    /\s+(LLC|L\.L\.C\.|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Company|Ltd\.?|Limited)\.?$/i,
    '',
  ).trim();
  // ALL-CAPS → Title Case (only if no lowercase letter exists)
  if (name.length > 3 && /[A-Z]/.test(name) && !/[a-z]/.test(name)) {
    name = name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name;
}

// Decode the handful of HTML entities that commonly show up in <title>/meta tags.
function unescapeHtml(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

// Normalize a raw website value into a fetchable absolute URL, or '' if junk.
function normalizeUrl(raw) {
  if (!raw) return '';
  let u = String(raw).trim();
  if (!u || /^(n\/a|none|null)$/i.test(u)) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    return new URL(u).href;
  } catch {
    return '';
  }
}

// Pull a short, human-readable "what does this brand sell" snippet from raw HTML.
// Uses title + meta/og description + first H1. Dependency-free (regex only) so we
// don't add cheerio to the deploy. Returns '' if nothing usable is found.
function extractContext(html) {
  if (!html) return '';
  const pick = (re) => {
    const m = html.match(re);
    return m ? unescapeHtml(m[1]).replace(/\s+/g, ' ').trim() : '';
  };
  const title = pick(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["']/i);
  const metaDesc =
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i) ||
    pick(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+name=["']description["']/i);
  const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,300})["']/i);
  const h1 = pick(/<h1[^>]*>([\s\S]{1,160}?)<\/h1>/i).replace(/<[^>]+>/g, ' ').trim();

  const parts = [ogTitle || title, metaDesc || ogDesc, h1].filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out.join(' — ').slice(0, 400);
}

// Fetch the lead's homepage and extract product context. Hard 6s timeout,
// HTML-only, and every failure path returns '' so a bad site can NEVER block a send.
async function fetchProductContext(lead) {
  const url = normalizeUrl(lead.company_website);
  if (!url) return '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)',
      },
    });
    clearTimeout(timer);
    if (!resp.ok) return '';
    const ct = resp.headers.get('content-type') || '';
    if (!/text\/html/i.test(ct)) return '';
    const html = (await resp.text()).slice(0, 250000);
    return extractContext(html);
  } catch {
    return '';
  }
}

// Keyword sets for send-time niche classification. Order of evaluation matters:
// fishing first (very distinct), then supplements (so "protein"/"nutrition" land
// here, not in food), then food/beverage. Everything else -> dtc_general.
const NICHE_KEYWORDS = {
  fishing_outdoor: [
    'fishing', 'tackle', 'lure', 'rod', 'reel', 'angler', 'bait', 'fly fishing',
    'outdoor', 'hunting', 'camping', 'hiking', 'kayak', 'archery', 'tactical',
    'trail', 'backpack', 'fishing gear', 'outdoor gear',
  ],
  supplements: [
    'supplement', 'vitamin', 'protein', 'collagen', 'creatine', 'nootropic',
    'probiotic', 'electrolyte', 'adaptogen', 'greens powder', 'pre-workout',
    'preworkout', 'capsule', 'gummies', 'amino', 'omega', 'nutrition',
  ],
  food_beverage: [
    'snack', 'beverage', 'coffee', 'tea', 'drink', 'soda', 'juice', 'kombucha',
    'hot sauce', 'sauce', 'seasoning', 'spice', 'chocolate', 'candy', 'jerky',
    'granola', 'cookie', 'condiment', 'cpg', 'functional beverage', 'energy drink',
    'sparkling', 'snacks', 'foods',
  ],
};

// Classify a lead into one of the three target niches (or dtc_general) using the
// company name, Apollo industry, existing niche tag, and live product context.
function inferNiche(lead, productContext) {
  const hay = [lead.company_name, lead.company_industry, lead.niche, productContext]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  for (const niche of ['fishing_outdoor', 'supplements', 'food_beverage']) {
    if (NICHE_KEYWORDS[niche].some((kw) => hay.includes(kw))) return niche;
  }
  return 'dtc_general';
}

// Hard-correct any near-miss of "griffincreative" that Claude might emit
// inside the body (e.g. in the pitch paragraph). Backstop for the verbatim
// pitch — the signature is handled by applyCanonicalSignature() and never
// trusts the model.
function enforceBrandName(text) {
  if (!text) return text;
  return text.replace(
    /\bgri[f]{1,2}[in]{0,5}\s*c\s*reative(?:\s+lab)?\b/gi,
    'griffincreative',
  );
}

// The signature is non-negotiable and 100% deterministic, so we never let
// the model write it. We slice the body at the locked closing question
// ("sound good?") and append a canonical signature ourselves. This is
// bulletproof against any spelling typo Claude tries.
const CANONICAL_SIGNATURE = '\n\ngabriel\ngriffincreative\ngriffincreativelab.com';

function applyCanonicalSignature(body) {
  if (!body) return CANONICAL_SIGNATURE.trimStart();
  const trimmed = body.trimEnd();
  // Locate the locked close — case-insensitive, last occurrence wins.
  const closeRegex = /sound good\?/gi;
  let lastMatch = null;
  let m;
  while ((m = closeRegex.exec(trimmed)) !== null) {
    lastMatch = m;
  }
  if (!lastMatch) {
    // Close was somehow missing — just append signature at the end.
    return trimmed + CANONICAL_SIGNATURE;
  }
  const cutoff = lastMatch.index + lastMatch[0].length;
  return trimmed.slice(0, cutoff) + CANONICAL_SIGNATURE;
}

// Build the Claude prompt with lead data filled in. resolvedNiche drives the
// fallback hook; productContext drives the product-specific paragraph 2.
function buildPrompt(lead, { productContext = '', resolvedNiche = '' } = {}) {
  const cleanCompany = sanitizeCompanyName(lead.company_name);
  return COLD_EMAIL_PROMPT
    .replace(/{{first_name}}/g, lead.first_name || '')
    .replace(/{{job_title}}/g, lead.job_title || '')
    .replace(/{{company_name}}/g, cleanCompany)
    .replace(/{{company_city}}/g, lead.company_city || '')
    .replace(/{{company_state}}/g, lead.company_state || '')
    .replace(/{{niche}}/g, resolvedNiche || lead.niche || '')
    .replace(/{{product_context}}/g, productContext || '(none found — use the niche hook)');
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

// Generate the personalized email via Claude. Scrapes the brand's site for
// product context and classifies its niche first, then returns both alongside
// the email so the caller can write the resolved niche back to Supabase.
async function generateEmail(lead) {
  const productContext = await fetchProductContext(lead);
  const resolvedNiche = inferNiche(lead, productContext);
  const prompt = buildPrompt(lead, { productContext, resolvedNiche });
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
  // Post-process: scrub any brand-name typos Claude wrote in the body,
  // then strip whatever signature Claude appended and replace with the
  // canonical one. The signature is deterministic and never trusted to AI.
  parsed.subject = enforceBrandName(parsed.subject);
  parsed.body = enforceBrandName(parsed.body);
  parsed.body = applyCanonicalSignature(parsed.body);
  parsed.resolvedNiche = resolvedNiche;
  parsed.productContext = productContext;
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

// Generate a deterministic RFC 2822 Message-ID we control, so follow-ups can
// thread against it via In-Reply-To / References without an extra API fetch.
function generateMessageId(fromEmail) {
  const domain = (fromEmail && fromEmail.split('@')[1]) || 'griffincreativelab.com';
  const rand = Math.random().toString(36).slice(2);
  return `<${Date.now()}.${rand}@${domain}>`;
}

// Build raw RFC 2822 email and send via Gmail API.
// Returns { id, threadId, rfcMessageId } so the caller can persist the thread
// + message id for later in-thread follow-ups.
async function sendEmail({ to, subject, body }) {
  const fromEmail = process.env.GMAIL_FROM_EMAIL;
  const fromName = process.env.GMAIL_FROM_NAME;

  const fromHeader = `${encodeMimeHeader(fromName)} <${fromEmail}>`;
  const subjectHeader = encodeMimeHeader(subject);
  const rfcMessageId = generateMessageId(fromEmail);

  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subjectHeader}`,
    `Message-ID: ${rfcMessageId}`,
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

  return { ...result.data, rfcMessageId };
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

  // Optional: ?limit=N caps the batch size (useful for fast dry-run tests).
  // Defaults to BATCH_SIZE (25). Clamped 1..BATCH_SIZE.
  const rawLimit = parseInt(req.query?.limit, 10);
  const batchLimit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(BATCH_SIZE, rawLimit))
    : BATCH_SIZE;

  try {
    // Pull next batch of queued leads
    const { data: leads, error: fetchError } = await supabase
      .from('outreach_leads')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(batchLimit);

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
        // Generate personalized email (also scrapes site + classifies niche)
        const { subject, body, resolvedNiche, productContext } = await generateEmail(lead);

        if (dryRun) {
          // Don't actually send — just capture the draft for inspection
          results.drafts.push({
            lead_id: lead.id,
            email: lead.email,
            company_name: lead.company_name,
            resolved_niche: resolvedNiche,
            product_context: productContext || '(none found)',
            subject,
            body,
          });
        } else {
          // Send the email (returns Gmail thread id + the Message-ID we set)
          const sendResult = await sendEmail({ to: lead.email, subject, body });

          // Schedule the first follow-up 3 days out. The follow-up job threads
          // against gmail_thread_id + rfc_message_id and auto-stops on reply.
          const nextFollowup = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

          // Update Supabase: mark as sent, save the content, and write back the
          // niche we resolved from the live site so per-niche reporting is real.
          const { error: updateError } = await supabase
            .from('outreach_leads')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              email_subject: subject,
              email_body: body,
              niche: resolvedNiche,
              gmail_thread_id: sendResult.threadId || null,
              rfc_message_id: sendResult.rfcMessageId || null,
              followup_stage: 0,
              next_followup_at: nextFollowup.toISOString(),
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

        // Throttle between sends to avoid Gmail rate flags.
        // Skip on the last iteration AND skip entirely during dry-run
        // (nothing is being sent, so no rate limit to respect).
        if (!dryRun && lead !== leads[leads.length - 1]) {
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
