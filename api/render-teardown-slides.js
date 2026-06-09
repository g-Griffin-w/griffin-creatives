// Vercel Serverless Function: POST /api/render-teardown-slides
//
// PHASE 3 — Renders 6 PNG slides from a teardown_carousel row's brief JSON.
// Uses Satori (Vercel's image lib) for JSX → SVG with Buffer-loaded fonts,
// then resvg for SVG → PNG. Uploads each PNG to Supabase, updates row.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

module.exports.config = { maxDuration: 60 };

// ---------- Lazy clients ----------
let _sb = null;
function getSb() {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

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

// ---------- Palette ----------
const W = 1080;
const H = 1350;
const BLACK = "#0E0E0E";
const BLACK_SOFT = "#1C1816";
const CREAM = "#F2EBE0";
const CREAM_DIM = "#C8C0B4";
const ORANGE = "#F4541A";
const GRAY = "#8A857D";

// ---------- JSX-without-build helper ----------
function h(type, props, ...children) {
  return {
    type,
    props: {
      ...(props || {}),
      children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children,
    },
  };
}

// ---------- Layout primitives ----------
function eyebrow(text, color = ORANGE) {
  return h("div", {
    style: { fontSize: 22, fontWeight: 900, color, letterSpacing: 1, marginBottom: 80 },
  }, `// ${text}`);
}

function brandMark(onDark = true) {
  const griffinColor = onDark ? CREAM : BLACK;
  const creativeColor = onDark ? ORANGE : CREAM;
  return h("div", {
    style: {
      position: "absolute",
      bottom: 56,
      right: 60,
      display: "flex",
      fontSize: 22,
      fontWeight: 900,
      letterSpacing: 1,
    },
  },
    h("span", { style: { color: griffinColor } }, "GRIFFIN"),
    h("span", { style: { color: creativeColor, marginLeft: 6 } }, "CREATIVE"),
  );
}

function pageNumber(num, total, onDark = true) {
  return h("div", {
    style: {
      position: "absolute",
      bottom: 56,
      left: 60,
      fontSize: 20,
      fontWeight: 600,
      color: onDark ? GRAY : BLACK_SOFT,
    },
  }, `${num} / ${total}`);
}

function slideBase(bg, ...children) {
  return h("div", {
    style: {
      width: W,
      height: H,
      backgroundColor: bg,
      display: "flex",
      flexDirection: "column",
      padding: 60,
      position: "relative",
      color: CREAM,
    },
  }, ...children);
}

// ---------- Slide 1: Hook ----------
function slide1Hook(brief, idx) {
  const s = brief.slides?.slide_1_hook || {};
  const eb = s.eyebrow || `CREATIVE TEARDOWN  N°${String(idx).padStart(2, "0")}`;
  const lines = (s.headline_lines || []).map((l) => String(l).toUpperCase());
  const accent = (s.accent_word || "").toUpperCase();
  const sub = s.subhead || "";
  const cta = s.cta_pointer || "";

  return slideBase(BLACK,
    eyebrow(eb, ORANGE),
    h("div", { style: { display: "flex", flexDirection: "column", marginTop: 80 } },
      ...lines.map((line) => h("div", {
        style: {
          fontSize: 92,
          fontWeight: 900,
          color: accent && line.includes(accent) ? ORANGE : CREAM,
          lineHeight: 1.05,
          marginBottom: 8,
        },
      }, line)),
    ),
    h("div", {
      style: { fontSize: 36, fontWeight: 400, color: CREAM_DIM, marginTop: 40, lineHeight: 1.3 },
    }, sub),
    h("div", {
      style: { position: "absolute", bottom: 180, left: 60, fontSize: 30, fontWeight: 700, color: ORANGE, lineHeight: 1.25 },
    }, cta),
    brandMark(true),
    pageNumber(idx, 6, true),
  );
}

// ---------- Slide 2: Pattern ----------
function slide2Pattern(brief, idx) {
  const s = brief.slides?.slide_2_pattern || {};
  const eb = s.eyebrow || "THE PATTERN";
  const lines = (s.headline_lines || ["EVERY AD LOOKS", "EXACTLY LIKE THIS:"]).map((l) => l.toUpperCase());
  const callouts = (s.callouts || []).slice(0, 3);

  return slideBase(BLACK,
    eyebrow(eb, ORANGE),
    h("div", { style: { display: "flex", flexDirection: "column" } },
      h("div", { style: { fontSize: 72, fontWeight: 900, color: CREAM, lineHeight: 1.05 } }, lines[0] || ""),
      h("div", { style: { fontSize: 72, fontWeight: 900, color: ORANGE, lineHeight: 1.05 } }, lines[1] || ""),
    ),
    h("div", { style: { display: "flex", flexDirection: "column", marginTop: 80, gap: 20 } },
      ...callouts.map((c, i) =>
        h("div", {
          style: {
            display: "flex",
            backgroundColor: BLACK_SOFT,
            padding: "24px 30px",
            borderLeft: `12px solid ${ORANGE}`,
          },
        },
          h("div", { style: { display: "flex", flexDirection: "column" } },
            h("div", { style: { fontSize: 28, fontWeight: 900, color: ORANGE } }, `0${i + 1}`),
            h("div", { style: { fontSize: 28, fontWeight: 900, color: CREAM, marginTop: 12 } }, (c.head || "").toUpperCase()),
            h("div", { style: { fontSize: 22, fontWeight: 400, color: GRAY, marginTop: 8 } }, c.sub || ""),
          ),
        ),
      ),
    ),
    brandMark(true),
    pageNumber(idx, 6, true),
  );
}

// ---------- Slide 3: Diagnosis (orange BG) ----------
function slide3Diagnosis(brief, idx) {
  const s = brief.slides?.slide_3_diagnosis || {};
  const eb = s.eyebrow || "DIAGNOSIS";
  const lines = (s.headline_lines || ["WHY THIS", "LEAKS MONEY."]).map((l) => l.toUpperCase());
  const callouts = (s.callouts || []).slice(0, 3);

  return slideBase(ORANGE,
    eyebrow(eb, BLACK),
    h("div", { style: { display: "flex", flexDirection: "column" } },
      h("div", { style: { fontSize: 80, fontWeight: 900, color: BLACK, lineHeight: 1.05 } }, lines[0] || ""),
      h("div", { style: { fontSize: 80, fontWeight: 900, color: CREAM, lineHeight: 1.05 } }, lines[1] || ""),
    ),
    h("div", { style: { display: "flex", flexDirection: "column", marginTop: 80, gap: 28 } },
      ...callouts.map((c, i) =>
        h("div", { style: { display: "flex" } },
          h("div", { style: { fontSize: 42, fontWeight: 900, color: CREAM, marginRight: 28, width: 80 } }, c.num || `0${i + 1}`),
          h("div", { style: { display: "flex", flexDirection: "column", flex: 1 } },
            h("div", { style: { fontSize: 30, fontWeight: 900, color: BLACK } }, (c.head || "").toUpperCase()),
            h("div", { style: { fontSize: 22, fontWeight: 400, color: BLACK_SOFT, marginTop: 8, lineHeight: 1.35 } }, c.body || ""),
          ),
        ),
      ),
    ),
    brandMark(false),
    pageNumber(idx, 6, false),
  );
}

// ---------- Slide 4: The Fix (2x2 grid) ----------
function slide4Fix(brief, idx) {
  const s = brief.slides?.slide_4_fix || {};
  const eb = s.eyebrow || "THE FIX";
  const lines = (s.headline_lines || ["4 ANGLES. SAME", "PRODUCT. 48 HOURS."]).map((l) => l.toUpperCase());
  const angles = (s.angles || []).slice(0, 4);

  return slideBase(BLACK,
    eyebrow(eb, ORANGE),
    h("div", { style: { display: "flex", flexDirection: "column" } },
      h("div", { style: { fontSize: 68, fontWeight: 900, color: CREAM, lineHeight: 1.05 } }, lines[0] || ""),
      h("div", { style: { fontSize: 68, fontWeight: 900, color: ORANGE, lineHeight: 1.05 } }, lines[1] || ""),
    ),
    h("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        marginTop: 60,
        gap: 24,
      },
    },
      ...angles.map((a, i) =>
        h("div", {
          style: {
            display: "flex",
            flexDirection: "column",
            width: 462,
            height: 300,
            backgroundColor: BLACK_SOFT,
            padding: "28px 28px",
            borderTop: `6px solid ${ORANGE}`,
          },
        },
          h("div", { style: { fontSize: 30, fontWeight: 900, color: ORANGE } }, `0${i + 1}`),
          h("div", { style: { fontSize: 26, fontWeight: 900, color: CREAM, marginTop: 18 } }, (a.head || "").toUpperCase()),
          h("div", { style: { fontSize: 19, fontWeight: 400, color: GRAY, marginTop: 12, lineHeight: 1.4 } }, a.body || ""),
        ),
      ),
    ),
    brandMark(true),
    pageNumber(idx, 6, true),
  );
}

