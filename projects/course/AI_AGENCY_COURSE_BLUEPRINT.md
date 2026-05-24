# AI Agency Blueprint — Course Mapping

**Working title:** "Solo AI Agency: Build a $10K/mo Done-For-You Creative Business from Scratch"

**Alternate titles to A/B test:**
- "The AI Agency Playbook: Zero to First Client in 30 Days"
- "Done-For-You AI Agency Blueprint"
- "Build the AI Agency They're Charging $50K for in 90 Days"

---

## WHO THIS COURSE IS FOR

- Solo founders / aspiring agency owners
- Marketers tired of trading hours for dollars
- Existing freelancers wanting recurring revenue
- People who can use a computer but aren't traditional coders
- Anyone who wants to build a productized agency without hiring a team

**What they'll have at the end:**
- A working, automated AI ad creative agency
- 3 pricing tiers with Stripe checkout live
- Cold email outreach agent sending 20-30 emails/day
- Email deliverability dialed in (10/10 mail-tester)
- A blueprint to land their first 5 paying clients
- Optional: AI sales reply agent + managed campaigns roadmap

**Course promise:** "Follow the blueprint, you'll have a paying client within 30 days OR your money back."

---

## TOOLS STACK (covered in course)

| Tool | Purpose | Monthly cost |
|---|---|---|
| Stripe | Payments, subscriptions | Free + 2.9% transaction fee |
| Vercel | Hosting, serverless functions | Free tier OK |
| Supabase | Database, auth | Free tier → $25 |
| Make.com | Automation pipeline | $9-29 |
| Google Workspace | Email, Drive, Docs | $7/seat |
| Calendly | Booking | Free or $10 |
| Anthropic Claude API | AI text generation | $20-100 (variable) |
| fal.ai | AI image + video (nano-banana, kling) | $50-200 (variable) |
| Creatomate | Video templating with text overlay | $49 |
| ElevenLabs | Voice synthesis | $5-22 |
| Apollo.io | Lead sourcing for cold outreach | $59-99 |
| Namecheap | Domain registration | ~$12/year |
| GitHub | Code version control | Free |

**Total monthly tooling: ~$300-500** (variable based on volume)

**Total upfront investment (course + tools first month): ~$500-1,000**

---

## COURSE STRUCTURE (12 Modules + Bonuses)

### MODULE 1: STRATEGY + POSITIONING (Day 1)

**Lessons:**
- 1.1 Why "Done-For-You AI Agency" is the right model right now
- 1.2 Picking your niche (decision framework: pain × revenue × accessibility)
- 1.3 Pricing strategy — why $700/$1,750/$3,500 works (and the case study of GriffinCreative testing at $500/$1,300/$2,600 first, then raising to current pricing within the launch week)
- 1.4 Service definition — what to include, what to exclude
- 1.5 Brand decisions — naming, voice, visual identity
- 1.6 Avoiding the "AI agency" branding trap (lessons learned about toning down "AI" in marketing)

**Deliverable:** Completed positioning doc

---

### MODULE 2: FOUNDATION SETUP (Day 2)

**Lessons:**
- 2.1 Buying a domain (Namecheap walkthrough)
- 2.2 Setting up Google Workspace for business email
- 2.3 Stripe account creation + tax setup
- 2.4 Calendly setup for client booking
- 2.5 GitHub + Vercel account setup

**Deliverable:** All accounts created and connected

---

### MODULE 3: ONBOARDING + DATABASE (Day 3)

**Lessons:**
- 3.1 Supabase project creation
- 3.2 Database schema design (covered: `griffin_clients` table architecture)
- 3.3 Building the onboarding form (HTML + Supabase write)
- 3.4 Required vs optional fields decision tree
- 3.5 `ifempty()` patterns for graceful nulls

**Deliverable:** Working onboarding form that writes to Supabase

---

### MODULE 4: AI CONTENT API (Days 4-5)

**Lessons:**
- 4.1 Anthropic API setup + getting your API key
- 4.2 Vercel serverless function basics
- 4.3 Designing the master content generation endpoint
- 4.4 Prompt engineering for ad copy (with examples)
- 4.5 Prompt engineering for email sequences
- 4.6 Prompt engineering for content calendars
- 4.7 Speed optimization (Sonnet vs Haiku per task)
- 4.8 Plan detection from Stripe `amount_total`
- 4.9 Tier-based output scaling (Launch vs Scale vs Dominate)

**Deliverable:** Live API endpoint at `yourdomain.com/api/generate-deliverables`

**Code template included:** Full `generate-deliverables.js` reference implementation

---

### MODULE 5: AUTOMATION PIPELINE — SCENARIO B (Days 6-7)

