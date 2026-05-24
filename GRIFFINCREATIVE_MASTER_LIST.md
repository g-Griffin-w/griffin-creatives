# GriffinCreative — Master List of Decisions & Commitments

**Compiled:** May 22, 2026
**Purpose:** Every "we'll do X" or "we agreed on Y" from the full strategy session, organized by status.

---

## ✅ COMPLETED (this session)

### Pipeline & infrastructure

- Smart defaults voice routing system (industry → Sarah or Charlie auto-selection)
- API code refactored: `pickVoice()` function in `generate-deliverables.js`, returns voice_name based on business_type keywords
- Two Creatomate templates created (one with Charlie voice, one with Sarah voice)
- Scenario C Router built with branches filtering on `voice_name`
- Each branch has its own Creatomate → Download → Drive Upload → Aggregator → Gmail chain
- Module 36 in Scenario B passes `voice_name` to Scenario C webhook (fixed `3.data.voice_name` chip path)
- End-to-end voice routing verified (med spa client got Sarah voice correctly)

### Email infrastructure (deliverability)

- DKIM record added to Namecheap DNS
- SPF record added to Namecheap DNS (`v=spf1 include:_spf.google.com ~all`)
- DMARC record added to Namecheap DNS (`p=none` monitoring mode)
- DNS propagation verified via mxtoolbox
- Google Workspace email authentication activated
- mail-tester.com verified score: 10/10

### Website (griffincreativelab.com)

- Fixed `GRIFFEN` → `GRIFFIN` typo (3 places: nav, footer, browser title)
- Browser title: `GriffinCreative — Done-For-You Ad Creative`
- Hero tag changed: removed "AI" from `// Done-For-You AI Ad Creative`
- Hero subtitle rewritten — automation-focused, less AI emphasis
- "What We Deliver" section rewritten with 6 cards showing accurate quantities + correct tier tags (Launch / Scale & Dominate)
- Added new "Video Ad Clips" card (Scale & Dominate)
- Removed "Content Calendar" card from main 6 (still in tier features list)
- Launch button → live Stripe checkout
- Scale button → live Stripe checkout
- Dominate button → live Stripe checkout
- Secondary "Questions? Book a 15-min call →" Calendly link below each Stripe button
- Email Automation Setup add-on price: $200 → $350
- Tools section heading: `// Our AI Tools` → `// Our Tools`
- Footer tagline: `Built with AI. Powered by strategy.` → `Built fast. Built to convert.`
- Removed "AI-generated" phrasing from Scale and Dominate tier features
- Pushed to GitHub → Vercel auto-deployed

### Stripe live mode (Phase 7)

- 3 live products created — pricing updated May 23: Launch $700/mo, Scale $1750/mo, Dominate $3500/mo (originally launched at $500/$1300/$2600, raised to current numbers same week)
- 3 live payment links generated
- Live event destination created in Stripe pointing to Make.com webhook
- Signing secret copied
- Live Stripe URLs swapped into index.html (replacing test URLs)
- $1 test payment verified: live Stripe → Make.com webhook → welcome email all working
- Phase 7 closed (downstream chain is mode-agnostic, validated in test mode)

---

## 🔄 IN PROGRESS (right now)

- Stripe branding (Settings → Branding) — uploading logo, brand color #FF4D00, accent #080808, confirming public business name and support email

---

## 📋 PENDING / NEXT (committed, scheduled)

### Cold email outreach agent (target Tue May 26)

- Apollo.io subscription ($60/mo)
- Lead pull script — Node.js, pulls 30 leads/day from Apollo
- Filters: Roofing, Plumbing, Insurance industries
- Supabase `outreach_leads` table for tracking
- Claude API for personalized email generation
- Direct Gmail API for sending
- 2-3 min delay between sends (paced to look human)
- Reply detection via Gmail API → auto-pause replied leads
- Daily cron schedule

### Cold email structure (agreed)

- Email #1 (cold): no link in body, only in signature
- Email #2 (after reply): include landing page link
- Email #3+ (closing): Stripe payment link
- No pricing in first email
- ONE CTA per email
- Subject: question-style, low spam triggers

### AI sales reply agent (Phase 2 — Week 3 of launch, ~June 5-11)

- Gmail inbox monitoring for replies to cold emails
- Claude classifies intent (interested / question / objection / not interested / negotiation / spam)
- Draft mode first (Gabriel approves each reply)
- Later graduate to Hybrid mode (auto for routine, draft for sensitive)
- Eventually full auto with escalation for edge cases
- Pricing locked in system prompt — no discounts, no custom packages
- Proposal PDF generation when lead signals buying intent
- Sends Stripe payment link when closing
- Escalates edge cases (legal, refunds, custom requests) to Gabriel

---

## 🎯 ROADMAP (90-day plan)

### Days 1-30 (Phase A — first 3 clients)

- Industry-specific landing pages: med spa, roofing, restaurant (URLs: /medspa, /roofing, /restaurants)
- "Free Ad Account Audit" lead magnet
- Onboarding welcome video (5-min Loom)
- 3 industry playbook PDFs
- Revision request system (button in delivery email → form → re-run API)
- Founding client rate: 20% discount on Launch ($560) and Scale ($1400) for first 5 clients in exchange for testimonial
- Goal: 3 paying clients by Day 30

### Days 31-60 (Phase B — 8 clients)

- Video testimonials from founding clients
- Testimonial section on homepage + tier pages
- Client dashboard (Phase 5):
  - Login via Supabase Auth
  - View past deliveries
  - Download links
  - Submit revision requests
  - View next delivery date
