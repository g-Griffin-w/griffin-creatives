# GriffinCreative — 90-Day Execution Plan

**Created:** May 20, 2026
**Owner:** Gabriel
**Stage at start:** Phase 4 complete (automation pipeline working end-to-end), 0 paying clients, infrastructure shipped

---

## North Star

By end of Day 90, GriffinCreative should have:
- 5-10 paying clients across Launch/Scale/Dominate
- 2-3 documented case studies with real ROI numbers
- A Performance tier (AI-managed campaigns) ready to launch
- Sender domain warmed + delivering to inbox reliably
- Public website fully wired for self-serve purchase
- ~$7k-20k MRR

The plan is sequenced so revenue-generating work always takes priority over feature work. Build only what unlocks the next sale.

---

## PHASE A — Days 1-30: Ship + Close First 3 Clients

**Theme:** "Stop building, start selling. Polish what exists. Get 3 paying clients."

### Week 1 (Days 1-7)
- [ ] Fix email deliverability (DKIM/SPF/DMARC + mail-tester score 8+)
- [ ] Switch Stripe from test mode to live mode
- [ ] Final website pass: replace Calendly buttons with Stripe checkout
- [ ] Implement smart defaults system (voice + video length per industry)
- [ ] Verify ElevenLabs voice IDs in production
- [ ] Add 2 new Supabase columns: `voice_id`, `video_length`
- [ ] Industry-tailored prompt tweaks in API (med spa = warm/professional, roofing = energetic/blue-collar)

### Week 2 (Days 8-14)
- [ ] Create 3 industry-specific landing pages: med spa, roofing, restaurant
  - URL: griffincreativelab.com/medspa, /roofing, /restaurants
  - Same checkout, different copy + headline + hero
- [ ] Build "Free Ad Account Audit" lead magnet — Calendly link → 15-min Loom-style audit
- [ ] Record onboarding welcome video (5 min Loom) — how to deploy deliverables
- [ ] Auto-attach welcome video link to delivery email
- [ ] Write 3 industry playbook PDFs (one per niche)

### Week 3 (Days 15-21)
- [ ] Outreach: 50 cold DMs/emails to local businesses in chosen niches
- [ ] Offer "Founding client" rate: $560 Launch / $1,400 Scale (20% discount for first 5 clients in exchange for testimonial)
- [ ] Goal: 1 paying client by end of week 3
- [ ] Document the onboarding experience — what felt rough?

### Week 4 (Days 22-30)
- [ ] Continue outreach (100 more touches)
- [ ] Goal: 3 paying clients by end of Day 30
- [ ] Build revision request system (button in delivery email → form → re-run API for that section)
- [ ] First monthly delivery for client #1 — make sure recurring billing fires correctly via `invoice.payment_succeeded`

**Day 30 checkpoint:**
- 3 paying clients
- ~$2,000-4,000 MRR
- Deliverability dialed in
- 1 founding client willing to record a video testimonial

---

## PHASE B — Days 31-60: Polish + Add 5 More Clients

**Theme:** "Make the product feel premium. Land 5 more clients. Build the case studies."

### Week 5 (Days 31-37)
- [ ] Get video testimonials from founding clients (1-2 minutes, phone selfie OK)
- [ ] Add testimonial section to homepage + tier pages
- [ ] Build basic client dashboard (Phase 5, scoped tight):
  - Login → see past deliveries
  - Download links
  - Submit revision requests
  - View next delivery date
  - Tech: Next.js + Supabase Auth (existing stack)

### Week 6 (Days 38-44)
- [ ] Add 2 high-value upsells to existing clients:
  - **AI Review Responder** ($99/mo) — Google reviews API integration
  - **AI Missed-Call Text-Back** ($149/mo) — Twilio integration
- [ ] Pitch both to existing 3 clients first
- [ ] Continue cold outreach (50/week minimum)

### Week 7 (Days 45-51)
- [ ] Goal: 5 paying clients total by end of week 7
- [ ] Land first client in a new industry (broaden from initial 3 niches)
- [ ] Add landing page for new niche
- [ ] Document first case study: client name, problem, deliverables, results so far

### Week 8 (Days 52-60)
- [ ] Goal: 8 paying clients by end of Day 60
- [ ] Launch annual prepay discount (2 months free for paying upfront)
- [ ] Add affiliate program (20% commission per referral)
- [ ] Email existing clients about affiliate option
- [ ] First refinement pass on AI prompts based on what's converting

**Day 60 checkpoint:**
- 8 paying clients
- ~$7k-11k MRR
- 1 detailed case study documented
- 2-3 upsell revenue streams active
- Affiliate program live

---

## PHASE C — Days 61-90: Launch Performance Tier

**Theme:** "Begin the move from selling assets to selling outcomes. Launch managed campaigns."

### Week 9 (Days 61-67)
- [ ] Pick 1 existing client to beta-test Performance tier (FREE management for 30 days in exchange for case study)
- [ ] Set up Meta Business Manager + agency partner access
- [ ] Set up Google Ads MCC account
- [ ] Install Meta Pixel + GA4 + GTM on beta client's site
- [ ] Set up CallRail for beta client
- [ ] Subscribe to Madgicx ($249/mo) or equivalent AI ad manager
- [ ] Launch beta client's first managed campaign

