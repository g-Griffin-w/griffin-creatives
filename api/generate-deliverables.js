const Anthropic = require('@anthropic-ai/sdk');

// Industries that should use Sarah's warm professional female voice.
// Everything else defaults to Charlie's friendly energetic male voice.
// Make.com's Scenario C uses a Router with filters on voice_name to pick the right Creatomate template.
const SARAH_INDUSTRIES = [
  // Beauty / wellness
  'spa', 'beauty', 'cosmetic', 'aesthetic', 'botox', 'laser', 'derma', 'facial',
  // Salons
  'salon', 'hair', 'nail', 'lash', 'brow', 'makeup',
  // Healthcare
  'dental', 'dentist', 'orthodont', 'medical', 'clinic', 'health', 'chiropract', 'therapy',
  // Professional services
  'real estate', 'realtor', 'mortgage', 'broker',
  'law', 'attorney', 'legal', 'accountant', 'financial', 'tax', 'insurance',
  // Pet
  'pet', 'vet', 'grooming', 'kennel',
  // Food
  'restaurant', 'cafe', 'bakery', 'food', 'catering',
  // Events
  'wedding', 'event', 'photographer', 'florist',
  // Retail
  'retail', 'ecommerce', 'boutique', 'store',
];

// Returns the voice label ("Sarah" or "Charlie") based on business type keywords.
function pickVoice(business_type) {
  const lower = (business_type || '').toLowerCase();
  const isSarah = SARAH_INDUSTRIES.some((kw) => lower.includes(kw));
  return isSarah ? 'Sarah' : 'Charlie';
}

