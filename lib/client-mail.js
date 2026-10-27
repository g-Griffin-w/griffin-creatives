const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// Sends email on behalf of a paying client.
//
// 1. If the client connected their own Gmail / Google Workspace mailbox
//    (client_mailboxes, set up through /api/connect-mailbox), the message goes
//    out from THEIR address, lands in THEIR Sent folder, and replies come to
//    THEIR inbox.
// 2. If they haven't connected one, it falls back to our hello@ sender with
//    the client's name as the display name and the client's email as
//    Reply-To, so replies still reach the client.
//
// Nothing here writes copy. Callers pass the already-approved subject/body.
// ============================================================

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function gmailFor(refreshToken) {
  const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth });
}

function encodeMimeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?utf-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}

// Header values must never carry a line break (header injection).
const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

function generateMessageId(fromEmail) {
  const domain = (fromEmail && fromEmail.split('@')[1]) || 'griffincreativelab.com';
  return `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`;
}

async function getMailbox(clientId) {
  if (!clientId) return null;
  const { data } = await supabase
    .from('client_mailboxes')
    .select('email, refresh_token, status')
    .eq('guide_client_id', clientId)
    .eq('status', 'connected')
    .maybeSingle();
  return data || null;
}

// client: a griffin_clients row (id, full_name, business_name, email). May be null,
// in which case the message goes out as plain Griffin Creative Labs.
async function sendAsClient({ client, to, subject, body, threadId, inReplyTo }) {
  const mailbox = await getMailbox(client && client.id);

  let gmail, fromEmail, fromName, replyTo, mode;
  if (mailbox) {
    gmail = gmailFor(mailbox.refresh_token);
    fromEmail = mailbox.email;
    fromName = oneLine(client.full_name) || oneLine(client.business_name);
    mode = 'client_mailbox';
  } else {
    gmail = gmailFor(process.env.GMAIL_REFRESH_TOKEN);
    fromEmail = process.env.GMAIL_FROM_EMAIL;
    if (client) {
      const person = oneLine(client.full_name).split(/\s+/)[0];
      const biz = oneLine(client.business_name);
      fromName = person && biz ? `${person} at ${biz}` : biz || person || process.env.GMAIL_FROM_NAME;
      replyTo = oneLine(client.email) || null;
    } else {
      fromName = process.env.GMAIL_FROM_NAME;
    }
    mode = 'hello_fallback';
  }

  const headers = [
    `From: ${encodeMimeHeader(fromName)} <${fromEmail}>`,
    `To: ${oneLine(to)}`,
    `Subject: ${encodeMimeHeader(oneLine(subject))}`,
    `Message-ID: ${generateMessageId(fromEmail)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ];
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  const bodyEncoded = Buffer.from(body, 'utf-8').toString('base64').match(/.{1,76}/g).join('\r\n');
  const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + bodyEncoded)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const requestBody = { raw };
  if (threadId) requestBody.threadId = threadId;

  try {
    let result;
    try {
      result = await gmail.users.messages.send({ userId: 'me', requestBody });
    } catch (err) {
      // A thread started from a different mailbox (e.g. the sequence began from
      // hello@ and the client connected theirs later) isn't found here; send as a new thread.
      if (threadId && Number(err && (err.code || err.status)) === 404) {
        delete requestBody.threadId;
        result = await gmail.users.messages.send({ userId: 'me', requestBody });
      } else {
        throw err;
      }
    }
    return { ...result.data, mode, from: fromEmail };
  } catch (err) {
    // A revoked or expired client token should be visible, not retried forever.
    const msg = String((err && err.message) || err);
    if (mailbox && /invalid_grant|invalid_client|unauthorized_client/i.test(msg)) {
      await supabase
        .from('client_mailboxes')
        .update({ status: 'revoked', last_error: msg.slice(0, 300) })
        .eq('guide_client_id', client.id);
    }
    throw err;
  }
}

module.exports = { sendAsClient, supabase };
