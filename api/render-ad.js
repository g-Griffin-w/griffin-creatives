// Vercel Serverless Function: POST /api/render-ad
//
// Turns ONE static_ads concept (a nano-banana scene image + headline/subhead/CTA)
// into FINISHED, ready-to-upload ad PNGs in all 4 placement ratios:
//   1:1 (1080x1080), 4:5 (1080x1350), 9:16 (1080x1920), 16:9 (1200x628)
//
// Same render path as render-teardown-slides.js: Satori (JSX -> SVG) +
// @resvg/resvg-js (SVG -> PNG). No canvas, no new deps, no monthly cost.
// Uploads each PNG to Supabase Storage and returns public URLs that Make.com
// downloads and drops into the client's Google Drive folder.
//
// Make.com wiring: Iterator over {{deliverables.static_ads}} -> nano-banana
// (scene image) -> THIS endpoint (text overlay + 4 ratios) -> Drive upload.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

module.exports.config = { maxDuration: 60 };

// ---------- Brand palette (matches griffincreativelab.com) ----------
const BLACK = "#080808";
const CREAM = "#F0ECE3";
const CREAM_DIM = "#C8C0B4";
const ORANGE = "#FF4D00";

// ---------- Placement ratios ----------
const RATIOS = [
  { key: "1x1",  w: 1080, h: 1080 }, // Meta feed
  { key: "4x5",  w: 1080, h: 1350 }, // Meta mobile feed (highest CTR)
  { key: "9x16", w: 1080, h: 1920 }, // Stories / Reels / TikTok
  { key: "16x9", w: 1200, h: 628  }, // Google Display / FB desktop
];

// ---------- Lazy Supabase client ----------
let _sb = null;
function getSb() {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

// ---------- Fonts (bundled in api/fonts, reused from teardown renderer) ----------
function findFontPath(filename) {
  const candidates = [
    path.join(__dirname, "fonts", filename),
    path.join(process.cwd(), "api/fonts", filename),
    path.join(process.cwd(), "fonts", filename),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error(`Font not found. Tried: ${candidates.join(" | ")}`);
}

let _fonts = null;
function getFonts() {
  if (_fonts) return _fonts;
  _fonts = {
    Regular:  fs.readFileSync(findFontPath("Lato-Regular.ttf")),
    Semibold: fs.readFileSync(findFontPath("Lato-Semibold.ttf")),
    Bold:     fs.readFileSync(findFontPath("Lato-Bold.ttf")),
    Black:    fs.readFileSync(findFontPath("Lato-Black.ttf")),
  };
  return _fonts;
}

// ---------- JSX-without-build helper (same as teardown renderer) ----------
function h(type, props, ...children) {
  return {
    type,
    props: {
      ...(props || {}),
      children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children,
    },
  };
}

// ---------- Build one ad layout ----------
// Full-bleed scene image, a bottom gradient scrim for legibility, then
// headline + subheadline + CTA pill anchored bottom-left.
function buildAdJsx({ w, h: H, imageDataUri, headline, subheadline, cta, accent = ORANGE }) {
  const scale = Math.min(w, H);
  const pad = Math.round(w * 0.065);
  const hlSize = Math.round(scale * 0.084);
  const subSize = Math.round(scale * 0.034);
  const ctaSize = Math.round(scale * 0.030);
  const textMaxWidth = w - pad * 2;

  const children = [];

  // Background scene image (nano-banana output), cover-fit.
  if (imageDataUri) {
    children.push(
      h("img", {
        src: imageDataUri,
        width: w,
        height: H,
        style: { position: "absolute", top: 0, left: 0, width: w, height: H, objectFit: "cover" },
      })
    );
  }

  // Gradient scrim — bottom ~64% fades to near-black so copy stays legible
  // over any image.
  children.push(
    h("div", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: Math.round(H * 0.64),
        backgroundImage: `linear-gradient(to top, rgba(8,8,8,0.94) 0%, rgba(8,8,8,0.78) 38%, rgba(8,8,8,0) 100%)`,
      },
    })
  );

  // Copy block
  const copyChildren = [
    h("div", {
      style: {
        fontSize: hlSize,
        fontWeight: 900,
        color: CREAM,
        lineHeight: 1.04,
        letterSpacing: -0.5,
        maxWidth: textMaxWidth,
      },
    }, String(headline || "").toUpperCase()),
  ];

  if (subheadline) {
    copyChildren.push(
      h("div", {
        style: {
          fontSize: subSize,
          fontWeight: 600,
          color: CREAM_DIM,
          lineHeight: 1.3,
          marginTop: Math.round(scale * 0.018),
          maxWidth: textMaxWidth,
        },
      }, String(subheadline))
    );
  }

  if (cta) {
    copyChildren.push(
      h("div", {
        style: {
          display: "flex",
          alignSelf: "flex-start",
          backgroundColor: accent,
          color: "#FFFFFF",
          fontSize: ctaSize,
          fontWeight: 700,
          letterSpacing: 0.5,
          padding: `${Math.round(scale * 0.018)}px ${Math.round(scale * 0.034)}px`,
          borderRadius: Math.round(scale * 0.012),
          marginTop: Math.round(scale * 0.028),
        },
      }, String(cta).toUpperCase())
    );
  }

  children.push(
    h("div", {
      style: {
        position: "absolute",
        left: pad,
        right: pad,
        bottom: pad,
        display: "flex",
        flexDirection: "column",
      },
    }, ...copyChildren)
  );

  return h("div", {
    style: {
      width: w,
      height: H,
      display: "flex",
      position: "relative",
      backgroundColor: BLACK,
      fontFamily: "Lato",
      overflow: "hidden",
    },
  }, ...children);
}

