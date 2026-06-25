# Drop-in update for the `daily-apollo-dtc-leads` skill

I can't edit a saved skill from inside a session. To apply this, open **Settings → Capabilities → daily-apollo-dtc-leads** and replace the skill body with the version below. Two real changes:

1. **Targeting** — only pulls the three locked niches (fishing/outdoor, food/beverage, supplements) instead of five broad buckets.
2. **Tagging** — sets `niche` to the correct slug per bucket (`fishing_outdoor` / `food_beverage` / `supplements`) so it matches what `send-outreach.js` expects. (The sender now also re-classifies from the live website at send time, so this tag is a head start, not the final word.)

Everything else — Shopify filter, agency/SaaS post-filter, dedupe, insert, report — is unchanged.

---

Pull 30 DTC product-brand decision-maker leads from Apollo across our three target niches and insert them into the Supabase `outreach_leads` table. Target ACTUAL product brand operators — not agencies, SaaS tools, or aggregators.

## Step 1 — Search Apollo
Use `apollo_mixed_people_api_search` with these filters:

- `person_titles`: ["founder", "co-founder", "owner", "CEO", "CMO", "head of marketing", "head of growth", "VP marketing", "marketing director", "ecommerce director", "director of ecommerce"]
- `person_seniorities`: ["owner", "founder", "c_suite", "vp", "head", "director"]
- `person_locations`: ["United States"]
- `organization_num_employees_ranges`: ["1,10", "11,50", "51,200"]
- `contact_email_status`: ["verified"]
- `currently_using_any_of_technology_uids`: ["shopify"]
- `q_organization_keyword_tags`: pick ONE niche bucket per page and ROTATE across the three so the pipeline stays balanced:
  - **fishing_outdoor**: ["fishing", "tackle", "fishing gear", "outdoor gear", "hunting", "camping", "kayak", "fly fishing", "angler"]
  - **food_beverage**: ["snack", "beverage", "coffee", "functional beverage", "CPG", "hot sauce", "energy drink", "kombucha"]
  - **supplements**: ["supplements", "vitamins", "protein", "collagen", "creatine", "electrolyte", "greens", "nutrition"]
- `per_page`: 30, `page`: 1

**Post-filter (Apollo has no negative keyword filter):** Drop any result whose `organization.industry` is `marketing & advertising`, `information technology & services`, `management consulting`, `computer software`, OR `mechanical or industrial engineering`. Also drop any org whose name/keywords contain "agency", "consulting", "SaaS", "platform", "aggregator", "Shopify partner", or "Shopify expert".

For each remaining contact capture: apollo person id, email, first_name, last_name, title, linkedin_url, and the org's name, website, industry, estimated_num_employees, city, state. **Also record which niche bucket the result came from** — you'll write it to the `niche` field in Step 3.

Aim for a roughly even split across the three buckets. If a page yields fewer than expected after filter + dedupe, paginate (page=2, 3, …) and rotate buckets. Cap at 6 total Apollo pages to protect credits.

## Step 2 — Dedupe against Supabase
Supabase project_id: `gcatvqcntgizjsdoabva`. Table: `public.outreach_leads`.

```sql
SELECT email, apollo_id FROM public.outreach_leads
WHERE email = ANY($emails) OR apollo_id = ANY($apollo_ids);
```
(Substitute the actual arrays inline as SQL literals — execute_sql does not support parameters.)

Drop any Apollo result whose email OR apollo_id already exists. Top up to 30 net-new if needed.

## Step 3 — Insert into Supabase
Single INSERT via `execute_sql`. Map fields:
- apollo_id ← Apollo person id
- email ← person.email
- first_name / last_name / job_title / linkedin_url ← person fields
- company_name ← organization.name
- company_website ← organization.website_url
- company_industry ← organization.industry
- company_size ← organization.estimated_num_employees (as text)
- company_city / company_state ← organization fields
- **niche ← the slug of the bucket the lead came from: `'fishing_outdoor'`, `'food_beverage'`, or `'supplements'`**
- status ← 'queued' (omit to use default)

Use `ON CONFLICT (email) DO NOTHING`. Escape single quotes (`'` → `''`).

## Step 4 — Report
Brief summary: results scanned per bucket, how many filtered as agency/SaaS, duplicates skipped, rows inserted, the per-niche split, 3 sample company names + titles, any errors.

If Apollo auth fails, tell the user to re-authenticate the Apollo MCP and stop — do not retry.
