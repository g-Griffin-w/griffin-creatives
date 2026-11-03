# Search setup: walking a client through getting found on Google

The same steps we did on our own site on Oct 30, done with the client on the kickoff call (screen share, about 10 to 15 minutes). The goal is that Google can read their site, understands each hunt they sell, and has their pages on file, and that we can see what hunters type before they click.

This is the website half of "getting found". The Google Business Profile is the other half (GBP-CLIENT-SOP.md). The bonus guide `guides/get-found-on-google.html` is the client-facing version of the same steps.

## What we did on our own site (say this on the call, it's the proof we've done it)

1. **Homepage tags.** A title, a description, a canonical address, social preview tags and `ProfessionalService` schema.
2. **Pages for the searches we want.** Three public pages (marketing plan, Google Business Profile setup, rebooking emails), each with its own title and description and one question it answers.
3. **A sitemap.** `sitemap.xml` lists every public page.
4. **Google Search Console.** Domain property for the whole domain, verified with a DNS TXT record. Sitemap submitted. "Request indexing" clicked for the homepage and the three new pages.
5. **Then we waited.** Reports fill in after a day or two, new pages take one to two weeks to be indexed, and climbing takes longer. We check the Pages report after a week.

## Who does what

| Piece | Who | Notes |
|---|---|---|
| Search Console account and property | **Client** owns it | Signed in with their business Google account, the same one as their Google profile. |
| DNS record or site-builder verification | **Client** (we guide) | They paste it at their domain registrar, or turn on the builder's Google setting. We never ask for a registrar or builder password. |
| Our access | Client adds `hello@griffincreativelab.com` | Settings, Users and permissions, Add user, **Full**. Never Owner. They can remove us in one click. |
| Sitemap, indexing requests | Us, live on the call | Takes two minutes once verified. |
| Title and description edits | Us **if** they invite us as an editor on their site builder; otherwise they paste from our fix list | See scope below. |
| Monthly check | Us | Five searches, Pages report, Performance report. |

## On the call (screen share)

1. **Confirm where the site lives.** The onboarding form already asked what it's built on and who manages the domain (`onboard-client.js status` shows the answers). Confirm them, and check they can log in to the registrar right now. Two minutes.
2. **Open Search Console.** They go to `search.google.com/search-console` signed in with the business Google account.
3. **Add the property.** *Domain* covers every version of the address and verifies with a DNS record. If they can't get into the registrar today, choose *URL prefix* instead and verify with the builder's SEO or Google settings page or an HTML tag.
4. **Verify.** Follow the method Google shows. A DNS change can take minutes to a few hours, so if "Verify" fails, retry later; don't redo the setup. If they already have `google-site-verification` TXT records, leave them. Never delete an SPF record (`v=spf1 ...`): it's what lets their email send.
5. **Add us.** Settings, Users and permissions, Add user, `hello@griffincreativelab.com`, **Full**.
6. **Submit the sitemap.** Indexing, Sitemaps, type `sitemap.xml`, Submit. Most builders make one at `theirsite.com/sitemap.xml`. If that address shows an error, note it for the fix list.
7. **Request indexing.** Paste the homepage into the top search bar, wait for the check, click Request indexing. Repeat for each hunt page, but only a handful a day.
8. **Set expectations.** "Still checking" and "processing data" are normal for a day or two.

## After the call (about 30 minutes)

1. Run the audit: `node scripts/search-audit.js https://theirsite.com`. It prints the title, description, headings, schema, image alt text, phone as text and the pages in the menu.
2. Write the **fix list** for the client, with the exact text to paste:
   - A title and description for every page, from the formulas in the guide (`[Hunt type], [region] | [Camp name]`, about 60 characters, description about 155).
   - One page per real hunt that doesn't have one, with the outline from the guide, using only the facts they gave us.
   - Listings that must match their Google profile exactly (name, phone, website): their state association directory, Bing Places, Apple Business Connect, Facebook.
   - Two or three people to ask for a link (landowner, gear shop, association), with the request email from the guide.
3. Send it, and put the Search Console date on their calendar: first check in one week, first honest result check at 60 to 90 days.

## Scope (proposed, change it if you want)

**Included in the plan:** Search Console set up with them, sitemap and indexing requests, the audit and written fix list, a title and description for every page (we make the edits if they add us as an editor, otherwise they paste), draft text for up to three hunt pages for them to approve, listings checklist, and the monthly search check.

**Not included (a separate quote):** building or redesigning a website, hosting it, and rewriting every page. Paid links, link buying and anything that promises a ranking.

## Every month (about 30 minutes)

1. Repeat the five searches from Step 1 of the guide (business name, name + state, `elk hunting outfitter` + region, `guided elk hunts` + area, phone) and note where they show up.
2. Search Console, **Indexing, Pages**: are the new pages indexed? **Performance**: what did people type, and which pages got impressions but few clicks?
3. Rewrite the title and description of any page with impressions and few clicks. If a hunt is being searched and has no page, draft one.
4. Put the numbers in the monthly report (pages indexed, impressions, clicks, top searches). They're manual for now: type them into `notes` until there's a field.

## What to say, and what never to say

> "Google doesn't rank you because you ask nicely. It shows the pages that clearly answer what the hunter typed, from a business it can tell is real. We make sure it can read your site, understands each hunt, and sees that real people vouch for you. A new page usually takes a few weeks to show up and longer to climb."

Never say: "you'll be on page one", "number one", or "results in 30 days". We can't see their rankings in advance and we have no client results yet; say so. Never recommend buying links.

## Call checklist
- [ ] Know where the site lives and who controls the domain
- [ ] Search Console property added and verified (or a date set to finish the DNS record)
- [ ] `hello@griffincreativelab.com` added as a **Full** user
- [ ] Sitemap submitted (or the sitemap problem is on the fix list)
- [ ] Indexing requested for the homepage and each hunt page
- [ ] Audit run and fix list sent within two days
- [ ] First check on the calendar for one week out
