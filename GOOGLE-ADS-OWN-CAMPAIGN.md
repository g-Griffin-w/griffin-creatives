# Our own Google Ads — account, campaign spec and practice plan

Purpose: run a tiny campaign for **ourselves** to learn the Google Ads dashboard, test how Google reviews hunting-related wording, and get real cost-per-click and signup numbers before any client's money is involved.
Plan context: [GOOGLE-ADS-PLAYBOOK.md](GOOGLE-ADS-PLAYBOOK.md). Nothing here has been run yet. Numbers marked *(guess)* are placeholders.

## What's already built
- The signup page `starter-kit.html` now reads `?src=gads`. A signup that arrives with it is saved with source **`google_ads`** (the database accepts that value as of Oct 20). Every ad should link to: `https://www.griffincreativelab.com/starter-kit.html?src=gads`
- Everything else (account, billing, tracking tag, campaign) needs your Google account, so you do those steps below. Tell me where you are and I'll walk through each screen with you.

## Step 1: create the account (you do this)
1. Sign in at **ads.google.com** with hello@griffincreativelab.com.
2. Google will push a guided campaign. Look for **"Switch to Expert Mode"** (small link near the bottom) and then **"Create an account without a campaign."**
3. Confirm: business name *Griffin Creative Labs*, country *United States*, your time zone, currency *USD*. **These can't be changed later.**
4. Billing: add your card in Google's own form. Don't paste card details anywhere else, and never into this chat.
5. Optional but recommended: create a **manager account** at ads.google.com/home/tools/manager-accounts and link this account under it. Future clients link under the manager account.

## Step 2: the conversion tag (we do this together after Step 1)
In Google Ads: **Goals → Conversions → New conversion action → Website**. Name it `Free guide signup`, category *Sign-up*, value *don't use a value*, count *One*. Google then shows a tag with an ID like `AW-1234567890` and a label like `AbC-dEfG`.
Send me those two values. I'll add the global tag to `starter-kit.html` and fire the conversion only when a signup succeeds, like this:
```html
<!-- in <head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXXX"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-XXXXXXXXXX');</script>
<!-- in the success path of the form handler -->
if (window.gtag) gtag('event','conversion',{send_to:'AW-XXXXXXXXXX/YYYYYYYY'});
```
Then test: submit the form yourself with `?src=gads` and check that the conversion shows as *Recording* in Google Ads (it can take a few hours).

## Step 3: the campaign (copy in these settings)
| Setting | Value |
|---|---|
| Goal | Leads, then "Free guide signup" |
| Campaign type | **Search** (not Performance Max, not Display) |
| Networks | **Turn off** Search Partners and Display Network |
| Locations | Oregon, Idaho, Montana, Washington, California, Wyoming, Colorado, Utah. Option: "Presence" only (people in those states) |
| Languages | English |
| Budget | About $10–15 a day *(guess; this is a test, not a growth budget)* |
| Bidding | **Maximize clicks** with a max cost-per-click cap of about $3 *(guess)* until we have conversions. Switch to "Maximize conversions" after roughly 15–30 signups |
| Schedule | All days |
| Final URL | `https://www.griffincreativelab.com/starter-kit.html?src=gads` |
| Create it | **Paused**, then enable after checking the ads are approved |

### Keywords (use phrase and exact match; no broad match)
`"marketing for outfitters"`, `[marketing for outfitters]`, `"outfitter marketing"`, `[outfitter marketing]`, `"elk outfitter marketing"`, `"hunting guide marketing"`, `"hunting outfitter marketing"`, `"outfitter website"`, `"get more outfitter bookings"`, `"how to get more hunting clients"`, `"outfitter google business profile"`, `"hunting guide google profile"`

### Negative keywords (add at the campaign level on day one)
We are targeting **outfitters, not hunters**, so exclude hunter searches: `guided hunt`, `hunting trip`, `book a hunt`, `elk hunt cost`, `hunting lodge`, `hunting packages`, `elk tag`, `draw odds`, `license`, `permit`
Exclude jobs: `jobs`, `job`, `career`, `hiring`, `salary`, `internship`
Exclude products: `rifle`, `ammo`, `scope`, `gear`, `for sale`, `buy`, `used`

### Responsive search ad
Headlines (up to 30 characters each; Google picks combinations):

| # | Headline | Length |
|---|---|---|
| 1 | Marketing for Elk Outfitters | 28/30 |
| 2 | 4 Free Guides for Outfitters | 28/30 |
| 3 | Get Found by New Hunters | 24/30 |
| 4 | Fill Your Open Hunt Dates | 25/30 |
| 5 | Free Google Profile Guide | 25/30 |
| 6 | Free Review Request Guide | 25/30 |
| 7 | Season Calendar Included | 24/30 |
| 8 | No Card. Name and Email. | 24/30 |
| 9 | Built for Elk Outfitters | 24/30 |
| 10 | Bring Past Hunters Back | 23/30 |
| 11 | Free Step-by-Step Guides | 24/30 |
| 12 | Start With the First Guide | 26/30 |

Descriptions (up to 90 characters):

| # | Description | Length |
|---|---|---|
| 1 | Four free step-by-step guides: get found on Google, collect reviews, plan your season. | 86/90 |
| 2 | Built for elk outfitters. Name and email only. Your first guide arrives right away. | 83/90 |
| 3 | Win new hunters and bring past ones back. Free, no card, no catch. | 66/90 |
| 4 | Rebooking emails, Google profile, reviews and a tag-draw calendar. Free for outfitters. | 87/90 |

Display path: `marketing` / `outfitters`

**Sitelinks** (headline up to 25, two description lines up to 35 each):

| Headline | Line 1 | Line 2 |
|---|---|---|
| Free Google Profile Guide | Get found on Google | Step by step for outfitters |
| Free Review Guide | Get reviews after each hunt | Link and QR card included |
| Season Calendar | Tag-draw dates by state | OR ID MT WA CA WY CO UT |
| Rebooking Emails | Bring past hunters back | Copy-and-paste templates |

**Callouts** (25 characters each): Free for Outfitters, No Card Needed, Built for Elk Outfitters, 8 Western States

**Policy-safe check:** none of this copy mentions weapons, ammo, hunting gear, tags or permits. It's aimed at outfitters about marketing. Keep it that way.

## Step 4: after launch
- **Day 0:** check each ad's **Policy status** is *Eligible* or *Approved*. If disapproved, open the reason, edit and appeal. Tell me what it says.
- **Day 1–3:** look at **Search terms** (Insights & reports). Add anything off-target as a negative. Check spend isn't far over the daily budget.
- **Day 7:** record clicks, cost per click, impressions, signups with source `google_ads`. In Supabase: `select count(*) from lead_magnet_signups where source = 'google_ads'`.
- **Day 14:** decide: keep, change wording, or change keywords. Don't judge results before this.
- **Day 30:** write down what we learned. This becomes the client playbook's real numbers.

## What we're measuring
| Question | How |
|---|---|
| Does Google approve the wording? | Policy status on each ad |
| What does a click cost for these keywords? | Cost per click in the campaign |
| How many people search for these terms? | Impressions and Keyword Planner |
| Do clicks become signups? | Signups with source `google_ads` ÷ clicks |
| What does a signup cost? | Spend ÷ signups |

## Honest expectations
Searches for "outfitter marketing" are few, so expect little traffic. A handful of signups in a month would be normal. The point is the learning, not volume.
