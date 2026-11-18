# Privacy impact assessment: Path Match

*Quebec Law 25 asks for this assessment before building a system that handles personal information. Prepared Nov 17, 2026 by Loïg Glo
(person in charge of personal information for the project), to be reviewed by the team (Anmol, Clémence, Dilex) and Prof. Ali Akgunduz.
Review again before the email features are built, and before each test round.*

## 1. The project

Path Match (https://molu221.github.io/Path_Match_V1/) ranks Canadian job postings against a person's CV and explains each score.
It is a Concordia University student project (INDU 6993), non-commercial, running until April 2027. It has no server of its own:
the site is static files on GitHub Pages, and a daily GitHub Actions job collects public job postings.

## 2. Personal information, today and planned

| Information | Whose | Where it goes | Kept | Status |
|---|---|---|---|---|
| CV text (name, contact, education, work history, skills) | The user | Read in the user's browser; kept in that tab's session storage | Until the tab closes or "Start over" | Live |
| Preferences, saved / hidden / pasted postings, profile extras (certifications, licences, languages) | The user | The user's own browser (local storage) | Until the user deletes it (privacy page button) | Live |
| IP address and browser type | The user | GitHub Pages, Google Fonts, cdnjs, jsDelivr (when the page loads) | By those providers' own policies | Live |
| Job postings (employer, title, place, text) | Employers (public ads) | Public files in the repository | Refreshed daily | Live, not personal information about users |
| Job-application emails: sender, subject, date, employer, title, status | The user (and the sender) | To be decided: user's browser or a server | 90 days after last visit; all deleted April 2027 | **Planned (features 6-7)** |
| Gmail / Outlook access tokens | The user | To be decided | Until "Disconnect" | **Planned** |
| Test-round feedback (does this top 10 fit me?) | Testers | To be decided | Until April 2027 | **Planned (Jan-Feb 2027)** |

Not collected: no account, no password, no payment, no analytics, no cookies set by us. No CV text is sent to any AI service; the weekly
skills agent sends only public posting vocabulary to Gemini.

## 3. Purpose and necessity

Each item above is used only to rank postings for the same person and show why. The email data would only track that person's own
applications. Nothing is used for advertising, sold, shared, or used to train a model. Collection is limited to what the feature needs:
for emails, headers first (sender, subject, date), the body only if detection is too weak, and never attachments.

## 4. Risks

| Risk | Likelihood | Impact | Safeguard | Left after safeguard |
|---|---|---|---|---|
| Someone else on a shared computer sees a CV or saved jobs | Medium | Medium | CV only in the tab; privacy page "Delete my Path Match data" button; note on shared computers | Low |
| A code change starts sending CV text somewhere | Low | High | Every change goes through a reviewed pull request; tests; the rule "CV never uploaded" is stated on the site | Low |
| A third-party script (cdnjs, jsDelivr) is compromised | Low | High | Pinned versions; only well-known CDNs; consider Subresource Integrity hashes | Low-medium |
| Mailbox access reads more than job emails | Medium | High | Read-only scopes; job-email filter; headers-only first; never keep bodies or attachments | Low |
| Tokens or email data leak (repository, logs, screenshots) | Low | High | Never in the public repository or logs; encrypted; incident log; disconnect deletes all | Low |
| Google or Microsoft refuse or revoke access | Medium | Low (feature only) | Test mode with named testers; forward-or-paste fallback | Low |
| Data kept after the project ends | Medium | Medium | Deletion date (April 2027) in the consent text and in the team's end-of-project checklist | Low |
| Personal information leaves Quebec (US-hosted services) | High (GitHub, Google, Microsoft are outside Quebec) | Low today (no personal data stored by us) / Medium for email data | Say so in the consent text; prefer browser-only storage for email data; Law 25 requires assessing this before sending personal information outside Quebec | To decide with the storage choice |

## 5. Decisions needed before the email features

1. Headers only (`gmail.metadata`, `Mail.ReadBasic`) for the first test round, or body access from the start? *Recommended: headers only.*
2. Where kept items and tokens live: the user's browser only, or a server? *Recommended: browser only, so nothing leaves the user's device.*
3. Keep a "forward or paste an email" option for people who do not want to connect a mailbox? *Recommended: yes.*
4. Does testing with real people's CVs and emails need Concordia research-ethics approval? *Ask Prof. Ali.*

## 6. Conclusion

Today the site keeps personal information only on the user's own device, and the residual risk is low. The email features raise the
risk; they may go ahead once the decisions in section 5 are taken, with the rules in `privacy/email-rules.md`, the incident log in
`privacy/incident-log.md`, and this assessment reviewed again.
