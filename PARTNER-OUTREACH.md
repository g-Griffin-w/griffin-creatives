# Referral partner outreach (separate from outfitter outreach)

Partners are businesses that already serve outfitters: insurance agents, taxidermists, tack and pack-gear shops, gear and camp-equipment makers, photographers and videographers. One good partner can introduce us to many outfitters. This is **separate** from the outfitter cold email: its own table, its own email, its own daily job.

## What exists
| Piece | Where |
|---|---|
| Table | `partner_leads` in Supabase (private; only our API reads or writes it) |
| Email sender and daily job | `api/send-partner-outreach.js`, cron in `vercel.json` (Mon–Fri, 17:30 UTC / about 10:30 am Pacific) |
| Status flow | `review` → `queued` → `sent` → `replied` (or `skipped`, `bounced`) |

## Safety (nothing sends by accident)
- **New partners start as `review`.** The job only sends rows set to `queued`.
- Small daily batch: **10 a day** by default (`PARTNER_BATCH_SIZE`, max 30).
- One **follow-up 5 days later**, in the same thread. It is skipped if the partner replied, or if we can't check the thread.
- Same compliance footer as the outfitter emails (our name, postal address, reply "stop").
- **Preview without sending:** run the job with `?dry_run=1`. Add `&status=review` to preview rows that are still in review.

## The email (fixed template, no AI writing)
Subject: *A free Google profile review for your outfitter clients*

> Hi there,
>
> I'm Gabriel with Griffin Creative Labs. We're a small marketing shop that works only with elk outfitters in the West.
>
> I'm reaching out to {business} because {one line that fits their category}. A lot of outfitters in {state} have a Google profile that isn't doing much for them: few photos, few reviews, old details. It's often the first place a hunter looks.
>
> Here's a simple offer. If you send me the name of any outfitter you work with, I'll review their Google profile for free and send them three specific fixes. No strings, and they can use it whether or not we ever work together.
>
> And when an outfitter I talk to asks about {insurance / taxidermy / tack or pack gear / gear or camp equipment}, I'll send them your way.
>
> Would that be useful? A one-line reply is plenty.
>
> Gabriel

Follow-up (day 5): a short reminder of the same offer, and "reply 'no thanks' and I won't follow up again."

## What's loaded now (36 partners, all `review`)
| Category | Count | Where they came from |
|---|---|---|
| Gear and camp-equipment makers (tents, stoves, boots, packs, calls) | 20 | Colorado, Montana and Idaho outfitter association member lists |
| Taxidermists | 7 | Colorado association member list, the National Taxidermists Association directory, and the Taxidermy Hall of Fame |
| Tack and pack-gear shops | 3 | Same |
| Insurance | 2 | Montana Outfitters and Guides Association member list |
| Other (ranch brokerage, an outdoors radio show, safety training) | 4 | Same |
| Photographers and videographers | 0 | None found with a public email yet |

By state (where known): Colorado 11, Montana 13, Idaho 5, Wyoming 3, Utah 1, Oregon 1, California 1.
Every email is one the association or the business publishes. I didn't guess or build any address.

### What the Edge browser added (Oct 20)
The Edge extension connected and loaded JavaScript-heavy pages that plain fetches couldn't. It added 3 partners and showed where emails are and aren't:
- **Idaho Outfitters and Guides Association member list:** all 78 business members are listed, but emails are hidden behind "Send Email" forms. Only about 20 have websites, and the ones I tried (Eberlestock, Selway Fabrication, Jaxonbilt Hats, PATH) don't show an email on their pages.
- **National Taxidermists Association directory:** lists members by state with names and **phone numbers**, but no emails and few websites. About 20 members each for Montana, Idaho, Wyoming and Colorado. Good for a call list, not an email list.
- **California Association of Taxidermists directory:** the list didn't load in the browser.
- **State taxidermist associations** (from the Taxidermy Hall of Fame): presidents are listed with phone numbers; only Idaho's has an email.

### Honest gaps
- **Not 20 per type per state.** Web search can't list local businesses well. Photographers, insurance agents and taxidermists for Washington, Oregon, California, Utah and Wyoming are mostly missing.
- **The fix is the Google Places API key** (the pending reminder for Oct 20). With it, a script can list "taxidermist," "outdoor photographer," "insurance agency" and "saddle shop" in each state and pull websites and phone numbers. Then we find emails the same way we did for outfitters.
- **Idaho Outfitters and Guides Association's member list** has 78 business members but hides emails behind contact forms. About 10 of them have websites we could mine.
- The association lists are mixed: some entries (diners, auto parts) aren't partners, and I left them out.

## Queued to send (Oct 20, 2026)
13 partners are `queued`: the 2 insurance contacts, 3 tack and pack-gear shops, 7 taxidermists, and the Montana Hunt and Fish Company ranch brokerage (Fay Ranches). The other 23 (gear and camp-equipment makers, and three others) stay in `review`.
The job sends 10 on the first weekday run (Wed Oct 21, about 10:30 am Pacific) and the last 3 the next day. Follow-ups go out 5 days after each first email. The first live run is also the first real test of the Gmail sending path, so check hello@ Sent on Wednesday.

## How to send
1. Look at the list: `select company_name, category, state, email from partner_leads order by category, state;`
2. Edit or remove any you don't want (`status = 'skipped'`).
3. Queue the ones to send: `update partner_leads set status = 'queued' where status = 'review' and category in ('insurance','taxidermist','tack_supply');` (pick the categories you want).
4. The job sends 10 a day starting the next weekday at about 10:30 am Pacific.
5. Replies land in hello@. Reply by hand. If someone replies, `partner_leads.status` becomes `replied` automatically the next time the job checks.

## Suggested order
Start with insurance, taxidermists and tack shops: they talk to outfitters most. Suppliers (gear makers) are weaker for referrals, so send them last.
