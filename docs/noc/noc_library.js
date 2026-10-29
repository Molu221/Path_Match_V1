// Path Match NOC library: helpers to use noc_library.json (browser or Node 18+, ES module, no dependencies).
//
//   import * as nl from "./noc_library.js";
//   const lib = await nl.load("noc_library.lite.json");        // browser: fetch; Node: pass the parsed JSON to nl.prepare()
//   const fits = nl.findOccupations(lib, cvText);              // CV -> best occupations
//   const result = nl.compare(lib, cvText, "13201.01", { postingLanguage: "English and French" });
//   nl.translate(lib, "inventory control");                     // English <-> French
//   nl.similar(lib, "13201.01");                                // nearby occupations
//
// Every item gets one of 3 labels: Matched, Missing, Guess (see lib.rules).
// Same rules as noc_library.py. Data: OaSIS / SIPeC 2025 (ESDC), Open Government Licence - Canada.

const LINKS = new Set("de des du d la l a au aux en le les of the and et ou or to for in on".split(" "));
const STOP = new Set([...LINKS, ..."un une with par pour sur dans avec by from as at".split(" ")]);

// ------------------------------------------------------------------ text helpers
export function norm(text) {
  let t = String(text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  t = t.replace(/[’'`]/g, " ").replace(/[^a-z0-9+#&\-. ]+/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

export function stem(w) {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !/(ss|us|is|as|os|ys)$/.test(w)) return w.slice(0, -1);
  return w;
}

const fuzzy = (w) => (w.length >= 7 ? w.slice(0, 6) : w);
const strip = (w) => w.replace(/^[.-]+|[.-]+$/g, "");
export const tokens = (text) => norm(text).split(" ").map(strip).filter(Boolean).map(stem);

export class Text {
  constructor(text) {
    this.raw = text || "";
    this.norm = norm(text);
    this.toks = tokens(text);
    this.pos = new Map();
    this.fpos = new Map();
    this.toks.forEach((t, i) => {
      if (!this.pos.has(t)) this.pos.set(t, []);
      this.pos.get(t).push(i);
      const f = fuzzy(t);
      if (!this.fpos.has(f)) this.fpos.set(f, []);
      this.fpos.get(f).push(i);
    });
  }
  // true if all content words of `phrase` appear close together; loose also accepts other forms of a word
  has(phrase, { window = 6, loose = false } = {}) {
    let words = tokens(phrase).filter((t) => !STOP.has(t));
    if (!words.length) return false;
    let pos = this.pos;
    if (loose) { words = words.map(fuzzy); pos = this.fpos; }
    const first = pos.get(words[0]);
    if (!first) return false;
    if (words.length === 1) return true;
    return first.some((i) => words.slice(1).every((w) => (pos.get(w) || []).some((j) => Math.abs(j - i) <= window + words.length)));
  }
}

const asText = (t) => (t instanceof Text ? t : new Text(t));

export async function load(url = "noc_library.lite.json") {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the NOC library: HTTP " + r.status);
  return prepare(await r.json());
}
export const prepare = (json) => json;

// ------------------------------------------------------------------ CV -> occupations
const FIELD_TO_TITLE = [["engineering", "engineer"], ["nursing", "nurse"], ["accounting", "accountant"], ["pharmacy", "pharmacist"],
  ["dentistry", "dentist"], ["architecture", "architect"], ["physiotherapy", "physiotherapist"],
  ["genie industriel", "ingenieur industriel"], ["genie mecanique", "ingenieur mecanique"],
  ["genie civil", "ingenieur civil"], ["genie electrique", "ingenieur electricien"], ["soins infirmiers", "infirmier"]];
export function findOccupations(lib, cvText, top = 5) {
  const cv = asText(cvText);
  const w = lib.rules.occupation_detection;
  const score = new Map(), evidence = new Map();
  const add = (c, s, e) => { score.set(c, (score.get(c) || 0) + s); if (e) { if (!evidence.has(c)) evidence.set(c, []); evidence.get(c).push(e); } };
  const words = cv.norm.split(" ");
  const seen = new Set();
  for (let size = 6; size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const gram = words.slice(i, i + size).join(" ");
      if (seen.has(gram)) continue;
      seen.add(gram);
      let key = gram, label = "title: ", factor = 1;
      if (!(gram in lib.title_index)) {
        // a field of study points to its occupation ("industrial engineering" -> "industrial engineer"), never a clear fit on its own
        const hit = FIELD_TO_TITLE.find(([a]) => gram.endsWith(a));
        const field = hit ? gram.slice(0, gram.length - hit[0].length) + hit[1] : null;
        if (!field || !(field in lib.title_index) || size < 2) continue;
        key = field; label = "field of study: "; factor = 0.5;
      }
      const codes = lib.title_index[key];
      const weight = (factor * w.title_found_on_cv * (size >= 2 ? 1 : 0.35)) / Math.sqrt(Math.max(1, codes.length));
      for (const c of codes) add(c, weight, label + key);
    }
  }
  for (const [code, p] of Object.entries(lib.profiles)) {
    const hits = [...p.keywords.en, ...p.keywords.fr].filter((k) => cv.has(k));
    if (hits.length) {
      const pts = hits.reduce((a, h) => a + (h.includes(" ") ? 1 : 0.25), 0);
      add(code, w.keyword_found * Math.min(pts, 4) * 0.5);
      hits.slice(0, 5).forEach((h) => add(code, 0, "duty: " + h));
    }
    const parts = [...new Set(p.core_competencies.flatMap((c) => c.parts))].filter((c) => cv.has(c));
    if (parts.length) add(code, w.core_competency_found * Math.min(parts.length, 4) * 0.5);
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([code, s]) => {
    const p = lib.profiles[code], ev = evidence.get(code) || [];
    return { code, noc: p.noc, name: p.name, score: Math.round(s * 100) / 100,
             clear_fit: s >= w.clear_fit_min_score && ev.some((e) => e.startsWith("title:")), evidence: ev.slice(0, 8) };
  });
}

// ------------------------------------------------------------------ education, certifications, languages
const EDU_CV = [
  [/\bph\.? ?d\b|doctorat|doctorate|\bdoctor of\b/, 6],
  [/\bmaster|\bm\.? ?(eng|sc|ba|a)\b|\bmba\b|maitrise/, 5],
  [/\bbachelor|\bb\.? ?(comm|eng|sc|a|ba)\b|baccalaureat|\bbac\b|university degree|diplome universitaire/, 4],
  [/\bdec\b|cegep|college|diploma|\bdiplome d etudes collegiales|\baec\b|\bdep\b|apprenticeship|apprentissage/, 3],
  [/high school|secondary school|\bdes\b|secondaire/, 2],
];
const IN_PROGRESS = /in progress|expected|ongoing|current|present|en cours|prevu|a ce jour/;
const CERT_CV = {
  "Red Seal endorsement": /red seal|sceau rouge/,
  "Professional Engineer licence (P.Eng.)": /p\.? ?eng|professional engineer|\bing\.? |ingenieur junior|\beit\b|engineer in training/,
  "CPA designation": /\bcpa\b|chartered professional accountant/,
  "Driver's licence": /driver s licen|drivers licen|permis de conduire|class [1-5a-g] /,
  "Trade certification": /journeyman|journeyperson|certificate of qualification|certificat de qualification|compagnon/,
  "Registration with a regulatory body": /registered with|registration (with|number|no)|licen[cs]e (number|no)|membre de l ordre|\bordre des\b|registered (nurse|psychiatric nurse|practical nurse|dietitian|massage|social worker)|infirmi\w* autoris|licensed practical nurse|\blpn\b|\brn\b|\brpn\b/,
  "Licence": /licen[cs]e (number|no|holder)|licensed|permis (de|d) /,
  "Certification": /certified|certification|certifie|certificat/,
};
const LANG_WORDS = { English: /\benglish\b|\banglais\b|bilingual|bilingue/, French: /\bfrench\b|\bfrancais\b|bilingual|bilingue/ };
const FR_SCHOOLS = /universite (de montreal|laval|du quebec|de sherbrooke)|\buqam\b|\buqtr\b|\buqac\b|cegep|polytechnique montreal|hec montreal|\bets\b/;
const FR_STOP = new Set("le la les des du de et pour avec dans sur une un est sont au aux".split(" "));
const EN_STOP = new Set("the and of to with for in on a an is are at by from".split(" "));

function cvLanguageGuess(cv) {
  const ws = cv.norm.split(" ");
  const fr = ws.filter((t) => FR_STOP.has(t)).length, en = ws.filter((t) => EN_STOP.has(t)).length;
  return fr > en * 1.3 ? "French" : en > fr * 1.3 ? "English" : "";
}

function cvEducation(cv) {
  let best = 0, progress = 0;
  for (const line of cv.raw.split(/[\n;]|\s{2,}/)) {
    const n = norm(line);
    for (const [pat, lvl] of EDU_CV) {
      if (pat.test(n)) {
        if (IN_PROGRESS.test(n) || /20\d\d ?- ?(20\d\d )?\(?expected|20\d\d ?- ?present/.test(n)) progress = Math.max(progress, lvl);
        else best = Math.max(best, lvl);
        break;
      }
    }
  }
  return [best, progress];
}

const item = (part, en, fr, label, why) => ({ part, en, fr, label, why });
const profileOf = (lib, code) => (code in lib.profiles ? code : lib.nocs[code.slice(0, 5)].profiles[0]);

// ------------------------------------------------------------------ CV vs occupation
export function compare(lib, cvText, code, { postingLanguage = null, fits = null, maxDuties = 12, maxSkills = 12 } = {}) {
  const cv = asText(cvText);
  code = profileOf(lib, code);
  const p = lib.profiles[code];
  fits = fits || findOccupations(lib, cv);
  const clear = fits.filter((f) => f.clear_fit).map((f) => lib.profiles[f.code]);
  const pairs = lib.translations.keywords_en_fr;
  const out = [];

  // 1) duties: each main duty sentence of the occupation
  const clearCodes = new Set(clear.map((c) => c.code));
  const near = new Set(clear.flatMap((c) => c.similar.filter((x) => x.level === "very similar").map((x) => x.code)));
  for (const d of p.duties.slice(0, maxDuties)) {
    const keys = [...d.keys, ...(d.keys_fr || [])];
    const found = keys.filter((k) => cv.has(k));
    const hit = d.keys.filter((k) => found.includes(k) || found.includes(pairs[k])).length;
    if (d.keys.length && hit >= Math.max(1, Math.floor((d.keys.length + 1) / 2)))
      out.push(item("duties", d.en, d.fr, "Matched", "on the CV: " + found.slice(0, 3).join(", ")));
    else if (clearCodes.has(code) || near.has(code))
      out.push(item("duties", d.en, d.fr, "Guess", "usual duty of an occupation your CV clearly fits"));
    else out.push(item("duties", d.en, d.fr, "Missing", "not on the CV"));
  }

  // 2) skills: core competencies + skills rated 4-5
  let skills = [];
  for (const cc of p.core_competencies) for (const part of cc.parts) if (!skills.includes(part)) skills.push(part);
  for (const s of p.skills) if (s.rating >= 4 && !skills.includes(s.en)) skills.push(s.en);
  skills = skills.slice(0, maxSkills);
  const compFr = lib.translations.competencies_en_fr;
  for (const s of skills) {
    const fr = compFr[s.toLowerCase()] || "";
    if (cv.has(s, { loose: true }) || (fr && cv.has(fr, { loose: true }))) { out.push(item("skills", s, fr, "Matched", "written on the CV")); continue; }
    const src = clear.find((c) => c.core_competencies.some((cc) => cc.parts.includes(s)) || c.skills.some((x) => x.en === s && x.rating >= 4));
    out.push(src ? item("skills", s, fr, "Guess", "core skill of " + src.name.en + ", an occupation your CV fits")
                 : item("skills", s, fr, "Missing", "not on the CV"));
  }

  // 3) education
  const edu = p.requirements.education;
  if (edu) {
    const [have, progress] = cvEducation(cv);
    if (have >= edu.level) out.push(item("education", edu.en, edu.fr, "Matched", "your CV shows this level or higher"));
    else if (progress >= edu.level) out.push(item("education", edu.en, edu.fr, "Guess", "degree in progress on your CV"));
    else out.push(item("education", edu.en, edu.fr, "Missing", "usually required for this occupation"));
  }

  // 4) certifications and licences (required ones only; never guessed)
  for (const c of p.requirements.certifications) {
    if (!c.required) continue;
    const pat = CERT_CV[c.name];
    const found = !!(pat && pat.test(cv.norm + " "));
    out.push(item("certifications", c.name, c.fr, found ? "Matched" : "Missing", found ? "on your CV" : c.en));
  }

  // 5) languages (Job Bank "Official Language": English, French, English or French, Bilingual)
  if (!postingLanguage) {
    const mix = Object.fromEntries(Object.entries((lib.nocs[p.noc] || {}).languages_in_postings || {}).filter(([k]) => !k.toLowerCase().includes("no data")));
    postingLanguage = Object.keys(mix).sort((a, b) => mix[b] - mix[a])[0] || "";
  }
  const pl = postingLanguage.toLowerCase();
  let needed;
  if (pl.includes("bilingual") || pl.includes("and") || pl.includes(" et ")) needed = [["English"], ["French"]];
  else if (pl.includes(" or ") || pl.includes(" ou ")) needed = [["English", "French"]];
  else needed = ["English", "French"].filter((l) => pl.includes(l.toLowerCase())).map((l) => [l]);
  const writtenIn = cvLanguageGuess(cv);
  const frName = { English: "Anglais", French: "Français" };
  for (const options of needed) {
    const en = options.join(" or "), fr = options.map((o) => frName[o]).join(" ou ");
    if (options.some((o) => LANG_WORDS[o].test(cv.norm))) out.push(item("languages", en, fr, "Matched", "listed on the CV"));
    else if (options.includes(writtenIn) || (options.includes("French") && FR_SCHOOLS.test(cv.norm)))
      out.push(item("languages", en, fr, "Guess", "your CV is written in it or shows studies in it"));
    else out.push(item("languages", en, fr, "Missing", "not on the CV"));
  }

  const summary = Object.fromEntries(["Matched", "Guess", "Missing"].map((l) => [l, out.filter((x) => x.label === l).length]));
  return { code, noc: p.noc, name: p.name, summary, items: out };
}

// ------------------------------------------------------------------ small lookups
export function translate(lib, term) {
  const t = norm(term), tr = lib.translations, hits = [];
  for (const table of ["keywords_en_fr", "keywords_fr_en"]) if (t in tr[table]) hits.push(tr[table][t]);
  for (const [en, fr] of Object.entries(tr.competencies_en_fr)) { if (norm(en) === t) hits.push(fr); else if (norm(fr) === t) hits.push(en); }
  for (const [en, fr] of Object.entries(tr.titles_en_fr)) {
    if (norm(en) === t) hits.push(fr);
    else if (norm(fr) === t || fr.split("/").map(norm).includes(t)) hits.push(en);
  }
  return [...new Set(hits)];
}

export function similar(lib, code) {
  code = profileOf(lib, code);
  return lib.profiles[code].similar.map((s) => ({ ...s, name: lib.profiles[s.code].name }));
}

export function occupationsForKeyword(lib, keyword) {
  return (lib.keyword_index[norm(keyword)] || []).map((c) => ({ code: c, name: lib.profiles[c].name }));
}