### Week 10 (Days 68-74)
- [ ] Build conversion tracking setup playbook (template for future clients)
- [ ] Continue managing beta client's campaigns, document everything
- [ ] Build performance reporting template (Claude-generated monthly report from GA4/Madgicx data)
- [ ] Continue cold outreach (now with case study #1 ready)

### Week 11 (Days 75-81)
- [ ] Goal: 10 paying clients total (creative tiers)
- [ ] Beta client hits 30-day mark — collect performance data, write Case Study #2
- [ ] Soft-launch Performance tier to existing clients only
  - **Performance:** $2,500/mo + 10% ad spend (Meta only)
  - **Performance Pro:** $4,500/mo + 10% ad spend (Meta + Google + CallRail + bi-weekly strategy)
- [ ] Pitch Performance tier to 3 best-fit existing clients

### Week 12 (Days 82-90)
- [ ] Goal: 1 paying Performance tier client
- [ ] Public launch of Performance tier on website
- [ ] Add Performance tier landing page with beta client case study
- [ ] Conduct 90-day retrospective:
  - Total MRR
  - Total clients
  - Churn rate
  - Most profitable tier
  - Most painful operational bottleneck

**Day 90 checkpoint:**
- 10-12 total paying clients (creative + performance)
- ~$13k-18k MRR
- 2-3 case studies with documented ROI
- Performance tier live and selling
- Clear data on where to invest next

---

## KEY DECISIONS TO MAKE ALONG THE WAY

**Day 30 decision:**
- If 3+ clients secured → continue plan
- If 0-2 clients → pause feature work, double down on outreach + offer changes (lower price? different niche? different positioning?)

**Day 60 decision:**
- If clients are happy with creative-only → expand creative tiers further before adding management
- If clients keep asking "can you run the ads for me?" → fast-track Performance tier

**Day 90 decision:**
- If Performance tier is profitable → invest in scaling that side
- If creative-only is the cash cow → invest in white-label / agency reseller program

---

## DELIBERATE NOT-DOING LIST

To stay focused, these are explicitly NOT in the 90-day plan:

- Building a mobile app
- Adding more than 6 voice options
- TikTok ads support (start Meta + Google only)
- International expansion
- Hiring contractors or VAs
- Building a separate B2B product
- Conferences, podcasts, content marketing beyond basics

These can come in Days 91-180 if revenue justifies it.

---

## METRICS DASHBOARD (track weekly)

| Metric | Day 30 target | Day 60 target | Day 90 target |
|---|---|---|---|
| Paying clients | 3 | 8 | 10-12 |
| MRR | $2k-4k | $7k-11k | $13k-18k |
| Cold outreach sent | 100 | 200 | 300 |
| Outreach reply rate | 5%+ | 8%+ | 10%+ |
| Conversion rate (reply → buy) | 10%+ | 15%+ | 20%+ |
| Avg client revenue | $700-1,100 | $900-1,400 | $1,100-1,600 |
| Churn (monthly) | n/a | <10% | <8% |

---

## TOOLS BUDGET (target by Day 90)

| Tool | Cost/mo | Purpose |
|---|---|---|
| ElevenLabs Starter | $5 | Already have |
| fal.ai (kling) | ~$50-200 | Variable, per client |
| Make.com | $9-29 | Automation |
| Supabase | Free → $25 | Database |
| Vercel | Free | Hosting |
| Anthropic API | $20-100 | Variable |
| Google Workspace | $7/seat | Email |
| Stripe | Per transaction | Billing |
| Madgicx (Phase C) | $249 | AI ad management |
| CallRail (Phase C) | $45/client | Call tracking |
| **Estimated total** | **~$400-800/mo** | At 10 clients |

---

## OPERATIONAL PRINCIPLES FOR THE 90 DAYS

1. **Sales beats features.** If you have a choice between building a new feature or sending 20 more cold emails, send the emails.

2. **First client > perfect product.** The first 3 clients teach you more than 3 months of building.

3. **No new tier until current ones convert.** Adding tiers when no one's buying = expensive distraction.

4. **Use your own product.** Generate ads for GriffinCreative itself. If you wouldn't trust it for your own marketing, why would clients?

5. **Document everything.** Every client conversation, every objection, every "yes." Pattern-match for the offer that closes.

6. **One niche at a time.** Don't try to serve every industry. Med spa OR roofing first. Add the second once the first has 3-5 clients.

7. **Talk to customers weekly.** 1 conversation/week with a paying client. What's working? What's broken? What would they pay more for?

---

## OPEN QUESTIONS TO REVISIT EACH PHASE

- Are clients actually running the deliverables we're sending?
- What % of clients renew after month 1?
- What % of clients upgrade tiers within 60 days?
- Which industry is most profitable?
- Which deliverable type (ad copy, video, calendar) do clients value most?
- Which deliverable type do they ignore?
- What do clients DM you with the most? (signal for what to build next)

---

*Document maintained at: /Users/gabewigginton/griffin-creatives/GRIFFINCREATIVE_90_DAY_PLAN.md*
*Last updated: May 20, 2026*
