# Client kickoff: the one call that does most of onboarding

Most of the hours in onboarding were waiting: for manager access, for the review link, for the mailing address, for the dates and deposit terms. Do those **live on one screen-share call** and they happen in minutes. Plan 60 minutes.

## How the data moves

```
client fills onboarding.html
  -> POST /api/save-onboarding  (server saves to griffin_clients; the browser never writes to the table)
  -> you run onboard-client.js import      past-client list -> guide_client_contacts
  -> you run draft-gbp-profile.js          Google profile text   -> client-packets/<slug>/gbp-profile.md
  -> you run make-booking-kit.js           booking emails + form -> client-packets/<slug>/booking-kit.md
  -> you run draft-retention-sequence.js --client=...   rebooking emails -> retention-sequences/<slug>.md
  -> you fill [brackets], then approve-retention-sequence.js    (the gate: nothing sends unapproved)
  -> daily cron sends to the queued contacts on the season dates
```

## Before the call (10 minutes)

1. Create them and get the form link:
   ```bash
   node --env-file=.env.local scripts/onboard-client.js new --business="Battle Creek Outfitters" --email=tom@example.com --name="Tom Early"
   ```
2. Send them the link and ask them to fill it in **before** the call. About 10 minutes. Photos and the past-client list can come later.
3. Before you dial: `node --env-file=.env.local scripts/onboard-client.js status "battle creek"`. Whatever is unchecked is your agenda.

## On the call (screen share)

| Min | Do | Why now |
|---|---|---|
| 5 | Read back what they entered: dates open, deposit terms, the last-season moment, the trip and price. Fix anything wrong. | Everything we write is built from these. |
| 15 | **Google profile.** They share their screen. Exists: they add hello@griffincreativelab.com as a Manager (People and access, Add, Manager). Doesn't exist: create it together; if it needs verification, start the video or phone verification now. | This is the step that used to take days of back-and-forth. |
| 5 | **Review link.** Business Profile, "Ask for reviews", copy the link. You then run `set --review-url=...`. | The review sender won't run without it. |
| 5 | **Mailing address.** Confirm the footer address. | Email law, and the sender won't run without it. |
| 5 | **Connect mailbox** (Gmail or Google Workspace only). They open the connect link from `status` and click Allow. Others skip this and send from hello@ with their name. | Do before any rebooking email goes out. |
| 5 | **Booking.** Do they have a Calendly or a form? If not, tell them you'll set it up from the booking kit and they'll approve it. | Defines what Booking Setup means for them. |
| 10 | **Expectations.** Say the "not overnight" script from PRODUCT-101.md. Agree deadlines: 12 photos and the past-client list within 7 days. | The slow part is usually the client, so set the date out loud. |

## After the call (about 2 to 3 hours of your time)

```bash
node --env-file=.env.local scripts/onboard-client.js set "battle creek" --review-url="https://..."   # if not done live
node --env-file=.env.local scripts/onboard-client.js import "battle creek" --dry                      # look first
node --env-file=.env.local scripts/onboard-client.js import "battle creek"
node --env-file=.env.local scripts/draft-gbp-profile.js "battle creek"
node --env-file=.env.local scripts/make-booking-kit.js "battle creek"
node --env-file=.env.local scripts/draft-retention-sequence.js --client="battle creek"
```

Then:
1. Open `client-packets/<slug>/gbp-profile.md`. Fill or delete every `[confirm: ...]`. Send the client the Q&A and posts to approve (first month, they approve). Paste into Google.
2. Open `client-packets/<slug>/booking-kit.md`. Set up the form, Calendly and deposit link in **their** accounts. Send one test inquiry through it.
3. Edit `retention-sequences/<slug>.md` (delete the header line, fill `[your state's application deadline]` from the state agency page), send the client the copy to approve, then `approve-retention-sequence.js`.
4. `status` again. Everything checked means done.

## Rules these scripts follow
- **Facts only.** Drafts use what the client told us. Anything unknown stays as a visible `[bracket]` and the approve script refuses to load a sequence that still has one.
- **Names stay private.** The last-season moment goes only into the private thank-you email, never the public Google profile text. The form asks for first names only.
- **This season's dates stay out of next-season emails.** "Dates open" is used in the booking kit, not the rebooking sequence.
- **The client owns every account.** Forms, Calendly, deposit links and the Google profile live in their accounts; we are invited in.
