// Vercel Serverless Function: POST /api/render-landing
//
// Turns a structured landing_page deliverable into a FINISHED, hosted landing
// page on griffincreativelab.com — no homework, no copy doc the client has to
// go build. Same philosophy as render-ad: our stack, $0, one HTTP call from Make.
//
// Flow: build branded responsive HTML from the copy + product image + brand
// accent -> store it in the Supabase `landing_pages` table -> return a live URL
// (/api/lp?c=<slug>) that Make drops into the client's folder/email.

const { createClient } = require("@supabase/supabase-js");

module.exports.config = { maxDuration: 30 };

let _sb = null;
function getSb() {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

function slugify(s) {
  return (String(s || "client")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "client");
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeHex(c, fallback) {
  if (typeof c === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim())) return c.trim();
  return fallback;
}

// ---------- HTML builder ----------
function buildLandingHtml({ business_name, accent, product_image_url, cta_url, lp }) {
  const valueProps = Array.isArray(lp.value_props) ? lp.value_props.slice(0, 3) : [];
  const faq = Array.isArray(lp.faq) ? lp.faq.slice(0, 6) : [];
  const heroImg = product_image_url
    ? `<img src="${esc(product_image_url)}" alt="${esc(business_name)}" style="max-width:100%;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,0.18);">`
    : "";

  const propsHtml = valueProps
    .map(
      (v) => `
      <div style="background:#fff;border:1px solid #eee;border-radius:14px;padding:28px;">
        <h3 style="margin:0 0 8px;font-size:19px;color:#111;">${esc(v.title || "")}</h3>
        <p style="margin:0;color:#555;font-size:15px;line-height:1.6;">${esc(v.body || "")}</p>
      </div>`
    )
    .join("");

  const faqHtml = faq
    .map(
      (f) => `
      <div style="border-bottom:1px solid #eee;padding:20px 0;">
        <h4 style="margin:0 0 6px;font-size:17px;color:#111;">${esc(f.q || "")}</h4>
        <p style="margin:0;color:#555;font-size:15px;line-height:1.6;">${esc(f.a || "")}</p>
      </div>`
    )
    .join("");

  const cta = esc(cta_url || "#");
  const btn = (label) =>
    `<a href="${cta}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:600;font-size:17px;padding:16px 40px;border-radius:8px;">${esc(label)}</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(lp.hero_headline || business_name)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;background:#fafafa;line-height:1.5}
  .wrap{max-width:1080px;margin:0 auto;padding:0 24px}
  .hero{display:grid;grid-template-columns:1.1fr 1fr;gap:48px;align-items:center;padding:80px 0}
  .eyebrow{color:${accent};font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:13px;margin-bottom:16px}
  h1{font-size:46px;line-height:1.08;margin-bottom:18px}
  .sub{font-size:19px;color:#555;margin-bottom:32px;max-width:520px}
  .section{padding:64px 0}
  .section h2{font-size:34px;margin-bottom:36px;text-align:center}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  .proof{background:${accent};color:#fff;text-align:center;padding:56px 24px;border-radius:18px}
  .proof p{font-size:22px;max-width:720px;margin:0 auto;line-height:1.5}
  .faq{max-width:760px;margin:0 auto}
  .close{text-align:center;padding:80px 0}
  .close h2{margin-bottom:18px}
  footer{text-align:center;padding:40px 0;color:#999;font-size:13px}
  @media(max-width:840px){.hero{grid-template-columns:1fr;padding:48px 0}h1{font-size:34px}.grid{grid-template-columns:1fr}.section h2{font-size:26px}}
</style>
</head>
<body>
  <section class="wrap hero">
    <div>
      <div class="eyebrow">${esc(business_name)}</div>
      <h1>${esc(lp.hero_headline || "")}</h1>
      <p class="sub">${esc(lp.hero_subhead || "")}</p>
      ${btn(lp.hero_cta || "Shop Now")}
    </div>
    <div>${heroImg}</div>
  </section>

  ${valueProps.length ? `<section class="wrap section"><div class="grid">${propsHtml}</div></section>` : ""}

  ${lp.social_proof ? `<section class="wrap section"><div class="proof"><p>"${esc(lp.social_proof)}"</p></div></section>` : ""}

  ${faq.length ? `<section class="wrap section"><h2>Questions, answered</h2><div class="faq">${faqHtml}</div></section>` : ""}

  <section class="wrap close">
    <h2>${esc(lp.closing_headline || "Ready to get started?")}</h2>
    ${btn(lp.closing_cta || lp.hero_cta || "Shop Now")}
  </section>

  <footer>© ${new Date().getFullYear()} ${esc(business_name)}</footer>
</body>
</html>`;
}

// ---------- Handler ----------
module.exports = async (req, res) => {
  const expectedKey = process.env.CONTENT_GEN_API_KEY;
  if (expectedKey && req.headers["x-api-key"] !== expectedKey) {
    return res.status(401).json({ error: "Invalid or missing x-api-key" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const {
      client_id = "client",
      business_name = "",
      accent_color,
      product_image_url = "",
      cta_url = "#",
      landing_page,
    } = body;

    const lp = typeof landing_page === "string" ? JSON.parse(landing_page) : landing_page;
    if (!lp || !lp.hero_headline) {
      return res.status(400).json({ error: "Missing landing_page data (need at least hero_headline)" });
    }

    const accent = sanitizeHex(accent_color, "#FF4D00");
    const html = buildLandingHtml({ business_name, accent, product_image_url, cta_url, lp });
    const slug = `${slugify(client_id)}-${Date.now().toString(36)}`;

    const sb = getSb();
    const { error } = await sb.from("landing_pages").insert({ slug, client: business_name, html });
    if (error) return res.status(500).json({ error: "Failed to store landing page", detail: error.message });

    const url = `https://www.griffincreativelab.com/api/lp?c=${slug}`;
    return res.status(200).json({ success: true, slug, url });
  } catch (err) {
    console.error("render-landing error:", err);
    return res.status(500).json({ error: err.message });
  }
};
module.exports.config = { maxDuration: 30 };
module.exports.buildLandingHtml = buildLandingHtml; // exported for local QA
