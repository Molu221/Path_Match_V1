# Path Match (free version)
**Link for the website:** https://molu221.github.io/Path_Match_V1/

Upload a CV, get a ranked, explained list of jobs, part-time roles, internships and co-ops across Canada, in any field, for the stage of career the CV shows.

- **The site** is one static page in `docs/`. It reads `docs/jobs.json` and scores each posting against the visitor's CV **in their browser**. CVs are never uploaded anywhere.
- **The collector** (`scripts/collect.mjs`) runs on a schedule in GitHub Actions, gathers postings from free sources and saves `docs/jobs.json`. No server is needed.
- **The stage comes first.** The page reads the CV's dates and titles and places the person on a five-stop trail: student or new graduate, early career (1–3 years), mid-level (3–7), senior (7+), director or executive. Each posting gets a level in the same five steps, and the list favours the person's own stage, so a new graduate does not see a director first. The person can tap another stop on the trail at any time.
- It is a heuristic, not an applicant tracking system. Score differences of 5 points or less are ties. Always read the posting before applying.

## The dashboard (`docs/index.html`)

The top of the page is a trail with five stops (the stage). With a CV, the pin sits on the stage the CV reads as, and "How we read your CV" says why; without one, the visitor taps a stop. Tabs: **Full-time jobs**, **Part-time**, **Internships & co-ops** (each with a live count), then **Your CV** and the method. Postings can be browsed before a CV is added; adding one scores and ranks them.

- **Level** (default "Fits my level": postings far above or far below the stage are hidden, with a one-tap "show them"; or pick one level) and **field** (software and IT, healthcare, finance, trades, retail, education and so on, each with its count). Every card shows its level, how it relates to the person ("fits", "one step above", "below") and its field.
- Search (title, company, city; tick the box to search inside the descriptions; press `/` to jump to it), location (all of Canada, the Montréal area, or one province, each with its count), source, sort (best match, newest, company, title), minimum score, and the posted window (24 h, 7 days, all, each with its count).
- Results load 25 at a time and more load as you scroll. Star a posting to keep it; **Saved** shows only those (kept in your browser).
- The address bar holds the tab and filters, so a view can be bookmarked or shared, and the back button works.
- The page asks the server for a new `jobs.json` every 5 minutes (a 304 when nothing changed) and marks postings that appeared since you opened it.
- **Copy list** copies every posting that matches the filters, not only the ones on screen.

## Sources

Every source below is free to read. The collector keeps a posting when its location is in Canada (any province or territory, English or French name, a code such as QC or ON, or "Remote – Canada"; jobs elsewhere are dropped), whatever the field. Each kept posting is saved with its `province` (`QC`, `ON`, `BC`... or `Remote – Canada` / `Canada` when the text names no province), and `docs/jobs.json` holds the count per province.

Every posting that is found is kept; nothing is dropped to save space. To keep the page fast, the data is in two kinds of file. `docs/jobs.json` holds one short record per posting (title, employer, place, date, links, and what the collector worked out from the full text: its 40 main keywords `kw` and their number `kt`, its level `lv`, its language `lg`, wording to check yourself `df`, the length of the text `dl`). The text of each posting is in `docs/d/00.json` to `63.json`, chosen by the posting's `id`, and the page reads one of these files only when a card is opened (or all of them, once, when "search inside the descriptions too" is ticked). A posting keeps its place and its record from one day to the next, so the daily commit only changes what came and went. Only if more than 60,000 postings were found would `selectJobs` choose a balanced selection (internships, co-ops and part-time roles first, then every field in turn, at most 1,500 postings per employer). After each run `docs/jobs.json` holds, for every source, how many postings it gave, how many requests failed and the first error, and the **Method** tab of the site shows that report.

