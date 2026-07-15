#!/usr/bin/env node
// scripts/generate-ads.js — unified GriffinCreativeLab ad generator (3 engines).
// Strategy + rationale: see CREATIVE_PIPELINE_STRATEGY.md
//
// Engines:
//   composite : real photo + copy overlay. NO generation. 100% real product, $0, no FAL_KEY.
//   seedream  : Seedream 4.5 img2img scene that keeps the product (~95% fidelity, strong text).
//   cutout    : BiRefNet cutout of the real product + Seedream txt2img background + composite
//               (100% real product placed in an AI scene). NEW — QA before sending to a client.
//
// Usage:
//   ENGINE=composite CLIENT=southernscholar node scripts/generate-ads.js
//   ENGINE=seedream  CLIENT=southernscholar FAL_KEY='...' node scripts/generate-ads.js
//   ENGINE=cutout    CLIENT=chikkachikka    FAL_KEY='...' node scripts/generate-ads.js
//   ONLY=never-slip  ENGINE=seedream CLIENT=southernscholar FAL_KEY='...' node scripts/generate-ads.js
//
// Output: ./sample-ads/<client>-<engine>/<concept>-<ratio>.png (+ raw scene/cutout/background)

//
// HARD RULE (Gabriel, July 15 2026): rendered text must NEVER cover the product.
// render-ad.js puts copy in the LOWER THIRD -> scene prompts must keep the product
// in the UPPER TWO-THIRDS. render-concept-ad.js: prefer layout "top" when the
// product is in frame; "center" only for product-free brand-world backgrounds.

const fs = require("fs");
const path = require("path");
const { renderOneRatio, RATIOS } = require("../api/render-ad.js");
const { renderConceptRatio, prepareLogo } = require("../api/render-concept-ad.js");

const FAL_EDIT   = "https://fal.run/fal-ai/bytedance/seedream/v4.5/edit";
const FAL_T2I    = "https://fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image";
const FAL_CUTOUT = "https://fal.run/fal-ai/birefnet/v2";

const ENGINE  = (process.env.ENGINE || "composite").toLowerCase();
const CLIENT  = (process.env.CLIENT || "").toLowerCase();
const ONLY    = process.env.ONLY;
const FAL_KEY = process.env.FAL_KEY;

