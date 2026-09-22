// api/pull-leads.js — automated Apollo lead pull, so outreach_leads never
// runs dry without someone remembering to do it manually. This is the
// automated version of the manual Apollo search + dedupe + enrich + insert
// flow, so send-outreach.js always has fresh queue instead of draining to
// zero the way it did before this file existed.
//
// Endpoint shape (params, auth, response fields) mirrors Apollo's People
// Search / Bulk Match APIs as observed through Apollo's own MCP tools in a
// live session on 2026-08-01 — the param names below (person_titles,
// organization_num_employees_ranges, q_organization_keyword_tags, etc.) are
// exactly what worked live against real Apollo data that session. Verify
// against https://apolloio.github.io/apollo-api-docs/ before the first real
// run in case the REST surface has since diverged from the MCP wrapper.
//
// Auth: Bearer CRON_SECRET (same secret as send-outreach.js / send-followups.js).
// New required env var: APOLLO_API_KEY (Apollo dashboard -> Settings -> Integrations -> API).
//
// Deliberately capped and low-frequency (see PULL_BATCH_SIZE) — this refills
// the queue, it does not try to out-pace send capacity (~25-50/day). Pulling
// faster than you can send just piles up an ignored backlog.
//
//   Header: Authorization: Bearer <CRON_SECRET>
//   GET /api/pull-leads?dry_run=1        — search + dedupe + enrich, don't insert
//   GET /api/pull-leads?niche=food_beverage&limit=30

const { createClient } = require('@supabase/supabase-js');

const APOLLO_BASE = 'https://api.apollo.io/v1';

// How many NEW (post-dedupe) leads to land per run. Override via env.
// Weekly cron at this size keeps ~1-4 weeks of send queue full without
// burning Apollo credits or prospect-list quality chasing volume.
const PULL_BATCH_SIZE = Math.max(1, Math.min(100, parseInt(process.env.PULL_LEADS_BATCH_SIZE, 10) || 30));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Search profiles per niche — keep these in sync with the actual strategy in
// use. Only food_beverage is wired up today (the agreed narrowed focus,
// 2026-08-01) — add more niches here deliberately, don't spray by default.
const NICHE_SEARCH_PROFILES = {
  food_beverage: {
    person_titles: ['founder', 'co-founder', 'ceo', 'owner', 'president'],
    organization_num_employees_ranges: ['1,10', '11,20'],
    q_organization_keyword_tags: ['food and beverage', 'beverage', 'snacks', 'kombucha', 'functional beverage', 'specialty food'],
    person_locations: ['United States'],
  },
};

function jsonHeaders(apiKey) {
  return { 'Content-Type': 'application/json', 'x-api-key': apiKey };
}

async function apolloSearch({ apiKey, profile, page }) {
  const resp = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
    method: 'POST',
    headers: jsonHeaders(apiKey),
    body: JSON.stringify({ ...profile, page, per_page: 100 }),
  });
  if (!resp.ok) {
    throw new Error(`Apollo search failed (${resp.status}): ${(await resp.text()).slice(0, 300)}`);
  }
  return resp.json();
}

async function apolloBulkMatch({ apiKey, ids }) {
  const resp = await fetch(`${APOLLO_BASE}/people/bulk_match`, {
    method: 'POST',
    headers: jsonHeaders(apiKey),
    body: JSON.stringify({ details: ids.map((id) => ({ id })) }),
  });
  if (!resp.ok) {
    throw new Error(`Apollo bulk_match failed (${resp.status}): ${(await resp.text()).slice(0, 300)}`);
  }
  return resp.json();
}

