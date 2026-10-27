#!/usr/bin/env node
// scripts/make-booking-kit.js
//
// Turns one client's onboarding answers into their booking kit: the inquiry
// form spec, the setup checklist, and the follow-up emails from
// BOOKING-SEQUENCE.md with the client's real facts filled in. No AI involved;
// anything we don't know yet stays as a [bracket] and is listed at the end.
//
// Usage:
//   node --env-file=.env.local scripts/make-booking-kit.js "battle creek"
// Writes client-packets/<slug>/booking-kit.md (gitignored, holds client facts).

const fs = require('fs');
const path = require('path');
const { connect, findClient, factsFrom, die } = require('../lib/client-facts');

function buildKit(f) {
  const owner = f.ownerFirst || '[Owner first name]';
  const biz = f.business || '[Business]';
  const cal = f.bookingLink || '[Calendly link]';
  const phone = f.phone || '[phone]';
  const hunt = f.niche === 'salmon_guide' ? 'trip' : 'hunt';
  const tagGated = f.niche === 'elk_guide';
  const spots = f.openDates ? f.openDates : '[open dates and spots]';
  const terms = f.depositTerms ? f.depositTerms : '[deposit and balance terms]';
  const referral = f.promos ? f.promos : '[referral perk, if any]';

  const formFields = [
    'Name, email, phone (all required)',
    `Which ${hunt} are you asking about? (dropdown of the client's real ${hunt}s)`,
    'Party size',
    'Preferred dates',
    tagGated ? 'Have you drawn a tag yet? (yes / applying this year / not sure) and in which state or unit' : null,
    'How did you hear about us?',
    'Referral code (optional)',
    'Anything else we should know?',
  ].filter(Boolean);

  const md = `# Booking kit: ${biz}

Generated ${new Date().toISOString().slice(0, 10)} from the onboarding form. Anything in [brackets] is a fact we still need from ${owner}. Budget about 90 minutes to set this up the first time you use a template, less after that.

## Setup checklist (they own every account; we are invited in)
- [ ] Inquiry form (Tally or Google Form), fields below. Put the link on their website and in their Google profile.
- [ ] Form confirmation email = the "Instant reply" below, with the scheduler link in it.
- [ ] Scheduler: ${f.bookingLink ? `already have ${f.bookingLink}, check it offers a 15-minute call` : 'create a free Calendly, 15-minute "Hunt call" event'}.
- [ ] Contract: their existing booking agreement as a Google Doc they can e-sign or send as PDF. We do not write terms.
- [ ] Deposit: a Stripe, Square or invoice link for the deposit amount. Their account, their bank.
- [ ] Paste the emails below into their Gmail as templates (or the form tool's automations).
- [ ] Send one test inquiry through the whole chain and check what the hunter receives.

## Inquiry form fields
${formFields.map((x) => `- ${x}`).join('\n')}

## Their terms (confirm wording with ${owner} before any email goes out)
${terms}

Dates and openings right now: ${spots}

## Emails

### 1. Instant reply (automatic, within a minute)
Subject: Got your inquiry for ${tagGated ? 'an elk hunt' : 'a trip'} with ${biz}

Hi [first name],

Thanks for reaching out to ${biz}. I'll call you within one business day. If you'd rather pick a time yourself, here's my calendar: ${cal}

A few things help me give you a straight answer: your preferred dates, how many hunters, and ${tagGated ? 'whether you have a tag yet' : 'whether you have a group in mind'}.

${owner}
${biz} | ${phone}

### 2. Day 1 (no reply yet)
Subject: Re: your inquiry

Hi [first name],

Following up on your inquiry. Do you have a few minutes this week? Here's my calendar: ${cal}

${owner}

### 3. Day 3
Subject: ${spots.startsWith('[') ? '[Month]' : 'Open'} dates are getting booked

Hi [first name],

Straight answer on availability: ${spots}. Happy to talk through the ${hunt} or send the details again.

${owner}

### 4. Day 7 (last note, then stop)
Subject: Last note from me

Hi [first name],

I'll stop here so I'm not crowding your inbox. If the timing changes, reply any time and I'll check dates for you.

${owner}

### 5. Deposit confirmation
Subject: You're booked for [dates]

Hi [first name],

We got your deposit of $[amount]. Your balance of $[amount] is due [date]. ${f.depositTerms ? `As a reminder: ${f.depositTerms}.` : ''} Next I'll send a gear and fitness list. Any questions, call me at ${phone}.

${owner}

### 6. Balance reminders (send 90, 60 and 30 days out, whichever apply to their terms)
Subject: Balance due [date] for your ${hunt}

Hi [first name],

A reminder that your balance of $[amount] is due [date]. Here is the payment link: [payment link]. Call me at ${phone} with any questions.

${owner}

### 7. Pre-${hunt} packet (about 45 days out, as a short email plus attachment)
Outline for the attachment: where to meet and when, what to pack, fitness expectations${tagGated ? ', license and tag steps for the state' : ''}, who to call on the way in. The client writes the real content; we format it.

## Referral code (for the referral ledger in BOOKING-SEQUENCE.md)
Perk on offer: ${referral}
- Give each past hunter a code (first name + year, for example MIKE26) in the thank-you email.
- The form's "referral code" field is where a friend uses it.
- Pay the credit only after the deposit clears and the cancellation window passes.
`;

  const missing = [];
  if (!f.bookingLink) missing.push('scheduler link (create a Calendly)');
  if (!f.depositTerms) missing.push('deposit and balance terms');
  if (!f.openDates) missing.push('open dates and spots');
  if (!f.phone) missing.push('phone');
  if (!f.ownerFirst) missing.push('owner first name');
  return { md, missing };
}

async function main() {
  const ref = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const sb = connect();
  const f = factsFrom(await findClient(sb, ref));
  const { md, missing } = buildKit(f);
  const dir = path.join(__dirname, '..', 'client-packets', f.slug);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'booking-kit.md');
  fs.writeFileSync(out, md);
  console.log(`Wrote ${path.relative(process.cwd(), out)}`);
  console.log(missing.length ? `Still needed from the client: ${missing.join('; ')}` : 'All booking facts present.');
}

if (require.main === module) main().catch((err) => die(err.message));
module.exports = { buildKit };
