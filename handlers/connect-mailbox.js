const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { clientByKey } = require('../lib/portal');

// ============================================================
// Lets a paying client connect their own Gmail / Google Workspace mailbox so
// rebooking and review-request emails send from THEIR address.
//
//   Send the client:  https://www.griffincreativelab.com/api/connect-mailbox?k=<portal_key>
//
// They sign in with Google and approve ONE permission: "send email on your
// behalf". We never see their password, never read their inbox, and they can
// revoke access any time at myaccount.google.com/permissions.
//
// Setup (once, in Google Cloud Console, on the same OAuth app as GMAIL_CLIENT_ID):
//   - add redirect URI  https://www.griffincreativelab.com/api/connect-mailbox
//   - add scopes        gmail.send, userinfo.email
// See CLIENT-MAILBOX-SETUP.md.
// ============================================================

const SITE = 'https://www.griffincreativelab.com';
const REDIRECT_URI = `${SITE}/api/connect-mailbox`;
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(res, status, title, body) {
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title><meta name="robots" content="noindex">
<style>body{font-family:system-ui,sans-serif;background:#080808;color:#f0ece3;margin:0;padding:64px 24px}main{max-width:560px;margin:0 auto}h1{font-size:28px;margin:0 0 16px}p{color:#bbb;line-height:1.6}b{color:#f0ece3}</style>
</head><body><main><h1>${esc(title)}</h1>${body}</main></body></html>`);
}

const newOAuth = () => new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, REDIRECT_URI);

module.exports = async (req, res) => {
  const { k, code, state, error } = req.query || {};

  if (error) {
    return page(res, 200, 'Nothing was connected', '<p>You cancelled before approving, so nothing changed. You can try again from the same link any time.</p>');
  }

  // Step 2: Google sends the client back with ?code=...&state=<portal key>
  if (code && state) {
    const client = await clientByKey(supabase, state, 'id, business_name');
    if (!client) return page(res, 400, 'Link not recognized', '<p>This link has expired or is not valid. Ask Gabriel for a new one.</p>');

    try {
      const oauth = newOAuth();
      const { tokens } = await oauth.getToken(String(code));
      if (!tokens.refresh_token) {
        return page(res, 400, 'One more step', '<p>Google did not give us lasting permission. Remove “Griffin Creative Labs” at <b>myaccount.google.com/permissions</b>, then open the link again.</p>');
      }
      oauth.setCredentials(tokens);
      const info = await google.oauth2({ version: 'v2', auth: oauth }).userinfo.get();
      const email = info.data.email;
      if (!email) throw new Error('No email returned');

      const { error: dbErr } = await supabase.from('client_mailboxes').upsert({
        guide_client_id: client.id,
        email,
        refresh_token: tokens.refresh_token,
        status: 'connected',
        last_error: null,
        connected_at: new Date().toISOString(),
      });
      if (dbErr) throw dbErr;

      return page(res, 200, 'Connected', `<p>Done. Emails for <b>${esc(client.business_name || 'your business')}</b> will now go out from <b>${esc(email)}</b>, and replies will land in your inbox.</p><p>You can disconnect any time at myaccount.google.com/permissions. We can only send email. We cannot read your inbox.</p>`);
    } catch (err) {
      return page(res, 500, 'Something went wrong', '<p>We could not finish connecting. Tell Gabriel and we will fix it.</p>');
    }
  }

  // Step 1: client opens the link with their portal key.
  if (!k) return page(res, 400, 'Link not recognized', '<p>This link is missing its key. Ask Gabriel for a new one.</p>');
  const client = await clientByKey(supabase, k, 'id, email');
  if (!client) return page(res, 400, 'Link not recognized', '<p>This link has expired or is not valid. Ask Gabriel for a new one.</p>');

  const url = newOAuth().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: String(k),
    login_hint: client.email || undefined,
  });
  res.status(302).setHeader('Location', url).end();
};
