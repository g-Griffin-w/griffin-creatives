#!/usr/bin/env node
// scripts/generate-concept-ads.js
//
// "Out-of-the-box" CONCEPT ad generator (brand-world poster style).
//   nano-banana background -> render-concept-ad overlay (logo + copy) -> 4 ratios
//
// MODE RULE (do not break this):
//   mode: "txt2img"  -> BACKGROUNDS ONLY. Generate an in-world scene the product
//                        lives in (e.g. coffee with star-shaped ice). The prompt
//                        must NOT contain the product, packaging, logo, or any text
//                        — the model will hallucinate/garble those. The real logo +
//                        copy are overlaid afterward by render-concept-ad.
//   mode: "img2img"  -> ACTUAL PRODUCT SHOTS. Transforms a real product photo
//                        (bg_source_url) so the packet/packaging stays accurate.
//
// Usage:
//   cd ~/griffin-creatives
//   FAL_KEY='your-key' node scripts/generate-concept-ads.js
//
// Output: ./sample-ads/poca-concept/<name>-<ratio>.png  (+ raw background)

//
// HARD RULE (Gabriel, July 15 2026): rendered text must NEVER cover the product.
// render-ad.js puts copy in the LOWER THIRD -> scene prompts must keep the product
// in the UPPER TWO-THIRDS. render-concept-ad.js: prefer layout "top" when the
// product is in frame; "center" only for product-free brand-world backgrounds.

const fs = require("fs");
const path = require("path");
const { renderConceptRatio, prepareLogo, RATIOS } = require("../api/render-concept-ad.js");

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("Missing FAL_KEY. Run:  FAL_KEY='...' node scripts/generate-concept-ads.js");
  process.exit(1);
}

const FAL_T2I = "https://fal.run/fal-ai/nano-banana";       // text-to-image (prompt only)
const FAL_I2I = "https://fal.run/fal-ai/nano-banana/edit";  // image-to-image (needs image_urls)
const OUT_DIR = path.join(__dirname, "..", "sample-ads", "poca-concept");

const CONCEPTS = [
  {
    name: "people-with-taste",
    // Seed image for the background. Any matcha/green drink photo works — nano-banana
    // transforms it into the macro. Swap this URL to change the look.
    bg_source_url:
      "https://cdn.shopify.com/s/files/1/0786/6581/0159/files/260111_AK_POCA_L11_3600.jpg?v=1772499563",
    bg_prompt:
      "Extreme close-up, top-down macro of a creamy matcha latte surface filled with glossy translucent star-shaped ice cubes, refreshing and vibrant, rich matcha-green palette, soft natural light, premium editorial food photography. Fill the entire frame edge to edge. No text, no logos, no packaging, no words, no typography.",
    // Client logo. If the multicolor POCA wordmark is a separate brand asset, swap this
    // URL or point logo_file at a local path instead.
    logo_url: "https://pickpoca.com/cdn/shop/files/POCA_Logo.svg",
    logo_file: "", // optional local override, e.g. "./assets/poca-logo.svg"
    tagline: "Sweetener for people with taste.",
    bullets: ["0 Sugar", "3g Fiber", "Plant-Based"],
    accent: "#F5559E",
    layout: "center",
    mode: "txt2img",        // pure prompt — no product in the scene; logo is overlaid
    aspect_ratio: "4:5",    // portrait base; render still cover-fits all 4 ratios
  },
  {
    // NEW concept + NEW layout: product hero on a bold color field (left),
    // bold two-line type on the right. Caramel angle, pulled from their site.
    name: "caramel-color-field",
    bg_source_url:
      "https://cdn.shopify.com/s/files/1/0786/6581/0159/files/caramel_3x4_1.jpg?v=1770496638",
    bg_prompt:
      "Studio advertising still life on a bold, solid warm amber background. The POCA caramel syrup packet stands upright pushed FAR to the LEFT edge of the frame, occupying only the left third; a few glossy caramel cubes sit at its base on the lower left. Soft directional studio light, crisp natural shadows, vibrant and clean. The packet and cubes must stay entirely within the left third — the ENTIRE right two-thirds of the frame is completely empty, uninterrupted solid amber negative space with nothing in it. Keep the POCA packet and its label EXACTLY as in the reference photo — do not redesign, blur, recolor, or replace it. No text, no logos, no words, no typography.",
    logo_url: "https://pickpoca.com/cdn/shop/files/POCA_Logo.svg",
    logo_file: "",
    headline: "Real caramel.",
    accentLine: "Zero sugar.",
    accent: "#FFB23E",
    layout: "poster-bottom", // product centered by the model; copy sits bottom over a scrim
    mode: "img2img",        // real packet must appear accurately -> transform their photo
  },
];

