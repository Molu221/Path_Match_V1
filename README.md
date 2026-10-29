# Path Match (free version)
**Link for the website:** https://molu221.github.io/Path_Match_V1/

Upload a CV, get a ranked, explained list of jobs, part-time roles, internships and co-ops across Canada, in any field, for the stage of career the CV shows.

- **The site** is one static page in `docs/` with four views (start, your CV and details, your top 10, all jobs). It reads `docs/jobs.json` and scores each posting against the visitor's CV **in their browser**. CVs are never uploaded anywhere.
- **The collector** (`scripts/collect.mjs`) runs on a schedule in GitHub Actions, gathers postings from free sources and saves `docs/jobs.json`. No server is needed.
- **The stage comes first.** The page reads the CV's dates and titles and places the person on a five-stop trail: student or new graduate, early career (1–3 years), mid-level (3–7), senior (7+), director or executive. Each posting gets a level in the same five steps, and the list favours the person's own stage, so a new graduate does not see a director first. The person can tap another stop on the trail at any time.
- It is a heuristic, not an applicant tracking system. Score differences of 5 points or less are ties. Always read the posting before applying.

## The pages (`docs/index.html`)

The site has four main pages and five extra ones (below), chosen with the address (`#p=details`, `#p=market` and so on) so the back button works. A step bar at the top shows where the visitor is, and every page has its own accent colour (the line under the top bar and the stripe by its title).

1. **Start.** A short pitch, the five-stop trail as a picture, and two buttons: upload a CV, or browse every posting.
2. **Your CV and your details.** The visitor drops a PDF or Word file (or pastes text, or tries an example CV). The CV is read in the browser; with a CV, the pin sits on the stage the CV reads as and "How we read your CV" says why, and a tap on another stop changes it. The visitor also says where they want to work (all of Canada, the Montréal area or one province, with or without remote roles), the kind of work (full-time, part-time, internships and co-ops), the field, how recent the postings must be (default the last 60 days, because an old posting is often filled), the languages they work in, their work permit and the term they want. A live line says how many postings fit those choices. The details are kept in the browser; the CV text is kept for the open tab only.
3. **Your top 10.** Every posting is scored against the CV, those that fit the details are kept, and the 10 best are shown with their score, the matched and missing keywords and the flags (language, permit, term, security). At most 2 per employer, and only postings with their full text by default (a title alone is too little to score; a tick box lifts this). "Show the next 10" goes to rank 50, "Copy my top 10" copies the list, and a panel lists the keywords the best postings ask for that are not on the CV. Postings whose term has passed are left out.
4. **All jobs.** Everything the collector found, as before: tabs **Full-time jobs**, **Part-time**, **Internships & co-ops**, **Your CV** (what was read from the CV) and **Method & coverage**, with the filters below.

- **Level** (default "Fits my level": postings far above or far below the stage are hidden, with a one-tap "show them"; or pick one level) and **field** (software and IT, healthcare, finance, trades, retail, education and so on, each with its count). Every card shows its level, how it relates to the person ("fits", "one step above", "below") and its field.
- Search (title, company, city; tick the box to search inside the descriptions; press `/` to jump to it), location (all of Canada, the Montréal area, or one province, each with its count), source, sort (best match, newest, company, title), minimum score, and the posted window (24 h, 7 days, all, each with its count).
- Results load 25 at a time and more load as you scroll. Star a posting to keep it; **Saved** shows only those (kept in your browser).
- The address bar holds the tab and filters, so a view can be bookmarked or shared, and the back button works.
- The page asks the server for a new `jobs.json` every 5 minutes (a 304 when nothing changed) and marks postings that appeared since you opened it.
- **Copy list** copies every posting that matches the filters, not only the ones on screen.

### The extra pages (`docs/pages.js`, `docs/pages.css`)

Reached from the **Explore** menu in the top bar, from the tiles on the start page, or from the jump bar (**Ctrl K**, or **⌘K**: type a page name, or words from a title or company). All of them are worked out in the browser from the postings already loaded; nothing is added to the data, and the site still works if `pages.js` fails to load.

