# Path Match (free version)
**Link for the website:** https://molu221.github.io/Path_Match_V1/
Upload a CV, get a ranked, explained list of Montreal internships, co-ops and part-time roles.

- **The site** is one static page in `docs/`. It reads `docs/jobs.json` and scores each posting against the visitor's CV **in their browser**. CVs are never uploaded anywhere.
- **The collector** (`scripts/collect.mjs`) runs on a schedule in GitHub Actions, gathers postings from free sources and saves `docs/jobs.json`. No server is needed.
- It is a heuristic, not an applicant tracking system. Score differences of 5 points or less are ties. Always read the posting before applying.

## Sources

| Source | What it gives | Needs |
| --- | --- | --- |
| Adzuna | Broad Montreal coverage in English and French, short snippet per posting | A free key from https://developer.adzuna.com |
| Greenhouse, Lever, Ashby, SmartRecruiters | Full posting text from employers that publish an open board | Nothing. Employers are listed in `config/companies.json` |

LinkedIn and Indeed are not used. Employers on Workday, Taleo or SuccessFactors have no open feed and appear only if Adzuna lists them.

`config/companies.json` is a long starter list. Names that do not exist on a system are skipped silently, and the page shows how many boards answered. Find the right entry for any employer with:

```
npm run find -- "Lion Electric" "Vention" "Moderna"
```

Then add the slug it prints to `config/companies.json`. Edit the search phrases in `config/searches.json`.

## Put it online

1. Create a **public** GitHub repository and upload this whole folder (keep the `.github` folder).
2. Get a free Adzuna key. In the repository open Settings, Secrets and variables, Actions, and add two secrets: `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
3. Open Settings, Pages. Set Source to "Deploy from a branch", branch `main`, folder `/docs`. Save.
4. Open the Actions tab, choose "Refresh postings" and press "Run workflow". After a minute or two `docs/jobs.json` is replaced with real postings.
5. Your site is at `https://<your-username>.github.io/<repository-name>/`.

The workflow then re-runs once a day (change the `cron` line in `.github/workflows/refresh.yml`). Cloudflare Pages or Netlify also work: point them at the `docs` folder.

The site works before step 4 using demo postings, and shows "Demo data" until the first real collection.

## Try it on your computer

Needs Node 20 or newer. No install step.

```
npm test                       # offline tests
npm run serve                  # preview docs/ at http://localhost:8080
ADZUNA_APP_ID=... ADZUNA_APP_KEY=... npm run collect   # collect now
```

## Known limits

- Adzuna posts only a snippet, so those rows are labelled "Snippet" and scored from less text than employer-board rows.
- A collection runs a few times a day, so a posting can close before the next run.
- Scores come from keyword rules. Degree level, security rules and exact dates are only as good as the posting text.
- Scanned (image-only) PDFs have no text. Paste the text instead.
- Only English and French keywords are recognised.
- Check each provider's current free-use terms and limits before relying on it. GitHub may pause scheduled workflows on a repository that has had no activity for a long time, so glance at the Actions tab now and then.

## Files

- `docs/index.html` the site (CV reading, scoring, results)
- `docs/jobs.json` the collected postings (demo data at first)
- `scripts/collect.mjs` the collector, `scripts/find-boards.mjs` the board finder
- `config/companies.json`, `config/searches.json` what to collect
- `.github/workflows/refresh.yml` the schedule
- `test/collect.test.mjs` offline tests
