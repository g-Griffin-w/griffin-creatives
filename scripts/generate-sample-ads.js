#!/usr/bin/env node
// scripts/generate-sample-ads.js
//
// One-off free-sample generator. Runs the REAL pipeline locally:
//   product photo -> fal.ai nano-banana/edit (scene) -> render-ad overlay -> 4 ratios
//
// Usage:
//   cd ~/griffin-creatives
//   FAL_KEY='your-key' node scripts/generate-sample-ads.js
//
// Output: ./sample-ads/<client>/<concept>-<ratio>.png  (+ the raw nano-banana scene)
// No Supabase / Vercel needed — render happens in-process via Satori + resvg.

const fs = require("fs");
const path = require("path");
const { renderOneRatio, RATIOS } = require("../api/render-ad.js");

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("Missing FAL_KEY. Run:  FAL_KEY='...' node scripts/generate-sample-ads.js");
  process.exit(1);
}

const FAL_URL = "https://fal.run/fal-ai/nano-banana/edit";
const CLIENT = "poca";
const OUT_DIR = path.join(__dirname, "..", "sample-ads", CLIENT);

// ---------- The two free samples for Poca (Emily @ pickpoca.com) ----------
const CONCEPTS = [
  {
    name: "vanilla",
    // Source product photo (their real Shopify asset)
    product_image_url:
      "https://cdn.shopify.com/s/files/1/0786/6581/0159/files/vanilla_3x4_1.jpg?v=1770496748",
    image_prompt:
      "Bright, airy morning kitchen scene on a sunlit marble counter. The POCA vanilla syrup packet is the clear hero of the shot: standing upright in the foreground in sharp focus, its full front label and POCA logo crisp and completely legible, next to a freshly poured oat-milk latte with delicate latte art. Soft natural window light, warm cream and golden tones, shallow depth of field, premium editorial product photography. Keep the POCA packet and its label EXACTLY as in the reference photo — do not redesign, blur, recolor, or replace it. Place the packet and cup in the upper two-thirds and leave the lower third as clean, empty countertop. preserve the product label exactly; add no additional text or graphics",
    headline: "Sugar-free that tastes like sugar",
    subheadline:
      "Vanilla bean POCA — allulose + monk fruit, low calorie, a fiber boost, zero crash out.",
    cta: "Put a POCA in it",
    accent: "#C98A3B",
  },
  {
    name: "pistachio",
    product_image_url:
      "https://cdn.shopify.com/s/files/1/0786/6581/0159/files/pisctachio_3x4_9051ca7d-6aa6-48c5-81ce-ec839cfd5ebf.png?v=1770496722",
    image_prompt:
      "Elegant cafe tabletop in soft daylight. The POCA pistachio syrup packet is the clear hero: standing upright in the foreground in sharp focus, its full green front label and POCA logo crisp and completely legible, beside a creamy iced matcha latte in a tall glass with a few whole pistachios scattered nearby. Sophisticated pistachio-green and warm-cream palette, shallow depth of field, premium editorial product photography. Keep the POCA packet and its label EXACTLY as in the reference photo — do not redesign, blur, recolor, or replace it. Place the packet and glass in the upper two-thirds and leave the lower third as clean, empty surface. preserve the product label exactly; add no additional text or graphics",
    headline: "Dessert in your cup",
    subheadline:
      "Pistachio POCA — nostalgic marzipan sweetness, sugar-free, with a boost of fiber. Your daily little treat.",
    cta: "Taste Pistachio",
    accent: "#6FA368",
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
