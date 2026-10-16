# To-do — Friday Oct 16, 2026 (lead focus)

## Where we are (Oct 15 evening)
- **Cold email:** 105+ sent since Oct 10, ~430 queued (WY ~228 · OR ~93 · MT ~75 · ID ~32 · WA ~4). 0 real replies, 0 bounces, 0 real signups.
- **Associations:** emailed IOGA, WYOGA, MOGA today (Oct 15). No replies yet.
- **Content:** slot #1 posted Oct 15. Wyoming dates now verified (nonresident elk due **Feb 2**).
- **Warm leads:** none confirmed. Two "engaged" leads were email scanners; the cleaned view shows one unexplained guide view (Deep in the Bush Adventures).

## Do tomorrow, in order

### Morning (about 1.5 hours)
1. **9:00 — Call IOGA, (208) 342-1438** (reminder set). Their annual meeting and exhibitor fair is **Nov 30 – Dec 4 at Tamarack, vendor fair Dec 1**; vendor registration is open now.
   - Ask: who handles vendors, the best email, booth price and deadline, and whether they got our email.
   - Ask for the vendor packet (goes back to "Hardy").
2. **After the 9am send (16:00 UTC):** open one sent email and confirm the new footer renders (address + "reply stop").
3. **Inbox sweep (10 min):** replies, `mailer-daemon` bounces, anything from ioga.org / wyoga.org / mogamt.org. Answer any real reply the same day.
4. **Check results:** `select * from guide_engagement order by last_view desc;` and `lead_magnet_signups` where `source='social'`. Any signup from the Oct 15 post is a real lead.

### Midday (about 1 hour)
5. **Phone block: 8–10 calls** from `phone-leads.csv` (elk outfitters with no email). Script is in `ASSOCIATION-OUTREACH.md`. Start with the Idaho ones from the licensing list.
6. **Facebook groups, 15 min:** answer questions, comment on posts. Post the group-safe question ("when do you start talking to last year's clients about next season?"). No links.
7. **Reply to comments/DMs** on yesterday's post.

### Lead-building (30 min)
8. **Wyoming hook for the 228 WY leads.** Their clients' nonresident elk deadline is **Feb 2**, the earliest of any state. Decide: add a one-line Wyoming variant to the guide email for `company_state='WY'` leads (e.g., "your nonresident clients apply by Feb 2; a December rebooking email catches them"). I can build it; it's a small change in `send-outreach.js`.
9. **Prep Wed Oct 21 post (#2):** "why we only work with elk outfitters." Draft the text tomorrow.

## Decisions waiting on you
- **Wyoming hook in the cold email** (item 8): yes or no.
- **Send rate:** keep 25/day (my recommendation) or raise to ~40.
- **Widen to Colorado/Utah?** Biggest elk outfitter markets, public registries. You said NW + WY only.
- **Subscriber unsubscribe flag:** build only once real signups show up.

## Already scheduled
- **Fri Oct 16, 9:00 AM:** IOGA call reminder.
- **Tue Oct 20:** Google Places API key decision.
- **Wed Oct 21:** Google Business Profile verification, plus post #2.
- **Thu Oct 22:** follow up with IOGA / WYOGA / MOGA (non-responders).
- **Nov 30 – Dec 4:** IOGA annual meeting + vendor fair.
