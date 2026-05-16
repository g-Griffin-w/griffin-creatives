const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { business_name, business_type, target_audience, ad_goals, brand_voice, notes, amount_total } = req.body;
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
      .replace(/{{plan}}/g, plan || '');
  }

  const adCopyPrompt = fill('You are an expert direct-response copywriter for GriffinCreative. Generate all ad copy for: Business: {{business_name}}, Industry: {{business_type}}, Audience: {{target_audience}}, Offer: {{ad_goals}}, Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. If launch: 8 social media ad scripts (Hook/Body/CTA), 4 Google search ads (3 headlines 30 chars, 2 descriptions 90 chars), 2 video scripts (Hook 0-3s/Problem 3-8s/Solution 8-20s/CTA 20-30s). If scale: 20 social, 8 Google, 5 video. If dominate: 30 social, 15 Google, 8 video, 4 weeks video topics. Label everything clearly.');

  const emailPrompt = fill('You are an expert email copywriter for GriffinCreative. Generate email sequences for: Business: {{business_name}}, Industry: {{business_type}}, Audience: {{target_audience}}, Offer: {{ad_goals}}, Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. If launch: 1 sequence of 3 emails (Welcome, Value, Offer). If scale: 3 sequences of 3 emails each (Welcome, Re-engagement, Post-purchase). If dominate: 9-email automation plus 5-email re-engagement with A/B subject lines. Each email: subject line, preview text, full body, CTA button text.');

  const calendarPrompt = fill('You are a social media strategist for GriffinCreative. Generate a content calendar for: Business: {{business_name}}, Industry: {{business_type}}, Audience: {{target_audience}}, Offer: {{ad_goals}}, Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. If launch or scale: 30-day calendar. Each day: day number, platform, content type, topic/hook, full caption, 10-15 hashtags, best time. If dominate: 4 weekly calendars plus weekly video plan. Mix educational, promotional, social proof, behind-the-scenes, engagement posts.');

  const visualPrompt = fill(`You are a visual ad creative director for GriffinCreative. Generate exactly ${visualCount} static image ad concepts for: Business: {{business_name}}, Industry: {{business_type}}, Audience: {{target_audience}}, Offer: {{ad_goals}}, Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}.

Return ONLY a valid JSON array (no prose, no markdown fences) with exactly ${visualCount} objects. Each object must have these exact keys:
{
  "concept": "short name of the concept (2-5 words)",
  "headline": "the main on-image headline (max 8 words)",
  "subheadline": "supporting line (max 12 words)",
  "cta": "call to action button text (max 5 words)",
  "image_prompt": "a single ready-to-paste prompt for a text-to-image model (nano-banana-2). Describe the scene, subject, composition, lighting, mood, color palette, and instruct the model to render the headline text on the image clearly. Aspect ratio 1:1 or 4:5. Include brand-safe, photorealistic or stylized direction as appropriate to the tone."
}

Output the JSON array and nothing else.`);

  const videoPrompt = fill(`You are a short-form video ad director for GriffinCreative. Generate exactly ${videoCount} hook-style video ad concepts (5-10 seconds each) for: Business: {{business_name}}, Industry: {{business_type}}, Audience: {{target_audience}}, Offer: {{ad_goals}}, Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}.

Return ONLY a valid JSON array (no prose, no markdown fences) with exactly ${videoCount} objects. Each object must have these exact keys:
{
  "concept": "short name of the hook concept (2-5 words)",
  "hook_text": "the on-screen hook caption (max 10 words)",
  "video_prompt": "a single ready-to-paste prompt for a text-to-video model (kling-video). Describe the subject, action, camera movement, setting, lighting, mood, pacing, and any text overlay. Vertical 9:16 aspect ratio. 5-10 seconds. Keep the scene single-shot, hook-first, scroll-stopping."
}

Output the JSON array and nothing else.`);

  try {
    const prompts = [
      { key: 'ad_copy', text: adCopyPrompt, parseJson: false },
      { key: 'email_sequences', text: emailPrompt, parseJson: false },
      { key: 'content_calendar', text: calendarPrompt, parseJson: false },
    ];

    if (plan === 'scale' || plan === 'dominate') {
      prompts.push({ key: 'visual_prompts', text: visualPrompt, parseJson: true });
      prompts.push({ key: 'video_prompts', text: videoPrompt, parseJson: true });
    }

    const results = await Promise.all(
      prompts.map(async ({ key, text, parseJson }) => {
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 8000,
          messages: [{ role: 'user', content: text }],
        });
        return { key, content: msg.content[0].text, parseJson };
      })
    );

    const deliverables = {};
    results.forEach(({ key, content, parseJson }) => {
      deliverables[key] = parseJson ? parseClaudeJson(content) : content;
    });

    return res.status(200).json({ success: true, client: business_name, plan, deliverables });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