// ---------- Slide 5: The Math ----------
function slide5Math(brief, idx) {
  const s = brief.slides?.slide_5_math || {};
  const eb = s.eyebrow || "THE MATH";
  const lines = (s.headline_lines || ["WHAT THE GAP", "IS COSTING THEM."]).map((l) => l.toUpperCase());
  const stats = (s.stats || []).slice(0, 3);
  const rev = s.recovered_revenue_block || {};

  return slideBase(BLACK,
    eyebrow(eb, ORANGE),
    h("div", { style: { display: "flex", flexDirection: "column" } },
      h("div", { style: { fontSize: 68, fontWeight: 900, color: CREAM, lineHeight: 1.05 } }, lines[0] || ""),
      h("div", { style: { fontSize: 68, fontWeight: 900, color: ORANGE, lineHeight: 1.05 } }, lines[1] || ""),
    ),
    h("div", { style: { display: "flex", flexDirection: "column", marginTop: 50, gap: 28 } },
      ...stats.map((st) =>
        h("div", { style: { display: "flex", flexDirection: "column" } },
          h("div", { style: { fontSize: 20, fontWeight: 900, color: ORANGE, letterSpacing: 1 } }, (st.label || "").toUpperCase()),
          h("div", { style: { display: "flex", alignItems: "baseline", marginTop: 6 } },
            h("div", { style: { fontSize: 58, fontWeight: 900, color: CREAM } }, st.big || ""),
            h("div", { style: { fontSize: 22, fontWeight: 400, color: GRAY, marginLeft: 18 } }, st.sub || ""),
          ),
        ),
      ),
    ),
    h("div", {
      style: {
        position: "absolute",
        bottom: 130, left: 60, right: 60,
        backgroundColor: ORANGE,
        padding: "26px 30px",
        display: "flex",
        flexDirection: "column",
      },
    },
      h("div", { style: { fontSize: 20, fontWeight: 900, color: BLACK, letterSpacing: 1 } }, (rev.label || "RECOVERED REVENUE").toUpperCase()),
      h("div", { style: { fontSize: 56, fontWeight: 900, color: CREAM, marginTop: 6 } }, rev.big || ""),
      h("div", { style: { fontSize: 24, fontWeight: 400, color: BLACK_SOFT, marginTop: 6 } }, rev.sub || ""),
    ),
    brandMark(true),
    pageNumber(idx, 6, true),
  );
}

