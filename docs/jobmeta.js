/* jobmeta.js - what level a posting is written for, what level a CV has reached, and which field a posting belongs to.
 *
 * Plain functions, no page needed. The website (index.html) and the collector (scripts/collect.mjs) both load this file,
 * and test/jobmeta.test.mjs checks it.
 *
 *   JobMeta.jobLevel(title, desc, type)  -> { lvl: 0..4, src, why }
 *   JobMeta.cvLevel(cvText, now)         -> { band: 0..4 | null, years, conf, why }
 *   JobMeta.fit(cvBand, jobLvl)          -> 0..1   (how well a posting of that level suits a person of that band)
 *   JobMeta.fieldOf(title)               -> { id, label }
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

  /* ------------------------------------------------------------------ level of a person ------------------------------------------------------------------ */

  const MON = "(?:jan\\w*|feb\\w*|fev\\w*|mar\\w*|apr\\w*|avr\\w*|may|mai|jun\\w*|juin|jul\\w*|juil\\w*|aug\\w*|aou\\w*|sep\\w*|oct\\w*|nov\\w*|dec\\w*)\\.?";
  const D = "(?:" + MON + "[\\s,.'-]*(?:19|20)\\d{2}|\\d{1,2}\\/(?:19|20)\\d{2}|(?:19|20)\\d{2})";
  const PRESENT = "present|current|currently|now|today|ongoing|en cours|aujourd'hui|presentement|maintenant|a ce jour|to date";
  const RANGE_SRC = "(" + D + ")\\s*(?:-|to|until|through|au|a)\\s*(" + D + "|" + PRESENT + ")";
  const MONTHS = { jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, avr: 4, may: 5, mai: 5, jun: 6, juin: 6, jul: 7, juil: 7, aug: 8, aou: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  function parseDate(s, isEnd, now) {
    s = s.trim();
    if (new RegExp("^(" + PRESENT + ")$").test(s)) return now.getFullYear() * 12 + now.getMonth();
    const y = /((?:19|20)\d{2})/.exec(s);
    if (!y) return null;
    const year = +y[1];
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
    other: /^(projects?|projets?|volunteer\w*|benevolat|certifications?|licen[sc]es?|awards?|honou?rs|activities|extracurricular\w*|leadership|publications?|skills?|competences|languages?|langues|interests|references|courses|coursework|training)\b/
  };
  const DEGREE = /\b(bachelor|b\.? ?sc|b\.? ?eng|b\.? ?a\b|b\.? ?comm?|beng|bsc|master|m\.? ?sc|m\.? ?eng|m\.? ?a\b|meng|msc|mba|ph\.? ?d|doctorat|diploma|diplome|degree|licence|baccalaureat|maitrise|gpa|coursework|dec (en|in)|deec|aec\b|major in|minor in|honours)\b/;
  const SCHOOL = /\b(university|universite|college|cegep|ecole|school|institute|polytechni\w*|academy)\b/;
  const JOBWORD = /\b(assistant|engineer|ingenieur|developer|analyst|analyste|manager|gestionnaire|coordinat\w*|specialist|technician|technicien|officer|consultant|teacher|enseignant|nurse|infirmi\w*|clerk|representative|agent|advisor|conseiller|designer|researcher|director|directeur|lead|supervisor|superviseur|associate|accountant|comptable|programmer|architect|administrator|operator|worker|lecturer|professor|instructor)\b/;
  const JUNIORISH = /\b(interns?|internships?|stagiaires?|stages?|co-?op|coop|students?|etudiants?|volunteer\w*|benevole\w*|apprentic\w*|summer|part[- ]time|temps partiel|externship|placement|research assistant|teaching assistant|assistant de recherche|assistant d'enseignement|tutor|work-study)\b/;
  const STUDENT_CUE = /\b(currently (pursuing|enrolled|studying|completing)|presently (pursuing|enrolled)|expected (graduation|completion|date)|anticipated (graduation|completion)|graduating (in )?(spring|summer|fall|winter|20\d\d)|candidate for|etudiant(e)? (a|au|en)|student at|in progress|en cours d'etudes|diplome prevu|graduation prevue|co-?op student|student association|recent graduate|new graduate|nouveau diplome|jeune diplome)\b/;

  function cvLevel(text, now) {
    now = now || new Date();
    const raw = String(text || "");
    const lines = raw.split(/\r?\n/);
    const nowIx = now.getFullYear() * 12 + now.getMonth();
    const ft = [], junior = [], edu = [];
    const titles = [];
    let section = "";
    let anyDate = false;
    const why = [];
    for (let i = 0; i < lines.length; i++) {
      const line = fold(lines[i]);
      if (!line) continue;
      if (line.length <= 40 && !/\d{4}/.test(line)) {
        const head = line.replace(/[:\s]+$/, "");
        if (SEC.edu.test(head)) { section = "edu"; continue; }
        if (SEC.exp.test(head)) { section = "exp"; continue; }
        if (SEC.other.test(head)) { section = "other"; continue; }
      }
      const re = new RegExp(RANGE_SRC, "g");
      let m;
      while ((m = re.exec(line))) {
        const a = parseDate(m[1], false, now), b = parseDate(m[2], true, now);
        if (a == null || b == null || b < a || a < 1970 * 12 || b - a > 50 * 12) continue;
        anyDate = true;
        const prev = i > 0 ? fold(lines[i - 1]) : "";
        const ctx = line.length < 50 ? prev + " " + line : line;
        const isEdu = section === "edu" || DEGREE.test(ctx) || (SCHOOL.test(ctx) && !JOBWORD.test(ctx));
        if (isEdu) { edu.push([a, b]); continue; }
        if (section === "other") continue;
        if (a >= nowIx) continue;
        if (JUNIORISH.test(ctx)) { junior.push([a, Math.min(b, nowIx)]); continue; }
        if (a >= nowIx) continue;
        ft.push([a, Math.min(b, nowIx)]);
        const lv = jobLevel(ctx.replace(new RegExp(RANGE_SRC, "g"), " "), "", "");
        if (lv.src === "title") titles.push(lv.lvl);
      }
    }
    const studentCue = STUDENT_CUE.test(fold(raw)) || edu.some(([, b]) => b >= nowIx - 1);
    const fullM = union(ft), junM = union(junior);
    let years = fullM / 12;
    const eff = years + 0.4 * (junM / 12);
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
      else return { band: null, years: null, conf: "none", why: ["no dates or years of experience found on the CV"], titleMax: null };
    } else {
      band = useYears < 1 ? 0 : useYears < 3 ? 1 : useYears < 7 ? 2 : 3;   // years alone never make someone a director: that needs a director-level title
      if (fullM) why.push(Math.round(fullM / 12 * 10) / 10 + " years of dated full-time work");
      if (junM) why.push(Math.round(junM / 12 * 10) / 10 + " years of internships, co-ops or part-time work (counted at 40%)");
      if (titleMax >= 4 && useYears >= 6 && band < 4) { band = 4; why.push("a director-level title"); }
      else if (titleMax >= 3 && useYears >= 5 && band < 3) { band = 3; why.push("a senior or manager title"); }
      if (band === 0 && !fullM && !claim) why.push("no dated full-time job");
    }
    if (band >= 2 && studentCue && useYears < 2) band = 0;
    return { band, years: Math.round(useYears * 10) / 10, conf, why, titleMax: titleMax || null, student: studentCue };
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

  return { fold, LEVELS, BANDS, FIT, FIT_MIN, FIELD_LIST, jobLevel, cvLevel, fit, relation, fieldOf, isStudentTitle, yearsAsked };
});
