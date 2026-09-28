#!/usr/bin/env node
// scripts/draft-retention-sequence.js
//
// Drafts the "book next season" email sequence that's now the free-sample
// offer for the guide niches (salmon_guide, hunting_guide) in
// api/send-outreach.js's PITCH_VARIANTS.guide. Unlike the photo-based ad
// sample (make-samples.js), this needs zero fal spend and no per-prospect
// product photo — it's pure copy, so it exists before a single prospect's
// site is even scraped for images.
//
// Why this exists at all: the actual insight behind the guide-niche pivot is
// that these are seat/date-limited booking businesses whose real problem is
// filling capacity and surviving the off-season — not brand awareness. A
// past-client "book next season now" sequence attacks that problem directly;
// a styled product ad (the DTC pitch) does not.
//
// Usage:
//   ANTHROPIC_API_KEY='...' node scripts/draft-retention-sequence.js \
//     --website=https://example-guide.com --niche=salmon_guide [--name="Example Guides"]
//
// Writes retention-sequences/<slug>.md for review. Every bracketed
// placeholder is a fact only the real business owner can fill in — this is a
// draft, not a finished send, same as PENDING-REVIEW/ ads need eyeballing
// before make-samples.js --approve.

const fs = require('fs');
const path = require('path');

const NICHE_LABELS = {
  salmon_guide: 'Oregon coast salmon fishing guide',
  hunting_guide: 'Oregon/Idaho elk & deer hunting guide/outfitter',
};

function die(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

function slugify(s) {
  return (
    String(s || 'guide')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'guide'
  );
}

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

// Same lightweight, dependency-free context scrape as send-outreach.js's
// fetchProductContext — kept local since this runs as a standalone CLI
// script, not a Vercel function, so it can't share that module directly.
async function scrapeContext(url) {
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
    const html = (await resp.text()).slice(0, 250000);
    const pick = (re) => {
      const m = html.match(re);
      return m ? unescapeHtml(m[1]).replace(/\s+/g, ' ').trim() : '';
    };
    const title = pick(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i);
    const h1 = pick(/<h1[^>]*>([\s\S]{1,160}?)<\/h1>/i).replace(/<[^>]+>/g, ' ').trim();
    return [title, desc, h1].filter(Boolean).join(' — ').slice(0, 400);
  } catch {
    return '';
  }
}

function buildDraftPrompt({ nicheLabel, businessName, context }) {
  return `You are a direct-response email copywriter writing on behalf of a real ${nicheLabel} business named "${businessName}".

CONTEXT scraped from their own site (may be empty): ${context || '(none found)'}

Write a 3-email "book next season now" sequence this guide/outfitter can send to their OWN past-client list during the off-season, to pre-sell next season's dates before it opens to new clients. This is the core value being offered — the real problem for a business like this is empty seats and dead months between seasons, not brand awareness.

Rules:
- Written in the guide's own voice — first person, plainspoken, outdoorsy, never corporate marketing-speak.
- Grounded in real seasonal mechanics for this activity (salmon runs, or elk/deer season + tag draws) but do NOT invent specific dates, prices, or claims about this exact business — use bracketed placeholders like [your target dates] or [your season's tag deadline] anywhere a real fact would be needed.
- Email 1 (Day 0): reconnect + announce next season's booking is open early, past clients first.
- Email 2 (Day 5): urgency — limited seats/dates, callback to what made a past trip good ([specific memory or result] as a placeholder).
- Email 3 (Day 10): last call — a small past-client-only incentive ([priority date pick] or [referral perk] as a placeholder) and a clear booking call to action.
- Each email: subject line + body under 150 words.
- No emojis, no exclamation-point stacking, no corporate tone.

OUTPUT FORMAT (JSON only, no markdown fences, no preamble):
{
  "emails": [
    { "send_day": "Day 0", "subject": "...", "body": "..." },
    { "send_day": "Day 5", "subject": "...", "body": "..." },
    { "send_day": "Day 10", "subject": "...", "body": "..." }
  ]
}`;
}

async function draftSequence({ apiKey, niche, businessName, context }) {
  const Anthropic = require('@anthropic-ai/sdk');
  const claude = new Anthropic({ apiKey });
  const nicheLabel = NICHE_LABELS[niche];
  const prompt = buildDraftPrompt({ nicheLabel, businessName, context });
  const msg = await claude.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content[0].text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  const parsed = JSON.parse(first !== -1 && last !== -1 ? text.slice(first, last + 1) : text);
  if (!Array.isArray(parsed.emails) || parsed.emails.length === 0) die('Claude returned no emails');
  return parsed.emails;
}

function toMarkdown({ businessName, niche, emails }) {
  const lines = [
    `# Book-next-season sequence — ${businessName} (${niche})`,
    '',
    `Drafted ${new Date().toISOString()}. Every [bracketed placeholder] is a real fact only the business owner can fill in — review before this goes near an actual send.`,
    '',
  ];
  for (const e of emails) {
    lines.push(`## ${e.send_day} — ${e.subject}`, '', e.body, '');
  }
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const a = args.find((x) => x.startsWith(`--${flag}=`));
    return a ? a.slice(flag.length + 3) : '';
  };
  const website = get('website');
  const niche = get('niche');
  const nameArg = get('name');
  if (!website || !niche) {
    die(
      'usage: node scripts/draft-retention-sequence.js --website=https://... --niche=salmon_guide|hunting_guide [--name="Business Name"]',
    );
  }
  if (!NICHE_LABELS[niche]) die(`--niche must be one of: ${Object.keys(NICHE_LABELS).join(', ')}`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) die('missing ANTHROPIC_API_KEY env var');

  let url;
  try {
    url = new URL(website).href;
  } catch {
    die(`--website is not a valid URL: ${website}`);
  }

  console.log(`Scraping ${url} for context...`);
  const context = await scrapeContext(url);
  const businessName = nameArg || new URL(url).hostname.replace(/^www\./, '');

  console.log('Drafting sequence via Claude...');
  const emails = await draftSequence({ apiKey, niche, businessName, context });

  const outDir = path.join(__dirname, '..', 'retention-sequences');
  fs.mkdirSync(outDir, { recursive: true });
  const slug = slugify(businessName);
  const outFile = path.join(outDir, `${slug}.md`);
  fs.writeFileSync(outFile, toMarkdown({ businessName, niche, emails }));

  console.log(`\nDrafted ${emails.length} emails -> ${outFile}`);
  console.log('Review every [bracketed placeholder] before this goes anywhere near a real prospect.');
}

main().catch((err) => die(err.message));
