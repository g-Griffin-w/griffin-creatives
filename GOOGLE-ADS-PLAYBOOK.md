# Google Ads for elk outfitters — playbook

How we run Search ads for a client, how to price it, how to explain ad spend, how we start with our own account, and what we can automate.
Status: **plan, not yet tested.** We have not run a Google Ads campaign for an outfitter. Every number marked *(guess)* is a placeholder to replace with real data from Keyword Planner and our first campaigns.

## 1. Google's ad policy for hunting services (checked Oct 20, 2026)

**What I found**
- Google's "Guns, gun parts, and related products" policy prohibits ads for firearms ("hunting guns" are named), ammunition, and parts that enhance a gun's function (scopes, bipods, stocks, silencers). It lets Google "err on the side of caution" and apply the policy to sporting and recreational guns. Source: [Google Ads policy: Guns](https://support.google.com/adspolicy/answer/16489226).
- **The policy page does not mention guided hunts, outfitters or hunting trips at all.** It is written about *products*. I found no Google page that allows or bans a guided-hunt service by name.
- A pilot starting October 2026 allows some gun accessories on Search in the US for six months. It does not cover firearms or ammunition and doesn't affect outfitters. Source: [Updates to the dangerous products policy, Oct 2026](https://support.google.com/adspolicy/answer/17455968).
- Hunting **licenses and permits** fall under a separate "Government documents and services" policy. Don't advertise "apply for your elk tag" or similar, because that needs authorization. Source: [Government documents and services](https://support.google.com/adspolicy/answer/13156083).
- A marketing blog says Meta treats hunting outfitters as a restricted category but allows them. That is about Meta, not Google, and I can't verify it.

**What that means for us**
- A guided-hunt service is **not explicitly prohibited**, but it isn't explicitly approved either. The risk is that Google's review sees rifles, ammo or gear in an ad or on the landing page and flags it.
- So the rule is: **sell the trip, not the gun.**

**How to stay safe**
- Ad text: say "guided elk hunt," dates, location, what's included. Don't use "rifle," "ammo," "scope," "weapon," "kill" or "trophy shot."
- Images on the landing page: camp, horses, country, hunters smiling, animals in the field. No close-ups of firearms or anyone aiming.
- Landing page: don't sell or list gear. Don't link to a store that sells firearms or ammo.
- Don't advertise tags, permits or the application process.
- **Test before spending:** create the first ad in a campaign set to *paused*, then enable it with a tiny daily budget. Check the "Policy status" column the same day. If it's disapproved, read the reason, edit, and use the appeal option. Google's policy support can confirm a specific ad.
- Do this check with **our own account first** (Section 3) so we learn how Google treats the wording before a client's account is involved. A disapproval on a client's new account is harder to undo.

**Still unknown:** whether Google will limit hunting service ads in some states or on some placements. We'll find out in testing.

## 2. How to price it (two separate numbers)

Charge for **our work** (the fee) and let the client pay **ad spend** (money paid to Google) separately from their own card. Never bundle ad spend into our fee: it hides the cost and ties our margin to Google's prices.

### Our fee ($2,800/mo today)
Check it three ways. If all three look fine, keep it.
1. **Value to the client.** What is one extra booking worth to them? Use their own numbers:
   - Average price of a hunt, minus their costs to run it (their profit per booking).
   - Our fee ÷ profit per booking = **how many extra bookings a year the service must produce to pay for itself.** The site's math says one extra client covers 1.5+ months, so it assumes a hunt worth about $4,200+ in revenue. Ask each client for theirs.
2. **Our cost to serve.** Track hours for the first three clients. Placeholders *(guess)*: about 10–15 hours of setup and 8–12 hours a month after that. Fee ÷ monthly hours = your hourly rate. If that rate is too low, raise the fee or narrow what's included.
3. **What the market takes.** After 10 real conversations, count how many said "too expensive." If most do, test a lower entry plan. If almost nobody does, you may be too cheap.

Ways to set the fee differently: a flat fee for everything (what we do now), a lower fee plus a percentage of ad spend (a common agency method; the usual range is around 10–20% of spend, *(general practice, not our data)*), or a base fee plus a bonus per booked seat. Start flat. It's simplest to explain, and a per-booking bonus needs trust and good tracking.

### Ad budget (client pays Google directly)
Size it bottom-up from real search data, not from a guess.
1. In Google's **Keyword Planner** (free in any Google Ads account), enter 10–20 booking-intent keywords for the client's region and read the monthly searches and the typical cost per click (CPC).
2. Estimate: **monthly clicks = monthly budget ÷ CPC.**
3. Estimate bookings: **clicks × conversion rate (inquiry) × close rate.** Use placeholders *(guess)* until we have data, for example 2–5% of clicks become inquiries and 10–25% of inquiries book. These are not predictions.
4. Check it pays: **expected bookings × profit per booking** should be more than **ad spend + our fee**. If not, the budget is too small to matter or the keyword is too expensive. Say so to the client before launch.
5. Start with a modest **test budget** for 30 days *(guess: roughly $15–$30 a day)*, then adjust once real numbers are in.

Volume is the limit in this niche. If Keyword Planner shows only a few hundred searches a month for the client's area, no budget will produce many bookings. Be honest about that in the proposal.

## 3. How we start our own Google Ads (Griffin Creative Labs)

Our own campaign is a **learning lab**: same method as a client, tiny budget, real data.

**What you do (I can't enter card details or create accounts):**
1. Go to ads.google.com with hello@griffincreativelab.com. Create the account. When it offers a guided campaign, choose **"Switch to Expert Mode"** and skip the campaign.
2. Add billing (your card) and set the time zone and currency carefully; they can't be changed later.
3. Create a **manager account** (MCC) at ads.google.com/home/tools/manager-accounts, then link our own account under it. Future clients link under this manager account.

**What I can set up on our side:**
- A signup source for ads: today `starter-kit.html` records `outreach_email` or `social`. Add `?src=gads` so ad signups are separate. Needs a small code change and a check that the signups table accepts new values.
- Conversion tracking: a Google tag on `starter-kit.html` that fires when the signup succeeds (the "free guide signup" conversion).
- A Search campaign: landing page `starter-kit.html`; keywords like "marketing for outfitters," "outfitter marketing," "hunting guide marketing," "elk outfitter website"; location: the states we serve; a very small daily budget. Expect very little volume because our audience is small. That is fine for a test.
- A short **negative keyword list** (jobs, free, template, course) from day one.

**What we learn:** cost per click, cost per signup, whether Google approves hunting-adjacent wording, and how the dashboard and reports behave, all before a client's money is involved.

## 4. Telling a client what ad spend will be

Say it three times: on the call, in the proposal, in the first report.

**On the call:**
> "There are two costs. Our fee is $2,800 a month. Ad spend is separate: it goes straight to Google from your card and we never touch it. We'll recommend a starting amount based on how many people actually search for hunts like yours, and you can pause or lower it any time. We don't mark it up."

**One-page budget proposal (we fill in from Keyword Planner):**

| | Starter | Standard | Push |
|---|---|---|---|
| Daily ad spend | $__ | $__ | $__ |
| Monthly ad spend (daily × 30) | $__ | $__ | $__ |
| Estimated clicks (spend ÷ CPC) | __ | __ | __ |
| Our fee | $2,800 | $2,800 | $2,800 |
| **Total monthly cost** | $__ | $__ | $__ |
| Bookings needed to break even (total ÷ profit per booking) | __ | __ | __ |

**Always say:**
- Spend is a cap, not a target. Daily budget limits what Google can spend.
- The first 2–4 weeks are learning time. We won't judge results before then.
- We can't promise bookings. We promise to show where every dollar went and what came back.
- Spend appears on their own Google Ads account, which they can open any time.

## 5. Can we automate tracking and have AI watch the ads?

**Short answer:** most of it, yes. Keep a human approving money and anything that stops a campaign, at least for the first months.

### Level 1: Tracking (do this first, mostly one-time per client)
- Google tag + GA4 on the client's site; conversions for form submit, click-to-call, booking page visit.
- Call tracking with Google forwarding numbers on the ad, so phone inquiries are counted.
- Link their Google Business Profile and Google Ads accounts.
- A per-client record in Supabase (a table like `ad_clients`) with: Google Ads customer ID, daily budget, target cost per inquiry, and the pause rules below.

### Level 2: Reporting (free, automated)
- **Looker Studio** dashboard or a **weekly email** per client: spend, clicks, calls, forms, cost per inquiry, top search terms.
- **Google Ads scripts** (small JavaScript programs that run inside the account on a schedule) can email the weekly report and flag anything odd. Free, no developer approval.

### Level 3: AI watching and proposing changes
- **Google Ads API** lets our own code read stats and make changes. It needs a **developer token** from the manager account, applied for with Google. I don't know how long approval takes; start the application early.
- Pattern: a nightly job (we already run crons on Vercel) pulls each client's search terms and keyword stats into Supabase, and Claude reads them and writes recommendations: add these negative keywords, pause this keyword, this ad's wording needs work. A page like our call sheet shows the proposals, and you approve with one tap.
- **Adspirer** (a connector in this environment) is another way to let AI read and change Google Ads. It needs sign-in and I haven't confirmed its limits or cost. Look at it later.

### What may auto-run, what must not
**Safe to automate (hard rules, no AI judgment):**
- Add a negative keyword when a search term matches a banned list (jobs, free, DIY, public land).
- Pause a keyword that has spent more than a set dollar amount with zero conversions.
- Email an alert when spend is far above or below budget, or when conversions stop.

**Needs your approval:**
- Raising a budget, creating campaigns, changing bidding, changing ad copy, pausing a campaign.
- Any rule based on small numbers.

**Why the caution:** in this niche clicks are few, so a keyword with 6 clicks and no booking is not evidence of anything. AI that "optimizes" on a handful of clicks will pause things that were working. Judge by spend thresholds, not conversion rate, and review the account monthly, not daily.

**Build order:** tracking → weekly report → nightly data pull → AI proposals → limited auto-rules.

## 6. Launch checklist per client
- [ ] Intake: their hunt dates, price, what's included, past-client home states, booking page.
- [ ] They accept our manager-account link; their card is on their own account.
- [ ] Policy check of the landing page (no gun images or gear for sale).
- [ ] Conversion tracking tested end to end (submit the form, see the conversion).
- [ ] Keywords and negatives from Keyword Planner; ad drafts approved by the client.
- [ ] Campaign created **paused**, ads approved by Google, then enabled with the test budget.
- [ ] Day 3: check for disapprovals and spend pace. Week 2: search terms and negatives. Week 4: first report and budget decision.

## Open items
- Apply for the Google Ads **developer token** (needs the manager account first).
- Create our own account and run the policy test.
- Add `?src=gads` to the signup page.
- Decide: ad spend always paid by the client, yes or no.
