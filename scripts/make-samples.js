#!/usr/bin/env node
// scripts/make-samples.js
//
// THE ONLY approved way to generate client sample ads.
// (generate-sample-ads*.js are deprecated — beauty-shot route lost us 2 clients.)
//
// Pipeline (all gates hard-fail; there are NO fallbacks):
//   client config JSON -> gates -> fal nano-banana img2img -> render-concept-ad -> PENDING-REVIEW/
//
// Usage:
//   FAL_KEY='...' node scripts/make-samples.js clients/<client>.json
//   node scripts/make-samples.js clients/<client>.json --approve   (after eyeballing every PNG)
//
// A sample is NOT sendable until --approve has been run. The email step should
// only ever attach files from an APPROVED-* folder.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  renderConceptRatio,
  prepareLogo,
  RATIOS,
} = require("../api/render-concept-ad.js");

// Two img2img engines. Seedream 4.5 preserves label text noticeably better than
// nano-banana — prefer it when the client has flagged product fidelity (Kobu, July 16).
const FAL_MODELS = {
  "nano-banana": "https://fal.run/fal-ai/nano-banana/edit",
  "seedream": "https://fal.run/fal-ai/bytedance/seedream/v4.5/edit",
};
// Cutout engine endpoints (config: "engine": "cutout"). The ONLY route that copies
// the client's label pixel-for-pixel — use whenever a client flags product fidelity.
const FAL_BIREFNET = "https://fal.run/fal-ai/birefnet/v2";
const FAL_BG_T2I = "https://fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image";

// Short content hash so cutout/background cache files are keyed by what
// actually produced them, not just the concept name. Without this, editing
// a client config to point at a corrected source photo silently kept
// serving the stale cutout on disk (the July 2026 Kobu bug) — the file
// existed under the old name and nothing noticed the input had changed.
function shortHash(input) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}

function getSharp() {
  try { return require("sharp"); }
  catch { die("cutout engine needs 'sharp'. Run once:  npm install sharp"); }
}

const FRAMEWORKS = [
  "problem_agitation",     // name the pain, twist the knife, product resolves
  "us_vs_them",            // enemy = old way / competitor category
  "unexpected_context",    // pattern interrupt; product where it "shouldn't" be
  "social_proof",          // review/quote as the hero
  "ingredient_hero",       // macro/abstract of what's inside
  "identity_badge",        // buying this = being this kind of person (POCA "people with taste")
];

// Phrases that mean "brand-photography lookalike", the exact failure that lost
// POCA and Southern Scholar. If a concept prompt contains one, the run aborts.
const BEAUTY_SHOT_CLICHES = [
  "flat-lay", "flat lay", "beside a", "next to a", "on a marble",
  "kitchen counter", "cafe tabletop", "styled with", "editorial product photography",
];

function die(msg) {
  console.error(`\nGATE FAILED: ${msg}\n(No output was produced. Fix the config — do not work around the gate.)`);
  process.exit(1);
}

function loadConfig(file) {
  if (!fs.existsSync(file)) die(`config not found: ${file}`);
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { die(`config is not valid JSON: ${e.message}`); }
  return cfg;
}

