# Path Match NOC library (English + French)

A bilingual dictionary of all **516 Canadian occupations (NOC 2021)** and their **900 detailed OaSIS
profiles**, with ready-to-use helpers in **Python** and **JavaScript**. It lets Path Match:

1. **Find the occupations a CV fits** (from job titles, duties and skills written on the CV, in English or French).
2. **Compare a CV with any occupation or Job Bank job** on 5 parts: duties, skills, education,
   certifications and languages.
3. **Label every item** with one of 3 labels only: **Matched**, **Missing** or **Guess**.
4. **Translate** skills, job titles and duty keywords between English and French.
5. **Suggest nearby occupations** (career paths).

## Files in this repository

| File | What it is |
| --- | --- |
| `docs/noc/noc_library.lite.json` (10 MB, about 1.7 MB as the browser downloads it) | The library: all occupations, indexes and translations |
| `docs/noc/noc_library.js` | Helpers for the website and the Node collector (ES module, no dependencies) |
| `noc_library/noc_library.py` | The same helpers in Python (no extra packages); load `docs/noc/noc_library.lite.json` |
| `noc_library/build_library.py` | Rebuilds the JSON from the government CSV files |
| `test/noc_library.test.mjs` | Offline checks, part of `npm test` |

**How it fits with the existing OaSIS dictionary** (`docs/skills.json`, `python/oasis_data.json`): that one is a
*skills* dictionary (skill names and their English/French spellings, used to find skills in CVs and postings).
This library is an *occupation* library: for each NOC code it holds the duties, skills, education,
certifications and similar occupations, so a job that only has a title (most Job Bank jobs) can be compared
with a CV through its occupation. The two work side by side; neither replaces the other.

## Job Bank jobs that only have a title

Job Bank's terms forbid reading most postings with a script, so the collector reads the full text of only the newest ~50.
For every other Job Bank job, `scripts/collect.mjs` finds the occupation from the title with `nocForTitle` and scores the
job from that occupation's official description (`occupationText`): its core competencies, main duties and required
certifications. The job card says **"Occupation profile – NOC …"**, compares the CV with the occupation (Matched / Missing /
Guess, without languages since the posting does not say which one it needs), shows the occupation description and keeps the
link to the real posting and the box to paste it. Pasting the employer's text scores the job on that text instead.

`nocForTitle(lib, title)` (Python: `noc_for_title`) returns the occupation and how it was found:
- **exact title**: the title is a title of exactly one occupation ("supermarket butcher" → 63201);
- **closest title**: the same words in the usual order ("driver, truck" → truck driver, 73300) or the closest known title
  with the same main word and most of the other words ("transportation coordinator" → transportation planning coordinator, 13201);
- **none**: nothing close enough (the job stays title only).

## What is inside, for each occupation

| Part | Example: 13201.01 Production logistics coordinators |
| --- | --- |
| Names (EN/FR) | Production logistics coordinators / Coordonnateurs/coordonnatrices de la logistique de la production |
| Lead statement (EN/FR) | One-sentence description |
| Main duties (EN/FR, paired) | "Maintain inventory of materials and parts…" / "tenir l'inventaire des matériaux et des pièces…" |
| Duty keywords (EN/FR) | warehouse, production run, inventory… / chaîne d'approvisionnement, taux de production… |
| Skills rated 3-5 (EN/FR) | Problem Solving 4 / Résolution de problèmes 4 … |
| Core competencies (EN/FR) | Coordinating / Coordination, with why it matters |
| Education | College or post-secondary program (level 3 of 6) |
| Certifications and licences | e.g. Professional Engineer licence (P.Eng.), required: yes/no |
| Similar occupations | 13201.02 (very similar), 10019.00, 12010.00 … |
| Languages in postings (per NOC) | English 47, English or French 14, French 13, Bilingual 2, no data 34 (Job Bank, September 2026) |

Plus three indexes: **job title → occupations** (65,831 titles, EN/FR, including 4,166 titles used in
real Job Bank postings; vague one-word titles such as "intern" or "assistant" are left out), **keyword → occupations**, and **English ↔ French** pairs (179 duty
keywords, 192 skills/competencies, 4,220 job titles).

## Use it

### Website (JavaScript)
```html
<script type="module">
  import * as nl from "./noc/noc_library.js";
  const lib = await nl.load("./noc/noc_library.lite.json");
  const fits = nl.findOccupations(lib, cvText);           // [{code, name:{en,fr}, score, clear_fit, evidence}]
  const result = nl.compare(lib, cvText, "13201", { postingLanguage: "English and French" });
  // result.items: [{part, en, fr, label: "Matched"|"Missing"|"Guess", why}]
</script>
```
For a Job Bank job, pass its **NOC21 Code** (for example `"13201"`) and its **Official Language**
(`English`, `French`, `English or French` = either one is enough, `Bilingual` = both).

### Python
```python
import noc_library as nl
lib = nl.load("docs/noc/noc_library.lite.json")
fits = nl.find_occupations(lib, cv_text)
result = nl.compare(lib, cv_text, "13201", posting_language="English and French")
nl.translate(lib, "Coordinating")      # ['Coordination']
nl.similar(lib, "13201.01")            # nearby occupations
```

## The 3 labels (same rules in Python and JavaScript)

| Label | When |
| --- | --- |
| **Matched** | The CV clearly shows the item, in English or French. |
| **Missing** | Nothing on the CV shows it. |
| **Guess** | The CV suggests it without saying it. Shown as a guess; the applicant is asked to confirm. |

A field of study on the CV ("M.Eng. Industrial Engineering") also points to its occupation, but as weaker
evidence: it never counts as a clear fit on its own.

A **Guess** is only made from strong evidence:
- the item is a usual duty or a core skill of an occupation the CV **clearly fits** (a job title of that
  occupation is written on the CV);
- education: the required degree is **in progress** on the CV;
- language: the CV is **written in** that language, or shows studies at a French-language school.

**Certifications and licences are never guessed** (only Matched or Missing), and written proof on the CV
always wins over a guess.

## Limits to know
- **Duty keywords are extracted by rules**, not by an AI model. Most are good; a few are clumsy. The
  duty *sentences* themselves are the official OaSIS text.
- **OaSIS skills are general** (Problem Solving, Coordinating…). Specific tools (SAP, Excel, AutoCAD)
  are not in OaSIS: they come from a posting's full description.
- **English ↔ French keyword pairs are found automatically** from the paired duty sentences, keeping
  only strong pairs. A few may be wrong; each has a strength score in `translations.keywords_en_fr_strength`.
- **Job Bank titles and languages** come from the September 2026 file. Rebuild with newer files to refresh.

## Rebuild
Put the CSV files in one folder (OaSIS/SIPeC 2025: lead statement, main duties, example titles,
employment requirements, skills, core competencies, skills match matrix, in English and French; plus
optionally a Job Bank monthly file in English and French), then:
```
python noc_library/build_library.py <csv folder> <output folder>
```

## Source and licence
Employment and Social Development Canada, **OaSIS / SIPeC 2025** (open.canada.ca dataset
10ce43bd-fb58-4969-806b-4bffebc87bec) and **Job Bank open data** (dataset
ea639e28-c0fc-48bf-b5dd-b8899bd43072).
*Contains information licensed under the Open Government Licence – Canada.*
Built for the Path Match capstone project, Concordia University (INDU 6993).
