// Auto-reply for cold-outreach leads who answer the guides email with "send" / "yes".
// Used by api/check-replies.js. Pure functions, no network, so they can be tested alone.
//
// Every link in the email is a clickable button (see textToHtml in
// api/send-starter-kit-drip.js for the same button style) with a plain-text
// alternative, never a long URL pasted as the only way to click.

const GUIDE_BASE = 'https://www.griffincreativelab.com/guides/';
const BUTTON_STYLE =
  'background:#ff4d00;color:#ffffff;text-decoration:none;font-weight:bold;' +
  'padding:13px 24px;border-radius:4px;display:inline-block;font-size:15px';

const GUIDES = (stateName) => [
  {
    n: 1,
    title: 'Rebooking emails for past hunters',
    blurb: 'Thank-you, rebook, and application reminder templates.',
    url: `${GUIDE_BASE}rebooking-emails.html`,
  },
  {
    n: 2,
    title: 'Google Business Profile',
    blurb: 'Set up and edit your profile, about 45 minutes.',
    url: `${GUIDE_BASE}google-business-profile.html`,
  },
  {
    n: 3,
    title: 'Season marketing calendar',
    blurb: stateName
      ? `Fill in your ${stateName} application dates and it lays out the year around them.`
      : "Fill in your state's application dates and it lays out the year around them.",
    url: `${GUIDE_BASE}season-calendar.html`,
  },
  {
    n: 4,
    title: 'Reviews after every hunt',
    blurb: 'The link, a printable QR card, and the message to send.',
    url: `${GUIDE_BASE}review-requests.html`,
  },
];

const STATE_NAMES = {
  OR: 'Oregon', ID: 'Idaho', MT: 'Montana', WA: 'Washington',
  CA: 'California', WY: 'Wyoming', CO: 'Colorado', UT: 'Utah',
};
function stateName(raw) {
  const t = String(raw || '').trim();
  if (STATE_NAMES[t.toUpperCase()]) return STATE_NAMES[t.toUpperCase()];
  return Object.values(STATE_NAMES).find((n) => n.toLowerCase() === t.toLowerCase()) || '';
}

const EMAIL_FOOTER =
  '\n\n—\nGriffin Creative Labs · 203 SE 7th St, Sublimity, OR 97385\n' +
  'Not for you? Just reply "stop" and I won\'t email you again.';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildGuidesEmail({ first, state } = {}) {
  const hi = `Hi ${first || 'there'},`;
  const guides = GUIDES(stateName(state));
  const intro = 'Thanks for getting back to me. Here are the four guides. Each one is step by step, with copy-and-paste templates where they help, and you can work through them in any order.';
  const outro = "Reply here if anything doesn't fit how you run things and I'll help.";

  const text =
    `${hi}\n\n${intro}\n\n` +
    guides.map((g) => `${g.n}. ${g.title}: ${g.blurb}\n${g.url}`).join('\n\n') +
    `\n\n${outro}\n\nGabriel\nGriffin Creative Labs` +
    EMAIL_FOOTER;

  const p = (t, margin = '0 0 14px') => `<p style="margin:${margin}">${t}</p>`;
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222222;max-width:560px">' +
    p(esc(hi)) +
    p(esc(intro)) +
    guides
      .map(
        (g) =>
          p(`<b>${g.n}. ${esc(g.title)}</b><br>${esc(g.blurb)}`, '18px 0 4px') +
          p(`<a href="${esc(g.url)}" style="${BUTTON_STYLE}">Read guide ${g.n}</a>`),
      )
      .join('') +
    p(esc(outro), '18px 0 14px') +
    p('Gabriel<br>Griffin Creative Labs') +
    '<p style="margin:22px 0 0;font-size:12px;color:#888888">Griffin Creative Labs · 203 SE 7th St, Sublimity, OR 97385<br>' +
    'Not for you? Just reply "stop" and I won\'t email you again.</p>' +
    '</div>';

  return { text, html };
}

// ---------- Reading the reply ----------

