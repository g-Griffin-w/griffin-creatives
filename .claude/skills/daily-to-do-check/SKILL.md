---
name: daily-to-do-check
description: Gabriel's daily check. Use when he says "daily to do check", "daily check", "morning check" or runs /daily-to-do-check. Checks the inbox for replies, the free-guide engagement, the Google Business Profile status, and Google rank for griffincreativelab.com, then gives one short report with what needs him today. Read-only: it never sends, posts or edits anything.
---

# Daily to-do check

Run all four checks, then give ONE report. Do the checks in parallel where you can (the Supabase and Gmail calls together, then the browser checks). This is read-only: never send an email, publish a post, change a lead or edit the profile. If something needs an action, put it in "Needs you today".

Today's date: use the date in the conversation. Pacific time for anything shown to him.

## 1. Emails
- **Gmail:** search the inbox for mail from the last 2 days that is not from us (`in:inbox newer_than:2d -from:me`), including `hello@griffincreativelab.com` replies. Read each thread's newest message. Sort into: **replies from outfitters** (quote what they asked in one line; mark yes / question / "stop" / out-of-office), **Hardy / IOGA** (booth deadline Nov 10, handout shipping question), **bounces**, **everything else** (one line each, ignore newsletters and receipts). Say which replies are still waiting for Gabriel to answer.
- **Pipeline (Supabase project `gcatvqcntgizjsdoabva`):**
  ```sql
  select (select count(*) from outreach_leads where status='queued') queued,
    (select count(*) from outreach_leads where sent_at >= date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') first_emails_today,
    (select count(*) from outreach_leads where status='sent' and reply_received=false and followup_stage<2 and next_followup_at <= now() and niche in ('elk_guide','salmon_guide')) followups_overdue,
    (select count(*) from outreach_leads where reply_received and replied_at > now() - interval '1 day') replies_24h,
    (select count(*) from outreach_leads where status='bounced' and sent_at > now() - interval '1 day') bounces_24h,
    (select max(sent_at) from outreach_leads where status='sent') last_first_email;
  ```
  Also: follow-ups sent in the last 24h (`select count(*) from outreach_leads where followup_stage>=1 and next_followup_at is not null and next_followup_at > now() and updated...` is not available, so judge it from the change in `followups_overdue` against the last saved report). **Flag it** if `last_first_email` is more than 26 hours old, `queued` is under 50 (about 2 days of sends left), or `followups_overdue` did not go down since the last report. Cron: first emails ~09:00 PT (send-outreach), follow-ups 17:00, 20:00 and 23:00 UTC.

## 2. Guide engagement
```sql
select kind, ref, company_name, email, niche, views, guides_viewed, guides, last_view
from guide_engagement where last_view > now() - interval '2 days' order by last_view desc;
```
and new sign-ups:
```sql
select name, email, source, drip_stage, created_at from lead_magnet_signups
where created_at > now() - interval '2 days' order by created_at desc;
```
Report: who opened a guide or the signup page in the last 2 days (company, which guides, how many times), who signed up (and from which source: ioga_handout, ioga_newsletter, google_ads, website...), and the **hottest leads** (opened 2+ guides, or opened a guide and has not replied). Someone who opened guides but is not on the drip is worth a call; say so. Lead rows link to `?lead=<id>`; the ref is the lead id.

## 3. Google profile status (Griffin Creative Labs, verified)
Use the built-in browser (default) and read `google.com/search?q=Griffin+Creative+Labs` while signed in, then open "View profile" (scroll_to its ref). Reading only. Report:
- **Verified?** and any red banner or suspension notice.
- **Pending edits** (service area, services, social links, categories): still "pending" or live? Edits go live in about a day, service area up to 7 days from Nov 2.
- **Posts:** the list with dates and status (Live / Scheduled / Pending review). Fridays are post days; the Nov 20 and Nov 27 posts should exist. Posts expire after about 6 months.
- **Reviews:** count and rating; anything new to answer.
- **Performance** (searches, views, calls, clicks) if the profile shows it.
- Anything Google flags ("Your profile has changes pending", "Add a photo", etc.).
Open items live in memory note `gbp-live-todo`: service descriptions, a real photo of Gabriel, first reviews, default services "Google marketing" and "Social media marketing" to remove.

## 4. Google rank for griffincreativelab.com
In the built-in browser run these searches (`google.com/search?q=...&num=20`) and record where griffincreativelab.com first appears (position, or "not in top 20"). Do not click through; read the result list text.
1. `Griffin Creative Labs`
2. `marketing for elk outfitters`
3. `outfitter marketing agency`
4. `google business profile for outfitters`
5. `rebook past hunters email`
6. `site:griffincreativelab.com` (how many pages Google has indexed; 15 are in the sitemap)
Also check the map result for `marketing agency Sublimity Oregon` (does the profile show). If Google shows a captcha or "unusual traffic", stop searching, say so, and use Search Console instead (search.google.com/search-console, Domain property griffincreativelab.com: Performance, last 7 days, total clicks, impressions, average position, top queries; Pages, number indexed). Never promise a rank. Compare every number with the previous report.

## Report format
Save it to `reports/daily/YYYY-MM-DD.md` (the folder is gitignored; create it if missing) and show it in chat. Before writing, read the newest earlier file in `reports/daily/` so you can show what changed.

```
DAILY CHECK, <weekday Mon D>
NEEDS YOU TODAY
 1. ...  (reply to X, call Y, click Remove on the old sitemap, etc.; max 5, most important first)

EMAILS            new replies N, bounces N | queued N, sent today N, follow-ups overdue N (was N)
GUIDES            opens N, signups N | hot: ...
GOOGLE PROFILE    verified yes/no | pending edits ... | next post ... | reviews N (x.x)
GOOGLE RANK       brand: #n | marketing for elk outfitters: #n | ... | indexed pages N | change vs last: ...
```
Keep each section to a few lines of plain language, no jargon. If a check could not be run (site blocked, not signed in), say that on its line instead of guessing.
