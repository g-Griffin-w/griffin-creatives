# Lock down the griffin_clients table

**Status: APPLIED on 2026-10-27**, after the deploy was verified. With the public key, reads, inserts and updates on `griffin_clients` now return "permission denied", and `client_portal_keys` returns nothing. The onboarding form, photo uploads and all scripts still work because they go through the server with the service key.

**If something outside this repo breaks** (an old Stripe, Make or Zapier flow that wrote to this table with the public key; the last such row was created 2026-06-10), the rollback below restores the old access. It also reopens the hole, so prefer fixing that flow to use the service key.
```sql
grant select, insert, update on public.griffin_clients to anon;
create policy "Allow anon select" on public.griffin_clients for select to anon using (true);
create policy "allow_public_insert" on public.griffin_clients for insert to anon with check (true);
create policy "Allow public update by stripe_customer_id" on public.griffin_clients for update to anon using (true) with check (true);
```

The notes below are the original plan and reasoning.

## The problem
`griffin_clients` currently allows the **public anon key** to read, insert and update **every row**. That key is visible in `onboarding.html`, so anyone who views the page source has it. A real client's name, email, phone, past-client list (hunters' emails and phones), review link and mailing address would be readable and editable by anyone.

Today the table only holds four old test/DTC rows, so nothing sensitive is exposed yet. It matters the moment a real client is added.

Policies currently on the table (all for the `anon` role):
- `allow_public_insert` (INSERT, true)
- `Allow anon insert` (INSERT, true)
- `Allow public update by stripe_customer_id` (UPDATE, true) -- despite the name it has no condition
- `Allow anon select` (SELECT, true)

## What already changed in code
- The onboarding form no longer writes to the table from the browser. It posts to `/api/save-onboarding`, which uses the service key and accepts only the form's fields.
- Portal keys (the credentials in the mailbox-connect and hunter-intake links) moved out of `griffin_clients` into `client_portal_keys`, which the anon key cannot read.
- `/api/get-upload-url` now finds clients by the same id the link carries.

## Order matters
1. Push the code and let it deploy.
2. Verify the deployed form still saves (use a throwaway client: `onboard-client.js new`, fill the form on the live site, then `status`), and delete the throwaway.
3. **Then** run the SQL below. Running it before the deploy breaks the live form.

## Check first
The policy names suggest an older Stripe-driven flow. Before dropping them, confirm nothing else (a Make/Zapier scenario, a Stripe webhook, another site on this Supabase project) writes to `griffin_clients` with the anon key. In this repo only `onboarding.html` used it.

## The SQL
```sql
drop policy if exists "allow_public_insert" on public.griffin_clients;
drop policy if exists "Allow anon insert" on public.griffin_clients;
drop policy if exists "Allow public update by stripe_customer_id" on public.griffin_clients;
drop policy if exists "Allow anon select" on public.griffin_clients;
revoke all on public.griffin_clients from anon;
-- service_role_all stays: the API routes and scripts use the service key.
```

## Verify
Using the anon key from `onboarding.html`, this should return `[]` or a permission error, not rows:
```bash
curl -s "https://gcatvqcntgizjsdoabva.supabase.co/rest/v1/griffin_clients?select=id&limit=1" \
  -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>"
```
