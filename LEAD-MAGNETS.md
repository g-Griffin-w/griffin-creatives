## Status (2026-10-12): built and deployed

- `starter-kit.html` — live signup page, name + email only.
- `lead_magnet_signups` table — built, RLS matches `griffin_clients`' anon-insert pattern.
- `api/send-starter-kit-drip.js` — 5-stage drip cron, one touch every 3 days
  (`DRIP_INTERVAL_DAYS`), in this order: review-request template → email
  sequence (real Claude call, no placeholders) → campaign calendar
  (OR/ID dates are real, MT/WA/CA fall back to an honest "not verified yet"
  line) → Google Business Profile access ask → Booked Out pitch. The GBP ask
  comes last deliberately — it's the one item that needs an action from
  them, placed after three free deliverables have already landed.
- `api/send-outreach.js`'s guide pitch now links straight to
  `/starter-kit?lead={{lead.id}}` instead of asking permission first.
- **Not done yet:** the cron itself needs one external cron-job.org job
  (same pattern as `check-replies`/`send-followups`) hitting
  `POST /api/send-starter-kit-drip` daily with `Authorization: Bearer
  $CRON_SECRET` — nothing fires until that's wired. `elk_guide` is also
  still excluded from the main outreach send until that's confirmed working.

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

## 1. Google Business Profile — real set-up, not an audit

**The free deliverable:** we actually claim, fill out, and optimize their
listing — not a list of gaps, the finished profile.

