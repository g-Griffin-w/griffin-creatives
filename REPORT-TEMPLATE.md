# Monthly client report

One template for every client. It takes about 45 minutes a month once you've done it a few times.

## How to make one

```bash
cp reports/EXAMPLE-input.json reports/<client>-<YYYY-MM>.json   # fill it in
node --env-file=.env.local scripts/make-client-report.js reports/<client>-<YYYY-MM>.json
```

It writes `reports/<client>-<YYYY-MM>.html`. Open it, print to PDF (or paste it in an email), and send it in the first week of the next month. The `reports/` folder is gitignored, so client reports stay off the repo.

## Where each number comes from

| Number | Source | Automatic? |
|---|---|---|
| Profile views, calls, website clicks, direction requests | Business Profile → Performance, set to the month. Copy the numbers into `gbp`. | Manual (2 min) |
| New reviews, total reviews, rating | The profile's reviews tab | Manual |
| Reviews replied to, photos, posts | What you actually did this month | Manual |
| Review requests sent, reminders, link opens | `review_requests` table | **Automatic** |
| Past hunters in the rebooking sequence | `guide_client_contacts` | **Automatic** (cumulative total reached) |
| Rebooking replies | The client's inbox | Manual (`rebooking.replies`) |
| Referrals shared, inquired, booked | `referrals` table | **Automatic** |
| Inquiries, hunts booked, sources | Ask the client (one question: "how many inquiries and bookings this month, and where from?") | Manual |

Anything you leave blank prints as **n/a**, not zero. We don't guess.

## Rules for the report
- **Lead with the honest summary.** One or two sentences in `summary`. If views are flat, say so and say what you're doing about it.
- **Compare to last month** by filling the `_prev` fields. Never compare to a different season without saying so.
- **Do not claim bookings we didn't cause.** The "Bookings you told us about" section is the client's numbers. We report them, we don't take credit for them.
- **Hunters opening the review link is not reviews.** Google doesn't tell us who reviewed. The report says this.
- **Month 1 will look quiet.** Say that in `notes` ("setup month: profile verified, 14 photos added, first 8 review requests sent").

## Monthly checklist (the 45 minutes)
- [ ] Pull Google numbers for the month (5 min)
- [ ] Ask the client the one bookings question (5 min, by text)
- [ ] Fill the JSON: summary, work done, next month (15 min)
- [ ] Generate, read it once, fix anything that looks wrong (10 min)
- [ ] Send, and book the next touchpoint (5 min)