- AI Review Responder upsell ($99/mo)
- AI Missed-Call Text-Back upsell ($149/mo via Twilio)
- Annual prepay discount (2 months free for paying upfront)
- Affiliate program (20% commission per referral)
- First case study documented
- Goal: 8 paying clients by Day 60

### Days 61-90 (Phase C — Performance tier launch)

- Pick 1 existing client for Performance tier beta (free for 30 days)
- Meta Business Manager + agency partner access
- Google Ads MCC account
- Install Meta Pixel + GA4 + GTM on beta client's site
- CallRail subscription ($45/client)
- Madgicx subscription ($249/mo) — AI Meta ad manager
- Build conversion tracking setup playbook (template for future clients)
- Build performance reporting template (Claude-generated monthly reports from GA4/Madgicx data)
- Performance tier: $2,500/mo + 10% ad spend
- Performance Pro tier: $4,500/mo + 10% ad spend
- Case study #2 written from beta client
- Launch Performance tier publicly with case study
- Goal: 10-12 total paying clients + 1 Performance tier client

---

## 💡 OPTIONAL / DEFERRED (mentioned but not committed)

### Premium upsells (build only if clients ask or revenue justifies)

- Higgsfield "Hero Ads" — $199/mo add-on for 3-5 cinematic videos using client's real product/storefront photos. Trigger to build: 5+ paying clients OR client requests higher-end visuals.
- AI customer service chatbot — deploy on client's website ($200-500/mo)
- SMS marketing copy add-on
- Google My Business optimization (post copy + review response templates)

### Service expansions

- Cold email outreach generator (for B2B clients to use)
- Booking/calendar setup service ($200 one-time)
- CRM in a box (HubSpot/Notion/Airtable setup, $300 one-time)
- Conversion tracking installation ($200-500 one-time)
- Quarterly competitor analysis report
- AI-generated case studies (from client wins)

### Scale plays

- Industry-specific tiers (med spa pricing 20% higher than generic)
- White-label for other agencies (B2B reseller program)
- Client community (Skool/Discord — paid clients only)
- Done-with-you tier ($1k/mo coaching for clients who want to run ads themselves)

### Phase 8 + (managed campaigns)

- Hybrid retainer + commission model (5% of ad spend)
- Monthly performance reporting dashboard
- Lead tracking integrations
- Full sales agent with proposal generation (matures from Phase 2 reply agent)

---

## ❓ UNSURE IF COMPLETE — please confirm

These were discussed but I'm not 100% sure if they were finished. Tell me which are done.

- Stripe receipt email branding (Live mode, Settings → Branding) — uploading logo + brand colors
- Delete old test mode webhook in Stripe (cleanup)
- Stripe Radar basic fraud rules (free, in Settings)
- Update CLAUDE.md to:
  - Remove "Stripe in test mode" note
  - Add note about live mode + live webhook URL
  - Update folder name if needed
- Send 5-10 personal warmup emails from hello@griffincreativelab.com (to build sender reputation organically)
- Brand voice guide (mentioned as Launch tier deliverable but not sure if it's actually in the API output)
- Calendly settings polish:
  - Confirm event is set to Mon-Fri 12-6pm availability
  - Confirm booking confirmation comes from hello@griffincreativelab.com (not personal email)
  - Confirm Zoom/Google Meet meeting type is properly set up
- Stripe products in test mode — delete or archive (no longer needed)
- The static visual ads chain in Scenario B — confirmed working with nanobanana 2.0?
- Phase 4 webhook redetermination — has the latest webhook structure been picked up by all downstream chip pickers? (Or is there still anywhere typing chip references manually?)

---

## STRATEGIC PRINCIPLES (agreed in this session)

1. **Sales beats features.** No new features until 5 paying clients.
2. **Niche down first.** Roofing, plumbing, insurance for initial outreach (not "anyone with a business").
3. **Don't build managed campaigns yet.** Wait for case studies. Phase 8+.
4. **Don't build reply agent yet.** Wait for real reply data from first 50-100 cold emails.
5. **Lock pricing.** No discounts in cold outreach or sales conversations. Reframe to value, push to Launch tier as the entry point.
6. **Cold email = reply rate, not click rate.** Short, conversational, ONE CTA, no link in first message.
7. **Document everything.** Every client conversation, every objection, every win. Pattern-match for the offer that closes.
8. **Talk to clients weekly.** What's working? What's broken? What would they pay more for?

---

## DAILY/WEEKLY CADENCE

- Monday: AI generates fresh creative variations for managed clients (future)
- Tuesday: Review automated reports, approve scaling decisions
- Wednesday: Anomaly check, address platform issues
- Thursday: Optimize underperformers
- Friday: Generate + send client report
- Weekly: 1 client conversation
- Weekly: Cold outreach minimum 50 touches

---

## METRICS TO TRACK

| Metric | Day 30 | Day 60 | Day 90 |
|---|---|---|---|
| Paying clients | 3 | 8 | 10-12 |
| MRR | $2k-4k | $7k-11k | $13k-18k |
| Cold outreach sent | 100 | 200 | 300 |
| Reply rate | 5%+ | 8%+ | 10%+ |
| Conversion (reply → buy) | 10%+ | 15%+ | 20%+ |
| Churn | n/a | <10% | <8% |

*MRR ranges assume blended avg of ~$1,300/client across Launch/Scale/Dominate at new pricing.*

---

*This document and the 90-day plan (GRIFFINCREATIVE_90_DAY_PLAN.md) are your operating manual. Update as decisions evolve.*
