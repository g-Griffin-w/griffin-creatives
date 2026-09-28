#!/usr/bin/env node
// scripts/import-guide-contacts.js
//
// Loads a guide client's own past-client list (name, email, phone, last trip
// date) into guide_client_contacts so api/send-guide-retention.js has a real
// list to send the approved "book next season" sequence to.
//
// No client-facing upload form yet — with zero real guide clients signed up
// as of this writing, a CLI import is the honest MVP; a web form is only
// worth building once someone is actually handing over a list.
//
// Expected CSV columns (header row required): name,email,phone,last_trip_date
// (phone and last_trip_date may be blank; name/email are required per row)
//
// Usage:
//   node scripts/import-guide-contacts.js past-clients.csv \
//     --guide-client-id=<uuid> --niche=salmon_guide

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

function die(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

// Minimal CSV parser — no quoted-comma support needed for this simple
// 4-column shape; if that ever changes, reach for a real CSV library instead
// of growing this by hand.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i] || ''));
    return row;
  });
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

  if (!file || !guideClientId || !niche) {
    die('usage: node scripts/import-guide-contacts.js <file.csv> --guide-client-id=<uuid> --niche=salmon_guide');
  }
  if (!fs.existsSync(file)) die(`file not found: ${file}`);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) die('missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (rows.length === 0) die('no data rows found in CSV');

  const contacts = [];
  const skipped = [];
  for (const [i, row] of rows.entries()) {
    const email = (row.email || '').trim().toLowerCase();
    const name = (row.name || '').trim();
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push({ line: i + 2, reason: !name ? 'missing name' : !email ? 'missing email' : 'invalid email' });
      continue;
    }
    contacts.push({
      guide_client_id: guideClientId,
      niche,
      contact_name: name,
      email,
      phone: row.phone || null,
      last_trip_date: row.last_trip_date || null,
      status: 'queued',
    });
  }

  if (contacts.length === 0) die('every row was skipped — check the CSV columns match: name,email,phone,last_trip_date');

  const { error } = await sb.from('guide_client_contacts').insert(contacts);
  if (error) die(`Supabase insert failed: ${error.message}`);

  console.log(`Imported ${contacts.length} contact(s) for guide_client_id=${guideClientId}.`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} row(s):`);
    skipped.forEach((s) => console.log(`  line ${s.line}: ${s.reason}`));
  }
}

main();
