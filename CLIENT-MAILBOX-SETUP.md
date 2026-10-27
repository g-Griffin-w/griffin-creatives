# Sending from the client's own mailbox

Rebooking emails and review requests now go out **from the client's own address** (for example `mike@blacktimber.com`), land in their Sent folder, and replies come to their inbox. If a client hasn't connected a mailbox, the system falls back to hello@ with the client's name on it (for example "Mike at Black Timber Outfitters") and the client's email as Reply-To, so replies still reach them.

## What each side does

**One time, you (Google Cloud Console, same project as the existing `GMAIL_CLIENT_ID`):**
1. APIs & Services → OAuth consent screen → add the scopes `.../auth/gmail.send` and `.../auth/userinfo.email`.
2. Credentials → your existing OAuth client → add the authorized redirect URI `https://www.griffincreativelab.com/api/connect-mailbox`.
3. Publishing status: **In production** (not Testing). In Testing, Google expires refresh tokens after 7 days, which would silently break sending.
4. Until Google verifies the app, clients see a "Google hasn't verified this app" screen and have to click Advanced → Continue. Unverified apps are capped at 100 users, which is plenty for now. Submit for verification once you have a few clients. `gmail.send` is a sensitive scope, which needs verification but not the heavier security audit that reading mail would need. Check Google's current requirements when you apply.

**Per client (2 minutes, can be done live on the kickoff call, see ONBOARDING-CALL.md):**
1. Get their links (the portal key is not stored on `griffin_clients` any more, it lives in `client_portal_keys`):
   ```bash
   node --env-file=.env.local scripts/onboard-client.js status "business name"
   ```
   It prints the connect-mailbox link and the hunter-intake link.
2. Send them the connect-mailbox link.
3. They sign in with Google and approve one permission: send email. We can't read their inbox, and they can revoke it any time at myaccount.google.com/permissions.
4. Also set their review link and mailing address (the review sender won't send without both). The mailing address is usually already there from the onboarding form:
   ```bash
   node --env-file=.env.local scripts/onboard-client.js set "business name" --review-url="https://search.google.com/local/writereview?placeid=..." --mailing-address="123 Main St, Town, ST 00000"
   ```
   Get the review link from their Business Profile, "Ask for reviews".
5. Send them their hunter intake page (also printed by `status`).

## Rules of thumb
- **Connect the mailbox before the first rebooking email goes out.** A thread started from hello@ can't be continued from their mailbox. The system sends the follow-up as a new thread if that happens, but it's cleaner to connect first.
- **Gmail and Google Workspace only.** A client with Outlook, Yahoo or a web-host (cPanel/GoDaddy) address uses the hello@ fallback with their name and Reply-To. Don't promise otherwise.
- **Keep volumes low.** Sending from their mailbox uses their sender reputation. Review requests are a handful per hunt. Rebooking is capped at 20 per run across all clients.
- **If a token is revoked or expires,** the mailbox row is marked `revoked` and the system falls back to hello@ instead of failing. Check with: `select * from client_mailboxes where status <> 'connected';`
- **Check Sent in their Gmail** after the first send, and have them confirm it looks right.

## Opt-outs
Replies of "stop" land in the client's inbox. Mark the hunter so they're never emailed again:
```sql
update review_requests set status = 'opted_out' where hunter_email = 'x@example.com';
update guide_client_contacts set status = 'unsubscribed', next_send_at = null where email = 'x@example.com';
```
