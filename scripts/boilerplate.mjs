/* boilerplate.mjs - remove the text that is not about the job: the same company paragraph, benefits list or legal
 * notice repeated across many postings.
 *
 * Measured on the 15,735 posting texts of Nov 17, 2026: it removes 24% of all the words the matcher reads, from 10,417
 * postings ("please note", "perfect candidate", "equal opportunity employer", the same "About us" 500 times). Nobody types a list:
 * the repetition itself is the evidence, so the rule follows new employers on its own.
 *
 * A line is removed when it is long enough to be a sentence, not a skill bullet, and either
 *   - the same line appears in the postings of many different companies (legal and recruiting templates), or
 *   - one company repeats it in most of its postings, across different job titles (its "About us", its benefits).
 * A line repeated only inside postings with the same title is kept: that is the job itself, posted several times.
 * A line the page reads for a flag or a fact is never removed, however often it repeats: pass keep(line) -> true for those
 * (collect.mjs passes the page's own flag reader, JobMeta.descFlags, plus pay lines).
 */

const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const lineKey = (s) => fold(s).replace(/[^a-z0-9]+/g, " ").trim();
const words = (k) => (k ? k.split(" ").length : 0);
const titleKey = (t) => lineKey(t).replace(/\b(senior|sr|junior|jr|lead|i{1,3}|iv)\b/g, "").replace(/\s+/g, " ").trim();

export const DEFAULTS = {
  crossCompanies: 8,      // the same line in postings of 8 or more companies
  crossMinWords: 10,      // ...and at least 10 words long (short bullets such as "Ability to lift 50 lb" are kept)
  ownMinPostings: 4,      // a company needs 4 postings before its own repetition can be judged
  ownShare: 0.5,          // the line is in at least half of them
  ownMinTitles: 3,        // ...and in postings with at least 3 different titles
  ownMinWords: 8,
};

/* jobs: [{ company, title, desc }]. Changes desc in place and adds bp (lines removed) to each job that lost some.
   Returns what it did, for the source health report. */
export const PAY = /\$\s?\d|\d\s?\$|\bsalary\b|\bsalaire\b|per hour|\/\s?h(ou)?r\b|de l'heure|taux horaire|\bwage\b/i;
export function stripBoilerplate(jobs, opt = {}) {
  const o = { ...DEFAULTS, ...opt };
  const keepLine = (raw) => PAY.test(raw) || (o.keep ? o.keep(raw) : false);
  const cross = new Map();          // line -> Set(company)
  const own = new Map();            // company -> Map(line -> { n, titles:Set })
  const perCompany = new Map();     // company -> number of postings with text
  for (const j of jobs) {
    if (!j.desc) continue;
    const co = lineKey(j.company) || "?";
    perCompany.set(co, (perCompany.get(co) || 0) + 1);
    const seen = new Set();
    for (const raw of String(j.desc).split("\n")) {
      const k = lineKey(raw);
      if (words(k) < Math.min(o.crossMinWords, o.ownMinWords) || seen.has(k)) continue;
      seen.add(k);
      if (!cross.has(k)) cross.set(k, new Set());
      cross.get(k).add(co);
      if (!own.has(co)) own.set(co, new Map());
      const m = own.get(co);
      if (!m.has(k)) m.set(k, { n: 0, titles: new Set() });
      const e = m.get(k); e.n++; e.titles.add(titleKey(j.title));
    }
  }
  const isBoiler = (co, k) => {
    const w = words(k);
    if (w >= o.crossMinWords && (cross.get(k)?.size || 0) >= o.crossCompanies) return true;
    const n = perCompany.get(co) || 0, e = own.get(co)?.get(k);
    return !!e && w >= o.ownMinWords && n >= o.ownMinPostings && e.n >= Math.max(3, o.ownShare * n) && e.titles.size >= o.ownMinTitles;
  };
  let postings = 0, lines = 0, wordsBefore = 0, wordsRemoved = 0;
  for (const j of jobs) {
    if (!j.desc) continue;
    const co = lineKey(j.company) || "?";
    const keep = [];
    let removed = 0;
    for (const raw of String(j.desc).split("\n")) {
      const k = lineKey(raw), w = words(k);
      wordsBefore += w;
      if (w && isBoiler(co, k) && !keepLine(raw)) { removed++; wordsRemoved += w; } else keep.push(raw);
    }
    if (removed) { j.desc = keep.join("\n").replace(/\n{3,}/g, "\n\n").trim(); j.bp = removed; postings++; lines += removed; }
  }
  return { postings, lines, wordsShare: wordsBefore ? Math.round((1000 * wordsRemoved) / wordsBefore) / 10 : 0 };
}
