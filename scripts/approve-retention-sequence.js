#!/usr/bin/env node
// scripts/approve-retention-sequence.js
//
// Loads a human-reviewed retention-sequence markdown file (drafted by
// draft-retention-sequence.js, then read and edited by a person) into
// guide_retention_sequences with approved=true. This is the same gate
// make-samples.js's --approve is for images: api/send-guide-retention.js
// will refuse to send anything that isn't sitting in this table with
// approved=true, and this script is the only path that sets that flag.
//
// Hard-fails if any [bracketed placeholder] is still in the file — those
// exist specifically so no fabricated date/price/claim can ship by accident,
// same spirit as REVIEW.md's unchecked-box hard-fail.
//
// Usage:
//   node scripts/approve-retention-sequence.js retention-sequences/<slug>.md \
//     --guide-client-id=<uuid> --niche=salmon_guide --season-year=2026

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

function die(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

// Splits on "## <send_day> — <subject>" headers (the exact format
// draft-retention-sequence.js's toMarkdown() writes) into structured emails.
function parseSequenceMarkdown(md) {
  const blocks = md.split(/\n(?=## )/g).filter((b) => b.trim().startsWith('## '));
  const emails = [];
  for (const block of blocks) {
    const headerMatch = block.match(/^## (.+?) — (.+)$/m);
    if (!headerMatch) continue;
    const send_day = headerMatch[1].trim();
    const subject = headerMatch[2].trim();
    const body = block.slice(block.indexOf('\n') + 1).trim();
    if (body) emails.push({ send_day, subject, body });
  }
  return emails;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const get = (flag) => {
    const a = args.find((x) => x.startsWith(`--${flag}=`));
    return a ? a.slice(flag.length + 3) : '';
  };
  const guideClientId = get('guide-client-id');
  const niche = get('niche');
  const seasonYear = parseInt(get('season-year'), 10);
  // salmon_guide runs two windows a year (fall/spring) that can share a
  // season_year — defaults to 'main' for niches with only one window (elk_guide).
  const seasonLabel = get('season-label') || 'main';

  if (!file || !guideClientId || !niche || !Number.isFinite(seasonYear)) {
    die(
      'usage: node scripts/approve-retention-sequence.js <file.md> --guide-client-id=<uuid> --niche=salmon_guide --season-year=2026 [--season-label=fall]',
    );
  }
  if (!fs.existsSync(file)) die(`file not found: ${file}`);

  const md = fs.readFileSync(file, 'utf8');
  const placeholders = md.match(/\[[^\]]+\]/g) || [];
  if (placeholders.length > 0) {
    die(
      `${placeholders.length} bracketed placeholder(s) still in the file — fill in the real facts before approving:\n` +
        placeholders.map((p) => `  ${p}`).join('\n'),
    );
  }

  const emails = parseSequenceMarkdown(md);
  if (emails.length === 0) die('no "## Day N — Subject" sections found — check the file format matches draft-retention-sequence.js output');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) die('missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { error } = await sb
    .from('guide_retention_sequences')
    .upsert(
      {
        guide_client_id: guideClientId,
        niche,
        season_year: seasonYear,
        season_label: seasonLabel,
        emails,
        approved: true,
        approved_at: new Date().toISOString(),
      },
      { onConflict: 'guide_client_id,season_year,season_label' },
    );
  if (error) die(`Supabase upsert failed: ${error.message}`);

  console.log(`Approved ${emails.length} email(s) for guide_client_id=${guideClientId}, niche=${niche}, season_year=${seasonYear}, season_label=${seasonLabel}.`);
  console.log('api/send-guide-retention.js will now use this copy once each contact is due.');
}

main();
