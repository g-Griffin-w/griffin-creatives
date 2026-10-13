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
