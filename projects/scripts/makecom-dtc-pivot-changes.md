# Make.com Pipeline Changes for DTC Pivot

**Date:** May 27, 2026
**Why:** The generate-deliverables.js API now returns a different deliverable mix for DTC clients. Make.com Scenario B + Scenario C need updates to match. Without these changes, the pipeline will still RUN, but the docs created will reference old keys (`ad_copy`, `email_sequences`) that no longer exist in the API response.

---

## SUMMARY OF API RESPONSE CHANGES

**Old deliverable keys (contractor era):**
- `ad_copy`
- `email_sequences`
- `content_calendar`
- `visual_prompts` (Scale + Dominate)
- `video_prompts` (Scale + Dominate)
- `action_plan`

**New deliverable keys (DTC era):**
- `action_plan`
- `ad_hooks` ← was `ad_copy`
- `static_ads` ← was `visual_prompts`, now always included
- `ugc_briefs` ← NEW (replaces AI-voice video scripts)
- `email_flows` ← was `email_sequences`
- `content_calendar`
- `landing_page_copy` ← NEW (Scale + Dominate only)

**`voice_name` field:** Always returns `"DTC"` for DTC clients. Use this to skip the AI voiceover branch in Scenario C.

---

## SCENARIO B CHANGES (the main deliverables pipeline)

### 1. Google Docs Create — UPDATE existing modules

For each Google Docs creation module that was reading `{{HTTP.data.deliverables.ad_copy}}` etc., update to the new keys:

| Old field reference | New field reference |
|---|---|
| `{{HTTP.data.deliverables.ad_copy}}` | `{{HTTP.data.deliverables.ad_hooks}}` |
| `{{HTTP.data.deliverables.email_sequences}}` | `{{HTTP.data.deliverables.email_flows}}` |
| `{{HTTP.data.deliverables.content_calendar}}` | `{{HTTP.data.deliverables.content_calendar}}` (unchanged) |
| `{{HTTP.data.deliverables.action_plan}}` | `{{HTTP.data.deliverables.action_plan}}` (unchanged) |

**Also rename the Doc TITLES:**

| Old doc title | New doc title |
|---|---|
| `[CLIENT] — Ad Copy` | `[CLIENT] — Ad Hooks + Copy Variations` |
| `[CLIENT] — Email Sequences` | `[CLIENT] — Email Flows` |
| `[CLIENT] — Content Calendar` | `[CLIENT] — Content Calendar` (unchanged) |
| `[CLIENT] — Action Plan` | `[CLIENT] — 30-Day Deployment Plan` |

### 2. Google Docs Create — NEW modules to ADD

Add these new modules (clone an existing Google Docs Create module and edit):

- **`[CLIENT] — UGC Creator Briefs`** → reads `{{HTTP.data.deliverables.ugc_briefs}}`, saves into Ad Scripts subfolder
- **`[CLIENT] — Static Product Ad Concepts`** → reads `{{HTTP.data.deliverables.static_ads}}` (this is a JSON array — see formatting note below), saves into Static Visual Ads subfolder
- **`[CLIENT] — Landing Page Copy Variations`** → reads `{{HTTP.data.deliverables.landing_page_copy}}`, ONLY runs if plan is Scale or Dominate (add a filter)

### 3. Static Ads JSON formatting

`static_ads` is returned as a JSON array of objects (not a markdown string). For the Google Doc, format it like:

```
{{#each HTTP.data.deliverables.static_ads}}
CONCEPT: {{concept}}
ANGLE: {{angle}}
HEADLINE: {{headline}}
SUBHEADLINE: {{subheadline}}
CTA BUTTON: {{cta_button}}

IMAGE PROMPT FOR MIDJOURNEY/NANO-BANANA:
{{image_prompt}}

PRODUCTION NOTE: {{production_note}}

──────────────────────────

{{/each}}
```

If Make.com's Iterator module is easier to set up than `{{#each}}`, that works too — iterate over `static_ads`, then have a Google Docs append-text module inside the loop.

### 4. Delivery email (Gmail module)

Find the Gmail module that sends the "Your deliverables are ready" email. Rewrite the body to match DTC language:

**Subject (new):** `Your DTC creative pack is ready, [CLIENT_FIRST_NAME] 🚀`

**Body (new):**

