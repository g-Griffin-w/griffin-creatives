# To-do — Monday Oct 19, 2026 (lead focus, ~6 hours)

Note: you said "Mon Oct 18" but Oct 18 is Sunday. This list is for **Monday Oct 19**.

## Where we are (Sun Oct 18)
- **Cold email:** 196 sent since Oct 10 (about 23/day). **341 queued: WY 224 · OR 93 · MT 13 · ID 7 · WA 4.** That is about 15 days of sending, and MT/ID are nearly gone, so the pool is mostly Wyoming and Oregon after this week.
- **Follow-ups running:** the day-3 "simpler version" and day-8 "last note" emails are going out on schedule. 105 leads are 4+ days old.
- **Replies:** 0 real replies. **2 bounces today** (see item 2).
- **Signups:** 0 real. The only `social` row is your own test.
- **One warm signal:** **Rugg's Outfitting (Superior, MT)** opened the signup page Sun Oct 18 at about 8am Mountain. Owner email kip@ruggsoutfitting.com, phone **(406) 822-2061**. They got our first email Oct 12. It could still be a scanner, but a Sunday-morning view is more likely a person.
- **DMARC:** fine. Google, Microsoft and Yahoo reports all show DMARC pass.
- **Associations:** IOGA, WYOGA and MOGA were emailed Oct 15. No replies yet.

## Monday, in order (6 hours)

### 1. Triage and the warm lead (45 min)
1. **Inbox sweep (10 min).** Replies first. Also check ioga.org, wyoga.org and mogamt.org.
2. **Clean up the 2 bounces (10 min).**
   - `contact@bobmarshallwindernessoutfitters.com`: the domain looks misspelled ("winderness"). Find the real site and fix the address.
   - `elkhunter@montana.com`: dead address. Look for another contact or move the lead to the phone list.
   - Mark both `skipped` or fix them in `outreach_leads`. Tell me and I'll do the SQL.
3. **Call Rugg's Outfitting, (406) 822-2061 (15 min).** This is the one lead who may be engaged.
   - Open with: "I sent you a note last week about free guides for elk outfitters. Did the signup page work for you?"
   - Offer to email the guides directly. Don't pitch the $2,800 plan yet.
   - Rifle season: try 7–8am or after 6pm.
4. **IOGA call, (208) 342-1438** if you didn't get to it Friday. Ask about the vendor packet and booth price (vendor fair Dec 1).
5. **Check results (10 min).** `select * from guide_engagement order by last_view desc;` and any new `lead_magnet_signups`.

### 2. Phone block (90 min)
6. **15 calls from `phone-leads.csv`.** It has 29 phone-only leads (ID 13, WY 9, MT 5, OR 1, WA 1). Start with Idaho. Script is in `ASSOCIATION-OUTREACH.md`.
   - Goal of every call: get an email address and permission to send the guides. A yes is a lead.
   - Log each call: no answer / voicemail / got email / not interested. Voicemail is fine; leave 20 seconds and your number.
   - Best windows in season: early morning and evening.

### 3. Post and engage (45 min)
7. **Post the Rebook Monday carousel (9 slides, ready in `content-posts/2026-10-19-rebook-monday-1/`).** AirDrop the slides to your phone. Caption draft:
   > The rebooking sequence, word for word: the thank-you, the rebook, and the application reminder. Ten days of silence? Send one line, then stop. The full templates are free: tap "Free guides!" in our bio.
   >
   > #elkhunting #guidedhunts #outfitter #huntingoutfitters
8. **Add the Story link sticker** to griffincreativelab.com/starter-kit.html. Post a Story with it. This is the only clickable path from Instagram.
9. **Engage 20 elk outfitter accounts (25 min):** follow, then like and leave a real comment on 2–3 posts each. No DMs yet. Outfitters who follow back are warm.

### 4. Lead-building (90 min)
10. **Find emails for the phone-only leads (45 min).** Their websites are in `phone-leads.csv`. Check contact pages for an address, then add found emails to `outreach_leads` as queued. I can script the website scan so you only review the results. Say the word and I'll run it first.
11. **Pipeline decision (15 min).** MT and ID are almost out, and WY/OR cover about 15 more days. Pick one:
    - **Widen to Colorado and Utah.** Biggest elk markets, public outfitter registries, and I can run discovery on them.
    - **Stay NW + WY** and hand-search Oregon and California.
12. **Facebook groups (20 min).** Answer questions and comment. No links. The group question post is for Thursday per the calendar.
13. **Check the expo lists (10 min):** Western Hunting & Conservation Expo exhibitor page. Lists usually post in December, so only a quick look.

### 5. Wrap-up (30 min)
14. **Log it.** Calls made, emails collected, Rugg's outcome. Tell me and I'll update the lead notes and write Tuesday's list.
15. **Prep Tuesday's post:** Draw Dates Tuesday, Montana timeline (Mar 1 open, Apr 1 due, mid-April results, Elk B Jun 1). I'll render it when you say.

## Decisions waiting on you
- **Colorado/Utah or stay NW + WY** (item 11).
- **Send rate:** keep 25/day or raise to about 40. At 25/day the queue lasts 13–14 days. I recommend keeping it.
- **Subscriber unsubscribe flag:** build only once real signups show up.
- **Commit** the calendar edit and the Oct 17 thank-you-tip spec when you want them pushed.

## Already scheduled
- **Tue Oct 20:** Google Places API key decision.
- **Wed Oct 21:** Google Business Profile verification, plus the Teardown Wednesday post.
- **Thu Oct 22:** follow up with IOGA / WYOGA / MOGA, plus the Outfitter Question post.
- **Nov 30 – Dec 4:** IOGA annual meeting + vendor fair (Dec 1).
