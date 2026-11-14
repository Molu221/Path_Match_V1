# Path Match (free version)
**Link for the website:** https://molu221.github.io/Path_Match_V1/

**New: Wayfinder.** Say the job you want in one sentence, in English or French, and the list filters itself. Try it on the start page.

**New: Paste a posting.** The site cannot read LinkedIn or Indeed, so paste any posting you find there (or anywhere else) on the ninth page, `#p=paste`: your CV on the left, the posting on the right, scored like your Top 10.

Upload a CV, get a ranked, explained list of jobs, part-time roles, internships and co-ops across Canada, in any field, for the stage of career the CV shows.

- **The site** is one static page in `docs/` with four views (start, your CV and details, your top 10, all jobs). It reads `docs/jobs.json` and scores each posting against the visitor's CV **in their browser**. CVs are never uploaded anywhere.
- **The collector** (`scripts/collect.mjs`) runs on a schedule in GitHub Actions, gathers postings from free sources and saves `docs/jobs.json`. No server is needed.
- **The stage comes first.** The page reads the CV's dates and titles and places the person on a five-stop trail: student or new graduate, early career (1–3 years), mid-level (3–7), senior (7+), director or executive. Each posting gets a level in the same five steps, and the list favours the person's own stage, so a new graduate does not see a director first. The person can tap another stop on the trail at any time.
- It is a heuristic, not an applicant tracking system. Score differences of 5 points or less are ties. Always read the posting before applying.

## The pages (`docs/index.html`)

The site has four main pages and five extra ones (below), chosen with the address (`#p=details`, `#p=market` and so on) so the back button works. A step bar at the top shows where the visitor is, and every page has its own accent colour (the line under the top bar and the stripe by its title).

1. **Start.** A short pitch, the five-stop trail as a picture, and two buttons: upload a CV, or browse every posting. The cover is light and bright (near-white, navy text, one orange accent; the dark theme keeps its spruce look). Its numbers (postings, fields, provinces and territories, postings for students and new graduates: the line under the search box and the count on the Browse button) are counted once a day by the GitHub job into `docs/stats.json` (`scripts/cover-stats.mjs`), so they show before the postings have loaded; the page uses that file only when its time matches the postings loaded, and counts them itself otherwise. CVs are not part of it and stay in the browser.
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

