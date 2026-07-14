# Outreach Agent — Go-Live Runbook (July 7, 2026)

Goal: 20–30 hot leads/month for GriffinCreativeLab. The agent was already built in
June; two pieces were never turned on. This runbook activates them and ramps volume.

## Diagnosis (from Supabase, July 7)

- ~612 sends since June 1, still sending 25/day. Volume OK.
- **0 follow-ups ever sent.** 91 are due right now; 155 recent leads have thread
  IDs + scheduled follow-up timestamps. `send-followups.js` is built, cron never created.
- **Reply tracking blind.** Only 2 replies recorded. `check-replies.js` is built,
  blocked on Gmail token missing the readonly scope.
- 61 leads queued (≈2.4 days runway at 25/day).

## What changed in code today

1. `api/send-outreach.js` — batch size now reads `OUTREACH_BATCH_SIZE` env
   (default 25, clamp 1–100). Ramp without code changes.
2. `api/check-replies.js` — hot-lead alert: after each live run with matched
   replies, sends ONE digest email to `ALERT_EMAIL` (default: the sending inbox).
   Positive-intent leads flagged 🔥 at top with reply snippet + lead context.

## Gabriel-only steps (in order)

### 1. Re-consent Gmail with read scope (~10 min) — unblocks everything
- Go to https://developers.google.com/oauthplayground
- Gear icon → "Use your own OAuth credentials" → paste GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET
  (from Vercel env). Make sure `https://developers.google.com/oauthplayground` is an
  authorized redirect URI on that OAuth client in Google Cloud Console.
- Scopes: `https://www.googleapis.com/auth/gmail.send` AND
  `https://www.googleapis.com/auth/gmail.readonly` (both, same token)
- Authorize as hello@griffincreativelab.com → Exchange authorization code for tokens
- Copy the **refresh token** → Vercel → griffin-creatives → Settings → Env →
  update `GMAIL_REFRESH_TOKEN` → redeploy.

### 2. Deploy today's code
```
cd ~/griffin-creatives && git add . && git commit -m 'outreach: hot-lead alerts + env batch size' && git push
```

### 3. Dry-run both endpoints (before wiring crons)
```
curl -X POST "https://www.griffincreativelab.com/api/check-replies?dry_run=1" -H "Authorization: Bearer $CRON_SECRET"
curl -X POST "https://www.griffincreativelab.com/api/send-followups?dry_run=1" -H "Authorization: Bearer $CRON_SECRET"
```
Expect: check-replies scans inbox and lists matches (no writes); send-followups
lists ~40 drafts from the 91 due. Read a few drafts — sanity-check copy/threading.
(Always POST to **www.** — apex 301 drops the body.)

### 4. Wire two new cron-job.org jobs (existing 9:00 AM send stays)
- **8:30 AM daily** → POST https://www.griffincreativelab.com/api/check-replies
  (Bearer CRON_SECRET) — runs BEFORE follow-ups so fresh replies auto-stop them.
- **9:30 AM daily** → POST https://www.griffincreativelab.com/api/send-followups
  (Bearer CRON_SECRET)
- Day 1–3: the 91-due backlog drains at 40/day (batch cap = natural throttle). Fine.

### 5. Volume ramp (one bump per week, only if bounces/spam stay clean)
- Week 1: leave `OUTREACH_BATCH_SIZE` unset (25/day) — let follow-ups + tracking bed in
- Week 2: set to 40. Week 3: 50. Hold at 50 on one inbox.
- Lead supply must match: daily Apollo skill pulls 30/day; at 40–50/day sends,
  bump the pull to ~50 or run it twice. Queue is 61 today — pull this week.

## Honest math to 20–30 hot leads/month

50 sends/day ≈ 1,100/mo + follow-ups ≈ 2,800 touches. At 2–4% reply and ~1/3
positive → **8–15 hot leads/mo** from one inbox. That's the realistic ceiling here.
Getting to 20–30 requires (pick after 2 weeks of REAL data):
- a second sending domain + inbox (2× volume, protects the main domain), and/or
- conversion lift (the free-2-ads offer + niche targeting may beat 4% — measure), and/or
- a second channel (LinkedIn) — only after email metrics are known.
Decision gate: **July 21** — review replies-by-niche, then decide.

## Parked (deliberately)

- **Sellable version**: after Griffin demonstrably hits target. The code is already
  multi-tenant-shaped (env-driven config, per-niche routing). Productizing =
  tenant column + per-tenant Gmail creds + onboarding UI. Proof first — it's the pitch.
- Composite video route, LP variations — post-revenue, per June 10 log.
