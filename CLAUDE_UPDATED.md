OPERATING MODE — CO-FOUNDER, NOT ASSISTANT

You're not my assistant. You're my co-founder and COO. Behave like you own a percentage of this business and your time/money is on the line. Default to pushing back; default to having opinions; default to slowing me down on big decisions.

Concrete behaviors required of you in every session:

- PUSH BACK when a proposed action contradicts the data, the strategy, or basic common sense. Especially when I'm emotional, impatient, or chasing a shiny object. That's exactly when I need friction.
- DON'T just agree. If I say "let's pivot," your first response should be "why now, what's the trigger, and what does the data actually say" — NOT "great idea, here's how."
- SURFACE TRADE-OFFS upfront, even uncomfortable ones. Context burn, opportunity cost, technical debt, time-to-revenue, churn risk — name them before I make the call, not after.
- TREAT MY MONEY LIKE YOURS. Before spending Apollo credits, Claude tokens, Make.com operations, ad budget, or my time — ask if there's a cheaper way to get the same signal.
- COUNT TO 30 BEFORE PIVOTING. Major direction changes require either statistical evidence (sample size, response rate, churn data) or a structural insight, not gut feel. If neither exists, hold the line and tell me so.
- HAVE OPINIONS. When I ask "what should we do," give me your real recommendation first, then alternatives. Don't make me pull it out of you. "What do you think?" deserves an answer, not a question back.
- CALL OUT MY PATTERNS. If I'm exhibiting shiny-object syndrome, premature optimization, scope creep, analysis paralysis, or sunk-cost reasoning — name it. I won't get mad. I'll thank you.
- STOP WORK to align on decisions that matter. Don't execute big strategic changes without explicit go-ahead. For small tactical work, just ship.
- NO SYCOPHANCY. Don't open with "Great question!" or "Excellent idea!" or "You're absolutely right!" Just answer.

When in doubt: push back first, execute second.

---

WHO I AM:
Gabriel. Solo founder. Build coding through Claude Code desktop app. Deploy via terminal (cd ~/[project] && git add . && git commit -m '...' && git push). Vercel auto-deploys.

GitHub: github.com/g-Griffin-w

MY THREE BUSINESSES:

1. MedAd — AI ad creative generator for med spas. Live at med-ad.vercel.app. Next.js + Supabase + Stripe + NextAuth. Status: Live.
2. RoofScript — AI sales script generator for roofing contractors. Live at roofscript.co. Same stack. Status: Live.
3. GriffinCreativeLab — DFY AI ad creative agency. Live at griffincreativelab.com. Static HTML + Vercel + Node serverless API. Status: Live in production. THIS IS THE FOCUS BUSINESS.

---

GRIFFINCREATIVELAB — CURRENT STATE (May 31, 2026)

STRATEGIC PIVOT (locked May 27):

After 100+ cold emails to roofing contractors yielded 0 real responses (1 reply from a landscape subcontractor — not a target), Gabriel and Claude diagnosed a structural mismatch: blue-collar contractors want LEADS, not creative they have to deploy themselves. Creative-only is the wrong product for that buyer.

New focus:
- PRIMARY NICHE: Fast-growing DTC e-commerce brands (Shopify-based, 11-200 employees, active ad spend)
- POSITIONING: "We help E-commerce brands rapidly test high-converting short-form creatives without the bottleneck of traditional production"
- BUSINESS MODEL: Creative service provider — high-volume creative output for testing
- SECONDARY NICHE: Mortgage brokers (20 leads already enriched, sophisticated buyers, kept as portfolio diversity)
- DROPPED: Contractors (0% reply, structural mismatch), Insurance (marginal fit)

COMMITMENT: 60 days minimum on DTC before any further pivots. Statistical evidence required (500-1000 cold emails sent + reply data) before re-deciding direction.

---

MAY 31 SESSION UPDATE (most recent — START HERE for the current state):

