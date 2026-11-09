/* describe.js - "Describe the job you want": a sentence, in English or French, turned into the filters the list already has.
 *
 * This is a rule reader, not a language model. It looks for a fixed set of phrases (type of job, place, level, language, posted when, eligibility
 * wording, minimum score, skills after "with" / "using", words to leave out). Whatever is left over is read as the role words. It runs in the
 * browser, sends nothing anywhere, and always shows what it understood as chips that can be taken away one by one. Two rules keep it honest:
 *   - It only sets a filter the list can actually check. The things a posting rarely states (work permit, term dates, degree, hours per week)
 *     become notes: "not filtered, check each posting". Work permit status is never assumed.
 *   - A role word is matched against the title of the posting, in English and French, with a small list of equivalent words (engineer, ingenieur,
 *     genie; supply chain, chaine d'approvisionnement). The chip says which words it also accepts.
 *
 * Describe.parse(text, ctx) -> { text, tab, tabAlso, loc, locLabel, city, lvl, lg, el, w, min, sort, roles, not, skills, notes, chips }
 *   ctx: { hasCv: boolean, findSkills: (text) => [names] }  (both optional)
 * Describe.compile(text)            -> a role term ready to match
 * Describe.titleOk(roles, not, key) -> does a title (as Describe.titleKey gives it) pass the role words and the words to leave out
 * Describe.alsoAccepts(text)        -> the other words a role term accepts, for the chip's tooltip
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Describe = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MAX = 400;

  /* lowercase, accents removed, apostrophes and dashes read as spaces: "Chaîne d'approvisionnement" and "chaine d approvisionnement" are the same */
  function fold(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/[’‘`]/g, "'").normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  const titleKey = (t) => " " + fold(t).replace(/['\-–—/]/g, " ").replace(/[^a-z0-9+#.& ]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /* ---------------------------------------------------------------- words that mean the same ---------------------------------------------------------------- */
  /* each row: words (or phrases) a title may use for one idea, English and French. A role word in a sentence is replaced by its whole row. */
  const SYN = [
    ["engineer", "engineering", "ingenieur", "ingenieure", "ingenierie", "genie"],
    ["quality", "qualite", "qa"],
    ["supply chain", "chaine d approvisionnement", "chaine approvisionnement", "approvisionnement", "logisti"],
    ["continuous improvement", "amelioration continue", "lean", "six sigma", "kaizen"],
    ["operations", "operation", "operationnel", "operationnelle"],
    ["industrial", "industriel", "industrielle"],
    ["mechanical", "mecanique"],
    ["electrical", "electrique"],
    ["manufacturing", "manufacture", "fabrication"],
    ["maintenance", "entretien"],
    ["data", "donnees"],
    ["analyst", "analyste"],
    ["manager", "gestionnaire", "responsable"],
    ["technician", "technicien", "technicienne", "technologist", "technologue"],
    ["developer", "developpeur", "developpeuse", "programmer"],
    ["software", "logiciel"],
    ["accounting", "accountant", "comptable", "comptabilite"],
    ["human resources", "ressources humaines", "hr", "rh"],
    ["customer service", "service a la clientele", "support client"],
    ["research", "recherche"],
    ["project", "projet"],
    ["planning", "planner", "planification", "planificateur"],
    ["warehouse", "entrepot"],
    ["health and safety", "sante et securite", "hse", "ehs"],
    ["process", "procede"],
    ["design", "designer", "conception"],
    ["assistant", "adjoint", "adjointe"],
    ["coordinator", "coordonnateur", "coordonnatrice", "coordinateur", "coordinatrice"],
    ["specialist", "specialiste"],
    ["environment", "environnement"],
    ["marketing", "marketeur"],
    ["finance", "financier", "financiere"],
    ["sales", "vente", "ventes"],
    ["biomedical", "biomedicale"],
    ["civil", "civile"],
    ["chemical", "chimique"],
    ["production", "fabrication"],
    ["procurement", "achats", "acheteur", "buyer"]
  ];
  /* the nouns a role usually ends with: "industrial, mechanical or quality engineering" shares its last noun */
  const HEADS = new Set(["engineer", "analyst", "manager", "technician", "specialist", "coordinator", "assistant", "developer", "designer", "planner", "scientist", "consultant", "officer", "advisor", "adviser", "buyer", "clerk", "supervisor", "administrator", "programmer", "inspector", "estimator", "drafter", "representative", "agent"]);
  const IS_HEAD = new Set(HEADS);
  for (const row of SYN) if (HEADS.has(row[0])) for (const w of row) IS_HEAD.add(w);
  ["engineering", "genie", "ingenierie", "interns"].forEach((w) => w !== "interns" && IS_HEAD.add(w));

  const STOP = new Set(("i im i'm am a an the and or of to in at on for with without near around by from into about as is are be been can could would should will want wants wanted need needs " +
    "looking look find finding show me my some any all job jobs role roles position positions opening openings opportunity opportunities work working " +
    "that who which also plus please ok okay it its this these those there here up out over under more most very really just only like get have has " +
    "posted posting postings published within ago focus " +
    "canada canadian anywhere place area region city location nearby " +
    "je j' cherche recherche un une des publie publies affiche affichee de du d le la les l' au aux a en dans pour sur et ou avec sans pres autour emploi emplois poste postes travail " +
    "offre offres opportunite opportunites mon ma mes ce cette ces qui que quoi ici").split(/\s+/).filter(Boolean));

  /* ---------------------------------------------------------------- places ---------------------------------------------------------------- */
  const MTL = "montreal|mtl|greater montreal|grand montreal|longueuil|brossard|laval|dorval|saint laurent|st laurent|sainte anne de bellevue|west island|ile de montreal|south shore|rive sud|pointe claire|lachine|verdun|vaudreuil|boucherville|saint hubert|st hubert|terrebonne|mirabel|kirkland|westmount|anjou|saint bruno|candiac|la prairie|beaconsfield|pierrefonds|dollard|lasalle|ahuntsic|mont royal|saint eustache|repentigny|blainville";
  const PROVINCES = [
    ["QC", "Quebec", "quebec|province of quebec"], ["ON", "Ontario", "ontario"], ["BC", "British Columbia", "british columbia|colombie britannique"],
    ["AB", "Alberta", "alberta"], ["MB", "Manitoba", "manitoba"], ["SK", "Saskatchewan", "saskatchewan"], ["NS", "Nova Scotia", "nova scotia|nouvelle ecosse"],
    ["NB", "New Brunswick", "new brunswick|nouveau brunswick"], ["NL", "Newfoundland & Labrador", "newfoundland|terre neuve"], ["PE", "Prince Edward Island", "prince edward island|pei|ile du prince edouard"],
    ["YT", "Yukon", "yukon"], ["NT", "Northwest Territories", "northwest territories"], ["NU", "Nunavut", "nunavut"]
  ];
  /* a city is not a filter of its own: it sets the province and goes into the text search */
  const CITIES = [
    ["Toronto", "ON"], ["Ottawa", "ON"], ["Mississauga", "ON"], ["Hamilton", "ON"], ["Kitchener", "ON"], ["Waterloo", "ON"], ["Guelph", "ON"], ["Brampton", "ON"], ["Markham", "ON"], ["Oakville", "ON"], ["Windsor", "ON"],
    ["Vancouver", "BC"], ["Victoria", "BC"], ["Burnaby", "BC"], ["Calgary", "AB"], ["Edmonton", "AB"], ["Winnipeg", "MB"], ["Saskatoon", "SK"], ["Regina", "SK"],
    ["Halifax", "NS"], ["Moncton", "NB"], ["Fredericton", "NB"], ["Gatineau", "QC"], ["Sherbrooke", "QC"], ["Saguenay", "QC"], ["Trois-Rivieres", "QC"], ["Levis", "QC"], ["Quebec City", "QC", "quebec city|ville de quebec"]
  ];
  const REMOTE_LOC = "Remote – Canada";

  /* ---------------------------------------------------------------- the reader ---------------------------------------------------------------- */
  const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const SEASONS = "winter|spring|summer|fall|autumn|hiver|printemps|ete|automne";

  function parse(input, ctx) {
    ctx = ctx || {};
    const raw = String(input == null ? "" : input).slice(0, MAX);
    const out = { text: raw.trim(), tab: null, tabAlso: [], loc: "", locLabel: "", locAlso: [], city: "", lvl: null, lg: "", el: "", w: null, min: 0, sort: "", roles: [], not: [], skills: [], notes: [], chips: [] };
    if (!out.text) return out;
    let s = " " + fold(raw).replace(/\s+/g, " ") + " ";
    /* two-letter province codes are only read when they are typed in capitals, so "on" and "pe" stay ordinary words */
    const upperCodes = [];
    if (/[a-z]/.test(raw)) { const cr = /(?:\b(?:[Ii]n|[Ee]n|[Dd]ans|[Nn]ear|[Aa]round)|[,àÀ])\s*(QC|ON|BC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU)\b/g; let cm0; while ((cm0 = cr.exec(raw))) upperCodes.push(cm0[1]); }
    const chip = (id, kind, text, title) => out.chips.push({ id, kind, text, title: title || "" });

    /* take the first match of a pattern out of the text; returns the match or null */
    const take = (re) => { const m = re.exec(s); if (!m) return null; s = s.slice(0, m.index) + " " + s.slice(m.index + m[0].length); return m; };
    const takeAll = (re) => { const ms = []; let m; while ((m = take(re))) ms.push(m); return ms; };

    /* greetings like "je cherche" and "i am looking for" carry nothing */
    takeAll(/\b(?:je (?:recherche|cherche)|nous recherchons|i(?:'m| am) looking for|i(?:'m| am) searching for|looking for|show me|find me|i want|i need|i would like|i'd like)\b/);

    /* --- eligibility wording: what the text of a posting says about who may apply --- */
    if (take(/\b(?:no|not|without|sans|pas de|aucune?)\s+(?:a\s+|an\s+|any\s+)?(?:(?:security|background|criminal|reliability)\s+(?:clearance|check|screening)s?|clearance|citizenship(?:\s+(?:requirement|required|only))?|citizen(?:s)?[- ]only|(?:cote|habilitation|verification)(?:\s+de|\s+d)?\s*(?:securite|antecedents)?|habilitation|controlled goods|itar)\b/) ||
        take(/\bcitizenship (?:is )?not required\b/) || take(/\bnon[- ]citizens? (?:ok|welcome|ok to apply)\b/)) {
      out.el = "nosec";
      chip("el", "filter", "No security or citizenship wording", "Hides postings whose text mentions a security or background check or citizenship. A posting with no text cannot be checked, so it is kept.");
    }
    if (!out.el && (take(/\b(?:not|pas)\s+(?:only\s+|just\s+|seulement\s+)?(?:for\s+|pour\s+)?(?:new\s+|recent\s+|nouveaux?\s+)?grad(?:uate)?s?(?:\s+only|\s+seulement)?\b/) || take(/\b(?:currently|still)\s+(?:a\s+|an\s+)?(?:student|enrolled|studying|in school)\b|\bcurrently enrolled\b|\bactuellement etudiant\w*\b/))) {
      out.el = "stud";
      chip("el", "filter", "Not for new graduates only", "Hides postings whose text is aimed only at recent graduates.");
    }

    /* --- hours a week: part-time, and say that the hours cannot be checked --- */
    const hrs = take(/\b(?:about |around |approximately |roughly |~)?(\d{1,2})\s*(?:hours?|hrs?|h|heures?)\s*(?:a|per|\/|par|each)?\s*(?:week|wk|semaine)\b/);
    let hoursNote = null;
    if (hrs && +hrs[1] > 0 && +hrs[1] <= 32) hoursNote = +hrs[1];

    /* --- type of job. The first one named is used; the others are listed so they can be opened --- */
    const typeRe = [
      ["intern", /\b(?:intern(?:ship)?s?|co[- ]?ops?|coop|stages?|stagiaires?|placements?|work[- ]terms?|summer jobs?|emplois? d'ete|externships?)\b/],
      ["part", /\b(?:part[- ]?time|temps partiel)\b/],
      ["full", /\b(?:full[- ]?time|temps plein)\b/]
    ];
    const types = [];
    for (const [id, re] of typeRe) { const m = re.exec(s); if (m) types.push([id, m.index]); takeAll(new RegExp(re.source, "g")); }
    types.sort((a, b) => a[1] - b[1]);
    for (const [id] of types) { if (!out.tab) out.tab = id; else if (id !== out.tab && !out.tabAlso.includes(id)) out.tabAlso.push(id); }
    if (!out.tab && hoursNote) out.tab = "part";
    const TAB_NAME = { intern: "Internships & co-ops", part: "Part-time", full: "Full-time" };
    if (out.tab) {
      chip("tab", "filter", TAB_NAME[out.tab], out.tabAlso.length ? "You also named " + out.tabAlso.map((t) => TAB_NAME[t]).join(" and ") + ". The list shows one type at a time: open its tab to see those." : "");
    }
    if (hoursNote) chip("note:hours", "note", "About " + hoursNote + " hours a week", "Part-time is used. Few postings state the hours, so the hours themselves cannot be checked: look in each posting.");

    /* --- place --- */
    const places = [];
    const placeRes = [];
    placeRes.push(["MTL", "Montréal area", new RegExp("\\b(?:" + MTL + ")\\b")]);
    for (const c of CITIES) placeRes.push([c[1], c[0], new RegExp("\\b(?:" + (c[2] || fold(c[0]).replace(/-/g, "[- ]")) + ")\\b"), c[0]]);
    for (const p of PROVINCES) placeRes.push([p[0], p[1], new RegExp("\\b(?:" + p[2] + ")\\b")]);
    placeRes.push([REMOTE_LOC, "Remote in Canada", /\b(?:remote|work from home|wfh|teletravail|a distance|full remote)\b/]);
    for (const [code, label, re, city] of placeRes) {
      const m = re.exec(s);
      if (m) { places.push({ code, label, city: city || "", at: m.index }); takeAll(new RegExp(re.source, "g")); }
    }
    for (const c of upperCodes) {
      const p = PROVINCES.find((x) => x[0] === c);
      if (!p) continue;
      take(new RegExp("\\b" + c.toLowerCase() + "\\b"));
      if (!places.some((x) => x.code === c)) places.push({ code: c, label: p[1], city: "", at: 1e6 });
    }
    /* a province that is only there because a city of the same province was named is not a second place */
    const named = places.filter((p) => !(p.code.length === 2 && !p.city && places.some((q) => q !== p && (q.city || q.code === "MTL") && (q.code === p.code || (q.code === "MTL" && p.code === "QC")))));
    named.sort((a, b) => a.at - b.at);
    if (named.length) {
      out.loc = named[0].code; out.locLabel = named[0].label; out.city = named[0].city;
      out.locAlso = named.slice(1).map((p) => p.label);
      chip("loc", "filter", out.city ? out.city + " (" + (PROVINCES.find((p) => p[0] === out.loc) || [0, out.loc])[1] + ")" : out.locLabel,
        out.locAlso.length ? "You also named " + out.locAlso.join(" and ") + ". The list takes one place at a time: change it in the Location menu." : (out.loc === "MTL" ? "Montréal, Laval, Longueuil, Brossard, Dorval, Saint-Laurent and the rest of the area." : ""));
    }

    /* --- level --- */
    const LV = [
      [4, /\b(?:directors?|directeurs?|directrices?|executives?|dirigeants?|vice[- ]presidents?|vp|c[- ]suite)\b/],
      [3, /\b(?:seniors?|sr|principal|lead|experienced|experimentes?|confirmes?)\b/],
      [2, /\b(?:mid[- ]?level|mid[- ]?career|intermediate|intermediaires?)\b/],
      [1, /\b(?:entry[- ]?level|juniors?|jr|new grad(?:uate)?s?|recent grad(?:uate)?s?|graduates?|debutants?|jeunes? diplomes?|nouveaux? diplomes?|early career)\b/]
    ];
    const lvlNames = ["Intern / student", "Entry-level", "Mid-level", "Senior / manager", "Director & executive"];
    /* "no experience (needed)" asks for entry level: it is not a word to hide */
    if (take(/\b(?:no|without|zero|sans|aucune?)\s+(?:prior\s+|previous\s+|relevant\s+|work\s+)?experience(?:\s+(?:required|needed|necessary|requise?))?\b/) && out.lvl === null) out.lvl = 1;
    for (const [n, re] of LV) { if (take(re)) { if (out.lvl === null) out.lvl = n; takeAll(new RegExp(re.source, "g")); } }
    /* "student" alone says nothing the type does not already say */
    takeAll(/\b(?<!international )(?:students?|etudiants?|etudiantes?)\b(?!\s+internationa)/);
    if (out.lvl !== null && out.tab === "intern" && out.lvl <= 1) out.lvl = null;   /* interns are their own level: the type already says it */
    if (out.lvl !== null) chip("lvl", "filter", lvlNames[out.lvl], "Shows postings of exactly this level instead of the levels that fit your CV.");

    /* --- language of the posting --- */
    if (take(/\b(?:english[- ]only|in english|anglais seulement|en anglais|no french|without french|sans francais|pas de francais|(?:do not|don't|dont) speak french|je ne parle pas francais)\b/)) {
      out.lg = "noFr";
      chip("lg", "filter", "Hide postings written in French", "A posting written in English can still ask for French. That can only be read in each posting.");
    } else if (take(/\b(?:bilingual|bilingue|french (?:is )?ok|french is fine|(?:english|anglais) (?:and|et|\/) (?:french|francais)|(?:french|francais) (?:and|et|\/) (?:english|anglais)|en ?\/ ?fr|fr ?\/ ?en|both languages|les deux langues|parle francais et anglais)\b/)) {
      chip("note:bi", "note", "Bilingual: both languages kept", "No language filter is applied, so postings in English, French and both are shown.");
    } else if (take(/\b(?:in french|en francais|french[- ]speaking|francophone|french only|francais seulement|french language)\b/)) {
      out.lg = "fr";
      chip("lg", "filter", "Written in French or both languages", "Shows postings written in French or in both languages.");
    }
    takeAll(/\b(?:french|francais|english|anglais)\b/);   /* a bare language name has no filter of its own */

    /* --- posted when --- */
    if (take(/\b(?:today|last 24 ?h(?:ours?)?|past 24 hours|past day|last day|24 ?h|aujourd'hui|dernieres? 24 heures)\b/)) out.w = 1;
    else if (take(/\b(?:this week|last week|past week|last 7 days|past 7 days|7 days|cette semaine|7 derniers jours|newly posted|just posted|recently posted|posted recently|recent|fresh|new (?:jobs?|roles?|postings?|listings?|openings?|offers?))\b/)) out.w = 7;
    else if (take(/\b(?:this month|last month|past month|last 30 days|past 30 days|30 days|ce mois|30 derniers jours)\b/)) out.w = 30;
    if (out.w !== null) chip("w", "filter", out.w === 1 ? "Posted in the last 24 hours" : "Posted in the last " + out.w + " days");

    /* --- minimum score and order (the score needs the CV) --- */
    let wantMin = 0, wantSort = "";
    const num = take(/\b(?:score|match(?:es)?)\s*(?:of\s*|above\s*|over\s*|at least\s*|>=?\s*|\+?\s*)(\d{2,3})\s*\+?|\b(\d{2,3})\s*\+\s*(?:score|match)\b/);
    if (num) { const n = +(num[1] || num[2]); wantMin = n >= 60 ? 60 : n >= 45 ? 45 : n >= 30 ? 30 : 0; }
    else if (take(/\b(?:strong|great|good|high|solid)\s+(?:match(?:es)?|fit|fits)\b|\bgood score\b|\bhigh score\b/)) wantMin = 60;
    if (take(/\b(?:newest first|newest|latest|most recent|freshest)\b/)) wantSort = "new";
    else if (take(/\b(?:best matches?|top matches?|best fit|best scores?|highest score|meilleurs? (?:match|correspondance)\w*)\b/)) wantSort = "match";
    if (wantMin || wantSort === "match") {
      if (ctx.hasCv) {
        if (wantMin) { out.min = wantMin; chip("min", "filter", "Score " + wantMin + "+", "Uses the score against your CV. Scores within 5 points are ties."); }
        if (wantSort === "match") { out.sort = "match"; chip("sort", "filter", "Best match first"); }
      } else chip("note:cv", "note", "Scores need your CV", "Add your CV on the Your CV page and the score and order can be used.");
    }
    if (wantSort === "new") { out.sort = "new"; chip("sort", "filter", "Newest first"); }

    /* --- things a posting rarely states: noted, never filtered, never assumed --- */
    if (take(/\b(?:work permits?|pgwp|post[- ]graduation (?:work )?permit|study permits?|international students?|need(?:s)? sponsorship|sponsorship|visa|permis de travail|permis d'etudes|etudiants? internationa\w+|eligible to work|authori[sz]ed to work|autorise a travailler)\b/)) {
      chip("note:permit", "note", "Work permit: check each posting", "Postings seldom state it, so it cannot be filtered. Nothing is assumed about your status.");
    }
    /* pay and hours of the day are rarely stated: noted, never filtered, and never required in the title */
    if (takeAll(/\b(?:week[- ]?ends?|evenings?|flexible (?:hours|schedule)|flex hours|paid|unpaid|fins? de semaine|soirs?|remunere[es]?)\b/).length) {
      chip("note:sched", "note", "Pay and schedule: check each posting", "Postings seldom state pay or the hours of the day, so these words are not filters.");
    }
    const term = [];
    for (const re of [new RegExp("\\b(?:" + SEASONS + ")\\s*(?:term\\s*)?(?:20\\d\\d)?\\b", "g"), new RegExp("\\b(?:starting|starts?|start date|beginning|begins?|from|debut|a partir de|commencant)\\s+(?:in\\s+|en\\s+)?(?:" + MONTHS + ")\\b(?:\\s*20\\d\\d)?", "g"), /\b\d{1,2}[- ]?(?:months?|mois)\b/g, /\b20[2-3]\d\b/g]) {
      let m; while ((m = take(re))) term.push(m[0].trim());
    }
    if (term.length) chip("note:term", "note", "Dates: " + term.join(", ").slice(0, 40) + " — check each posting", "The start date and length are only in some posting texts, so they cannot be filtered. Check them against your own dates.");
    if (take(/\b(?:master'?s?|m\.? ?eng\.?|msc|m\.sc|bachelor'?s?|b\.? ?eng\.?|b\.sc|phd|doctorate|diploma|diplome|maitrise|baccalaureat|undergrad(?:uate)?|grad student)\b/)) {
      chip("note:degree", "note", "Degree level: check each posting", "A degree is named in the text of some postings. It is not filtered here.");
    }

    /* --- skills named after "with", "using", "skills in"... : looked up in the skills library and matched against the keywords read from each posting --- */
    const cue = /\b(?:with|using|who (?:knows?|uses?)|skills?(?: in| like| such as)?|experience (?:in|with)|familiar with|proficient (?:in|with)|knowledge of|avec|utilisant|connaissances? (?:de|en)|competences? (?:en|de)|maitrise de)\b/;
    const cm = cue.exec(s);
    if (cm && typeof ctx.findSkills === "function") {
      const clause = s.slice(cm.index + cm[0].length);
      let found = [];
      try { found = (ctx.findSkills(clause.replace(/[.]/g, " ")) || []).filter(Boolean); } catch (e) { found = []; }
      if (found.length) {
        out.skills = found.slice(0, 5);
        out.skills.forEach((n, i) => chip("skill:" + i, "filter", "Mentions " + n, "Keeps postings whose text, as read by the skills library, names this skill. A short snippet may miss it."));
        s = s.slice(0, cm.index) + " ";
      }
    }

    /* --- words to leave out: "not sales", "no marketing", "sans vente" --- */
    const nots = [];
    let nm;
    const notRe = /\b(?:not|no|except|excluding|without|sans|pas de|aucun|aucune|exclude)\s+([a-z0-9][a-z0-9 '&+#.-]{1,30}?)(?=\s+(?:or|and|ou|et|in|at|near|with|for|but|mais|en|a|pour)\b|[,;]|\s*$)/;
    while ((nm = notRe.exec(s))) {
      const w = nm[1].trim().split(" ").filter((x) => x && !STOP.has(x)).join(" ");
      if (w) nots.push(w);
      s = s.slice(0, nm.index) + " " + s.slice(nm.index + nm[0].length);
    }
    out.not = nots.slice(0, 4);
    out.not.forEach((n, i) => chip("not:" + i, "filter", "Not " + n, "Hides postings whose title has " + alsoText(n) + "."));

    /* --- what is left is the role: split on commas, "or", "and", "ou", "et", "/"; a shared last noun is spread over the others --- */
    const body = s.replace(/[()"“”!?:]/g, " ").replace(/\b(?:and\/or)\b/g, ",");
    const terms = body.split(/\s*(?:,|;|\/|&|\+|\bor\b|\band\b|\bou\b|\bet\b|\bplus\b)\s*/).map((t) => contentWords(t)).filter((w) => w.length);
    const headOf = (w) => { for (let i = w.length - 1; i >= 0; i--) if (IS_HEAD.has(w[i])) return w[i]; return ""; };
    const lastTerm = terms[terms.length - 1] || [];
    const lastHead = terms.length > 1 && lastTerm.length > 1 && IS_HEAD.has(lastTerm[lastTerm.length - 1]) ? lastTerm[lastTerm.length - 1] : "";
    const seen = new Set();
    terms.forEach((w, i) => {
      const words = (lastHead && !headOf(w) && i < terms.length - 1) ? w.concat([lastHead]) : w;
      const text = words.join(" ");
      if (!text || seen.has(text) || out.roles.length >= 6) return;
      seen.add(text); out.roles.push(text);
    });
    out.roles.forEach((r, i) => chip("role:" + i, "filter", r, "Title has " + alsoText(r) + "."));

    if (out.loc === REMOTE_LOC && out.city) out.city = "";
    return out;
  }

  /* the content words of a piece of text, in order, without the filler words */
  function contentWords(t) {
    const w = t.replace(/['’]/g, " ").split(/[^a-z0-9+#.&]+/).filter(Boolean).map((x) => x.replace(/^\.+|\.+$/g, "")).filter(Boolean);
    return w.filter((x) => !STOP.has(x) && (x.length > 1 || x === "c" || x === "r"));
  }

  /* ---------------------------------------------------------------- matching a title ---------------------------------------------------------------- */
  const SYN_MAP = new Map();
  for (const row of SYN) for (const w of row) { const k = w; if (!SYN_MAP.has(k)) SYN_MAP.set(k, row); }
  /* longest phrases first, so "supply chain" is read as one idea */
  const SYN_PHRASES = [...SYN_MAP.keys()].filter((k) => k.indexOf(" ") > 0).sort((a, b) => b.length - a.length);

  const stem = (w) => (w.length > 4 && /[^s]s$/.test(w) ? w.slice(0, -1) : w);
  function altRe(alt) {
    const a = alt.replace(/-/g, " ");
    return a.length <= 3 ? new RegExp("(?:^| )" + esc(a) + "(?: |$)") : new RegExp("(?:^| )" + esc(a));
  }
  /* a role term -> clauses; a title passes when every clause has at least one matching alternative */
  function clausesOf(text) {
    let t = " " + fold(text).replace(/['\-]/g, " ").replace(/\s+/g, " ").trim() + " ";
    const clauses = [];
    for (const ph of SYN_PHRASES) {
      const needle = " " + ph + " ";
      if (t.includes(needle)) { clauses.push({ row: SYN_MAP.get(ph), key: ph }); t = t.replace(needle, " "); }
    }
    for (const w of t.split(" ").filter(Boolean)) {
      if (STOP.has(w)) continue;
      const sw = stem(w);
      const row = SYN_MAP.get(w) || SYN_MAP.get(sw);
      clauses.push(row ? { row, key: w } : { row: [sw], key: w });
    }
    return clauses;
  }
  function compile(text) {
    return { text, clauses: clausesOf(text).map((c) => c.row.map(altRe)), words: clausesOf(text).map((c) => c.row) };
  }
  function alsoAccepts(text) {
    const seen = new Set(), out = [];
    for (const c of clausesOf(text)) for (const a of c.row) if (!seen.has(a)) { seen.add(a); out.push(a); }
    return out;
  }
  function alsoText(text) {
    const a = alsoAccepts(text);
    return a.length ? a.slice(0, 12).join(", ") + (a.length > 12 ? "…" : "") : text;
  }
  const termOk = (term, key) => term.clauses.length > 0 && term.clauses.every((alts) => alts.some((re) => re.test(key)));
  /* roles: compiled terms (any one may match); not: compiled terms (none may match); key: titleKey(title) */
  function titleOk(roles, not, key) {
    if (not && not.length && not.some((t) => termOk(t, key))) return false;
    if (!roles || !roles.length) return true;
    return roles.some((t) => termOk(t, key));
  }

  return { parse, compile, titleOk, titleKey, alsoAccepts, fold, REMOTE_LOC, SYN };
});
