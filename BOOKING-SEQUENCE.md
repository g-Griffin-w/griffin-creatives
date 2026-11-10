# Booking sequence and referral tracking

## What "booking system setup" means

It is **not custom software**. For each client we set up five connected pieces, using tools they can own and cancel:

| # | Piece | Tool | What it does |
|---|---|---|---|
| 1 | **Inquiry form** | Tally or Google Form on their site and Google profile | Name, email, phone, hunt type, party size, preferred dates, "how did you hear about us?", "referral code (optional)" |
| 2 | **Instant reply** | Form's confirmation email | Within a minute: "Got it. Here's what happens next. I'll call you by [time]." |
| 3 | **Call scheduler** | Calendly (or their existing one) | A link in the reply so the hunter can pick a 15-minute call |
| 4 | **Quote, contract, deposit** | Their contract (Google Doc to e-sign), plus a Stripe, Square or invoice link for the deposit | Hunter signs and pays to hold the dates |
| 5 | **Follow-up and reminders** | Email templates below | Nobody falls through between "interested" and "paid" |

If they already use hunting-specific software (below), we plug into it and skip pieces 4 and 5.

## How outfitters actually take bookings

From published elk hunt listings on [Guidefitter](https://www.guidefitter.com/hunt/16711-new-mexico-elk-hunts) and outfitter sites, the pattern is consistent:
- **Deposit to hold dates:** usually about 50%, some 25%.
- **A signed contract plus the deposit** is what makes it booked. Some outfitters give around 10 days to return it ([source](https://cdnmain.guidefitter.com/hunt/11556-rifle-and-bow-bull-elk-hunts)).
- **Balance due** at 30, 60 or 90 days before the hunt, or on a fixed date. Missing it can forfeit the booking ([example](https://guidefitter.com/hunt/29753-rocky-mountain-elk-hunting-in-utah)).
- **Refunds vary the most.** Many outfitters roll over or refund the deposit if the hunter doesn't draw a tag.

We don't write their terms. We make sure the client has them written down and that the sequence below carries them.

## The sequence (what the hunter experiences)

| When | What happens | Who |
|---|---|---|
| Inquiry arrives | Instant auto-reply with the call link | Automatic |
| **Same day** | Outfitter calls or texts. Speed matters here more than polish. | Client |
| Day 1, no response | Email #1 (below) | Template |
| Day 3 | Email #2: dates are filling | Template |
| Day 7 | Email #3: last note, then stop | Template |
| After the call | Quote and contract sent, deposit link included | Client |
| Deposit received | Confirmation email, then a log entry in the referral ledger if a code was used | Template |
| 90 / 60 / 30 days out | Balance reminder, then pre-hunt packet (fitness, gear, license steps) | Template |

### Templates (fill the brackets with the client's real facts)

**Instant reply**
> Subject: Got your inquiry for [hunt type]
> Hi [first name], thanks for reaching out to [Business]. I'll call you by [time/day]. If you'd rather pick a time, here's my calendar: [Calendly link]. A few quick details help me: your preferred dates, how many hunters, and whether you've drawn a tag yet. — [Owner]

**Day 1**
> Subject: Re: your [hunt type] inquiry
> Hi [first name], following up on your inquiry. Do you have a few minutes this week? Here's my calendar: [link]. — [Owner]

**Day 3**
> Subject: [Month] dates are getting booked
> Hi [first name], I want to give you a straight answer on availability. For [season/hunt type] I have [X] spots left. Happy to talk through the hunt or send the details again. — [Owner]

**Day 7**
> Subject: Last note from me
> Hi [first name], I'll stop here so I'm not crowding your inbox. If the timing changes, reply any time and I'll check dates for you. — [Owner]

**Deposit confirmation**
> Subject: You're booked for [dates]
> Hi [first name], we got your deposit of $[amount]. Your balance of $[amount] is due [date]. Next I'll send a gear and fitness list. Any questions, call me at [number]. — [Owner]

## Tools they might already use or could adopt

From vendor listings; verify current pricing and features before recommending:
- **Hunt Outfitter**: purpose-built for guided hunting, with Stripe deposits, payment reminders and lead tracking ([Capterra listing](https://www.capterra.com/p/10048471/Hunt-Outfitter/)).
- **HuntDocs**: inquiry to deposit to waivers ([Capterra](https://www.capterra.co.uk/software/1312674/HuntDocs)).
- **Acre**: invoices and payments for outfitters ([Capterra](https://www.capterra.com/p/10038151/Acre/)).
- **LodgeRunner**: deposits and progress payments ([site](https://lodgerunner.com/hunting-outfitter-software.aspx)).

**Recommendation:** start every client on the simple stack (form, Calendly, Stripe or invoice link, templates). It costs them little, they own it, and it works on day one. Suggest hunting-specific software only if they already feel pain with deposits or reminders. That is their purchase, not part of our $2,800.

## Referral crediting: yes, there are solutions

Nothing can automatically detect "a friend paid a deposit" without access to their payment tool. The reliable fix is a **code plus a ledger**, which works today:

1. **Give each past hunter a code** (for example `MIKE26`) in the thank-you and rebooking emails. Optionally a referral page link too (tracked at `/api/lp?c=<slug>`).
2. **The inquiry form has a "referral code (optional)" field.** This is the moment the referral is identified.
3. **Log it** in the `referrals` table when the inquiry arrives, and update it when the deposit clears. The deposit date comes from the client's payment record.
4. **Pay the credit only after the deposit clears and the cancellation window passes.** That avoids paying credits on bookings that cancel.
5. **Put the terms in writing** with the client, against their margins: the amount, who gets it (referrer, friend, or both), when it's paid, and a cap per person.

Ledger commands:
```sql
-- referrer shared a code
insert into referrals (guide_client_id, referrer_name, referrer_email, code)
values ('<client id>', 'Mike Johnson', 'mike@example.com', 'MIKE26');

-- a friend used it on the inquiry form
update referrals set friend_name = 'Dave Smith', friend_email = 'dave@example.com',
  status = 'inquired', inquired_at = now() where code = 'MIKE26';

-- friend paid the deposit
update referrals set status = 'booked', booked_at = now() where code = 'MIKE26';

-- credit issued
update referrals set status = 'credited', credited_at = now(), credit_amount = 200 where code = 'MIKE26';
```

The monthly report already counts shared, inquired and booked referrals from this table.

**Later, automatic:** if the client takes deposits through Stripe, a Stripe payment link can carry the referral code as metadata, and a small webhook can mark the referral `booked` the moment the deposit lands. Worth building once two or three clients use Stripe. Until then the ledger takes about two minutes per referral.
