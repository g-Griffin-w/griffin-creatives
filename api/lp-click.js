// Vercel Serverless Function: GET /api/lp-click?c=<slug>
//
// Every CTA button on a hosted landing page (see render-landing.js) points
// here instead of straight at the client's site. Logs a first-party click
// event tagged to the concept that drove it, then redirects on to the real
// destination pulled from our own `landing_pages` row (never from a query
// param, so this can't be turned into an open redirect).

const { createClient } = require("@supabase/supabase-js");

let _sb = null;
function getSb() {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

module.exports = async (req, res) => {
  try {
    const slug = (req.query && req.query.c) || "";
    if (!slug) return res.status(400).send("Missing page id");

    const sb = getSb();
    const { data, error } = await sb
      .from("landing_pages")
      .select("cta_url, concept_id")
      .eq("slug", slug)
      .single();

    if (error || !data) return res.status(404).send("Page not found");

    const dest = data.cta_url || "https://www.griffincreativelab.com";

    sb.from("landing_page_events")
      .insert({ slug, concept_id: data.concept_id, event_type: "cta_click" })
      .then(({ error: logErr }) => {
        if (logErr) console.error("lp click log error:", logErr.message);
      });

    res.writeHead(302, { Location: dest });
    return res.end();
  } catch (err) {
    console.error("lp-click error:", err);
    return res.status(500).send("Something went wrong");
  }
};
module.exports.config = { maxDuration: 15 };