// ---------- Gate 1: config completeness ----------
function validateConfig(cfg) {
  for (const k of ["client", "domain", "logo_url", "accent", "concepts"]) {
    if (!cfg[k]) die(`config missing "${k}"`);
  }
  if (!Array.isArray(cfg.concepts) || cfg.concepts.length < 2) {
    die("need at least 2 concepts — one idea is a coin flip, two is a test");
  }
  cfg.concepts.forEach((c, i) => {
    const label = `concepts[${i}] (${c.name || "unnamed"})`;
    for (const k of ["name", "framework", "big_idea", "image_prompt", "tagline"]) {
      if (!c[k]) die(`${label} missing "${k}"`);
    }
    if (!c.source_product_image_url && !c.source_product_image_file) {
      die(`${label} needs source_product_image_url (client domain/Shopify) or source_product_image_file (photo the client sent us directly)`);
    }
    if (!FRAMEWORKS.includes(c.framework)) {
      die(`${label} framework "${c.framework}" not in: ${FRAMEWORKS.join(", ")}`);
    }
    if (c.big_idea.trim().length < 40) {
      die(`${label} big_idea is ${c.big_idea.trim().length} chars. If the idea can't fill 40 characters, there is no idea.`);
    }
    if ((cfg.engine || "img2img") === "cutout") {
      if (!c.bg_prompt) die(`${label}: engine "cutout" requires a bg_prompt (product-free background scene)`);
    } else {
      const lower = c.image_prompt.toLowerCase();
      for (const cliche of BEAUTY_SHOT_CLICHES) {
        if (lower.includes(cliche)) {
          die(`${label} image_prompt contains beauty-shot cliché "${cliche}". That's the route that lost POCA and Southern Scholar. Transform, don't decorate.`);
        }
      }
    }
  });
}

// ---------- Gate 2: assets must be the client's real assets ----------
function assertClientUrl(url, domain, label) {
  let u;
  try { u = new URL(url); } catch { die(`${label} is not a valid URL: ${url}`); }
  if (u.protocol !== "https:") die(`${label} must be https`);
  const host = u.hostname.toLowerCase();
  const okHost =
    host === domain || host.endsWith(`.${domain}`) ||
    host === "cdn.shopify.com" || host.endsWith(".shopifycdn.com");
  if (!okHost) {
    die(`${label} host "${host}" is not ${domain} or Shopify CDN. Web-scraped stand-ins are how we sent fake samples. Get the real asset.`);
  }
}

// minKB: product photos must be substantial (20 KB floor catches thumbnails);
// logos are legitimately small vector-ish PNGs, so they get a 2 KB floor with
// a visibility warning instead of a hard fail.
async function fetchImage(url, label, minKB = 20) {
  const resp = await fetch(url);
  if (!resp.ok) die(`${label} fetch failed (${resp.status}) for ${url}`);
  const ct = resp.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) die(`${label} is not an image (content-type: ${ct})`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const kb = buf.length / 1024;
  if (kb < minKB) die(`${label} is suspiciously small (${kb.toFixed(0)} KB, floor ${minKB} KB) — probably a thumbnail. Get the full-res asset.`);
  if (kb < 15) console.log(`   NOTE: ${label} is only ${kb.toFixed(0)} KB — check it renders sharp in review.`);
  return { buf, contentType: ct, dataUri: `data:${ct};base64,${buf.toString("base64")}` };
}

// ---------- Gate 3: scene generation must actually happen ----------
async function falEdit({ prompt, image_url, model }, FAL_KEY) {
  const endpoint = FAL_MODELS[model || "nano-banana"];
  if (!endpoint) die(`unknown fal_model "${model}". Valid: ${Object.keys(FAL_MODELS).join(", ")}`);
  const body = { prompt, image_urls: [image_url], num_images: 1 };
  if ((model || "nano-banana") === "nano-banana") body.output_format = "png";
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) die(`nano-banana failed (${resp.status}): ${(await resp.text()).slice(0, 300)}\nDO NOT fall back to the raw product photo. Fix the call or stop.`);
  const data = await resp.json();
  const url = data?.images?.[0]?.url;
  if (!url) die(`nano-banana returned no image: ${JSON.stringify(data).slice(0, 300)}`);
  return url;
}

// ---------- cutout engine helpers ----------
async function falPostJson(url, body, FAL_KEY) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) die(`fal ${resp.status} @ ${url}: ${(await resp.text()).slice(0, 300)}`);
  return resp.json();
}