// ---------- Slide 6: CTA ----------
function slide6CTA(brief, idx) {
  const s = brief.slides?.slide_6_cta || {};
  const eb = s.eyebrow || "FREE TEARDOWN";
  const lines = (s.headline_lines || ["WE DO THIS", "FOR DTC BRANDS", "EVERY WEEK."]).map((l) => l.toUpperCase());
  const accent = (s.accent_word || "EVERY WEEK.").toUpperCase();
  const subLines = s.sub_lines || [];
  const ctaBox = s.cta_box || { prefix: "DM US", main: '"AUDIT"' };

  return slideBase(BLACK,
    eyebrow(eb, ORANGE),
    h("div", { style: { display: "flex", flexDirection: "column", marginTop: 40 } },
      ...lines.map((line) => h("div", {
        style: {
          fontSize: 86,
          fontWeight: 900,
          color: accent && line.includes(accent.split(".")[0]) ? ORANGE : CREAM,
          lineHeight: 1.05,
          marginBottom: 8,
        },
      }, line)),
    ),
    h("div", { style: { display: "flex", flexDirection: "column", marginTop: 40, gap: 6 } },
      ...subLines.map((ln) => h("div", { style: { fontSize: 28, fontWeight: 400, color: CREAM_DIM } }, ln)),
    ),
    h("div", {
      style: {
        position: "absolute",
        bottom: 200, left: 60, right: 60,
        backgroundColor: ORANGE,
        padding: "30px 30px",
        display: "flex",
        flexDirection: "column",
      },
    },
      h("div", { style: { fontSize: 24, fontWeight: 400, color: BLACK, letterSpacing: 1 } }, ctaBox.prefix || "DM US"),
      h("div", { style: { fontSize: 70, fontWeight: 900, color: CREAM, marginTop: 6 } }, ctaBox.main || '"AUDIT"'),
    ),
    h("div", {
      style: { position: "absolute", bottom: 120, left: 60, fontSize: 28, fontWeight: 900, color: CREAM },
    }, "griffincreativelab.com"),
    pageNumber(idx, 6, true),
  );
}

