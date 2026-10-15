# Backlog — ideas worth doing later, not right now

Add to this as ideas come up. Not a sprint plan, just a place so good ideas don't get lost.

## Open

- **Time our own guide-prospecting outreach to the tag-draw window.** Idaho/Oregon elk draw results land mid-June — that's when a guide business itself feels the most urgency about filling the season, since they now know how many tags are actually out there. Schedule `scrape-ooga-hunting.js` / future Idaho sourcing + the cold-outreach push to run in that window instead of whenever, same logic as the client-facing season timing, just aimed at prospecting instead of retention. (Raised 2026-10-07.)
- **Lead sourcing past the association directories (raised 2026-10-13).** Every
  Northwest association directory we can reach is now tapped: MOGA ~150 (done),
  WOGA 10 (3 verified elk), OOGA 7 (2 elk, both already emailed), IOGA 23
  (gated by a Cloudflare challenge; compiled by hand, 16 of 23 now have emails
  via `scripts/enrich-emails-from-sites.js`). More volume means state license
  rosters: Montana DLI's "Licensee Mailing List" and Idaho DOPL's license
  search (`edopl.idaho.gov`), which give names and cities but no emails — so
  they'd need a website-discovery step before `enrich-emails-from-sites.js`.
  Not worth building until we see reply/signup rates on the ~108 already
  queued (about 4 days of sending at 25/day).
- **Honor "stop" replies from starter-kit subscribers (raised 2026-10-14).** Every
  outbound email now carries a footer with our postal address and "reply stop".
  For cold-outreach leads a reply already halts follow-ups (`check-replies` sets
  `reply_received`). For *subscribers* in `lead_magnet_signups` nothing reads
  replies yet, so a "stop" has to be honored by hand (delete or flag the row)
  until we build it: add an `unsubscribed` flag to `lead_magnet_signups`, have
  `send-starter-kit-drip` skip flagged rows, and teach `check-replies` to match
  inbound mail from a subscriber's address. Do it before subscriber volume grows;
  CAN-SPAM requires honoring opt-outs within 10 business days.
- **Mailing address in the footer is a home address.** `EMAIL_FOOTER` in the
  three sender files uses 203 SE 7th St, Sublimity, OR 97385. If a PO box or
  mail-receiving address is set up later, change the constant in
  `send-outreach.js`, `send-followups.js` and `send-starter-kit-drip.js`.