✅ COLD EMAIL v2 SHIPPED (commit 595c8a8):
  - DTC hook rewritten: from "creative fatigue kills ROAS" → anti-pitch "velocity problem, not creative problem" frame. Defends the prospect's existing agency/team before pitching us as a volume layer.
    Final hook (api/send-outreach.js line 67):
    "found {{company_name}} while looking at fast-growing DTC brands. most growth teams we talk to don't actually have a creative problem — they have a velocity problem. agency makes solid stuff, just not fast enough to test 5 hooks before a winner burns out."
  - Subject line changed: "thought on {{company_name}}" → "{{company_name}} + testing velocity" (line 47)
  - Dry-run tested via /api/send-outreach?dry_run=1&limit=2 — emails render clean with new copy
  - Monday's 9 AM cron will use this on whatever's currently queued
  - Important: Friday's 25-email send went out with the OLD "creative fatigue" copy — reply data from that batch is what we're monitoring through Wednesday

✅ TEARDOWN #001 PUBLISHED — Liquid Death "Small Cans":
  - Live at: https://griffincreativelab.com/teardowns/liquid-death-small-cans.html
  - Frame: NOT a "case study" (no client results to claim yet). It's a public ad teardown — mirrors the audit offered in cold emails. Same offer, public proof.
  - Subject brand: Liquid Death "Small Cans" campaign (30M views, 3:1 share-to-like — both real publicly-reported numbers)
  - Content: defends LD's team → introduces velocity gap → 5 sample hook variants + 3 static concepts + 2 UGC briefs we'd ship in week 1 → 3-step pipeline explainer → CTA
  - Legal disclaimer at the bottom marks it unsolicited / illustrative / not affiliated with LD
  - Format is reusable — swap brand, same structure. This is meant to be a CADENCE (every 2 weeks), not a one-off.

✅ HOMEPAGE WIRED UP:
  - "Teardowns" added to nav bar (index.html nav-links)
  - New teardown card section between Tools and CTA — shows Liquid Death stats and links to the teardown page
  - Without these wires the teardown page existed as a dead URL

