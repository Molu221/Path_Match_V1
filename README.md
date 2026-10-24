# Path Match (free version)
**Link for the website:** https://molu221.github.io/Path_Match_V1/

Upload a CV, get a ranked, explained list of Montreal internships, co-ops and part-time roles.

- **The site** is one static page in `docs/`. It reads `docs/jobs.json` and scores each posting against the visitor's CV **in their browser**. CVs are never uploaded anywhere.
- **The collector** (`scripts/collect.mjs`) runs on a schedule in GitHub Actions, gathers postings from free sources and saves `docs/jobs.json`. No server is needed.
- It is a heuristic, not an applicant tracking system. Score differences of 5 points or less are ties. Always read the posting before applying.

## Sources

Every source below is free to read. The collector keeps a posting only when its location is in the Montreal area and its title or opening text points to engineering, operations, quality, supply chain, data or a student role. After each run `docs/jobs.json` holds, for every source, how many postings it gave, how many requests failed and the first error, and the **Method** tab of the site shows that report.

| Source | What it gives | Needs |
| --- | --- | --- |
| Job Bank Canada (English and French pages) | Full text of postings found by 15 English and French searches. Some posts only link to a partner site (shown as a snippet card with the partner link). Waits 5 seconds between requests, as its robots.txt asks. | Nothing |
| The Muse | Internship and entry-level roles in Montreal, full text | Nothing (an optional free key `MUSE_API_KEY` raises its limit) |
| Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Breezy, BambooHR, Personio, Teamtailor | Full text from employers that publish an open board | Nothing. Employers are listed in `config/companies.json` |
| Workday | Full text from the career sites of employers on Workday (CAE, RTX, GE Vernova so far) | Nothing. To add an employer, paste its career-page address (for example `https://cae.wd3.myworkdayjobs.com/en-US/career`) into `workday` in `config/companies.json` |
| Career pages | Any employer page that publishes schema.org `JobPosting` data | Nothing. List the page addresses under `pages` |
| Adzuna | Broad Montreal coverage, short snippet per posting | A free key from https://developer.adzuna.com (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`) |
| Jooble | Search service, short snippet | A free key from https://jooble.org/api/about (`JOOBLE_API_KEY`) |
| Careerjet | Search service, short snippet | A free key from https://www.careerjet.com/partners/api (`CAREERJET_API_KEY`) |

**Job Bank and its terms.** Job Bank's robots.txt allows crawling with a 5-second wait, and the collector keeps to that. Its job-seeker terms of use also say scripts, robots and crawlers may not be used to access its services (account-registration section). It is on because it was asked for; to switch it off set `"enabled": false` under `jobbank` in `config/searches.json`.

A source whose key is not saved is skipped and shown as "off" in the report. A source that breaks does not stop the others.

**Not collected, and why.** LinkedIn (its robots.txt and terms forbid automated reading; paste a description into a card instead), Indeed, Glassdoor, Monster and ZipRecruiter (they refuse automated requests with HTTP 403 and their terms do not allow it; not bypassed), Built In Montréal (its terms of use forbid bots, spiders and scrapers even though robots.txt allows the pages), Talent.com (pages are marked noindex and nofollow, no feed), iagora and staffing agencies (employer hidden behind a sign-up or unnamed clients), Concordia CareerLink (student login), Taleo, SuccessFactors, iCIMS and Oracle Recruiting (each employer needs its own set-up), and remote-only boards (not Montreal on-site roles).

**Finding employer boards.** `config/companies.json` is a long starter list. Names that do not exist on a system are skipped silently, and the report counts them as "not found". To look up one employer:

```
npm run find -- "Lion Electric" "Vention" "Moderna"
```

To check a long list, edit `config/candidates.json` and run the **Find boards** workflow from the Actions tab. It tries every name on all ten open systems and writes `reports/boards.json`; add the slugs it finds to `config/companies.json`. Edit the search phrases in `config/searches.json`.

## Put it online