// ---------- Satori + resvg render ----------
async function renderJsxToPng(jsxNode, w, h) {
  const satoriMod = await import("satori");
  const satori = satoriMod.default || satoriMod;
  const fonts = getFonts();

  const svg = await satori(jsxNode, {
    width: w,
    height: h,
    fonts: [
      { name: "Lato", data: fonts.Regular,  weight: 400, style: "normal" },
      { name: "Lato", data: fonts.Semibold, weight: 600, style: "normal" },
      { name: "Lato", data: fonts.Bold,     weight: 700, style: "normal" },
      { name: "Lato", data: fonts.Black,    weight: 900, style: "normal" },
    ],
  });

  const resvgMod = await import("@resvg/resvg-js");
  const { Resvg } = resvgMod;
  const resvg = new Resvg(svg, { background: "transparent" });
  return resvg.render().asPng();
}

// Render a single ratio to a PNG buffer (no upload) — used by the handler and
// by local QA harnesses.
async function renderOneRatio({ ratio, imageDataUri, headline, subheadline, cta, accent }) {
  const jsx = buildAdJsx({ w: ratio.w, h: ratio.h, imageDataUri, headline, subheadline, cta, accent });
  return renderJsxToPng(jsx, ratio.w, ratio.h);
}

// Validate a hex color (#RGB or #RRGGBB); fall back to brand orange.
function sanitizeHex(c) {
  if (typeof c === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim())) {
    return c.trim();
  }
  return ORANGE;
}

// ---------- Helpers ----------
function slugify(s) {
  return String(s || "ad")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "ad";
}

async function fetchAsDataUri(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image_url (${resp.status})`);
  const ct = resp.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await resp.arrayBuffer());
  return `data:${ct};base64,${buf.toString("base64")}`;
}

// ---------- Main handler ----------
const handler = async (req, res) => {
  const expectedKey = process.env.CONTENT_GEN_API_KEY;
  if (expectedKey && req.headers["x-api-key"] !== expectedKey) {
    return res.status(401).json({ error: "Invalid or missing x-api-key" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const {
      image_url,        // nano-banana scene image (required)
      headline,         // required
      subheadline = "",
      cta_button = "",
      concept = "ad",
      client_id = "shared", // used only for the storage path
      accent_color,         // client brand accent for the CTA button (hex)
    } = body;

    if (!image_url || !headline) {
      return res.status(400).json({ error: "Missing image_url or headline" });
    }

    const accent = sanitizeHex(accent_color);
    const bucket = process.env.AD_ASSETS_BUCKET || "content_assets";
    const sb = getSb();
    const imageDataUri = await fetchAsDataUri(image_url);
    const conceptSlug = slugify(concept);

    const files = [];
    for (const ratio of RATIOS) {
      const png = await renderOneRatio({ ratio, imageDataUri, headline, subheadline, cta: cta_button, accent });
      const filename = `static-ads/${slugify(client_id)}/${conceptSlug}-${ratio.key}.png`;
      const { error: upErr } = await sb.storage.from(bucket).upload(filename, png, {
        contentType: "image/png",
        upsert: true,
      });
      if (upErr) return res.status(500).json({ error: `Upload failed for ${ratio.key}`, detail: upErr.message });
      const { data: pub } = sb.storage.from(bucket).getPublicUrl(filename);
      files.push({ ratio: ratio.key, url: pub.publicUrl });
    }

    return res.status(200).json({
      success: true,
      concept,
      count: files.length,
      files,                          // [{ ratio, url }]
      urls: files.map((f) => f.url),  // flat list for easy Make iteration
    });
  } catch (err) {
    console.error("render-ad error:", err);
    return res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5).join("\n") });
  }
};

module.exports = handler;
module.exports.config = { maxDuration: 60 };
// Exported for local QA harnesses:
module.exports.renderOneRatio = renderOneRatio;
module.exports.buildAdJsx = buildAdJsx;
module.exports.RATIOS = RATIOS;