**Lessons:**
- 5.1 Make.com workspace setup
- 5.2 Stripe webhook → Make.com trigger (Module 1)
- 5.3 Gmail welcome email module
- 5.4 Supabase trigger as the main fulfillment kickoff
- 5.5 HTTP module calling your API
- 5.6 Google Drive folder + subfolder creation
- 5.7 Google Docs creation for each deliverable
- 5.8 Router pattern: branching by plan tier
- 5.9 Filter rules using `amount_total`
- 5.10 Tier-aware delivery email at end

**Deliverable:** Working Scenario B that fires on Stripe payment and delivers docs to Drive

**Make.com scenario blueprint included** (importable JSON)

---

### MODULE 6: AI VISUAL CONTENT — SCENARIO B EXTENDED (Days 8-9)

**Lessons:**
- 6.1 fal.ai account + API key setup
- 6.2 nano-banana 2.0 for static ad generation
- 6.3 Iterator pattern: looping over visual concepts
- 6.4 Downloading + uploading to Drive
- 6.5 Cost optimization (per-image pricing)

**Deliverable:** Static visual ads delivered automatically per client

---

### MODULE 7: AI VIDEO PIPELINE — SCENARIO C (Days 10-12)

**Lessons:**
- 7.1 Splitting the pipeline (why Scenario C exists)
- 7.2 Webhook handoff from B to C
- 7.3 kling video generation (text-to-video)
- 7.4 Creatomate template design for text overlay + branding
- 7.5 Marking template fields as dynamic (the pencil icon trick)
- 7.6 ElevenLabs voice integration via Creatomate
- 7.7 Array Aggregator for collapsing iterator bundles
- 7.8 Final delivery email after all videos finish

**Deliverable:** AI-generated, voice-overed video ads delivered to Drive

**Creatomate template blueprint included**

---

### MODULE 8: SMART DEFAULTS + INDUSTRY ROUTING (Day 13)

**Lessons:**
- 8.1 Why one-size-fits-all voice fails (the med spa lesson)
- 8.2 Designing the industry → voice mapping table
- 8.3 Implementing `pickVoice()` in the API
- 8.4 Router branching by voice in Scenario C
- 8.5 Two-template architecture (Charlie + Sarah)
- 8.6 Filter rules: `voice_name = Sarah` vs `Charlie`
- 8.7 Adding a 3rd voice later (extension pattern)

**Deliverable:** Industry-aware voice routing live

---

### MODULE 9: EMAIL DELIVERABILITY (Day 14)

**Lessons:**
- 9.1 Why deliverability is the #1 thing that kills new senders
- 9.2 DKIM record setup in Google Workspace + DNS
- 9.3 SPF record (`v=spf1 include:_spf.google.com ~all`)
- 9.4 DMARC record (start with `p=none`, tighten later)
- 9.5 Verifying propagation via mxtoolbox.com
- 9.6 Activating authentication in Google Admin
- 9.7 Mail-tester.com — getting to 10/10
- 9.8 Domain warmup strategy (5-10 personal emails first)

**Deliverable:** 10/10 mail-tester score + verified Google authentication

---

### MODULE 10: WEBSITE + STRIPE CHECKOUT (Day 15)

**Lessons:**
- 10.1 HTML structure for an agency landing page
- 10.2 Tier card design with pricing + features
- 10.3 Creating Stripe products + payment links
- 10.4 Switching from Test mode to Live mode
- 10.5 The critical webhook event destination setup
- 10.6 Verifying with a $1 test payment
- 10.7 Stripe receipt email branding (logo + colors)
- 10.8 Add-on services + pricing
- 10.9 Conversion-optimized copy (the "Done-For-You" angle)

**Deliverable:** Live website with working Stripe checkout

**Landing page HTML template included** (full GriffinCreative HTML as reference)

---

### MODULE 11: COLD EMAIL OUTREACH AGENT (Days 16-19)

**Lessons:**
- 11.1 Apollo.io setup + plan selection
- 11.2 Building niche-specific search filters (Roofing, Plumbing, Insurance examples)
- 11.3 Supabase `outreach_leads` schema design
- 11.4 Gmail API setup in Google Cloud Console (OAuth2 + refresh tokens)
- 11.5 Designing the personalization prompt
- 11.6 Cold email best practices:
  - Email #1: no link in body, signature only
  - One CTA per email
  - No pricing in cold email
  - Question-style subjects
- 11.7 Orchestrator script: lead pull → Claude → Gmail
- 11.8 Throttling pattern (90-sec delays)
- 11.9 Vercel cron deployment
- 11.10 Reply detection via Gmail API
- 11.11 Scaling from 20/day to 100/day safely (sender reputation building)

