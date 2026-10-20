# Meta (Facebook and Instagram) ads test, aimed at outfitters

Do this **after** the Google Ads practice campaign has a few weeks of data. Status: plan only. Numbers marked *(guess)* are placeholders.

## Why test it
- Mallard Bay (booking software) is the only competitor running Meta ads aimed at outfitters, so outfitters can be reached there, and service competitors aren't there.
- Meta accepts hunting-service ads: outfitters run ads for guided hunts today.
- Our offer, a free multi-guide course, is different from anything I saw in the Ad Library.

## What we need from you (I can't create accounts or add billing)
1. A **Meta Business Suite** account and **Ad account** tied to the Griffin Creative Facebook page. Add your card in Meta's own billing form.
2. Confirm the Instagram account is connected to the page.
3. (Optional) install the Meta pixel on `starter-kit.html`. I can add it once you send the pixel ID.

## Campaign
| Setting | Value |
|---|---|
| Objective | **Leads** or **Traffic** to the signup page. Start with Traffic (simpler) |
| Destination | `https://www.griffincreativelab.com/starter-kit.html?src=meta` (saved as source `meta_ads`) |
| Budget | About $5–10 a day *(guess)* for 14 days, then review |
| Locations | Oregon, Idaho, Montana, Washington, California, Wyoming, Colorado, Utah |
| Audience | Interests and job titles aimed at outfitters: "Outfitter," "Hunting guide," "Hunting and fishing guide," plus interests like "Hunting" with owner or manager job titles. **Meta's targeting here is imperfect; expect hunters in the audience too.** |
| Placements | Facebook and Instagram feeds and Reels. Turn off Audience Network |
| Ad format | Start with a carousel or Reel from our content (draw dates, rebooking emails) |

## Ad copy (outfitter-focused; no weapons, ammo or gear)
**Primary text (a):**
> Four free guides for elk outfitters. Get found by new hunters on Google, collect reviews after every hunt, plan your season around tag-draw dates, and bring past hunters back. Name and email, no card.

**Primary text (b):**
> Wyoming nonresident elk applications are due Feb 2. When are your clients hearing from you? Free guides for elk outfitters: dates for eight states, templates, and a rebooking email you can send this week.

**Headline:** "Free Guides for Elk Outfitters" · **Button:** Learn more

## Policy-safe check
Meta accepts guided-hunt ads, but it's a sensitive category. Avoid close-ups of firearms, anything that looks like killing animals, and any gear for sale. Use camp, horses, country, guides and happy hunters. Check each ad's approval status in Ads Manager.

## Measuring
| Question | Where |
|---|---|
| What did a click cost? | Ads Manager, cost per link click |
| How many signed up? | `select count(*) from lead_magnet_signups where source = 'meta_ads'` |
| What did a signup cost? | Spend ÷ signups |
| Are these outfitters or hunters? | Look at signup emails and company names; replies from real outfitters count |

## Decide after 14 days
Keep, change creative or audience, or stop. Don't judge before 14 days or about 1,000 impressions per ad.