// Same merch-vs-flagship-product problem doesn't apply to people search, but
// the same-domain / duplicate-company problem does — a search page can
// return several employees of the same company, or a company we already
// have someone queued for.
function dedupeByDomain(people, alreadySeenDomains) {
  const seen = new Set(alreadySeenDomains);
  const out = [];
  for (const p of people) {
    const domain = (p.organization?.domain || '').toLowerCase().trim();
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    out.push({ ...p, domain });
  }
  return out;
}

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
  if (!APOLLO_API_KEY) {
    // Fail loud and visibly (500), unlike the per-lead soft-fail pattern in
    // send-outreach.js — a missing credential here means the WHOLE run is
    // broken, not one lead, and that must show up as a real error, not a
    // silent 200 (that exact failure mode is what let send-outreach.js run
    // dry for six days without anyone noticing).
    return res.status(500).json({ error: 'Missing APOLLO_API_KEY env var' });
  }

  const dryRun = req.query?.dry_run === '1';
  const niche = req.query?.niche || 'food_beverage';
  const profile = NICHE_SEARCH_PROFILES[niche];
  if (!profile) {
    return res.status(400).json({ error: `No search profile for niche "${niche}". Known: ${Object.keys(NICHE_SEARCH_PROFILES).join(', ')}` });
  }
  const rawLimit = parseInt(req.query?.limit, 10);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : PULL_BATCH_SIZE;

  try {
    const { data: existingRows, error: fetchErr } = await supabase
      .from('outreach_leads')
      .select('company_website')
      .not('company_website', 'is', null);
    if (fetchErr) return res.status(500).json({ error: 'Supabase fetch (existing domains) failed', detail: fetchErr.message });

    const existingDomains = existingRows
      .map((r) => (r.company_website || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase())
      .filter(Boolean);

    // Pull pages until we have enough post-dedupe candidates, capped at 5
    // pages (500 raw results) so a thin niche can't spin forever.
    let candidates = [];
    for (let page = 1; page <= 5 && candidates.length < limit; page++) {
      const result = await apolloSearch({ apiKey: APOLLO_API_KEY, profile, page });
      const people = Array.isArray(result?.people) ? result.people : [];
      if (people.length === 0) break;
      const fresh = dedupeByDomain(people, existingDomains.concat(candidates.map((c) => c.domain)));
      candidates = candidates.concat(fresh);
    }
    candidates = candidates.slice(0, limit);

    if (candidates.length === 0) {
      return res.status(200).json({ success: true, message: 'No new candidates found (all deduped against existing leads).', pulled: 0 });
    }

    // Enrich in batches of 10 (Apollo bulk_match limit) to reveal real work emails.
    const enriched = [];
    for (let i = 0; i < candidates.length; i += 10) {
      const chunk = candidates.slice(i, i + 10);
      const result = await apolloBulkMatch({ apiKey: APOLLO_API_KEY, ids: chunk.map((c) => c.id) });
      const matches = Array.isArray(result?.matches) ? result.matches : [];
      for (const m of matches) {
        if (!m.email || m.email_status !== 'verified') continue;
        const candidate = chunk.find((c) => c.id === m.id);
        if (!candidate) continue;
        enriched.push({
          first_name: m.first_name || candidate.first_name || '',
          last_name: m.last_name || candidate.last_name || '',
          email: m.email.toLowerCase(),
          job_title: candidate.title || '',
          linkedin_url: candidate.linkedin_url || '',
          company_name: candidate.organization?.name || '',
          company_website: `https://${candidate.domain}`,
          company_industry: 'Food & Beverage',
          niche,
          status: 'queued',
        });
      }
    }

    if (dryRun) {
      return res.status(200).json({ success: true, dry_run: true, candidates_found: candidates.length, would_insert: enriched.length, sample: enriched.slice(0, 5) });
    }

    if (enriched.length === 0) {
      return res.status(200).json({ success: true, message: 'Candidates found but none had a verified email.', candidates_found: candidates.length, pulled: 0 });
    }

    const { error: insertErr } = await supabase.from('outreach_leads').insert(enriched);
    if (insertErr) return res.status(500).json({ error: 'Supabase insert failed', detail: insertErr.message });

    return res.status(200).json({
      success: true,
      niche,
      candidates_found: candidates.length,
      pulled: enriched.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
