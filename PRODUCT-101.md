# Product 101: what Booked Out is, what we do, what we host

Read this once before your next call. Everything marked **Built** exists in the repo today. **Manual** means we do it by hand. **Not built** means we shouldn't promise it as automatic.

## The one-sentence version

> "We make sure a hunter who Googles an elk outfitter in your area finds you and trusts you, and we keep last season's hunters coming back and sending friends. You keep ownership of everything."

## The 30-second version (cold call, when they ask what you do)

> "Two things. First, when a new hunter searches for an outfitter, we make sure your Google profile, reviews and photos make you look like the obvious choice. Second, we email your past hunters at the right times, after the season and before the application deadline, so they rebook or refer a friend. It's $2,800 a month, no contract, and everything we build stays yours."

## The 2-minute version (when they ask "what do I actually get?")

1. **Found by new hunters.** We set up and tune your Google Business Profile: categories, service area, description, real photos from your hunts, and answers to the questions hunters ask. We get you a direct review link and a simple way to ask every hunter for a review.
2. **Trusted once they find you.** Reviews are where hunters decide. We draft your review replies, and you approve them the first month.
3. **Past hunters come back.** We build a rebooking email sequence from your real details and send it to your past-client list on the right dates: a thank-you after the season, a "dates are open" note in December, and a reminder before your state's application deadline.
4. **Referrals.** A link past hunters can share with a friend, with an incentive you pick.
5. **A monthly report** on what changed: reviews, profile views, calls and clicks, emails sent and replies.

## What we do, week by week

| When | What happens | Status |
|---|---|---|
| **Call (day 0)** | Triage the Google profile with them: does it exist, who owns it, any duplicates. | Built (SOP) |
| **Week 1** | They fill in the onboarding form and add us as a *Manager* on Google (4 clicks, they do it). If there's no profile or it's unverified, they record a verification video on their phone. We collect photos and past-client names. | Built (SOP + onboarding.html) |
| **Week 1–2** | We fill in every profile field, upload photos, add Q&A, write the first post. We get their review link ready. | Manual (SOP checklist) |
| **Week 2–3** | We draft the rebooking sequence from their real facts (their dates, a real detail from last season). They approve it. We load their past-client list. | Built (draft + approve + import scripts) |
| **Week 3–4** | They start asking every hunter for a review (we give them the message to send). First monthly proof-content batch of finished ad images. | Review asks are **manual**; content batch is built |
| **Month 2–3** | Reviews start coming in. Profile starts showing for more searches. Rebooking emails fire on the season dates (December, then the application reminder in spring). | Built (daily cron, dates seeded through 2027) |
| **Every month** | 2–4 profile posts, new photos, review replies, one report. Check for duplicates, fake reviews, season changes. | Manual |
| **Each season** | Update dates, "currently booking," hunt availability. Seed next year's dates. | Manual |

## How to explain "it's not overnight"

The honest version helps us. Outfitters have been burned by agencies promising fast results.

> "I want to be upfront: this isn't a switch that turns on bookings next week. The first month is setup, getting your profile verified and filled in, and getting your reviews started. You'll see the profile looking better within a couple of weeks. Reviews and search visibility build over two to three months. And your past-hunter emails go out on the dates that matter, which is December and before your state's application deadline. A guided hunt is a big decision, and hunters often plan a year out. So it works like building a good reputation, not running a sale."

Specific timelines you can say out loud:
- **Google verification:** minutes to about a week. Some profiles only get a video option, and it can fail. Say "up to a week." We hit this ourselves on Oct 14.
- **Profile edits:** live quickly, but Google takes a few weeks to reflect them in search.
- **Reviews:** they depend on hunters. The first few come in weeks, a real set takes a season.
- **Rebooking emails:** timed to the calendar. A December email won't produce a booking in November.
- **First honest result check:** 60 to 90 days. That's why the founding offer asks for a testimonial after 60 days.

Never say: "you'll rank #1," "you'll get X bookings," or "results in 30 days." We have no case studies yet; say so.

## What we can host, what we can't, and how it looks

**The rule: the client owns every account. We're invited in as a manager. If they cancel, they remove us in one click and keep everything.**