- **Market map** (`#p=market`). The places on three views you switch between, **Tiles** (the default), **Canada** and **World**. Tiles is the original tile map of the provinces (plus the Montréal area, remote roles and "Canada, no province"). Canada draws the real provinces and territories with a circle for each of ten city areas (Toronto, Vancouver, Ottawa–Gatineau, Calgary, Québec City, Edmonton, Winnipeg, Halifax, Saskatoon, Regina) beside Montréal, and a row of city buttons for keyboard and phone use. World shows every country; only Canada has postings (Path Match collects for Canada), so only Canada is shaded, and a click on it opens the Canada map. All three are shaded in five steps by the number of postings, share one selection and one detail panel, and the choice is remembered in the browser. The outlines are Natural Earth (public domain), simplified into `docs/geo.js` by `scripts/build-maps.mjs` (`node scripts/build-maps.mjs`; the page asks for that file only when a map is opened). The city areas are also in the Location menu of All jobs. Shading has three options: the number of **postings**, **your strong matches** (postings that score 60 or more for the CV) and **your fit rate** (the share of a place's scored postings that are strong matches; a place with fewer than 30 scored postings shows a dash). The last two need a CV, use the same scores as the Top 10 (a heuristic: scores within 5 points are ties) and add a line to the detail panel. Then, on all views: a field-by-stage grid with the visitor's stage marked; the postings published in each of the last 30 days; the employers with the most postings; and the skills asked for most (role and tool skills, or general strengths). A switch narrows everything to full-time, part-time or internships. A province, a grid cell or an employer opens the matching postings on the All jobs page.
- **Skill lab** (`#p=lab`, needs a CV). Take the 200 best-fitting postings, switch on a skill the CV lacks, and see the top 10 re-ranked with the new scores (same scoring rules, the skill counted as present). It offers two plans of up to three role or tool skills, one after the other: **Raise my average** (the skills that lift the top 10 most) and **Open more doors** (the skills that bring the most postings up to 60 or more), each showing the top-10 average and the number of postings at 60+ after every step. They are often different skills, which is the point of showing both. General strengths such as "Communication" are listed apart, because the score counts only what is written on the CV. It is a what-if: nothing is written to the CV.
- **Career ladder** (`#p=ladder`). For a field (or all fields), the five rungs from student to executive with their posting counts, the titles that come up most on a rung, its most-asked skills, the skills that are far more common than one rung down, and what the next rung adds. A ✓ marks a skill on the CV. With a CV, a panel reads it against every rung: how many of the 12 role and tool skills asked for most on that rung are on the CV (not a score), and the climb panel lists which of the next rung's are not yet there.
- **Quick sort** (`#p=swipe`). One posting per card: drag it right to save or left to skip (or use the buttons, or the arrow keys; `Z` undoes, the up arrow opens the posting). With a CV the cards come in ranked order and show what matched and what is missing; without one they are the newest postings that fit the details. Skipped cards stay hidden until brought back.
- **Application board** (`#p=board`). Saved, Applied, Interview, Offer and Closed columns (drag a card, or use the arrows), a weekly goal with a progress ring and a streak, a form to add an application found elsewhere, a CSV download, and a table of interviews by the match score at the time of applying, so the visitor can see in their own data whether higher scores led to more interviews (it says plainly that a small sample proves nothing). Everything is kept in this browser only. Starring a posting anywhere puts it in Saved.
- **Add a posting** (the panel on **All jobs**). Paste a job found on any site (title, employer, optional place and link, the full text) and it is scored against the CV like every collected posting, with the same Match / Close / Gap keywords. It is kept in this browser only (`pm_mine`, the last 30), shows as "Added by you" and can be removed from its card.
- **Paste a posting** (the ninth page, `#p=paste`, in the Explore menu). The split page the Add a posting panel grew into. **Left:** the CV (or a box to paste it, or the example CV). **Right:** a box for the whole posting, copied from LinkedIn, Indeed, Job Bank or an employer page. A rule reader (`docs/pasteparse.js`, tested in `test/pasteparse.test.mjs`, not a language model) fills the job title, employer, place, kind of job (internship or co-op, part-time) and link from the text, in English or French, and shows what it read as chips; every field can be changed. It only fills what it can see: a first line that reads like a sentence is never guessed to be a title, and the description is never cut short (30,000 characters, like the form on All jobs). **Match it to my CV** adds the posting through the same `addMine` that the form uses (kept in this browser, `pm_mine`, the last 30; the same employer and title replaces the earlier one, and a collected posting with the same employer and title takes the pasted text as its full text), scores it with `scoreJob` like every collected posting, and draws it with the Top 10 card: score meter, Match / Close / Gap keywords with the line of the CV as evidence, talking points, flags for language, eligibility and term, and how the score was counted. Side by side, the CV is marked by what the posting asks for and the posting by what the CV has. **Where it sits** says whether it is in the Top 10 (and its rank), how many other postings that fit the details score clearly higher, tie (within 5 points) or score lower, and draws a histogram of all of them with the posting and the Top 10 range marked; a posting outside the details says why (place, kind, language, level) and is not ranked. Under it, "Postings you added" lists everything pasted so far, best score first. Nothing is uploaded and nothing is applied for. The page's example posting (fictional, labelled) is scored but never put in the Top 10.
- **Eligibility filter and 30-day window** (toolbar on **All jobs**). Hide postings whose text mentions a security or background check, Canadian citizenship or permanent residence, or that are aimed at new graduates only. A posting without text cannot be checked, so it stays in the list. Postings more than 30 days old carry a "may be closed" note.
- **The market for your CV** (bottom of **Your top 10**). How many employer postings fall in each score band, and which employers hold the most postings scoring 60 or more. It is a heuristic: scores within 5 points are ties.
- **Compare** (button on every scored card). Pick up to three postings and see the score parts, keyword counts, level, flags and the Match / Gap keywords side by side.
- **Week plan** (`#p=plan`, in the Explore menu and linked from **Your top 10**). Picks the few postings worth this week's applications. Each gets a **score range**: its keywords are re-drawn 120 times with a seeded generator and scored again, and the 20th to 80th percentile is shown (few keywords make a wide range). The **cautious score** is the low end of the range; **priority** is the cautious score times a freshness weight that halves every 10, 21 or 45 days (the person's choice); at most two postings per employer. The page draws the score-against-age scatter with its Pareto front, lists the next postings in line with the reason each missed out (older, wide range, employer limit, security or citizenship wording), logs "I applied" on the Application board with the score at that time, and can save the plan and check it again later (still listed, applied, no longer listed). Employer postings with a full text only. The maths is in `docs/planner.js`, tested in `test/planner.test.mjs`. It is a heuristic, not a forecast of interviews.
- **Target or spray?** (`#p=target`, in the Explore menu). A break-even lab for the capstone's hypothesis. With the same hours, it compares sending many quick applications to postings picked at random from the person's pool (spray) against a few tailored ones (the Week plan's picks). The scores are the person's real ones; the chance of an interview is a guess they set (a typical posting has chance r, and the odds multiply by m for every +10 points). It shows expected interviews with a 2,000-run Monte Carlo range, the chance of at least one interview, applications per interview, and the **break-even multiplier**: how strong the score effect must be before targeting wins. It can say that volume wins at the person's own settings. Applications on the Application board that are at least 14 days old (so late replies are not missed) give a rough implied multiplier once there are enough of them. It does not claim targeting works; it shows what the data would have to show. The maths is in `docs/planner.js`, tested in `test/planner.test.mjs`.
- **Wayfinder: describe the job you want** (on the start page, and at the top of **All jobs**). Type a sentence in English or French, such as "Winter 2027 engineering or quality co-op in Montréal, bilingual, no security clearance", and it is turned into the filters the list already has. Benchmark: LinkedIn's AI job search, which takes plain language. It is a rule reader (`docs/describe.js`), not a language model, and it runs in the browser. It reads the type (internship or co-op, part-time, full-time), a place (Montréal area, province, city, remote), level, language, posted when, "no security clearance" wording, minimum score and order (the score needs the CV), role words, words to leave out ("not sales"), and skills after "with" or "using" (looked up in the skills library). Role words are matched against the title with English and French equivalents (engineer, ingénieur, génie; supply chain, chaîne d'approvisionnement), and the chip's tooltip lists the words it accepts. What it understood shows as chips that can be taken off one by one. Things a posting seldom states (work permit, term dates, degree, hours a week) are shown as dashed notes and never filtered; work permit status is never assumed. A sentence that matches nothing changes nothing. The sentence and chips are kept in the link and in saved searches. Tests: `test/describe.test.mjs`. While you type, it shows how it reads the sentence before anything is applied. It is also the eighth page in the Explore menu (`#p=wayfinder`): a prompt box with a live reading, and six sample prompts for students (part-time jobs, internships, co-ops) and six for graduates (entry-level roles), each card showing how it will be read. The reader also understands "no experience" (entry level), and treats words like weekend, evenings or paid as notes instead of title words.
- **Score meter and tie groups.** Every card draws its score as it is counted: Role, Level and Keywords at the length of their points on one 0 to 100 track, with the plus or minus 5 band inside which two scores are a tie. A keyword coverage bar shows Match, Close and Gap at a glance. In the Top 10, a run of scores within 5 points of its first one is marked as one tie, so the order is not read as more precise than it is. No CV at hand? **See it with an example CV** (on the start page and in the All jobs banner) opens a scored Top 10 in one click. The example is a fictional student, and the Top 10 says so.
- **Saved searches, CSV download and talking points.** **Save this search** keeps the current filters as a chip in this browser (`pm_views`, up to 12). **Download CSV** saves the filtered list, or the top 10, as a spreadsheet file. Each opened card lists up to six keywords the posting asks for that the CV already says, with the CV line as evidence, and the gaps with "mention only if true". Nothing is added to the CV.

