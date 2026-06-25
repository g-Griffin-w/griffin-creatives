# Outreach — Dialed In (locked June 24, 2026)

## The diagnosis (what the data says)
- **506 cold emails sent, ~1 reply that went anywhere** on the new build (~1 week old).
- That's not deliverability death (no reply = spam death; you're getting read, just rarely answered). It's a **relevance + proof** problem.
- DMs: 0% reply across the board → same root cause. Do **not** scale them until the email message works.
- **Bottleneck = nobody has a reason to reply.** Fixing that follows us into every niche and channel. Everything below attacks that one thing.

## The three niches (locked)
Fishing/outdoor gear · Beverages & food · Supplements.
Reason they're right: Gabriel has domain knowledge in all three (better calls, sharper copy), and we build a custom sample per brand anyway — so niching costs nothing and buys relevance.

## The core change: lead with the sample, not the pitch
Stop selling "we make creative." **Show creative you already made for their brand** and give it away. For a creative agency this is the only hook that reliably converts cold → reply.

### Two-tier model (solves your time bottleneck)
You can't hand-build 20 custom samples a day. So split volume:

**Tier 1 — Hyper-personalized (target ~5/day, your best-fit accounts):**
Generate 2–3 real sample concepts from their actual product photos *before* you email. The email references the specific work. Highest hit rate. This is where closes come from.

**Tier 2 — Category-personalized (target ~15/day, volume):**
No pre-made sample. Email references their niche + offers to make samples free on reply. Lower hit rate, keeps the funnel full, surfaces who's warm enough to earn a Tier-1 sample.

Total still ~20/day, but your sample-making labor is capped at ~5.

## Email templates (use as-is, swap {tokens})
Keep them short. Brevity + specificity is what gets replies.

### Tier 1 — Fishing / Outdoor
**Subject:** 3 ad concepts for {Brand}
> {First} — made {Brand} a few short-form ad concepts from your own product shots (took a couple hours). Outdoor angles that test well: rugged "field-tested" hero shots and UGC-style hooks.
>
> We help outdoor e-com brands test winning creative fast without the production bottleneck.
>
> Want the full set? Free, yours to run.

### Tier 1 — Beverages / Food
**Subject:** 3 ad concepts for {Brand}
> {First} — put together a few short-form ad concepts for {Brand} using your product shots. Beverage/food angles that convert: first-sip UGC, flavor-drop launch creative, appetite-appeal hero frames.
>
> We help DTC food & drink brands test high-converting creative fast — no production bottleneck.
>
> Want the full set? Free, no strings.

### Tier 1 — Supplements
**Subject:** 3 ad concepts for {Brand}
> {First} — made {Brand} a few short-form ad concepts from your product photos. Supplement angles that test well: benefit-stack hooks, ingredient-credibility, and UGC "why I switched" formats. (Kept all claims clean/compliant.)
>
> We help supplement brands test winning creative fast without the production bottleneck.
>
> Want the full set? Free, yours to keep.

### Tier 2 — any niche (no pre-made sample)
**Subject:** quick idea for {Brand}'s ads
> {First} — we make short-form ad creative for {niche} brands, fast, without the production bottleneck. I can spin up 3 free sample concepts from your product photos so you can see the quality before any conversation.
>
> Want me to put a set together for {Brand}?

## Decision gates (so we don't pivot on gut again)
Measure **per niche**. A niche gets a fair shot, then we cut or scale on evidence:
- **Sample size before judging:** ~50 quality sends per niche (Tier 1 + Tier 2).
- **Healthy:** ≥2–3 positive replies per 50 (4–6%). Scale it.
- **Dead:** <1 positive per 50 after 50–75 sends → cut the niche, reallocate.
- **One reply ≠ validation.** We need the gate hit before declaring a winner.

## What we're NOT doing (kill list)
- ❌ Scaling DMs at 0% — pause, reuse the winning email hook later.
- ❌ A 30-day Instagram content grind — see baseline below.
- ❌ Adding a 4th niche or a new channel until one niche clears the gate.

## Instagram — credibility baseline, not a content factory
For a DTC agency, IG is the **"are these guys legit" check** when a prospect clicks your profile — not a lead engine. You don't need viral audio. Your *product is the content.*

**One-weekend setup, then maintain:**
- **Bio:** "We help e-commerce brands rapidly test high-converting short-form creatives — without the production bottleneck." + link to griffincreativelab.com.
- **First 9–12 posts (proof grid):** before/after carousels — "boring product photo → scroll-stopping ad." These double as outreach proof and demonstrate the actual service. No audio needed.
- **Highlights:** Samples · Process · Results.
- **Cadence:** 3 posts/week, carousels or static (no trending-audio dependency). Reels optional later with voiceover/text + commercial-library audio.
- **Job #1:** front-load your best 3 samples so a cold prospect who checks the page is convinced in 5 seconds.

## Sequence
1. **This week:** re-pull Apollo leads tagged by the 3 niches; rewrite send copy to the templates above; start Tier 1 (~5/day) + Tier 2 (~15/day).
2. **Fix measurement:** log replies in Supabase (`reply_received`, `reply_intent`) so per-niche gates are real — right now the table shows 0 while you've had replies.
3. **Parallel, low-effort:** stand up the IG baseline grid using sample creatives you're already making.
4. **Day 10–14:** read the gates per niche, cut/scale, then turn the proven email hook into DM copy.

## Open items
- Wire reply detection (or manual logging) so we can measure — we can't dial in what we can't see.
- Apollo pull needs niche tagging (`niche` field) for the 3 verticals to track separately.
- Confirm sending volume isn't tripping spam as we ramp (warm inbox, vary copy, watch bounce rate).
