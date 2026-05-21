const Anthropic = require('@anthropic-ai/sdk');

// Creatomate template IDs — set these as environment variables in Vercel.
// Each template is identical EXCEPT for the ElevenLabs voice (Charlie vs Sarah).
const CHARLIE_TEMPLATE_ID = process.env.CREATOMATE_CHARLIE_TEMPLATE_ID;
const SARAH_TEMPLATE_ID = process.env.CREATOMATE_SARAH_TEMPLATE_ID;

// Industries that should use Sarah's warm professional female voice.
// Everything else defaults to Charlie's friendly energetic male voice.
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

// Returns the Creatomate template ID + voice label based on business type keywords.
function pickTemplate(business_type) {
  const lower = (business_type || '').toLowerCase();
  const isSarah = SARAH_INDUSTRIES.some((kw) => lower.includes(kw));
  return {
    template_id: isSarah ? SARAH_TEMPLATE_ID : CHARLIE_TEMPLATE_ID,
    voice_name: isSarah ? 'Sarah' : 'Charlie',
  };
}

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

  // Derive plan from amount_total if not explicitly provided
  // Supports both legacy pricing (120000/250000) and new pricing (130000/260000) for backward compatibility
  if (!plan && amount_total) {
    const amt = Number(amount_total);
    if (amt === 50000) plan = 'launch';
    else if (amt === 120000 || amt === 130000) plan = 'scale';
    else if (amt === 250000 || amt === 260000) plan = 'dominate';
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

  const emailPrompt = fill('You are an expert email copywriter for GriffinCreative. Generate email sequences for: Business: {{business_name}}, Industry: {{business_type}}, Audience: {{target_audience}}, Offer: {{ad_goals}}, Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. If launch: 1 sequence of 3 emails (Welcome, Value, Offer). If scale: 3 sequences of 3 emails each (Welcome, Re-engagement, Post-purchase). If dominate: 9-email automation plus 5-email re-engagement with A/B subject lines. Each email: subject line, preview text, full body, CTA button text.');

  const calendarPrompt = fill('You are a social media strategist for GriffinCreative. Generate a content calendar for: Business: {{business_name}}, Industry: {{business_type}}, Audience: {{target_audience}}, Offer: {{ad_goals}}, Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. If launch or scale: 30-day calendar. Each day: day number, platform, content type, topic/hook, full caption, 10-15 hashtags, best time. If dominate: 4 weekly calendars plus weekly video plan. Mix educational, promotional, social proof, behind-the-scenes, engagement posts.');

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

  // Smart default: pick Creatomate template (Charlie vs Sarah) based on industry keywords.
  const { template_id: creatomate_template_id, voice_name } = pickTemplate(business_type);

  try {
    // Speed optimization: Haiku for structured JSON outputs (much faster),
    // Sonnet only for the long-form creative writing.
    // Right-sized max_tokens per task to avoid worst-case generation time.
    const prompts = [
      { key: 'ad_copy',          text: adCopyPrompt,    parseJson: false, model: 'claude-sonnet-4-5',         max_tokens: 4000 },
      { key: 'email_sequences',  text: emailPrompt,     parseJson: false, model: 'claude-sonnet-4-5',         max_tokens: 3000 },
      { key: 'content_calendar', text: calendarPrompt,  parseJson: false, model: 'claude-haiku-4-5-20251001', max_tokens: 6000 },
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
      deliverables[key] = parseJson ? parseClaudeJson(content) : content;
    });

    return res.status(200).json({
      success: true,
      client: business_name,
      plan,
      template_id: creatomate_template_id,
      voice_name,
      deliverables,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