**Blueprint:**
1. On signup, auto-confirmation email includes one ask: "reply with your
   Google Business Profile link (or business name + city) and add
   `hello@griffincreativelab.com` as a manager — takes 2 minutes, here's how:
   [Google's own help link]."
2. Once access lands: set category correctly, fill every field, set service
   area to their real hunting units/region, seed 3-4 Q&A entries (season
   length, what's included, license/tag requirements — reusable copy across
   every elk client, lightly tailored).
3. If they replied with any trip photos, upload those; otherwise leave photos
   for later (don't block on it).
4. Reply once done: "profile's live — go look." That's the whole pitch,
   delivered, free, before any contract exists.

**Why this is the generous version:** BLUEPRINTS.md's existing GBP entry
(#2) stops at an audit because a cold prospect hasn't granted access yet.
Gating the real thing behind the Starter Kit signup — instead of behind a
signed contract — is what makes this a true "taste of the real work," not a
teaser.

**Cost/time:** ~15-20 min of real work per business, no API spend. The
bottleneck is human time, same honest-capacity-note as everywhere else in
BLUEPRINTS.md — budget for it per signup, not per eventual client.

---

## 2. Auto Review-Request — the real template + link, not fake automation

**The free deliverable:** a finished, personalized review-request message
(email + text version) plus a direct link/QR code straight to their Google
review box — ready to send after every hunt starting today.

**Blueprint:**
1. Pull their Google Business Profile place ID (requires step 1 above, or a
   quick lookup if they already have a listing) to build the direct review
   link: `https://search.google.com/local/writereview?placeid=<id>`.
2. Generate a QR code image for that link (any QR library, free, no FAL
   spend) — printable for camp, a card in the gear bag, whatever.
3. Draft the actual send-after-trip message (short, two versions — text and
   email), personalized with their business name and species, in the same
   plain-written style as the retention sequence. One Claude call, same
   pattern as `draft-retention-sequence.js`.
4. Deliver both as a single page/PDF: "send this, point this" — no bracketed
   placeholders, this one's finished because it costs them nothing to use
   immediately, by hand, today.

**Why this is honest, not overpromising:** real automation (auto-fired the
day a trip ends) needs a trigger we don't have pre-signup — we don't know
their trip calendar. The free version is the actual message + actual link,
sent by their own hand for now. That's still the real deliverable, just
manual until they're a client and `guide_client_contacts` has real trip
dates to fire off of.

**Cost/time:** ~10 min + one Claude call per business. Cheapest of the four.

---

## 3. Email Sequence Set-Up — upgrade the existing demo to the real thing

**The free deliverable:** a complete, real "book next season" email
sequence with their actual name and actual facts — not the bracketed-
placeholder demo BLUEPRINTS.md #5 currently uses for cold outreach.

**Blueprint:**
1. Signup confirmation includes a 3-question intake (trip dates/season,
   one thing that makes their trips distinct, how most past clients found
   them) — short enough to answer from a phone.
2. Once answered:
```bash
ANTHROPIC_API_KEY='...' node scripts/draft-retention-sequence.js \
  --website=<their-site-or-listing-url> --niche=elk_guide \
  --name="Their Real Business Name" --facts="<their 3 answers>"
```
   (today's script only fills `[bracketed placeholders]` for the demo path —
   needs a small change to accept real intake answers and drop the
   placeholders entirely when they're supplied. Not built yet.)
3. Deliver the finished sequence as a doc they can paste into their own
   email tool right now, free, theirs to keep whether they sign or not.

**Why this one scales best:** it was already the closest to automated — this
is a one-script upgrade (accept real answers instead of leaving brackets),
not a new build.

**Cost/time:** one Claude call + reading their 3 answers. Nearly free.

---

## 4. Campaign Calendar — a real, state-specific month-by-month plan

**The free deliverable:** a one-page calendar mapped to their actual state's
real tag-draw and season dates, saying what to post/send/run each month.

**Blueprint:**
1. Pull real season + application-deadline dates for their state. OR and ID
   are already verified this session (ODFW: apply by May 15, results ~June
   12; IDFG: apply May 1–June 5, results mid-June–early July, second draw
   Aug 5-15/25). MT, WA, CA still need the same lookup — not done yet.
2. Lay out a template calendar (reusable per state, dates swapped in):
   - **Pre-draw (Apr-May):** "apply now" push to past clients.
   - **Results window (Jun-Jul):** tag-holders feel real urgency — heaviest
     push window for both new leads and past-client booking.
   - **Pre-season (Aug-Sep):** proof-content ads live, service area GBP
     fresh.
   - **In-season (Sep-Nov):** light touch, let bookings run, collect proof
     content for next year.
   - **Post-season (Dec):** book-next-season retention sequence fires
     (already automated via `niche_seasons` once they're a client).
3. Deliver as a single finished page/PDF with their real state's real dates
   filled in — not a generic template with blanks.

**Why this one is the "proof we actually did the homework" piece:** every
other kit item is a deliverable; this one is the one that visibly shows we
know their specific season, not a copy-pasted hunting-industry template.

**Cost/time:** a few minutes once each state's dates are looked up once and
cached — MT/WA/CA lookups are the one-time cost, after that it's free reuse.

---

## The actual email + social copy

**Cold outreach — 4 separate emails, one free item each** (not one email
listing everything). The point is repeated, useful touches: the prospect sees
our name four times, each time with a different free thing. Each email links
to the same `/starter-kit?lead=<id>` page — one signup unlocks the whole kit.

| # | Sent by | When | Subject | Pitches |
|---|---------|------|---------|---------|
| 1 | `api/send-outreach.js` | day 0 | a free rebooking email for {company} | the "book next season" email |
| 2 | `api/send-followups.js` | day 3 | a free google profile set-up for {company} | Google Business Profile |
| 3 | `api/send-followups.js` | day 6 | a free season calendar for {company} | campaign calendar |
| 4 | `api/send-followups.js` | day 9 | a free review-request message for {company} | review-request template |

- Emails 2-4 go out as new threads with their own subject (not "Re:") so each
  lands as its own message in the inbox.
- The sequence stops on reply, and stops when the lead signs up (the drip in
  `send-starter-kit-drip.js` takes over, so they never get both).
- Every email offers future work ("i'll write", "we'll claim") — none claims
  something already exists.
- No 5th pitch email on the cold side; the paid-plan pitch only goes to
  people who signed up, as the last drip stage.
- Copy lives in `PITCH_VARIANTS.guide` (email 1) and `buildGuideFollowup()`
  (emails 2-4).

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
