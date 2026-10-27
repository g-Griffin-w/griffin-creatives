# Capacity: hours per client

**These are my estimates from the work the SOP, scripts and sequences require. None are measured yet.** Time the first client for real and replace these numbers (log at the bottom).

## One-time onboarding (per client)

"Now" is the original estimate before the onboarding tooling. "Target" is what I expect once the tools below are used, and is **also unmeasured**. The tools exist and were tested on a throwaway client; no real client has been timed.

| Task | Now | Target | How the target is reached |
|---|---|---|---|
| Discovery call and Google profile triage | 0.75 | 0.75 | Kickoff call, ONBOARDING-CALL.md |
| Verification and manager access | 1.5 | 0.5 | Done live on the call, screen share |
| Fill in the Google profile | 2.0 | 1.0 | `draft-gbp-profile.js` drafts it; you fill the `[confirm: ...]` gaps and review |
| Gather and pick photos | 1.0 | 0.5 | Photos upload through the form; pick 12 |
| First proof-content batch (generate, review every image) | 1.5 | 1.0 | Smaller first batch (6 images) |
| Rebooking sequence: draft, fill facts, approve, import list | 2.0 | 1.25 | `draft-retention-sequence.js --client=...` uses the form facts; `onboard-client.js import` cleans and loads the list |
| Review pipeline setup | 0.75 | 0.25 | `onboard-client.js set` and `status`; mailing address comes from the form |
| Booking setup: form, auto-reply, scheduler, deposit link, templates | 3.0 | 1.5 | `make-booking-kit.js` fills the emails and form spec |
| Website check | 1.5 | 0.5 | Written fix list only; edits are a separate quote |
| **Total** | **≈ 14** (11 to 17) | **≈ 7** (6 to 9) | Client #1 will still run long because that is when the templates get tuned |

## Every month after

| Task | Hours |
|---|---|
| Google posts (2 to 4) and new photos | 1.5 |
| Review replies (draft, client approves first month) | 0.5 |
| Proof-content batch (review before it goes out) | 1.0 |
| Hunter intake, bounces, opt-outs, rebooking replies | 0.5 |
| Inquiry and booking check-in with the client | 0.5 |
| Monthly report | 0.75 (1.25 the first few) |
| Client touchpoint (call or text) | 0.5 |
| Seasonal updates and surprises | 0.5 |
| **Total** | **≈ 6** (range 5 to 8) |

## What this means for pay and for your calendar

- **Month 1 costs about 20 hours** (14 onboarding + 6 ongoing). A free first month is 20 unpaid hours per client. Half-price is 20 hours for $1,400 (~$70/hr).
- **After month 1:** $2,800 for about 6 hours is roughly $465/hr. That's the real business. Month 1 is the investment.
- **Six founding clients in the first month** is about 120 hours of work (6 × 20). That's too much to do at once.

### How many clients can you carry?

Assume delivery hours per month = the hours you can actually give delivery after outreach, calls and content (you plan about 6 hours a day, so maybe 60 to 80 of the ~120 hours a month are delivery).

| Delivery hours / month | Clients you can carry | New clients you can onboard that month |
|---|---|---|
| 60 | 6 active | 1 |
| 80 | 6 active | 2 |
| 100 | 8 active | 3 |
| 120 | 10 active | 3 to 4 |

(Active × 6 hours + new × 14 hours must fit in the delivery hours.)

**Plan: onboard one or two clients per month, not six at once.** A realistic founding path is 2 clients in the first month, 2 more in the second, 2 more in the third, and the half-price offers are the later ones.

## What cuts the hours
- Review requests now send themselves (saves ~1 hr a month per client compared with doing them by hand).
- The rebooking sequence and daily send are scripted. The human time is the fact-fill and approval.
- The report generator and template take ~45 minutes down from a blank page.
- A booking setup template, reused across clients, brings the 3 hours down to 1.5 to 2 after the first client.

## What adds hours
- Clients who are slow to verify Google, send photos, or hand over their past-client list. This is usually the real delay. Set a deadline in the founding offer.
- Clients without a decent website. Fixing it is a separate job (a quote, not part of $2,800).
- Heavy review-reply or inquiry follow-up volume.
- Prospect work. Each lead-magnet audit or demo sequence takes real time (about 20 minutes for an audit), whether or not they sign.

## Time log (fill this in for client #1, then update the numbers above)

| Date | Client | Task | Hours |
|---|---|---|---|
| | | | |
