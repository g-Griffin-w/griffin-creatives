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

## PART A — Finished statics (nano-banana → Bannerbear → Drive)

**Why two tools:** nano-banana generates the scene/background image; it CANNOT render clean headline text or guarantee exact crops. Bannerbear lays your headline/subhead/CTA over the image as real text and exports the 4 exact ratios. nano-banana = picture, Bannerbear = finished ad.

### A1. Set up Bannerbear (one-time, ~15 min)

1. Sign up at **bannerbear.com** → create a **Project**.
2. Create a **Template** at **1080×1080**. Add these layers and name them EXACTLY:
   - `bg_image` — image layer, full-bleed (this receives the nano-banana output)
   - `headline` — text layer
   - `subheadline` — text layer
   - `cta_button` — text layer (or a shape with a text layer on top)
   Style to brand: orange `#FF4D00`, black `#080808`, cream `#F0ECE3`; fonts Bebas Neue (headline) + DM Sans (body). Keep text inside safe zones.
3. **Duplicate** that template into 3 more sizes, keeping the **same layer names** in each:
   - `1080×1350` (4:5 — Meta mobile feed, highest CTR)
   - `1080×1920` (9:16 — Stories / Reels / TikTok)
   - `1200×628` (16:9 — Google Display / FB desktop)
4. Group all four into a **Template Set** (Bannerbear → Template Sets). One API call to the set renders all 4 sizes from one data payload. Note the **Template Set UID**.
5. Bannerbear → **Account → API Key**. Copy it.

### A2. Wire it into Scenario B (after the HTTP module #3)

1. **Iterator** module → Array: `{{3.data.deliverables.static_ads}}`
2. **nano-banana** (your existing fal.ai HTTP call) *inside the loop*:
   - `image_urls` = `{{3.signed_product_urls}}` (or the first element if it needs a single URL)
   - `prompt` = `{{Iterator.image_prompt}}`
   - Output = generated scene image URL (note the field name it returns)
3. **Bannerbear → Create Image from a Template Set** (add the Bannerbear connection with your API key):
   - Template Set UID = the one from A4
   - Modifications: `bg_image` (image_url) = nano-banana output URL; `headline` (text) = `{{Iterator.headline}}`; `subheadline` (text) = `{{Iterator.subheadline}}`; `cta_button` (text) = `{{Iterator.cta_button}}`
   - Bannerbear is async — add a small delay or use its "wait for completion" option / a webhook so you get the finished URLs.
4. **Google Drive → Upload a File** (×4, or loop the set's image array) into a `Static Ads` subfolder. Name them `{{Iterator.concept}}-1x1.png`, `-4x5.png`, `-9x16.png`, `-16x9.png`.

### A3. REMOVE
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
