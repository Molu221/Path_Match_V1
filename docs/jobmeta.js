/* jobmeta.js - what level a posting is written for, what level a CV has reached, and which field a posting belongs to.
 *
 * Plain functions, no page needed. The website (index.html) and the collector (scripts/collect.mjs) both load this file,
 * and test/jobmeta.test.mjs checks it.
 *
 *   JobMeta.jobLevel(title, desc, type)  -> { lvl: 0..4, src, why }
 *   JobMeta.cvLevel(cvText, now)         -> { band: 0..4 | null, years, conf, why }
 *   JobMeta.fit(cvBand, jobLvl)          -> 0..1   (how well a posting of that level suits a person of that band)
 *   JobMeta.fieldOf(title)               -> { id, label }
 *   JobMeta.langOf(title, desc)          -> "en" | "fr" | "bi"
 *   JobMeta.descFlags(desc)              -> [[colour, message], ...]  things to check yourself
 *
 * Levels of a POSTING            Bands of a PERSON (same scale)
 *   0 intern / co-op / student     0 student or new graduate (under 1 year of full-time work)
 *   1 entry-level / junior         1 early career (1 to 3 years)
 *   2 mid-level (no level word)    2 mid-level (3 to 7 years)
 *   3 senior / lead / manager      3 senior (7+ years)
 *   4 director / VP / executive    4 director or executive (a director-level title on the CV, with 6+ years)
 *
 * This is a heuristic, not a rule: a title cannot say what an employer will really accept. Every answer carries `why`
 * (the words it was read from) so the page can show it, and the person can override their own level.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JobMeta = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* lower case, accents removed, typographic dashes and quotes made plain */
  function fold(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/[’‘`]/g, "'").replace(/[‐‑–—−]/g, "-")
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  }

  const LEVELS = [
    { id: 0, key: "intern", label: "Intern / student", short: "Intern" },
    { id: 1, key: "entry", label: "Entry-level", short: "Entry" },
    { id: 2, key: "mid", label: "Mid-level", short: "Mid" },
    { id: 3, key: "senior", label: "Senior / manager", short: "Senior" },
    { id: 4, key: "exec", label: "Director & executive", short: "Director+" }
  ];
  const BANDS = [
    { id: 0, label: "Student or new graduate" },
    { id: 1, label: "Early career (1–3 years)" },
    { id: 2, label: "Mid-level (3–7 years)" },
    { id: 3, label: "Senior (7+ years)" },
    { id: 4, label: "Director or executive" }
  ];

  /* ------------------------------------------------------------------ level of a posting ------------------------------------------------------------------ */

  /* an internship, co-op or student job. "Student Success Advisor" and "Internal Auditor" are not. */
  function isStudentTitle(T) {
    if (/\b(interns?|internships?|stagiaires?|co-?ops?|coop|externships?|work-study)\b/.test(T)) return true;
    if (/\bstages?\b/.test(T) && !/\b(early|late|growth|seed|clinical|pre|mid|next|final|series [a-z])[- ]stages?\b|\bstage (manager|hand|crew|director|technician|lighting|production|left|right)\b/.test(T)) return true;
    if (/\b(etudiants?|etudiantes?|students?)\b/.test(T)) {
      if (/\b(student|etudiant\w*)s?\s+(success|services?|affairs|recruit\w*|advis\w*|life|housing|accounts?|enrol\w*|information|loans?|aid|records?|engagement|experience|wellness|health|counsel\w*|conduct|mobility|support|transportation|retention|onboarding|programs?)\b/.test(T)) return false;
      if (/\b(for|to|of|with|des|aux|pour|de)\s+(\w+\s+)?(students?|etudiant\w*)\b/.test(T)) return false;
      return true;
    }
    return false;
  }

  const EXEC = /\b(vice[- ]?presidents?|vice[- ]?presidente?s?|vps?|svp|evp|avp|chief|ceo|cfo|cto|coo|cmo|cio|ciso|chro|presidents?|presidentes?|head of|managing directors?|general managers?|executive directors?|directors?|directeurs?|directrices?)\b/;
  const EXEC_SOFT = /\b(art|creative|casting|music|photography|film|video|funeral|camp|executive producer|technical|sports?|athletic)\s+directors?\b|\b(associate|assistant|deputy|adjoint\w*)\s+(vice[- ]?president|directors?|directeurs?|directrices?)\b/;
  const SENIOR = /\b(senior|seniors|sr|principal|lead|leads|team leads?|tech leads?|managers?|gestionnaires?|superviseur\w*|supervisors?|chef d'equipe|chef de (service|projet|produit|groupe|division|section)|responsables?|architects?|architectes?|superintendents?|foreman|contremaitres?|staff (engineer|scientist|designer|developer))\b/;
  const MANAGER_IC = /\b(account|community|case|office|social media|content|customer success|client|territory|relationship|project|program|product|store|talent|brand|category|partner)\s+managers?\b/;
  const ENTRY = /\b(junior|jr|entry[- ]level|entry|new grads?|recent grads?|graduates?|nouveaux? diplomes?|nouvelles? diplomees?|jeunes? diplomes?|debutants?|trainees?|apprentis?|apprentices?|assistants?|assistantes?|associates?|clerks?|commis|receptionists?|aides?|helpers?|level (1|i)|tier 1)\b/;
  const ROLE_N = "engineer|developer|analyst|specialist|technician|accountant|designer|coordinator|administrator|representative|agent|programmer|scientist|officer|consultant|technologist|architect|adjuster|planner|buyer|recruiter|nurse|teacher";
  const GRADE = new RegExp("\\b(" + ROLE_N + ")s? (i|ii|iii|iv|v|1|2|3|4|5)\\b");
  const MID_CUE = /\b(mid[- ]level|intermediate|intermediaire|confirme|experienced)\b/;

  /* the number of years a posting asks for, taken from the line that says "experience"; "" when it names none */
  function yearsAsked(text) {
    const t = fold(text);
    const re = /(\d{1,2})\s*(\+|plus)?\s*(?:(?:-|to|a)\s*(\d{1,2})\s*)?(?:\+\s*)?(?:years?|yrs?|ans|annees?)\b([^.\n]{0,60})/g;
    let m;
    while ((m = re.exec(t))) {
      const around = t.slice(Math.max(0, m.index - 70), m.index);
      const tail = m[4] || "";
      if (!/experience|exp\b/.test(tail) && !/experience[^.\n]{0,40}$/.test(around)) continue;
      if (/\b(we|our|nous|notre|company|for over|for more than|over|more than|plus de|depuis|since|founded|history|leader|serving|business for)\b[^.\n]{0,25}$/.test(around) && !/(require|minimum|at least|must|you|vous|exige|candidate)/.test(around)) continue;
      const n = +m[1];
      if (n > 25) continue;
      return { min: n, text: (m[0].length > 70 ? m[0].slice(0, 70) : m[0]).trim() };
    }
    return null;
  }

  function jobLevel(title, desc, type) {
    const T = fold(title);
    const L = (lvl, src, why) => ({ lvl, src, why });
    if (isStudentTitle(T)) return L(0, "title", "“" + (T.match(/\b(interns?|internships?|stagiaires?|co-?ops?|coop|stages?|students?|etudiants?|externships?)\b/) || [""])[0] + "” in the title");
    if (/\bmanagement trainee|manager[- ]in[- ]training|graduate (program|programme)|leadership (development )?(program|programme)\b/.test(T)) return L(1, "title", "trainee or graduate programme");
    if (/\b(assistant|associate|deputy|adjoint\w*)\s+(manager|gestionnaire)\b/.test(T)) return L(2, "title", "assistant or associate manager");
    if (/\bexecutive assistants?\b/.test(T)) return L(2, "title", "executive assistant");
    if (/\b(assistant|associate)\s+(professor|principal|head|dean|vice|director|general|controller)\b/.test(T)) return L(3, "title", "assistant or associate at senior rank");
    const g = GRADE.exec(T);
    if (g) { const n = { i: 1, 1: 1, ii: 2, 2: 2, iii: 3, 3: 3, iv: 3, 4: 3, v: 3, 5: 3 }[g[2]]; return L(n, "title", "grade “" + g[0] + "” in the title"); }
    const junior = /\b(junior|jr|entry[- ]level|new grads?|recent grads?|nouveaux? diplomes?|jeunes? diplomes?|debutants?|trainees?)\b/.exec(T);
    if (junior) return L(1, "title", "“" + junior[0] + "” in the title");
    const ex = EXEC.exec(T);
    if (ex) return EXEC_SOFT.test(T) ? L(3, "title", "“" + ex[0] + "” in the title, below the executive rank") : L(4, "title", "“" + ex[0] + "” in the title");
    const sr = SENIOR.exec(T.replace(/\blead (gen\w*|capture|nurtur\w*|qualification|scor\w*|source)\b/g, ""));
    if (sr) {
      if (/^(manager|managers|gestionnaire|gestionnaires)$/.test(sr[0]) && MANAGER_IC.test(T)) return L(2, "title", "an individual-contributor “manager” title");
      if (/^(lead|leads)$/.test(sr[0]) && /\b(lead|leads)\s+(generation|gen)\b/.test(T)) { /* not a seniority word */ } else return L(3, "title", "“" + sr[0] + "” in the title");
    }
    const en = ENTRY.exec(T);
    if (en) {
      if (/^(associate|associates|assistant|assistants|assistante|assistantes|aide|aides)$/.test(en[0]) && /\b(manager|director|professor|vice|principal)\b/.test(T)) { /* handled above */ } else return L(1, "title", "“" + en[0] + "” in the title");
    }
    if (MID_CUE.test(T)) return L(2, "title", "mid-level wording");
    if (type === "Internship") return L(0, "type", "the source lists it as an internship");
    /* no level word in the title: read the experience the text asks for */
    const text = String(desc || "");
    if (text) {
      const f = fold(text.slice(0, 20000));
      const y = yearsAsked(f);
      if (y) {
        const lvl = y.min <= 1 ? 1 : y.min <= 4 ? 2 : 3;
        return L(lvl, "years", "the posting asks for “" + y.text + "”");
      }
      const e = /\b(entry[- ]level|no (prior |previous )?experience (is )?(required|necessary|needed)|aucune experience (requise|necessaire)|sans experience|new grads? (are )?(welcome|encouraged)|recent graduates? (are )?(welcome|encouraged)|0 ?(-|to) ?2 years)\b/.exec(f);
      if (e) return L(1, "text", "the posting says “" + e[0] + "”");
    }
    return L(2, "default", "no level word in the title and no years named");
  }

  /* Level of a posting whose text cannot be read but whose facts are published (Job Bank open data):
     exp = the experience asked ("No experience", "1 year to less than 2 years", "5 years or more"...), edu = the education asked (1 no degree … 6 doctorate).
     A clear level word in the title still wins ("Senior", "Director", "Student"). A weak one (a role noun such as "assistant" or "clerk",
     or no level word at all) gives way to the experience asked, the same years rule as jobLevel(): up to 1 year entry, up to 4 mid, more senior. */
  const WEAK_TITLE_WHY = /^“(assistants?|assistantes?|associates?|clerks?|commis|receptionists?|aides?|helpers?)” in the title$|^mid-level wording$/;
  function expYears(exp) {
    const t = fold(exp);
    if (!t) return null;
    if (/\bno experience\b|\baucune experience\b/.test(t)) return 0;
    const m = /(\d+)\s*(months?|mois|years?|ans?)\b/.exec(t);
    if (!m) return null;
    return /^(month|mois)/.test(m[2]) ? 0 : +m[1];
  }
  function factsLevel(title, exp, edu, type) {
    const t = jobLevel(title, "", type);
    const weak = t.src === "default" || (t.src === "title" && WEAK_TITLE_WHY.test(t.why));
    if (!weak) return t;
    const y = expYears(exp);
    if (y != null) {
      const lvl = y <= 1 ? 1 : y <= 4 ? 2 : 3;
      return { lvl: t.src === "default" ? lvl : Math.max(t.lvl, lvl), src: "facts", why: "the posting asks for “" + String(exp).trim().toLowerCase() + "” of experience" };
    }
    if (t.src === "default" && (edu === 1 || edu === 2)) return { lvl: 1, src: "facts", why: "the posting asks for " + (edu === 1 ? "no degree" : "high school") + " and names no experience" };
    return t;
  }

  /* ------------------------------------------------------------------ level of a person ------------------------------------------------------------------ */

  const MON = "(?:jan\\w*|feb\\w*|fev\\w*|mar\\w*|apr\\w*|avr\\w*|may|mai|jun\\w*|juin|jul\\w*|juil\\w*|aug\\w*|aou\\w*|sep\\w*|oct\\w*|nov\\w*|dec\\w*)\\.?";
  const D = "(?:" + MON + "[\\s,.'-]*(?:19|20)\\d{2}|(?:19|20)\\d{2}[-\\/](?:0?[1-9]|1[0-2])(?![\\d])|\\d{1,2}\\/(?:19|20)\\d{2}|(?:19|20)\\d{2})";
  const PRESENT = "present|current|currently|now|today|ongoing|en cours|aujourd'hui|presentement|maintenant|a ce jour|to date";
  const RANGE_SRC = "(" + D + ")\\s*(?:-|to|until|through|au|a)\\s*(" + D + "|" + PRESENT + ")";
  /* an open-ended job: "since March 2023", "depuis mars 2023" */
  const SINCE_SRC = "(?:since|depuis|from)\\s+(" + D + ")\\s*$";
  const MONTHS = { jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, avr: 4, may: 5, mai: 5, jun: 6, juin: 6, jul: 7, juil: 7, aug: 8, aou: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  function parseDate(s, isEnd, now) {
    s = s.trim();
    if (new RegExp("^(" + PRESENT + ")$").test(s)) return now.getFullYear() * 12 + now.getMonth();
    const y = /((?:19|20)\d{2})/.exec(s);
    if (!y) return null;
    const year = +y[1];
    const iso = /^((?:19|20)\d{2})[-\/](\d{1,2})$/.exec(s);
    if (iso) return +iso[1] * 12 + (+iso[2] - 1);
    const num = /^(\d{1,2})\//.exec(s);
    if (num) return year * 12 + (+num[1] - 1);
    const mm = new RegExp("^" + MON.replace("\\.?", "")).exec(s) ? s.match(/[a-z]+/)[0] : null;
    if (mm) {
      const key = mm.startsWith("juin") ? "juin" : mm.startsWith("juil") ? "juil" : mm.slice(0, 3);
      if (MONTHS[key] != null) return year * 12 + (MONTHS[key] - 1);
    }
    return year * 12 + 6;   // a year alone: the middle of it, so "2019 - 2022" counts as three years
  }
  function union(spans) {
    const s = spans.slice().sort((a, b) => a[0] - b[0]);
    let total = 0, cur = null;
    for (const [a, b] of s) {
      if (!cur) cur = [a, b];
      else if (a <= cur[1]) cur[1] = Math.max(cur[1], b);
      else { total += cur[1] - cur[0]; cur = [a, b]; }
    }
    if (cur) total += cur[1] - cur[0];
    return total;
  }

  const SEC = {
    edu: /^(education|formation|etudes?|scolarite|academic|academics|parcours (scolaire|academique)|studies)\b/,
    exp: /^(work |professional |relevant |employment )?(experience|experiences|history|employment|emploi|emplois|parcours professionnel|experience professionnelle|experiences professionnelles)\b|^work history/,
    other: /^(projects?|projets?|volunteer\w*|benevolat|certifications?|licen[sc]es?|awards?|achievements?|accomplishments?|scholarships?|bourses?|distinctions?|honou?rs|activities|extracurricular\w*|leadership|publications?|patents?|hobb(y|ies)|loisirs?|skills?|competences|languages?|langues|interests|references|courses|coursework|training)\b/
  };
  const DEGREE = /\b(bachelor|b\.? ?sc|b\.? ?eng|b\.? ?a\b|b\.? ?comm?|beng|bsc|master|m\.? ?sc|m\.? ?eng|m\.? ?a\b|meng|msc|mba|ph\.? ?d|doctorat|diploma|diplome|degree|licence|baccalaureat|maitrise|gpa|coursework|dec (en|in)|deec|aec\b|major in|minor in|honours)\b/;
  const SCHOOL = /\b(university|universite|college|cegep|ecole|school|institute|polytechni\w*|academy)\b/;
  /* headings that list prizes, where a job title beside the dates still means a job (see below) */
  const PRIZE_SEC = /^(awards?|achievements?|accomplishments?|distinctions?|honou?rs)\b/;
  /* the name of a prize is not a job title, even when it holds a word like "student" or "engineer"
     ("Inspirational Boy Student Award", "Dean's Merit Scholarship") */
  const PRIZE_NAME = /\b(award|awards|prize|prizes|scholarship|bursary|medal|trophy|honou?r roll|dean'?s list|principal'?s list|certificate of (appreciation|achievement|recognition|excellence)|winner|finalist|laureat|boursier|bourse|prix|mention honorable)\b/;
  const JOBWORD = /\b(assistant|engineer|ingenieur|developer|analyst|analyste|manager|gestionnaire|coordinat\w*|specialist|technician|technicien|officer|consultant|teacher|enseignant|nurse|infirmi\w*|clerk|representative|agent|advisor|conseiller|designer|researcher|director|directeur|lead|supervisor|superviseur|associate|accountant|comptable|programmer|architect|administrator|operator|operateur|worker|planner|planificateur|buyer|acheteur|controller|controleur|scheduler|tutor|tuteur|cashier|caissier|driver|chauffeur|server|serveur|cook|cuisinier|apprentice|apprenti|trainee|stagiaire|intern|lecturer|professor|instructor)\b/;
  const JUNIORISH = /\b(interns?|internships?|stagiaires?|stages?|co-?op|coop|students?|etudiants?|volunteer\w*|benevole\w*|apprentic\w*|apprenti\w*|alternan\w*|contrat de professionnalisation|professionnalisation|seasonal|saisonnier|work[- ]study|summer|part[- ]time|temps partiel|externship|placement|research assistant|teaching assistant|assistant de recherche|assistant d'enseignement|tutor|work-study)\b/;
  /* Wording that says the person is studying RIGHT NOW. Weaker wording, such as
     "student association" or "recent graduate", is deliberately left out: it also
     appears on the CV of someone with years of work behind them. */
  const STUDY_NOW = /\b(currently (pursuing|enrolled|studying|completing)|presently (pursuing|enrolled)|expected (graduation|completion|date)|anticipated (graduation|completion)|graduating (in )?(spring|summer|fall|winter|20\d\d)|candidate for|co-?op student|student at|etudiant(e)? (a|au|en)|en cours d'etudes|diplome prevu|graduation prevue)\b/;
  const STUDENT_CUE = /\b(currently (pursuing|enrolled|studying|completing)|presently (pursuing|enrolled)|expected (graduation|completion|date)|anticipated (graduation|completion)|graduating (in )?(spring|summer|fall|winter|20\d\d)|candidate for|etudiant(e)? (a|au|en)|student at|in progress|en cours d'etudes|diplome prevu|graduation prevue|co-?op student|student association|recent graduate|new graduate|nouveau diplome|jeune diplome)\b/;

  function cvLevel(text, now) {
    now = now || new Date();
    const raw = String(text || "");
    const lines = raw.split(/\r?\n/);
    const nowIx = now.getFullYear() * 12 + now.getMonth();
    const ft = [], junior = [], edu = [], entries = [];
    const titles = [];
    let section = "", section_head = "";
    /* What a date belongs to is named on a nearby line: a job title, a degree, a school.
       It can sit on the same line, above it, or below it, depending on how the CV is laid
       out, so look around instead of at one fixed place. This is what makes the same CV
       give the same years however it was copied or exported. */
    let nearAt = -1, nearKind = "";        /* the line near() chose, and what made it the one: used as the entry's name, and to tell a job from a prize */
    function near(i) {
      const strip = (k) => {
        if (k < 0 || k >= lines.length) return "";
        return fold(lines[k]).replace(new RegExp(RANGE_SRC, "g"), " ").replace(/\s{2,}/g, " ").trim();
      };
      const order = [i, i - 1, i - 2, i + 1, i + 2];
      nearAt = -1; nearKind = "";
      /* A job title wins over the name of the place: "Research Assistant" at a
         "University lab" is student work, not studies. */
      for (const k of order) {
        const t = strip(k);
        if (t.length >= 3 && (JOBWORD.test(t) || JUNIORISH.test(t))) { nearAt = k; nearKind = "job"; return t; }
      }
      for (const k of order) {
        const t = strip(k);
        if (t.length >= 3 && (DEGREE.test(t) || SCHOOL.test(t))) { nearAt = k; nearKind = "edu"; return t; }
      }
      for (const k of order) {
        const t = strip(k);
        if (t.length >= 3) { nearAt = k; nearKind = "plain"; return t; }
      }
      return "";
    }
    let anyDate = false;
    const why = [];
    for (let i = 0; i < lines.length; i++) {
      const line = fold(lines[i]);
      if (!line) continue;
      if (line.length <= 40 && !/\d{4}/.test(line)) {
        const head = line.replace(/[:\s]+$/, "");
        if (SEC.edu.test(head)) { section = "edu"; continue; }
        if (SEC.exp.test(head)) { section = "exp"; continue; }
        if (SEC.other.test(head)) { section = "other"; section_head = head; continue; }
      }
      const re = new RegExp(RANGE_SRC, "g");
      const pairs = [];
      let m;
      while ((m = re.exec(line))) pairs.push([m[1], m[2]]);
      if (!pairs.length) {
        const sm = new RegExp(SINCE_SRC).exec(line);
        if (sm) pairs.push([sm[1], "present"]);
      }
      for (const pair of pairs) {
        let a = parseDate(pair[0], false, now), b = parseDate(pair[1], true, now);
        if (a == null || b == null || b < a || a < 1970 * 12 || b - a > 50 * 12) continue;
        anyDate = true;
        /* "August 2022 - 2023 (1 month each)" is two months of work, not a year. */
        const eachM = /\((\d{1,2})\s*(month|months|mois|week|weeks|semaine|semaines)\s*(?:each|chacun|chaque|per year|par an|\/\s*year)\)/
          .exec(line + " " + (i + 1 < lines.length ? fold(lines[i + 1]) : ""));
        if (eachM) {
          const per = /week|semaine/.test(eachM[2]) ? Math.max(1, Math.round(+eachM[1] / 4)) : +eachM[1];
          const spanYears = Math.max(1, Math.floor(b / 12) - Math.floor(a / 12) + 1);
          b = a + per * spanYears - 1;
        }
        const titleLine = near(i);
        const ctx = titleLine + " " + line;
        const isEdu = section === "edu" || DEGREE.test(ctx) || (SCHOOL.test(ctx) && !JOBWORD.test(ctx));
        const label = (function () {
          const clean = (x) => String(x || "").replace(/[\u2013\u2014]/g, "-")
            .replace(new RegExp(RANGE_SRC, "gi"), " ").replace(/\(\s*\)/g, " ").replace(/^[\s,;:|.\-\u2022\u00b7\u25cf\u25aa*]+/, "")
            .replace(/[-|,;:]+\s*$/, "").replace(/\s{2,}/g, " ").trim();
          /* a name must say what the thing is: not a heading, not a note in brackets, not a place or a number */
          const usable = (t) => t.length >= 4 && /\p{L}{3}/u.test(t) && !/^\(/.test(t) &&
            !SEC.edu.test(fold(t)) && !SEC.exp.test(fold(t)) && !SEC.other.test(fold(t)) &&
            !/^(cgpa|gpa|moyenne)\b/i.test(t);
          /* the line the job title was read from comes first, but only when it sits on the dates'
             line or above: a line below belongs to the next entry, so a prize does not take its name */
          const tries = [];
          if (nearAt >= 0 && nearAt <= i) tries.push(nearAt);
          tries.push(i, i - 1, i - 2, i - 3);
          if (nearAt > i) tries.push(nearAt);
          tries.push(i + 1, i + 2);
          for (const k of tries) {
            if (k < 0 || k >= lines.length) continue;
            const t = clean(lines[k]);
            if (usable(t)) return t.length > 64 ? t.slice(0, 64) + "\u2026" : t;
          }
          const t = clean(lines[i]);
          return t.length > 64 ? t.slice(0, 64) + "\u2026" : t;
        })();
        const months = (lo, hi) => Math.max(0, hi - lo + 1);
        if (isEdu) { entries.push({ kind: "edu", months: months(a, b), label: label, at: i, endAgeY: Math.max(0, (nowIx - Math.min(b, nowIx)) / 12) }); edu.push([a, b]); continue; }
        /* Awards, prizes, hobbies, projects and volunteering do not count as work. The one exception
           is a prizes heading with a job title sitting right beside the dates ("Graduate Engineer
           Trainee"): in a two-column CV the reading order can carry the next job in under an
           ACHIEVEMENTS heading, and that job is real work. The title must sit on the dates' line or
           above it: a title below belongs to the next entry, so a prize does not borrow it.
           Volunteering keeps its own rule and never counts, job title or not. */
        const titleIsPrize = nearAt >= 0 && nearAt < lines.length && PRIZE_NAME.test(fold(lines[nearAt]));
        if (section === "other" && !(PRIZE_SEC.test(section_head) && nearKind === "job" && nearAt <= i && !titleIsPrize)) {
          entries.push({ kind: "other", months: months(a, b), label: label, at: i, endAgeY: Math.max(0, (nowIx - Math.min(b, nowIx)) / 12) }); continue;
        }
        if (a >= nowIx) continue;
        if (JUNIORISH.test(ctx)) { entries.push({ kind: "junior", months: months(a, Math.min(b, nowIx)), label: label, at: i, endAgeY: Math.max(0, (nowIx - Math.min(b, nowIx)) / 12) }); junior.push([a, Math.min(b, nowIx)]); continue; }
        if (a >= nowIx) continue;
        entries.push({ kind: "work", months: months(a, Math.min(b, nowIx)), label: label, at: i, endAgeY: Math.max(0, (nowIx - Math.min(b, nowIx)) / 12) });
        ft.push([a, Math.min(b, nowIx)]);
        const lv = jobLevel(ctx.replace(new RegExp(RANGE_SRC, "g"), " "), "", "");
        if (lv.src === "title") titles.push(lv.lvl);
      }
    }
    const studentCue = STUDENT_CUE.test(fold(raw)) || edu.some(([, b]) => b >= nowIx - 1);
    const fullM = union(ft), junM = union(junior);
    const junExtra = Math.max(0, union(ft.concat(junior)) - fullM);   // student months not already inside a full-time job
    let years = fullM / 12;
    const eff = years + 0.4 * (junExtra / 12);
    let conf = anyDate ? "dates" : "none";
    const stated = [];
    const sre = /(\d{1,2})\s*\+?\s*(?:years?|yrs?|ans)'?\s*(?:of\s*|d'\s*)?(?:[a-z-]+\s+){0,3}(?:experience|expertise)/g;
    const f = fold(raw);
    let sm;
    while ((sm = sre.exec(f))) if (+sm[1] <= 40) stated.push(+sm[1]);
    const claim = stated.length ? Math.max(...stated) : 0;
    if (claim && claim > eff) { years = claim; conf = "stated"; why.push("the CV states " + claim + "+ years of experience"); }
    const useYears = Math.max(years, eff);
    const titleMax = titles.length ? Math.max(...titles) : 0;
    let band;
    if (!anyDate && !claim) {
      const eduSeen = DEGREE.test(f) || SCHOOL.test(f);
      if (studentCue || JUNIORISH.test(f)) { band = 0; conf = "cues"; why.push("student or internship wording, and no dated full-time job"); }
      else if (eduSeen && f.length < 6000) { band = 0; conf = "cues"; why.push("a degree and no dated full-time job"); }
      else return { band: null, years: null, conf: "none", why: ["no dates or years of experience found on the CV"], titleMax: null, entries: entries };
    } else {
      band = useYears < 1 ? 0 : useYears < 3 ? 1 : useYears < 7 ? 2 : 3;   // years alone never make someone a director: that needs a director-level title
      if (fullM) why.push(Math.round(fullM / 12 * 10) / 10 + " years of dated full-time work");
      if (junExtra) why.push(Math.round(junExtra / 12 * 10) / 10 + " years of internships, co-ops, apprenticeships or part-time work (counted at 40%)");
      if (titleMax >= 4 && useYears >= 6 && band < 4) { band = 4; why.push("a director-level title"); }
      else if (titleMax >= 3 && useYears >= 5 && band < 3) { band = 3; why.push("a senior or manager title"); }
      if (band === 0 && !fullM && !claim) why.push("no dated full-time job");
    }
    const workingNow = ft.some(([, b]) => b >= nowIx - 2);
    const eduRunning = edu.some(([, b]) => b >= nowIx - 1);     // a degree that has not finished
    const studyCue = STUDY_NOW.test(f);
    const studyingNow = eduRunning || studyCue;
    /* Someone studying now, with no job running now, is looking for student work.
       A degree that has not finished is proof on its own; wording alone only counts
       for someone who has not already built a long career. */
    if (band !== null && band > 0 && !workingNow && (eduRunning || (studyCue && useYears < 5))) {
      band = 0;
      why.push("studying now, with no job running now: internships and entry-level jobs come first");
    } else if (band >= 2 && studentCue && useYears < 2) band = 0;
    return { band, years: Math.round(useYears * 10) / 10, conf, why, titleMax: titleMax || null, student: studentCue, studyingNow: studyingNow, workingNow: workingNow, entries: entries };
  }

  /* how well a posting of level L suits a person of band B: rows are the person, columns the posting (0 intern .. 4 director) */
  const FIT = [
    [1.00, 0.90, 0.35, 0.08, 0.00],
    [0.45, 1.00, 0.85, 0.30, 0.05],
    [0.15, 0.55, 1.00, 0.75, 0.30],
    [0.05, 0.25, 0.65, 1.00, 0.75],
    [0.00, 0.10, 0.35, 0.80, 1.00]
  ];
  const FIT_MIN = 0.35;   // a posting below this is "far from your level" and hidden by default
  function fit(band, lvl) {
    if (band == null || lvl == null) return 0.6;
    return FIT[Math.max(0, Math.min(4, band))][Math.max(0, Math.min(4, lvl))];
  }
  /* how a posting of level `lvl` sits against a person of band `band`:
     fits (comfortable), step (a level above, worth a try), below (under your level but still reasonable),
     far (well above: hidden by default) or well-below (far under your level: hidden by default) */
  function relation(band, lvl) {
    if (band == null) return "unknown";
    const f = fit(band, lvl);
    if (lvl === band || f >= 0.6) return "fits";
    if (lvl > band) return f >= FIT_MIN ? "step" : "far";
    return f >= FIT_MIN ? "below" : "well-below";
  }

  /* ------------------------------------------------------------------ field of a posting ------------------------------------------------------------------ */
  /* Rules are tried in this order and the first that matches the title wins, so the specific fields come before the broad ones. */
  const FIELDS = [
    { id: "software", label: "Software & IT", re: /\b(software|devops|sre|site reliability|full[- ]?stack|front[- ]?end|back[- ]?end|firmware|embedded|programm\w+|dba|cyber\w*|sysadmin|help ?desk|it (support|specialist|analyst|technician|manager|coordinator|administrator|director)|technical support|support engineer|information technology|technologies? de l'information|developpeu\w+|informatique|azure|linux|fortinet|incident response|privacy|technology|technical staff|sqa|(web|mobile|app|application|game|ios|android|java|javascript|python|react|node|\.net|c\+\+|golang|ruby|php|cloud|platform|api|servers?|systems?|integration|automation|etl|salesforce|sap|erp|network|security|qa|test|solutions?|infrastructure|reliability|site|ai|ml|machine learning|computer vision|nlp|robotics?|data platform|database)\s+(developer|engineer|architect|administrator|specialist|consultant|tester|programmer|lead|analyst))\b|\b(developer|engineer)\b[^,]*\b(software|web|mobile|cloud|platform)\b/ },
    { id: "data", label: "Data & analytics", re: /\b(data|donnees|analytics|business intelligence|bi|statistic\w*|quantitative|decision scientist|insights?|machine learning|applied scientist|research scientist|ai researcher)\s*(scientists?|analysts?|engineers?|analytics|science|architects?|stewards?|governance|specialists?|developers?|managers?|leads?|analyste\w*|ingenieur\w*)?\b/ },
    { id: "product", label: "Product, project & strategy", re: /\b(product (management|managers?|owners?|operations|analyst|designer|leads?|directors?)|project (managers?|coordinators?|officers?|leads?|controls?|engineers?|administrators?|analysts?)|program (managers?|coordinators?|directors?)|scrum|agile|business analysts?|management consult\w+|consultants?|consulting|strateg\w+|transformation|pmo|chief of staff|head of product|vp,? product|chief product|business operations|biz ?ops|chefs? de projets?|gestionnaires? de projets?|charge(\(e\)|e|es|s)? de projets?)\b/ },
    { id: "hospitality", label: "Hospitality, retail & food", re: /\b(cooks?|chefs?|sous[- ]chef|dishwasher|bartender|barista|servers?(?!\s+(engineer|developer|administrator|admin|side|infrastructure|software|support|operations|technician|architect|hardware|room))|serveu\w+|waiters?|waitress\w*|hosts?|hostess|kitchen|cuisin\w+|restaurant\w*|hotel\w*|housekeep\w*|front desk|guest services?|concierge|cashiers?|caissi\w+|retail|store (associate|clerk|manager|team|supervisor)|sales associate|merchandis\w+|baker\w*|butcher|food (service|server|runner|prep|handler|and beverage|&)|fast food|banquet|catering|stocker|crew member|team member|customer service associate|sommelier|magasin\w*|(au|de) detail|boucher\w*|commis|key lead|stock associate|stockroom|brand ambassador|vendeu\w+|outlets?)\b/ },
    { id: "health", label: "Healthcare & life sciences", re: /\b(nurses?|nursing|infirmi\w+|clinical|clinician|physician|doctor|medical|medecin|pharmac\w+|dental|dentist|hygienist|therapist|therapeute|physio\w*|paramedic\w*|caregiver|personal support worker|psw|health ?care|sante|patient|veterinar\w+|dietit\w+|nutritionist|radiolog\w+|sonograph\w+|laborator\w+|phlebotom\w+|biolog\w+|biotech\w*|biomedical|life sciences?|psycholog\w+|counsell?ing|mental health|care aide|health care aide|orderly|midwife|optometr\w+|audiolog\w+|speech|hospital|clinic)\b/ },
    { id: "education", label: "Education & community", re: /\b(teachers?|teaching|instructors?|professors?|lecturers?|tutors?|educat\w+|enseign\w+|student (success|services?|affairs|advis\w+)|curriculum|early childhood|child ?care|daycare|youth (worker|leader|counsell?or)|social workers?|community (worker|outreach|support|engagement)|case ?workers?|librar\w+|school|camp counsell?or|program (facilitator|instructor)|settlement|outreach)\b/ },
    { id: "legal", label: "Legal, government & policy", re: /\b(legal|lawyers?|attorney|counsel|paralegal|juridique|avocat\w*|notary|notaire|policy|regulatory|government|public affairs|compliance|litigation|immigration)\b/ },
    { id: "finance", label: "Finance & accounting", re: /\b(accountants?|accounting|comptab\w+|bookkeep\w+|finance|financial|financier\w*|auditors?|audit|tax|taxation|controllers?|treasury|payroll|banking|banker|teller|credit|loans?|mortgage|underwriter|actuar\w+|investment|portfolio|wealth|insurance|assurance (vie|maladie|collective|habitation|auto)|claims|fund|equity|trader|trading|accounts (payable|receivable)|fp&a|fpa|lending|fraud|fraude|risk|risque|registered plans|underwrit\w+|reconciliations?|financement|disputes?|new accounts|asset management)\b/ },
    { id: "hr", label: "People & HR", re: /\b(human resources?|hr|ressources humaines|recruit\w+|talent|people (partner|operations|ops|experience|business|and culture)|compensation|benefits (administrator|specialist)|employee (experience|relations)|onboarding|sourcer|acquisition de talents|workforce|hcm|rh)\b/ },
    { id: "creative", label: "Design, media & creative", re: /\b(designers?|design|ux|ui|graphic\w*|creative|illustrat\w+|animat\w+|videograph\w+|video|editors?|photograph\w+|producers?|writers?|copywrit\w+|journalist\w*|content (creator|writer|strategist|producer)|art director|motion|multimedia|artist|3d)\b/ },
    { id: "marketing", label: "Marketing, sales & communications", re: /\b(marketing|marketers?|lead generation|brand|seo|sem|social media|communications?|pr|public relations|sales|vente\w*|account (executive|manager)|business development|bdr|sdr|growth|campaigns?|demand gen\w*|lifecycle|partnerships?|e-?commerce|customer acquisition|affiliate|advertis\w+|media buyer|category manager|revenue|solutions? consultant|pre-?sales|activation|paid (search|social)|media (planner|planning|buying)|events?|media|account (director|supervisor)|renewals?|partner success|developpement des affaires)\b/ },
    { id: "ops", label: "Operations, supply chain & logistics", re: /\b(supply chain|chaine d'approvisionnement|logistic\w*|operations?|operationnel|warehouse\w*|entrepot|inventory|inventaire|procurement|achats?|buyers?|planners?|planification|dispatch\w*|fleet|shipping|receiving|distribution|transport\w*|freight|courier|driver|chauffeur|delivery|material (handler|coordinator)|forklift|picker|packer|expedit\w+|customs|continuous improvement|amelioration continue|lean|six sigma|quality (assurance|control|inspector|analyst|coordinator|manager|specialist)|qualite|production (planner|supervisor|manager|coordinator|department|lead)|schedulers?|safety|ehs|hse)\b/ },
    { id: "engineering", label: "Engineering", re: /\b(engineers?|engineering|ingenieur\w*|ingenierie|mechanical|mecanique\w*|electrique\w*|electrical|electronic\w*|civil|industrial|chemical|aerospace|structural|process|manufacturing|geotechnical|mechatronic\w*|hvac|cad|drafter|drafting|technologist|technologue|reliability|metallurg\w+|materials|petroleum|mining|geolog\w+|surveyor)\b/ },
    { id: "science", label: "Science & research", re: /\b(research(er)?|scientists?|chercheu\w+|postdoc\w*|r&d|chemist\w*|physicist|lab (technician|assistant|analyst)|analytical|microbiolog\w+|geneticist|ecolog\w+|field (technician|assistant|researcher))\b/ },
    { id: "trades", label: "Skilled trades & manufacturing", re: /\b(electricians?|plumbers?|welders?|machinists?|millwrights?|mechanics?|mecanicien\w*|technicians?|techniciens?|operators?|operateur\w*|assemblers?|carpenters?|installers?|labou?rers?|apprentice\w*|tradesperson|journeyman|pipefitter|ironworker|painter|mason|roofer|tool and die|cnc|maintenance|production (worker|operator|associate)|fabricat\w+|boilermaker|crane|heavy equipment|diesel)\b/ },
    { id: "construction", label: "Construction, property & energy", re: /\b(construction|site (supervisor|manager|coordinator)|estimator|real estate|property|immobilier|leasing|facilities|facility|building|energy|energie|utilities|oil|gas|solar|wind|renewable|environment\w*|sustainab\w+|fire protection|architect\w*|landscap\w+|agricultur\w+|forestry|geomatics|urban)\b/ },
    { id: "admin", label: "Customer service & admin", re: /\b(customer (service|support|care|experience|success)|service a la clientele|client (service|support|care)|call cent(er|re)|receptionist|administrative|administratif|admin|office (manager|assistant|clerk|administrator)|assistants?|clerk|secretary|secretaire|data entry|coordinators?|coordonna\w+|agent|representative|representant|executive assistant|support specialist|front office|adjoint\w*|accueil)\b/ }
  ];
  const OTHER = { id: "other", label: "Other" };
  function fieldOf(title) {
    const T = fold(title);
    for (const f of FIELDS) if (f.re.test(T)) return { id: f.id, label: f.label };
    if (/\bdevelopers?\b/.test(T) && !/\b(business|property|real estate|curriculum|talent|land|product)\s+developers?\b/.test(T)) return { id: "software", label: "Software & IT" };
    return OTHER;
  }
  const FIELD_LIST = FIELDS.map(f => ({ id: f.id, label: f.label })).concat([OTHER]);


  /* ------------------------------------------------------------------ language and eligibility wording of a posting ------------------------------------------------------------------ */
  /* The collector works these out once for every posting (so the page does not need the full text to show them) and the page works them out
     again only for a text the person pastes. */
  const plain = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");
  const FR_W = /\b(le|la|les|des|du|une|pour|avec|vous|nous|votre|notre|dans|sur|est|sont|aux|chez|et)\b/g;
  const EN_W = /\b(the|and|for|with|you|your|our|will|are|to|of|in|is|we|as|an)\b/g;
  const FR_T = /\b(stage|stagiaire|etudiant|etudiante|ingenieur|ingenieure|responsable|conseiller|conseillere|adjoint|adjointe|prepose|preposee|technicien|technicienne|charge|chargee|gestionnaire|directeur|directrice|coordonnateur|coordonnatrice|commis|caissier|caissiere|vendeur|vendeuse|infirmier|infirmiere|analyste|agent|agente|developpeur|developpeuse|hiver|ete|automne)\b/;
  /* "en" English, "fr" French, "bi" written in both languages */
  function langOf(title, desc) {
    const body = plain(String(desc || "").slice(0, 900));
    if (body.length > 200) {
      const fr = (body.match(FR_W) || []).length, en = (body.match(EN_W) || []).length;
      if (fr >= 8 && en >= 8) return "bi";
      return fr > en * 1.3 ? "fr" : "en";
    }
    const t = plain(title);
    if (/ \/ | \| |\*\*\*|\(fr\/en\)|\bbilingual\b|\bbilingue\b/.test(t) && FR_T.test(t) && /\b(intern|engineer|manager|student|specialist|analyst|coordinator|assistant|officer|advisor|developer|nurse|technician|clerk)\b/.test(t)) return "bi";
    return FR_T.test(t) || (t.match(FR_W) || []).length >= 2 ? "fr" : "en";
  }
  /* things to check yourself, found in the text: [colour code, message]. Never part of the score. */
  /* I-11: a licence or certificate the posting says you must have. A posting is read sentence by
     sentence; a sentence that says "required", "mandatory", "must hold" near a licence word names a
     must-have. A driver's licence is reported apart, because most people have one and few write it
     on a CV, so it is a note and never a reason to drop a job. */
  const MUST = /\b(required|require[sd]?|mandatory|must (have|hold|possess|be)|is a must|necessary|obligatoire|exige|requis|obligatoirement|doit (detenir|posseder|etre))\b/;
  const LICENCE = /\b(licen[cs]e|licence|permis|certificat\w*|certification|accreditation|designation|ticket|card|carte|red seal|sceau rouge|p\.? ?eng|member of the order|membre de l'ordre|oiq|peo|cpa|rn\b|registered nurse|journeyman|compagnon)\b/;
  const DRIVING = /\b(driver'?s? licen[cs]e|permis de conduire|class [1-5]\b|classe [1-5]\b|\bdz\b|\baz\b|clean driving record|dossier de conduite)\b/;
  function mustHaves(desc) {
    const out = [];
    const txt = String(desc || "");
    if (!txt) return out;
    for (const raw of txt.split(/(?<=[.;!?\n])\s+/)) {
      const t = plain(raw);
      if (t.length < 12 || t.length > 320) continue;
      if (!MUST.test(t) || !LICENCE.test(t)) continue;
      const driving = DRIVING.test(t);
      const name = raw.replace(/\s+/g, " ").trim();
      /* the thing itself: a named certificate reads as capitalised words ending on the licence word
         ("Water Treatment Operator Certificate"), or as a known short form (P.Eng, CPA, PMP). */
      let what = null;
      const m = /((?:[A-Z][\w&().'-]*\s+){0,4}(?:Certificate|Certification|Licen[cs]e|Permit|Designation|Card|Ticket|Red Seal))\b/.exec(name)
        || /\b(P\.? ?Eng|OIQ|PEO|CPA|CFA|PMP|CAPM|CSCP|CPIM|RSE|Red Seal|WHMIS|SIMDUT|ASP Construction|CSTS|H2S Alive|TDG)\b/i.exec(name);
      if (m) what = m[1].replace(/[)\](,;]+/g, " ").replace(/\s+/g, " ").trim();
      /* "License" on its own names nothing we could look for on a CV: keep it as a note, not a block */
      if (what && !/\s/.test(what) && !/^(p\.? ?eng|oiq|peo|cpa|cfa|pmp|capm|cscp|cpim|whmis|simdut|csts|tdg)$/i.test(what)) what = null;
      out.push({ driving: driving, what: what, text: name.length > 150 ? name.slice(0, 150) + "\u2026" : name });
      if (out.length >= 6) break;
    }
    /* The same requirement is often written twice in one posting ("current TDG and IATA
       certification", then "TDG Certification required"). Keep the fullest name of each thing, so
       the card does not flag one licence three times. */
    const keep = [];
    for (const m of out) {
      const k = plain(m.what || m.text);
      let skip = false;
      for (let i = 0; i < keep.length; i++) {
        const o = plain(keep[i].what || keep[i].text);
        if (!m.what || !keep[i].what) continue;
        if (o.indexOf(k) >= 0) { skip = true; break; }
        if (k.indexOf(o) >= 0) { keep[i] = m; skip = true; break; }
      }
      if (!skip) keep.push(m);
    }
    return keep.slice(0, 3);
  }

  function descFlags(desc) {
    const t = plain(desc), flags = [];
    if (!t) return flags;
    const add = (c, msg) => flags.push([c, msg]);
    const sec = t.match(/security clearance|cote de securite|habilitation|controlled goods|marchandises controlees|\bitar\b|criminal (record|background)|verification des antecedents|casier judiciaire|vulnerable sector|secteur vulnerable/);
    if (sec) add("b", "Security / background check in text (" + sec[0] + "): verify");
    const cit = t.match(/canadian citizen|citoyen canadien|citoyennete canadienne|permanent resident|resident permanent|eligible to work in canada|authori[sz]ed to work in canada|autorise a travailler|permis de travail|work permit|legally entitled/);
    if (cit) add("w", "Work eligibility wording in text (" + cit[0] + "): verify");
    if (/english only|anglais seulement/.test(t)) add("g", "English only");
    else if (/bilingual|bilingue|francais et anglais|french and english|fluent in (both|french)|courant en francais|maitrise du francais|francais.{0,20}requis|french.{0,20}required/.test(t)) add("w", "French/English requirement in text: check your level");
    if (/master|maitrise|graduate student|cycles? superieurs?/.test(t)) add("n", "Mentions master's / graduate level");
    else if (/bachelor|baccalaureat|undergraduate|1er cycle|premier cycle/.test(t)) add("w", "Written for bachelor's level: check that your degree fits");
    if (/new grad|recent graduate|nouveau diplome|jeune diplome/.test(t) && !/student|etudiant/.test(t)) add("w", "Aimed at new graduates, not current students");
    const len = t.match(/(\d{1,2})[- ]?(?:month|mois)/);
    if (len) add("", "Length: " + len[1] + " months: check that it fits your dates");
    return flags;
  }


  /* ---------- education, for the score (phase 5) ----------
     One scale, 0 to 6, the same one Job Bank's open data uses:
     0 not said · 1 no degree · 2 high school · 3 college, CEGEP or trade · 4 bachelor · 5 master · 6 doctorate. */
  const EDU_RE = [
    [6, /\b(ph\.? ?d|doctorate|doctorat|post-?doc)\b/],
    /* "maîtrise" in French usually means being good at something ("maîtrise du français"), not a
       master's degree. Only "maîtrise en/ès <subject>" and "diplôme de maîtrise" are the degree:
       of 575 postings using the word, 539 meant proficiency. */
    [5, /\b(master'?s?|m\.? ?sc|m\.? ?eng|meng|msc|mba|m\.? ?a\b|graduate degree|deuxieme cycle|doctor of medicine|\bmd\b|pharm\.? ?d|jd\b|llm)\b|\bmaitrise\s+(en|es)\b|\bdiplome de maitrise\b/],
    [4, /\b(bachelor'?s?|baccalaureat|undergraduate degree|b\.? ?sc|b\.? ?eng|beng|bsc|b\.? ?a\b|b\.? ?comm?|bba|bcom|four-?year degree|university degree|diplome universitaire|premier cycle|licence universitaire)\b/],
    [3, /\b(college|cegep|dec\b|dep\b|aec\b|diploma|diplome d'etudes collegiales|technical diploma|trade (school|certificate|qualification)|apprenticeship certificate|red seal|associate degree|two-?year (program|diploma)|polytechnic)\b/],
    [2, /\b(high school|secondary school|diplome d'etudes secondaires|\bdes\b|\bged\b|secondary (v|5))\b/],
    [1, /\b(no (formal )?(degree|diploma|education) (is )?(required|needed)|aucun diplome|no minimum education|education: none)\b/]
  ];
  /* a line that names a degree itself, not a grade average or a list of courses beside it */
  const DEGREE_LINE = /\b(bachelor|b\.? ?sc|b\.? ?eng|b\.? ?a\b|b\.? ?comm?|beng|bsc|bba|bcom|master|m\.? ?sc|m\.? ?eng|m\.? ?a\b|meng|msc|mba|ph\.? ?d|doctorat|diploma|diplome|degree|baccalaureat|maitrise|licence|dec (en|in)|deec|aec\b|dep\b|major in|minor in)\b/;

  /* the degree a posting asks for: the highest level it names */
  function eduAsked(text) {
    const t = fold(text || "");
    if (!t) return 0;
    /* A posting often names more than one ("Bachelor's required, a Master's or PhD an asset").
       What it asks for is the lowest bar it names, not the highest: the higher ones are wishes.
       Reading the highest turned 427 postings into doctorate jobs. */
    let low = 0;
    for (const [lvl, re] of EDU_RE) if (re.test(t)) low = low ? Math.min(low, lvl) : lvl;
    return low;
  }
  /* the degrees on a CV: the highest one, and the fields they are in. A degree in progress counts:
     the person will have it. Only the education part of the CV is read, so a posting's words quoted
     in a job description do not become the person's degree. */
  /* the lines of a CV that are about what the person studied: the education section, and any line
     that names a degree. Used so that "industrial engineering" written in a job description does not
     turn into an industrial engineering degree. */
  function cvEduText(text) {
    const out = [];
    let section = "";
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = fold(raw);
      if (!line) continue;
      if (line.length <= 40 && !/\d{4}/.test(line)) {
        const head = line.replace(/[:\s]+$/, "");
        if (SEC.edu.test(head)) { section = "edu"; continue; }
        if (SEC.exp.test(head) || SEC.other.test(head)) { section = ""; continue; }
      }
      if (section === "edu" || DEGREE_LINE.test(line)) out.push(raw);
    }
    return out.join("\n");
  }

  function cvEdu(text) {
    const lines = String(text || "").split(/\r?\n/);
    let section = "", best = 0;
    const fields = new Set();
    for (const raw of lines) {
      const line = fold(raw);
      if (!line) continue;
      if (line.length <= 40 && !/\d{4}/.test(line)) {
        const head = line.replace(/[:\s]+$/, "");
        if (SEC.edu.test(head)) { section = "edu"; continue; }
        if (SEC.exp.test(head) || SEC.other.test(head)) { section = ""; continue; }
      }
      const inEdu = section === "edu" || DEGREE.test(line);
      if (!inEdu) continue;
      if (/\b(high school|secondary school|ecole secondaire)\b/.test(line) && !DEGREE.test(line.replace(/\bdiplome d'etudes secondaires\b/, ""))) {
        best = Math.max(best, 2); continue;
      }
      for (const [lvl, re] of EDU_RE) if (re.test(line)) { best = Math.max(best, lvl); break; }
      /* only the degree's own line names the subject. A list of courses or a grade average beside it
         would otherwise add a field the person did not study. */
      if (!DEGREE_LINE.test(line)) continue;
      const f = fieldOf(line);
      if (f.id !== "other") fields.add(f.id);
    }
    return { level: best, fields: [...fields] };
  }
  /* is the degree in the same area as the job? "other" on either side means we cannot tell, and we
     do not punish what we cannot tell. */
  function eduRelated(jobFieldId, cvFields) {
    if (!jobFieldId || jobFieldId === "other") return null;
    if (!cvFields || !cvFields.length) return null;
    if (cvFields.indexOf(jobFieldId) >= 0) return true;
    /* neighbours: studying one of these is a fair preparation for the other */
    const NEAR = { engineering: ["science", "trades", "ops", "construction"], science: ["engineering", "health"],
      ops: ["engineering", "finance", "admin", "trades"], trades: ["engineering", "construction", "ops"],
      construction: ["engineering", "trades"], finance: ["ops", "admin", "legal"], data: ["science", "software", "finance"],
      software: ["data", "engineering"], admin: ["ops", "finance", "hr"], hr: ["admin", "legal"],
      marketing: ["creative", "admin"], creative: ["marketing"], health: ["science"], legal: ["finance", "hr"],
      education: ["admin"], product: ["software", "data", "ops"] };
    const near = NEAR[jobFieldId] || [];
    return cvFields.some((f) => near.indexOf(f) >= 0);
  }
  /* the certificates and licences a keyword names */
  const CRED_RE = /\b(certifi|certificat|licence|license|permis|accredit|designation|red seal|sceau rouge|p\.? ?eng|ing\b|cpa\b|cfa\b|pmp\b|capm\b|cscp\b|cpim\b|cltd\b|six sigma|green belt|black belt|lean belt|itil|cissp|comptia|ccna|aws certified|azure certified|whmis|simdut|first aid|secourisme|cpr\b|rcr\b|forklift|chariot elevateur|class [1-5] (licence|license|driver)|driver'?s? licence|driver'?s? license|permis de conduire|asp construction|carte de competence|trade qualification|journeyman|compagnon|nccer|aspe|cpht|rcic|csts|h2s alive|tdg\b|transportation of dangerous goods)\b/i;
  function isCredential(name) { return CRED_RE.test(fold(name || "")); }

  return { fold, LEVELS, BANDS, FIT, FIT_MIN, FIELD_LIST, jobLevel, factsLevel, cvLevel, fit, relation, fieldOf, isStudentTitle, yearsAsked, langOf, descFlags, mustHaves, eduAsked, cvEduText, cvEdu, eduRelated, isCredential };
});
