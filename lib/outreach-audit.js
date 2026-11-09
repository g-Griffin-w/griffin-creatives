// lib/outreach-audit.js
//
// The cold email's "tip" opener (2026-11-02). Reads a lead's own home page and
// returns ONE real, checkable observation plus a free fix they can do
// themselves. Every claim is something read off that page; if the page can't
// be read or nothing is clearly missing, this returns null and the sender falls
// back to the standard guides email. It never says anything about Google
// reviews or their Google profile, because we can't see those from here.
//
// Kill switch: set OUTREACH_SITE_TIP=0 in Vercel to send the standard email.

const BOOK_URL =
  'https://calendly.com/hello-griffincreativelab/15-minute-phone-call?utm_source=cold-email&utm_medium=email&utm_campaign=site-tip';
const BOOK_LABEL = 'Book a 15-minute call';

// Listings and social pages are not the outfitter's own site.
const NOT_A_SITE =
  /(^|\.)(facebook|instagram|youtube|linkedin|twitter|x|yelp|google|guidefitter|linktr\.ee|tripadvisor|yellowpages|mapquest|bbb|wixsite|business\.site)\./i;

const strip = (s) =>
  s
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function fetchHome(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)' },
    });
    if (!resp.ok) return null;
    if (!/text\/html/i.test(resp.headers.get('content-type') || '')) return null;
    return (await resp.text()).slice(0, 400000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Facts read from the page. Missing-things checks look at the raw HTML too, so
// a review widget or a "2027" inside a script still counts as present. Better
// to skip a real gap than to tell someone something that isn't true.
function readFacts(html) {
  const text = strip(html);
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) || [])[1] ||
    (html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) || [])[1] || '';
  return {
    words: text ? text.split(' ').length : 0,
    huntRelated: /\b(elk|hunt|hunting|outfitter|guide)\b/i.test(text),
    title,
    hasDesc: desc.trim().length > 20,
    has2027: /2027/.test(html),
    hasReviews: /review|testimonial|what (our )?(clients|hunters|guests|customers) say/i.test(html),
    hasRates: /\$\s?\d/.test(text),
    hasTel: /href=["']tel:/i.test(html),
  };
}

function chooseTip(f, { company, state }) {
  const good =
    f.hasRates ? 'I like that you list your rates.' :
    f.hasTel ? 'Your phone number is a tap-to-call link, which is what hunters on phones want.' :
    /\belk\b/i.test(f.title) ? 'Your page title says elk right up front.' :
    '';

  if (!f.has2027) {
    return {
      good,
      fix: 'put your 2027 open weeks and a clear "now booking" line near the top of your home page.',
      reason: "I didn't see 2027 dates there, and hunters planning next season look for open dates before they call.",
    };
  }
  if (!f.hasReviews) {
    return {
      good,
      fix: "add three short quotes from past hunters (first name and year) near the top of your home page, and ask last season's hunters for a Google review while the trip is still fresh.",
      reason: "I didn't see any reviews or testimonials there, and hunters comparing outfitters look for them first.",
    };
  }
  if (f.title && !/\belk\b/i.test(f.title) && f.title.length <= 90) {
    const name = state ? `Elk Hunts in ${state} | ${company}` : `Elk Hunts | ${company}`;
    return {
      good,
      fix: `rewrite your page title as "${name}".`,
      reason: `It currently reads "${f.title}", which doesn't say elk, so it's easy to overlook in search.`,
    };
  }
  if (!f.hasDesc) {
    return {
      good,
      fix: 'add a two-line description with your state, elk, and your 2027 dates (most website builders have an SEO field for it).',
      reason: 'Google has no description to show under your name in search results, so it picks a random line from your page.',
    };
  }
  return null;
}

// Returns { good, fix, reason } for the lead's home page, or null when we shouldn't
// use the tip email (no site, unreadable, not an outfitter site, nothing wrong).
async function tipForSite(rawUrl, { company, state } = {}) {
  if (process.env.OUTREACH_SITE_TIP === '0') return null;
  let url;
  try {
    const u = String(rawUrl || '').trim();
    if (!u || /^(n\/a|none|null)$/i.test(u)) return null;
    url = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u);
  } catch {
    return null;
  }
  if (NOT_A_SITE.test(url.hostname + '.')) return null;
  const html = await fetchHome(url.href);
  if (!html) return null;
  const facts = readFacts(html);
  // Too little text means a JavaScript-only site (Wix/Squarespace shell) or a
  // parked page; we can't tell what's missing, so don't guess.
  if (facts.words < 120 || !facts.huntRelated) return null;
  return chooseTip(facts, { company, state });
}

function buildTipEmail({ firstName, company, datesPhrase, tip }) {
  const lead = tip.good ? `${tip.good} One thing that would help right away:` : 'One thing that would help right away:';
  const body =
    `Hey ${firstName},\n\n` +
    `I'm Gabriel with Griffin Creative Labs. We're a marketing agency that works with outfitters in the West. I looked at ${company} online and wanted to pass something along, no strings.\n\n` +
    `${lead} ${tip.fix} ${tip.reason}\n\n` +
    `We put together five free marketing guides for outfitters (Google profile, rebooking emails, a season calendar with ${datesPhrase}, reviews, and getting found on Google). ` +
    `Want me to send them over? Just reply "send" and I will.\n\n` +
    `You can find us at griffincreativelab.com.\n\n` +
    `${BOOK_URL}\n\n` +
    `Gabriel\nGriffin Creative Labs`;
  return {
    subject: `A tip for filling ${/s$/i.test(company) ? company + "'" : company + "'s"} 2027 calendar`,
    body,
    cta: { url: BOOK_URL, label: BOOK_LABEL },
  };
}

module.exports = { tipForSite, buildTipEmail, readFacts, chooseTip, BOOK_URL, BOOK_LABEL };
