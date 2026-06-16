# Make.com DTC Pivot — Step-by-Step Walkthrough

**Time to complete:** 25-40 minutes (depending on Make.com responsiveness)
**Risk level:** Low if you follow this in order — Make.com has clone/backup so we'll back up before editing.

---

## 🧰 PRE-FLIGHT — open these tabs

1. **Make.com** → log in → navigate to your team workspace
2. **Supabase** → SQL editor (you'll need it for the test step)
3. **This document** open on a second monitor or phone — you'll reference it the whole way through

---

## ✋ BEFORE YOU TOUCH ANYTHING — backup Scenario B + C

In Make.com, for both Scenario B AND Scenario C:

1. Open the scenario
2. Click the **`⋯`** (three dots) menu, top right
3. Click **"Export Blueprint"** → saves a JSON file to your downloads
4. Rename the files: `scenario-b-backup-2026-05-28.json` and `scenario-c-backup-2026-05-28.json`
5. Stash them somewhere safe (Drive, Desktop, doesn't matter — just keep them)

**If anything breaks, "Import Blueprint" restores the scenario exactly as it was.** This is your undo button.

---

## 🔄 FIELD REFERENCE CHEAT SHEET (memorize this)

Anywhere in Scenario B you see these OLD field references, replace with the NEW ones:

| Old (delete) | New (use this) |
|---|---|
| `{{HTTP.data.deliverables.ad_copy}}` | `{{HTTP.data.deliverables.ad_hooks}}` |
| `{{HTTP.data.deliverables.email_sequences}}` | `{{HTTP.data.deliverables.email_flows}}` |
| `{{HTTP.data.deliverables.visual_prompts}}` | `{{HTTP.data.deliverables.static_ads}}` (now JSON array — see Part 3) |
| `{{HTTP.data.deliverables.video_prompts}}` | DELETE — replaced by `ugc_briefs` (text) |
| `{{HTTP.data.deliverables.content_calendar}}` | **(unchanged)** |
| `{{HTTP.data.deliverables.action_plan}}` | **(unchanged)** |

**New fields that didn't exist before:**
- `{{HTTP.data.deliverables.ugc_briefs}}` (text)
- `{{HTTP.data.deliverables.landing_page_copy}}` (text, only present for Scale + Dominate plans)

**`voice_name` now always returns `"DTC"`** — used as the kill-switch for Scenario C.

---

## PART 1 — Update existing Google Docs modules in Scenario B

Open Scenario B. Find every **Google Docs > Create a Document** module. There are probably 3-5 of them (Ad Copy, Email Sequences, Content Calendar, Action Plan, possibly more).

**For EACH existing Google Docs module, do this:**

1. **Click the module** to open its config panel
2. **Update the Document Title field** — rename per the table below
3. **Update the Document Content field** — replace any old `{{HTTP.data.deliverables.X}}` reference with the new one (see cheat sheet above)
4. **Click `OK`** to save the module
5. Move to the next module

| Module purpose | Old title | New title | New content reference |
|---|---|---|---|
| Ad Copy doc | `[CLIENT] — Ad Copy` | `[CLIENT] — Ad Hooks + Copy Variations` | `{{HTTP.data.deliverables.ad_hooks}}` |
| Email Sequences doc | `[CLIENT] — Email Sequences` | `[CLIENT] — Email Flows` | `{{HTTP.data.deliverables.email_flows}}` |
| Content Calendar doc | `[CLIENT] — Content Calendar` | `[CLIENT] — Content Calendar` (unchanged) | `{{HTTP.data.deliverables.content_calendar}}` (unchanged) |
| Action Plan doc | `[CLIENT] — Action Plan` | `[CLIENT] — 30-Day Deployment Plan` | `{{HTTP.data.deliverables.action_plan}}` (unchanged) |
| Visual Prompts doc (if exists) | `[CLIENT] — Visual Ads` | DELETE this module — we'll replace with the new Static Ads module in Part 2 |
| Video Prompts doc (if exists) | `[CLIENT] — Video Scripts` | DELETE this module — we'll replace with the new UGC Briefs module in Part 2 |

**Notes:**
- The `[CLIENT]` placeholder should be your existing mapping for the client name — usually `{{HTTP.data.client}}` or `{{1.business_name}}` depending on how you wired it. Don't change that part, just the words around it.
- DELETE a module by right-clicking it → "Delete module". You may need to reconnect the modules on either side of it (Make.com will prompt you).

---

## PART 2 — Add 3 NEW Google Docs modules

You need to ADD modules for these deliverables that didn't exist before:

1. **UGC Creator Briefs** doc
2. **Static Product Ad Concepts** doc
3. **Landing Page Copy Variations** doc (only for Scale + Dominate plans)

**For each:**

1. **Right-click an existing Google Docs module** (one you didn't delete) → "Clone module" — this is the easiest way; it pre-fills the connection and target folder
2. **Move the cloned module** into the right place in the flow (after the Drive subfolder it should land in)
3. **Update the Document Title and Content** per the table below

### Module A: UGC Creator Briefs

- **Place after:** the "Create Ad Scripts subfolder" module (same parent folder as ad hooks)
- **Title:** `[CLIENT] — UGC Creator Briefs`
- **Content:** `{{HTTP.data.deliverables.ugc_briefs}}`
- **Folder:** Use the Ad Scripts subfolder ID (same as ad_hooks doc) — these are both "ad script" type deliverables

### Module B: Static Product Ad Concepts

This one is **trickier** because `static_ads` is returned as a **JSON array**, not plain text.

- **Place after:** the "Create Static Visual Ads subfolder" module
- **Title:** `[CLIENT] — Static Product Ad Concepts`
- **Content:** Use the format below — Make.com has an Iterator-like syntax for arrays:

```
{{#each HTTP.data.deliverables.static_ads}}
CONCEPT {{@index}}: {{concept}}
ANGLE: {{angle}}
HEADLINE: {{headline}}
SUBHEADLINE: {{subheadline}}
CTA BUTTON: {{cta_button}}

IMAGE PROMPT FOR MIDJOURNEY / NANO-BANANA:
{{image_prompt}}

PRODUCTION NOTE: {{production_note}}

──────────────────────────────────────

{{/each}}
```

**If `{{#each}}` syntax doesn't work in your Make.com Google Docs module** (it depends on which version of the Google Docs integration is installed), do this instead:

- Insert an **Iterator** module before the Google Docs module
- Configure the Iterator with: `Array: {{HTTP.data.deliverables.static_ads}}`
- Then in the Google Docs module's content, reference fields as: `{{Iterator.concept}}`, `{{Iterator.headline}}`, etc.
- This will create ONE doc PER concept — alternatively, use a **Text Aggregator** module between the Iterator and Google Docs to concatenate all concepts into one doc

The simplest backup option: paste the raw JSON into the doc. Not pretty but works:
- **Content:** `{{HTTP.data.deliverables.static_ads}}`

### Module C: Landing Page Copy Variations (Scale + Dominate ONLY)

- **Place after:** Create a new "Landing Page Copy" subfolder (or just put it in the Ad Scripts folder if you don't want to make a new subfolder)
- **Title:** `[CLIENT] — Landing Page Copy Variations`
- **Content:** `{{HTTP.data.deliverables.landing_page_copy}}`
- **Add a filter on this module:** Click the wrench between the previous module and this one → Set up filter:
  - Condition: `{{HTTP.data.plan}}` equals `scale` OR `dominate`
  - This skips the module for Launch tier (which doesn't include landing page copy)

---

## PART 3 — Update the Gmail delivery email

Find the **Gmail > Send an Email** module at the end of Scenario B. Click to open.

### Update the Subject line:

**Old (likely):** `Your deliverables are ready` or similar
**New:** `Your DTC creative pack is ready, {{first_name}} 🚀`

(Use whatever variable your scenario uses for first name — probably `{{1.full_name}}` split, or `{{HTTP.data.client}}`, depending on wiring)

### Update the Email Body:

Replace the entire body with this:

```
Hi {{first_name}},

Your first batch of creative is live in Google Drive — here's the link:

{{drive_folder_link}}

What's inside:
✓ 30-Day Deployment Plan (READ THIS FIRST — tells you what to deploy week-by-week)
✓ Ad Hooks + Copy Variations (15-50 hooks ready to split-test on Meta + TikTok)
✓ Static Product Ad Concepts (12-40 fully-formed ad ideas with image prompts)
✓ UGC Creator Briefs (8-25 talking-head scripts for your creators or paid UGC actors)
✓ Email Flows (1-5 complete Klaviyo-ready flows: welcome, abandoned cart, post-purchase, etc.)
✓ 30-Day Content Calendar (daily organic posts for IG + TikTok)
✓ Landing Page Copy Variations (Scale & Dominate only — 4-8 split-test variations)

START WITH THE 30-DAY DEPLOYMENT PLAN. It's the roadmap. Don't try to deploy everything at once.

Need help, want a revision, or have questions? Reply to this email — we respond within 24 hours.

Talk soon,
Gabriel
GriffinCreative
griffincreativelab.com
```

Replace `{{first_name}}` and `{{drive_folder_link}}` with the actual Make.com variable references your scenario uses.

---

## PART 4 — Scenario C (the AI video pipeline)

Scenario C currently uses ElevenLabs + Creatomate to make AI-voiceover videos. For DTC clients, AI voiceover KILLS UGC authenticity, so we need to skip this branch for DTC.

**Easiest fix (recommended):** Pause Scenario C entirely.

1. Open Scenario C
2. Click the **`OFF`** toggle in the top right to deactivate the scenario
3. Done

**Why this is safe:** The new generate-deliverables.js API always returns `voice_name = "DTC"` for clients now. There's no longer a code path that hands data to Scenario C anyway. Pausing it just removes a dead pipeline.

**If you want to keep Scenario C alive for future** (e.g., a non-DTC client comes in someday):

1. Open Scenario C
2. Click the **filter (wrench icon)** between the trigger module and the first action module
3. Add a filter condition:
   - **Label:** "Skip DTC clients (no AI voiceover for UGC)"
   - **Condition:** `{{voice_name}}` does not equal `DTC`
4. Save

This makes Scenario C only run if voice_name is something other than "DTC" — which won't happen with the current API, so it's effectively paused but won't break if you ever flip a switch back.

---

## PART 5 — End-to-end test

After everything in Parts 1-4 is saved, time to confirm the pipeline works.

### Step 1: Insert a test client row in Supabase

Open Supabase → SQL Editor → paste and run:

```sql
INSERT INTO griffin_clients (
  full_name,
  email,
  business_name,
  stripe_customer_id,
  plan,
  business_type,
  target_audience,
  ad_goals,
  brand_voice,
  notes,
  promos,
  shopify_url,
  product_image_urls,
  brand_asset_urls,
  monthly_ad_spend,
  top_performing_ad_url,
  website,
  website_display,
  subscription_status,
  onboarding_complete
) VALUES (
  'Test DTC Founder',
  'gabriel.wigginton04@gmail.com',
  'Test Glow Skincare',
  'cus_test_dtc_20260528',
  'launch',
  'Beauty / Skincare',
  'Women 28-45 dealing with hormonal acne, willing to spend $30-60 on premium skincare, follow beauty content on TikTok and IG',
  'Vitamin C serum + free shipping over $50',
  'Warm & Approachable',
  'This is a test record for the DTC pivot pipeline validation. Delete after verifying delivery.',
  '20% off first order\nFree shipping over $50\nSubscribe & save 15%',
  'https://example.com',
  'https://drive.google.com/drive/folders/test-product-photos',
  'Hex colors: #FF4D00, #080808, #F0ECE3',
  '$1K–5K/mo',
  '',
  'https://example.com',
  'https://example.com',
  'active',
  true
)
RETURNING id, business_name, plan, onboarding_complete;
```

You'll get back the inserted row ID. **Note that ID — you'll need it for cleanup in Step 4.**

### Step 2: Watch Scenario B fire

Switch to Make.com → open Scenario B → click the **History** tab (top of the canvas).

Within 30-90 seconds you should see a new execution appear. Click it to see the run breakdown.

**What to look for:**
- ✅ HTTP module returns 200 status with `success: true` and `deliverables` object
- ✅ All Google Docs modules execute successfully (no red errors)
- ✅ Gmail module sends the delivery email
- ✅ Drive folder is created with the test client's name

**If a module errors:**
- Click the error → read what field reference failed
- Compare against the cheat sheet in this doc
- Fix the field reference, save, then re-run the failed execution (Make.com has a "Run again from here" option)

### Step 3: Verify the Drive folder

1. Open the delivery email (will go to `gabriel.wigginton04@gmail.com` per the test row)
2. Click the Drive folder link
3. Open EACH doc and verify content is present (not empty):
   - 30-Day Deployment Plan ✅
   - Ad Hooks + Copy Variations ✅
   - Static Product Ad Concepts ✅
   - UGC Creator Briefs ✅
   - Email Flows ✅
   - Content Calendar ✅
   - Landing Page Copy Variations — **SHOULD BE MISSING since plan='launch'** (the filter skipped it)

### Step 4: Cleanup

Once verified, delete the test data so it doesn't clutter your real clients table:

```sql
-- Delete the test client row
DELETE FROM griffin_clients WHERE stripe_customer_id = 'cus_test_dtc_20260528';
```

Manually delete the test Drive folder from Google Drive (don't leave it sitting there for a real client to accidentally see).

---

## 🛠️ ROLLBACK PLAN — if something breaks badly

If after Part 5 the pipeline is producing garbage and you can't figure out why:

1. In Make.com → open Scenario B → click `⋯` → "Import Blueprint" → upload `scenario-b-backup-2026-05-28.json` → confirm
2. Repeat for Scenario C if you changed it
3. Pipeline restored to pre-edit state
4. Revert `api/generate-deliverables.js` on GitHub: `cd ~/griffin-creatives && git revert HEAD && git push`
5. Vercel auto-redeploys old version in ~60 sec
6. Try the changes again with fresher eyes (maybe with me on co-founder call)

---

## ✅ SIGN-OFF CHECKLIST

After Part 5 passes cleanly:

- [ ] Scenario B saved (no red dots on any module)
- [ ] Scenario C paused OR has the `voice_name ≠ DTC` filter
- [ ] Test execution ran successfully end-to-end
- [ ] Drive folder created with all 6 (Launch) or 7 (Scale/Dominate) docs
- [ ] Delivery email arrived with correct content
- [ ] Test client row deleted from Supabase
- [ ] Test Drive folder deleted from Google Drive

**When all 7 boxes are checked → you are ready for your first paying DTC client.**

---

## 🆘 IF YOU GET STUCK

Reply to me with:
1. Which Part you're on
2. The specific error message OR a screenshot of the failing module
3. Whether the test execution ran at all

I can debug specific module errors way faster than I can predict every possible issue. Don't spend more than 10 minutes stuck on one thing — flag it and we'll figure it out together.

Good luck. Send me the test result when done.