**Deliverable:** Autonomous outreach agent sending 20-30/day

**Code template included:** Full Node.js outreach agent

---

### MODULE 12: AI SALES REPLY AGENT (Days 20-24)

**Lessons:**
- 12.1 Why you don't build this before having real reply data
- 12.2 Gmail inbox monitoring
- 12.3 Intent classification with Claude (interested / question / objection / etc.)
- 12.4 Brand voice prompts — how to make AI sound like YOU
- 12.5 Locking pricing in the system prompt (no discounts ever)
- 12.6 Proposal PDF generation
- 12.7 Stripe payment link delivery
- 12.8 Three operating modes: Draft → Hybrid → Full Auto
- 12.9 Escalation rules (when to hand off to human)

**Deliverable:** AI sales agent in Draft mode

---

## BONUS MODULES

### BONUS 1: SCALING TO MANAGED CAMPAIGNS (Phase 8)

- Meta Business Manager + agency partner access
- Google Ads MCC accounts
- GA4 + GTM installation playbook
- CallRail for call tracking
- Madgicx for AI ad management
- Performance tier pricing ($2,500/mo + 10% spend)
- Going from creative-only to outcome-driven pricing

### BONUS 2: CLIENT MANAGEMENT (Phase 5)

- Building a simple client dashboard (Next.js + Supabase Auth)
- Revision request system
- Onboarding video creation
- Industry-specific playbooks for clients

### BONUS 3: UPSELL ENGINE

- AI Review Responder ($99/mo)
- AI Missed-Call Text-Back ($149/mo)
- SMS marketing
- Higgsfield Hero Ads
- Annual prepay discount (2 months free)
- Affiliate program (20% commission)

### BONUS 4: THE PROMPT VAULT

All prompts used in production, ready to copy/paste:
- Ad copy generation (per industry variants)
- Email sequence generation
- Content calendar generation
- Visual ad concept generation
- Video script generation
- Cold outreach personalization
- Sales reply classification + drafts
- Proposal generation

### BONUS 5: TROUBLESHOOTING + DEBUGGING

Real-world issues we hit and how we solved them:
- "voice_name is null in webhook" — chip path mismatch (`3.voice_name` vs `3.data.voice_name`)
- "Creatomate render says template_id missing" — env var not deployed
- "DKIM not verifying" — DNS propagation timing
- "Emails landing in spam" — missing DMARC
- "Make.com Stripe trigger not firing" — test vs live mode mismatch
- "Module 14 brand_voice required" — ifempty fallbacks
- "Two webhooks fired same scenario twice" — git push happened twice (no impact)

This module alone saves people 20+ hours of debugging.

---

## SUPPLEMENTARY MATERIALS

### Templates included:
- Full HTML landing page (yours, customizable)
- Onboarding form HTML
- API endpoint (`generate-deliverables.js`)
- Make.com scenario blueprints (Scenario B + C exportable JSON)
- Creatomate template files
- Supabase SQL schemas
- Cold email outreach agent (Node.js)
- AI sales reply agent (Node.js)

### Worksheets:
- Niche selection scorer
- Pricing calculator
- Voice mapping table per industry
- Cold email subject line bank
- Objection-handling scripts

### Resources:
- Tool comparison guides (Apollo vs Instantly vs Smartlead, etc.)
- Compliance checklist (GDPR, CAN-SPAM)
- Sender reputation monitoring guide

---

## COURSE BUSINESS STRATEGY

### Pricing tiers (suggested)

| Tier | Price | Includes |
|---|---|---|
| **Self-Study** | $497 | Course + templates + prompts |
| **Implementation** | $1,497 | Self-Study + private community + monthly Q&A calls |
| **Done-With-You** | $4,997 | Implementation + 4 1-on-1 coaching calls + custom code review |
| **Done-For-You** | $12,000+ | We build the entire system for them in 30 days |

### Sales funnel

1. **Lead magnet:** Free PDF "5 Tools Every Solo AI Agency Needs" → email opt-in
2. **Nurture sequence:** 7-email series teaching the concepts → soft pitch the course
3. **Live webinar** weekly: "How I Built an AI Agency Solo (And You Can Too)" → pitch at end
4. **Affiliate program:** 30% commission to anyone who shares the course
5. **VSL (Video Sales Letter):** 30-min walkthrough on the course sales page

### Marketing channels

