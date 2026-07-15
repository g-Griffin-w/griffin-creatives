const Anthropic = require('@anthropic-ai/sdk');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

// =============================================================================
// Signed URL helper — converts stored product_image_urls (JSON array of
// Supabase Storage paths) into an array of time-limited signed read URLs
// suitable for handing to fal.ai's Nano Banana /edit endpoint.
//
// Handles three input shapes for backward compatibility:
//   1. JSON array string: '["{cid}/products/foo.png", "{cid}/products/bar.jpg"]'
//      → returns signed URLs for each path
//   2. Plain string (legacy Drive folder link or similar URL)
//      → returns [originalString] as a passthrough
//   3. null / undefined / empty
//      → returns []
//
// Failures fetching individual signed URLs are dropped silently (filtered out)
// so a single bad path doesn't tank the whole delivery.
// =============================================================================
async function getSignedProductUrls(stored) {
  if (!stored || typeof stored !== 'string') return [];

  // Try to parse as JSON array of paths first
  let paths = null;
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) {
      paths = parsed;
    }
  } catch (_) {
    // Not JSON — likely a legacy Drive URL. Pass through as a single-item array.
    return [stored];
  }

  if (!paths || paths.length === 0) return [];

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[signed-urls] Supabase env vars missing; returning empty array');
    return [];
  }

  const sb = createSupabaseClient(url, key, { auth: { persistSession: false } });

  // 24 hours — gives Make + fal.ai a generous fetch window even on big queues
  const EXPIRES_SECONDS = 86400;

  const results = await Promise.all(
    paths.map(async (path) => {
      try {
        const { data, error } = await sb.storage
          .from('client_assets')
          .createSignedUrl(path, EXPIRES_SECONDS);
        if (error || !data || !data.signedUrl) return null;
        return data.signedUrl;
      } catch (err) {
        console.error('[signed-urls] failed for', path, '-', err.message);
        return null;
      }
    })
  );

  return results.filter(Boolean);
}

// =============================================================================
// GriffinCreative — Deliverable Generator (DTC E-Commerce Pivot, May 27, 2026)
// =============================================================================
// This pipeline serves fast-growing DTC brands. Old contractor / insurance /
// mortgage logic has been retired. Deliverable mix per plan:
//
//   Launch   ($700/mo):   12 static ads, 8 UGC briefs, 15 hooks, 1 email flow,
//                          30-day social calendar, 30-day action plan
//   Scale    ($1,750/mo): 25 static ads, 15 UGC briefs, 30 hooks, 3 email flows,
//                          4 landing page copy variations, 30-day calendar,
//                          30-day action plan
//   Dominate ($3,500/mo): 40 static ads, 25 UGC briefs, 50 hooks, 5 email flows,
//                          8 landing page copy variations, weekly calendars,
//                          30-day action plan
//
// AI voiceover (ElevenLabs) was disabled for DTC clients — UGC needs real
// humans on camera, not synthesized voices, so we deliver scripts/briefs that
// the brand's own creators (or paid UGC actors from Billo / JoinBrands) record.
// `voice_name` field is retained = "DTC" for Make.com Scenario C compatibility
// but Scenario C should be PAUSED or REPURPOSED for static-only motion graphics.
// =============================================================================

// Plan-specific counts. Centralized so it's easy to bump if pricing changes.
function planCounts(plan) {
  if (plan === 'dominate') {
    return { staticAds: 40, ugc: 25, hooks: 50, emails: 5, landing: 8 };
  }
  if (plan === 'scale') {
    return { staticAds: 25, ugc: 15, hooks: 30, emails: 3, landing: 4 };
  }
  return { staticAds: 12, ugc: 8, hooks: 15, emails: 1, landing: 0 };
}

// Pull the client's brand ACCENT color from their brand assets / voice notes so
// finished ads carry the client's brand, not ours. Picks the first hex that
// isn't near-black or near-white (those are usually background/text, not accent).
// Falls back to GriffinCreative orange when nothing usable is provided.
function extractBrandAccent(...sources) {
  const text = sources.filter(Boolean).join(' ');
  const hexes = text.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})/g) || [];
  for (const hx of hexes) {
    let h = hx.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // 0 (black) .. 255 (white)
    if (lum > 28 && lum < 225) return '#' + h.toUpperCase();
  }
  return '#FF4D00';
}

// Email flow names per plan — used to brief Claude on which flows to produce.
function emailFlowsList(plan) {
  if (plan === 'dominate') {
    return [
      'Welcome Series (3 emails) — new subscriber introduction',
      'Abandoned Cart (3 emails) — recover lost checkouts',
      'Post-Purchase (3 emails) — onboarding + reorder',
      'Win-Back (3 emails) — re-engage lapsed customers',
      'Browse Abandonment (2 emails) — recover product page visitors',
    ];
  }
  if (plan === 'scale') {
    return [
      'Welcome Series (3 emails) — new subscriber introduction',
      'Abandoned Cart (3 emails) — recover lost checkouts',
      'Post-Purchase (3 emails) — onboarding + reorder',
    ];
  }
  return [
    'Welcome Series (3 emails) — new subscriber introduction (the highest-leverage flow if you only run one)',
  ];
}