```
Hi [CLIENT_FIRST_NAME],

Your first batch of creative is live in Google Drive — here's the link:

[DRIVE_FOLDER_LINK]

What's inside:
✓ 30-Day Deployment Plan (READ FIRST — tells you what to deploy week-by-week)
✓ Ad Hooks + Copy Variations (15-50 hooks ready to split-test on Meta + TikTok)
✓ Static Product Ad Concepts (12-40 fully-formed ad ideas with image prompts)
✓ UGC Creator Briefs (8-25 talking-head scripts for your creators or paid UGC)
✓ Email Flows (1-5 complete Klaviyo-ready flows: welcome, abandoned cart, post-purchase, etc.)
✓ 30-Day Content Calendar (daily organic posts for IG + TikTok)
[ONLY FOR SCALE/DOMINATE:] ✓ Landing Page Copy Variations (4-8 split-test variations)

START WITH THE 30-DAY DEPLOYMENT PLAN. It's the roadmap. Don't try to deploy everything at once.

Need help, want a revision, or have questions? Just reply to this email — we respond within 24 hours.

Talk soon,
Gabriel
GriffinCreative
griffincreativelab.com
```

### 5. Voice routing — DEACTIVATE the AI voiceover branch for DTC

The original Scenario C used `voice_name` to route between Sarah and Charlie Creatomate templates with ElevenLabs voiceover. For DTC, the API now always returns `voice_name = "DTC"`.

**Add a filter at the top of Scenario C:**
- Condition: `{{voice_name}}` equals `DTC`
- Action: Stop scenario (do not run the voiceover/Creatomate branch)

This is the SAFEST option for first DTC client. UGC scripts are delivered as text in Scenario B. Scenario C only runs for non-DTC legacy clients (which won't happen with the new niche focus).

**ALTERNATIVE (optional, for later):** Repurpose Scenario C as a "motion graphics ad" producer — same Creatomate template but NO voiceover. Just animated text + product imagery. This is a "Tier 2" enhancement, not needed for first paying client.

---

## SCENARIO B FLOW — UPDATED ORDER OF MODULES

For reference, the full Scenario B flow should now look like:

1. Trigger: Supabase Watch Records (onboarding_complete = true, new record)
2. HTTP POST → `https://griffincreativelab.com/api/generate-deliverables`
3. Google Drive Create Folder (named `[CLIENT_NAME] — Month [N]`)
4. Google Drive Update Folder Access (anyone with link = reader)
5. Google Drive Create Subfolder × 5:
   - Action Plan
   - Ad Hooks + Copy
   - Static Product Ads
   - UGC Creator Briefs
   - Email Flows
   - Content Calendar
   - (Scale/Dominate only) Landing Page Copy
6. Google Docs Create × N (one per deliverable, using the field references above)
7. Google Drive Update Folder Access on each subfolder (anyone = reader)
8. Gmail Send Email (the delivery email above, with Drive folder link)

**Then:** filter — if `voice_name = "DTC"` → end scenario. If anything else (legacy) → continue to Scenario C webhook handoff.

---

## TESTING CHECKLIST AFTER MAKING THESE CHANGES

Before letting a real client hit the pipeline:

1. **Trigger a fake onboarding submission in Supabase** (insert a test record with `onboarding_complete = true`, `plan = 'launch'`, sample brand data including `product_image_urls`).
2. **Watch the Make.com execution log** — confirm:
   - HTTP call to /api/generate-deliverables returns 200
   - All 6 (or 7 for Scale/Dominate) Google Docs created
   - All Drive folders + subfolders created with public-read access
   - Delivery email sent with correct link
3. **Open the Drive folder yourself** — read each Doc. Are they good enough to send to a paying client? If not, tune the prompts in /api/generate-deliverables.js and redeploy.
4. **Delete the test client record** from Supabase + the test Drive folder when done.

---

## ROLLBACK PLAN

If something breaks after the Scenario B changes:
1. Disable the Make.com scenario.
2. Revert /api/generate-deliverables.js to the previous commit on GitHub (`git revert HEAD` then `git push`).
3. Vercel auto-redeploys the old version within 60 seconds.
4. Re-enable the Make.com scenario (it'll work with the old keys again).

Don't change Make.com WITHOUT having the API code change already deployed — otherwise you'll have a window where the pipeline returns errors.

**Safe deploy order:**
1. ✅ Push new generate-deliverables.js to GitHub (already done as of May 27)
2. Wait for Vercel deploy (~60 sec)
3. THEN make Make.com changes
4. THEN trigger a test record
5. THEN verify, THEN re-enable for production triggers

---

## QUESTIONS / EDGE CASES

- **What if a client doesn't upload product photos?** API still runs but image_prompt fields will say "describe the product photographically" — output is usable but less brand-tailored. Onboarding form should make product photo upload visually prominent so this doesn't happen.
- **What if a legacy contractor client (already paying) submits a new monthly onboarding form?** They'll get DTC-styled deliverables which won't fit their business. Manually grandfather them with the old prompts OR (better) pause their subscription and offer a refund + transition to a different vendor.
- **What if Claude returns a malformed `static_ads` JSON?** The parser will return `{_parse_error, _raw}` — the Doc will look weird. Worth adding a Make.com error branch that emails you if `static_ads._parse_error` is truthy.
