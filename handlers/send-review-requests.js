const { sendAsClient, supabase } = require('../lib/client-mail');

// ============================================================
// Review requests, sent automatically after every hunt.
//
// Hunters are queued by api/log-hunters.js (the outfitter pastes who just left
// camp). This daily job:
//   1. sends the request on/after send_at (the day after the hunt ends)
//   2. sends ONE reminder, 6 days later, only to people who haven't clicked
//
// Fixed copy, no AI. Goes out from the client's own mailbox if they connected
// one (see /api/connect-mailbox), otherwise from hello@ with their name and
// Reply-To. Every hunter gets the same link to the same review form.
//
// Google rules this respects: no incentives, no filtering who gets asked, no
// asking for a particular rating.
//
//   POST /api/send-review-requests   Authorization: Bearer <CRON_SECRET>
//   ?dry_run=1 to preview. ?limit=N to cap the batch.
// ============================================================

const SITE = 'https://www.griffincreativelab.com';
const BATCH = Math.max(1, Math.min(60, parseInt(process.env.REVIEW_REQUEST_BATCH_SIZE, 10) || 40));
const REMINDER_AFTER_DAYS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => 3000 + Math.floor(Math.random() * 4000);

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';
const clean = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

function footer(client) {
  return [
    '',
    '--',
    `${clean(client.business_name)}`,
    clean(client.mailing_address),
    `You're getting this because you hunted with ${clean(client.business_name)}. Reply "stop" and we won't email you again.`,
  ].join('\n');
}

function buildRequest(client, row, link) {
  const owner = firstName(client.full_name);
  return {
    subject: `Thank you from ${clean(client.business_name)}`,
    body: [
      `Hi ${firstName(row.hunter_name)},`,
      '',
      `Thank you for hunting with ${clean(client.business_name)}. It was a pleasure having you in camp.`,
      '',
      'If you have two minutes, would you leave an honest review on Google? It helps other hunters find us, and it means a lot to a small outfit like ours.',
      '',
      link,
      '',
      'Whatever you write, thank you.',
      '',
      owner,
      footer(client),
    ].join('\n'),
  };
}

function buildReminder(client, row, link) {
  return {
    subject: `Re: Thank you from ${clean(client.business_name)}`,
    body: [
      `Hi ${firstName(row.hunter_name)},`,
      '',
      "Just a quick reminder in case my last note got buried. Here's the link again:",
      '',
      link,
      '',
      "If you've already left a review, thank you. No need to reply.",
      '',
      firstName(client.full_name),
      footer(client),
    ].join('\n'),
  };
}

module.exports = async (req, res) => {
  if ((req.headers.authorization || '') !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const dryRun = req.query?.dry_run === '1';
  const rawLimit = parseInt(req.query?.limit, 10);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(BATCH, rawLimit)) : BATCH;

  try {
    const nowIso = new Date().toISOString();
    const reminderCutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * DAY_MS).toISOString();

    const [dueRes, remindRes] = await Promise.all([
      supabase.from('review_requests').select('*').eq('status', 'queued').lte('send_at', nowIso).order('send_at').limit(limit),
      supabase.from('review_requests').select('*').eq('status', 'sent').is('clicked_at', null).is('reminder_sent_at', null).lte('sent_at', reminderCutoff).order('sent_at').limit(limit),
    ]);
    if (dueRes.error || remindRes.error) {
      return res.status(500).json({ error: 'fetch failed', detail: (dueRes.error || remindRes.error).message });
    }

    const work = [
      ...(dueRes.data || []).map((r) => ({ r, kind: 'request' })),
      ...(remindRes.data || []).map((r) => ({ r, kind: 'reminder' })),
    ].slice(0, limit);

    const out = { sent: 0, reminders: 0, failed: 0, skipped_setup: 0, dry_run: dryRun, errors: [], drafts: [] };
    if (work.length === 0) return res.status(200).json({ success: true, message: 'No review requests due', ...out });

    const clients = new Map();
    const getClient = async (id) => {
      if (!clients.has(id)) {
        const { data } = await supabase
          .from('griffin_clients')
          .select('id, full_name, business_name, email, review_url, mailing_address')
          .eq('id', id)
          .maybeSingle();
        clients.set(id, data || null);
      }
      return clients.get(id);
    };

    for (let i = 0; i < work.length; i++) {
      const { r, kind } = work[i];
      try {
        const client = await getClient(r.guide_client_id);
        // Never send for a client whose review link or mailing address isn't set yet.
        if (!client || !client.review_url || !client.mailing_address) { out.skipped_setup++; continue; }

        const link = `${SITE}/api/review-link?t=${r.token}`;
        const msg = kind === 'request' ? buildRequest(client, r, link) : buildReminder(client, r, link);

        if (dryRun) {
          out.drafts.push({ kind, to: r.hunter_email, subject: msg.subject, body: msg.body });
          continue;
        }

        const sent = await sendAsClient({ client, to: r.hunter_email, subject: msg.subject, body: msg.body });
        const patch = kind === 'request'
          ? { status: 'sent', sent_at: new Date().toISOString(), send_mode: sent.mode, last_error: null }
          : { status: 'reminded', reminder_sent_at: new Date().toISOString() };
        const { error } = await supabase.from('review_requests').update(patch).eq('id', r.id);
        if (error) throw error;
        kind === 'request' ? out.sent++ : out.reminders++;
        if (i < work.length - 1) await sleep(delay());
      } catch (err) {
        out.failed++;
        out.errors.push({ id: r.id, kind, error: String(err.message || err).slice(0, 200) });
        if (!dryRun && kind === 'request') {
          await supabase.from('review_requests').update({ status: 'failed', last_error: String(err.message || err).slice(0, 300) }).eq('id', r.id);
        }
      }
    }

    return res.status(200).json({ success: true, ...out, timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports.config = { maxDuration: 300 };
