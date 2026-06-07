// Vercel Serverless Function: POST /api/render-teardown-slides
//
// PHASE 3 — Renders 6 PNG slides from a teardown_carousel row's brief JSON,
// uploads them to the content_assets Supabase Storage bucket, and updates the
// row's media_urls field. The Make.com IG-posting scenario then picks up the
// row and posts the carousel.
//
// Request body:
//   { "row_id": "<content_queue row UUID>" }
//
// Auth:
//   x-api-key header must match CONTENT_GEN_API_KEY
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, CONTENT_GEN_API_KEY

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

module.exports.config = { maxDuration: 60 };

// ===== Lazy clients =====
let _sb = null;
function getSb() {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

// Font files loaded once and reused. Try multiple candidate paths because
// Vercel's deployment layout differs between project root and function dir.
function findFontPath(filename) {
  const candidates = [
    path.join(__dirname, "fonts", filename),
    path.join(process.cwd(), "api/fonts", filename),
    path.join(process.cwd(), "fonts", filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Font not found. Tried: ${candidates.join(" | ")}`);
}

let _fonts = null;
function getFonts() {
  if (_fonts) return _fonts;
  _fonts = {
    Black:    fs.readFileSync(findFontPath("Lato-Black.ttf")),
    Bold:     fs.readFileSync(findFontPath("Lato-Bold.ttf")),
    Semibold: fs.readFileSync(findFontPath("Lato-Semibold.ttf")),
    Regular:  fs.readFileSync(findFontPath("Lato-Regular.ttf")),
  };
  return _fonts;
}

// Diagnostic helper: report what the function sees on disk
function fontDiagnostic() {
  const cwd = process.cwd();
  const tried = [
    path.join(__dirname, "fonts"),
    path.join(cwd, "api/fonts"),
    path.join(cwd, "fonts"),
  ];
  return tried.map((p) => ({
    path: p,
    exists: fs.existsSync(p),
    files: fs.existsSync(p) ? fs.readdirSync(p) : null,
  }));
}

// ===== Palette =====
const W = 1080;
const H = 1350;
const BLACK = "#0E0E0E";
const BLACK_SOFT = "#1C1816";
const CREAM = "#F2EBE0";
const CREAM_DIM = "#C8C0B4";
const ORANGE = "#F4541A";
const GRAY = "#8A857D";

// ===== SVG helpers =====
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgWrap(bg, inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${inner}
</svg>`;
}

// Map weight name -> numeric CSS weight (resvg matches font-family="Lato" + weight)
const WEIGHT_MAP = {
  Black: 900,
  Bold: 700,
  Semibold: 600,
  Regular: 400,
};

// Lato fonts may register with these family names depending on metadata.
// Provide a fallback chain so resvg picks whichever name it matches.
const FONT_FAMILY_CHAIN = '"Lato","Lato Black","Lato Bold","Arial","sans-serif"';

function text({ x, y, content, weight = "Black", size = 48, fill = CREAM, anchor = "start" }) {
  const w = WEIGHT_MAP[weight] || 400;
  return `<text x="${x}" y="${y}" font-family='${FONT_FAMILY_CHAIN}' font-weight="${w}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" dominant-baseline="text-before-edge">${esc(content)}</text>`;
}

function pageMark(num, total, onDark = true) {
  const color = onDark ? GRAY : BLACK_SOFT;
  return text({ x: 60, y: H - 60, content: `${num} / ${total}`, weight: "Semibold", size: 20, fill: color });
}

function brandMark(onDark = true) {
  // Two-tone wordmark, right-aligned at bottom right
  const griffinColor = onDark ? CREAM : BLACK;
  const creativeColor = onDark ? ORANGE : CREAM;
  const baseX = W - 60;
  return `
    <text x="${baseX - 100}" y="${H - 60}" font-family='${FONT_FAMILY_CHAIN}' font-weight="900" font-size="22" fill="${griffinColor}" text-anchor="end" dominant-baseline="text-before-edge">GRIFFIN</text>
    <text x="${baseX}" y="${H - 60}" font-family='${FONT_FAMILY_CHAIN}' font-weight="900" font-size="22" fill="${creativeColor}" text-anchor="end" dominant-baseline="text-before-edge">CREATIVE</text>`;
}

function eyebrow(label, color = ORANGE) {
  return text({ x: 60, y: 80, content: label, weight: "Black", size: 22, fill: color });
}

// ===== Slide builders =====
function slide1_hook(brief, slideIndex) {
  const s = (brief.slides && brief.slides.slide_1_hook) || {};
  const lines = s.headline_lines || [];
  const accent = s.accent_word || "";
  const eb = s.eyebrow || `CREATIVE TEARDOWN  N°${String(slideIndex).padStart(2, "0")}`;
  const sub = s.subhead || "";
  const ctaA = s.cta_pointer || "";

  const headlineSize = 96;
  const lineHeight = 110;
  let inner = eyebrow(`// ${eb}`);
  let y = 230;
  for (const line of lines) {
    const isAccent = accent && line.toUpperCase().includes(accent.toUpperCase());
    inner += text({
      x: 60, y, content: line.toUpperCase(),
      weight: "Black", size: headlineSize,
      fill: isAccent ? ORANGE : CREAM,
    });
    y += lineHeight;
  }
  y += 30;
  inner += text({ x: 60, y, content: sub, weight: "Regular", size: 38, fill: CREAM_DIM });

  // Bottom CTA pointer
  inner += text({ x: 60, y: H - 200, content: ctaA, weight: "Bold", size: 32, fill: ORANGE });

  inner += brandMark(true);
  inner += pageMark(slideIndex, 6, true);
  return svgWrap(BLACK, inner);
}

function slide2_pattern(brief, slideIndex) {
  const s = (brief.slides && brief.slides.slide_2_pattern) || {};
  const lines = s.headline_lines || ["EVERY AD LOOKS", "EXACTLY LIKE THIS:"];
  const callouts = s.callouts || [];

  let inner = eyebrow(`// ${s.eyebrow || "THE PATTERN"}`);
  let y = 180;
  for (const line of lines) {
    inner += text({ x: 60, y, content: line.toUpperCase(), weight: "Black", size: 72, fill: y === 180 ? CREAM : ORANGE });
    y += 82;
  }

  // 3 cards
  const cardY0 = 500;
  const cardH = 200;
  const cardGap = 24;
  callouts.slice(0, 3).forEach((c, i) => {
    const cy = cardY0 + i * (cardH + cardGap);
    inner += `<rect x="60" y="${cy}" width="${W - 120}" height="${cardH}" fill="${BLACK_SOFT}"/>`;
    inner += `<rect x="60" y="${cy}" width="14" height="${cardH}" fill="${ORANGE}"/>`;
    inner += text({ x: 110, y: cy + 22, content: `0${i + 1}`, weight: "Black", size: 30, fill: ORANGE });
    inner += text({ x: 110, y: cy + 70, content: (c.head || "").toUpperCase(), weight: "Black", size: 28, fill: CREAM });
    inner += text({ x: 110, y: cy + 130, content: c.sub || "", weight: "Regular", size: 24, fill: GRAY });
  });

  inner += brandMark(true);
  inner += pageMark(slideIndex, 6, true);
  return svgWrap(BLACK, inner);
}

function slide3_diagnosis(brief, slideIndex) {
  const s = (brief.slides && brief.slides.slide_3_diagnosis) || {};
  const lines = s.headline_lines || ["WHY THIS", "LEAKS MONEY."];
  const callouts = s.callouts || [];

  let inner = eyebrow(`// ${s.eyebrow || "DIAGNOSIS"}`, BLACK);
  let y = 180;
  inner += text({ x: 60, y, content: (lines[0] || "").toUpperCase(), weight: "Black", size: 84, fill: BLACK });
  inner += text({ x: 60, y: y + 92, content: (lines[1] || "").toUpperCase(), weight: "Black", size: 84, fill: CREAM });

  const calloutY0 = 540;
  callouts.slice(0, 3).forEach((c, i) => {
    const cy = calloutY0 + i * 200;
    inner += text({ x: 60, y: cy, content: c.num || `0${i + 1}`, weight: "Black", size: 44, fill: CREAM });
    inner += text({ x: 180, y: cy + 4, content: (c.head || "").toUpperCase(), weight: "Black", size: 32, fill: BLACK });
    // Body — manual word wrap to ~58 chars/line
    const body = c.body || "";
    const wrapped = wordWrap(body, 60);
    wrapped.forEach((wl, wi) => {
      inner += text({ x: 180, y: cy + 60 + wi * 32, content: wl, weight: "Regular", size: 22, fill: BLACK_SOFT });
    });
  });

  inner += brandMark(false);
  inner += pageMark(slideIndex, 6, false);
  return svgWrap(ORANGE, inner);
}

function slide4_fix(brief, slideIndex) {
  const s = (brief.slides && brief.slides.slide_4_fix) || {};
  const lines = s.headline_lines || ["4 ANGLES. SAME", "PRODUCT. 48 HOURS."];
  const angles = s.angles || [];

  let inner = eyebrow(`// ${s.eyebrow || "THE FIX"}`);
  let y = 180;
  inner += text({ x: 60, y, content: (lines[0] || "").toUpperCase(), weight: "Black", size: 72, fill: CREAM });
  inner += text({ x: 60, y: y + 82, content: (lines[1] || "").toUpperCase(), weight: "Black", size: 72, fill: ORANGE });

  // 2x2 grid of cards
  const cardW = (W - 60 * 2 - 30) / 2;
  const cardH = 340;
  const gridY0 = 500;
  angles.slice(0, 4).forEach((a, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 60 + col * (cardW + 30);
    const y2 = gridY0 + row * (cardH + 30);
    inner += `<rect x="${x}" y="${y2}" width="${cardW}" height="${cardH}" fill="${BLACK_SOFT}"/>`;
    inner += `<rect x="${x}" y="${y2}" width="${cardW}" height="8" fill="${ORANGE}"/>`;
    inner += text({ x: x + 28, y: y2 + 40, content: `0${i + 1}`, weight: "Black", size: 34, fill: ORANGE });
    inner += text({ x: x + 28, y: y2 + 105, content: (a.head || "").toUpperCase(), weight: "Black", size: 28, fill: CREAM });
    const wrapped = wordWrap(a.body || "", 22);
    wrapped.forEach((wl, wi) => {
      inner += text({ x: x + 28, y: y2 + 165 + wi * 28, content: wl, weight: "Regular", size: 19, fill: GRAY });
    });
  });

  inner += brandMark(true);
  inner += pageMark(slideIndex, 6, true);
  return svgWrap(BLACK, inner);
}

function slide5_math(brief, slideIndex) {
  const s = (brief.slides && brief.slides.slide_5_math) || {};
  const lines = s.headline_lines || ["WHAT THE GAP", "IS COSTING THEM."];
  const stats = s.stats || [];
  const rev = s.recovered_revenue_block || {};

  let inner = eyebrow(`// ${s.eyebrow || "THE MATH"}`);
  let y = 180;
  inner += text({ x: 60, y, content: (lines[0] || "").toUpperCase(), weight: "Black", size: 72, fill: CREAM });
  inner += text({ x: 60, y: y + 82, content: (lines[1] || "").toUpperCase(), weight: "Black", size: 72, fill: ORANGE });

  // Stat rows
  const sY0 = 500;
  stats.slice(0, 3).forEach((st, i) => {
    const sy = sY0 + i * 130;
    inner += text({ x: 60, y: sy, content: (st.label || "").toUpperCase(), weight: "Black", size: 22, fill: ORANGE });
    inner += text({ x: 60, y: sy + 36, content: st.big || "", weight: "Black", size: 62, fill: CREAM });
    inner += text({ x: 60, y: sy + 110, content: st.sub || "", weight: "Regular", size: 22, fill: GRAY });
  });

  // Big orange box at bottom
  const boxY = 980;
  inner += `<rect x="60" y="${boxY}" width="${W - 120}" height="200" fill="${ORANGE}"/>`;
  inner += text({ x: 90, y: boxY + 28, content: (rev.label || "RECOVERED REVENUE").toUpperCase(), weight: "Black", size: 22, fill: BLACK });
  inner += text({ x: 90, y: boxY + 65, content: rev.big || "", weight: "Black", size: 60, fill: CREAM });
  inner += text({ x: 90, y: boxY + 145, content: rev.sub || "", weight: "Regular", size: 26, fill: BLACK_SOFT });

  inner += brandMark(true);
  inner += pageMark(slideIndex, 6, true);
  return svgWrap(BLACK, inner);
}

function slide6_cta(brief, slideIndex) {
  const s = (brief.slides && brief.slides.slide_6_cta) || {};
  const lines = s.headline_lines || ["WE DO THIS", "FOR DTC BRANDS", "EVERY WEEK."];
  const subLines = s.sub_lines || [];
  const ctaBox = s.cta_box || { prefix: "DM US", main: '"AUDIT"' };
  const accent = s.accent_word || "EVERY WEEK.";

  let inner = eyebrow(`// ${s.eyebrow || "FREE TEARDOWN"}`);
  let y = 200;
  for (const line of lines) {
    const isAccent = accent && line.toUpperCase().includes(accent.toUpperCase().split(".")[0]);
    inner += text({ x: 60, y, content: line.toUpperCase(), weight: "Black", size: 88, fill: isAccent ? ORANGE : CREAM });
    y += 100;
  }
  y += 30;
  for (const ln of subLines) {
    inner += text({ x: 60, y, content: ln, weight: "Regular", size: 28, fill: CREAM_DIM });
    y += 40;
  }

  // CTA orange box
  const cBoxY = H - 360;
  inner += `<rect x="60" y="${cBoxY}" width="${W - 120}" height="180" fill="${ORANGE}"/>`;
  inner += text({ x: 90, y: cBoxY + 36, content: ctaBox.prefix || "DM US", weight: "Regular", size: 26, fill: BLACK });
  inner += text({ x: 90, y: cBoxY + 76, content: ctaBox.main || '"AUDIT"', weight: "Black", size: 76, fill: CREAM });

  inner += text({ x: 60, y: H - 130, content: "griffincreativelab.com", weight: "Black", size: 28, fill: CREAM });
  inner += pageMark(slideIndex, 6, true);
  return svgWrap(BLACK, inner);
}

// Simple word wrap — splits on spaces and groups into lines of approx N chars
function wordWrap(text, maxCharsPerLine) {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxCharsPerLine) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const SLIDE_BUILDERS = [slide1_hook, slide2_pattern, slide3_diagnosis, slide4_fix, slide5_math, slide6_cta];

// ===== Main handler =====
module.exports = async (req, res) => {
  const expectedKey = process.env.CONTENT_GEN_API_KEY;
  if (expectedKey && req.headers["x-api-key"] !== expectedKey) {
    return res.status(401).json({ error: "Invalid or missing x-api-key" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { row_id } = body;
    if (!row_id) return res.status(400).json({ error: "Missing row_id" });

    const sb = getSb();

    // Fetch the row
    const { data: row, error: fetchErr } = await sb
      .from("content_queue")
      .select("*")
      .eq("id", row_id)
      .single();
    if (fetchErr || !row) {
      return res.status(404).json({ error: "Row not found", detail: fetchErr?.message });
    }
    if (row.type !== "teardown_carousel") {
      return res.status(400).json({ error: "Row is not a teardown_carousel" });
    }

    // Parse the brief
    let brief;
    try {
      brief = JSON.parse(row.content);
    } catch (e) {
      return res.status(400).json({ error: "Failed to parse brief JSON: " + e.message });
    }
    if (brief._parse_error) {
      return res.status(400).json({ error: "Brief has earlier parse error", detail: brief._parse_error });
    }

    // Lazy-load resvg (ESM module — dynamic import)
    const resvgMod = await import("@resvg/resvg-js");
    const { Resvg } = resvgMod;

    // Load fonts with diagnostic on failure
    let fonts;
    try {
      fonts = getFonts();
    } catch (e) {
      return res.status(500).json({
        error: "Font load failed",
        detail: e.message,
        diagnostic: fontDiagnostic(),
      });
    }

    // Render each slide
    const uploadedUrls = [];
    for (let i = 0; i < SLIDE_BUILDERS.length; i++) {
      const builder = SLIDE_BUILDERS[i];
      const svgString = builder(brief, i + 1);

      const resvg = new Resvg(svgString, {
        font: {
          // Pass both buffers AND file paths to maximize match probability
          fontBuffers: [fonts.Black, fonts.Bold, fonts.Semibold, fonts.Regular],
          fontFiles: [
            findFontPath("Lato-Black.ttf"),
            findFontPath("Lato-Bold.ttf"),
            findFontPath("Lato-Semibold.ttf"),
            findFontPath("Lato-Regular.ttf"),
          ],
          defaultFontFamily: "Lato",
          loadSystemFonts: true, // allow fallback to system fonts as last resort
        },
        background: undefined,
        logLevel: "warn",
      });
      const pngData = resvg.render().asPng();

      // Upload to Supabase Storage
      const filename = `${row_id}/slide_${i + 1}.png`;
      const { error: uploadErr } = await sb.storage
        .from("content_assets")
        .upload(filename, pngData, {
          contentType: "image/png",
          upsert: true,
        });
      if (uploadErr) {
        return res.status(500).json({
          error: `Slide ${i + 1} upload failed`,
          detail: uploadErr.message,
        });
      }

      // Get public URL (bucket is public)
      const { data: pub } = sb.storage.from("content_assets").getPublicUrl(filename);
      uploadedUrls.push(pub.publicUrl);
    }

    // Update the row with media_urls
    const { error: updateErr } = await sb
      .from("content_queue")
      .update({
        media_urls: uploadedUrls,
        notes: `Rendered ${uploadedUrls.length} slides at ${new Date().toISOString()}`,
      })
      .eq("id", row_id);
    if (updateErr) {
      return res.status(500).json({ error: "Row update failed", detail: updateErr.message });
    }

    return res.status(200).json({
      success: true,
      row_id,
      slide_count: uploadedUrls.length,
      media_urls: uploadedUrls,
    });
  } catch (err) {
    console.error("render-teardown-slides error:", err);
    return res.status(500).json({ error: err.message });
  }
};
