# Private accounts, application tracking and email tracking

Path Match works without any of this. Accounts are **optional** and switch on only when `docs/config.js` has Supabase keys.

## What it adds

| Feature | How |
| --- | --- |
| Private account | Sign in with an emailed link (Google optional). Every table row carries `user_id`; Postgres Row-Level Security means a signed-in user can only read or change their own rows. |
| Saved results | The parsed CV profile (keywords plus short excerpts, never the file or full text) and the top 50 matches are saved to the account, only if the user leaves "Save" ticked. |
| "I applied" | A button on every posting records the application. The **My applications** tab shows Applied, Interview, Offer, Rejected, Withdrawn, and **Ghosted?** (no reply after 14, 21, 30 or 45 days, the user's choice). |
| Email tracking | Each user gets a private forwarding address. Confirmation, interview, rejection and offer emails update the right application automatically. A "paste an email" box covers anyone who cannot forward. |
| Block company | Hides a company from the user's lists. A company that ghosted the user before is flagged on its other postings. |
| Data controls | Download my data (JSON), delete my CV profile and matches, delete my account and everything in it. |

## Set it up (about 30 minutes)

You need: a free Supabase project, the Supabase CLI, and (for email forwarding only) a domain you own plus a free or cheap inbound-email service.

### 1. Database
1. Create a project at https://supabase.com. Pick a Canadian region if one is offered.
2. Open **SQL Editor**, paste `supabase/migrations/20261024000000_accounts.sql`, run it. (Or `supabase link --project-ref <ref>` then `supabase db push`.)

### 2. Sign-in
1. **Authentication, URL Configuration**: set *Site URL* to `https://molu221.github.io/Path_Match_V1/` and add the same address under *Redirect URLs*.
2. Email sign-in links work by default. Supabase's built-in sender has a very low hourly limit, so for real users add your own SMTP under **Authentication, Emails**.
3. Optional Google sign-in: enable the Google provider with your OAuth client, then set `providers: ["google"]` in `docs/config.js`.

### 3. Point the site at your project
Edit `docs/config.js` and commit it:

```js
window.PM_CONFIG = {
  supabaseUrl: "https://<project-ref>.supabase.co",
  supabaseAnonKey: "<anon public key>",      // Project Settings > API. NEVER the service_role key
  inboundDomain: "mail.yourdomain.com",      // leave "" until step 5 is done
  providers: [],
};
```
The anon key is public by design. It is safe only because of the Row-Level Security rules in the migration.

### 4. Server functions
```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy inbound-email --no-verify-jwt     # called by the email provider, protected by a secret
supabase functions deploy paste-email
supabase functions deploy delete-account
supabase secrets set INBOUND_SECRET="$(openssl rand -hex 24)" INBOUND_DOMAIN="mail.yourdomain.com" ALLOWED_ORIGIN="https://molu221.github.io"
# optional: keep subject lines out of the database entirely
# supabase secrets set STORE_SUBJECT=false
```
Keep the `INBOUND_SECRET` value; step 5 needs it.

### 5. Inbound email (only for forwarding)
Any service that POSTs inbound mail as JSON works. The function reads Postmark's format directly (any service that sends `From`, `To`, `Subject`, `TextBody`, `Date` and `MessageID` fields can be pointed at it; others need a small adapter).

With Postmark:
1. Create a server, open its **Inbound** stream.
2. Set the inbound webhook to
   `https://<project-ref>.supabase.co/functions/v1/inbound-email?key=<INBOUND_SECRET>`
3. At your DNS provider, add an **MX record** for `mail.yourdomain.com` pointing to `inbound.postmarkapp.com` (priority 10).
4. Put `mail.yourdomain.com` in `inboundDomain` in `docs/config.js`.

Check the provider's current free-tier and inbound limits before relying on it.

### 6. Try it
Sign in, search with a CV, press **I applied** on a posting, open **My applications**, and paste a confirmation email into the box. Then follow the Gmail or Outlook steps on that tab to forward real ones.

## How an email becomes a status

```
employer email -> user's Gmail/Outlook filter -> <token>@mail.yourdomain.com -> inbound provider
   -> inbound-email function: check secret, find the user from the token (unknown tokens are ignored)
   -> classify: confirmation / interview / rejection / offer / Gmail-forwarding code / ignore   (English + French)
   -> match to one of the user's applications (company in sender domain, name, subject, body; title words; recency)
        clear winner  -> store event, update status
        no clear winner -> store event as "needs review"; the user picks from the likely candidates
   -> the body is discarded
```
Rules worth knowing:
- An email only changes a status if it is **newer than the last status change**, so an old forwarded email can never undo something the user set by hand.
- A confirmation never changes the status (it only records that the employer received the application).
- Boilerplate such as "if selected, we will schedule an interview" or "we cannot reply to everyone, unfortunately" is stripped before classifying, so confirmations are not mistaken for interviews or rejections.
- Gmail asks the receiving address to confirm forwarding; that email is recognised and the code is shown on the tracker tab.
- Ghosted is **derived**, never stored: still "applied" after the user's chosen number of days.

## Privacy

Stored per user: profile settings, keyword profile with short CV excerpts (opt-out), top 50 matches, applications, one small row per recognised email (kind, sender domain, received time, first 100 characters of the subject, matched application), blocked companies.

Never stored: the CV file, the CV's full text, any email body, any email that is not a job email.

Things to decide or know:
- **Subject lines.** The slide deck says "we store the status, not the email". Keeping a 100-character subject deviates from that, but it is what lets a user recognise an email in the review list. Set `STORE_SUBJECT=false` to remove it (the list then shows only the sender's domain), or update the wording of slide 15.
- **Address secrecy.** Anyone who knows a user's forwarding address could send fake "rejection" emails to it. The address is 96 bits of random hex, shown only to its owner, and can be replaced with **Get a new address**. There is no SPF/DKIM check on inbound mail.
- **Forwarding scope.** The Gmail steps use a filter limited to application-related subjects, so ordinary mail is never forwarded.
- **Law 25 / consent.** The account panel states what is saved, saving can be switched off, and export and deletion are built in. Region, retention, and any consent wording are for the team (and faculty) to confirm; this is not legal advice.
- Update any public privacy wording: the CV *file* is never uploaded, but a signed-in user's keyword profile is stored if they leave saving on.

## Tests

```bash
npm test            # classifier, matcher, email pipeline, webhook handler (no install, offline)
npm run test:ui     # drives the real page in jsdom: npm i --no-save jsdom first
npm run test:sql    # checks the privacy rules on a THROWAWAY local Postgres (see test/run_sql_tests.sh)
```
`test:sql` creates stand-in Supabase roles and a `pmtest` database. Never run it against a real project.

What the tests do **not** cover: a live Supabase project (the page and functions are tested against an in-memory fake, the SQL against real Postgres separately), a live inbound-email provider, and real Gmail or Outlook forwarding. Do a first run end to end after setup.

## Known limits and next steps

- The classifier and matcher are rule-based. When they are unsure the user is asked; they do not guess.
- An email about a job the user applied to **without** pressing "I applied" has no application to match and lands in the review list with nothing to pick. A "create an application from this email" action would close that gap.
- Reading the user's inbox directly (Gmail API or Microsoft Graph with OAuth) is a possible later upgrade. Gmail's read scope needs Google's verification for public use, so forwarding is the better first step.
- No rate limiting on the inbound webhook beyond the secret and the unguessable addresses.
