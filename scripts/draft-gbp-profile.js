#!/usr/bin/env node
// scripts/draft-gbp-profile.js
//
// Drafts the text for a client's Google Business Profile from what they told
// us in the onboarding form: description, Q&A, three posts, review-reply
// templates, a photo shot list. Same rule as draft-retention-sequence.js: the
// model may only use the facts it is given. Anything else becomes a visible
// [bracketed placeholder] for a human to fill in or delete.
//
// Usage:
//   node --env-file=.env.local scripts/draft-gbp-profile.js "battle creek"
// Writes client-packets/<slug>/gbp-profile.md (gitignored, holds client facts).

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { connect, findClient, factsFrom, die } = require('../lib/client-facts');

const MODEL = process.env.GBP_DRAFT_MODEL || 'claude-sonnet-5-5';

// Fixed question lists so every client's Q&A covers the same ground.
const QUESTIONS = {
  elk_guide: [
    'Do you guide first-time elk hunters?',
    'Which seasons do you hunt (archery, muzzleloader, rifle)?',
    'Which states and areas do you hunt?',
    'Do I need a tag before I book?',
    'What does a hunt cost and what is included?',
    'How do I book and how much is the deposit?',
    'What happens to my deposit if I do not draw a tag?',
    'How physically demanding are your hunts?',
    'Do you provide lodging and meals?',
    'Do you handle meat care and pack-out?',
    'How many hunters per guide?',
    'How far ahead should I book?',
    'What should I bring?',
    'What is the best way to reach you?',
  ],
  salmon_guide: [
    'Do you take first-time anglers?',
    'Which runs and months do you fish?',
    'Where do you fish?',
    'What does a trip cost and what is included?',
    'How do I book and how much is the deposit?',
    'What happens if the weather or river conditions cancel a trip?',
    'Do I need a fishing license?',
    'How many anglers fit on a trip?',
    'Do you clean and bag the fish?',
    'Can I bring kids?',
    'What should I bring?',
    'How far ahead should I book?',
    'What is the best way to reach you?',
  ],
};

function factsBlock(f) {
  const rows = [
    ['Business name', f.business],
    ['Owner', f.owner],
    ['What they guide', f.niche === 'elk_guide' ? 'elk hunts (outfitter)' : 'salmon fishing trips'],
    ['States', f.stateNames.join(', ')],
    ['Season', f.season],
    ['Typical trip and pricing', f.trip],
    ['Who books with them', f.audience],
    ['What a trip looks like', f.scenes],
    ['Voice', f.voice],
    ['Dates open / spots', f.openDates],
    ['Deposit and payment terms', f.depositTerms],
    // last_season_detail is deliberately left out: it names real hunters and is
    // meant for the private thank-you email, not public profile text.
    ['Referral or repeat-client perk', f.promos],
    ['Website', f.website],
    ['Notes from the owner', f.notes],
  ];
  return rows.filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n');
}

function buildPrompt(f) {
  const qs = QUESTIONS[f.niche] || QUESTIONS.elk_guide;
  return `You are writing the Google Business Profile text for a real ${f.niche === 'elk_guide' ? 'elk hunting outfitter' : 'salmon fishing guide'}. Use ONLY the facts below.

FACTS FROM THE OWNER:
${factsBlock(f)}

RULES
- Never invent a date, price, number, award, license, location, species, camp detail or claim. If a fact you need is not above, write a bracketed placeholder naming it, for example [confirm: meat care and pack-out].
- Never name a past client or retell any individual hunter's story or harvest. Public text stays about the outfit.
- No "best", "#1", "guaranteed" or "trophy" promises, no keyword stuffing, no ALL CAPS, no emojis.
- Write in the owner's voice (${f.voice || 'plainspoken'}), first person plural ("we"), plain words.
- Description: at most 740 characters, no links, no phone numbers, no calls to action like "call now".
- Posts: 60 to 140 words each. No phone numbers or links in the text. Each post has a button: BOOK, LEARN_MORE or CALL.
- Q&A answers: one to three sentences, only from the facts, otherwise a placeholder.
- Review replies are templates with [Reviewer name] and, for 3 stars or less, no defensiveness and an offer to talk offline. Never offer anything in exchange for a changed review.
- Categories: give only the candidate category names to search for in the Google Business Profile category picker, with no commentary (the file already says they must be verified).

QUESTIONS TO ANSWER (use exactly these):
${qs.map((q, i) => `${i + 1}. ${q}`).join('\n')}

OUTPUT: JSON only, no markdown fences, no preamble:
{
  "description": "...",
  "categories": { "primary": "...", "additional": ["..."] },
  "qa": [ { "q": "...", "a": "..." } ],
  "posts": [ { "kind": "update|offer|event", "body": "...", "button": "BOOK|LEARN_MORE|CALL" } ],
  "review_replies": { "five_star": "...", "four_star": "...", "three_or_less": "..." },
  "photo_shot_list": ["..."]
}
Exactly 3 posts. Photo shot list: 10 to 12 items describing real photos to ask the client for.`;
}

function parseJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  return JSON.parse(a !== -1 && b !== -1 ? t.slice(a, b + 1) : t);
}

function toMarkdown(f, d) {
  const L = [];
  L.push(`# Google Business Profile draft: ${f.business}`, '');
  L.push(`Drafted ${new Date().toISOString().slice(0, 10)} from the onboarding form. Every placeholder in square brackets is a fact the owner has not given us. Fill it in or delete the sentence before anything is pasted into Google. Do not publish with placeholders (the [Reviewer name] ones in the reply templates are meant to stay until you reply to a real review).`, '');
  L.push(`## Description (${(d.description || '').length}/750 characters)`, '', d.description || '', '');
  L.push('## Categories (verify exact names in the Google category picker)', '');
  L.push(`- Primary: ${d.categories?.primary || ''}`);
  (d.categories?.additional || []).forEach((c) => L.push(`- Additional: ${c}`));
  L.push('', '## Questions and answers', '');
  (d.qa || []).forEach((x) => L.push(`**Q: ${x.q}**`, `A: ${x.a}`, ''));
  L.push('## Posts', '');
  (d.posts || []).forEach((p, i) => L.push(`### Post ${i + 1} (${p.kind}, button: ${p.button})`, '', p.body, ''));
  L.push('## Review reply templates', '');
  L.push('**5 stars**', '', d.review_replies?.five_star || '', '');
  L.push('**4 stars**', '', d.review_replies?.four_star || '', '');
  L.push('**3 stars or less**', '', d.review_replies?.three_or_less || '', '');
  L.push('## Photo shot list (ask the client for these)', '');
  (d.photo_shot_list || []).forEach((s) => L.push(`- ${s}`));
  L.push('');
  return L.join('\n');
}

async function main() {
  const ref = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!process.env.ANTHROPIC_API_KEY) die('missing ANTHROPIC_API_KEY (run with: node --env-file=.env.local ...)');
  const sb = connect();
  const client = await findClient(sb, ref);
  const f = factsFrom(client);
  if (!f.niche) die('this client has no niche yet. Has the onboarding form been submitted?');
  if (!client.onboarding_complete) console.warn('Warning: onboarding form not submitted yet; the draft will be mostly placeholders.');

  console.log(`Drafting profile text for ${f.business} (${MODEL})...`);
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await claude.messages.create({
    model: MODEL,
    // This model reasons before it answers and that counts against the cap, so
    // leave plenty of room; 4000 was cut off mid-JSON in testing.
    max_tokens: 16000,
    messages: [{ role: 'user', content: buildPrompt(f) }],
  });
  if (msg.stop_reason === 'max_tokens') die('the draft was cut off (hit the token limit). Run it again, or raise max_tokens in this script.');
  const block = msg.content.find((b) => b.type === 'text');
  if (!block) die('Claude returned no text');
  let d;
  try { d = parseJson(block.text); } catch (e) { die('could not parse the draft as JSON: ' + e.message); }

  const md = toMarkdown(f, d);
  const dir = path.join(__dirname, '..', 'client-packets', f.slug);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'gbp-profile.md');
  fs.writeFileSync(out, md);

  const placeholders = (md.match(/\[[^\]\n]+\]/g) || []).filter((p) => p !== '[Reviewer name]');
  console.log(`Wrote ${path.relative(process.cwd(), out)}`);
  console.log(`Description length: ${(d.description || '').length}/750${(d.description || '').length > 750 ? '  <-- TOO LONG, trim it' : ''}`);
  console.log(`${placeholders.length} placeholder(s) to fill${placeholders.length ? ':' : '.'}`);
  [...new Set(placeholders)].slice(0, 25).forEach((p) => console.log('  ' + p));
}

if (require.main === module) main().catch((err) => die(err.message));
module.exports = { buildPrompt, QUESTIONS };
