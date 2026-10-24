# Path Match (free version)
**Link for the website:** https://molu221.github.io/Path_Match_V1/

Upload a CV, get a ranked, explained list of Montreal internships, co-ops and part-time roles.

- **The site** is one static page in `docs/`. It reads `docs/jobs.json` and scores each posting against the visitor's CV **in their browser**. The CV file is never uploaded anywhere.
- **Private accounts (optional).** Sign in to save your CV profile and matches, mark jobs as applied, and track each application from its confirmation, interview and rejection emails. Off until you add Supabase keys; see [ACCOUNTS.md](ACCOUNTS.md).
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
- `docs/config.js`, `docs/account.js`, `docs/account.css` optional accounts and application tracker (see [ACCOUNTS.md](ACCOUNTS.md))
- `supabase/` database migration and the email-tracking functions (`inbound-email`, `paste-email`, `delete-account`)

## Keyword extractor (Python)

`python/keyword_extractor.py` reads one job post and one CV and lists matched, missing and related skills, plus flags to verify. Run it by hand with `python3 python/keyword_extractor.py posts/<post>.txt cv/sample_cv.txt`.

`scripts/run_reports.py` runs it on every file in `posts/` against a CV in `cv/` and writes `reports/` and `docs/reports.json`. The **Keyword report** workflow does this from the Actions tab, and `docs/reports.html` shows the result on the site. To add a posting, drop a `.txt` file in `posts/` in the same format as the examples.

## OaSIS dictionary (all NOC occupations, English and French)

`scripts/build_oasis_dictionary.py` downloads the official OaSIS **2025** CSV files ([open.canada.ca dataset](https://open.canada.ca/data/en/dataset/10ce43bd-fb58-4969-806b-4bffebc87bec); the same release the [ESDC OaSIS site](https://noc.esdc.gc.ca/OaSIS/) displays, which has web pages only) and builds:

- `python/oasis_data.json`: occupation labels, English and French job titles with their NOC/OaSIS codes, English and French names of skills, abilities, work activities and more, and which occupations each skill appears in.
- `python/oasis_vocab.csv`: every word and phrase in the occupation texts, English and French, with the number of occupations it appears in, so the vocabulary can be reviewed.

`python/keyword_extractor.py` uses it automatically when the file exists:

1. **Aliases.** OaSIS English and French names become extra spellings of a skill. A skill written in either language is a normal match.
2. **Occupations.** If the job post and the CV mention titles from the same occupation, the report shows the code. It is not scored.
3. **Inferred.** Skills that appear in many of the same occupations are listed as related. They are never counted as a match and never added to the CV. The report shows a second figure, coverage including related = (matched + 0.5 × related) ÷ job skills.

Run it from the **Actions** tab (**Build OaSIS dictionary**, choose release 2025 or 2022), or locally with `python3 scripts/build_oasis_dictionary.py [--version 2022]`. The data is licensed under the Open Government Licence - Canada. The column layout of the official files is detected from the data; if a file does not look as expected, the script stops and prints its headers. Offline tests use small made-up files: `python3 -m unittest test.test_oasis`. Tuning for the inferred links is at the top of `python/oasis.py`.
