#!/usr/bin/env node
// scripts/draft-retention-sequence.js
//
// Drafts the "book next season" email sequence that's now the free-sample
// offer for the guide niches (salmon_guide, elk_guide) in
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
  // Elk-only, not general big-game — niched down further on 2026-10-01.
  elk_guide: 'Oregon/Idaho elk hunting outfitter',
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

// salmon_guide is direct-booking — a past client can book next season the
// moment it opens. elk_guide is tag-gated — a past client can't book
// anything until they've WON a tag in the state draw, so "lock in your
// dates" is simply false for them. These need different copy, not just
// different timing. See api/send-guide-retention.js / niche_seasons for the
// two elk touchpoints this maps to: 'main' (right after season closes) and
// 'application-reminder' (before the spring application deadline).
function sequenceTypeFor(niche, seasonLabel) {
  if (niche === 'elk_guide' && seasonLabel === 'application-reminder') return 'tag_gated_apply';
  if (niche === 'elk_guide') return 'tag_gated_thanks';
  return 'direct_booking';
}

const SEQUENCE_PROMPTS = {
  direct_booking: (ctx) => `Write a 3-email "book next season now" sequence this guide can send to their OWN past-client list right after the season closes, to pre-sell next season's dates before it opens to new clients. The real problem being solved is empty seats and dead months between runs — not brand awareness.

- Email 1 (Day 0): reconnect + announce next season's booking is open early, past clients first.
- Email 2 (Day 5): urgency — limited seats/dates, callback to what made a past trip good ([specific memory or result] as a placeholder).
- Email 3 (Day 10): last call — a small past-client-only incentive ([priority date pick] or [referral perk] as a placeholder) and a clear booking call to action.`,

  tag_gated_thanks: (ctx) => `Write a 2-email sequence this outfitter can send to their OWN past-client list right after the season closes. CRITICAL: this is a TAG-GATED hunt — a past client cannot book next season yet because they haven't drawn a tag. Do NOT ask them to book or lock in dates. Do NOT create urgency about availability. Instead: thank them for the season, plant the idea of hunting again, and set honest expectations that the state controlled-hunt application period opens in spring (use [your state's application deadline] as a placeholder, do not invent a date) — and that this outfitter will remind them when it's time to apply.

- Email 1 (Day 0): thank-you + reflection on the season ([specific memory or result] as a placeholder) — no ask.
- Email 2 (Day 10): plant the idea of next year, mention the application period is coming in spring, promise a reminder — still no booking ask, since there's nothing to book yet.`,

  tag_gated_apply: (ctx) => `Write a 1-email reminder this outfitter can send to their OWN past-client list in the weeks before the state controlled-hunt application deadline. This is the single most important touch of the year for a tag-gated hunt — missing the application window means missing the entire season, with no second chance until next year (aside from a small second-drawing for leftover tags). Be direct and useful, not salesy: remind them the deadline is coming ([your state's application deadline] as a placeholder — do not invent a date), make it easy (a link or instructions placeholder), and let them know you're ready to guide them again once they draw.

- Email 1 (Day 0 — the only email): deadline reminder + low-key promise to guide them again if they draw.`,
};

function buildDraftPrompt({ nicheLabel, businessName, context, sequenceType }) {
  return `You are a direct-response email copywriter writing on behalf of a real ${nicheLabel} business named "${businessName}".

CONTEXT scraped from their own site (may be empty): ${context || '(none found)'}

${SEQUENCE_PROMPTS[sequenceType](context)}

Rules:
- Written in the guide's own voice — first person, plainspoken, outdoorsy, never corporate marketing-speak.
- Do NOT invent specific dates, prices, or claims about this exact business — use bracketed placeholders anywhere a real fact would be needed.
- Each email: subject line + body under 150 words.
- No emojis, no exclamation-point stacking, no corporate tone.

OUTPUT FORMAT (JSON only, no markdown fences, no preamble). Output exactly as many emails as specified above, no more, no fewer:
{
  "emails": [
    { "send_day": "Day 0", "subject": "...", "body": "..." }
  ]
}`;
}

async function draftSequence({ apiKey, niche, seasonLabel, businessName, context }) {
  const Anthropic = require('@anthropic-ai/sdk');
  const claude = new Anthropic({ apiKey });
  const nicheLabel = NICHE_LABELS[niche];
  const sequenceType = sequenceTypeFor(niche, seasonLabel);
  const prompt = buildDraftPrompt({ nicheLabel, businessName, context, sequenceType });
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
  // 'main' = direct-booking touch for salmon, or the post-season thank-you
  // for elk. 'application-reminder' = elk's pre-deadline nudge (only
  // meaningful for elk_guide — salmon ignores this and always uses direct
  // booking copy, since it has no tag-draw gate).
  const seasonLabel = get('season-label') || 'main';
  if (!website || !niche) {
    die(
      'usage: node scripts/draft-retention-sequence.js --website=https://... --niche=salmon_guide|elk_guide [--season-label=main|application-reminder] [--name="Business Name"]',
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

  console.log(`Drafting sequence via Claude (${sequenceTypeFor(niche, seasonLabel)})...`);
  const emails = await draftSequence({ apiKey, niche, seasonLabel, businessName, context });

  const outDir = path.join(__dirname, '..', 'retention-sequences');
  fs.mkdirSync(outDir, { recursive: true });
  const slug = slugify(businessName);
  // Label suffix so elk's two distinct touches (main / application-reminder)
  // don't overwrite each other for the same business.
  const outFile = path.join(outDir, `${slug}${seasonLabel === 'main' ? '' : '-' + slugify(seasonLabel)}.md`);
  fs.writeFileSync(outFile, toMarkdown({ businessName, niche, emails }));

  console.log(`\nDrafted ${emails.length} emails -> ${outFile}`);
  console.log('Review every [bracketed placeholder] before this goes anywhere near a real prospect.');
}

main().catch((err) => die(err.message));
