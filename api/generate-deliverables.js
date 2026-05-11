const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(template, data) {
  return template
    .replace(/{{business_name}}/g, data.business_name || '')
    .replace(/{{business_type}}/g, data.business_type || '')
    .replace(/{{target_audience}}/g, data.target_audience || '')
    .replace(/{{ad_goals}}/g, data.ad_goals || '')
    .replace(/{{brand_voice}}/g, data.brand_voice || '')
    .replace(/{{notes}}/g, data.notes || '')
    .replace(/{{plan}}/g, data.plan || '');
}

const AD_COPY_PROMPT = `You are an expert direct-response copywriter for GriffinCreative, a done-for-you AI ad agency. Generate all ad copy deliverables for this client. CLIENT INFO: Business Name: {{business_name}}, Industry: {{business_type}}, Target Audience: {{target_audience}}, Offer: {{ad_goals}}, Brand Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. IF plan=launch: 8 social media ad scripts (Hook, Body, CTA), 4 Google search ads (3 Headlines 30 chars max, 2 Descriptions 90 chars max), 2 video ad scripts (Hook 0-3s, Problem 3-8s, Solution 8-20s, CTA 20-30s). IF plan=scale: 20 social media ad scripts, 8 Google search ads, 5 video ad scripts. IF plan=dominate: 30 social media ad scripts, 15 Google search ads, 8 video ad scripts, 4 weeks of weekly video topics. Label everything clearly. Write in the client's brand tone.`;

const EMAIL_PROMPT = `You are an expert email copywriter for GriffinCreative. Generate email sequences for this client. CLIENT INFO: Business Name: {{business_name}}, Industry: {{business_type}}, Target Audience: {{target_audience}}, Offer: {{ad_goals}}, Brand Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. IF plan=launch: 1 sequence of 3 emails (Welcome, Value, Offer). IF plan=scale: 3 sequences of 3 emails each (Welcome, Re-engagement, Post-purchase). IF plan=dominate: 9-email automation sequence plus 5-email re-engagement sequence with A/B subject lines. Each email includes: Subject line, Preview text, Full body, CTA button text. Write human, not AI.`;

const CALENDAR_PROMPT = `You are a social media strategist for GriffinCreative. Generate a content calendar for this client. CLIENT INFO: Business Name: {{business_name}}, Industry: {{business_type}}, Target Audience: {{target_audience}}, Offer: {{ad_goals}}, Brand Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. IF plan=launch OR scale: 30-day calendar. Each day: Day number, Platform, Content type, Topic/Hook, Full caption, 10-15 hashtags, Best posting time. IF plan=dominate: 4 weekly calendars plus weekly video content plan. Mix educational, promotional, social proof, behind-the-scenes, engagement posts.`;

const VISUAL_PROMPT = `You are a visual ad creative director for GriffinCreative. Generate visual ad concept briefs for Ideogram AI. CLIENT INFO: Business Name: {{business_name}}, Industry: {{business_type}}, Target Audience: {{target_audience}}, Offer: {{ad_goals}}, Brand Tone: {{brand_voice}}, Notes: {{notes}}, Plan: {{plan}}. IF plan=scale: 10 visual ad briefs. IF plan=dominate: 20 visual ad briefs. Each brief includes: Format (Square 1080x1080/Story 1080x1920/Banner 1200x628), Concept, Background, Headline Text (max 8 words), Subheadline (max 12 words), CTA Text (max 5 words), Color Palette, Mood/Style, Ideogram Prompt (ready to paste). Vary style and format across all concepts.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { business_name, business_type, target_audience, ad_goals, brand_voice, notes, plan } = req.body;

  if (!business_name || !plan) return res.status(400).json({ success: false, error: 'Missing required fields' });

  try {
    const prompts = [
      { key: 'ad_copy', prompt: buildPrompt(AD_COPY_PROMPT, req.body) },
      { key: 'email_sequences', prompt: buildPrompt(EMAIL_PROMPT, req.body) },
      { key: 'content_calendar', prompt: buildPrompt(CALENDAR_PROMPT, req.body) },
    ];

    if (plan === 'scale' || plan === 'dominate') {
      prompts.push({ key: 'visual_ads', prompt: buildPrompt(VISUAL_PROMPT, req.body) });
    }

    const results = await Promise.all(
      prompts.map(async ({ key, prompt }) => {
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });
        return { key, content: msg.content[0].text };
      })
    );

    const deliverables = {};
    results.forEach(({ key, content }) => { deliverables[key] = content; });

    res.status(200).json({ success: true, client: business_name, plan, delive
cd ~/griffin-creatives && git add . && git commit -m 'add generate-deliverables api route' && git push
