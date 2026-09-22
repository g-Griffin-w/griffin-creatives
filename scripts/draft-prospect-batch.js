#!/usr/bin/env node
// scripts/draft-prospect-batch.js — runs draftProspectConfig() across every
// held lead in Supabase, one clients/<slug>.json per company. Free (no FAL
// spend) — same scrape+draft step as draft-prospect-config.js, just looped.
//
// Pulls leads with status='skipped' AND notes containing 'HOLD' — leads put
// on hold specifically for batch sample generation (see the food_beverage
// pull + hold in this session). Never touches real skipped/rejected leads.
//
// Usage:
//   ANTHROPIC_API_KEY='...' SUPABASE_URL='...' SUPABASE_SERVICE_KEY='...' \
//     node scripts/draft-prospect-batch.js [--niche=food_beverage] [--limit=5]
//
// Does NOT call make-samples.js and does NOT spend FAL_KEY $ — drafting a
// config is free. Generation (real money) stays a deliberate follow-up step
// you run yourself, per company or in a batch, after spot-checking the drafts.

const { createClient } = require('@supabase/supabase-js');
const { draftProspectConfig, DraftError } = require('./draft-prospect-config.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const nicheArg = args.find((a) => a.startsWith('--niche='))?.slice(8) || 'food_beverage';
  const limitArg = parseInt(args.find((a) => a.startsWith('--limit='))?.slice(8), 10);
  const limit = Number.isFinite(limitArg) ? limitArg : Infinity;
  const force = args.includes('--force');

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.error('missing ANTHROPIC_API_KEY env var');
    process.exit(1);
  }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: leads, error } = await supabase
    .from('outreach_leads')
    .select('id, company_name, company_website, niche, notes')
    .eq('status', 'skipped')
    .eq('niche', nicheArg)
    .ilike('notes', '%HOLD%')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase fetch failed:', error.message);
    process.exit(1);
  }
  if (!leads || leads.length === 0) {
    console.log(`No held leads found (niche=${nicheArg}, status=skipped, notes ILIKE '%HOLD%').`);
    return;
  }

  const batch = leads.slice(0, limit);
  console.log(`Found ${leads.length} held lead(s), running ${batch.length}.\n`);

  const results = { ok: [], failed: [] };

  for (const [i, lead] of batch.entries()) {
    const label = `[${i + 1}/${batch.length}] ${lead.company_name}`;
    if (!lead.company_website) {
      console.log(`${label} — SKIP: no company_website on file`);
      results.failed.push({ company: lead.company_name, reason: 'no company_website' });
      continue;
    }
    console.log(`${label} — ${lead.company_website}`);
    try {
      const result = await draftProspectConfig({
        website: lead.company_website,
        niche: lead.niche,
        force,
        apiKey: ANTHROPIC_API_KEY,
        log: (m) => console.log(`    ${m}`),
      });
      console.log(`    OK -> ${result.outFile}${result.logoFound ? '' : '  [no logo found]'}${result.accentFound ? '' : '  [no accent found]'}`);
      results.ok.push({ company: lead.company_name, slug: result.slug, outFile: result.outFile, logoFound: result.logoFound, accentFound: result.accentFound });
    } catch (e) {
      const reason = e instanceof DraftError ? e.message : `unexpected error: ${e.message}`;
      console.log(`    FAILED — ${reason}`);
      results.failed.push({ company: lead.company_name, website: lead.company_website, reason });
    }
    // Throttle: be polite to prospects' sites and to the Anthropic API.
    if (i < batch.length - 1) await sleep(1500);
  }

  console.log('\n============================================================');
  console.log(`Done. ${results.ok.length} drafted, ${results.failed.length} failed.`);
  if (results.ok.length) {
    console.log('\nDrafted (NOT reviewed — read every concept before generating):');
    results.ok.forEach((r) => console.log(`  ${r.slug}${!r.logoFound || !r.accentFound ? '  [needs manual logo/accent fix]' : ''}`));
  }
  if (results.failed.length) {
    console.log('\nFailed (build these by hand instead):');
    results.failed.forEach((r) => console.log(`  ${r.company} — ${r.reason}`));
  }
  console.log('\nNEXT STEP: review each clients/<slug>.json (concepts + logo_url + accent),');
  console.log('then FAL_KEY=... node scripts/make-samples.js clients/<slug>.json per company you want to generate.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
