---
name: cold-call-guides
description: Email the 5 free guides to a lead Gabriel just talked to on the phone. Use when he says "cold call guides", "send the guides to <name>", or runs /cold-call-guides, with or without a name, email and state. Builds the short email with five visible orange buttons and an orange tap-to-call button, then shows him the draft before anything is sent.
---

# Email the 5 free guides to a cold-call lead

He may just say "cold call guides". If he doesn't also give the lead's first name and email, ask for those two things first (nothing else), then continue. The state is optional; take it from the lead's record. Example with everything: `/cold-call-guides Neil droptine@doublecguides.com UT`.

Follow `COLD-CALL-GUIDES-EMAIL.md` in the repo root exactly. It has the wording, the five guide links, the button HTML and the reasons.

1. **Find the lead.** Look up `outreach_leads` in Supabase (project `gcatvqcntgizjsdoabva`) by email. Note the lead `id` (used as `?lead=<id>` on every guide link) and the state (used in the season-calendar line). If the lead isn't there, ask Gabriel before sending.
2. **Check what we've already sent them.** Search Gmail for `to:<email>` and tell Gabriel how many emails they have already received, so nothing gets doubled.
3. **Build the email.** Short body only: "Hey [name], here are those 5 free guides we talked about on the phone. Give me a call or email with any questions!" Five orange guide buttons (Read guide 1 to Read guide 5) and an orange "Tap to call Gabriel: (503) 779-8493" button linking to `https://www.griffincreativelab.com/call.html`. Buttons are table cells with `bgcolor="#ff4d00"` and `background-color:#ff4d00`. Never use the `background:` shorthand and never a `tel:` link, because the Gmail tool strips both. Add the address and "reply stop" footer.
4. **Create it as a draft** addressed to the lead (do not send). Read it back with `get_draft` and confirm every button cell still has `bgcolor` and the call button points to `call.html`.
5. **Show Gabriel the full draft and stop.** Wait for his OK, even if he already said "send". Send only after he approves, once, from the draft id.
6. **After sending**, read the sent message back to confirm the buttons are intact. Then update the lead: `first_name`, `reply_received = true`, `next_followup_at = null`, and a note, so automated follow-ups don't also email them.
