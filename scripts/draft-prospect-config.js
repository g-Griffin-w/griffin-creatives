#!/usr/bin/env node
// scripts/draft-prospect-config.js — auto-drafts a clients/<slug>.json for a NEW
// cold-outreach prospect, so samples can be generated and reviewed BEFORE the
// first email goes out (not after a reply). See CREATIVE_PIPELINE_STRATEGY.md.
//
// This script only writes the CONFIG. It never calls fal, never sends anything,
// and never skips the human review gate. It slots in front of the existing
// pipeline exactly as-is:
//
//   draft config (this script, ~free)
//     -> node scripts/make-samples.js clients/<slug>.json   (spends FAL_KEY $)
//     -> eyeball every PNG in PENDING-REVIEW/, check every REVIEW.md box by hand
//     -> node scripts/make-samples.js clients/<slug>.json --approve
//     -> attach to the first cold email
//
// Usage:
//   ANTHROPIC_API_KEY='...' node scripts/draft-prospect-config.js https://brand.com
//   ANTHROPIC_API_KEY='...' node scripts/draft-prospect-config.js https://brand.com --niche=food_beverage --slug=brandname
//
// Every drafted config defaults to ENGINE=cutout (real product pixels, AI
// background only) — a cold prospect's first sample is the worst possible
// place to repeat the fidelity miss that lost POCA and Southern Scholar.

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const FRAMEWORKS = [
  'problem_agitation',
  'us_vs_them',
  'unexpected_context',
  'social_proof',
  'ingredient_hero',
  'identity_badge',
];

function die(msg) {
  console.error(`\nFAILED: ${msg}\n(No config was written. Fix the input or build this one by hand.)`);
  process.exit(1);
}

function normalizeUrl(raw) {
  if (!raw) return '';
  let u = String(raw).trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).href; } catch { return ''; }
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

async function fetchText(url, { timeoutMs = 8000 } = {}) {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)',
      },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function extractBrandContext(html) {
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
  const parts = [ogTitle || title, metaDesc || ogDesc].filter(Boolean);
  return parts.join(' — ').slice(0, 500);
}

function extractAccent(html) {
  if (!html) return null;
  const m = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,8})["']/i);
  return m ? m[1] : null;
}

