# Cold-call follow-up email: the 5 free guides

Use this whenever Gabriel talks to someone on the phone and says "send them the guides". Short body, five visible buttons, one call button. Nothing else.

## What it says
**Subject:** `[Lead name], here are those 5 free guides`
**Body:** `Hey [lead name], here are those 5 free guides we talked about on the phone. Give me a call or email with any questions!`
If we don't know the name: `Hey there,`. Signed `Gabriel / Griffin Creative Labs`, with the usual address and "reply stop" footer.

## The five guides (buttons, in this order)
| # | Title | Button | Link (add `?lead=<outreach_leads.id>` so we see who opens it) |
|---|---|---|---|
| 1 | Rebooking emails for past hunters | Read guide 1 | `https://www.griffincreativelab.com/guides/rebooking-emails.html` |
| 2 | Google Business Profile | Read guide 2 | `https://www.griffincreativelab.com/guides/google-business-profile.html` |
| 3 | Season marketing calendar (say the lead's state) | Read guide 3 | `https://www.griffincreativelab.com/guides/season-calendar.html` |
| 4 | Reviews after every hunt | Read guide 4 | `https://www.griffincreativelab.com/guides/review-requests.html` |
| 5 | Get found on Google | Read guide 5 | `https://www.griffincreativelab.com/guides/get-found-on-google.html` |
Plus an **orange** call button (same orange as the guide buttons): `Tap to call Gabriel: (503) 779-8493` linking to `https://www.griffincreativelab.com/call.html`.

## Why the buttons are built this way (learned the hard way, Nov 3)
The Gmail tool we send 1:1 emails through rewrites the HTML:
- It **deletes `background:` shorthand**, so an orange button turns into white text on white and disappears. Use a table cell with `bgcolor="#ff4d00"` and `background-color:#ff4d00` (this survives).
- It **replaces `tel:` links with a dead link.** Use `https://www.griffincreativelab.com/call.html`, which opens the phone dialer.
- Our automated emails (cold outreach, drip, follow-ups) are sent another way and are not affected.

Button cell:
```html
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="#ff4d00" style="background-color:#ff4d00;border-radius:4px;padding:13px 24px">
<a href="URL" style="color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">Read guide 1</a>
</td></tr></table>
```
Call button: exactly the same orange cell (`#ff4d00`), different text and link.

## Before sending, every time
1. Create it as a **draft** addressed to the lead (not sent).
2. Read the draft back and confirm every button cell still has `bgcolor` and the call button points to `call.html`.
3. **Show Gabriel the full draft before every send, every time**, and wait for his OK. Even if he already said "send it", show it first. Never send without that OK.
4. After sending, update the lead: `first_name`, `reply_received = true`, `next_followup_at = null`, and a note, so automated follow-ups don't also email them.
5. Send **one** email. Never resend because something looked off; check first.
