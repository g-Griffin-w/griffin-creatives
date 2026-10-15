# SOP — Google Business Profile for a client

**Rule: the client owns the profile; we are a Manager.** Verification belongs to
the client, always. We never ask for their Google password, never create a
profile under our own account for their business, and never verify on their
behalf.

Our account: **hello@griffincreativelab.com** (Business Profile Manager).

---

## 0. Triage (2 minutes, on the onboarding call)

Ask the client to search their business name + town on Google. Four cases:

| Case | What they see | Go to |
|---|---|---|
| **A. Owned by them** | "Your Business Profile" controls above the listing | Section 2 (add us as manager) |
| **B. Exists, nobody owns it** | Listing shows "Own this business?" | Section 1B (claim it) |
| **C. Exists, owned by someone else** (an ex-designer, a past employee, a nephew) | "Own this business?" → they're told it's already managed | Section 1C (request ownership) |
| **D. No listing at all** | Nothing | Section 1A (create it) |

Also ask: **is there a duplicate listing** (old name, old phone, a second pin)?
Duplicates split reviews; flag it for Section 4.

---

## 1. Getting a profile into the client's hands

### 1A. Create (no listing)
Done by the client, on a screen-share with us. Takes about 10 minutes.
1. business.google.com → **Add business** → their legal/branding name (exact
   name, no keywords stuffed in).
2. Business type: **Service business** if they travel to hunt units and have no
   storefront; add **Local store** only if hunters can actually visit.
3. Primary category: **Hunting guide** or **Outfitter** (use what Google offers;
   search both). Add secondaries later.
4. Service area: the states/regions they actually guide in.
5. Address: a real physical address for verification. It can be **hidden** from
   the public for a service-area business. No PO box or mail drop.
6. Phone and website. Accept terms. They click it, not us.

### 1B. Claim (unclaimed listing)
They click **Own this business?** on the listing and follow the prompts. Same
verification as 1A.

### 1C. Request ownership (someone else owns it)
They click **Own this business?** → **Request access**. The current owner gets
an email and has 3 days to respond; after that the client can claim it. If the
owner is unknown or unreachable, Google support (Help → Contact us in
Business Profile) can resolve it. Don't wait on this to start other work.

### Verification — set expectations
Google decides which methods each profile gets. For service-area businesses,
**video is often the only option**, and some profiles don't get a postcard.
- The client records the video **on their phone** (scan the QR code on the
  verification page). It must be signed in as the profile's account, opened in
  Chrome, no VPN or private mode, one continuous take (no cuts).
- Video checklist: the street and house number from outside, then their gear
  and workspace (truck, saddle, tack, maps, trailers), then branded materials
  (card, invoice, website on a screen, business email), then the Business
  Profile dashboard on a screen. Keep personal IDs and cards out of frame.
- If the only method fails, use **Help → Contact us** and ask for chat or a
  callback to review manually.
- Verification can take **minutes (video review) to ~5 days (postcard)**.
  Quote it as "up to a week."
- We did this ourselves on 2026-10-14: video failed on the phone, no postcard
  option appeared, we escalated to support. Plan for this, don't promise a date.

---

## 2. Add us as a Manager (4 clicks, client does it)

Send this to the client, or do it on a call:

> **Add Griffin Creative as your Manager (about 1 minute):**
> 1. Go to **business.google.com** and open your business.
> 2. Click the **⋮ menu → Business Profile settings → People and access**.
> 3. Click **Add**, enter **hello@griffincreativelab.com**, set the role to
>    **Manager** (not Owner).
> 4. Click **Invite**. Done. You can remove us any time from the same page.

On our side:
1. Open the invite email at hello@ (or business.google.com → profile list) and
   **Accept**.
2. Confirm the client's business appears in our Business Profile Manager and
   record it (Section 5).

**Why Manager, not Owner:** they keep control, they can leave us anytime (fits
"cancel anytime"), and Google lets managers edit everything we need except
delete the profile or change ownership.

---

## 3. Our setup checklist (once accepted)

Pull everything from the client's onboarding answers (`onboarding.html` fields)
and `clients/<slug>.json`. Never invent facts.

- [ ] **Name:** exact legal/branding name. No "Elk Hunts Montana Outfitter"
      keyword stuffing; Google suspends it.
- [ ] **Categories:** primary + 2–3 secondaries (see 1A.3).
- [ ] **Description** (≤750 chars): what they hunt, where, season, what's
      included, years in business. Real facts only.
- [ ] **Service area:** the actual hunting regions/units, not the whole state
      unless true.
- [ ] **Hours:** season hours or "by appointment."
- [ ] **Services:** each hunt type (guided elk, drop camp, combo), with a short
      factual description. Price only if the client states it.
- [ ] **Photos:** 10+ real photos from the proof-content batch (hunts, camp,
      animals, guides). Cover + logo. No stock images.
- [ ] **Q&A seeds:** season length, what's included, license/tag requirements
      (link the state agency; don't state rules we haven't verified).
- [ ] **Website + booking link** (UTM-tagged if tracking).
- [ ] **First post:** season-timed or draw-timed (use the state calendar).
- [ ] **Review link:** copy the profile's "Ask for reviews" link into the
      review-request automation.

---

## 4. Ongoing

- **Weekly:** answer new reviews (draft, client approves the first month, then
  we post). Check for flagged or fake reviews.
- **Monthly:** 2–4 posts from the proof-content batch and campaign calendar;
  add new photos; update hours/closures before and after season.
- **Each season change:** update dates, "currently booking" info, hunt
  availability.
- **Duplicates:** report them via the profile ("Suggest an edit" / mark as
  duplicate) or support.
- **Suspension:** do not make changes and re-submit blindly. Open a support
  case, document name/address/category history, and wait for the review.

---

## 5. Record keeping (per client)

The onboarding form already saves the client's answers to `griffin_clients`:
`gbp_link`, `gbp_exists` (yes / no / not_sure) and `gbp_manager_added`
(yes / no / not_sure / na). Use them for triage before the call.

In `clients/<slug>.json` or the client row in Supabase, store:
`gbp_status` (none / created / pending_verification / verified),
`gbp_url`, `gbp_manager_accepted_date`, `gbp_verified_date`, notes on duplicates
and ownership issues.

## 6. Don'ts

- Don't ask for or store their Google password. Ever.
- Don't create profiles under our account for their business.
- Don't buy, fabricate, or incentivize-with-gifts reviews.
- Don't change the name to include keywords or a location.
- Don't use a PO box, virtual office, or an address they don't actually use.
- Don't run video verification ourselves on the client's behalf.

## 7. Offboarding

Client removes hello@ under People and access. We delete their profile data
from our records per their request. Nothing else to undo, because they own it.