// Optional: run a single concept, e.g.  ONLY=caramel-color-field node scripts/generate-concept-ads.js
const ONLY = process.env.ONLY;

// Unified generator. mode "txt2img" -> base endpoint (prompt only);
// mode "img2img" (default) -> /edit endpoint (transforms image_url).
async function falGenerate({ mode = "img2img", prompt, image_url, aspect_ratio }) {
  const isT2I = mode === "txt2img";
  const url = isT2I ? FAL_T2I : FAL_I2I;
  const body = { prompt, num_images: 1, output_format: "png" };
  if (aspect_ratio) body.aspect_ratio = aspect_ratio;        // e.g. "4:5", "9:16"
  if (!isT2I) body.image_urls = [image_url];                  // img2img requires a source
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`fal ${resp.status} (${mode}): ${await resp.text()}`);
  const data = await resp.json();
  const out = data?.images?.[0]?.url;
  if (!out) throw new Error(`fal returned no image. Body: ${JSON.stringify(data).slice(0, 400)}`);
  return out;
}

async function fetchBuf(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${resp.status} for ${url}`);
  const ct = resp.headers.get("content-type") || "";
  return { buf: Buffer.from(await resp.arrayBuffer()), ct };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Output -> ${OUT_DIR}\n`);

  for (const c of CONCEPTS) {
    if (ONLY && c.name !== ONLY) continue;
    console.log(`== ${c.name} (${c.layout || "center"}) ==`);

    const mode = c.mode || "img2img";
    if (mode === "img2img" && !c.bg_source_url) throw new Error(`${c.name}: img2img mode needs bg_source_url`);
    console.log(`  nano-banana background (${mode})...`);
    const bgUrl = await falGenerate({ mode, prompt: c.bg_prompt, image_url: c.bg_source_url, aspect_ratio: c.aspect_ratio });
    const { buf: bgBuf, ct: bgCt } = await fetchBuf(bgUrl);
    fs.writeFileSync(path.join(OUT_DIR, `${c.name}-background.png`), bgBuf);
    const imageDataUri = `data:${bgCt || "image/png"};base64,${bgBuf.toString("base64")}`;
    console.log(`  background saved (${(bgBuf.length / 1024).toFixed(0)} KB)`);

    // Logo source: local file override or URL
    let logoBuf, logoCt;
    if (c.logo_file) {
      logoBuf = fs.readFileSync(path.resolve(c.logo_file));
      logoCt = c.logo_file.endsWith(".svg") ? "image/svg+xml" : "image/png";
    } else {
      ({ buf: logoBuf, ct: logoCt } = await fetchBuf(c.logo_url));
    }

    for (const ratio of RATIOS) {
      const logoFactor = (c.layout === "split" || c.layout === "poster-bottom") ? 0.40 : 0.62;
      const targetW = Math.round(Math.min(ratio.w, ratio.h) * logoFactor);
      const logo = await prepareLogo({ buf: logoBuf, contentType: logoCt, targetW });
      const png = await renderConceptRatio({
        ratio,
        imageDataUri,
        logo,
        layout: c.layout,
        tagline: c.tagline,
        bullets: c.bullets,
        headline: c.headline,
        accentLine: c.accentLine,
        accent: c.accent,
      });
      const file = path.join(OUT_DIR, `${c.name}-${ratio.key}.png`);
      fs.writeFileSync(file, png);
      console.log(`  ${ratio.key.padEnd(4)} -> ${path.basename(file)}`);
    }
    console.log("");
  }

  console.log("Done. Concept ads in", OUT_DIR);
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
