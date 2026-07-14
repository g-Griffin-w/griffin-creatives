#!/usr/bin/env node
// scripts/generate-sample-ads-chikkachikka.js
//
// Free-sample generator for Chikka Chikka (Sabeen @ chikkachikka.com).
// Runs the REAL pipeline locally:
//   product photo -> fal.ai nano-banana/edit (scene) -> render-ad overlay -> 4 ratios
//
// Usage:
//   cd ~/griffin-creatives
//   FAL_KEY='your-key' node scripts/generate-sample-ads-chikkachikka.js
//
// Output: ./sample-ads/chikkachikka/<concept>-<ratio>.png  (+ the raw nano-banana scene)

const fs = require("fs");
const path = require("path");
const { renderOneRatio, RATIOS } = require("../api/render-ad.js");

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("Missing FAL_KEY. Run:  FAL_KEY='...' node scripts/generate-sample-ads-chikkachikka.js");
  process.exit(1);
}

const FAL_URL = "https://fal.run/fal-ai/nano-banana/edit";
const CLIENT = "chikkachikka";
const OUT_DIR = path.join(__dirname, "..", "sample-ads", CLIENT);

// ---------- The two free samples for Chikka Chikka ----------
const CONCEPTS = [
  {
    name: "fresh-breath",
    // Clean product pack-shot (mint tin front) — their real Shopify asset
    product_image_url:
      "https://chikkachikka.com/cdn/shop/files/Mint_Front_V2.png?v=1761666599",
    image_prompt:
      "Bright, clean lifestyle scene on a sunlit light-wood dining table just after a meal. The Chikka Chikka mint tin is the clear hero of the shot: standing upright and open in the foreground in sharp focus, its full front label and logo crisp and completely legible, with a few maple-roasted fennel seeds resting on a small ceramic dish beside it. Soft natural window light, fresh mint-green and warm cream tones, shallow depth of field, premium editorial product photography. Keep the Chikka Chikka tin and its label EXACTLY as in the reference photo — do not redesign, blur, recolor, or replace it. Place the tin in the upper two-thirds and leave the lower third as clean, empty tabletop. preserve the product label exactly; add no additional text or graphics",
    headline: "Fresh breath. Happy tummy. Zero junk.",
    subheadline:
      "Maple-roasted fennel seeds in a pocket-sized tin — the after-dinner ritual, reinvented. Vegan, gluten-free, no refined sugar.",
    cta: "Try Chikka Chikka",
    accent: "#3FA796",
  },
  {
    name: "beat-the-bloat",
    // Clean single-tin pack-shot (Cardamom front) — one label = no garbling
    product_image_url:
      "https://chikkachikka.com/cdn/shop/files/Card_Front_V2.png?v=1761666652",
    image_prompt:
      "Warm, inviting after-dinner tabletop scene in soft evening light. A single Chikka Chikka cardamom tin is the clear hero: standing upright in the foreground in sharp focus, its full front label and logo crisp and completely legible, resting on a linen napkin beside an empty dessert plate and a small cup of chai. Cozy maple-gold and cream palette, shallow depth of field, premium editorial food photography. Keep the Chikka Chikka tin and its label EXACTLY as in the reference photo — do not redesign, blur, recolor, or replace it, and keep every letter of the label legible. Place the tin in the upper two-thirds and leave the lower third as clean, empty surface. preserve the product label exactly; add no additional text or graphics",
    headline: "Bloated after every meal?",
    subheadline:
      "One pinch of maple-roasted fennel settles the tummy and freshens breath — no refined sugar, and it actually tastes good.",
    cta: "Beat the bloat",
    accent: "#C98A3B",
  },
];

// ---------- helpers ----------
async function falEdit({ prompt, image_url }) {
  const resp = await fetch(FAL_URL, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_urls: [image_url],
      num_images: 1,
      output_format: "png",
    }),
  });
  if (!resp.ok) {
    throw new Error(`fal ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error(`fal returned no image. Body: ${JSON.stringify(data).slice(0, 400)}`);
  return url;
}

async function fetchAsDataUri(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch image ${resp.status} for ${url}`);
  const ct = resp.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await resp.arrayBuffer());
  return { dataUri: `data:${ct};base64,${buf.toString("base64")}`, buf };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Output -> ${OUT_DIR}\n`);

  for (const c of CONCEPTS) {
    console.log(`== ${c.name} ==`);
    console.log("  nano-banana scene...");
    const sceneUrl = await falEdit({ prompt: c.image_prompt, image_url: c.product_image_url });

    const { dataUri, buf } = await fetchAsDataUri(sceneUrl);
    fs.writeFileSync(path.join(OUT_DIR, `${c.name}-scene.png`), buf);
    console.log(`  scene saved (${(buf.length / 1024).toFixed(0)} KB)`);

    for (const ratio of RATIOS) {
      const png = await renderOneRatio({
        ratio,
        imageDataUri: dataUri,
        headline: c.headline,
        subheadline: c.subheadline,
        cta: c.cta,
        accent: c.accent,
      });
      const file = path.join(OUT_DIR, `${c.name}-${ratio.key}.png`);
      fs.writeFileSync(file, png);
      console.log(`  ${ratio.key.padEnd(4)} -> ${path.basename(file)}`);
    }
    console.log("");
  }

  console.log("Done. 2 concepts x 4 ratios = 8 finished ads, plus 2 raw scenes.");
  console.log(`Open the folder: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