| Thing | Who owns it | Where it lives | What we do |
|---|---|---|---|
| Google Business Profile | Client | Google | Manager access (never Owner, never their password). Full edits. |
| Reviews | Client / hunters | Google | Draft replies. Client approves in month one, then we post. We never write or buy reviews. |
| Their website | Client | Their host (Wix, Squarespace, WordPress, etc.) | Only if they invite us as a collaborator. Title tags, descriptions, an elk page. If the site is bad or we can't get in, we tell them what to change. |
| Rebooking emails | Client's list and copy | Our system stores and schedules them; they send from the client's own Gmail | We store the approved sequence and past-client list and send on schedule. Replies go to the client's inbox. On cancel, we hand over the list and the copy and disconnect the mailbox. |
| Landing pages (referral, ad click-through) | Client's content | Our domain (griffincreativelab.com/api/lp?c=...) | We build and track them. They live on our domain, not theirs. |
| Proof-content ad images | Client's photos | Our files | We make finished images from their real hunt photos. They get the files. |
| Monthly report | Us | Sent to them | Manual for now. |

**What we do not host or do**
- **Their domain or business email.** We don't host or manage those.
- **Their main website as a hosting service.** We *could* build and host one on Vercel, but that is a new promise and a new job. Don't offer it unless you decide to.
- **Payments, deposits or booking calendars.** "Booking system setup" means an inquiry form, an instant reply, a Calendly link, a deposit link and follow-up emails. It's not a custom system.
- **Review requests by text message.** Not built. Requests go by email only.
- **Paid Google ads.** Parked until we've practiced on our own spend. Not in the $2,800.
- **Tag draws, licensing or legal advice.** We link the state agency and use the dates we've verified.
- **Their social media accounts** (beyond Google profile posts). Not part of the offer.
- **Guaranteed bookings, rankings or reviews.** Never.

**How to say it to a client:**
> "Everything lives in your accounts, not ours. You add us to your Google profile as a manager, we do the work inside it, and you can remove us any time. The one thing that runs on our side is the email schedule, and those emails go out from your own address. If you ever leave, we give you the list and the emails."

## Where the product stands today

| Piece | Status |
|---|---|
| **Review requests** | **Built (email).** The client pastes who just left camp into their intake page; each hunter gets a request the day after the hunt, plus one reminder if they haven't opened it. Text-message requests are not built (no SMS provider; carriers also require registration). Say "by email". See CLIENT-MAILBOX-SETUP.md. |
| **Rebooking emails send from the client's own address** | **Built** for Gmail and Google Workspace clients (they approve one "send email" permission). Others fall back to hello@ with their name and Reply-To. Needs the one-time Google Cloud setup in CLIENT-MAILBOX-SETUP.md before it works. |
| **Booking setup** | **Defined.** Inquiry form, instant reply, call scheduler, deposit link, and follow-up templates. Not custom software. See BOOKING-SEQUENCE.md. |
| **Referral crediting** | **Ledger, not automatic.** A code on the inquiry form plus the `referrals` table. Fully automatic needs the client's payment tool (Stripe) wired in. See BOOKING-SEQUENCE.md. |
| **Monthly report** | **Built.** REPORT-TEMPLATE.md and `scripts/make-client-report.js`. |
| **Capacity** | **Estimated, not measured.** About 14 hours to onboard and 6 hours a month after. See CAPACITY.md. Time client #1 for real. |
| **Client onboarding** | **Tools built, untimed.** The form collects bookings, terms and mailing address; scripts import the hunter list and draft the Google profile text, booking kit and rebooking sequence from the client's own answers. See ONBOARDING-CALL.md. Tested on a throwaway client only. |
| **Site or hosting offer** | **Not offered.** Decide whether to keep it out (simplest) or add it later. |

Nothing above is live until the code is pushed and the Google Cloud setup is done.

## Likely questions from outfitters

| They ask | Answer |
|---|---|
| "What exactly do you do?" | The 30-second version, then ask where their new hunters come from. |
| "Do you need my passwords?" | No. You invite us as a manager. Never a password. |
| "Do you host my website?" | No. Everything stays where it is. We tune what's there, or tell you what to change. |
| "How fast will I see bookings?" | Honest: profile in weeks, reviews in a season, rebooking tied to the calendar. Check in at 60 to 90 days. |
| "What if I cancel?" | Remove us in one click. You keep your profile, reviews, list and emails. |
| "Is this ads?" | No. It's local search and email. Paid ads are an optional add-on we're not selling yet. |
| "Why $2,800?" | One extra guided hunt is $4,000 to $7,000, so one booking covers more than a month. No contract. |
| "Do you have clients or results?" | "Not yet. That's why I'm offering six founding spots, with the first month free for the first three." |

## Before your next client call

- Read the call script in [FOUNDING-CLIENTS.md](FOUNDING-CLIENTS.md) and the Google profile steps in [GBP-CLIENT-SOP.md](GBP-CLIENT-SOP.md).
- Pick one Utah outfitter and run the audit by hand (search their name, note 2 or 3 real gaps). Then you've seen the work once.