Colour: the base stays spruce, lake teal and blaze orange (the start page and top bar are light navy and orange in the light theme, and spruce in the dark one); each page adds one hue (sun, sky, violet, mint, coral, berry, peach, lime) and a field gets one of eight hues. The map and grid use one five-step violet ramp whose text colour is set per step; `npm test` checks the wiring and a browser pass checked the text contrast of every new page in the light and dark themes.

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
| Career sites (sitemap) | An employer site that lists its postings in a sitemap and publishes `JobPosting` data on each posting page | Nothing. List `{ name, sitemap, include, max }` under `sitemaps`. `robots.txt` is read first and a path it disallows is never fetched. Use the **Probe job sites** workflow with `config/probe_employers.json` to see which sites answer and what their `robots.txt` allows before adding one |
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

**Employer discovery (runs by itself every Sunday).** The **Find boards** workflow reads the latest `docs/jobs.json`, picks the employers that appear in the search services (Adzuna, Jooble, The Muse, Job Bank) but have no direct board yet, and looks for their own board on all ten open systems (`scripts/discover-employers.mjs`). For the 40 busiest it also tries Workday. A board is added to `config/companies.json` automatically (`scripts/apply-finds.mjs`) when the company name on the board looks like the employer; names that do not match are listed as "review" in `reports/applied.json` and are not added. A direct board gives the full posting text and every open posting, where a search service gives a short snippet. An employer is looked up again after 90 days (`config/discovered.json`). Run it by hand with scope `curated` or `both` to check the starter list again. Workday site names come from `config/workday_names.json` (tenant to display name) when it has one.

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

