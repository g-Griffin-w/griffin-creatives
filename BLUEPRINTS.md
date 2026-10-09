# Blueprints — Get Found & Full Season

Every task in these two tiers, broken into two modes:

- **LEAD MAGNET** — what we do for a prospect who hasn't signed anything, to prove the work before asking for money. Has to be genuinely free to produce (no real cost, no dependency on data we don't have yet).
- **CLIENT** — the real, ongoing version once they've signed and handed over onboarding info.

Focused on elk outfitters (current focus, per 2026-10-08 — salmon work stays intact in the codebase, just paused).

---

## GET FOUND

### 1. Proof-Content Batch
**What it is:** real trip photos turned into finished, ready-to-post ad images.

**LEAD MAGNET** — fully built, zero marginal cost beyond a Claude call + fal generation spend:
```bash
node scripts/draft-prospect-config.js <their-website> --niche=elk_guide --slug=<slug>
```
→ writes `clients/<slug>.json` from their real scraped trip photos. Sanity-check the photo URLs in a browser, then:
```bash
FAL_KEY='...' node scripts/make-samples.js clients/<slug>.json
```
→ eyeball every PNG in `PENDING-REVIEW/`, honestly check `REVIEW.md`, then:
```bash
node scripts/make-samples.js clients/<slug>.json --approve
```
→ prints a tracked link per concept. That link is what goes in the cold email — no reply required first.

**CLIENT** — same pipeline, but photos come from onboarding upload instead of scraping (more reliable), run monthly or per the season-timed schedule (see #7) instead of once.

---

### 2. Google Business Profile
**What it is:** claimed, filled-out, optimized listing for the searches people actually run before booking.

**LEAD MAGNET** — we can't edit a profile we don't have access to, so this becomes an **audit**, not a build:
1. Search "[business name] [state] elk outfitter" / "elk hunting [unit or region]" on Google — does a listing exist at all?
2. If yes: note what's missing — categories, hours, service area, photo count, whether recent reviews exist.
3. Turn that into 2-3 specific gaps ("no photos posted in 2+ years," "service area isn't set to your actual hunting units") — this is a sharper hook than generic marketing-speak because it's about *their* real listing.

**CLIENT** — once signed:
1. Get added as a manager on their GBP (or claim it together if unclaimed).
2. Set category correctly, fill every field, set service area to their real hunting units/region.
3. Upload photos from the approved proof-content batch (#1) — real content, not stock.
4. Seed a few Q&A entries addressing common questions (season length, what's included, license/tag requirements).

---

### 3. Local Search Cleanup
**What it is:** on-page SEO so their own site surfaces for real search terms.

**LEAD MAGNET** — same audit approach as GBP, ~2 minutes per prospect:
1. View page source or inspect: does the `<title>` mention elk hunting + their state/region? Is there a meta description at all?
2. Is there a dedicated page for elk hunts specifically, or is it buried in a general "hunts" page?
3. Note 2-3 concrete gaps for the pitch.

**CLIENT:**
1. Rewrite title tags and meta descriptions around real search terms ("[State] elk hunting outfitter," "[Unit/region] guided elk hunts").
2. Add Outfitter/LocalBusiness schema markup if the site platform allows it.
3. If no dedicated elk page exists and they offer multiple species, build one.

---

### 4. Review-Request Automation
**What it is:** an automatic nudge asking every client for a review after their trip.

**Not built yet** — needs an SMS provider (Twilio, not integrated) or an email trigger tied to the client logging a completed trip. Neither exists.

**LEAD MAGNET** — not applicable; a prospect has no trips running through us yet.

**CLIENT (current workaround, fully manual):** give the client a plain-text review-request template to send by hand after every trip. Not automated, but better than nothing until #4 gets built for real.

---

## FULL SEASON (adds to Get Found)

### 5. Book-Next-Season Retention Sequence
**What it is:** the system that fights the off-season — reaches past clients before they book with anyone else.

**LEAD MAGNET** — this is the one that needs the clearest LEAD vs. CLIENT split. We don't have the prospect's real past-client list or real facts (their actual dates, a specific past-trip memory) before they sign, so the lead-magnet version is a **demo draft**, not a send-ready sequence:
```bash
ANTHROPIC_API_KEY='...' node scripts/draft-retention-sequence.js --website=<their-site> --niche=elk_guide --name="Their Business"
```
→ produces a realistic example with `[bracketed placeholders]` still visible. Use this AS the pitch — "here's what we'd build you, tailored to your actual season" — never send it, never imply it's finished. The placeholders are the point: they show we don't fabricate facts about a business we don't know yet.

**CLIENT** — the real one, built from real onboarding data:
```bash
# After they fill in every [placeholder] with real facts themselves or over a call:
node scripts/approve-retention-sequence.js retention-sequences/<slug>.md --guide-client-id=<uuid> --niche=elk_guide --season-year=2026 [--season-label=main|application-reminder]
node scripts/import-guide-contacts.js <their-past-clients.csv> --guide-client-id=<uuid> --niche=elk_guide
```
→ done. The daily cron fires it automatically when the season's real trigger date arrives (already seeded through 2027 for both the post-season thank-you and the April application reminder).

---

### 6. Referral Program
**What it is:** a trackable link each past client can send to friends, with a real incentive attached.

**Not a built tool yet** — the tracking tech exists (same `/api/lp-click` system as the ad samples), but nothing generates a referral link per past client automatically. Manual process today:
```sql
insert into landing_pages (slug, client, html, cta_url, concept_id)
values ('<client-slug>-referral-<friend-code>', '<Business Name>', '<simple referral page html>', '<their booking link>', null);
```
Share `https://www.griffincreativelab.com/api/lp?c=<slug>` with the referring client. Clicks land in `landing_page_events`, same as everything else.

**LEAD MAGNET** — not applicable; needs real past clients, which means a signed client.

**CLIENT** — set this up once their past-client list is loaded (#5) and they've confirmed a real incentive (captured on the onboarding form now).

---

### 7. Season-Timed Campaigns
**What it is:** not a separate tool — this is #1 and #5 firing on the *right dates* instead of a generic monthly schedule.

**How it actually works:** `niche_seasons` holds the real trigger dates (already seeded for elk: season Sep 1–Nov 30, post-season retention launch Dec 4, application reminder mid-April). As long as a client's `guide_client_id` is tied to the right niche, `api/send-guide-retention.js`'s daily cron handles the timing automatically. The only ongoing task is making sure `niche_seasons` gets next year's rows seeded before the current ones run out — not yet automated, a manual yearly check.

---

## The honest capacity note

Using Get Found + Full Season as lead magnets means #1 (proof-content) and #5 (retention demo) now run for *every prospect*, not just paying clients. Both have a real human review step that doesn't scale for free — budget actual time per prospect, not just per client, when deciding how many leads to push through this at once.