// The part of a reply the person actually wrote: everything above the quoted
// original ("On ... wrote:", "From:", "> ...") and the signature separator.
function ownText(plain) {
  const out = [];
  for (const line of String(plain || '').split(/\r?\n/)) {
    const t = line.trim();
    if (/^>/.test(t)) break;
    if (/^on .{5,200}wrote:?$/i.test(t)) break;
    if (/^(from|sent|to|subject):\s/i.test(t)) break;
    if (/^(-{2,}|_{5,}|\*{3,})/.test(t)) break;
    if (/^sent from my /i.test(t)) break;
    out.push(t);
  }
  return out.join('\n').trim();
}

const LEAD_IN = '(?:(?:yes|yeah|yep|yup|ya|sure|ok|okay|please|absolutely|definitely|certainly|of course)\\b[\\s,]*)*';
const CORE =
  "(?:(?:go ahead and |do )?send(?: (?:it|them|those|over|me|us|the guides|the four guides|the 4 guides))*" +
  "|go ahead|sounds good|that would be (?:great|helpful|nice)|(?:i'?d|we'?d) (?:like|love) (?:that|them|to see them)|interested)?";
const TAIL = '(?:[\\s,]*(?:thanks|thank you|thx))?';
const AFFIRM = new RegExp(`^${LEAD_IN}${CORE}${TAIL}$`);

// True only for a short, plain yes. Anything with extra content ("send me
// pricing", "yes but not now", a question) is false, so a person reads it.
function wantsGuides(plain) {
  const lines = ownText(plain).split('\n').map((l) => l.trim()).filter(Boolean);
  // "Hi Gabriel," on its own line is a greeting, not the answer.
  if (lines.length > 1 && /^(hi|hey|hello|good (morning|afternoon))\b[a-z\s,.!']{0,30}$/i.test(lines[0])) lines.shift();
  const norm = (lines[0] || '')
    .toLowerCase()
    .replace(/[^a-z' \n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm || norm.split(' ').length > 9) return false;
  if (/^(thanks|thank you|thx)$/.test(norm)) return false;
  return AFFIRM.test(norm);
}

// Plain-text body of a Gmail message resource (format=full), or ''.
function plainBodyOf(payload) {
  if (!payload) return '';
  const decode = (d) => Buffer.from(d.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  const walk = (part) => {
    if (part.mimeType === 'text/plain' && part.body && part.body.data) return decode(part.body.data);
    for (const sub of part.parts || []) {
      const hit = walk(sub);
      if (hit) return hit;
    }
    return '';
  };
  return walk(payload);
}

// Skip bounces, no-reply addresses and anything marked automatic.
function isAutomated(fromAddr, headers = []) {
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce)/i.test(fromAddr || '')) return true;
  const h = (name) => ((headers.find((x) => x.name.toLowerCase() === name) || {}).value || '').toLowerCase();
  const auto = h('auto-submitted');
  if (auto && auto !== 'no') return true;
  if (/bulk|junk|auto_reply/.test(h('precedence'))) return true;
  return false;
}

// ---------- Building the message ----------

const b64 = (s) => Buffer.from(s, 'utf-8').toString('base64').match(/.{1,76}/g).join('\r\n');
function mimeHeader(v) {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(v) ? v : `=?utf-8?B?${Buffer.from(v, 'utf-8').toString('base64')}?=`;
}

// Base64url raw message (text + HTML alternative) threaded onto the lead's reply.
function buildRawReply({ to, fromEmail, fromName, subject, text, html, inReplyTo }) {
  const boundary = `=_gc_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ${mimeHeader(fromName || 'GriffinCreative')} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${mimeHeader(subject)}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${fromEmail.split('@')[1] || 'griffincreativelab.com'}>`,
    'MIME-Version: 1.0',
  ];
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`);
  }
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  const message =
    headers.join('\r\n') + '\r\n\r\n' +
    `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(text)}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(html)}\r\n` +
    `--${boundary}--`;
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

module.exports = { buildGuidesEmail, buildRawReply, wantsGuides, ownText, plainBodyOf, isAutomated, stateName };