- `docs/index.html` the site (stage trail, filters, results); `docs/pasteparse.js` the reader of pasted postings; `docs/pages.js` and `docs/pages.css` the nine extra pages, the Explore menu, the jump bar and the colours; `docs/geo.js` the map outlines (generated by `scripts/build-maps.mjs`, loaded on demand); `docs/jobmeta.js` the level of a posting, the stage of a CV, the fit table and the fields; `docs/scoring.js` the 0–100 score; `docs/matcher.js` the keyword engine
- `docs/stats.json` the numbers of the start page, written by `scripts/cover-stats.mjs` after each collection;
- `docs/jobs.json` the collected postings, one short record each; `docs/d/` their full texts in 64 files
- `scripts/collect.mjs` the collector, `scripts/find-boards.mjs` the board finder (`config/candidates.json` is its list)
- `config/companies.json`, `config/searches.json` what to collect
- `.github/workflows/refresh.yml` the schedule
- `test/collect.test.mjs`, `test/jobmeta.test.mjs`, `test/scoring.test.mjs`, `test/pages.test.mjs`, `test/geo.test.mjs` offline tests (`npm test`)

## Keyword extractor (Python)

`python/keyword_extractor.py` reads one job post and one CV and lists matched, missing and related skills, plus flags to verify. Run it by hand with `python3 python/keyword_extractor.py posts/<post>.txt cv/sample_cv.txt`.

`scripts/run_reports.py` runs it on every file in `posts/` against a CV in `cv/` and writes `reports/` and `docs/reports.json`. The **Keyword report** workflow does this from the Actions tab, and `docs/reports.html` shows the result on the site. To add a posting, drop a `.txt` file in `posts/` in the same format as the examples.

### Every keyword of the posting, in any field (`python/terms.py`)

The dictionary only names skills it knows. To read **all** the keywords of a posting, whatever the field, `python/terms.py` also cuts the whole text (title and description) into phrases at the filler words (articles, pronouns, job-ad verbs, benefits words, months, numbers, English and French, about 870 words you can read in the file). "Root cause analysis", "génie informatique" or "boiler code" are keywords with no list needed. Skills of the dictionary are taken out first, so nothing is counted twice.