- **Market map** (`#p=market`). A tile map of the provinces (plus the Montréal area, remote roles and "Canada, no province"), shaded in five steps by the number of postings; a field-by-stage grid with the visitor's stage marked; the postings published in each of the last 30 days; the employers with the most postings; and the skills asked for most (role and tool skills, or general strengths). A switch narrows everything to full-time, part-time or internships. A province, a grid cell or an employer opens the matching postings on the All jobs page.
- **Skill lab** (`#p=lab`, needs a CV). Take the 200 best-fitting postings, switch on a skill the CV lacks, and see the top 10 re-ranked with the new scores (same scoring rules, the skill counted as present). It suggests the three role or tool skills that lift the list most. General strengths such as "Communication" are listed apart, because the score counts only what is written on the CV. It is a what-if: nothing is written to the CV.
- **Career ladder** (`#p=ladder`). For a field (or all fields), the five rungs from student to executive with their posting counts, the titles that come up most on a rung, its most-asked skills, the skills that are far more common than one rung down, and what the next rung adds. A ✓ marks a skill on the CV.
- **Quick sort** (`#p=swipe`). One posting per card: drag it right to save or left to skip (or use the buttons, or the arrow keys; `Z` undoes, the up arrow opens the posting). With a CV the cards come in ranked order and show what matched and what is missing; without one they are the newest postings that fit the details. Skipped cards stay hidden until brought back.
- **Application board** (`#p=board`). Saved, Applied, Interview, Offer and Closed columns (drag a card, or use the arrows), a weekly goal with a progress ring and a streak, a form to add an application found elsewhere, a CSV download, and a table of interviews by the match score at the time of applying, so the visitor can see in their own data whether higher scores led to more interviews (it says plainly that a small sample proves nothing). Everything is kept in this browser only. Starring a posting anywhere puts it in Saved.

Colour: the base stays spruce, lake teal and blaze orange; each page adds one hue (sun, sky, violet, mint, coral, berry, peach) and a field gets one of eight hues. The map and grid use one five-step violet ramp whose text colour is set per step; `npm test` checks the wiring and a browser pass checked the text contrast of every new page in the light and dark themes.

## Sources

Every source below is free to read. The collector keeps a posting when its location is in Canada (any province or territory, English or French name, a code such as QC or ON, or "Remote – Canada"; jobs elsewhere are dropped), whatever the field. Each kept posting is saved with its `province` (`QC`, `ON`, `BC`... or `Remote – Canada` / `Canada` when the text names no province), and `docs/jobs.json` holds the count per province.

Every posting that is found is kept; nothing is dropped to save space. To keep the page fast, the data is in two kinds of file. `docs/jobs.json` holds one short record per posting (title, employer, place, date, links, and what the collector worked out from the full text: its 40 main keywords `kw` and their number `kt`, its level `lv`, its language `lg`, wording to check yourself `df`, the length of the text `dl`). The text of each posting is in `docs/d/00.json` to `63.json`, chosen by the posting's `id`, and the page reads one of these files only when a card is opened (or all of them, once, when "search inside the descriptions too" is ticked). A posting keeps its place and its record from one day to the next, so the daily commit only changes what came and went. Only if more than 60,000 postings were found would `selectJobs` choose a balanced selection (internships, co-ops and part-time roles first, then every field in turn, at most 1,500 postings per employer). After each run `docs/jobs.json` holds, for every source, how many postings it gave, how many requests failed and the first error, and the **Method** tab of the site shows that report.

