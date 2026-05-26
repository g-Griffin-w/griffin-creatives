#!/usr/bin/env python3
"""
Apollo CSV -> Supabase outreach_leads transform.

Cleans an Apollo people export down to the 12 columns Supabase needs,
dedupes by email, normalizes blanks, and tags every row with a niche.

Usage:
    python apollo-to-supabase.py \\
        --input ~/Downloads/apollo-insurance-export.csv \\
        --output ~/griffin-creatives/insurance-leads-clean.csv \\
        --niche insurance_independent

Valid niche values (must exactly match the niche switch in
send-outreach.js's COLD_EMAIL_PROMPT):
    - insurance_independent
    - mortgage_broker
    - roofing
    - plumbing
"""

import argparse
import csv
import sys
from pathlib import Path

# Apollo column header -> Supabase column name.
# Apollo column names are case-sensitive and must match the CSV export.
APOLLO_TO_SUPABASE = {
    'First Name':         'first_name',
    'Last Name':          'last_name',
    'Title':              'job_title',
    'Email':              'email',
    'Person Linkedin Url':'linkedin_url',
    'Company':            'company_name',
    'Website':            'company_website',
    'Industry':           'company_industry',
    '# Employees':        'company_size',
    'City':               'company_city',
    'State':              'company_state',
}

VALID_NICHES = {
    'insurance_independent',
    'mortgage_broker',
    'roofing',
    'plumbing',
}


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Transform an Apollo people export into a Supabase-ready outreach_leads CSV.'
    )
    parser.add_argument('--input',  required=True, help='Path to the raw Apollo CSV export')
    parser.add_argument('--output', required=True, help='Path to write the cleaned CSV')
    parser.add_argument('--niche',  required=True, choices=sorted(VALID_NICHES),
                        help='Niche tag stamped onto every row (must match send-outreach.js)')
    args = parser.parse_args()

    input_path  = Path(args.input).expanduser()
    output_path = Path(args.output).expanduser()

    if not input_path.exists():
        print(f"ERROR: input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    seen_emails = set()
    output_rows = []
    skipped_no_email   = 0
    skipped_duplicate  = 0
    rows_read          = 0

    with input_path.open('r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)

        # Sanity check: does the Apollo file have the columns we expect?
        missing = [k for k in APOLLO_TO_SUPABASE if k not in (reader.fieldnames or [])]
        if missing:
            print(f"WARNING: Apollo file is missing expected columns: {missing}", file=sys.stderr)
            print(f"         These will appear blank in the output.", file=sys.stderr)

        for row in reader:
            rows_read += 1
            email = (row.get('Email') or '').strip().lower()

            if not email or '@' not in email:
                skipped_no_email += 1
                continue
            if email in seen_emails:
                skipped_duplicate += 1
                continue
            seen_emails.add(email)

            clean = {
                sb_col: (row.get(apollo_col) or '').strip()
                for apollo_col, sb_col in APOLLO_TO_SUPABASE.items()
            }
            clean['email'] = email     # keep lowercased / trimmed
            clean['niche'] = args.niche

            output_rows.append(clean)

    if not output_rows:
        print("ERROR: no valid rows produced. Check the input file format.", file=sys.stderr)
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(APOLLO_TO_SUPABASE.values()) + ['niche']
    with output_path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"Done.")
    print(f"  Input file:           {input_path}")
    print(f"  Output file:          {output_path}")
    print(f"  Niche tag applied:    {args.niche}")
    print(f"  Rows read:            {rows_read}")
    print(f"  Clean rows written:   {len(output_rows)}")
    print(f"  Skipped (no email):   {skipped_no_email}")
    print(f"  Skipped (duplicate):  {skipped_duplicate}")


if __name__ == '__main__':
    main()