- **Match**: the same words, in the same order, are on the CV (plural and accents do not matter).
- **Close**: not the same, but a single word with the same stem, or a phrase whose words are all on one CV line in another form or order (for a phrase of four words or more, at least half of its main words). One shared word is not enough. Never counted as a match; half credit in the second figure.
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

### The bilingual skills library (`python/skills_library.py`)

A library of 43 fields, 2,446 skills and about 20,000 English and French spellings, laid **over** the lists above (after the OaSIS names), so the site now knows about 2,150 skills and 21,000 spellings. It is added without changing what was found before:

- a library skill that is already in the dictionary (same name, or its main spelling or most of its spellings belong to one skill) only brings its new spellings, and the skill keeps its name; any other library skill is added;
- a spelling that already belongs to a skill stays with that skill, and a new spelling of an existing skill is left out when it would contain another existing skill's spelling;
- a skill added by the library never hides a skill that was there before it (*aerospace manufacturing* still counts *Aerospace experience* and *Manufacturing experience*);
- `LIBRARY_PRUNE` in `python/skills_extra.py` lists about 130 library spellings that are left out, each with its reason. They were found by running the library over 5,000 real postings: perks (*dental*, *gym*, *time off*), equal-opportunity text (*veteran*, *genetics*), company advertising (*innovative*, *startup*), and words that become something else without accents (*thèse* → *these*, *défi* → DeFi, *revenus* → *revenu*). Delete a line to bring a spelling back;
- the library's "related" lists are not used (a close pair earns half credit in the score here); its CV headings are added; its new soft skills are shown under "General strengths".

To change the library: edit `python/skills_library.py`, then run `python3 scripts/build_site_dictionary.py` (writes `docs/skills.json`) and `npm run reprofile` (works out again the keywords stored with every posting, from the texts already saved, in about 7 minutes). The daily collection would also redo them, the next morning.

The matcher only tests, on each line, the skills whose words are on that line (a word index built from the spellings), so 2,150 skills read as fast as 375 did; the answers are the same as testing every skill.

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
**Guess** (the site shows these as **Match**, **Gap** and **Close**, the same three tags as on every other posting). The collector uses it for Job Bank jobs whose posting could not be read: they are scored from the official description of their occupation (found from the title) and their card is labelled "Occupation profile – NOC …". Details:
[noc_library/README.md](noc_library/README.md). Contains information licensed under the Open Government
Licence – Canada.

## Job Bank open data (all of Canada, newest month)

`scripts/jobbank_open.mjs` adds every posting first published on Job Bank in the newest month (about 50,000, from
[Job Bank's open data](https://open.canada.ca/data/en/dataset/ea639e28-c0fc-48bf-b5dd-b8899bd43072), Open Government
Licence – Canada). The daily run checks the catalogue and downloads the English and French files only when a new month is
out (a few days after each month ends). The files have no employer, description or link, but each posting has its
official occupation (NOC), place, date, pay, and the language, education and experience it asks for.

- `docs/jobs/noc/postings.json`: every posting, by occupation, with the keywords of its title;
  `docs/jobs/noc/index.json`: each occupation with its number of postings, provinces, pay (25th, 50th and 75th percentile,
  yearly), languages asked and the keywords of its official description. Settings: `jobbankOpen` in
  `config/searches.json` (`"enabled": false` switches it off).
- On the page, every open-data posting is listed (source "Job Bank open data"), after the regular collection has loaded
  (about 1.5 MB more). Each card says "Occupation profile – NOC …", shows pay, education, experience, language and
  positions, compares the CV with the occupation (including the language the posting asks for), and has two links: a
  Job Bank search for the same title and place (the open data has no posting link) and the full description of the
  occupation on the Government of Canada's OaSIS site. A posting also collected from another source (same title, city,
  province and day) is left out, since the other copy has the employer and a link.
- Every Job Bank job with an occupation (feed or open data) links to the occupation's full description.
- The data is about a month old when it comes out, so some postings may already be filled: the age is on every card.