// BiRefNet cutout of the client's real product photo (cached — pixels never change).
async function makeCutout({ sourceDataUri, rotate, cacheFile }, FAL_KEY) {
  const sharp = getSharp();
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile);
  console.log("   birefnet cutout...");
  const d = await falPostJson(FAL_BIREFNET, { image_url: sourceDataUri, output_format: "png" }, FAL_KEY);
  const u = d?.image?.url || d?.images?.[0]?.url;
  if (!u) die(`BiRefNet returned no image: ${JSON.stringify(d).slice(0, 200)}`);
  const raw = Buffer.from(await (await fetch(u)).arrayBuffer());
  let p = sharp(raw);
  if (rotate) p = p.rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const out = await p.trim({ threshold: 10 }).png().toBuffer();
  fs.writeFileSync(cacheFile, out);
  return out;
}

// Product-free background, cached so approved scenes survive re-runs.
async function getBackground({ prompt, cacheFile }, FAL_KEY) {
  if (fs.existsSync(cacheFile)) {
    console.log("   reusing background (delete file to re-roll)...");
    return fs.readFileSync(cacheFile);
  }
  console.log("   generating background...");
  const safe = /no product/i.test(prompt) ? prompt : prompt + " No product, no packaging, no text, no logos.";
  const d = await falPostJson(FAL_BG_T2I, { prompt: safe, image_size: "portrait_16_9", num_images: 1 }, FAL_KEY);
  const u = d?.images?.[0]?.url;
  if (!u) die(`background t2i returned no image: ${JSON.stringify(d).slice(0, 200)}`);
  const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
  fs.writeFileSync(cacheFile, buf);
  return buf;
}

// Seat the product per ratio so it can NEVER collide with the top text block.
// [productHeightFrac, baselineFrac] — the "top" layout's text stack ends ~48% down
// on square, ~38% on 4x5, ~27% on 9x16; product top must start below that.
const SEATING = {
  "1x1": [0.38, 0.88],
  "4x5": [0.46, 0.88],
  "9x16": [0.56, 0.88],
  "16x9": [0.36, 0.90],
};

// Compose: cover-fit background + soft grounding shadow + centered real product.
async function composeScene({ bgBuf, cutBuf, w, h, key }) {
  const sharp = getSharp();
  const [hFrac, baseFrac] = SEATING[key] || [0.44, 0.88];
  const bg = await sharp(bgBuf).resize(w, h, { fit: "cover" }).toBuffer();
  const meta = await sharp(cutBuf).metadata();
  let prodH = Math.round(h * hFrac);
  let prodW = Math.round(prodH * (meta.width / meta.height));
  const maxW = Math.round(w * 0.8);
  if (prodW > maxW) { prodW = maxW; prodH = Math.round(prodW * (meta.height / meta.width)); }
  const baseline = Math.round(h * baseFrac);
  const left = Math.round((w - prodW) / 2);
  const top = baseline - prodH;
  const rx = Math.round(prodW * 0.65), ry = Math.max(14, Math.round(prodW * 0.17));
  const shadowSvg = Buffer.from(
    `<svg width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${baseline}" rx="${rx}" ry="${ry}" fill="black" fill-opacity="0.45"/></svg>`
  );
  const shadow = await sharp(shadowSvg).blur(14).png().toBuffer();
  const product = await sharp(cutBuf).resize(prodW, prodH).png().toBuffer();
  return sharp(bg)
    .composite([
      { input: shadow, top: 0, left: 0 },
      { input: product, top, left },
    ])
    .png()
    .toBuffer();
}

