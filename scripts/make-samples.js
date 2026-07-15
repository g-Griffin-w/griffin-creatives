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
const {
  renderConceptRatio,
  prepareLogo,
  RATIOS,
} = require("../api/render-concept-ad.js");

const FAL_URL = "https://fal.run/fal-ai/nano-banana/edit";

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
    for (const k of ["name", "framework", "big_idea", "image_prompt", "source_product_image_url", "tagline"]) {
      if (!c[k]) die(`${label} missing "${k}"`);
    }
    if (!FRAMEWORKS.includes(c.framework)) {
      die(`${label} framework "${c.framework}" not in: ${FRAMEWORKS.join(", ")}`);
    }
    if (c.big_idea.trim().length < 40) {
      die(`${label} big_idea is ${c.big_idea.trim().length} chars. If the idea can't fill 40 characters, there is no idea.`);
    }
    const lower = c.image_prompt.toLowerCase();
    for (const cliche of BEAUTY_SHOT_CLICHES) {
      if (lower.includes(cliche)) {
        die(`${label} image_prompt contains beauty-shot cliché "${cliche}". That's the route that lost POCA and Southern Scholar. Transform, don't decorate.`);
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
async function falEdit({ prompt, image_url }, FAL_KEY) {
  const resp = await fetch(FAL_URL, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_urls: [image_url], num_images: 1, output_format: "png" }),
  });
  if (!resp.ok) die(`nano-banana failed (${resp.status}): ${(await resp.text()).slice(0, 300)}\nDO NOT fall back to the raw product photo. Fix the call or stop.`);
  const data = await resp.json();
  const url = data?.images?.[0]?.url;
  if (!url) die(`nano-banana returned no image: ${JSON.stringify(data).slice(0, 300)}`);
  return url;
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
    const stamp = new Date().toISOString().slice(0, 10);
    const approvedDir = path.join(baseDir, `APPROVED-${stamp}`);
    fs.renameSync(pendingDir, approvedDir);
    console.log(`\nApproved -> ${approvedDir}`);
    console.log("These files may now be attached to outreach. You looked at every one, right?");
    return;
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) die("missing FAL_KEY env var");

  // Gates 2: verify every asset before spending a cent on generation
  assertClientUrl(cfg.logo_url, cfg.domain, "logo_url");
  for (const c of cfg.concepts) {
    assertClientUrl(c.source_product_image_url, cfg.domain, `${c.name} source_product_image_url`);
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
    const source = await fetchImage(c.source_product_image_url, `${c.name} product photo`);

    console.log("   nano-banana img2img...");
    const sceneUrl = await falEdit({ prompt: c.image_prompt, image_url: c.source_product_image_url }, FAL_KEY);
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