// Static text prepended to each deliverable doc. DTC-focused now.
const USAGE_GUIDES = {
  action_plan: `🎯 START HERE — YOUR 30-DAY DTC DEPLOYMENT PLAN

This is your week-by-week roadmap. Read THIS document BEFORE opening the others.

The other docs in this folder (Hooks, Static Ads, UGC Briefs, Email Flows, Content Calendar) are your raw creative arsenal. This Plan tells you what to deploy when, what to test first, and what your media buyer should expect to see week-by-week.

Do NOT try to deploy everything at once. The whole point of high-volume creative is to test, kill losers fast, and scale winners. Pacing matters.

👇 Your 30-day plan below 👇

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`,

  ad_hooks: `📋 HOW TO USE THESE HOOKS + AD COPY

These are 15-50 hook variations + matched copy designed for high-volume split-testing on Meta and TikTok. Creative fatigue is the #1 ROAS-killer for DTC — fresh creative every 7-14 days is how you keep CPM down and ROAS up.

1. SPLIT-TEST IN BATCHES OF 5: Don't run all hooks at once. Group them into batches of 5, run for 3-5 days, kill bottom 2, scale top 1.

2. PAIR WITH STATIC ADS + UGC: Each hook is creative-format-agnostic. You can pair the same hook with a static ad, a UGC script, or a motion graphic for different angles.

3. CATEGORIES: Hooks are organized by angle — pain-point, transformation, social-proof, curiosity, list/contrarian, founder voice. Test all categories — DTC audiences respond differently per category.

4. METRICS TO WATCH: Hook rate (3-sec video view %), CTR on Meta, thumbstop ratio on TikTok. Anything under 30% hook rate is a kill candidate.

5. REFRESH CADENCE: We'll send a new batch every 30 days. Stop running any creative that's been live 21+ days — even winners burn out.

Questions? Reply to your delivery email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`,

  static_ads: `🎨 HOW TO USE THESE STATIC PRODUCT AD CONCEPTS

Each concept below is a fully-formed static ad — headline, subheadline, CTA, and a ready-to-paste image generation prompt that references YOUR product photos.

1. GENERATE THE VISUALS: Take each "image_prompt" and feed it into Midjourney, nano-banana, or Photoshop your product into the described scene. (We'll handle generation directly in your Drive folder for Scale + Dominate tiers.)

2. EXPORT IN MULTIPLE RATIOS: Each static should be exported as 1:1 (feed), 4:5 (mobile-feed), and 9:16 (Stories). Most ad managers will auto-crop, but native sizing wins.

3. RUN IN ABO + CBO: Static ads are easier to read at small budgets — start at $20-50/day per concept in ABO. Scale winners to CBO when they cross 2x ROAS.

4. NATIVE-FEEL FIRST, BRAND-POLISH SECOND: The first 3-day cohort of any static should look UGC-native (slightly imperfect lighting, real-world setting) — not a glossy product render. We've matched the prompts to this style.

5. ROTATE WEEKLY: Static fatigue is faster than video — swap in fresh concepts every 7-14 days.

Questions? Reply to your delivery email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`,

  ugc_briefs: `🎬 HOW TO USE THESE UGC CREATOR BRIEFS

These are talking-head scripts and shot lists ready to hand to:
  (a) Your own customers / community members willing to film
  (b) Paid UGC creators on Billo ($59/video), JoinBrands ($39/video), or Trend.io

We don't deliver finished UGC video — UGC's whole value is real humans, not AI avatars. We deliver the SCRIPT, the HOOK, the SHOT LIST, and the CTA so any creator can film a polished ad in 30 minutes.

1. PICK YOUR CREATORS: If you don't have in-house creators, post the brief on Billo or JoinBrands. Their marketplaces have thousands of vetted creators across every DTC vertical.

2. WHAT TO SEND THEM: The brief includes (1) the hook in the first 3 seconds, (2) the narrative arc, (3) the b-roll shots needed, (4) the CTA. They handle the rest.

3. RECORD VERTICAL (9:16): All UGC should be filmed in portrait for TikTok + Reels. Square crops easily for feed if needed.

4. PAYMENT NOTE: Most UGC marketplaces charge $30-100 per video. Budget 1 month of testing = $300-500 in UGC fulfillment for Launch tier, $700-1200 for Scale, $1000-2000 for Dominate.

5. WHAT TO RUN: Start with 3 UGC videos at a time in Meta + TikTok. Kill bottom 2 after 3-day window. Scale winner.

Questions? Reply to your delivery email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`,

  email_flows: `📧 HOW TO USE THESE EMAIL FLOWS

Each flow below is a complete sequence ready to load into Klaviyo (recommended), Omnisend, or your email tool of choice. DTC email is where 25-40% of total revenue should come from once flows are dialed.

1. SETUP IN KLAVIYO: Each email = a new email block inside a Klaviyo flow. Use the trigger noted at the top of each flow (e.g., "Trigger: subscriber added to default Welcome list").

2. TIMING NOTED INLINE: We've included send timing for each email in the flow (Email 1 = immediately, Email 2 = +24hr, etc.). Don't change these — they're tested cadences.

3. PERSONALIZATION: Klaviyo merge tags noted as {{ first_name|default:"there" }} — paste directly into Klaviyo's text editor and it'll auto-fill.

4. SUBJECT LINES: Each email has 1 primary subject line. Scale + Dominate tier includes A/B variants — use Klaviyo's split-test feature to run them simultaneously.

5. METRICS TO WATCH: Open rate (target 40%+), click rate (target 5%+), revenue per email (target $0.50+ for promo, $0.10+ for nurture).

Questions? Reply to your delivery email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`,

  content_calendar: `📅 HOW TO USE THIS CONTENT CALENDAR

30 days of organic social content for Instagram, TikTok, and your owned channels. This is for organic — paid creative lives in the Hooks + Static Ads + UGC Briefs docs.

1. POST AS-IS: Captions, hashtags, and post types are pre-written. Just queue them up in Buffer, Later, or Meta Business Suite.

2. PAIR WITH YOUR PRODUCT PHOTOS: Each post has a recommended visual. Use your own product shots, customer UGC, or behind-the-scenes content.

3. CADENCE: 1 post per day on IG, 3-4 short-form videos per week on TikTok. Don't skip days — algorithmic momentum compounds.

4. ENGAGEMENT WINDOW: 15 minutes of replying to comments within the first hour of posting = 2-3x reach uplift. Set a reminder.

5. CONTENT MIX: We've balanced education / entertainment / promotional / social-proof across the 30 days. Don't reorder unless you have a reason.

Questions? Reply to your delivery email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`,

  landing_page_copy: `📄 HOW TO USE THESE LANDING PAGE COPY VARIATIONS

We've drafted 4-8 variations of your landing page copy — designed for split-testing the hero, value props, and CTAs to lift conversion rate from cold traffic.

1. PICK ONE TO LAUNCH WITH: Start with Variation 1. It's the most "safe / conversion-validated" framing.

2. THEN RUN A/B TESTS: After you have 1000+ visitors on Variation 1, test Variation 2 head-to-head using Shopify's A/B tool, Optimizely, or just two URLs with split traffic in Meta.

3. SECTIONS COVERED: Each variation includes — Hero headline, hero subhead, hero CTA, value prop block (3 cards), social proof block, FAQ, urgency/CTA close.

4. PLUG INTO YOUR THEME: All copy is plain text, ready for your Shopify theme editor or whatever page builder you use (Pagefly, GemPages, Replo, etc.).

5. WHAT TO MEASURE: Conversion rate (visit → add-to-cart), time on page, bounce rate. The winning variation usually shows up in 7-10 days at decent traffic.

Questions? Reply to your delivery email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    business_name,
    business_type,
    target_audience,
    ad_goals,
    brand_voice,
    notes,
    amount_total,
    phone_display,
    website_display,
    promos,
    booking_link,
    // DTC-specific fields (added May 27 pivot)
    shopify_url,
    product_image_urls,
    brand_asset_urls,
    top_performing_ad_url,
    monthly_ad_spend,
    // Creative-direction fields (Phase 1: txt2img brand-world backgrounds)
    brand_colors,
    product_world,
    visual_vibe,
    inspo_refs,
    logo_url,
  } = req.body;
  let { plan } = req.body;

  // Derive plan from Stripe amount_total. Keeps legacy mappings for any
  // active subs from the older $500/$1,300/$2,600 pricing tier.
  if (!plan && amount_total) {
    const amt = Number(amount_total);
    if (amt === 70000 || amt === 50000) plan = 'launch';
    else if (amt === 175000 || amt === 120000 || amt === 130000) plan = 'scale';
    else if (amt === 350000 || amt === 250000 || amt === 260000) plan = 'dominate';
  }

  if (!business_name || !plan) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      received: { business_name: !!business_name, plan, amount_total },
    });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const counts = planCounts(plan);
  const emailFlows = emailFlowsList(plan);

  // Robust JSON parser for Claude responses (strips fences, slices to brackets)
  function parseClaudeJson(text) {
    if (!text) return [];
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    // Support both JSON arrays ([...]) and single objects ({...}).
    const ai = cleaned.indexOf('[');
    const oi = cleaned.indexOf('{');
    let start = -1, endCh = ']';
    if (oi === -1 || (ai !== -1 && ai < oi)) { start = ai; endCh = ']'; }
    else { start = oi; endCh = '}'; }
    if (start !== -1) {
      const last = cleaned.lastIndexOf(endCh);
      if (last > start) cleaned = cleaned.slice(start, last + 1);
    }
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      return { _parse_error: e.message, _raw: text };
    }
  }

  // Variable substitution for prompts.
  function fill(template) {
    return template
      .replace(/{{business_name}}/g,         business_name || '')
      .replace(/{{business_type}}/g,         business_type || '')
      .replace(/{{target_audience}}/g,       target_audience || '')
      .replace(/{{ad_goals}}/g,              ad_goals || '')
      .replace(/{{brand_voice}}/g,           brand_voice || '')
      .replace(/{{notes}}/g,                 notes || '')
      .replace(/{{plan}}/g,                  plan || '')
      .replace(/{{phone_display}}/g,         phone_display || '')
      .replace(/{{website_display}}/g,       website_display || '')
      .replace(/{{promos}}/g,                promos || '')
      .replace(/{{booking_link}}/g,          booking_link || '')
      .replace(/{{shopify_url}}/g,           shopify_url || '(not provided)')
      .replace(/{{product_image_urls}}/g,    product_image_urls || '(not provided — client should email these to hello@griffincreativelab.com)')
      .replace(/{{brand_asset_urls}}/g,      brand_asset_urls || '(not provided)')
      .replace(/{{top_performing_ad_url}}/g, top_performing_ad_url || '(none provided)')
      .replace(/{{monthly_ad_spend}}/g,      monthly_ad_spend || 'undisclosed')
      .replace(/{{brand_colors}}/g,          brand_colors || '(not provided)')
      .replace(/{{product_world}}/g,         product_world || '(not provided)')
      .replace(/{{visual_vibe}}/g,           visual_vibe || '(not provided)')
      .replace(/{{inspo_refs}}/g,            inspo_refs || '(none)')
      .replace(/{{email_flows_list}}/g,      emailFlows.map((f) => '- ' + f).join('\n'));
  }

  // -------------------- PROMPT 1: AD HOOKS + COPY VARIATIONS --------------------
  const adHooksPrompt = fill(`You are an elite DTC performance creative strategist for GriffinCreative. Generate exactly ${counts.hooks} short-form ad hook variations with paired body copy + CTA, designed for split-testing on Meta and TikTok.

BRAND CONTEXT:
- Brand: {{business_name}}
- Category: {{business_type}}
- Shopify: {{shopify_url}}
- Target customer: {{target_audience}}
- Primary offer / hook: {{ad_goals}}
- Brand voice: {{brand_voice}}
- Active promos to vary across hooks: {{promos}}
- Monthly ad spend: {{monthly_ad_spend}}
- Top-performing existing ad reference: {{top_performing_ad_url}}
- Notes: {{notes}}

RULES:
- Spread hooks evenly across 6 categories: pain-point, transformation/result, social-proof/UGC-feel, curiosity/contrarian, list/numbered, founder-voice.
- Hooks must work as the FIRST 3 SECONDS of a video OR the headline of a static. Aim for 6-12 words max.
- Body copy supports the hook with 1-2 specific benefit lines. CTAs are 2-4 word action phrases.
- Avoid clichés ("Look no further", "In today's fast-paced world", etc.). Specific > clever.
- Reference the brand's actual product / category. No generic copy.

STRUCTURE (format as plain text, easy to read, NOT JSON):

# AD HOOKS + COPY — ${counts.hooks} VARIATIONS

## PAIN-POINT HOOKS (X variations)
**Hook 1:** [the hook]
- Body: [1-2 sentences expanding on the pain + solution]
- CTA: [action phrase]

[repeat for each pain-point variation]

## TRANSFORMATION HOOKS (X variations)
[same structure]

## SOCIAL-PROOF / UGC-FEEL HOOKS (X variations)
[same structure]

## CURIOSITY / CONTRARIAN HOOKS (X variations)
[same structure]

## LIST / NUMBERED HOOKS (X variations)
[same structure]

## FOUNDER-VOICE HOOKS (X variations)
[same structure]

End with a 1-paragraph testing note: "Run these in batches of 5 — start with X category if your top-performing ad is Y..." (use the brand's existing top-performing ad URL above to inform this if provided).

Output only the formatted content, no preamble or explanation.`);

  // -------------------- PROMPT 2: STATIC PRODUCT ADS --------------------
  const staticAdsPrompt = fill(`You are a static ad creative director for GriffinCreative. Generate exactly ${counts.staticAds} static product ad concepts for:

Brand: {{business_name}}
Category: {{business_type}}
Audience: {{target_audience}}
Primary offer: {{ad_goals}}
Active promos: {{promos}}
Voice: {{brand_voice}}
Product photo URLs the client provided: {{product_image_urls}}
Brand asset URLs (logo, hex colors): {{brand_asset_urls}}
Brand colors (hex): {{brand_colors}}
Product's world / setting: {{product_world}}
Visual vibe: {{visual_vibe}}
Concept inspiration: {{inspo_refs}}
Shopify: {{shopify_url}}
Notes: {{notes}}

WE GENERATE ADS TWO WAYS. Tag EACH concept with a "mode":
- "img2img" -> a real PRODUCT SHOT. The brand's actual product/packaging must appear accurately. The image_prompt transforms the client's product photo into a scene. Most concepts are this.
- "txt2img" -> a creative BRAND-WORLD BACKGROUND (out-of-the-box, scroll-stopping). The product does NOT appear in the image at all — it's a striking scene from the product's world (e.g., a macro of iced coffee with star-shaped ice cubes for a coffee syrup). Our system overlays the brand logo + copy afterward. Drive these from the product's world / visual vibe / inspiration above.

Generate a MIX: roughly 70% img2img product shots and 30% txt2img creative backgrounds, with AT LEAST 1 txt2img concept. Make the txt2img concepts genuinely bold and distinct.

RULES:
- Each concept attacks a different angle: hero product shot, lifestyle scene, comparison, before/after, social-proof, "what's inside", urgency, problem/solution, ingredient deep-dive, abstract brand-world, etc.
- img2img image_prompt references the brand's actual product photo and preserves its real label exactly.
- HARD RULE — text never covers the product: the renderer overlays copy in the LOWER THIRD of the frame, so every img2img image_prompt MUST place the product in the UPPER TWO-THIRDS and explicitly state that the lower third of the frame stays clean and empty.
- txt2img image_prompt describes ONLY the scene/background — absolutely NO product, packaging, logo, words, or typography (the model would hallucinate/garble them). Leave clean negative space for the overlaid logo + copy.
- HEADLINE must be 8 words or fewer. Sub-headlines max 12 words. CTAs max 4 words.
- Designed for native feeds. Vary across the active promos when listed.
- NEVER ask any image to ADD marketing text, headlines, captions, or graphic typography — our system overlays the copy afterward. EXCEPTION (img2img only): the product's OWN real printed label/logo must be preserved exactly as-is.

Return ONLY a valid JSON array with exactly ${counts.staticAds} objects:
{
  "concept": "short name (2-5 words)",
  "mode": "img2img" or "txt2img",
  "layout": "product" for img2img product shots; "center" or "poster-bottom" for txt2img brand-world concepts",
  "angle": "which angle this attacks (e.g., 'before/after', 'social proof', 'brand-world')",
  "headline": "main on-image headline (≤8 words)",
  "subheadline": "supporting line (≤12 words)",
  "cta_button": "CTA text (≤4 words)",
  "image_prompt": "IF mode is img2img: ready-to-paste nano-banana image-to-image prompt describing scene, composition, lighting, mood, color palette + the product (reference photo URLs above). KEEP the product and its real packaging/label exactly; never add text/graphics; position the product in the UPPER TWO-THIRDS of the frame and keep the LOWER THIRD clean and empty for the overlaid copy (it must never cover the product); end with 'preserve the product label exactly; add no additional text or graphics'. IF mode is txt2img: a scene-only brand-world background prompt built from the product's world + visual vibe — describe a bold, edge-to-edge scene with clean negative space for overlaid copy, and explicitly forbid product, packaging, logo, words, and typography (e.g., end with 'no product, no packaging, no logos, no text, no typography').",
  "production_note": "1-sentence client guidance — e.g., 'Use product photo #2' or 'txt2img brand-world background; logo + copy overlaid'"
}

Output the JSON array and nothing else.`);

  // -------------------- PROMPT 3: UGC CREATOR BRIEFS --------------------
  const ugcBriefsPrompt = fill(`You are a UGC creative director for GriffinCreative. Generate exactly ${counts.ugc} UGC creator briefs / scripts for:

Brand: {{business_name}}
Category: {{business_type}}
Audience: {{target_audience}}
Primary offer: {{ad_goals}}
Active promos: {{promos}}
Voice: {{brand_voice}}
Product photo URLs the client provided: {{product_image_urls}}
Notes: {{notes}}

These briefs go to either (a) the brand's in-house creators OR (b) paid UGC actors on Billo/JoinBrands/Trend.io. Each brief must be COMPLETE enough that a creator who's never used the product can film it in 30-60 minutes.

RULES:
- Spread briefs across angles: testimonial / problem-solution / day-in-the-life / unboxing / demo / before-after / "things I wish I knew" / comparison / "you're using it wrong" / founder POV.
- Each brief has a HOOK that opens with a 3-second pattern-interrupt. The hook MUST grab attention or the ad dies.
- All scripts are first-person, conversational, native to TikTok/Reels. NO corporate language.
- Specify b-roll shots the creator should capture (3-5 shots per script).
- Each script is 30-60 seconds total length.

STRUCTURE (format as plain text, NOT JSON):

# UGC CREATOR BRIEFS — ${counts.ugc} SCRIPTS

## SCRIPT 1: [angle name]
**Hook (first 3 seconds):** [the literal first line they say into the camera + recommended facial expression / energy]
**Setup (3-10 seconds):** [the situation/context they establish]
**Problem (10-25 seconds):** [the relatable pain point]
**Product reveal / solution (25-40 seconds):** [how the product fits in — must be authentic, not salesy]
**Result / payoff (40-55 seconds):** [the outcome / how it changed things for them]
**CTA (last 5 seconds):** [what to say to drive the action — "link in bio", "use code XYZ", etc.]
**B-roll shots needed:**
  - Shot 1: [description]
  - Shot 2: [description]
  - Shot 3: [description]
**Filming notes:** [lighting/setting recommendations — e.g., "natural window light", "kitchen counter", "morning routine setting"]

[repeat for each script]

End with a 1-paragraph note on how to brief paid UGC actors if the client doesn't have in-house creators (mention Billo, JoinBrands, or Trend.io as starting marketplaces).

Output only the formatted content, no preamble.`);

  // -------------------- PROMPT 3B: AI VIDEO SCRIPTS (structured, for Kling) --------------------
  // Returns a JSON array so Make.com can iterate ONE Kling job per script.
  // Each scene carries a Kling-ready visual prompt AND the exact on-screen
  // caption text for that scene. Captions carry the message because ~97% of
  // mobile feed views are sound-off — voiceover is optional/secondary.
  const videoScriptsPrompt = fill(`You are a short-form video creative director for GriffinCreative. Generate exactly ${counts.ugc} AI-video ad scripts for {{business_name}}, each produced as a finished 15-30 second in-feed video that drives sales.

HOW THESE ARE PRODUCED (critical to how you write the prompt):
- Each video is made with Kling IMAGE-TO-VIDEO. The FIRST FRAME is the client's REAL product photo (provided below). Kling animates motion outward from that real photo — so the actual product is on screen the whole time. This is what makes the ad convert: real product, not a hallucinated one.
- Burned-in captions carry the message (97% of mobile feed views are SOUND-OFF). A CTA end card closes it. Voiceover is optional and secondary — never rely on it.

Brand: {{business_name}}
Category: {{business_type}}
Audience: {{target_audience}}
Primary offer: {{ad_goals}}
Active promos: {{promos}}
Voice: {{brand_voice}}
Client product photo URLs (these are the literal first frame of the video): {{product_image_urls}}
Shopify: {{shopify_url}}
Notes: {{notes}}

RULES:
- Spread scripts across high-converting angles: problem-solution, before/after, listicle ("3 reasons"), testimonial-style, unboxing/demo, founder POV, comparison, "you're using it wrong".
- motion_prompt describes ONLY camera/product MOTION and atmosphere applied to the real product photo. Favor SUBTLE, slow, gentle motion that keeps the product label crisp and legible — e.g., "slow gentle push-in on the bottle, soft morning light drifting across it, faint condensation, shallow depth of field, product stays sharp and centered." AVOID fast moves, big zooms, rotations, spins, or warping camera moves — those smear the product's printed label into garbled text. Do NOT describe a different or new product — the real product photo is the starting frame. No NEW text, words, or captions in the video itself (we overlay those), and keep the product's own label undistorted.
- captions: 3-5 short on-screen lines that play in sequence and tell the full story sound-off. First caption IS the 3-second hook and must stop the scroll. Keep each <= 8 words.
- Reference the brand's real product/offer — no generic filler. Make the viewer want to buy.

Return ONLY a valid JSON array with exactly ${counts.ugc} objects:
{
  "concept": "short name (2-5 words)",
  "angle": "which angle this attacks (e.g., 'before/after', 'listicle', 'problem-solution')",
  "hook": "opening 3-second on-screen caption (<= 8 words)",
  "motion_prompt": "Kling image-to-video MOTION prompt applied to the client's real product photo. Use SUBTLE, slow, gentle motion (soft push-in, drifting light, faint particles) that keeps the product and its printed label crisp and undistorted. Avoid fast moves, zooms, rotations, or warping. Never describe a new product; animate the real one. No new on-screen text.",
  "captions": ["caption 1 = the hook (<= 8 words)", "caption 2", "caption 3"],
  "cta_text": "end-card CTA (<= 4 words)",
  "music_mood": "music/SFX direction (e.g., 'upbeat lo-fi', 'energetic trap')",
  "voiceover_optional": "a single optional VO line if the client wants voiceover; empty string for caption-only"
}

Output the JSON array and nothing else.`);

  // -------------------- PROMPT 4: EMAIL FLOWS --------------------
  const emailFlowsPrompt = fill(`You are an elite DTC email copywriter for GriffinCreative (think Klaviyo Master Class instructor energy). Write exactly ${counts.emails} complete email flows for:

Brand: {{business_name}}
Category: {{business_type}}
Audience: {{target_audience}}
Primary offer / hook: {{ad_goals}}
Voice: {{brand_voice}}
Notes: {{notes}}

The flows to write (write ALL of them, in this order):
{{email_flows_list}}

RULES:
- Each email has: trigger condition, send delay from trigger, subject line, preview text, full body copy with merge tags ({{ first_name|default:"there" }}), CTA button text + URL placeholder.
- Plan-specific bonus: ${plan === 'dominate' ? 'For EVERY email, provide TWO A/B subject line variants.' : 'Provide ONE strong subject line per email.'}
- Voice is conversational, founder-energy, NOT corporate. Short paragraphs. Punchy lines.
- Each flow should drive a clear outcome (subscribe → first purchase, cart abandoner → checkout, etc.).

STRUCTURE (format as plain text):

# EMAIL FLOWS

## FLOW 1: [flow name]
**Trigger:** [Klaviyo trigger description]
**Goal:** [what success looks like]

### Email 1 of N — [purpose]
- Send timing: [e.g., "Immediately on trigger" or "+24 hours after Email 1"]
- Subject line${plan === 'dominate' ? ' (A)' : ''}: [subject]
${plan === 'dominate' ? '- Subject line (B): [alternative subject for A/B test]\n' : ''}- Preview text: [preview]
- Body:
  [full email body, with merge tags, paragraph breaks]
- CTA button: [button text]
- CTA URL: [placeholder like SHOPIFY_PRODUCT_URL or CART_URL]

[repeat for each email in the flow, then move to next flow]

Output only the formatted content, no preamble.`);

  // -------------------- PROMPT 5: SOCIAL CONTENT CALENDAR --------------------
  const calendarPrompt = fill(`You are a DTC social media strategist for GriffinCreative. Generate a ${plan === 'dominate' ? '4-week (weekly calendars)' : '30-day'} organic social content calendar for:

Brand: {{business_name}}
Category: {{business_type}}
Audience: {{target_audience}}
Primary offer: {{ad_goals}}
Voice: {{brand_voice}}
Active promos: {{promos}}
Notes: {{notes}}

This is for ORGANIC social — paid creative is in the Hooks/Static Ads/UGC docs.

RULES:
- 1 post per day on Instagram, 3-4 short-form videos per week on TikTok, optional 1 LinkedIn post/week if founder-led.
- Mix content types: educational, entertaining, behind-the-scenes, social proof, promotional, founder POV, customer spotlight, product education.
- Each day specifies: day number, primary platform, content type, hook/topic, full caption (ready to copy/paste), 10-15 hashtags, best time to post.
- Captions should feel native, not corporate. Use line breaks for readability.

STRUCTURE (format as plain text by week):

# 30-DAY CONTENT CALENDAR — ${plan === 'dominate' ? 'WEEK-BY-WEEK' : 'DAILY'}

## WEEK 1
### Day 1 — [Platform] — [Content type]
**Hook/topic:** [the angle]
**Caption:**
[full caption with line breaks and emoji where appropriate]
**Hashtags:** #tag1 #tag2 #tag3 ... (10-15 total)
**Best time:** [e.g., "Tue 11am EST"]

### Day 2 — [Platform] — [Content type]
[same structure]

[continue for all days through Day 30]

Output only the formatted calendar, no preamble.`);

  // -------------------- PROMPT 6: 30-DAY ACTION PLAN --------------------
  const actionPlanPrompt = fill(`You are a DTC growth coach for GriffinCreative. Write a 30-day deployment plan for the brand to actually USE the creative we just generated.

Brand context:
- Brand: {{business_name}}
- Category: {{business_type}}
- Audience: {{target_audience}}
- Primary goal: {{ad_goals}}
- Monthly ad spend: {{monthly_ad_spend}}
- Plan: {{plan}}

Write a 30-day plan structured into 4 weeks. Conversational, direct, NOT corporate. Talk like a smart growth marketer helping a founder, not a strategy deck.

CRITICAL:
- Reference specific tools by name: Meta Ads Manager (https://adsmanager.facebook.com), TikTok Ads Manager (https://ads.tiktok.com), Klaviyo (https://klaviyo.com), Shopify, Billo (https://billo.app), JoinBrands (https://joinbrands.com).
- Reference the actual deliverables they just received: Hooks doc, Static Ads doc, UGC Briefs doc, Email Flows doc, Content Calendar.
- Set realistic expectations per week.
- Include UGC fulfillment cost guidance ($30-100/video on marketplaces) if they don't have in-house creators.

STRUCTURE (use this exact structure):

# YOUR 30-DAY DTC DEPLOYMENT PLAN

You just got a month of fresh creative — hooks, static ads, UGC briefs, email flows, and a content calendar. This plan tells you exactly how to deploy it without burning out or making rookie testing mistakes.

## WEEK 1: GET ADS LIVE
**Focus:** First 5-10 ads testing on Meta + TikTok by end of week.
**Time needed:** 3-4 hours.
- Task 1: [specific Meta ABO setup with budget per concept based on {{monthly_ad_spend}}]
- Task 2: [pick 5 hooks + pair with 5 statics, launch in 1 campaign]
- Task 3: [post UGC briefs on Billo/JoinBrands if no in-house creators — give specific budget]
**What to expect:** Hook rates within 48hr. Don't make optimization decisions yet — wait 72hr for statistical signal.

## WEEK 2: EMAIL FLOWS + UGC LIVE
**Focus:** Activate Welcome flow + first UGC creatives.
**Time needed:** 3 hours.
- Task 1: Load Email Flow #1 (Welcome) into Klaviyo, connect to default signup
- Task 2: First UGC videos back from creators — launch as 3 new ad sets
- Task 3: First kill decisions on Week 1 ads — anything with hook rate <25% or CTR <0.5%
**What to expect:** First email-attributed revenue + first UGC ad performance data.

## WEEK 3: SCALE WINNERS, ADD ABANDONED CART
**Focus:** Double down on what's working.
**Time needed:** 2-3 hours.
- Task 1: Increase budget 50% on top-performing ad set (let it cook 72hr before judging again)
- Task 2: ${plan === 'launch' ? 'If your Welcome flow is converting, add the abandoned cart trigger using the Welcome flow logic as a template.' : 'Load Email Flow #2 (Abandoned Cart) into Klaviyo.'}
- Task 3: Refresh ad rotation — pull in 5 more hooks from your batch
**What to expect:** Blended CAC starts trending down. Email starts contributing 15-20% of revenue.

## WEEK 4: OPTIMIZE + PREP MONTH 2
**Focus:** Lock in what's working, plan next batch.
**Time needed:** 2 hours.
- Task 1: Audit which hooks / static angles drove best ROAS
- Task 2: Reply to your delivery email with results — we'll tune next batch to double down
- Task 3: ${plan === 'dominate' || plan === 'scale' ? 'Schedule your monthly strategy call to debrief month 1' : 'Decide if you want to upgrade to Scale tier for more creative volume'}
**What to expect:** You'll know exactly which 2-3 angles to scale into month 2.

## TIMELINE EXPECTATIONS
- Days 1-7: Setup + first hook rate data
- Days 8-14: First conversion data + UGC creator turnaround
- Days 15-21: Email revenue kicks in, ad scaling decisions
- Days 22-30: Locked-in winners + planning month 2 batch

## REALISTIC METRICS YOU SHOULD SEE
- Hook rate (3-sec view %): 30-50% on winners, kill anything under 25%
- CTR: 1-2% on Meta cold, 1.5-3% on TikTok cold
- ROAS: 1.5-2.5x in month 1 is normal; 3x+ usually happens month 2 once winners are scaled

## QUESTIONS?
Reply to your delivery email anytime. We respond within 24 hours and tune next month's batch to whatever you tell us is working.

---

Output only the action plan content, no preamble.`);

  // -------------------- PROMPT 7: LANDING PAGE COPY (Scale + Dominate only) --------------------
  const landingPagePrompt = fill(`You are a high-converting DTC landing page copywriter for GriffinCreative. Write exactly ${counts.landing} complete landing page copy variations for:

Brand: {{business_name}}
Category: {{business_type}}
Audience: {{target_audience}}
Primary offer: {{ad_goals}}
Voice: {{brand_voice}}
Shopify: {{shopify_url}}
Notes: {{notes}}

RULES:
- Each variation attacks a different angle: pain-point-led, transformation-led, social-proof-led, founder-story-led, urgency/scarcity-led, comparison-led, ingredient/quality-led, etc.
- Each variation includes: hero headline, hero subhead, hero CTA button, 3 value-prop blocks (each with headline + 1-line description), social proof section (review snippets / press / partner logos placeholder), FAQ (5 questions + answers), urgency close + final CTA.
- Tone matches brand voice. Specific > generic. NO corporate fluff.

STRUCTURE (format as plain text):

# LANDING PAGE COPY — ${counts.landing} VARIATIONS

## VARIATION 1: [angle name]
**Angle:** [1 sentence explaining the framing]

### HERO
- Headline: [hero headline]
- Subhead: [supporting subhead]
- CTA button: [button text]

### VALUE PROPS (3 cards)
1. **[Card 1 headline]** — [1-line description]
2. **[Card 2 headline]** — [1-line description]
3. **[Card 3 headline]** — [1-line description]

### SOCIAL PROOF
[2-3 sentence framing + placeholder for review snippets + partner/press logos]

### FAQ (5 questions)
**Q1: [question]**
A: [answer]

[repeat for Q2-Q5]

### URGENCY CLOSE + FINAL CTA
- Closing headline: [final pitch headline]
- Closing body: [2-3 sentence final pitch]
- CTA button: [button text]

[repeat full structure for each variation]

Output only the formatted content, no preamble.`);

  // -------------------- PROMPT 7B: STRUCTURED LANDING PAGE (for hosted page build) --------------------
  // Returns ONE structured landing page object that /api/render-landing turns
  // into a finished, hosted page on griffincreativelab.com — not copy homework.
  const landingPageStructuredPrompt = fill(`You are a high-converting DTC landing page copywriter for GriffinCreative. Produce ONE complete, ready-to-publish landing page for {{business_name}} as a structured JSON object (this becomes a REAL hosted page).

Brand: {{business_name}}
Category: {{business_type}}
Audience: {{target_audience}}
Primary offer: {{ad_goals}}
Active promos: {{promos}}
Voice: {{brand_voice}}
Shopify: {{shopify_url}}
Notes: {{notes}}

Conversion-focused, specific copy — no generic filler. Match the brand voice. Make the visitor want to buy.

Return ONLY a valid JSON object:
{
  "hero_headline": "punchy hero headline (<= 10 words)",
  "hero_subhead": "supporting subhead (1 sentence)",
  "hero_cta": "CTA button text (<= 4 words)",
  "value_props": [
    { "title": "benefit (<= 5 words)", "body": "1-sentence support" },
    { "title": "benefit", "body": "1-sentence support" },
    { "title": "benefit", "body": "1-sentence support" }
  ],
  "social_proof": "one strong customer-quote-style line of social proof",
  "faq": [
    { "q": "common question", "a": "clear answer" },
    { "q": "question", "a": "answer" },
    { "q": "question", "a": "answer" },
    { "q": "question", "a": "answer" }
  ],
  "closing_headline": "final pitch headline",
  "closing_cta": "final CTA button text (<= 4 words)"
}

Output the JSON object and nothing else.`);

  // For Make.com Scenario C compatibility — DTC clients use "DTC" marker.
  // Scenario C should be PAUSED for any voice_name === "DTC" to skip AI voiceover.
  const voice_name = 'DTC';

  try {
    const prompts = [
      { key: 'ad_hooks',         text: adHooksPrompt,     parseJson: false, model: 'claude-sonnet-4-5',         max_tokens: 5000 },
      { key: 'static_ads',       text: staticAdsPrompt,   parseJson: true,  model: 'claude-haiku-4-5-20251001', max_tokens: 6000 },
      { key: 'ugc_briefs',       text: ugcBriefsPrompt,   parseJson: false, model: 'claude-sonnet-4-5',         max_tokens: 5000 },
      { key: 'video_scripts',    text: videoScriptsPrompt, parseJson: true, model: 'claude-haiku-4-5-20251001', max_tokens: 8000 },
      { key: 'email_flows',      text: emailFlowsPrompt,  parseJson: false, model: 'claude-sonnet-4-5',         max_tokens: 5000 },
      { key: 'content_calendar', text: calendarPrompt,    parseJson: false, model: 'claude-haiku-4-5-20251001', max_tokens: 7000 },
    ];

    if (plan === 'scale' || plan === 'dominate') {
      prompts.push({ key: 'landing_page_copy', text: landingPagePrompt, parseJson: false, model: 'claude-sonnet-4-5', max_tokens: 4000 });
      prompts.push({ key: 'landing_page', text: landingPageStructuredPrompt, parseJson: true, model: 'claude-sonnet-4-5', max_tokens: 2500 });
    }

    const results = await Promise.all(
      prompts.map(async ({ key, text, parseJson, model, max_tokens }) => {
        const msg = await client.messages.create({
          model,
          max_tokens,
          messages: [{ role: 'user', content: text }],
        });
        return { key, content: msg.content[0].text, parseJson };
      })
    );

    const deliverables = {};
    results.forEach(({ key, content, parseJson }) => {
      if (parseJson) {
        deliverables[key] = parseClaudeJson(content);
      } else {
        const usageGuide = USAGE_GUIDES[key] || '';
        deliverables[key] = usageGuide + content;
      }
    });

    // Resolve client's uploaded product photos to signed read URLs that
    // Make.com can hand directly to fal.ai's nano-banana/edit endpoint as
    // the image_urls input for img2img generation.
    const signed_product_urls = await getSignedProductUrls(product_image_urls);

    return res.status(200).json({
      success: true,
      client: business_name,
      plan,
      voice_name,
      brand_accent: extractBrandAccent(brand_asset_urls, brand_voice),
      brand_colors: brand_colors || '',
      logo_url: logo_url || '',
      signed_product_urls,
      deliverables,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
