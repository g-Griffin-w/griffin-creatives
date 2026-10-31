#!/usr/bin/env node
// scripts/make-seo-pages.js
//
// Writes the public search pages (outfitter marketing, Google Business Profile
// for outfitters, rebooking past hunters) to the repo root as static html, in the
// same look as the state elk-date pages. The text comes from our four guides in
// guides/*.md; the guides themselves stay out of search (robots.txt) as the
// signup incentive.
//
// Usage: node scripts/make-seo-pages.js
// Re-run after editing the copy below, then add new urls to sitemap.xml.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://www.griffincreativelab.com';
const DATE = '2026-10-30';
const CTA_HREF = 'starter-kit.html?src=web';

const PAGES = [
  {
    file: 'outfitter-marketing.html',
    title: 'How to Market a Hunting Outfitter Business: A Year-Round Plan',
    description:
      'A practical plan to market an elk outfitting business and fill your calendar: Google profile, reviews, past-client emails and a season calendar built around the draw.',
    tag: '// Outfitter marketing',
    h1: ['HOW TO MARKET A', 'HUNTING OUTFITTER BUSINESS'],
    intro:
      'Most outfitters market when they feel behind: three open spots in September, a scramble on Facebook, a call to someone they have not talked to in a year. This is the plan that replaces the scramble. Five things, done in order, on a calendar that follows how elk hunters actually book.',
    blocks: [
      ['h2', 'How elk hunters decide who to book'],
      [
        'p',
        'A guided elk hunt is expensive, happens once a year at most, and is hard to undo. A hunter cannot try you first, so they look for proof. They search your name, look at your Google listing, read your reviews and compare you to the next outfitter. Whatever they find in about twenty seconds decides whether you get the phone call.',
      ],
      [
        'p',
        'In draw states there is a second thing to understand. A hunter often <b>cannot commit to you until they know whether they drew a tag.</b> That splits your year in two. Before results, you are selling "apply, and if you draw I am holding dates for you." After results, you are talking to people who have a tag in hand and a week of leave to spend, the most motivated hunter you will ever talk to. Most outfitters talk to both groups the same way. Do not.',
      ],
      ['h2', 'The five things that fill a calendar'],
      ['h3', '1. A Google Business Profile that answers the hunter\'s questions'],
      [
        'p',
        'This is the highest-leverage hour you will spend. A hunter looking at your listing is trying to answer five things: is this a real operation, where is camp, who is guiding me, what does the country look like, and do guys actually kill elk here. A filled-out profile answers all five before they ever click through to your website. <a href="google-business-profile-for-outfitters.html">Here is the step-by-step setup for outfitters.</a>',
      ],
      ['h3', '2. Reviews, asked for after every hunt'],
      [
        'p',
        'A hunter who had a great trip almost never thinks to leave a review on their own. The reviews that show up unprompted skew toward whoever was upset. Asking is the only thing that fixes that. Hand over a card with a QR code at drop-off, send one short text two or three days later, and one gentle reminder a week after that. Send it to everyone, never offer anything in exchange, and reply to every review within a couple of days.',
      ],
      ['h3', '3. A rebooking email to every past client'],
      [
        'p',
        'A past client has already found you, trusted you, paid and slept in your camp. Getting them back takes one honest email at the right time, and most outfitters never send it. <a href="rebook-past-hunters.html">Here are the three emails, word for word.</a>',
      ],
      [
        'p',
        'Past clients are not the whole answer. Hunters draw other states, get older, or want to try somewhere new, so you also need new hunters to find you. That is what the first two items are for.',
      ],
      ['h3', '4. A season calendar, so you show up at the same moments every year'],
      [
        'p',
        'Elk hunters follow a predictable year. They apply in spring, find out in early summer, book in the months around it and hunt in the fall. If you reach them at the same moments every year, you are in front of them while they decide. The plan is below.',
      ],
      ['h3', '5. A website and photos that answer the booking questions'],
      [
        'p',
        'Your hunt page should show dates, price, what is included, what is not, how to book and a phone number that matches your Google profile. Use real photos of your own country, camp, horses and guides. Stock photos tell a hunter you have nothing real to show.',
      ],
      ['h2', 'Your year in six moves'],
      [
        'ul',
        [
          '<b>December: thank you, then rebook.</b> Thank this year\'s hunters, then send the rebooking email. Look at which dates sold out and which did not.',
          '<b>January and February: update everything.</b> New dates, prices and your best photos on your website and Google profile. Resend the rebooking email to anyone who did not answer.',
          '<b>March and April: the application reminder.</b> A few weeks before your state\'s deadline, email every past client. You are helping them whether they book or not, and the ones who apply remember who reminded them.',
          '<b>May and June: deadline and results.</b> Post on your Google profile around the deadline. The week results come out, contact everyone who drew: "Congrats on the tag. I am holding dates for you." This is your highest-converting week of the year.',
          '<b>July and August: confirm.</b> Confirm hunters, send prep info and pre-season photos, and check for leftover or second-draw tags to fill openings.',
          '<b>September to November: the season.</b> Take photos as you go (ask permission), send review requests within a few days of each hunt, and fill late cancellations with a post and a call to your list.',
        ],
      ],
      [
        'p',
        'Deadlines move every year, so confirm yours on your state agency\'s site. We keep <a href="draw-dates.html">all eight Western states\' elk application dates on one page</a>.',
      ],
      ['h2', 'Mistakes that cost outfitters bookings'],
      [
        'ul',
        [
          'Marketing only when you feel behind, instead of on a calendar.',
          'Writing like a brochure. "We offer premier guided hunting experiences" gets deleted. "I keep thinking about that bull on day four" gets read.',
          'Stuffing keywords into your Google business name, which risks a suspension.',
          'Using stock photos instead of your own.',
          'Never replying to reviews.',
          'Sending the rebooking email in May, when hunters have already booked or drawn somewhere else.',
        ],
      ],
      ['h2', 'Common questions'],
      ['h3', 'What is the cheapest way for an outfitter to get more bookings?'],
      [
        'p',
        'Email your past clients. They already know you, so one honest message at the right time costs almost nothing compared to finding a new hunter. Then fix your Google profile and start asking for reviews, both of which are free.',
      ],
      ['h3', 'When should an outfitter start marketing for next season?'],
      [
        'p',
        'December. Come home from the season, thank your hunters, send the rebooking email and put next year\'s dates on your website and Google profile in January.',
      ],
      ['h3', 'Do I need ads to get booked?'],
      [
        'p',
        'Not to start. A complete Google profile, steady reviews and emails to past clients cost little and work first. Paid ads do better once those are in place, because the hunter who clicks lands on a profile and a website that are ready for them.',
      ],
      ['h3', 'Do outfitters really need a Google Business Profile?'],
      [
        'p',
        'Yes. It is what appears when someone searches your business name, so it is your first impression whether you set it up or not. A profile you control beats a stale one you do not.',
      ],
    ],
    faq: [
      [
        'What is the cheapest way for an outfitter to get more bookings?',
        'Email your past clients. They already know you, so one honest message at the right time costs almost nothing compared to finding a new hunter. Then fix your Google profile and start asking for reviews, both of which are free.',
      ],
      [
        'When should an outfitter start marketing for next season?',
        'December. Come home from the season, thank your hunters, send the rebooking email and put next year\'s dates on your website and Google profile in January.',
      ],
      [
        'Do I need ads to get booked?',
        'Not to start. A complete Google profile, steady reviews and emails to past clients cost little and work first. Paid ads do better once those are in place, because the hunter who clicks lands on a profile and a website that are ready for them.',
      ],
      [
        'Do outfitters really need a Google Business Profile?',
        'Yes. It is what appears when someone searches your business name, so it is your first impression whether you set it up or not. A profile you control beats a stale one you do not.',
      ],
    ],
    cta: ['FOUR FREE MARKETING GUIDES FOR ELK OUTFITTERS', 'Step-by-step guides for your Google profile, reviews, season calendar and rebooking emails, with templates you can copy. Name and email, no card. The first guide lands right away.'],
    related: ['google-business-profile-for-outfitters.html', 'rebook-past-hunters.html'],
  },
  {
    file: 'google-business-profile-for-outfitters.html',
    title: 'Google Business Profile for Hunting Outfitters: Step-by-Step Setup',
    description:
      'How to set up a Google Business Profile for an elk outfitter: claim it, hide your address, pick categories, write the description, list each hunt and add photos.',
    tag: '// Google Business Profile',
    h1: ['GOOGLE BUSINESS PROFILE', 'FOR HUNTING OUTFITTERS'],
    intro:
      'About 45 minutes of work, plus Google\'s verification wait. Do it once, then spend 10 minutes a month keeping it fresh. This is the setup for an outfitter with a camp, not a storefront.',
    blocks: [
      ['h2', 'Why this is the highest-leverage hour you will spend'],
      [
        'p',
        'A hunter planning a once-a-year trip does not call the first outfitter they hear about. They search. For a lot of local searches Google shows a map with three businesses above everything else, including your website, and those three listings get most of the calls. Your profile is also what shows up when someone searches your business name, so it is the first impression whether you set it up or not.',
      ],
      [
        'p',
        'In the twenty seconds a hunter spends on your listing, they are trying to answer five questions: <b>Is this a real operation? Where is camp? Who is guiding me? What does the country look like? Do guys actually kill elk here?</b> A filled-out profile answers all five before they click through.',
      ],
      ['h2', 'Step 1: Claim it, and check for duplicates first'],
      [
        'p',
        'Search your business name on Google Maps. Also search your old business names and your phone number. Outfitters change names, add partners and move, and it is common to find two or three stale listings for the same operation. Duplicates split your reviews and confuse Google about which one is real.',
      ],
      [
        'ul',
        [
          'If a listing exists, click <b>"Claim this business."</b>',
          'If you find duplicates, claim the real one, then use "Suggest an edit" on the others to mark them closed or duplicate.',
          'If nothing exists, go to business.google.com and add it.',
        ],
      ],
      ['h2', 'Step 2: Use your business name exactly as it appears on your sign'],
      [
        'p',
        'Use your real name: "Bear Paw Outfitters", not "Bear Paw Outfitters | Best Montana Elk Hunting Guide." Stuffing keywords into the name is against Google\'s guidelines and is one of the most common reasons listings get suspended.',
      ],
      ['h2', 'Step 3: Start verification now'],
      [
        'p',
        'Google offers some mix of postcard, phone call, text, email or video. Postcards can take a week or more, and they go to a physical address, so make sure someone will open the mail there. <b>Start verification first</b>, then finish the rest while you wait.',
      ],
      ['h2', 'Step 4: Set a service area, not a storefront'],
      [
        'p',
        'Hunters do not drive to your ranch to browse. You are a service-area business, so:',
      ],
      [
        'ul',
        [
          'Hide your street address. It is a setting, and it matters if your camp is also your home.',
          'Add the regions you actually hunt: the counties, the national forest, the unit areas. Not just your mailing address town.',
        ],
      ],
      ['h2', 'Step 5: Pick your categories'],
      [
        'p',
        'Open the primary category dropdown and search "hunting," "outfitter" and "guide." Pick the closest match. Then do the check most people skip: search "elk hunting outfitter [your region]" and look at which category the top three results use. That is what Google is rewarding in your area. Add secondary categories only if they are true, for example if you also run fishing trips.',
      ],
      ['h2', 'Step 6: Write the description'],
      [
        'p',
        'You get 750 characters. Put the important details first, because the preview cuts off. Use this structure:',
      ],
      [
        'tpl',
        'DESCRIPTION TEMPLATE',
        [
          '[Camp name] is a family-run elk outfitter guiding [fully guided / semi-guided] [archery and rifle] hunts in [region / units] since [year]. We hunt [public land / private ranch / wilderness] out of a [pack-in camp / lodge], with [number] hunters per week and [ratio] guides. Hunts include [lodging, meals, guide, pack-out, meat care]. Licenses, tags and transport to camp are not included. Call or book online to reserve [year] dates.',
        ],
      ],
      ['p', 'Say what is included and what is not. Hunters read that line twice.'],
      ['h2', 'Step 7: List each hunt as its own service'],
      [
        'p',
        'Do not make one vague "Hunting" entry. Create a service for each real hunt, with a name, a short description and a price or "from $X":',
      ],
      [
        'tpl',
        'SERVICE EXAMPLE',
        [
          '<b>5-Day Guided Archery Elk Hunt, September</b>',
          'Fully guided, [number] hunters per guide, pack-in camp. Includes meals, lodging, guide and meat care. From $[price].',
        ],
      ],
      ['h2', 'Step 8: Add 15 to 20 real photos'],
      [
        'p',
        'Hunters want to see what they are buying. Upload real photos covering this shot list:',
      ],
      [
        'ol',
        [
          '<b>Cover photo:</b> the country with your camp or horses in frame',
          '<b>Camp:</b> tents or cabins, and the kitchen',
          '<b>Stock:</b> horses or mules loaded and on the trail',
          '<b>Your guides:</b> at work, glassing, calling',
          '<b>The hunt:</b> a glassing shot at dawn, a hunter and guide on a ridge',
          '<b>Success shots:</b> bull down with the hunter (always get permission)',
          '<b>Food and fire:</b> the evening in camp',
        ],
      ],
      ['p', 'No stock photos, ever. Add a few new ones each month through the season.'],
      ['h2', 'Step 9: Make your contact details match everywhere'],
      [
        'p',
        'Phone, website and business name should read the same way on your profile, your website, Facebook and anywhere else you are listed. If you are in the backcountry and cannot pick up, say so in the description and set up a voicemail that promises a callback within a day.',
      ],
      ['h2', 'Step 10: Keep it alive'],
      [
        'ul',
        [
          '<b>Post</b> when you have openings, season updates or a fresh photo. Two lines is fine.',
          '<b>Reply to every review</b> within a couple of days. <a href="outfitter-marketing.html">Here is how reviews fit into the bigger plan.</a>',
          '<b>Update seasonal details</b> each January: dates, prices, availability.',
        ],
      ],
      [
        'p',
        'A profile with recent activity looks alive to Google and to hunters. One that sat untouched for two years looks abandoned.',
      ],
      ['h2', 'The mistakes that cost outfitters the most'],
      [
        'ul',
        [
          'A keyword-stuffed business name, which risks suspension.',
          'Leaving your home address visible when it is also where you live.',
          'Claiming categories that are not true.',
          'Using stock photos or brochure shots instead of real ones.',
          'Never replying to reviews.',
          'Letting phone numbers differ between your site and your profile.',
        ],
      ],
      ['h2', 'Common questions'],
      ['h3', 'Can an outfitter without a storefront have a Google Business Profile?'],
      [
        'p',
        'Yes. Set it up as a service-area business, hide your street address and list the regions you hunt.',
      ],
      ['h3', 'How long does Google verification take?'],
      [
        'p',
        'It depends on the method Google offers. Postcards can take a week or more, so start verification first and finish the rest of the profile while you wait.',
      ],
      ['h3', 'How many photos should an outfitter upload?'],
      [
        'p',
        'Fifteen to twenty real photos covering your country, camp, stock, guides, the hunt, success shots and the evening in camp. Add a few more each month during the season.',
      ],
      ['h3', 'What should the business name be?'],
      [
        'p',
        'Exactly what is on your sign. Adding keywords to the name is against Google\'s guidelines and a common reason listings are suspended.',
      ],
    ],
    faq: [
      [
        'Can an outfitter without a storefront have a Google Business Profile?',
        'Yes. Set it up as a service-area business, hide your street address and list the regions you hunt.',
      ],
      [
        'How long does Google verification take?',
        'It depends on the method Google offers. Postcards can take a week or more, so start verification first and finish the rest of the profile while you wait.',
      ],
      [
        'How many photos should an outfitter upload?',
        'Fifteen to twenty real photos covering your country, camp, stock, guides, the hunt, success shots and the evening in camp. Add a few more each month during the season.',
      ],
      [
        'What should the business name be?',
        'Exactly what is on your sign. Adding keywords to the name is against Google\'s guidelines and a common reason listings are suspended.',
      ],
    ],
    cta: ['WANT THIS AS A CHECKLIST? GET THE FREE GUIDE', 'This setup is Guide 2 of our four free marketing guides for elk outfitters, with an interactive checklist you can work through. The other three cover reviews, your season calendar and rebooking emails. Name and email, no card.'],
    related: ['outfitter-marketing.html', 'rebook-past-hunters.html'],
  },
  {
    file: 'rebook-past-hunters.html',
    title: 'Outfitter Rebooking Emails: 3 Templates to Bring Past Hunters Back',
    description:
      'Three emails that bring past hunters back to your elk camp: the thank-you, the rebook and the application reminder, with word-for-word templates and timing.',
    tag: '// Rebooking past hunters',
    h1: ['THREE EMAILS THAT BRING', 'PAST HUNTERS BACK'],
    intro:
      'About an hour to write, then five minutes per send. These are the three emails, with templates you can copy, the timing that works around the draw, and the mistakes that get them deleted.',
    blocks: [
      ['h2', 'Why this is the cheapest booking you will ever get'],
      [
        'p',
        'A past client has already done the hard part. They found you, trusted you, paid, hunted your country and slept in your camp. Getting a brand-new hunter takes ads, a website and weeks of back-and-forth. Getting a past client back takes one honest email at the right time.',
      ],
      [
        'p',
        'Most outfitters never send it. The hunter goes home, the season ends, and the next time that hunter hears from them is never. The hunter does not forget you. They just book whoever reaches them first.',
      ],
      ['h2', 'Before you write: build one list'],
      [
        'p',
        'Put every past client in one spreadsheet: first name, last name, email, the year they hunted, and <b>one detail you remember</b>, like the bull they shot, the weather or who they came with. That last column is what makes these emails sound like you wrote them yourself.',
      ],
      [
        'p',
        'Send from your own email address, in plain text, with no logo header. It should read like a note from you, because it is. A free tool like MailerLite or Mailchimp, or a mail merge in Gmail or Outlook, lets you send to the whole list and still put each first name at the top.',
      ],
      ['h2', 'Email 1: The thank-you (within a week of their hunt ending)'],
      ['p', '<b>Goal:</b> stay in their head. <b>No ask in this email.</b>'],
      [
        'tpl',
        'EMAIL 1 TEMPLATE',
        [
          '<b>Subject:</b> Thank you from [Camp name]',
          'Hi [first name],',
          'Thanks for hunting with us. I keep coming back to [one specific moment: the bull at first light on day four, the long pack out, the night the bugling would not quit].',
          'I am sorting through photos and will send you the good ones this week. Safe travels home.',
          '[Your name]',
        ],
      ],
      ['p', 'Filled in, it looks like this:'],
      [
        'tpl',
        'EXAMPLE',
        [
          'Hi Mike, thanks for hunting with us. I keep coming back to that evening on the ridge when three bulls were screaming at each other and you did not say a word for ten minutes. I am sorting photos and I will send the good ones this week. Safe travels. Tom',
        ],
      ],
      ['h2', 'Email 2: The rebook (December or January)'],
      ['p', '<b>Goal:</b> get a date on the calendar before they have committed it somewhere else.'],
      [
        'tpl',
        'EMAIL 2 TEMPLATE',
        [
          '<b>Subject:</b> Next season at [Camp name]: dates are open',
          'Hi [first name],',
          'Dates for [year] are open. I have [number] spots in [month range] and I am giving past clients first pick before I open them up.',
          'A [deposit amount] deposit holds your spot. If you have a buddy who has been wanting to try it, bring him. I will hold two spots together.',
          'Reply here and I will send details.',
          '[Your name]',
        ],
      ],
      [
        'p',
        '<b>Only say "first pick" and the spot count if they are true.</b> Your clients will notice.',
      ],
      ['h2', 'Email 3: The application reminder (spring, draw states only)'],
      [
        'p',
        '<b>Goal:</b> this is the email that earns trust. You are helping them even if they do not book.',
      ],
      [
        'tpl',
        'EMAIL 3 TEMPLATE',
        [
          '<b>Subject:</b> Tag deadline is [date]',
          'Hi [first name],',
          'Quick heads up: the [state] elk application deadline is [date]. [Link to your agency\'s application page]',
          'If you draw, I am holding [dates] for you. If you do not, let me know and we will figure out next year.',
          '[Your name]',
        ],
      ],
      ['h2', 'The one follow-up'],
      [
        'p',
        'If someone does not reply to Email 2 after about ten days, send one short line: "Wanted to make sure this did not get buried. Dates are still open if you are thinking about [year]." Then stop.',
      ],
      ['h2', 'Get your dates right'],
      [
        'p',
        'Deadlines move from year to year, so always confirm them on the agency\'s own site. These are 2026 cycle dates, checked in October 2026:',
      ],
      [
        'ul',
        [
          '<b>Oregon (ODFW):</b> controlled elk hunt applications are due May 15, with results around mid-June.',
          '<b>Idaho (IDFG):</b> the application window runs May 1 to June 5, with results from mid-June to early July and a second drawing in August for leftover tags.',
          '<b>Other states:</b> check Montana FWP, WDFW, CDFW and the rest directly. License types and deadlines differ, so do not guess.',
        ],
      ],
      [
        'p',
        '<a href="draw-dates.html">All eight Western states\' elk application dates are on one page.</a>',
      ],
      ['h2', 'Mistakes to avoid'],
      [
        'ul',
        [
          'Writing like a brochure. "We offer premier guided hunting experiences" gets deleted. "I keep thinking about that bull on day four" gets read.',
          'Making Email 1 a sales email. The thank-you has to be a thank-you.',
          'Sending the rebook email in May. By then they have booked or drawn somewhere else.',
          'Burying the deposit and date info. Say the number and the month in the email.',
        ],
      ],
      ['h2', 'Common questions'],
      ['h3', 'When should an outfitter email past clients?'],
      [
        'p',
        'Three times a year: a thank-you within a week of the hunt, a rebooking email in December or January, and an application reminder a few weeks before your state\'s deadline.',
      ],
      ['h3', 'What should a rebooking email say?'],
      [
        'p',
        'Real dates, the number of spots, the deposit amount and one clear ask: reply to hold a spot. Keep it plain text and short, and mention one specific thing from their hunt.',
      ],
      ['h3', 'How many follow-ups should I send?'],
      [
        'p',
        'One. If there is no reply to the rebooking email after about ten days, send a single short line, then stop.',
      ],
      ['h3', 'Do I need email software?'],
      [
        'p',
        'No. A spreadsheet and a mail merge in Gmail or Outlook work, or a free tool like MailerLite or Mailchimp. Send from your own address so it reads like a note from you.',
      ],
    ],
    faq: [
      [
        'When should an outfitter email past clients?',
        'Three times a year: a thank-you within a week of the hunt, a rebooking email in December or January, and an application reminder a few weeks before your state\'s deadline.',
      ],
      [
        'What should a rebooking email say?',
        'Real dates, the number of spots, the deposit amount and one clear ask: reply to hold a spot. Keep it plain text and short, and mention one specific thing from their hunt.',
      ],
      [
        'How many follow-ups should I send?',
        'One. If there is no reply to the rebooking email after about ten days, send a single short line, then stop.',
      ],
      [
        'Do I need email software?',
        'No. A spreadsheet and a mail merge in Gmail or Outlook work, or a free tool like MailerLite or Mailchimp. Send from your own address so it reads like a note from you.',
      ],
    ],
    cta: ['WANT THE FULL REBOOKING GUIDE? IT IS FREE', 'This is part of Guide 1 of our four free marketing guides for elk outfitters, with a checklist and the full sequence. The other three cover your Google profile, reviews and season calendar. Name and email, no card.'],
    related: ['outfitter-marketing.html', 'google-business-profile-for-outfitters.html'],
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const plain = (s) => s.replace(/<[^>]+>/g, '');
const jsonLd = (o) => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`;

const block = ([kind, a, b]) => {
  switch (kind) {
    case 'h2':
      return `<h2>${a}</h2>`;
    case 'h3':
      return `<h3>${a}</h3>`;
    case 'p':
      return `<p>${a}</p>`;
    case 'ul':
      return `<ul>${a.map((t) => `<li>${t}</li>`).join('')}</ul>`;
    case 'ol':
      return `<ol>${a.map((t) => `<li>${t}</li>`).join('')}</ol>`;
    case 'tpl':
      return `<div class="tpl"><span class="tpl-label">${a}</span>${b.map((t) => `<p>${t}</p>`).join('')}</div>`;
    default:
      throw new Error('unknown block ' + kind);
  }
};

const TITLES = Object.fromEntries(PAGES.map((p) => [p.file, p.title.split(':')[0]]));

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root { --black: #080808; --white: #f0ece3; --orange: #ff4d00; --gray: #888; --card: #111; --border: #1e1e1e; }
html { scroll-behavior: smooth; }
body { font-family: 'DM Sans', sans-serif; background: var(--black); color: var(--white); overflow-x: hidden; }
nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; background: rgba(8,8,8,0.9); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
.logo { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 0.04em; text-decoration: none; color: var(--white); }
.logo span { color: var(--orange); }
.nav-cta { font-size: 13px; font-weight: 500; color: var(--orange); text-decoration: none; letter-spacing: 0.06em; text-transform: uppercase; }
.page-header { padding: 160px 40px 40px; position: relative; overflow: hidden; }
.page-header::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,77,0,0.06) 0%, transparent 70%); pointer-events: none; }
.page-header-inner { max-width: 720px; margin: 0 auto; position: relative; }
.sec-tag { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--orange); letter-spacing: 0.12em; text-transform: uppercase; display: block; margin-bottom: 16px; }
.page-header h1 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(44px, 7vw, 76px); line-height: 1.0; letter-spacing: 0.02em; margin-bottom: 20px; }
.page-header h1 .accent { color: var(--orange); }
.page-header p { font-size: 18px; color: var(--gray); font-weight: 300; line-height: 1.7; max-width: 620px; }
.article { max-width: 720px; margin: 0 auto; padding: 10px 40px 40px; }
.article h2 { font-family: 'Bebas Neue', sans-serif; font-size: 36px; letter-spacing: 0.02em; line-height: 1.1; margin: 44px 0 14px; }
.article h3 { font-size: 19px; font-weight: 600; margin: 28px 0 8px; line-height: 1.35; }
.article p { font-size: 17px; line-height: 1.75; color: #d8d4ca; font-weight: 300; margin-bottom: 16px; }
.article p b, .article li b { font-weight: 600; color: var(--white); }
.article ul, .article ol { margin: 0 0 18px 22px; }
.article li { font-size: 17px; line-height: 1.7; color: #d8d4ca; font-weight: 300; margin-bottom: 10px; padding-left: 4px; }
.article a { color: var(--orange); text-decoration: none; border-bottom: 1px solid rgba(255,77,0,0.4); }
.tpl { background: var(--card); border: 1px solid var(--border); border-left: 3px solid var(--orange); padding: 22px 26px; margin: 8px 0 22px; }
.tpl-label { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--orange); letter-spacing: 0.1em; display: block; margin-bottom: 12px; }
.tpl p { font-size: 15.5px; color: var(--white); margin-bottom: 12px; line-height: 1.65; }
.tpl p:last-child { margin-bottom: 0; }
.cta-box { background: var(--card); border: 1px solid var(--border); border-left: 3px solid var(--orange); padding: 28px; margin: 48px 0 0; }
.cta-box h2 { font-size: 34px; margin: 0 0 10px; }
.cta-box p { font-size: 15px; color: var(--gray); margin-bottom: 18px; }
.cta-btn { display: inline-block; background: var(--orange); color: #fff !important; padding: 14px 26px; text-decoration: none; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; font-size: 14px; border-bottom: none !important; }
.more { max-width: 720px; margin: 0 auto; padding: 0 40px 30px; font-size: 14px; color: var(--gray); line-height: 2; }
.more a { color: var(--orange); text-decoration: none; }
footer { border-top: 1px solid var(--border); padding: 40px; text-align: center; }
footer p { font-size: 13px; color: #5a5a5a; }
@media(max-width: 700px) { nav { padding: 16px 20px; } .page-header { padding: 120px 20px 30px; } .article, .more { padding-left: 20px; padding-right: 20px; } .article h2 { font-size: 32px; } }`;

for (const p of PAGES) {
  const url = `${SITE}/${p.file}`;
  const related = p.related
    .map((f) => `<a href="${f}">${TITLES[f]}</a>`)
    .concat(['<a href="draw-dates.html">Elk application dates, all eight states</a>'])
    .join(' · ');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.title)} | Griffin Creative</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Griffin Creative Labs">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/images/logo-badge.webp">
<meta name="twitter:card" content="summary">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}
</style>
${jsonLd({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: p.title,
  description: p.description,
  datePublished: DATE,
  dateModified: DATE,
  mainEntityOfPage: url,
  image: `${SITE}/images/logo-badge.webp`,
  author: { '@type': 'Organization', name: 'Griffin Creative Labs', url: SITE + '/' },
  publisher: { '@type': 'Organization', name: 'Griffin Creative Labs', url: SITE + '/', logo: { '@type': 'ImageObject', url: `${SITE}/images/logo-badge.webp` } },
})}
${jsonLd({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plain(a) } })),
})}
</head>
<body>
<nav><a href="/" class="logo">GRIFFIN<span>CREATIVE</span></a><a href="${CTA_HREF}" class="nav-cta">Free guides</a></nav>
<div class="page-header"><div class="page-header-inner">
<span class="sec-tag">${p.tag}</span>
<h1>${p.h1[0]}<br><span class="accent">${p.h1[1]}.</span></h1>
<p>${p.intro}</p>
</div></div>
<div class="article">
${p.blocks.slice(0, p.blocks.findIndex((b) => b[1] === 'Common questions')).map(block).join('\n')}
<h2>Common questions</h2>
${p.faq.map(([q, a]) => `<h3>${q}</h3>\n<p>${a}</p>`).join('\n')}
<div class="cta-box"><h2>${p.cta[0]}</h2>
<p>${p.cta[1]}</p>
<a class="cta-btn" href="${CTA_HREF}">Get the free marketing guides</a></div>
</div>
<div class="more"><p>Keep reading: ${related}</p></div>
<footer><p>Griffin Creative Labs: marketing for elk outfitters in the West. griffincreativelab.com</p></footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, p.file), html);
  console.log('wrote', p.file, plain(html).split(/\s+/).length, 'words');
}