1. Create a **public** GitHub repository and upload this whole folder (keep the `.github` folder).
2. Optional but useful: get a free Adzuna key. In the repository open Settings, Secrets and variables, Actions, and add two secrets: `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`. Job Bank, The Muse and the employer boards need no key. `JOOBLE_API_KEY` and `CAREERJET_API_KEY` switch on two more search services the same way.
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
npm run collect                # collect now (add ADZUNA_APP_ID=... ADZUNA_APP_KEY=... for Adzuna)
```

## Known limits

- Adzuna, Jooble and Careerjet give only a snippet, and some Job Bank posts only link to a partner site, so those rows are labelled "Snippet" and scored from less text. Paste the full description into the card to score it fully.
- Job Bank is slow on purpose (5 seconds between requests), so a full run takes several minutes.
- A collection runs a few times a day, so a posting can close before the next run.
- Scores come from keyword rules. Degree level, security rules and exact dates are only as good as the posting text.
- Scanned (image-only) PDFs have no text. Paste the text instead.
- Only English and French keywords are recognised.
- Check each provider's current free-use terms and limits before relying on it. GitHub may pause scheduled workflows on a repository that has had no activity for a long time, so glance at the Actions tab now and then.

## Files

- `docs/index.html` the site (CV reading, scoring, results)
- `docs/jobs.json` the collected postings (demo data at first)
- `scripts/collect.mjs` the collector, `scripts/find-boards.mjs` the board finder (`config/candidates.json` is its list)
- `config/companies.json`, `config/searches.json` what to collect
- `.github/workflows/refresh.yml` the schedule
- `test/collect.test.mjs` offline tests

## Keyword extractor (Python)

`python/keyword_extractor.py` reads one job post and one CV and lists matched, missing and related skills, plus flags to verify. Run it by hand with `python3 python/keyword_extractor.py posts/<post>.txt cv/sample_cv.txt`.

`scripts/run_reports.py` runs it on every file in `posts/` against a CV in `cv/` and writes `reports/` and `docs/reports.json`. The **Keyword report** workflow does this from the Actions tab, and `docs/reports.html` shows the result on the site. To add a posting, drop a `.txt` file in `posts/` in the same format as the examples.

### Every keyword of the posting, in any field (`python/terms.py`)

The dictionary only names skills it knows. To read **all** the keywords of a posting, whatever the field, `python/terms.py` also cuts the whole text (title and description) into phrases at the filler words (articles, pronouns, job-ad verbs, benefits words, months, numbers, English and French, about 870 words you can read in the file). "Root cause analysis", "génie informatique" or "boiler code" are keywords with no list needed. Skills of the dictionary are taken out first, so nothing is counted twice.

- **Match**: the same words, in the same order, are on the CV (plural and accents do not matter).
- **Close**: not the same, but a single word with the same stem, or a phrase that shares its main word(s) with one CV line. Never counted as a match; half credit in the second figure.
- **Gap**: not on the CV.
- Phrases under company, benefits, equal-opportunity and application headings are **listed but not counted**.
- It is mechanical: a few ordinary words slip through and a few real keywords are cut. A keyword written in the other language is never a match.

`python/keyword_extractor.py` prints it as step 5a and saves it in `results.json`; `docs/matcher.js` does the same in the browser (the filler list travels in `docs/skills.json`) and the tests check that both give the same phrases, counts, statuses and sections.

## OaSIS dictionary (all NOC occupations, English and French)

`scripts/build_oasis_dictionary.py` downloads the official OaSIS **2025** CSV files ([open.canada.ca dataset](https://open.canada.ca/data/en/dataset/10ce43bd-fb58-4969-806b-4bffebc87bec); the same release the [ESDC OaSIS site](https://noc.esdc.gc.ca/OaSIS/) displays, which has web pages only) and builds:

- `python/oasis_data.json`: occupation labels, English and French job titles with their NOC/OaSIS codes, English and French names of skills, abilities, work activities and more, and which occupations each skill appears in.
- `python/oasis_vocab.csv`: every word and phrase in the occupation texts, English and French, with the number of occupations it appears in, so the vocabulary can be reviewed.

`python/keyword_extractor.py` uses it automatically when the file exists:

1. **Aliases.** OaSIS English and French names become extra spellings of a skill. A skill written in either language is a normal match.
2. **Occupations.** If the job post and the CV mention titles from the same occupation, the report shows the code. It is not scored.
3. **Inferred.** Skills that appear in many of the same occupations are listed as related. They are never counted as a match and never added to the CV. The report shows a second figure, coverage including related = (matched + 0.5 × related) ÷ job skills.

### Same dictionary on the website

`scripts/build_site_dictionary.py` exports the skill list (the curated skills with their English and French spellings plus the English and French OaSIS names, the hand-written related pairs with their reasons, the things-to-check patterns and the inferred OaSIS links) to `docs/skills.json`. `docs/matcher.js` reads it in the browser and applies the same rules as `python/keyword_extractor.py`. Your CV never leaves the browser.

On the page, **under each job title** you see the skills written in that posting (its full text when we have it, otherwise only the title): green = the same skill is on your CV, amber = close but not the same word (not counted), red = not on your CV. **Open a card** for the mapping, in the style of the progress presentation: *Found on both*, *In the post, not on your CV*, *Close, not counted* (with Strong or Likely and the reason), *Check yourself, not scored*; a table with the posting words and your CV words for each skill (and Required / Task / Preferred from the headings); the posting and your CV shown highlighted side by side; and two figures, "X of N = P% exact words" and "with close skills at half credit". The 0-100 score is unchanged. `test/test_oasis.py` checks that the website and the Python file give the same answers, on the sample posts, on the three posts and the CV from the presentation (`test/fixtures/deck/`) and on a French posting and CV (`test/fixtures/fr/`). The **Build OaSIS dictionary** and **Keyword report** workflows refresh `docs/skills.json`.

Run it from the **Actions** tab (**Build OaSIS dictionary**, choose release 2025 or 2022), or locally with `python3 scripts/build_oasis_dictionary.py [--version 2022]`. The data is licensed under the Open Government Licence - Canada. The column layout of the official files is detected from the data; if a file does not look as expected, the script stops and prints its headers. Offline tests use small made-up files: `python3 -m unittest test.test_oasis`. Tuning for the inferred links is at the top of `python/oasis.py`.
