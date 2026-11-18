# Email features: the rules (for Clémence, Anmol, Dilex)

*Draft by Loïg, Nov 17, 2026, for team review. The full version, with the consent screen text in English and French and the Gmail /
Outlook details, is the team document "Path Match — Email Consent Rules". The privacy page (`docs/privacy.html`) shows the same rules.*

Path Match reads a mailbox only after the person says yes, and only to find emails about their job applications: confirmations,
tests and assessments, interviews, offers, rejections, and other messages about an application.

1. **Consent first, and only for this.** Its own screen, separate from the CV; the box is not pre-ticked; "Not now" keeps the site working.
2. **Only job emails.** Search only emails that look like applications (hiring-system senders, employers applied to, job words in the subject). Skip and never store the rest.
3. **Read-only.** Never send, delete, move, label or mark as read. Ask for read-only permissions only.
4. **Keep the minimum.** Sender, subject, date, employer, job title, detected status. The body is read only to detect the status, then discarded. Attachments are never read.
5. **Short retention.** 90 days after the last sign-in; everything deleted at the end of the project (April 2027).
6. **Easy to stop.** "Disconnect" revokes access at Google or Microsoft and deletes everything within 24 hours; "Export my data" first.
7. **No sharing, no selling, no ads, no AI training.**
8. **Off by default** (Law 25, privacy by default).
9. **Secure.** Tokens encrypted; never in the repository, logs or screenshots.
10. **One person answers for it:** Loïg Glo. Any incident goes in the incident log the same day (`privacy/incident-log.md`).

The status the sorter gives an email is a suggestion the person can correct ("Is this about an application?" when unsure).

## Permissions

| | Gmail | Outlook |
|---|---|---|
| Start with (headers only) | `gmail.metadata` | `Mail.ReadBasic` |
| Only if detection is too weak | `gmail.readonly` | `Mail.Read` |
| Never | `mail.google.com`, `gmail.modify` | `Mail.ReadWrite` |
| Test rounds | App in "Testing": testers added by hand (up to 100); they reconnect every 7 days | Personal accounts (outlook.com, hotmail.com); Concordia accounts may be blocked |
| Public launch | Google verification + security assessment (weeks, about US$15,000-75,000) | Publisher verification (Microsoft partner account) |

## To decide together

- [ ] Headers only for the first test round? (recommended)
- [ ] Data and tokens in the person's browser only, or on a server? (browser only recommended)
- [ ] Keep a "forward or paste an email" option? (recommended)
- [ ] Ask Prof. Ali about research-ethics approval for testing with real people's CVs and emails.