function extractLogo(html, origin) {
  if (!html) return null;
  let m =
    html.match(/<img[^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
    html.match(/<img[^>]+src=["']([^"']+)["'][^>]*(?:class|id|alt)=["'][^"']*logo[^"']*["']/i);
  if (!m) {
    m =
      html.match(/<link[^>]+rel=["'](?:apple-touch-icon|icon)["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:apple-touch-icon|icon)["']/i);
  }
  if (!m) return null;
  try { return new URL(m[1], origin).href; } catch { return null; }
}

// ---------- Product photo discovery ----------

const BAD_IMAGE_HINTS = /logo|icon|favicon|sprite|badge|avatar|placeholder|payment|visa|mastercard|paypal|klarna/i;

// Shopify catalogs almost always mix in merch/accessories/gift cards alongside
// the actual product line. /products.json returns them in arbitrary catalog
// order, not "flagship item first" — left unfiltered this will happily pick a
// branded water bottle or trucker hat as the hero instead of the real product.
const MERCH_HINTS = /\b(hats?|caps?|beanies?|shirts?|tees?|hoodies?|totes?|bags?|stickers?|decals?|mugs?|tumblers?|bottles?|cups?|gift cards?|bundles?|sample packs?|apparel|koozies?)\b/i;

// Stable sort: real product-line items first, merch-flagged items pushed to
// the back (not dropped — still usable if that's genuinely all a brand sells).
function rankProducts(products) {
  return products
    .map((p, i) => ({ p, i, merch: MERCH_HINTS.test(p.title || '') }))
    .sort((a, b) => (a.merch === b.merch ? a.i - b.i : a.merch ? 1 : -1))
    .map((x) => x.p);
}

// Shopify stores expose a public product catalog at /products.json — far more
// reliable than scraping <img> tags: real titles, real descriptions, real CDN URLs.
async function tryShopifyProducts(origin) {
  const text = await fetchText(`${origin}/products.json?limit=25`);
  if (!text) return [];
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  const products = Array.isArray(data?.products) ? data.products : [];
  const out = [];
  for (const p of products) {
    const img = p.images?.[0]?.src;
    if (!img) continue;
    const description = (p.body_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
    out.push({ title: p.title || '', description, image_url: img });
  }
  return out;
}

// Fallback for non-Shopify sites: scan raw <img> tags, keep only same-domain or
// Shopify-CDN hosts (the same hosts scripts/make-samples.js's asset gate allows),
// and drop obvious non-product chrome (logos, icons, payment badges).
function scrapeImagesFromHtml(html, origin) {
  if (!html) return [];
  const found = new Set();
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const raw = m[1];
    if (BAD_IMAGE_HINTS.test(raw)) continue;
    try {
      const u = new URL(raw, origin);
      const host = u.hostname.toLowerCase();
      if (host.endsWith('cdn.shopify.com') || host.endsWith('shopifycdn.com') || host === new URL(origin).hostname) {
        found.add(u.href);
      }
    } catch {}
  }
  return [...found].slice(0, 10).map((image_url) => ({ title: '', description: '', image_url }));
}

// ---------- Claude concept drafting ----------

async function draftConcepts({ apiKey, brandName, domain, brandContext, niche, products }) {
  const claude = new Anthropic({ apiKey });
  const productBlock = products
    .map(
      (p, i) =>
        `PRODUCT ${i + 1}:\n  title: ${p.title || '(unknown — infer from brand context)'}\n  description: ${
          p.description || '(none scraped)'
        }\n  photo_url: ${p.image_url}`,
    )
    .join('\n\n');

  const prompt = `You are the creative director for GriffinCreative, a done-for-you ad creative studio. You are drafting a SAMPLE config for a NEW cold-outreach prospect — these samples are the prospect's very first impression of our work, sent for free before they've agreed to anything.

BRAND: ${brandName} (${domain})
NICHE: ${niche || '(unspecified — infer from brand context)'}
SCRAPED BRAND CONTEXT: ${brandContext || '(none scraped)'}

${productBlock}

Every concept uses the CUTOUT engine: the product photo above gets cut out pixel-for-pixel (zero AI redraw of the product itself) and composited into an AI-generated background. This exists because two real prospects (POCA, Southern Scholar) rejected us specifically because an earlier version LOOKED AI-GENERATED or altered their real product. Fidelity is non-negotiable — you are never regenerating or redesigning the product, only the world around it.

HARD RULES (violating any of these means the batch gets rejected before it ever ships):
1. Pick ONE FRAMEWORK per concept from exactly this list: ${FRAMEWORKS.join(', ')}.
2. big_idea must be a real insight (min 40 characters) — what makes someone stop scrolling, not just "here's the product."
3. NEVER describe a beauty-shot / flat-lay cliché. Banned phrases: "flat-lay", "flat lay", "beside a", "next to a", "on a marble", "kitchen counter", "cafe tabletop", "styled with", "editorial product photography". Transform the product into a scene, don't decorate a table around it.
4. bg_prompt describes ONLY the background/scene — the product must NEVER appear in it (it gets composited on top by code, not by the model). End every bg_prompt with exactly: "No product, no packaging, no text, no logos."
5. image_prompt is a backup full-scene description (same scene as bg_prompt, but written as if the product were being generated in place with a fidelity lock). End it with exactly: "CRITICAL FIDELITY RULE: reproduce the product from the reference photo EXACTLY — do not redesign, recolor, or blur it. add no text or graphics"
6. layout must be "top" (text above, product below — text must never cover the product; this is a hard rule from a real client complaint).
7. bullets: only include claims directly supported by the scraped brand context / product description above. If you don't have real facts, return an empty array — never invent product claims.
8. tagline: short, punchy, under 8 words.
9. Never use the words "AI" or "generated" in any copy field.

Return EXACTLY 2 concepts as a JSON array (no markdown fences, no preamble), each object shaped like:
{
  "name": "kebab-case-slug",
  "framework": "one of the list above",
  "big_idea": "...",
  "image_prompt": "...",
  "bg_prompt": "...",
  "tagline": "...",
  "bullets": ["...", "..."],
  "layout": "top",
  "source_product_image_url": "one of the photo_url values above — pick whichever product fits the concept"
}`;

  const msg = await claude.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content[0].text;
  let cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = cleaned.indexOf('[');
  const last = cleaned.lastIndexOf(']');
  if (first !== -1 && last !== -1) cleaned = cleaned.slice(first, last + 1);
  let concepts;
  try {
    concepts = JSON.parse(cleaned);
  } catch (e) {
    die(`Claude returned malformed concepts JSON: ${e.message}\n${text.slice(0, 500)}`);
  }
  if (!Array.isArray(concepts) || concepts.length < 2) {
    die(`Claude returned ${concepts?.length || 0} concept(s), need at least 2`);
  }
  return concepts;
}

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  const websiteArg = args.find((a) => !a.startsWith('--'));
  if (!websiteArg) {
    die('usage: node scripts/draft-prospect-config.js <website> [--niche=food_beverage|supplements|fishing_outdoor|dtc_general] [--slug=name] [--product=keyword] [--force]');
  }
  const nicheArg = args.find((a) => a.startsWith('--niche='))?.slice(8) || '';
  const slugArg = args.find((a) => a.startsWith('--slug='))?.slice(7) || '';
  const productArg = args.find((a) => a.startsWith('--product='))?.slice(10) || '';
  const force = args.includes('--force');

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) die('missing ANTHROPIC_API_KEY env var');

  const url = normalizeUrl(websiteArg);
  if (!url) die(`not a valid website: ${websiteArg}`);
  const origin = new URL(url).origin;
  const domain = new URL(url).hostname.replace(/^www\./, '');
  const slug = (slugArg || domain.split('.')[0]).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!slug) die(`could not derive a client slug from ${domain} — pass --slug=name`);

  const outFile = path.join(__dirname, '..', 'clients', `${slug}.json`);
  if (fs.existsSync(outFile) && !force) die(`${outFile} already exists — pass --force to overwrite`);

  console.log(`Scraping ${origin} ...`);
  const homepageHtml = await fetchText(origin);
  if (!homepageHtml) die(`could not fetch ${origin} (site down, blocking bots, or not reachable over https)`);

  const brandContext = extractBrandContext(homepageHtml);
  const accent = extractAccent(homepageHtml);
  const logoUrl = extractLogo(homepageHtml, origin);

  console.log('Looking for real product photos...');
  let products = await tryShopifyProducts(origin);
  let source = 'shopify /products.json';
  if (products.length === 0) {
    products = scrapeImagesFromHtml(homepageHtml, origin);
    source = 'homepage <img> scan';
  }
  if (products.length === 0) {
    const collHtml = await fetchText(`${origin}/collections/all`);
    products = scrapeImagesFromHtml(collHtml, origin);
    source = '/collections/all <img> scan';
  }
  if (products.length === 0) {
    die(`no usable product photos found on ${origin} — not Shopify, or the scan found nothing real. Build this one by hand instead of forcing it.`);
  }

  products = rankProducts(products);
  if (productArg) {
    const filtered = products.filter((p) => (p.title || '').toLowerCase().includes(productArg.toLowerCase()));
    if (filtered.length === 0) {
      die(`--product="${productArg}" matched nothing in ${products.length} candidate(s). Titles found: ${products.map((p) => p.title || '(untitled)').slice(0, 15).join(', ')}`);
    }
    products = filtered;
  }
  const picked = products.slice(0, 2);
  console.log(`Found ${products.length} candidate photo(s) via ${source}. Using:`);
  picked.forEach((p) => console.log(`  - ${p.title || '(untitled)'}: ${p.image_url}`));
  console.log('SANITY-CHECK these URLs in a browser before running generation — scraping reliably picks the right HOST, not always the right IMAGE.');

  console.log('Drafting creative concepts with Claude...');
  const concepts = await draftConcepts({
    apiKey: ANTHROPIC_API_KEY,
    brandName: slug,
    domain,
    brandContext,
    niche: nicheArg,
    products: picked,
  });

  const cfg = {
    _comment: `Auto-drafted by scripts/draft-prospect-config.js from ${origin} on ${new Date()
      .toISOString()
      .slice(0, 10)}. NOT REVIEWED — Claude drafted the creative angle and prompts, nobody has looked at them yet. Read every concept before running make-samples.js.`,
    client: slug,
    domain,
    logo_url: logoUrl || 'REPLACE_ME_LOGO_URL_NOT_FOUND',
    accent: accent || '#FF00FF',
    engine: 'cutout',
    concepts,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(cfg, null, 2));

  console.log(`\nWrote ${outFile}`);
  if (!logoUrl) console.log('WARNING: no logo found automatically — replace logo_url before running generation (make-samples.js will hard-fail on the placeholder otherwise).');
  if (!accent) console.log('WARNING: no brand color found automatically — replace accent (#FF00FF placeholder) before running generation.');
  console.log('\nNEXT STEPS:');
  console.log('  1. Open the file. Read both concepts — Claude drafted the angle, you have not approved it yet.');
  console.log('  2. Open each source_product_image_url in a browser, confirm it is actually a real product photo.');
  console.log(`  3. FAL_KEY='...' node scripts/make-samples.js ${path.relative(process.cwd(), outFile)}`);
  console.log('  4. Eyeball every PNG in PENDING-REVIEW/, check every REVIEW.md box honestly, then --approve.');
}

main().catch((e) => die(e.message));
