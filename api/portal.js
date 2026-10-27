// Vercel Serverless Function: the single entry point for the client-facing and
// review-request routes.
//
// Vercel's Hobby plan allows at most 12 serverless functions per deployment and
// api/ was already at 12, so these routes share one function. The public URLs
// are unchanged; vercel.json rewrites each one here with ?action=<name>:
//
//   /api/connect-mailbox       client connects their Gmail (Google OAuth redirect URI)
//   /api/log-hunters           hunter intake page: status + add hunters
//   /api/review-link           tracked redirect to the client's Google review form
//   /api/save-onboarding       onboarding form submit
//   /api/get-upload-url        onboarding form photo/logo uploads
//   /api/send-review-requests  daily cron (Bearer CRON_SECRET)
//
// The handlers live in handlers/ (files in api/ each count as a function).
// They are required lazily so a request only loads what it needs.

const LOADERS = {
  'connect-mailbox': () => require('../handlers/connect-mailbox'),
  'log-hunters': () => require('../handlers/log-hunters'),
  'review-link': () => require('../handlers/review-link'),
  'save-onboarding': () => require('../handlers/save-onboarding'),
  'get-upload-url': () => require('../handlers/get-upload-url'),
  'send-review-requests': () => require('../handlers/send-review-requests'),
};

function actionOf(req) {
  const fromQuery = req.query && req.query.action;
  if (typeof fromQuery === 'string' && LOADERS[fromQuery]) return fromQuery;
  // Fall back to the requested path in case the rewrite did not pass ?action.
  const path = String(req.url || '').split('?')[0];
  const last = path.split('/').filter(Boolean).pop() || '';
  return LOADERS[last] ? last : '';
}

module.exports = async (req, res) => {
  const action = actionOf(req);
  if (!action) return res.status(404).json({ error: 'Not found' });
  return LOADERS[action]()(req, res);
};

// The daily review-request sender can run for minutes; the other routes return fast.
module.exports.config = { maxDuration: 300 };
