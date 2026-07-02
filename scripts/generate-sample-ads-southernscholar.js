#!/usr/bin/env node
// scripts/generate-sample-ads-southernscholar.js
//
// Free-sample generator for Southern Scholar (Kevin @ southernscholar.com).
// Runs the REAL pipeline locally:
//   product photo -> fal.ai nano-banana/edit (scene) -> render-ad overlay -> 4 ratios
//
// Usage:
//   cd ~/griffin-creatives
//   FAL_KEY='your-key' node scripts/generate-sample-ads-southernscholar.js
//
// Output: ./sample-ads/southernscholar/<concept>-<ratio>.png  (+ the raw nano-banana scene)

const fs = require("fs");
const path = require("path");
const { renderOneRatio, RATIOS } = require("../api/render-ad.js");

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("Missing FAL_KEY. Run:  FAL_KEY='...' node scripts/generate-sample-ads-southernscholar.js");
  process.exit(1);
}

const FAL_URL = "https://fal.run/fal-ai/nano-banana/edit";
const CLIENT = "southernscholar";
const OUT_DIR = path.join(__dirname, "..", "sample-ads", CLIENT);

// ---------- The two free samples for Southern Scholar ----------
const CONCEPTS = [
  {
    name: "never-slip",
    // Clean product shot (Brown Ribbed bundle) — their real Shopify asset
    product_image_url:
      "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/The_Brown__Ribbed_desktop.jpg?v=1782306863",
    image_prompt:
      "Sophisticated menswear flat-lay in soft daylight on a dark walnut surface. The Southern Scholar brown ribbed over-the-calf dress socks are the clear hero: neatly folded in the foreground in sharp focus, the ribbed texture and rich brown color crisp and true to the reference, styled beside a polished leather dress shoe and a folded wool trouser cuff. Refined, masculine navy-and-cognac palette, shallow depth of field, premium editorial product photography. Keep the socks EXACTLY as in the reference photo — do not redesign the pattern, weave, or color, and do not blur or replace them. Place the socks and props in the upper two-thirds and leave the lower third as clean, empty surface. preserve the product exactly; add no additional text or graphics",
    headline: "Dress socks that never slip to your ankles.",
    subheadline:
      "Over-the-calf, engineered to stay up all day. Premium combed cotton, built to outlast the drawer full you already own.",
    cta: "Shop Southern Scholar",
    accent: "#1B2A4A",
  },
  {
    name: "membership",
    // Clean single-pair shot (The Hollins — royal blue w/ white dashes); one band = no garbling
    product_image_url:
      "https://cdn.shopify.com/s/files/1/0086/6035/3103/files/Untitleddesign_7.jpg?v=1773171744",
    image_prompt:
      "Premium gift-styled still life in soft daylight on a marble surface. A single folded pair of Southern Scholar royal-blue dress socks with a white dash pattern is the clear hero: positioned in the foreground in sharp focus, the color, pattern, and paper band crisp and true to the reference, styled with a fountain pen and a leather watch strap nearby for an elevated gentleman feel. Refined navy, cream, and cognac palette, shallow depth of field, premium editorial product photography. Keep the socks and their band EXACTLY as in the reference photo — do not redesign, recolor, blur, or replace them, and keep any band text legible. Place the socks in the upper two-thirds and leave the lower third as clean, empty surface. preserve the product exactly; add no additional text or graphics",
    headline: "Fresh socks at his door every season.",
    subheadline:
      "The Gentleman Membership — hand-picked dress socks delivered on schedule. He never thinks about socks again.",
    cta: "Start the membership",
    accent: "#8B5E3C",
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
