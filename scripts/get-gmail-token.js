/**
 * One-off: mint a Gmail refresh token WITH read + send scope.
 *
 * Why: the outreach sender only needs gmail.send, but check-replies.js and the
 * follow-up safeguard need to READ the inbox. gmail.modify covers both (read +
 * send + label), so this re-consents with the wider scope and prints a fresh
 * refresh token to paste into Vercel as GMAIL_REFRESH_TOKEN.
 *
 * HOW TO RUN (locally, once):
 *   1. In Google Cloud Console → your OAuth 2.0 Client → Authorized redirect
 *      URIs, add:  http://localhost:3000/oauth2callback
 *   2. From the repo root:
 *        GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy node scripts/get-gmail-token.js
 *      (or export them / put them in your shell env first)
 *   3. A browser opens Google's consent screen. Sign in as
 *      hello@griffincreativelab.com and click Allow.
 *   4. The script prints your new refresh token. Copy it into Vercel:
 *        Project → Settings → Environment Variables → GMAIL_REFRESH_TOKEN
 *      then redeploy.
 */

const http = require('http');
const { exec } = require('child_process');
const { google } = require('googleapis');

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

// gmail.modify = read + send + modify (everything we need, minus permanent delete).
// gmail.send is included explicitly so the existing sender behavior is guaranteed.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
];

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    '\nMissing env vars. Run like:\n' +
      '  GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy node scripts/get-gmail-token.js\n',
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // required to get a refresh token
  prompt: 'consent', // force a fresh refresh token even if previously granted
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get('code');
    if (!code) throw new Error('No authorization code in callback');

    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Success. You can close this tab and return to your terminal.');

    if (!tokens.refresh_token) {
      console.error(
        '\n No refresh_token returned. Revoke prior access at ' +
          'https://myaccount.google.com/permissions and run again.\n',
      );
    } else {
      console.log('\n==================== COPY THIS ====================');
      console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
      console.log('===================================================');
      console.log('Paste it into Vercel env vars, then redeploy.\n');
    }
  } catch (err) {
    res.writeHead(500);
    res.end('Error: ' + err.message);
    console.error('\nToken exchange failed:', err.message, '\n');
  } finally {
    setTimeout(() => server.close(() => process.exit(0)), 500);
  }
});

server.listen(PORT, () => {
  console.log('\nOpening Google consent screen in your browser...');
  console.log('If it does not open, paste this URL manually:\n');
  console.log(authUrl + '\n');
  // Best-effort auto-open (macOS `open`, Linux `xdg-open`, Windows `start`).
  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${opener} "${authUrl}"`);
});