| Source | What it gives | Needs |
| --- | --- | --- |
| Job Bank Canada (English and French pages) | The feed returns at most 100 postings per search and has no second page, so the collector runs 187 different searches (`config/searches.json`): 84 keywords across Canada (cook, driver, nurse, electrician, accountant, stagiaire...), one search per province, and 10 busy keywords in each of 9 big cities. Every posting found is kept with its title, employer, place and date; the 50 newest are opened for the full text (some posts only link to a partner site). It waits 5 seconds between requests, as its robots.txt asks, and stops its searches after 18 minutes. | Nothing |
| The Muse | Internship, entry-level, mid-level and senior roles in Montreal, Toronto, Vancouver, Calgary, Ottawa and Edmonton, full text | Nothing (an optional free key `MUSE_API_KEY` raises its limit) |
| Workable job search | **Every open posting in Canada** of every company that hires through Workable (jobs.workable.com, a public list with the full text of each posting). About 20 postings per request, read with a short pause; roughly 7,700 postings. | Nothing. Switch it off or limit it in `workable` of `config/searches.json` |
| Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Breezy, BambooHR, Personio, Teamtailor | Full text from employers that publish an open board | Nothing. Employers are listed in `config/companies.json` |
| Workday | **Every posting in Canada** of each employer on Workday (the career site's own Canada filter is read from its answer): RBC, TD, BMO, CIBC, Sun Life, Manulife, iA, Loblaw group, Canadian Tire, Best Buy, Aritzia, Walmart, Suncor, Cenovus, Enbridge, TC Energy, McGill, Desjardins, Intact, Aviva, Magna, Accenture, JLL and about 70 more. The newest 100 of each employer are opened for the full text; the rest are kept with title, place and date. | Nothing. To add an employer, paste its career-page address (for example `https://cae.wd3.myworkdayjobs.com/en-US/career`) into `workday` in `config/companies.json`. The "Find Workday sites" workflow tries a list of employer names (`config/workday_candidates.json`) against the usual addresses and writes `reports/workday.json` |
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
- Job Bank is slow on purpose (5 seconds between requests), so its part of a run takes about 15 minutes. A whole run takes 30 to 60 minutes the first time (the workflow allows 150) and less afterwards, because postings that did not change are not analysed again.
- The stage of a person and the level of a posting are read from words and dates, so they can be wrong (a title such as "Director" at a small firm, a CV with no dates). That is why the stage can be changed by hand, the level filter can be switched to "All levels", and every card says how its level was read.
- `docs/jobs.json` is about 1.2 KB per posting (18 MB, about 5 MB over the wire once compressed, for 15,600 postings); the texts (60 MB in `docs/d`) are read only when a card is opened.
- A collection runs a few times a day, so a posting can close before the next run.
- Scores come from keyword rules. Degree level, security rules and exact dates are only as good as the posting text.
- Scanned (image-only) PDFs have no text. Paste the text instead.
- Only English and French keywords are recognised.
- Check each provider's current free-use terms and limits before relying on it. GitHub may pause scheduled workflows on a repository that has had no activity for a long time, so glance at the Actions tab now and then.

## Files

- `docs/index.html` the site (stage trail, filters, results); `docs/pages.js` and `docs/pages.css` the five extra pages, the Explore menu, the jump bar and the colours; `docs/jobmeta.js` the level of a posting, the stage of a CV, the fit table and the fields; `docs/scoring.js` the 0–100 score; `docs/matcher.js` the keyword engine
- `docs/jobs.json` the collected postings, one short record each; `docs/d/` their full texts in 64 files
- `scripts/collect.mjs` the collector, `scripts/find-boards.mjs` the board finder (`config/candidates.json` is its list)
- `config/companies.json`, `config/searches.json` what to collect
- `.github/workflows/refresh.yml` the schedule
- `test/collect.test.mjs`, `test/jobmeta.test.mjs`, `test/scoring.test.mjs`, `test/pages.test.mjs` offline tests (`npm test`)

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

## NOC library (occupations, English and French)

`docs/noc/` holds a bilingual library of all 516 NOC 2021 occupations (900 OaSIS 2025 profiles): duties,
skills, education, certifications, similar occupations, a job title → occupation index (including titles used
in real Job Bank postings) and English ↔ French pairs. `docs/noc/noc_library.js` (browser and Node) and
`noc_library/noc_library.py` (Python) find the occupations a CV fits and compare a CV with any occupation on 5
parts (duties, skills, education, certifications, languages), labelling each item **Matched**, **Missing** or
**Guess**. It is meant for jobs that only have a title, such as most Job Bank jobs. Details:
[noc_library/README.md](noc_library/README.md). Contains information licensed under the Open Government
Licence – Canada.