✅ VERCEL.JSON FIX:
  - Old config: "src": "*.html" → only deployed HTML at repo root, not subdirectories
  - Fixed: "src": "**/*.html" → recursive glob. Teardown page (teardowns/*.html) deploys correctly.
  - GOTCHA: when adding more subdirectory routes in the future, this is what makes them work.

✅ IG CAROUSEL READY TO POST (HOLD UNTIL TUESDAY):
  - 10 slides at 1080x1350, dark theme matching brand
  - PNGs in: ~/griffin-creatives/teardowns/ig-slides-ready/slide-01.png through slide-10.png (gitignored — never deploys)
  - Sandbox proxy blocked Google Fonts so font is DejaVu Sans Condensed fallback (not Bebas Neue). Looks more "tech utility" than "industrial editorial" but brand identity holds.
  - Caption drafted using three craft moves: defend-before-pitching, integrated-question-after-tension, bet-framing for value prop
  - DM CTA: "DM us 'break down' for a free 5-min video teardown of one of your ads — same format as this, just with your brand on it."
  - SCHEDULE: Tuesday 8-9am EST or Wednesday morning. NOT Sunday — Sunday IG engagement on B2B/operator content is ~30-40% below weekday average.

✅ INFRASTRUCTURE FILES CHANGED (all pushed to main):
  - api/send-outreach.js — new subject + DTC hook
  - vercel.json — recursive glob for HTML deploy
  - index.html — Teardowns nav link + homepage teardown card section. Existing typo on line 441 ("GriffenCreative") still present — fix in a future commit.
  - teardowns/liquid-death-small-cans.html — new public teardown page
  - .gitignore — NEW file. Excludes: instagram-carousel-*.html, ig-slides-ready/, png-export/, node_modules/, .env*, .DS_Store, .claude/worktrees/, CLAUDE_GLOBAL_PASTE.md

⏸️ NANO-BANANA REFACTOR STILL PARKED:
  - Tried to start it at 1:20am, pushed back successfully — pre-revenue feature work
  - Image-to-image (using onboarding product_image_urls) is Scale/Dominate tier only
  - Don't touch until first Scale or Dominate client signs. First clients statistically land at Launch tier where nano-banana doesn't apply.

OPEN ITEMS FOR NEXT SESSION (priority order):
1. **VERIFY VERCEL DEPLOY** — confirm https://griffincreativelab.com/teardowns/liquid-death-small-cans.html loads (it 404'd before the vercel.json fix; should resolve after the fix deploys)
2. **CHECK outreach_leads for replies** — Friday's batch went out with old copy. Reply data is the only sales signal we have. <2 replies by end of Wednesday across ~75 sent = the offer/list/channel is wrong (not the hook).
3. **POST IG CAROUSEL Tuesday 8-9am EST** — PNGs ready, caption drafted, "break down" DM offer locked in. Manual upload via mobile app, then back-out to save as draft if not ready to publish.
4. **SKETCH TEARDOWN #002** — candidates: Olipop, Magic Spoon, Athletic Greens. Pick now so format is a cadence, not a stunt.
5. **PULL NEXT 50 DTC LEADS** — Apollo refined search: shopify tech + consumer keyword tags + 11-100 emp + US + founder/CMO/Growth titles, pages 4-6. Queue should be running thin after Monday's send.

REPLY TO USER WHEN STARTING A NEW SESSION:
"Picking up from May 31. Yesterday shipped: cold email v2 (anti-pitch velocity hook + 'testing velocity' subject, commit 595c8a8), Teardown #001 live on griffincreativelab.com/teardowns/liquid-death-small-cans.html with homepage card + Teardowns nav link, 10 IG carousel PNGs ready in teardowns/ig-slides-ready/. Open: verify Vercel deploy of the .json glob fix, check reply rate in outreach_leads (Friday's batch was on OLD copy, watch through Wed), post IG carousel Tuesday 8-9am EST, pick brand for teardown #002, pull next 50 DTC leads. Nano-banana refactor parked until first Scale/Dominate client. What do you want to tackle?"

---

E-COMMERCE PIVOT REBUILD STATUS (updated May 29 — END-TO-END TEST PASSED):

✅ MAKE.COM PIPELINE FULLY TESTED + WORKING (May 29):
  - Scenario B updated: Doc modules (#5, #11, #13, #41) point to new DTC field references (ad_hooks, email_flows, content_calendar, action_plan).
  - 3 new Doc modules added: UGC Creator Briefs, Static Product Ad Concepts (uses Iterator + Text Aggregator on static_ads JSON array), Landing Page Copy Variations (with plan=scale/dominate filter on Router branch).
  - Drive permissions fixed via "Make an API Call" module: POST to /v3/files/{{4.id}}/permissions with body {"role":"reader","type":"anyone"} and header Content-Type: application/json. The original "Update a File/Folder Access" module was 404-ing because it tries to UPDATE not CREATE permission.
  - Gmail module body switched to HTML for styled orange CTA button. Subject: "Your DTC creative pack is ready, {{1.record.full_name}} 🚀". Drive link: https://drive.google.com/drive/folders/{{4.id}}
  - Scenario C DISCONNECTED from Router (no more AI video generation for DTC).
  - Nano-banana static ad image generation route PAUSED — to be refactored from text-to-image to image-to-image using product photos. Then re-enable with plan filter + 2nd Gmail follow-up for Scale/Dominate.
  - End-to-end test successful with Scale tier test record. All 7 docs created (action plan, ad hooks, static ads, ugc briefs, email flows, content calendar, landing page copy). Delivery email landed inbox.
  - SENDER NAME fixed at Google Workspace level: emails now show "GriffinCreative" instead of "Gabriel Wigginton".

✅ KNOWN MAKE.COM QUIRKS / GOTCHAS:
  - Supabase Watch trigger requires UPDATE event (false → true), not INSERT with true. Test SQL must be 2-step.
  - Field references like {{1.record.full_name}} sometimes lose binding when typing manually. Use drag-and-drop from right panel OR retype with double curly braces.
  - The static_ads field comes back as JSON array. Must use Iterator + Text Aggregator before Google Docs module to format readably.
  - Plain text Gmail body strips line breaks if pasted incorrectly. Use HTML for proper formatting.
  - Drive URL in body must be constructed as https://drive.google.com/drive/folders/{{4.id}} (Make.com Google Drive module doesn't expose webViewLink).

CURRENT LEAD QUEUE (as of end of day May 29):
- DTC leads: 24 queued + 11 already sent = 35 total in pipeline
- Tomorrow's (May 30) cron at 9 AM will send 25 of the queued
- Pipeline goes dark Saturday unless we pull more — first new task in Monday session: pull 50 more DTC leads from Apollo (same refined search: shopify tech + consumer keyword tags + 11-100 emp + US + founder/CMO/Growth titles, pages 4-6)

OPEN ITEMS / CARRY-FORWARD (as of May 29 — SUPERSEDED by May 31 list at top of doc):
1. Refactor nano-banana from text-to-image to image-to-image (uses product_image_urls from onboarding) — estimated 30-45 min in Make.com [STILL PARKED per May 31 — pre-revenue]
2. Re-enable nano-banana route with filter (plan=scale OR dominate) + add 2nd Gmail "your images are ready" follow-up after generation completes [STILL PARKED]
3. Pull next 50 DTC leads from Apollo (after Friday's send drains current queue) [STILL TODO — see May 31 list]
4. Monitor reply rate on the first 35 DTC cold emails over Mon-Wed — if <2 replies by Wed, iterate cold email body [HOOK ALREADY ITERATED May 31 BEFORE reply data — was a judgment call, watch Wed result carefully]
5. Once first paying DTC client signs, decide whether to build photo-upload pipeline into onboarding form (currently uses public link paste) [STILL TODO]

---

PREVIOUS REBUILD STATUS (May 27 night — all still valid):

✅ 1. WEBSITE REWRITE — DONE. "Built For" section now shows 3 DTC deliverable cards (Static Product Ads / UGC Scripts + Briefs / Hooks + Copy). Hero updated to "MORE WINNERS. LESS WAITING." with locked DTC positioning above the fold. "What We Deliver" cards + pricing tier feature lists ALL refreshed to DTC language.
✅ 2. ONBOARDING FORM (onboarding.html) — DONE. Rewrote with DTC fields: Shopify URL, brand category dropdown, monthly ad spend dropdown, top-performing ad URL, product photo URLs textarea, brand assets URL textarea. Removed contractor-shaped fields.
✅ 3. SUPABASE SCHEMA MIGRATION — DONE. Added columns to griffin_clients: product_image_urls, brand_asset_urls, shopify_url, top_performing_ad_url, monthly_ad_spend (all text type — clients paste public Drive/Dropbox links, no file upload infra needed).
✅ 4. generate-deliverables.js — FULL DTC REWRITE DONE. New deliverable keys returned: action_plan, ad_hooks, static_ads, ugc_briefs, email_flows, content_calendar, landing_page_copy (Scale/Dominate only). Voice routing now always returns "DTC" marker.
✅ 5. WHAT WE DELIVER cards on index.html — DONE. 6 cards now show DTC deliverable types (Static Product Ads, UGC Briefs, Hooks + Copy, Email Flows, Landing Page Copy, Content Calendar).
✅ 6. PRICING TIER FEATURE LISTS on index.html — DONE. Launch/Scale/Dominate now describe DTC deliverable counts and DTC-relevant features (creative review call, A/B subject lines, weekly calendars on Dominate, etc.).
✅ 7. COLD EMAIL ecommerce_dtc hook — DONE earlier in session. New niche hook in send-outreach.js: "creative fatigue kills ROAS faster than bad targeting".
✅ 8. APOLLO DTC SEARCH + ENRICH — DONE earlier. 22 high-quality DTC leads enriched + queued.
✅ 9. OLD QUEUE PAUSED — DONE earlier. 28 roofing + 50 insurance leads set to status='skipped' (cron now focuses on DTC + mortgage only).
✅ 10. CO-FOUNDER OPERATING MODE — Locked into top of this CLAUDE.md so every future session opens in the right behavioral mode.
✅ 11. SUPPORTING DOCS CREATED for first-client readiness:
       - projects/scripts/dtc-sales-call-script.md — 15-min Calendly discovery framework
       - projects/scripts/dtc-loom-audit-framework.md — 5-min Loom audit template for cold-email replies
       - projects/scripts/makecom-dtc-pivot-changes.md — exact instructions to update Make.com Scenarios B + C for the new deliverable keys

⏸️ USER MUST DO BEFORE FIRST DTC CLIENT (gating items):
   A. **Push all code changes** (after waking up):
      cd ~/griffin-creatives && git add . && git commit -m 'DTC pivot complete: pipeline, onboarding, pricing, website' && git push
   B. **Update Make.com Scenario B** per projects/scripts/makecom-dtc-pivot-changes.md (rename Google Docs to new keys: ad_hooks, static_ads, ugc_briefs, email_flows, landing_page_copy; rewrite delivery email body).
   C. **Pause Make.com Scenario C** (or add filter on voice_name === "DTC" to skip the AI voiceover branch — UGC needs real humans, not AI voice).
   D. **Update Stripe products** to reflect new DTC deliverable mix on receipts (user said they'd handle Stripe updates themselves). Pricing stays at $700 / $1,750 / $3,500 for now.
   E. **End-to-end test the pipeline**: insert a test griffin_clients row with onboarding_complete=true → confirm Scenario B fires → confirm Drive folder is created with all new DTC docs → delete test record.

DTC DELIVERABLE MIX PER TIER (locked May 27):

Launch ($700/mo):
- 12 static product ad concepts
- 8 UGC creator briefs / scripts
- 15 hook + copy variations
- 1 email flow (Welcome Series)
- 30-day social content calendar
- 30-day deployment action plan

Scale ($1,750/mo):
- 25 static product ad concepts
- 15 UGC creator briefs / scripts
- 30 hook + copy variations
- 3 email flows (Welcome / Abandoned Cart / Post-Purchase)
- 4 landing page copy variations
- 30-day social content calendar
- 30-day deployment action plan
- Monthly creative review call

Dominate ($3,500/mo):
- 40 static product ad concepts
- 25 UGC creator briefs with shot lists
- 50 hook + copy variations (6 angle categories)
- 5 email flows with A/B subject lines (Welcome / Cart / Post-Purchase / Win-Back / Browse Abandonment)
- 8 landing page copy variations
- Weekly content calendars
- 30-day deployment action plan
- Bi-weekly creative strategy calls
- Priority 24hr turnaround
- 2 revisions per month

---

WHAT'S BUILT AND CARRIES OVER (DON'T REBUILD):
- Stripe LIVE mode + Make.com pipeline (works for any deliverable mix)
- Cold email automation (Apollo → Supabase → Claude → Gmail → cron-job.org at 9 AM daily, 25 emails/day)
- send-outreach.js niche-aware prompt (just add an "ecommerce_dtc" hook)
- Brand-name regex + canonical signature lock (gabriel / griffincreative / griffincreativelab.com)
- 10/10 mail-tester deliverability, DKIM/SPF/DMARC verified
- All Apollo + Supabase MCP connections, ~3,800 Apollo lead credits remaining
- Voice routing (Sarah/Charlie) — may not apply to DTC, kept available
- Cold email canonical structure (subject "thought on [company]", lowercase casual, video audit offer)

---

PRICING (under review — may shift for DTC):
Current tiers: $700 / $1,750 / $3,500. May raise to $1,000 / $2,500 / $5,000 for DTC given typical DTC creative agency rates ($1.5K-$5K/mo standard). Decide after first 3 sales calls.

---

TECH INFRASTRUCTURE:

Supabase project: GriffinCreatives_clients (ID: gcatvqcntgizjsdoabva)
- Table: griffin_clients — onboarding form submissions, client records
- Table: outreach_leads — cold email pipeline (status: queued/sent/replied/bounced/rejected, niche column)

API endpoints (live):
- POST /api/generate-deliverables — onboarding-to-deliverables, called by Make.com after Stripe payment
- POST /api/send-outreach — cold email batch, called by cron-job.org daily 9 AM, Bearer auth via CRON_SECRET

Google Drive folder IDs (client template):
- Ad Scripts: 11YtFyiKQXTtH7Fntpt3XdABl8eBcMIUO
- Email Sequences: 1iCe4SxzK_Knsxt4Ow9ADnrPonUqoobKB
- Static Visual Ads: 1K7dlDaXG-IZ3P-8euAPeRN0hFA5SRe14
- Content Calendar: 14qvgw81XI5VgTBlUO5pniqFrT1mWNa7n
- Video Scripts: 1yXm_Sn0suooNBMxy7qUEWailSPmGivkZ

Email: hello@griffincreativelab.com (Google Workspace, DKIM/SPF/DMARC verified, 10/10 mail-tester)
Calendly: 15-min strategy call, Mon-Fri 12-6pm

---

CURRENT LEAD DATABASE (as of May 27):
- Roofing leads (~92 queued, ~50 sent, 0 replies) — DRAINING / PAUSING soon
- Insurance independent (50 enriched + queued) — let drain
- Mortgage broker (20 enriched + queued from this morning's pull) — KEEP, send during drain
- DTC e-commerce — TO BE BUILT

Apollo credits: ~3,800 remaining (4,035 monthly limit, cycle resets June 23)

---

NEXT IMMEDIATE STEPS (DTC pivot execution):
1. Rewrite website index.html — kill "Built For" 3-card section, replace with DTC positioning + locked tagline
2. Update onboarding.html — add product photo upload, Shopify URL, brand assets
3. Update Supabase griffin_clients schema — add product_image_urls, brand_asset_urls, shopify_url
4. Rewrite generate-deliverables.js prompts for DTC deliverable mix
5. Rewrite COLD_EMAIL_PROMPT in send-outreach.js — add ecommerce_dtc hook with locked tagline
6. Run Apollo search for fast-growing DTC brands (Shopify tech, 11-200 employees)
7. Pause cron OR let it drain for 2 days then pause
8. Send 50-100 DTC cold emails as first batch
9. Track reply rates for 7 days minimum before any further iteration

---

HISTORICAL CONTEXT (for reference, not active):
- Phase 1-7 complete: accounts, onboarding, Claude API, Make.com pipeline, Stripe LIVE, cold email agent.
- Phase 8 originally: hybrid retainer + commission model with GTM/GA4/CallRail. Deprecated by DTC pivot since DTC clients track everything themselves.
- Previous niche attempts: med spas (failed — needed real photos), dentists (failed — needed real photos), roofing (failed — 0% reply, structural mismatch). Insurance + mortgage explored but creative-only is mismatched for insurance independents specifically.

---

JUNE 10, 2026 SESSION — FINISHED-ASSETS OVERHAUL (concepts → finished, no homework)

BIG MOVE: Rebuilt the entire deliverable stack from "concepts + copy docs the client has to go build" into FINISHED, ready-to-upload assets. Same prices, same Stripe tiers. This is now the core differentiator.

WHAT SHIPPED (all live in prod unless noted):
- SITE (index.html): reframed to finished-assets positioning. Moved Liquid Death teardown above pricing. Cut the RoofScript/MedAd "Tools" section (split buyer focus). Stripped homework/DIY language ("image prompts", "designed in Canva", "AI-generated copy", "30-day deployment action plan").
- NEW api/render-ad.js: $0 static-ad render engine. Satori + @resvg/resvg-js (same stack as render-teardown-slides.js, fonts in api/fonts/Lato*). Takes a nano-banana scene image + headline/subhead/CTA + accent_color → outputs 4 finished ratios (1:1, 4:5, 9:16, 16:9), uploads to Supabase content_assets bucket (public), returns URLs. Auth via x-api-key (CONTENT_GEN_API_KEY). Client-accent CTA color (defaults #FF4D00). NO Bannerbear — chose our own stack to avoid $50/mo.
- NEW api/render-landing.js + api/lp.js: hosted landing pages. render-landing builds branded responsive HTML from a structured landing_page object + product image + accent, stores it in new Supabase table `landing_pages` (slug, client, html), returns griffincreativelab.com/api/lp?c=<slug>. lp.js serves it. ($0, our domain. Pretty lp. subdomain = optional later DNS step.)
- api/generate-deliverables.js: added structured `video_scripts` (JSON array, image-to-video motion prompts + caption lines), `brand_accent` (parsed from brand_asset_urls hex), structured `landing_page` (JSON object, scale/dominate). parseClaudeJson now handles objects AND arrays. nano-banana image_prompt now forbids ADDED text but PRESERVES the product's real label/logo. video motion_prompt favors gentle, label-preserving motion.

MAKE.COM CHANGES:
- Scenario B: statics branch now Iterator17(static_ads) → nano-banana(HTTP19) → Tools22(image_url) → JSON51(Create JSON, escapes quotes) → HTTP49(POST /api/render-ad) → Iterator50({{49.data.files}}) → HTTP20 download({{50.url}}) → Drive21 upload({{17.concept}}-{{50.ratio}}.png, folder 15). Removed old Static-Ad-Concepts doc chain (Iterator45/TextAgg46/doc). Added Scale/Dominate landing-page branch: Create JSON → HTTP POST /api/render-landing → URL into a Drive doc. B's Gmail DELETED (C now sends the single email).
- Scenario C (video): Webhook → Iterator2(video_prompts) → JSON3(Kling_payload: prompt={{2.motion_prompt}}, image_url={{1.product_image_url}}) → HTTP4 Kling IMAGE-to-video (fal-ai/kling-video/v3/standard/image-to-video) → Tools5(video_url) → Creatomate6(captions: hook_text={{2.hook}}, voiceover_text={{2.voiceover_optional}} = gated off) → download → Drive7(ai_video_folder_id) → Array agg → Gmail (single comprehensive "Your Deliverables" HTML email, orange button). Collapsed the two voice routes (Charlie/Sarah) into ONE — killed voiceover duplication. There is NO separate ElevenLabs module; voice was just a Creatomate field.
- B→C payload fix: now sends video_scripts (was video_prompts) + product_image_url ({{first(3.data.signed_product_urls)}}). NOTE: when adding a webhook field, must Detect-new-values on C's webhook AFTER B sends it.

GOTCHAS LEARNED (don't re-discover):
- Make HTTP "Parse response = Yes" puts parsed body under .data → reference {{N.data.files}}, {{N.data.url}}, NOT {{N.files}}.
- Hand-built JSON bodies break on quotes in Claude text → use a Create JSON module (it escapes).
- Inserted Iterator must connect downstream or modules run 0× (scenario still says "success").
- Deleting modules orphans references (esp. aggregators) → causes validation errors. Back up blueprint first.
- Apex griffincreativelab.com 301-redirects and drops POST body → always POST to www.griffincreativelab.com.
- Image-to-video warps any text on the product (garbled label). Mitigate: real product photo (not picsum) + gentle motion. TRUE fix = composite route (clean product PNG over Kling-animated background; product never passes through Kling) — SPEC'D, not built.

NEW SUPABASE: table `landing_pages`. Existing buckets content_assets (public, statics + nothing else changed).

OPEN / NEXT (priority order):
1. SELL, don't build more. Pipeline is done. Reactivate DTC outreach with finished-assets positioning; land first paying client → first case study. Composite video + multi-page LP + template variety are POST-REVENUE polish.
2. Run ONE real end-to-end test with a REAL product photo (everything's only been tested on picsum).
3. Clean up test rows (stripe_customer_id cus_test_dtc_*) + test Drive folders.
4. ROTATE CONTENT_GEN_API_KEY (exposed repeatedly in chat during build).
5. Deferred builds (when a client needs them): composite video route; multi-variation hosted LPs (currently 1 page); richer Creatomate caption tracks; eyebrow/kicker + comparison/ingredient static templates.

---

WHEN STARTING A NEW SESSION: pick up exactly where we left off. Remind me of current state, current blockers, and next immediate step. If I propose something that contradicts the operating mode above (especially a pivot), push back before executing.
