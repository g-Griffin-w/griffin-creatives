# Make.com Finished-Assets Buildout

**Goal:** Turn Scenario B from *text docs* → *finished assets*: static PNGs in 4 ratios + finished captioned videos. Ready-to-upload, no homework.

**Scope for this pass:** Statics + Video only. Klaviyo-designed emails and hosted landing pages are a later layer — don't wire them now or you'll ship four half-built branches.

**Delivery cadence:** Still the monthly batch. Weekly delivery is a separate layer (deliveries table + cron) — do it after finished assets are proven.

---

## ✋ BEFORE ANYTHING — back up Scenario B

Open Scenario B → `⋯` (top right) → **Export Blueprint** → save as `scenario-b-backup-2026-06-09.json`. That's your undo button. If a branch breaks, `Import Blueprint` restores it exactly.

---

## FIELD REFERENCE — what the API now returns

The HTTP module (#3, `POST /api/generate-deliverables`) returns these under `{{3.data.deliverables.X}}`:

| Field | Shape | Use |
|---|---|---|
| `static_ads` | JSON **array** | Iterate → render finished PNGs (Part A) |
| `video_scripts` | JSON **array** (NEW) | Iterate → finished captioned videos (Part B) |
| `ad_hooks` | text | keep as text doc |
| `email_flows` | text | keep as text doc (designed-email layer is later) |
| `content_calendar` | text | keep / demote |
| `action_plan` | text | demote to quiet "strategy notes", not the hero |
| `landing_page_copy` | text (scale/dominate) | keep as text for now |
| `ugc_briefs` | text | keep — this is the *human* creator brief (Billo path) |

Also at the top level: `{{3.data.signed_product_urls}}` — array of signed URLs to the client's uploaded product photos, for nano-banana img2img.

### `static_ads` object fields
`concept`, `angle`, `headline`, `subheadline`, `cta_button`, `image_prompt`, `production_note`

### `video_scripts` object fields (NEW)
`concept`, `angle`, `hook`, `scenes[]` (each: `visual`, `caption`, `duration_sec`), `cta_text`, `music_mood`, `voiceover_optional`

---

## PART A — Finished statics (nano-banana → /api/render-ad → Drive)

**No Bannerbear, no monthly cost.** We render statics on the existing Vercel/Node stack via `api/render-ad.js` (Satori + resvg — same engine as the teardown slides). nano-banana makes the scene image; `/api/render-ad` overlays the headline/subhead/CTA as real text and exports all 4 ratios. Verified live in production.

### The endpoint
`POST https://www.griffincreativelab.com/api/render-ad` (use **www** — the apex domain redirects and drops the POST body)
Header: `x-api-key: <CONTENT_GEN_API_KEY>`
Body:
```json
{
  "image_url": "<nano-banana scene image URL>",
  "headline": "...",
  "subheadline": "...",
  "cta_button": "...",
  "concept": "concept name (used in filename)",
  "client_id": "client id (namespaces the storage path)"
}
```
Returns `{ success, files: [{ ratio, url } x4], urls: [...] }` — 4 finished PNGs already uploaded to Supabase public storage. No new env vars; reuses `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `CONTENT_GEN_API_KEY`, and the `content_assets` bucket.

### Wire it into Scenario B (after the HTTP module #3)

1. **Iterator** → Array: `{{3.data.deliverables.static_ads}}`
2. **nano-banana** (your existing fal.ai HTTP call) *inside the loop*:
   - `image_urls` = `{{3.signed_product_urls}}` (or its first element if it wants one)
   - `prompt` = `{{Iterator.image_prompt}}`
   - Output = generated scene image URL (note the field name it returns)
3. **HTTP → Make a request** to the render endpoint:
   - Method `POST`, URL `https://www.griffincreativelab.com/api/render-ad`
   - Header `x-api-key: <CONTENT_GEN_API_KEY>`
   - Body type Raw / JSON:
     ```
     {
       "image_url": "{{<nano-banana output URL>}}",
       "headline": "{{Iterator.headline}}",
       "subheadline": "{{Iterator.subheadline}}",
       "cta_button": "{{Iterator.cta_button}}",
       "concept": "{{Iterator.concept}}",
       "client_id": "{{3.data.client}}"
     }
     ```
   - Parse response = Yes → you now have `files[].url` (4 finished PNG URLs)
4. **Iterator** over the response `files` (or `urls`) → **Google Drive → Upload a File** into a `Static Ads` subfolder. Drive can take the URL, or add an HTTP "Get a file" before it to fetch the binary.

### REMOVE
- The old **"Static Product Ad Concepts" Google Doc** module — it prints `image_prompt` to the client (homework). Keep `static_ads` ONLY as the Iterator's input; never deliver the prompt doc.

---

## PART B — Finished videos (captions-first)

**First, inspect your current Kling branch.** Open the scenario with the Kling modules and check:
1. Is there an **Iterator** before the Kling module? (yes = it loops; no = one video per run)
2. Click the **Kling** module → what does its prompt field reference? A plain field like `{{3.data.deliverables.ugc_briefs}}` = single; an iterator output like `{{5.x}}` = loops.
3. Note the module **before** Kling and what array it's bound to.

### B1. Wire video generation
1. **Iterator** → Array: `{{3.data.deliverables.video_scripts}}`
2. **Kling** per script. v1 (simplest): concatenate the scene visuals into one prompt and generate one clip per script. (v2 later: nested-iterate `scenes[]`, one Kling clip per scene, then stitch.)
3. Map Kling prompt from `{{Iterator.visual}}` (or concatenated scenes), aspect ratio 9:16 primary.

### B2. CAPTION BURN-IN — the non-negotiable step
~97% of feed views are sound-off. After Kling returns the video, overlay the captions:
- Source text: `{{Iterator.hook}}` (opening) + each `scenes[].caption` + `{{Iterator.cta_text}}` end card.
- Tool: **Captions.ai API**, **SubMagic**, or **Creatomate** (you already had Creatomate in Scenario C — repurpose it as the overlay/end-card engine).
- Without this step the video is silent garbage in-feed. Do not skip.

### B3. ElevenLabs — make it OPTIONAL
Voiceover over an AI video is not UGC and is muted in-feed anyway. Either:
- **Remove** the ElevenLabs module, OR
- Gate it: add a **filter** before it → run only when `{{Iterator.voiceover_optional}}` **is not empty**.
Never let voiceover be the only audio/text layer.

### B4. Deliver
Google Drive → Upload the finished mp4(s) to a `Video Ads` subfolder.

---

## PART C — Rewrite the Gmail delivery email

Kill every line that says "concepts", "image prompts", or "we don't deliver finished video". New body:

```
Hi {{first_name}},

Your creative is live in Google Drive — finished and ready to upload:

{{drive_folder_link}}

What's inside:
✓ Static ads — designed, with copy on the image, in all 4 placement ratios (1:1, 4:5, 9:16, 16:9). Upload straight to Ads Manager.
✓ Video ads — finished short-form videos with captions burned in and a CTA card. Ready to run on Meta + TikTok.
✓ Ad hooks + copy variations for ongoing tests
✓ Email flows (Klaviyo-ready)
✓ Content calendar

Drop them into your campaigns and test. Reply any time — we respond within 24 hours and tune next month's batch to what's winning.

Talk soon,
Gabriel
GriffinCreative
griffincreativelab.com
```

Set Gmail content type = **HTML** if you want the styled button.

---

## PART D — leave alone
- Scenario C stays **OFF** (its Creatomate can be reused for the Part B caption/end-card step).
- Stripe billing, Supabase, Drive delivery, 48hr first-delivery promise — unchanged.

---

## Sign-off checklist
- [ ] Scenario B blueprint backed up
- [ ] Bannerbear template set (4 ratios, matching layer names) built + connected
- [ ] Statics branch: Iterator → nano-banana → Bannerbear → Drive, finished PNGs land
- [ ] Old "Static Ad Concepts" doc module removed
- [ ] Video branch: Iterator → Kling → caption burn-in → Drive
- [ ] ElevenLabs removed or gated on `voiceover_optional`
- [ ] Gmail body rewritten (no "concepts"/"prompts")
- [ ] End-to-end test row run; folder has finished PNGs + captioned video
