// Vercel Serverless Function: POST /api/generate-weekly-content
//
// Generates one week of GriffinCreativeLab marketing content (5 LinkedIn posts,
// 1 Twitter thread, 1 IG teardown brief) using Claude, then inserts them into
// the content_queue table with status='draft' for human approval.
//
// Request body:
//   {
//     "week_start_date": "2026-06-09",         // Monday of target week, ISO date
//     "week_number": 1,                          // 1-4 of the 30-day calendar
//     "teardown_brand": "Olipop",                // brand to teardown this week
//     "regenerate": false                        // optional, replaces existing drafts for this week
//   }
//
// Auth:
//   x-api-key header must match process.env.CONTENT_GEN_API_KEY
//
// Required env vars:
//   SUPABASE_URL                    (already set)
//   SUPABASE_SERVICE_KEY            (already set)
//   ANTHROPIC_API_KEY               (already set — used by other endpoints)
//   CONTENT_GEN_API_KEY             (new — set in Vercel for auth)

const Anthropic = require("@anthropic-ai/sdk");
const { createClient: createSupabaseClient } = require("@supabase/supabase-js");

// Allow up to 90 seconds. All Claude calls run in parallel below so this is
// belt-and-suspenders — the function should finish in ~25-40s.
module.exports.config = { maxDuration: 90 };

// ----- lazy clients -----
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const e = new Error("Missing SUPABASE env vars");
    e.code = "MISSING_ENV";
    throw e;
  }
  _supabase = createSupabaseClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