// ---------- Per-client creative config ----------
// product_url    : clean pack-shot (source for seedream + cutout).
// real_photo_url : the photo used AS-IS by the composite engine. For the fullest frame,
//                  swap this to a real lifestyle / on-model shot when the client has one.
// scene_prompt   : seedream img2img — keep product exact, build a scene around it.
// bg_prompt      : cutout engine — BACKGROUND ONLY, product must NOT appear (it's composited on top).
const CONFIG = {
  southernscholar: [
    {
      name: "never-slip",
      product_url:    "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/The_Brown__Ribbed_desktop.jpg?v=1782306863",
      real_photo_url: "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/The_Brown__Ribbed_desktop.jpg?v=1782306863",
      scene_prompt: "Editorial menswear still life. Keep the Southern Scholar brown ribbed dress socks EXACTLY as in the reference image — identical color, ribbed weave, and paper band text, pixel-faithful; do not redesign, recolor, or blur. Place them neatly folded as the hero in the upper two-thirds on a dark walnut surface beside a polished leather dress shoe. Soft daylight, refined navy-and-cognac palette, shallow depth of field. Leave the lower third clean and empty. Add no text or graphics.",
      bg_prompt: "Editorial menswear flat-lay surface: dark walnut wood with a polished leather dress shoe and a folded wool trouser cuff to one side, soft daylight, refined navy-and-cognac palette, shallow depth of field, premium product photography. Empty space in the center. No socks, no product, no text, no logos.",
      headline: "Dress socks that never slip to your ankles.",
      subheadline: "Over-the-calf, engineered to stay up all day. Premium combed cotton, built to last.",
      poster_headline: "Never slip again.",
      poster_accent: "Over-the-calf. All day.",
      accent: "#1B2A4A",
    },
    {
      name: "membership",
      product_url:    "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/Untitleddesign_7.jpg?v=1773171744",
      real_photo_url: "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/Untitleddesign_7.jpg?v=1773171744",
      scene_prompt: "Premium gift-styled still life. Keep the Southern Scholar royal-blue dress socks with white dash pattern EXACTLY as in the reference image — identical color, pattern, and paper band, pixel-faithful; do not redesign, recolor, or blur. Place the folded pair as the hero in the upper two-thirds on a marble surface with a fountain pen and leather watch strap nearby. Soft daylight, refined navy-cream-cognac palette, shallow depth of field. Leave the lower third clean. Add no text or graphics.",
      bg_prompt: "Premium gift-styling surface: white marble with a fountain pen and a leather watch strap to one side, soft daylight, refined navy-cream-cognac palette, shallow depth of field, premium product photography. Empty space in the center. No socks, no product, no text, no logos.",
      headline: "Fresh socks at his door every season.",
      subheadline: "The Gentleman Membership — hand-picked dress socks delivered on schedule.",
      poster_headline: "Sharp socks, delivered.",
      poster_accent: "Every season.",
      accent: "#8B5E3C",
    },
    {
      // From their IG "HAPPY FOURTH" post. Save the socks photo (their post image is fine —
      // BiRefNet isolates the socks and drops their baked-in text with the background) to:
      //   raw-photos/southernscholar-patriotic.png
      name: "patriotic",
      product_url:    "raw-photos/southernscholar-patriotic.png",
      real_photo_url: "raw-photos/southernscholar-patriotic.png",
      scene_prompt: "Editorial menswear still life. Keep the patriotic red-white-and-blue Southern Scholar dress socks EXACTLY as in the reference image — identical colors, stripes, and patterns, pixel-faithful; do not redesign or recolor. Place them upright as the hero in the upper two-thirds on a clean cream surface with subtle warm summer light. Leave the lower third clean. Add no text or graphics.",
      bg_prompt: "Clean studio surface in soft warm daylight, cream and subtle navy Americana tones, a hint of summer, shallow depth of field, premium product photography. Empty space in the center. No socks, no product, no text, no logos, no flags.",
      headline: "Dressed for the Fourth — and every day after.",
      subheadline: "Dress socks with a little independence. Over-the-calf, premium combed cotton, all-day hold.",
      poster_headline: "Sharp for the Fourth.",
      poster_accent: "And every day after.",
      accent: "#1B2A4A",
    },
    {
      // From their IG "NEW DROP — BROWN RIBBED COLLECTION" post. Uses their real store flat-lay URL,
      // so this one runs with no saved file needed.
      name: "brown-ribbed",
      product_url:    "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/The_Brown__Ribbed_desktop.jpg?v=1782306863",
      real_photo_url: "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/The_Brown__Ribbed_desktop.jpg?v=1782306863",
      scene_prompt: "Editorial menswear still life. Keep the Southern Scholar brown ribbed dress socks and their paper bands EXACTLY as in the reference image — identical brown shades, ribbed weave, and band text, pixel-faithful; do not redesign or recolor. Arrange them as the hero in the upper two-thirds on a dark walnut surface with a tumbler of whiskey beside them. Warm soft light, refined brown-and-cognac palette, shallow depth of field. Leave the lower third clean. Add no text or graphics.",
      bg_prompt: "Editorial menswear flat-lay surface: dark walnut wood with a tumbler of whiskey and a folded earth-tone wool trouser cuff to one side, soft warm light, refined brown-and-cognac palette, shallow depth of field, premium product photography. Empty space in the center. No socks, no product, no text, no logos.",
      headline: "Four browns. One standard.",
      subheadline: "The Brown Ribbed Collection — espresso, chocolate, mocha, pecan. Made to pair with navy or earth-tone tailoring.",
      poster_headline: "The Brown Ribbed Collection.",
      poster_accent: "Four shades. One standard.",
      accent: "#6B4A2B",
    },
    {
      // Their real store product shot (clean). Composite = their exact photo + our copy.
      name: "mocha-espresso",
      product_url:    "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/MochaandEspressoRibbedEcomShot.webp?v=1782117583",
      real_photo_url: "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/MochaandEspressoRibbedEcomShot.webp?v=1782117583",
      scene_prompt: "",
      bg_prompt: "",
      headline: "Mocha, meet espresso.",
      subheadline: "Ribbed over-the-calf dress socks that actually stay up — premium combed cotton, built to last.",
      poster_headline: "Mocha, meet espresso.",
      poster_accent: "Ribbed. Over-the-calf.",
      accent: "#6B4A2B",
    },
    {
      name: "espresso-chocolate",
      product_url:    "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/EspressoandChocolateRibbedEcomShot.webp?v=1782118293",
      real_photo_url: "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/EspressoandChocolateRibbedEcomShot.webp?v=1782118293",
      scene_prompt: "",
      bg_prompt: "",
      headline: "Espresso, with a chocolate finish.",
      subheadline: "The ribbed dress sock that pairs with everything. Over-the-calf, all-day hold.",
      poster_headline: "Espresso. Chocolate.",
      poster_accent: "One clean pair.",
      accent: "#4A342A",
    },
    {
      // Their real on-model lifestyle hero (mocha/espresso socks + tassel loafers, navy trousers,
      // marbled rug) — verified in-browser, 1600x1600. Run with ENGINE=composite: their photo, our copy.
      name: "mocha-lifestyle",
      product_url:    "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/MochaandEspressoRibbed8057.webp",
      real_photo_url: "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/MochaandEspressoRibbed8057.webp",
      scene_prompt: "",
      bg_prompt: "",
      headline: "The detail that finishes the fit.",
      subheadline: "Mocha and espresso ribbed — over-the-calf dress socks, quietly sharp with every loafer.",
      poster_headline: "In the details.",
      poster_accent: "Over-the-calf.",
      accent: "#6B4A2B",
    },
    {
      // Folded socks in their kraft band packaging (their main product shot). Run with ENGINE=seedream:
      // Seedream keeps the folded product + band exact and generates a warm scene around it.
      // If 8057 is the wrong angle, swap to one of: ...8054.webp / ...8048.webp / ...8046.webp
      name: "mocha-folded",
      product_url:    "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/MochaandEspressoRibbed8057.webp?v=1782117583",
      real_photo_url: "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/MochaandEspressoRibbed8057.webp?v=1782117583",
      scene_prompt: "Change ONLY the surroundings of the reference photo; keep the product itself completely unchanged. CRITICAL: the kraft-paper band wrapped around the folded socks MUST retain its printed branding EXACTLY as in the reference — the crossed-arrows crest and the printed words 'SOUTHERN SCHOLAR' (with the small 'A GENTLEMAN'S COLLECTION' line beneath), same position and legibility. Do NOT blank, erase, smooth over, recolor, or redesign the band or its printed logo and text. Keep the mocha-and-espresso ribbed sock color, ribbing, and fold identical. Place the folded pair as the hero in the upper two-thirds on a warm dark walnut surface with soft directional daylight and a softly out-of-focus tumbler of whiskey behind. Refined brown-and-cognac palette, shallow depth of field, premium editorial product photography. Leave the lower third as clean, empty surface for copy. Add no new text or graphics of your own.",
      bg_prompt: "Warm dark walnut wood surface with a softly out-of-focus tumbler of whiskey to one side, soft directional daylight, refined brown-and-cognac palette, shallow depth of field, premium editorial product photography. Empty space in the center. No socks, no product, no text, no logos.",
      headline: "Folded, banded, ready to gift.",
      subheadline: "Mocha and espresso ribbed — over-the-calf dress socks that arrive looking the part.",
      poster_headline: "Ready to gift.",
      poster_accent: "Straight out of the box.",
      accent: "#6B4A2B",
    },
  ],
  chikkachikka: [
    {
      name: "fresh-breath",
      product_url:    "https://chikkachikka.com/cdn/shop/files/Mint_Front_V2.png?v=1761666599",
      real_photo_url: "https://chikkachikka.com/cdn/shop/files/Mint_Front_V2.png?v=1761666599",
      scene_prompt: "Clean lifestyle scene on a sunlit light-wood dining table just after a meal. Keep the Chikka Chikka mint tin EXACTLY as in the reference image — identical ornate label and every letter of text, pixel-faithful; do not redesign, recolor, or blur. Place it upright as the hero in the upper two-thirds with a few fennel seeds on a small dish beside it. Soft natural light, fresh mint-green and cream palette, shallow depth of field. Leave the lower third clean. Add no text or graphics.",
      bg_prompt: "Sunlit light-wood dining table just after a meal: a few fennel seeds on a small ceramic dish, a linen napkin, fresh mint-green and cream palette, soft natural light, shallow depth of field, premium editorial food photography. Empty space in the center. No product, no packaging, no tins, no text, no logos.",
      headline: "Fresh breath. Happy tummy. Zero junk.",
      subheadline: "Maple-roasted fennel seeds in a pocket tin — the after-dinner ritual, reinvented.",
      poster_headline: "Fresh breath. Happy tummy.",
      poster_accent: "Zero junk.",
      accent: "#3FA796",
    },
    {
      name: "beat-the-bloat",
      product_url:    "https://chikkachikka.com/cdn/shop/files/Card_Front_V2.png?v=1761666652",
      real_photo_url: "https://chikkachikka.com/cdn/shop/files/Card_Front_V2.png?v=1761666652",
      scene_prompt: "Warm after-dinner tabletop in soft evening light. Keep the Chikka Chikka cardamom tin EXACTLY as in the reference image — identical ornate label and every letter of text, pixel-faithful; do not redesign, recolor, or blur. Place it upright as the hero in the upper two-thirds beside a small cup of steaming chai and an empty dessert plate. Cozy maple-gold and cream palette, shallow depth of field. Leave the lower third clean. Add no text or graphics.",
      bg_prompt: "Warm after-dinner tabletop in soft evening light: a small cup of steaming chai, an empty dessert plate, a linen napkin, cozy maple-gold and cream palette, shallow depth of field, premium editorial food photography. Empty space in the center. No product, no packaging, no tins, no text, no logos.",
      headline: "Bloated after every meal?",
      subheadline: "One pinch of maple-roasted fennel settles the tummy and freshens breath — no refined sugar.",
      poster_headline: "Bloated after every meal?",
      poster_accent: "One pinch fixes it.",
      accent: "#C98A3B",
    },
  ],
};

