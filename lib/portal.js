// Portal keys open a client's mailbox-connect and hunter-intake links, so they
// are credentials. They live in client_portal_keys (RLS on, no policies:
// service role only), not on griffin_clients, which the public anon key can read.

const KEY_RE = /^[a-f0-9]{32}$/;

async function clientByKey(supabase, key, columns) {
  if (!KEY_RE.test(String(key || ''))) return null;
  const { data: row } = await supabase
    .from('client_portal_keys')
    .select('guide_client_id')
    .eq('portal_key', String(key))
    .maybeSingle();
  if (!row) return null;
  const { data: client } = await supabase
    .from('griffin_clients')
    .select(columns)
    .eq('id', row.guide_client_id)
    .maybeSingle();
  return client || null;
}

module.exports = { clientByKey };