const SLIDES = [slide1Hook, slide2Pattern, slide3Diagnosis, slide4Fix, slide5Math, slide6CTA];

// ---------- Satori + resvg render ----------
async function renderSlideToPng(jsxNode) {
  const satoriMod = await import("satori");
  const satori = satoriMod.default || satoriMod;
  const fonts = getFonts();

  const svg = await satori(jsxNode, {
    width: W,
    height: H,
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

// ---------- Main handler ----------
module.exports = async (req, res) => {
  const expectedKey = process.env.CONTENT_GEN_API_KEY;
  if (expectedKey && req.headers["x-api-key"] !== expectedKey) {
    return res.status(401).json({ error: "Invalid or missing x-api-key" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { row_id } = body;
    if (!row_id) return res.status(400).json({ error: "Missing row_id" });

    const sb = getSb();
    const { data: row, error: fetchErr } = await sb.from("content_queue").select("*").eq("id", row_id).single();
    if (fetchErr || !row) return res.status(404).json({ error: "Row not found", detail: fetchErr?.message });
    if (row.type !== "teardown_carousel") return res.status(400).json({ error: "Row is not a teardown_carousel" });

    let brief;
    try { brief = JSON.parse(row.content); }
    catch (e) { return res.status(400).json({ error: "Failed to parse brief JSON: " + e.message }); }
    if (brief._parse_error) return res.status(400).json({ error: "Brief had earlier parse error", detail: brief._parse_error });

    const uploadedUrls = [];
    for (let i = 0; i < SLIDES.length; i++) {
      const builder = SLIDES[i];
      const jsx = builder(brief, i + 1);
      const png = await renderSlideToPng(jsx);

      const filename = `${row_id}/slide_${i + 1}.png`;
      const { error: uploadErr } = await sb.storage.from("content_assets").upload(filename, png, {
        contentType: "image/png",
        upsert: true,
      });
      if (uploadErr) return res.status(500).json({ error: `Slide ${i + 1} upload failed`, detail: uploadErr.message });

      const { data: pub } = sb.storage.from("content_assets").getPublicUrl(filename);
      uploadedUrls.push(pub.publicUrl);
    }

    await sb.from("content_queue").update({
      media_urls: uploadedUrls,
      notes: `Rendered ${uploadedUrls.length} slides at ${new Date().toISOString()}`,
    }).eq("id", row_id);

    return res.status(200).json({
      success: true,
      row_id,
      slide_count: uploadedUrls.length,
      media_urls: uploadedUrls,
      // Pre-shaped for Make.com's Instagram for Business module which expects
      // each file as { image_url, media_type } — note image_url, not url.
      files: uploadedUrls.map((u) => ({ image_url: u, media_type: "IMAGE" })),
    });
  } catch (err) {
    console.error("render-teardown-slides error:", err);
    return res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5).join("\n") });
  }
};