// ---------- fal helpers ----------
async function falPost(url, body) {
  if (!FAL_KEY) throw new Error(`Missing FAL_KEY (required for ENGINE=${ENGINE}).`);
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`fal ${resp.status} @ ${url}: ${(await resp.text()).slice(0, 400)}`);
  const data = await resp.json();
  // fal.run is synchronous for these models. If a queue payload comes back instead,
  // surface it clearly rather than failing cryptically.
  if (data && (data.status === "IN_QUEUE" || data.status === "IN_PROGRESS")) {
    throw new Error(`fal returned a queue response for ${url}. Switch this call to the queue API (queue.fal.run + poll).`);
  }
  return data;
}
async function seedreamEdit({ prompt, image_url }) {
  const d = await falPost(FAL_EDIT, { prompt, image_urls: [image_url], image_size: "portrait_16_9", num_images: 1 });
  const u = d?.images?.[0]?.url;
  if (!u) throw new Error(`Seedream edit returned no image: ${JSON.stringify(d).slice(0, 300)}`);
  return u;
}
async function seedreamT2I({ prompt }) {
  const d = await falPost(FAL_T2I, { prompt, image_size: "portrait_16_9", num_images: 1 });
  const u = d?.images?.[0]?.url;
  if (!u) throw new Error(`Seedream t2i returned no image: ${JSON.stringify(d).slice(0, 300)}`);
  return u;
}
async function birefnetCutout({ image_url }) {
  const d = await falPost(FAL_CUTOUT, { image_url, output_format: "png" });
  const u = d?.image?.url || d?.images?.[0]?.url;
  if (!u) throw new Error(`BiRefNet returned no image: ${JSON.stringify(d).slice(0, 300)}`);
  return u;
}
async function fetchBuf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status} for ${url}`);
  const ct = r.headers.get("content-type") || "image/png";
  return { buf: Buffer.from(await r.arrayBuffer()), ct };
}
const toDataUri = (buf, ct) => `data:${ct || "image/png"};base64,${buf.toString("base64")}`;

function guessMime(p) {
  const e = p.toLowerCase();
  if (e.endsWith(".png")) return "image/png";
  if (e.endsWith(".webp")) return "image/webp";
  if (e.endsWith(".jpg") || e.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}
// Load an image that may be a remote URL OR a local file path (relative to repo root).
// This is what lets you drop a real product photo in ./raw-photos and use it as source.
async function loadBuf(src) {
  if (/^https?:/i.test(src)) return fetchBuf(src);
  const abs = path.isAbsolute(src) ? src : path.resolve(__dirname, "..", src);
  if (!fs.existsSync(abs)) throw new Error(`Local source not found: ${abs}`);
  return { buf: fs.readFileSync(abs), ct: guessMime(src) };
}
// What to hand fal as an image input: a plain URL stays a URL; a local file becomes a data URI.
async function falImageInput(src) {
  if (/^https?:/i.test(src)) return src;
  const { buf, ct } = await loadBuf(src);
  return toDataUri(buf, ct);
}

// ---------- engines ----------
async function runComposite(c, outDir) {
  const { buf, ct } = await loadBuf(c.real_photo_url);
  const dataUri = toDataUri(buf, ct);
  for (const ratio of RATIOS) {
    const png = await renderOneRatio({ ratio, imageDataUri: dataUri, headline: c.headline, subheadline: c.subheadline, accent: c.accent });
    fs.writeFileSync(path.join(outDir, `${c.name}-${ratio.key}.png`), png);
    console.log(`  ${ratio.key.padEnd(4)} composite`);
  }
}
async function runSeedream(c, outDir) {
  console.log("  seedream 4.5 scene...");
  const sceneUrl = await seedreamEdit({ prompt: c.scene_prompt, image_url: await falImageInput(c.product_url) });
  const { buf, ct } = await fetchBuf(sceneUrl);
  fs.writeFileSync(path.join(outDir, `${c.name}-scene.png`), buf);
  const dataUri = toDataUri(buf, ct);
  for (const ratio of RATIOS) {
    const png = await renderOneRatio({ ratio, imageDataUri: dataUri, headline: c.headline, subheadline: c.subheadline, accent: c.accent });
    fs.writeFileSync(path.join(outDir, `${c.name}-${ratio.key}.png`), png);
    console.log(`  ${ratio.key.padEnd(4)} seedream`);
  }
}
let _sharp = null;
function getSharp() {
  if (_sharp) return _sharp;
  try { _sharp = require("sharp"); }
  catch (e) { throw new Error("Cutout engine needs 'sharp' to trim/scale the product. Run once:  npm install sharp"); }
  return _sharp;
}

async function runCutout(c, outDir) {
  const sharp = getSharp();
  console.log("  birefnet cutout...");
  const cutoutUrl = await birefnetCutout({ image_url: await falImageInput(c.product_url) });
  const { buf: rawCut } = await fetchBuf(cutoutUrl);
  fs.writeFileSync(path.join(outDir, `${c.name}-cutout-raw.png`), rawCut);
  // Trim the transparent margins so the product fills its box (fixes "tiny floating product").
  const trimmed = await sharp(rawCut).trim({ threshold: 10 }).png().toBuffer({ resolveWithObject: true });
  const cutBuf = trimmed.data, cw = trimmed.info.width, ch = trimmed.info.height;
  fs.writeFileSync(path.join(outDir, `${c.name}-cutout.png`), cutBuf);
  console.log("  seedream background...");
  const bgUrl = await seedreamT2I({ prompt: c.bg_prompt });
  const { buf: bgBuf, ct: bgCt } = await fetchBuf(bgUrl);
  fs.writeFileSync(path.join(outDir, `${c.name}-background.png`), bgBuf);
  const bgDataUri = toDataUri(bgBuf, bgCt);
  for (const ratio of RATIOS) {
    // Seat the product as a real hero: ~56% of frame height, capped at 88% of frame width.
    let targetH = Math.round(ratio.h * 0.56);
    let targetW = Math.round(targetH * (cw / ch));
    const maxW = Math.round(ratio.w * 0.88);
    if (targetW > maxW) targetW = maxW;
    const product = await prepareLogo({ buf: cutBuf, contentType: "image/png", targetW });
    const png = await renderConceptRatio({
      ratio, imageDataUri: bgDataUri, logo: product, layout: "poster-bottom",
      headline: c.poster_headline, accentLine: c.poster_accent, accent: c.accent,
    });
    fs.writeFileSync(path.join(outDir, `${c.name}-${ratio.key}.png`), png);
    console.log(`  ${ratio.key.padEnd(4)} cutout`);
  }
}

// ---------- main ----------
async function main() {
  const concepts = CONFIG[CLIENT];
  if (!concepts) { console.error(`Set CLIENT to one of: ${Object.keys(CONFIG).join(", ")}`); process.exit(1); }
  const engines = { composite: runComposite, seedream: runSeedream, cutout: runCutout };
  const run = engines[ENGINE];
  if (!run) { console.error(`Set ENGINE to one of: ${Object.keys(engines).join(", ")}`); process.exit(1); }

  const outDir = path.join(__dirname, "..", "sample-ads", `${CLIENT}-${ENGINE}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`ENGINE=${ENGINE} CLIENT=${CLIENT} -> ${outDir}\n`);

  for (const c of concepts) {
    if (ONLY && c.name !== ONLY) continue;
    console.log(`== ${c.name} ==`);
    await run(c, outDir);
    console.log("");
  }
  console.log("Done.");
}
main().catch((e) => { console.error("\nFAILED:", e.message); process.exit(1); });