- **YouTube:** "I Built an AI Agency in 14 Days — Here's Everything I Did" (case study video pulling on your real journey)
- **Twitter/X:** Daily threads breaking down lessons + screenshots of your actual builds
- **LinkedIn:** Long-form posts targeting marketers, freelancers
- **Reddit:** r/Entrepreneur, r/SaaS, r/marketing — share specific tactical wins
- **Cold email:** Use your own cold email agent to pitch the course to existing freelancers

### Hosting platform options

- **Skool** ($99/mo): Community + course in one. Best for active engagement.
- **Kajabi** ($149+/mo): Polished course + funnels + email.
- **Teachable** ($59+/mo): Simpler, lower cost.
- **Self-hosted** (Next.js + Stripe + Supabase): Build it yourself using the same stack — meta-credibility play.

My pick: **Skool for community + course delivery.** Best at $99/mo. Plus the community becomes its own selling point ("join 247 other solo AI agency builders").

### Recurring revenue play

Beyond one-time course sales, offer ongoing:
- **$97/mo membership** — access to updates, new modules, community, monthly group calls
- This converts course buyers into recurring revenue
- Estimate: 20-30% of course buyers convert to membership

### Revenue projection

Conservative scenario, 12 months:
- 100 course sales at $497 average = **$49,700**
- 30 membership conversions at $97/mo × 6 mo avg = **$17,460**
- 5 Done-With-You at $4,997 = **$24,985**
- 2 Done-For-You at $12,000 = **$24,000**

**Year 1 total: ~$116,000**

Plus you still have GriffinCreative running in parallel.

### Time investment

- **Course creation:** 6-8 weeks (video recording, editing, slides, templates) if done aggressively
- **Course launch:** Pre-launch waitlist 4 weeks before, launch week with discount
- **Ongoing maintenance:** ~5 hrs/week (community engagement, content updates)

---

## MY HONEST STRATEGIC TAKE

You have a real product here. The journey you went through is genuinely valuable IP — most people trying to build AI agencies don't even know where to start, what tools to pick, or how to wire it all together. The pain points you hit (and solved live in this session) are the EXACT pain points your future students will hit.

**My recommendations:**

1. **Don't build the course yet.** First, finish landing 3-5 paying clients for GriffinCreative. Why? Because credibility sells courses. "I built this and got X clients" is a way stronger pitch than "I built this and you should too." Hard data > hypothesis.

2. **Document publicly while you build.** Tweet daily what you're doing. YouTube the wins and the debugs. By the time you have 5 clients, you'll have built an audience that's primed to buy the course.

3. **Pre-sell before building.** Once you have 5 clients + an audience, offer the course at a founding member rate ($297 instead of $497) to people who'll buy before content is recorded. If 20 people buy = $6,000 upfront + validation. Then build the course.

4. **Build the course in public.** Stream Loom videos of the actual modules. People love seeing real implementations, not staged tutorials.

5. **Use your own product to market it.** Your AI ad creative engine can generate course launch ads, social posts, email sequences. Eating your own dog food is the strongest validation.

### Timeline suggestion

| Month | Focus |
|---|---|
| Now - Month 2 | Land first 5 clients. Document publicly. Build audience. |
| Month 3 | Pre-sell course at $297 to founding 20-30 members. |
| Month 4-5 | Build course. Module a week. |
| Month 6 | Launch publicly at $497. Targeted at people who saw your content. |
| Month 7+ | Recurring sales + membership recurring revenue. |

---

## WHAT MAKES THIS COURSE DIFFERENT

There are dozens of "AI agency" courses on the market. Most are:
- Generic ("use ChatGPT to find clients!")
- High-level ("build a brand, find a niche")
- Outdated (still teaching GPT-3.5 prompts)
- Theoretical (no actual code or systems)

Yours would be:
- **Specific** — exact tools, exact configs, exact prompts
- **Tactical** — actual working code and templates
- **Real** — built on a real business that's making real money
- **Current** — uses 2025-2026 tooling (Claude Opus 4.x, nano-banana 2.0, kling v3)
- **Complete** — covers business setup → first client, not just "the AI part"

This is your moat.

---

## NEXT STEPS

**If you want to start building the course now:**
1. Create a separate folder for course assets
2. Start recording loom videos of YOUR actual workflow (you're doing it anyway)
3. Save every screenshot, every debug, every conversation
4. Add a "course content captured ✓" note to each phase as you go

**If you want to wait until you have clients:**
1. Keep this document as the master reference
2. Each time you fix a problem in your agency, add it to the "Troubleshooting" bonus module
3. When you hit 5 clients, revisit this doc and start recording

Either path works. The course writes itself either way — you're already living it.

---

*Document maintained at: /Users/gabewigginton/griffin-creatives/AI_AGENCY_COURSE_BLUEPRINT.md*
*Last updated: May 22, 2026*
