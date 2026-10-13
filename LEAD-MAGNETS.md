## Status (2026-10-13): built and tested, NOT yet pushed

**The flow (opt-in):**
1. **Cold email** (`send-outreach.js`): explains the four free guides, with a
   CTA **button** to `/starter-kit.html?lead=<id>`. Subject: "4 free marketing guides for elk outfitters in the NW". Sent as text + HTML (multipart) so the button renders.
2. **Signup page**: name + email only. `POST /api/send-starter-kit-drip` saves
   the subscriber and sends **guide 1 immediately**. If that send fails the
   daily cron sends it, so a signup is never lost.
3. **Drip** (`send-starter-kit-drip.js`): guide 1 on signup, guides 2-4 on
   days 2 / 4 / 6, then a short Booked Out pitch on day 8. Each email has a
   "Read guide N" button. Guides 2-4 carry a "reply 'booked out'" PS.
4. **Non-subscribers** (`send-followups.js`): a reminder (+3d) and a breakup
   (+4d), both with the CTA button. They never receive the guides unless they
   sign up. Stops on reply and on signup.

**Crons** (`vercel.json`; Vercel Hobby allows 100 cron jobs/project, once a
day each): `check-replies` 14:00 UTC, `send-followups` 17:00, drip 18:00.
These replace the cron-job.org jobs, which stopped in July (last logged
reply 2026-07-22, last follow-up 2026-07-14).

**Guard rails**
- `send-followups` is guide-niche only by default. ~680 stale DTC leads have
  been overdue since July; `FOLLOWUP_INCLUDE_DTC=1` includes them.
- 56 Montana outfitters were sent the old ask-first email on Oct 10-12
  (subject "a couple free ads for X?"). Their first follow-up is the
  explanation of the guides + button; then the breakup.
- Public signup endpoint: honeypot field, email validation, duplicate emails
  never re-sent, instant sends capped at 150 new signups / 24h.
- `elk_guide` is no longer excluded from `send-outreach.js`'s queue (lifted
  2026-10-13, takes effect on deploy). 92 queued elk leads send at
  `OUTREACH_BATCH_SIZE` per day (default 25).

**Tracking:** guide links carry `?lead=<id>` / `?s=<signup id>`; guide pages
and the signup page log to `guide_views`. Read it with
`select * from guide_engagement order by guides_viewed desc, last_view desc;`
(a `signup-page` view with no signup = clicked the CTA but didn't subscribe).

---

# The Booked Out Starter Kit — 4 free lead magnets

One name, one signup, four real deliverables. The point: give away enough real,
finished work that a skeptical outfitter has no reason left to say no to a
call. Not samples of what we'd do — the actual thing, done for free, once.

Niche focus: elk outfitters (current focus per BLUEPRINTS.md).

---

## The signup mechanism

**Name:** "The Booked Out Starter Kit" (ties to the paid `Booked Out` offer on
the site — free kit now, paid plan is the same work kept running all season).

**One signup unlocks all 4** — don't make them pick. The more free work they
see, the harder we are to say no to.

**The form itself: name and email, nothing else.** Every extra field is a
reason to bounce before converting — business name and state aren't worth
asking on the form when we can get them for free elsewhere:

- **Outreach-sourced signups** — the tracked link already carries which lead
  clicked it (same pattern as the ad-sample tracked links), so company name,
  state, and niche are already sitting in `outreach_leads`. Zero extra
  typing required from them.
- **Social-sourced signups** (no known lead behind the click) — don't ask on
  the form either. Fold "what's your business + state" into the same short
  follow-up intake already planned for item #3 below, so it's one short
  human-feeling exchange after signup, not a longer form before it.

**Where it lives:** a real page, `griffincreativelab.com/starter-kit` —
not a popup, something linkable from both channels:

1. **Cold outreach email** — replaces the current "want 2 free samples?"
   ask-first line in `api/send-outreach.js`'s guide pitch with a direct link
   to the page. No reply needed to see what's offered; the signup *is* the
   reply.
2. **Social media** — link in bio + pinned post for Griffin Creative's own
   accounts. This is the first lead magnet that works on a cold stranger who
   never got an email at all — worth having, since outreach alone caps at
   however many leads we scrape.

**What happens on submit (not built yet — scope, not done):**
- Insert into a new `lead_magnet_signups` table (name, email,
  `outreach_lead_id` nullable FK — set automatically when the tracked link
  identifies the lead, null for a cold social click — plus source:
  `'outreach_email'` | `'social'`, created_at). company_name/state/niche get
  pulled from the linked `outreach_leads` row when present, or collected in
  the follow-up intake when not — never stored as blank columns waiting to
  be filled in.
- Auto-confirmation email: "got it — here's what happens next" (sets
  expectation that 3 of 4 kit items need a short human step, not instant).
- Notify Gabriel (the GBP, review, and calendar items need real per-business
  work — see each blueprint below. Only the email sequence can run almost
  unattended).

This also quietly solves the GBP access problem below — you can't manage
someone's Google Business Profile without them taking an action to grant it,
and a signup is the first action that makes sense to ask for.

---

## The four lead magnets are DIY guides

Decision (2026-10-13): the lead magnets are the **blueprints themselves** —
step-by-step guides the outfitter follows on their own. We do not do the
work for free; doing it for them is what `Booked Out` is. Each guide ends
with a one-line pointer to that.

| # | Guide | File |
|---|-------|------|
| 1 | Three emails that bring past clients back | `guides/rebooking-emails.html` |
| 2 | Set up your Google Business Profile | `guides/google-business-profile.html` |
| 3 | Your elk season marketing calendar | `guides/season-calendar.html` |
| 4 | Ask for reviews after every hunt | `guides/review-requests.html` |

The earlier version of this section described how *we* would do each item
for them (manager access, our scripts, our delivery). That is no longer the
offer and was removed.

**Aligned (2026-10-13):** the cold emails, `starter-kit.html`, and the drip
now deliver the DIY guides instead of promising done-for-you work.

**Date accuracy (verified 2026-10-13):** the guides state the 2026-cycle elk application and results dates for Oregon, Idaho, Montana, Washington and California, each checked against the agency's own site (ODFW, IDFG, Montana FWP, WDFW, CDFW). Montana runs about 6-8 weeks earlier than Oregon/Idaho (deadline Apr 1, results mid-April), and the calendar guide calls that out. Montana and California 2027 dates aren't posted yet; re-check each February.
and California are sent to the agency sites in the guides rather than stated.

---

## The actual email + social copy

**Cold outreach** — see the flow in the status block above. One email
explains the free guides and has the CTA button; non-subscribers get a
reminder and a breakup; subscribers get the guides via the drip. Links must
use `.html` (the site has no clean-URL routing, so extensionless paths 404).
Source of truth for the guide pages: `scripts/build-guides.js`.

**Social media** — bio link + pinned post for Griffin Creative's own
accounts (the one channel that reaches outfitters who never got a cold
email):

> **Bio link text:** free starter kit for elk outfitters → link
>
> **Pinned post:** we'll set up your Google Business Profile, build you a
> review-request system, write your "book next season" email sequence, and
> map your season's campaign calendar — all free, no catch. built for elk
> outfitters who are busy running trips, not running marketing.
> link in bio.

---

## Honest capacity note (same shape as BLUEPRINTS.md's)

Three of four items (GBP, review template, calendar) need real human time
per signup, not just per eventual client — same bottleneck as the proof-
content and retention-demo lead magnets. The email sequence is the one that
scales closest to unattended. Budget signups accordingly; this is a stronger
pitch than the old "want 2 free samples?" ask, but it is not free to deliver
at volume.