// ---------- main ----------
async function main() {
  const args = process.argv.slice(2);
  const configFile = args.find((a) => !a.startsWith("--"));
  const approve = args.includes("--approve");
  if (!configFile) die("usage: node scripts/make-samples.js clients/<client>.json [--approve]");

  const cfg = loadConfig(configFile);
  validateConfig(cfg);

  const baseDir = path.join(__dirname, "..", "sample-ads", cfg.client);
  const pendingDir = path.join(baseDir, "PENDING-REVIEW");

  // ---- approval mode: promote a reviewed batch ----
  if (approve) {
    if (!fs.existsSync(pendingDir)) die(`nothing to approve — ${pendingDir} does not exist`);

    // Gate: REVIEW.md must exist and every checklist box must actually be
    // checked. Previously --approve just renamed the folder regardless of
    // the checklist's contents, so an unreviewed (or failed-review) batch
    // could still get promoted and attached to outreach — which is how a
    // fidelity miss shipped to a real client twice.
    const reviewFile = path.join(pendingDir, "REVIEW.md");
    if (!fs.existsSync(reviewFile)) die(`no REVIEW.md in ${pendingDir} — can't approve a batch with no review checklist`);
    const reviewText = fs.readFileSync(reviewFile, "utf8");
    const items = reviewText.match(/^- \[[ x]\].+$/gm) || [];
    if (items.length === 0) die(`REVIEW.md has no checklist items — nothing to approve`);
    const unchecked = items.filter((line) => line.startsWith("- [ ]"));
    if (unchecked.length > 0) {
      die(
        `${unchecked.length} of ${items.length} REVIEW.md item(s) still unchecked. ` +
        `Open every PNG, check each box in ${reviewFile}, THEN re-run --approve.\n` +
        unchecked.map((l) => `  ${l}`).join("\n"),
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const approvedDir = path.join(baseDir, `APPROVED-${stamp}`);
    fs.renameSync(pendingDir, approvedDir);
    console.log(`\nApproved -> ${approvedDir}`);
    console.log("These files may now be attached to outreach. You looked at every one, right?");
    return;
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) die("missing FAL_KEY env var");

  // Gates 2: verify every asset before spending a cent on generation.
  // Local files are allowed only because they came from the client directly (email).
  assertClientUrl(cfg.logo_url, cfg.domain, "logo_url");
  for (const c of cfg.concepts) {
    if (c.source_product_image_file) {
      const abs = path.resolve(__dirname, "..", c.source_product_image_file);
      if (!fs.existsSync(abs)) die(`${c.name} source_product_image_file not found: ${abs}`);
    } else {
      assertClientUrl(c.source_product_image_url, cfg.domain, `${c.name} source_product_image_url`);
    }
  }
  console.log("Asset gates passed. Fetching logo...");
  const logoRaw = await fetchImage(cfg.logo_url, "logo", 2);
  // 560 not 900: a huge centered logo buries any product that sits mid-frame
  // (July 15 Kobu QA — all three scenes had the packet hidden under the logo).
  const logo = await prepareLogo({ buf: logoRaw.buf, contentType: logoRaw.contentType, targetW: 560 });

  // --only=name1,name2 regenerates specific concepts without wiping the rest.
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice(7).split(",").map((s) => s.trim()) : null;
  const concepts = only ? cfg.concepts.filter((c) => only.includes(c.name)) : cfg.concepts;
  if (only && concepts.length !== only.length) die(`--only names not found in config: ${only.join(",")}`);

  if (!only) fs.rmSync(pendingDir, { recursive: true, force: true });
  fs.mkdirSync(pendingDir, { recursive: true });

  const reviewLines = [
    `# ${cfg.client} sample review — ${new Date().toISOString()}`,
    "",
    "For EVERY image below, answer honestly:",
    "1. Could this brand have made this themselves in 10 minutes? (must be NO)",
    "2. Does it look like their own Instagram feed? (must be NO)",
    "3. Is the product/label rendered correctly? (must be YES)",
    "4. Does the visual express the big idea, not just show the product? (must be YES)",
    "5. Is ANY text or logo covering the product? (must be NO — hard rule)",
    "",
    "If ANY answer fails: delete the image, fix the concept, re-run. Then:",
    "  node scripts/make-samples.js clients/" + path.basename(configFile) + " --approve",
    "",
  ];

  for (const c of concepts) {
    console.log(`\n== ${c.name} [${c.framework}] ==`);
    console.log(`   big idea: ${c.big_idea}`);
    let source, sourceRef;
    if (c.source_product_image_file) {
      const abs = path.resolve(__dirname, "..", c.source_product_image_file);
      const buf = fs.readFileSync(abs);
      const ct = abs.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      source = { buf, contentType: ct, dataUri: `data:${ct};base64,${buf.toString("base64")}` };
      sourceRef = source.dataUri; // fal accepts data URIs
    } else {
      source = await fetchImage(c.source_product_image_url, `${c.name} product photo`);
      sourceRef = c.source_product_image_url;
    }

    if ((cfg.engine || "img2img") === "cutout") {
      // CUTOUT ENGINE: the client's real pixels seated into OUR generated scene.
      // Label fidelity by construction; composition controlled by code, not dice.
      const assetsDir = path.join(baseDir, "assets");
      fs.mkdirSync(assetsDir, { recursive: true });
      const cutoutHash = shortHash(source.dataUri + "|" + (c.rotate || 0));
      const cutBuf = await makeCutout(
        { sourceDataUri: source.dataUri, rotate: c.rotate, cacheFile: path.join(assetsDir, `${c.name}-${cutoutHash}-cutout.png`) },
        FAL_KEY,
      );
      const bgHash = shortHash(c.bg_prompt);
      const bgBuf = await getBackground(
        { prompt: c.bg_prompt, cacheFile: path.join(assetsDir, `${c.name}-${bgHash}-background.png`) },
        FAL_KEY,
      );
      fs.writeFileSync(path.join(pendingDir, `${c.name}-SOURCE.png`), source.buf);
      for (const ratio of RATIOS) {
        const composed = await composeScene({ bgBuf, cutBuf, w: ratio.w, h: ratio.h, key: ratio.key });
        const png = await renderConceptRatio({
          ratio,
          imageDataUri: `data:image/png;base64,${composed.toString("base64")}`,
          logo,
          layout: c.layout || "top",
          tagline: c.tagline,
          bullets: c.bullets || [],
          accent: c.accent || cfg.accent,
        });
        fs.writeFileSync(path.join(pendingDir, `${c.name}-${ratio.key}.png`), png);
        console.log(`   ${ratio.key} rendered (cutout)`);
      }
      reviewLines.push(`- [ ] ${c.name} (${c.framework}): ${c.big_idea}`);
      continue;
    }

    const model = cfg.fal_model || "nano-banana";
    console.log(`   ${model} img2img...`);
    const sceneUrl = await falEdit({ prompt: c.image_prompt, image_url: sourceRef, model }, FAL_KEY);
    const scene = await fetchImage(sceneUrl, `${c.name} generated scene`);

    // Gate 3b: output must differ from input (identical bytes = generation was skipped)
    if (scene.buf.equals(source.buf)) die(`${c.name}: generated scene is byte-identical to the source photo. Generation did not happen.`);

    fs.writeFileSync(path.join(pendingDir, `${c.name}-SOURCE.png`), source.buf);
    fs.writeFileSync(path.join(pendingDir, `${c.name}-scene.png`), scene.buf);

    for (const ratio of RATIOS) {
      const png = await renderConceptRatio({
        ratio,
        imageDataUri: scene.dataUri,
        logo,
        // Default "top": text above, product below — Gabriel's hard rule is
        // that rendered text never covers the product. "center" must be opted
        // into deliberately and only for scenes with no product in frame.
        layout: c.layout || "top",
        tagline: c.tagline,
        bullets: c.bullets || [],
        accent: c.accent || cfg.accent,
      });
      fs.writeFileSync(path.join(pendingDir, `${c.name}-${ratio.key}.png`), png);
      console.log(`   ${ratio.key} rendered`);
    }
    reviewLines.push(`- [ ] ${c.name} (${c.framework}): ${c.big_idea}`);
  }

  fs.writeFileSync(path.join(pendingDir, "REVIEW.md"), reviewLines.join("\n"));
  console.log(`\nDone -> ${pendingDir}`);
  console.log("STATUS: NOT SEND-READY. Open every PNG, then run with --approve.");
}

main().catch((e) => { console.error("\nFAILED:", e.message); process.exit(1); });
