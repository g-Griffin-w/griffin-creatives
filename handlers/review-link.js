const { createClient } = require('@supabase/supabase-js');

// The link inside a review-request email: /api/review-link?t=<token>.
// Records the first click (so the reminder skips people who already opened it),
// then sends the hunter straight to the client's Google review form.
// Every hunter is sent to the same place regardless of who they are or what
// they might write. Google bans filtering who gets asked.

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async (req, res) => {
  const t = String(req.query?.t || '');
  if (!/^[a-f0-9]{32}$/.test(t)) return res.status(404).send('Not found');

  const { data: reqRow } = await supabase
    .from('review_requests')
    .select('id, status, clicked_at, guide_client_id')
    .eq('token', t)
    .maybeSingle();
  if (!reqRow) return res.status(404).send('Not found');

  const { data: client } = await supabase
    .from('griffin_clients')
    .select('review_url')
    .eq('id', reqRow.guide_client_id)
    .maybeSingle();
  if (!client || !client.review_url) return res.status(404).send('Not found');

  if (!reqRow.clicked_at) {
    await supabase
      .from('review_requests')
      .update({ clicked_at: new Date().toISOString(), status: reqRow.status === 'opted_out' ? 'opted_out' : 'clicked' })
      .eq('id', reqRow.id);
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(302).setHeader('Location', client.review_url).end();
};