let _anthropic = null;
function getAnthropic() {
  if (_anthropic) return _anthropic;
  if (!process.env.ANTHROPIC_API_KEY) {
    const e = new Error("Missing ANTHROPIC_API_KEY env var");
    e.code = "MISSING_ENV";
    throw e;
  }
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ----- prompts -----
//
// Brand voice for GCL is captured here in one place. Reference it from every
// prompt so the engine's output sounds like Gabriel, not generic AI.
const GCL_BRAND_VOICE = `
You write as Gabriel Wigginton, the solo founder of GriffinCreativeLab, an
automated AI ad-creative agency for fast-growing DTC brands. Tone:

- Direct, confident, no fluff. Drop articles when natural ("Built fast.
  Built to convert.")
- Strong opinions, willing to disagree with the industry consensus.
- Build-in-public energy from a 0-client founder building publicly.
- NEVER use these words: "synergy", "leverage" (as a verb), "ecosystem",
  "stakeholders", "deliver value", "thought leadership", "in today's market".
- NO em dashes when a comma works. NO emojis unless the post is ironic.
- Lines that someone would actually screenshot beat lines that sound smart.

============================================================================
HARD RULE — NEVER FABRICATE FACTS. THIS IS NON-NEGOTIABLE.
============================================================================

Gabriel is a SOLO FOUNDER with 0 paying clients yet. He is building in public.
Any post that invents fake credentials, client counts, case study data, or
historical brand facts will torch his credibility the first time someone
catches the lie.

NEVER invent or assume any of the following:
- Client counts ("we tested X creatives across Y brands")
- Personal track record claims ("I've helped X founders scale to $Y")
- Revenue figures for specific named brands (Olipop's exact 18-month spend,
  Magic Spoon's exact CAC, etc.) — these are private numbers you don't have
- Quoted statistics ("DTC brands testing 5+ hooks see 2x ROAS") unless they
  are clearly framed as opinion or industry-feel, not data
- Case studies, past wins, client testimonials, "we built X for Y client"
- Specific dollar amounts attributed to any third-party brand

WHAT TO DO INSTEAD:
- If a post genuinely needs a specific stat, write [INSERT STAT — describe
  what stat you need] inline so Gabriel can fill it in with a real number.
- Use general industry language: "most DTC brands", "the brands I talk to",
  "what I'm seeing in cold DMs", "from what's public", "the pattern I notice"
- For public brand history (Olipop, Liquid Death, etc.), only reference what
  is *common knowledge* and PUBLICLY reported, not invented backstory.
- Lean on what Gabriel CAN credibly claim: his own pipeline, his own
  Make.com + Nano Banana + Supabase build, his own DM experiments, his own
  thinking. First-person observation > fake third-person data.
============================================================================

Pricing reference for context (do not quote unless prompted):
  Launch $700/mo, Scale $1,750/mo, Dominate $3,500/mo. No contracts.

Stack reference: Make.com + Claude + Nano Banana img2img + Supabase + Vercel.
Solo founder running 3 AI businesses (MedAd, RoofScript, GriffinCreativeLab).
`;

function linkedinPostPrompt({ weekNumber, dayOfWeek, topic }) {
  return `${GCL_BRAND_VOICE}

Write ONE LinkedIn post for ${dayOfWeek} of Week ${weekNumber}.

Topic: ${topic}

Format requirements:
- 3 to 6 sentences total, or up to 8 short lines if using bullet points
- One specific insight, story, or contrarian take
- Opens with a strong hook line that works as a standalone (LinkedIn truncates after ~3 lines)
- NO links inside the post
- NO hashtags inside the post (LinkedIn doesn't reward them anymore)
- Ends with a soft CTA or question
- Reads like a founder typing on their phone, not an agency blog post

Return ONLY the post body, no preamble, no quotes, no markdown.`;
}

function twitterThreadPrompt({ weekNumber, topic }) {
  return `${GCL_BRAND_VOICE}

Write ONE Twitter thread for Week ${weekNumber}.

Topic: ${topic}

Format requirements:
- Exactly 7 to 9 tweets
- Tweet 1 = hook, can be a number, a contrarian claim, or a curiosity gap
- Tweets 2-7 = the breakdown, one specific idea per tweet
- Last tweet = takeaway + soft CTA (DM me, follow for more, etc.)
- Each tweet under 280 chars
- No threading number prefixes (1/, 2/) — those are dated
- No hashtags

Return ONLY a JSON array of strings, one per tweet. No preamble, no markdown fences.
Example: ["tweet 1 text", "tweet 2 text", ...]`;
}

function teardownBriefPrompt({ brandName, weekNumber }) {
  return `${GCL_BRAND_VOICE}

Generate a teardown brief for a public GriffinCreativeLab IG carousel post.
Target brand: ${brandName}
Week: ${weekNumber}

The output will eventually become a 6-slide IG carousel + a caption. Generate the
SLIDE COPY ONLY for now (visuals will render later via a separate pipeline).

Return STRICTLY this JSON shape, no preamble:

{
  "brand": "${brandName}",
  "anonymized_descriptor": "a 1-sentence anonymized way to refer to them in caption (e.g. 'a $9M-raised DTC pet brand')",
  "diagnosis_summary": "1-2 sentence headline of the creative gap",
  "slides": {
    "slide_1_hook": {
      "eyebrow": "CREATIVE TEARDOWN N°XX",
      "headline_lines": ["LINE 1", "LINE 2 with accent word"],
      "accent_word": "the word in slide 1 that gets the orange color",
      "subhead": "one sentence underneath",
      "cta_pointer": "the orange arrow line at the bottom"
    },
    "slide_2_pattern": {
      "eyebrow": "THE PATTERN",
      "headline_lines": ["EVERY AD LOOKS", "EXACTLY LIKE THIS:"],
      "callouts": [
        {"head": "callout 1 in caps", "sub": "(parenthetical)"},
        {"head": "callout 2 in caps", "sub": "(parenthetical)"},
        {"head": "callout 3 in caps", "sub": "(parenthetical)"}
      ]
    },
    "slide_3_diagnosis": {
      "eyebrow": "DIAGNOSIS",
      "headline_lines": ["WHY THIS", "LEAKS MONEY."],
      "callouts": [
        {"num": "01", "head": "POINT 1 IN CAPS", "body": "1-2 sentence explanation"},
        {"num": "02", "head": "POINT 2 IN CAPS", "body": "1-2 sentence explanation"},
        {"num": "03", "head": "POINT 3 IN CAPS", "body": "1-2 sentence explanation"}
      ]
    },
    "slide_4_fix": {
      "eyebrow": "THE FIX",
      "headline_lines": ["4 ANGLES. SAME", "PRODUCT. 48 HOURS."],
      "angles": [
        {"head": "ANGLE 1", "body": "1 sentence"},
        {"head": "ANGLE 2", "body": "1 sentence"},
        {"head": "ANGLE 3", "body": "1 sentence"},
        {"head": "ANGLE 4", "body": "1 sentence"}
      ]
    },
    "slide_5_math": {
      "eyebrow": "THE MATH",
      "headline_lines": ["WHAT THE GAP", "IS COSTING THEM."],
      "stats": [
        {"label": "EST. META SPEND", "big": "$80K", "sub": "/ month"},
        {"label": "CURRENT ROAS", "big": "1.4x", "sub": "(industry typical)"},
        {"label": "LIFT FROM CREATIVE REFRESH", "big": "+30–50%", "sub": "(category avg)"}
      ],
      "recovered_revenue_block": {
        "label": "RECOVERED REVENUE",
        "big": "$24K–$40K /mo",
        "sub": "≈ $290K–$480K / year"
      }
    },
    "slide_6_cta": {
      "eyebrow": "FREE TEARDOWN",
      "headline_lines": ["WE DO THIS", "FOR DTC BRANDS", "EVERY WEEK."],
      "accent_word": "EVERY WEEK.",
      "sub_lines": ["If your ROAS plateaued and you can't", "tell why — we'll show you, free."],
      "cta_box": {"prefix": "DM US", "main": "\\"AUDIT\\""}
    }
  },
  "caption": "Full IG caption matching brand voice, ending with: griffincreativelab.com\\n\\n.\\n.\\n.\\n#DTC #ecommerce #shopify #directtoconsumer #adcreative #metaads"
}

Anonymize the brand in the slide copy and caption — say "a $XM-raised DTC [category] brand", not the name itself.
Keep numbers realistic for this brand's actual scale.
Return ONLY the JSON object.`;
}

// ----- the weekly content calendar -----
//
// This drives what gets generated each week. Tied to the 30-day plan that
// was already written. Keep it in code so we can iterate without DB changes.
function getWeeklyPlan(weekNumber) {
  const plans = {
    1: {
      label: "Week 1 — Foundation Stack",
      linkedin: [
        { day: "mon", topic: "Cross-post: just dropped a teardown of [BRAND]. What every DTC can steal from it." },
        { day: "tue", topic: "The single hook format outperforming everything in DTC right now." },
        { day: "wed", topic: "Build-in-public: we just shipped Nano Banana img2img into our pipeline." },
        { day: "thu", topic: "Cross-post: just dropped a teardown of [BRAND]. The creative gap most don't see." },
        { day: "fri", topic: "Closed my first sample-creatives call this week. Here's the exact DM that worked." },
      ],
      twitter_thread_topic: "The agency pricing playbook nobody publishes: why we list our $700/$1,750/$3,500 tiers right on the homepage when every other agency hides theirs.",
      teardown_day: "mon",
    },
    2: {
      label: "Week 2 — Compound",
      linkedin: [
        { day: "mon", topic: "Cross-post: this week's teardown of [BRAND]. The $X/year gap on the table." },
        { day: "tue", topic: "How we generate 40 static ad concepts per client per month at $3.5K. The architecture." },
        { day: "wed", topic: "Why I price transparently when every other agency hides their numbers." },
        { day: "thu", topic: "Cross-post: teardown of [BRAND]. They nailed product-market fit, now creative is the bottleneck." },
        { day: "fri", topic: "Week 2 of building in public. What's working, what's flopping." },
      ],
      twitter_thread_topic: "Why most DTC brands are 1 hook away from cutting their CPM in half. The math on creative variation.",
      teardown_day: "mon",
    },
    3: {
      label: "Week 3 — Sustainable",
      linkedin: [
        { day: "mon", topic: "The 5 cold DM templates that get DTC founders to reply, broken down." },
        { day: "tue", topic: "Build-in-public: hit X DM replies this week. The pattern I'm seeing." },
        { day: "wed", topic: "Cross-post: this week's teardown of [BRAND]. The category gap most miss." },
        { day: "thu", topic: "The #1 ROAS killer in DTC isn't your ad spend. It's creative fatigue." },
        { day: "fri", topic: "Behind-the-scenes: our Make.com pipeline produces 25 ads in 2 hours. The architecture." },
      ],
      twitter_thread_topic: "I cold-DM'd 100 DTC brands this month. Here's what worked, what flopped, and the format that's printing replies.",
      teardown_day: "wed",
    },
    4: {
      label: "Week 4 — Convert",
      linkedin: [
        { day: "mon", topic: "What 90% of DTC brands get wrong about UGC scripts (and the fix)." },
        { day: "tue", topic: "Closed [X] this week. Here's the full DM thread (anonymized)." },
        { day: "wed", topic: "Cross-post: this week's teardown of [BRAND]. They built the category — and could double down." },
        { day: "thu", topic: "Why DTC brands that test 5+ hooks/week have 2x ROAS vs. those that don't." },
        { day: "fri", topic: "Month 1 in public. What worked, what flopped, what's next." },
      ],
      twitter_thread_topic: "The 4 things every $1-10M DTC brand is doing wrong with their static ads. Fixable in week one.",
      teardown_day: "wed",
    },
  };
  return plans[weekNumber];
}

// ----- Claude call helper -----
async function callClaude(prompt, { model = "claude-sonnet-4-5", max_tokens = 2500 } = {}) {
  const anthropic = getAnthropic();
  const msg = await anthropic.messages.create({
    model,
    max_tokens,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content[0].text;
}

function parseJsonLoose(text) {
  // Strip code fences + slice to first { or [
  let cleaned = String(text).trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // Find the outermost {...} or [...]
  const candidates = [
    [cleaned.indexOf("{"), cleaned.lastIndexOf("}")],
    [cleaned.indexOf("["), cleaned.lastIndexOf("]")],
  ];
  for (const [s, e] of candidates) {
    if (s !== -1 && e !== -1 && e > s) {
      try {
        return JSON.parse(cleaned.slice(s, e + 1));
      } catch (_) {}
    }
  }
  try { return JSON.parse(cleaned); } catch (e) {
    return { _parse_error: e.message, _raw: text };
  }
}

// ----- date helpers -----
function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
function dayIndex(day) { return DAY_ORDER.indexOf(day); }

function scheduledAtFor(weekStartISO, dayOfWeek) {
  // Schedule weekday posts at 10:30am ET = 14:30 UTC (DST approx)
  const idx = dayIndex(dayOfWeek);
  if (idx === -1) return null;
  const d = addDays(weekStartISO + "T14:30:00.000Z", idx);
  return d.toISOString();
}

// ----- main handler -----
module.exports = async (req, res) => {
  // Simple API-key gate so this isn't publicly callable
  const expectedKey = process.env.CONTENT_GEN_API_KEY;
  if (expectedKey && req.headers["x-api-key"] !== expectedKey) {
    return res.status(401).json({ error: "Invalid or missing x-api-key" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let sb, anthropic;
    try { sb = getSupabase(); anthropic = getAnthropic(); }
    catch (e) { return res.status(500).json({ error: e.message }); }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const {
      week_start_date,
      week_number,
      teardown_brand,
      regenerate = false,
    } = body;

    if (!week_start_date || !week_number || !teardown_brand) {
      return res.status(400).json({
        error: "Missing required: week_start_date (YYYY-MM-DD), week_number (1-4), teardown_brand",
      });
    }
    const plan = getWeeklyPlan(week_number);
    if (!plan) return res.status(400).json({ error: "Invalid week_number (1-4)" });

    // Optionally clear existing drafts for this week (regenerate flag)
    if (regenerate) {
      await sb.from("content_queue")
        .delete()
        .eq("week_number", week_number)
        .eq("status", "draft");
    }

    // Run all 7 Claude calls in parallel — cuts runtime from ~70s sequential
    // to ~25-40s. Each task returns a row object ready to insert.
    const linkedInTasks = plan.linkedin.map(({ day, topic }) => async () => {
      const filled = topic.replace(/\[BRAND\]/g, teardown_brand);
      const text = await callClaude(
        linkedinPostPrompt({ weekNumber: week_number, dayOfWeek: day, topic: filled }),
        { max_tokens: 600 }
      );
      return {
        status: "draft",
        platform: "linkedin",
        type: "linkedin_post",
        topic: filled,
        content: text.trim(),
        week_number: week_number,
        day_of_week: day,
        scheduled_at: scheduledAtFor(week_start_date, day),
        ai_model: "claude-sonnet-4-5",
      };
    });

    const twitterTask = async () => {
      const text = await callClaude(
        twitterThreadPrompt({ weekNumber: week_number, topic: plan.twitter_thread_topic }),
        { max_tokens: 1500 }
      );
      const tweets = parseJsonLoose(text);
      const threadContent = Array.isArray(tweets)
        ? JSON.stringify(tweets)
        : JSON.stringify({ _parse_error: true, _raw: text });
      return {
        status: "draft",
        platform: "twitter",
        type: "twitter_thread",
        topic: plan.twitter_thread_topic,
        content: threadContent,
        week_number: week_number,
        day_of_week: "wed",
        scheduled_at: scheduledAtFor(week_start_date, "wed"),
        ai_model: "claude-sonnet-4-5",
      };
    };

    const teardownTask = async () => {
      const text = await callClaude(
        teardownBriefPrompt({ brandName: teardown_brand, weekNumber: week_number }),
        { max_tokens: 4000 }
      );
      const brief = parseJsonLoose(text);
      return {
        status: "draft",
        platform: "instagram",
        type: "teardown_carousel",
        topic: `Teardown: ${teardown_brand}`,
        content: JSON.stringify(brief),
        caption: brief.caption || null,
        week_number: week_number,
        day_of_week: plan.teardown_day,
        scheduled_at: scheduledAtFor(week_start_date, plan.teardown_day),
        ai_model: "claude-sonnet-4-5",
        notes: brief._parse_error ? "Parse error on brief: " + brief._parse_error : null,
      };
    };

    // Fire everything in parallel
    const allTasks = [...linkedInTasks.map((t) => t()), twitterTask(), teardownTask()];
    const rowsToInsert = await Promise.all(allTasks);

    // --- Insert all into content_queue ---
    const { data: inserted, error: insErr } = await sb
      .from("content_queue")
      .insert(rowsToInsert)
      .select("id, platform, type, day_of_week, topic, scheduled_at, status");

    if (insErr) {
      return res.status(500).json({ error: "Insert failed", detail: insErr.message });
    }

    return res.status(200).json({
      success: true,
      week_number,
      week_label: plan.label,
      teardown_brand,
      generated_count: inserted.length,
      drafts: inserted,
      next_step: "Review drafts in Supabase content_queue (status='draft'), edit if needed, then update status to 'approved' to queue for posting.",
    });
  } catch (err) {
    console.error("generate-weekly-content error:", err);
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
};