// Client-friendly usage guides prepended to each deliverable doc.
// Static text — no AI generation needed, safe to edit anytime.
const USAGE_GUIDES = {
  action_plan: `🎯 START HERE — YOUR 30-DAY ACTION PLAN\n\nThis is your roadmap. Read this BEFORE opening the other docs.\n\nThe other docs in this folder (Ad Scripts, Email Sequences, Content Calendar) are the RAW MATERIAL. This Action Plan tells you exactly how and when to deploy each piece — week by week, task by task. Don't try to do it all at once.\n\n👇 Your 30-day plan below 👇\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`,
  ad_copy: `📋 HOW TO USE THESE AD SCRIPTS\n\nThese are ready-to-deploy ad scripts written specifically for your business.\n\n1. SOCIAL ADS (Meta, Instagram, TikTok): Copy each script's hook, body, and CTA into your ad platform. Pair with an image or video from your camera roll.\n\n2. GOOGLE ADS: Copy each headline and description into Google Ads Editor. Each headline goes in a separate field — Google rotates them automatically.\n\n3. ROTATION STRATEGY: Run 3-4 ads at the same time, NOT all of them at once. Kill the worst performers weekly. Scale the winners with more budget.\n\n4. REFRESH CADENCE: Swap in fresh scripts every 2-3 weeks to avoid ad fatigue. You'll get a new batch each month.\n\nQuestions? Reply to your delivery email.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`,

  email_sequences: `📧 HOW TO USE THESE EMAIL SEQUENCES\n\nThese are nurture and conversion sequences ready to load into your email platform.\n\n1. SETUP: Copy each email into your email platform (Mailchimp, ConvertKit, Klaviyo, Brevo). Each email becomes a campaign in a sequence.\n\n2. TIMING: Most sequences are designed for Day 1, Day 3, Day 7 cadence. Use your platform's "automation" or "drip sequence" feature.\n\n3. TRIGGER: Connect the sequence to your signup form so new subscribers automatically enter Day 1.\n\n4. PERSONALIZATION: Replace any [bracketed placeholders] with your platform's merge tags (e.g., *|FIRSTNAME|* in Mailchimp).\n\n5. METRICS: Watch open rates. Under 20% means your subject lines need refreshing. Over 40% means you're crushing it — scale it.\n\nQuestions? Reply to your delivery email.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`,

  content_calendar: `📅 HOW TO USE THIS CONTENT CALENDAR\n\nYour 30-day social media plan, ready to post. No more staring at a blank screen wondering what to share.\n\n1. POST WHAT'S WRITTEN: Each day shows the platform, topic, full caption, hashtags, and best posting time. Just post it as-is.\n\n2. BATCH SCHEDULING: Use Buffer, Later, or your platform's native scheduler to queue an entire month at once. Saves hours every week.\n\n3. CUSTOMIZATION: Captions work as-is, but feel free to swap in your own photos when you have them. Captions match your brand voice already.\n\n4. HASHTAGS: Use all 10-15 hashtags on Instagram. On LinkedIn or Twitter/X, pick the 3-5 best ones.\n\n5. ENGAGEMENT: Spend 10 minutes a day replying to comments. Algorithms reward active accounts with more reach.\n\nQuestions? Reply to your delivery email.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`,
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
  } = req.body;
  let { plan } = req.body;

  // Derive plan from amount_total if not explicitly provided.
  // Current pricing: Launch $700, Scale $1,750, Dominate $3,500.
  // Older amounts retained for backward compatibility with any legacy subscriptions still active.
  if (!plan && amount_total) {
    const amt = Number(amount_total);
    if (amt === 70000 || amt === 50000) plan = 'launch';
    else if (amt === 175000 || amt === 120000 || amt === 130000) plan = 'scale';
    else if (amt === 350000 || amt === 250000 || amt === 260000) plan = 'dominate';
  }

  if (!business_name || !plan) {
    return res.status(400).json({ success: false, error: 'Missing required fields', received: { business_name: !!business_name, plan, amount_total } });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Counts for visual + video deliverables per plan
  const visualCount = plan === 'dominate' ? 20 : plan === 'scale' ? 10 : 0;
  const videoCount = plan === 'dominate' ? 10 : plan === 'scale' ? 5 : 0;

  // Strip markdown code fences and parse JSON safely
  function parseClaudeJson(text) {
    if (!text) return [];
    let cleaned = text.trim();
    // Remove ```json or ``` fences if present
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    // Find first [ and last ] in case Claude added preamble
    const first = cleaned.indexOf('[');
    const last = cleaned.lastIndexOf(']');
    if (first !== -1 && last !== -1 && last > first) {
      cleaned = cleaned.slice(first, last + 1);
    }
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      return { _parse_error: e.message, _raw: text };
    }
  }

  function fill(template) {
    return template
      .replace(/{{business_name}}/g, business_name || '')
      .replace(/{{business_type}}/g, business_type || '')
      .replace(/{{target_audience}}/g, target_audience || '')
      .replace(/{{ad_goals}}/g, ad_goals || '')
      .replace(/{{brand_voice}}/g, brand_voice || '')
      .replace(/{{notes}}/g, notes || '')
      .replace(/{{plan}}/g, plan || '')
      .replace(/{{phone_display}}/g, phone_display || '')
      .replace(/{{website_display}}/g, website_display || '')
      .replace(/{{promos}}/g, promos || '')
      .replace(/{{booking_link}}/g, booking_link || '');
  }

  const adCopyPrompt = fill('You are an expert direct-response copywriter for GriffinCreative. Generate all ad copy for: Business: {{business_name}}, Industry: {{business_type}}, Audience: {{target_audience}}, Offer: {{ad_goals}}, Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. If launch: 8 social media ad scripts (Hook/Body/CTA), 4 Google search ads (3 headlines 30 chars, 2 descriptions 90 chars), 2 video scripts (Hook 0-3s/Problem 3-8s/Solution 8-20s/CTA 20-30s). If scale: 20 social, 8 Google, 5 video. If dominate: 30 social, 15 Google, 8 video, 4 weeks video topics. Label everything clearly.');

  const emailPrompt = fill('You are an expert email copywriter for GriffinCreative. Generate email sequences for: Business: {{business_name}}, Industry: {{business_type}}, Audience: {{target_audience}}, Offer: {{ad_goals}}, Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. If launch: 1 sequence of 3 emails (Welcome, Value, Offer). If scale: 3 sequences of 3 emails each (Welcome, Re-engagement, Post-purchase). If dominate: 5 sequences of 3 emails each (Welcome, Nurture, Re-engagement, Post-purchase, Win-back) with two A/B subject line variants per email. Each email: subject line(s), preview text, full body, CTA button text.');

  const calendarPrompt = fill('You are a social media strategist for GriffinCreative. Generate a content calendar for: Business: {{business_name}}, Industry: {{business_type}}, Audience: {{target_audience}}, Offer: {{ad_goals}}, Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. If launch or scale: 30-day calendar. Each day: day number, platform, content type, topic/hook, full caption, 10-15 hashtags, best time. If dominate: 4 weekly calendars plus weekly video plan. Mix educational, promotional, social proof, behind-the-scenes, engagement posts.');

  const actionPlanPrompt = fill(`You are a deployment coach for GriffinCreative. Your job: turn the AI-generated deliverables into a simple, week-by-week action plan that a busy small business owner can actually execute.

Client info:
- Business: {{business_name}}
- Industry: {{business_type}}
- Audience: {{target_audience}}
- Goal: {{ad_goals}}
- Plan: {{plan}}

Write a 30-day Quick Start Action Plan organized into 4 weeks. Format as plain text with clear week-by-week sections.

CRITICAL RULES:
- Be conversational and direct. Talk like a smart friend helping them, not a corporate document.
- Each week has ONE main focus + 2-3 specific tasks. Don't overwhelm.
- Include LINKS to the tools they'll need (Facebook Ads Manager: https://business.facebook.com, Google Ads: https://ads.google.com, Mailchimp: https://mailchimp.com, Buffer: https://buffer.com, Loom: https://loom.com)
- Recommend STARTING BUDGETS: Facebook ads start at $15-30/day, Google search ads start at $20-50/day for service businesses.
- Set realistic expectations: Week 1 = setup + first clicks, Week 3 = first leads expected, Week 4 = optimization.
- Reassure them: "Reply to your delivery email any time with questions."

STRUCTURE (use this exact structure):

# YOUR 30-DAY QUICK START ACTION PLAN

You just received your full ad creative package — congrats. This plan tells you exactly what to do with it, week by week. You do NOT need to do everything at once. Pace yourself, hit each week's goals, and you'll see results.

## WEEK 1: GET YOUR FACEBOOK AD LIVE
**Goal:** First ad running by end of the week.
**Time needed:** 60-90 minutes total this week.
- Task 1: ... (specific to their industry — explain setting up Facebook Business Manager and what to put where)
- Task 2: ...
- Task 3: ...
**What to expect:** You'll see clicks within hours of launching. Don't worry about leads yet — that comes Week 3.

## WEEK 2: ADD GOOGLE SEARCH ADS + EMAIL
**Goal:** Capture high-intent search traffic + start nurturing leads.
**Time needed:** 90 minutes total this week.
- Task 1: Google Ads setup and copy paste (specific keywords for their industry)
- Task 2: Mailchimp signup and load Email Sequence #1
- Task 3: ...
**What to expect:** Search ads convert higher than social. Email nurture takes 7-10 days to start producing.

## WEEK 3: SOCIAL MEDIA + REVIEW WHAT'S WORKING
**Goal:** Get social presence going + check ad performance.
**Time needed:** 60 minutes this week.
- Task 1: Start posting from your content calendar (recommend Buffer for scheduling)
- Task 2: Review Facebook ads — kill any with cost-per-click over $X, scale winners
- Task 3: ...
**What to expect:** First leads should be coming in by now. If not, we'll troubleshoot.

## WEEK 4: OPTIMIZE + PREP FOR MONTH 2
**Goal:** Double down on winners, kill losers, request next batch.
**Time needed:** 45 minutes this week.
- Task 1: Pause the worst-performing ads
- Task 2: Increase budget on the best ad by 50%
- Task 3: Reply to your delivery email — let us know what to focus on next month

## QUESTIONS?
Reply to your delivery email at any time. We respond within 24 hours.

## REALISTIC TIMELINE
- Days 1-7: Setup work, first ad clicks
- Days 8-14: More clicks, first email opens
- Days 15-21: First inbound leads (typically)
- Days 22-30: Optimization, scale what works

This is real, not magic. Stick with the plan and you'll see results.

---

Make every task specific to {{business_type}} (e.g., a roofer's Facebook targeting differs from an insurance agent's). Reference their actual goal {{ad_goals}}. Keep tone supportive, never condescending. Output ONLY the action plan — no preamble.`);

  const visualPrompt = fill(`You are a visual ad creative director for GriffinCreative. Generate exactly ${visualCount} static image ad concepts for:

Business: {{business_name}}
Industry: {{business_type}}
Audience: {{target_audience}}
Primary offer / goal: {{ad_goals}}
Active promos (use these — vary across the ${visualCount} ads): {{promos}}
Tone: {{brand_voice}}
Notes: {{notes}}
Phone to display on ads: {{phone_display}}
Website to display on ads: {{website_display}}
Booking link: {{booking_link}}
Plan: {{plan}}

Rules:
- Each of the ${visualCount} concepts should attack a DIFFERENT angle: a promo, a problem/solution, a testimonial-style, a benefit-led, a "limited time" urgency, a social proof, a "what to expect," a before/after style framing, etc. Spread across the active promos listed above.
- Every image must include the business name AND either the phone number OR the website (or both) as a small text element near the bottom of the image. Treat it like a contact footer.
- Text on images should be SHORT and rendered cleanly. nano-banana renders text well but keep headlines under 8 words.

Return ONLY a valid JSON array (no prose, no markdown fences) with exactly ${visualCount} objects. Each object must have these exact keys:
{
  "concept": "short name of the concept (2-5 words)",
  "headline": "the main on-image headline (max 8 words)",
  "subheadline": "supporting line (max 12 words)",
  "cta": "call to action button text (max 5 words)",
  "image_prompt": "a single ready-to-paste prompt for nano-banana. Must describe: scene/subject, composition, lighting, mood, color palette, the exact headline text to render on the image, and instructions to render a small contact footer with the business name and phone/website. Aspect ratio 1:1 or 4:5. Photorealistic or stylized as fits the tone."
}

Output the JSON array and nothing else.`);

  const videoPrompt = fill(`You are a short-form video ad director for GriffinCreative. Generate exactly ${videoCount} hook-style video ad concepts (10 seconds each) for:

Business: {{business_name}}
Industry: {{business_type}}
Audience: {{target_audience}}
Primary offer / goal: {{ad_goals}}
Active promos (vary across the ${videoCount} videos): {{promos}}
Tone: {{brand_voice}}
Notes: {{notes}}
Phone to display: {{phone_display}}
Website to display: {{website_display}}
Plan: {{plan}}

Rules:
- Each of the ${videoCount} concepts should be a different hook angle — pattern interrupt, problem reveal, transformation, lifestyle moment, behind-the-scenes, "POV you just walked in," etc. Spread across the active promos.
- The hook_text field holds the caption that will be overlaid in post-production by a separate video templating service. HARD LIMIT: hook_text must be 6 words or fewer AND 35 characters or fewer (including spaces). Anything longer overflows the on-screen text box and breaks the ad layout. Punchy, scroll-stopping copy only — good examples: "Roof leak? Read this.", "Stop overpaying for repairs", "Don't wait for storm damage". The video_prompt itself must produce a 100% clean visual with ZERO text rendered in-frame — no signs, no labels, no captions, no business names, no end-cards, no logos, no written words of any kind. AI video models render text poorly, so all text is added in post.

Return ONLY a valid JSON array (no prose, no markdown fences) with exactly ${videoCount} objects. Each object must have these exact keys:
{
  "concept": "short name of the hook concept (2-5 words)",
  "hook_text": "the on-screen hook caption to overlay in post — MAX 6 words AND MAX 35 characters total including spaces (HARD LIMIT — longer text breaks the ad layout)",
  "video_prompt": "a single ready-to-paste prompt for kling-video. Describe ONLY the visual: subject, action, camera movement, setting, lighting, mood, pacing, color palette. DO NOT mention any text, captions, signs, labels, logos, written words, business names, phone numbers, or end-cards — the video must be 100% text-free clean visuals. Vertical 9:16 aspect ratio. 10 seconds. Single-shot, scroll-stopping."
}

Output the JSON array and nothing else.`);

  // Smart default: pick voice (Charlie vs Sarah) based on industry keywords.
  // Scenario C's Router uses this to choose which Creatomate template to render with.
  const voice_name = pickVoice(business_type);

  try {
    // Speed optimization: Haiku for structured JSON outputs (much faster),
    // Sonnet only for the long-form creative writing.
    // Right-sized max_tokens per task to avoid worst-case generation time.
    const prompts = [
      { key: 'action_plan',      text: actionPlanPrompt, parseJson: false, model: 'claude-sonnet-4-5',         max_tokens: 3000 },
      { key: 'ad_copy',          text: adCopyPrompt,     parseJson: false, model: 'claude-sonnet-4-5',         max_tokens: 4000 },
      { key: 'email_sequences',  text: emailPrompt,      parseJson: false, model: 'claude-sonnet-4-5',         max_tokens: 3000 },
      { key: 'content_calendar', text: calendarPrompt,   parseJson: false, model: 'claude-haiku-4-5-20251001', max_tokens: 6000 },
    ];

    if (plan === 'scale' || plan === 'dominate') {
      prompts.push({ key: 'visual_prompts', text: visualPrompt, parseJson: true, model: 'claude-haiku-4-5-20251001', max_tokens: 4000 });
      prompts.push({ key: 'video_prompts',  text: videoPrompt,  parseJson: true, model: 'claude-haiku-4-5-20251001', max_tokens: 2500 });
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
        // Prepend usage guide for client-friendly docs (ad_copy, email_sequences, content_calendar)
        const usageGuide = USAGE_GUIDES[key] || '';
        deliverables[key] = usageGuide + content;
      }
    });

    return res.status(200).json({
      success: true,
      client: business_name,
      plan,
      voice_name,
      deliverables,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