| Source | What it gives | Needs |
| --- | --- | --- |
| Job Bank Canada (English and French pages) | The feed returns at most 100 postings per search and has no second page, so the collector runs 187 different searches (`config/searches.json`): 84 keywords across Canada (cook, driver, nurse, electrician, accountant, stagiaire...), one search per province, and 10 busy keywords in each of 9 big cities. Every posting found is kept with its title, employer, place and date; the 50 newest are opened for the full text (some posts only link to a partner site). It waits 5 seconds between requests, as its robots.txt asks, and stops its searches after 18 minutes. | Nothing |
| The Muse | Internship, entry-level, mid-level and senior roles in Montreal, Toronto, Vancouver, Calgary, Ottawa and Edmonton, full text | Nothing (an optional free key `MUSE_API_KEY` raises its limit) |
| Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Breezy, BambooHR, Personio, Teamtailor | Full text from employers that publish an open board | Nothing. Employers are listed in `config/companies.json` |
| Workday | **Every posting in Canada** of each employer on Workday (the career site's own Canada filter is read from its answer): RBC, TD, BMO, CIBC, Sun Life, Manulife, iA, Loblaw group, Canadian Tire, Best Buy, Aritzia, Walmart, Suncor, Cenovus, Enbridge, TC Energy, McGill and more. The newest 100 of each employer are opened for the full text; the rest are kept with title, place and date. | Nothing. To add an employer, paste its career-page address (for example `https://cae.wd3.myworkdayjobs.com/en-US/career`) into `workday` in `config/companies.json`. The "Find Workday sites" workflow tries a list of employer names (`config/workday_candidates.json`) against the usual addresses and writes `reports/workday.json` |
| Career pages | Any employer page that publishes schema.org `JobPosting` data | Nothing. List the page addresses under `pages` |
| Adzuna | Broad coverage, short snippet per posting | A free key from https://developer.adzuna.com (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`) |
| Jooble | Search service, short snippet | A free key from https://jooble.org/api/about (`JOOBLE_API_KEY`) |
| Careerjet | Search service, short snippet | A free key from https://www.careerjet.com/partners/api (`CAREERJET_API_KEY`) |

**Job Bank and its terms.** Job Bank's robots.txt allows crawling with a 5-second wait, and the collector keeps to that. Its job-seeker terms of use also say scripts, robots and crawlers may not be used to access its services (account-registration section). It is on because it was asked for; to switch it off set `"enabled": false` under `jobbank` in `config/searches.json`.

A source whose key is not saved is skipped and shown as "off" in the report. A source that breaks does not stop the others.

**Not collected, and why.** LinkedIn (its robots.txt and terms forbid automated reading; paste a description into a card instead), Indeed, Glassdoor, Monster and ZipRecruiter (they refuse automated requests with HTTP 403 and their terms do not allow it; not bypassed), Built In Montréal (its terms of use forbid bots, spiders and scrapers even though robots.txt allows the pages), Talent.com (pages are marked noindex and nofollow, no feed), iagora and staffing agencies (employer hidden behind a sign-up or unnamed clients), school career boards such as CareerLink (student login), Taleo, SuccessFactors, iCIMS and Oracle Recruiting (each employer needs its own set-up), and remote-only boards (not tied to a Canadian city).

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

The site shows whatever `docs/jobs.json` holds, so it is never empty once a collection has been committed.

## Try it on your computer

Needs Node 20 or newer. No install step.

```
npm test                       # offline tests
npm run serve                  # preview docs/ at http://localhost:8080
npm run collect                # collect now (add ADZUNA_APP_ID=... ADZUNA_APP_KEY=... for Adzuna)
```

## Known limits

- Adzuna, Jooble and Careerjet give only a snippet, and some Job Bank posts only link to a partner site, so those rows are labelled "Snippet" and scored from less text. Paste the full description into the card to score it fully.
- Job Bank is slow on purpose (5 seconds between requests), so its part of a run takes about 15 minutes (the workflow allows 60).
- The stage of a person and the level of a posting are read from words and dates, so they can be wrong (a title such as "Director" at a small firm, a CV with no dates). That is why the stage can be changed by hand, the level filter can be switched to "All levels", and every card says how its level was read.
- `docs/jobs.json` is about 1 KB per posting (about 4 MB over the wire for 13,000 postings once compressed); the texts are read only when needed.
- A collection runs a few times a day, so a posting can close before the next run.
- Scores come from keyword rules. Degree level, security rules and exact dates are only as good as the posting text.
- Scanned (image-only) PDFs have no text. Paste the text instead.
- Only English and French keywords are recognised.
- Check each provider's current free-use terms and limits before relying on it. GitHub may pause scheduled workflows on a repository that has had no activity for a long time, so glance at the Actions tab now and then.

## Files

- `docs/index.html` the site (stage trail, filters, results); `docs/jobmeta.js` the level of a posting, the stage of a CV, the fit table and the fields; `docs/scoring.js` the 0–100 score; `docs/matcher.js` the keyword engine
- `docs/jobs.json` the collected postings, one short record each; `docs/d/` their full texts in 64 files
- `scripts/collect.mjs` the collector, `scripts/find-boards.mjs` the board finder (`config/candidates.json` is its list)
- `config/companies.json`, `config/searches.json` what to collect
- `.github/workflows/refresh.yml` the schedule
- `test/collect.test.mjs`, `test/jobmeta.test.mjs`, `test/scoring.test.mjs` offline tests (`npm test`)

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

### Soft skills and job skills in French and English (`python/skills_extra.py`)

Besides the first list in `keyword_extractor.py`, `python/skills_extra.py` holds about 135 more skills across every field (soft skills such as *rigueur*, *autonomie*, *esprit d'équipe*, *travailler sous pression*; business, health, trades, IT, legal, education...) with their English **and** French spellings, written without accents. A French spelling points to the same English name a CV uses, so *travail d'équipe* in a French posting is a **Match** with "Teamwork" on an English CV. It also holds:

- `CLOSE_PAIRS`: skills that are near, never equal (shown as Close, never counted as Match).
- `PRUNE`: spellings removed after tracing every alias over the real postings, because they fired on something else (retirement plan and insurance perks, *entretien* = job interview, *achat de congés*...).
- `NO_PLURAL`: "initiative" is a skill, "initiatives" is what a company runs.

Rules for a new spelling: lowercase, no accents, singular, no short common word, no company-advertising word, and never the same spelling under two skills (it would be counted twice). `scripts/build_site_dictionary.py` copies everything to `docs/skills.json`, so the website uses the same list; the tests compare both engines on English and French postings.

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
