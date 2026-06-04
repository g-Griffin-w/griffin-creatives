// Vercel Serverless Function: POST /api/get-upload-url
//
// Generates a signed upload URL for the onboarding form so clients can
// upload directly to Supabase Storage without exposing the service_role
// key in the browser.
//
// Files land at: client_assets/{client_uuid}/{folder}/{timestamped_filename}
// where {folder} is "products" or "brand".
//
// Required Vercel env vars:
//   SUPABASE_URL                 (https://gcatvqcntgizjsdoabva.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY    (from Supabase project settings — service_role, NOT anon)

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Must match the bucket's allowed_mime_types
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Must match the bucket's file_size_limit (25 MB)
const MAX_BYTES = 26214400;

const ALLOWED_FOLDERS = new Set(["products", "brand"]);

function sanitizeFilename(name) {
  // Strip path separators and unsafe chars; preserve extension; prefix timestamp to avoid collisions
  const cleaned = String(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const ts = Date.now();
  const dot = cleaned.lastIndexOf(".");
  if (dot === -1) return `${ts}_${cleaned}`;
  return `${ts}_${cleaned.substring(0, dot)}${cleaned.substring(dot)}`;
}

module.exports = async (req, res) => {
  // CORS — static site is served from same Vercel domain so this is permissive but safe
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { cid, fileName, mimeType, fileSize, folder } = body;

    // Input validation
    if (!cid || typeof cid !== "string") {
      return res.status(400).json({ error: "Missing or invalid cid" });
    }
    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({ error: "Missing or invalid fileName" });
    }
    if (!ALLOWED_FOLDERS.has(folder)) {
      return res.status(400).json({ error: 'Invalid folder. Use "products" or "brand".' });
    }
    if (!ALLOWED_MIME.has(mimeType)) {
      return res.status(400).json({
        error: "Unsupported file type. Use JPEG, PNG, WebP, or HEIC.",
      });
    }
    if (typeof fileSize === "number" && fileSize > MAX_BYTES) {
      return res.status(400).json({ error: "File too large. Max 25 MB." });
    }

    // Resolve internal client UUID from the stripe_customer_id (cid)
    const { data: client, error: clientErr } = await supabase
      .from("griffin_clients")
      .select("id")
      .eq("stripe_customer_id", cid)
      .single();

    if (clientErr || !client) {
      return res.status(404).json({ error: "Client not found for this cid." });
    }

    // Build the bucket path: {client_uuid}/{folder}/{safe_filename}
    const safeName = sanitizeFilename(fileName);
    const path = `${client.id}/${folder}/${safeName}`;

    // Generate a one-shot signed upload URL the browser can PUT to directly
    const { data: signed, error: signedErr } = await supabase.storage
      .from("client_assets")
      .createSignedUploadUrl(path);

    if (signedErr) {
      return res.status(500).json({
        error: "Failed to generate upload URL",
        detail: signedErr.message,
      });
    }

    return res.status(200).json({
      signedUrl: signed.signedUrl,
      token: signed.token,
      path: path,
    });
  } catch (err) {
    console.error("get-upload-url error:", err);
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
};
