/* scoring.js - the 0-100 match score, in one place so the page and the tests use the same rules.
 *
 *   score = Role fit (0-40) + Level fit (0-25) + Keyword overlap (0-35)
 *
 * It is a heuristic, not an applicant tracking system: scores that differ by 5 points or less are ties.
 * Language, work permit, security and term are shown as flags next to the score and never change it.
 *
 * rows: the posting's keywords against the CV, [{n, kind: "s"|"t", tag: "T"|"R"|"K"|"N"|"P", st: "M"|"R"|"G"}]
 *   M = the same words are on the CV, R = close but not the same (half credit, never shown as a match), G = not on the CV.
 *   tag: T title, R required, K task, N not tagged, P preferred.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Scoring = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CAP = { role: 40, level: 25, overlap: 35 };
  /* a posting whose keywords are covered this far earns the full points of that part (full coverage is not realistic) */
  const ROLE_FULL = 0.7, COV_FULL = 0.4;
  /* a posting with only a few keywords has not shown much: count a few absent keywords too, so 2 of 3 does not read as 67% */
  const PRIOR = 4, ROLE_PRIOR = 1;
  const TAGW = { T: 1, R: 1, K: 0.7, N: 0.7, P: 0.4 };
  const credit = (st) => (st === "M" ? 1 : st === "R" ? 0.5 : 0);

  /* the plain names of a job (analyst, manager, technicien…) say little about the field: in a title they count a little */
  const GENERIC = new Set(("analyst analyste manager gestionnaire specialist specialiste coordinator coordonnateur coordonnatrice assistant assistante adjoint adjointe associate associe associee " +
    "engineer ingenieur ingenieure developer developpeur advisor adviser conseiller conseillere officer representative representant consultant lead director directeur directrice " +
    "administrator administrateur administratrice agent agente technician technicien technicienne supervisor superviseur superviseure clerk executive team member responsable charge chargee").split(" "));
  const plain = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  /* language is a flag beside the score (see the page), never part of it */
  const LANGUAGE = new Set(["bilingual (en/fr)", "bilingual", "bilingue", "english", "french", "anglais", "francais"]);

  /* how much a keyword counts: a dictionary skill counts fully; a phrase of several words a little less; a single ordinary word little */
  function weight(x) {
    const t = TAGW[x.tag] != null ? TAGW[x.tag] : 0.7;
    if (LANGUAGE.has(plain(x.n))) return 0;
    if (x.kind === "s") return t;
    if (x.tag === "T") return GENERIC.has(plain(x.n)) ? 0.3 : 1;
    return t * (/[\s-]/.test(String(x.n).trim()) ? 0.8 : 0.35);
  }

  function keywords(rows) {
    let w = 0, c = 0, matched = 0, close = 0;
    for (const x of rows) {
      const k = weight(x);
      w += k; c += k * credit(x.st);
      if (x.st === "M") matched++; else if (x.st === "R") close++;
    }
    const cov = w ? c / (w + PRIOR) : 0;
    const avg = (a) => {
      let wt = 0, c = 0;
      for (const x of a) { const k = weight(x); wt += k; c += k * credit(x.st); }
      return a.length ? c / (wt + ROLE_PRIOR) : 0;
    };
    const T = rows.filter((x) => x.tag === "T"), R = rows.filter((x) => x.tag === "R");
    let roleCov;
    if (T.length && R.length) roleCov = 0.6 * avg(T) + 0.4 * avg(R);
    else if (T.length) roleCov = avg(T);
    else if (R.length) roleCov = avg(R);
    else roleCov = 0.8 * cov;
    const role = rows.length ? Math.round(CAP.role * Math.min(1, roleCov / ROLE_FULL)) : 2;
    const overlap = Math.round(CAP.overlap * Math.min(1, cov / COV_FULL));
    return { role, overlap, cov, roleCov, matched, close, n: rows.length };
  }

  /* Level fit: how well the posting's level suits the person (fit 0..1, from JobMeta.fit).
     An internship whose term is not the one wanted loses a few points; a term that has already passed is nearly worthless. */
  function levelPoints(fit, o) {
    o = o || {};
    let pts = Math.round(CAP.level * fit);
    if (o.past) return Math.min(pts, 3);
    if (o.intern) pts -= o.tgt ? 0 : o.anyTerm ? 5 : 3;
    return Math.max(0, pts);
  }

  function compute(rows, fit, termInfo) {
    const k = keywords(rows);
    const level = levelPoints(fit, termInfo);
    return { role: k.role, level, overlap: k.overlap, total: k.role + level + k.overlap, cov: k.cov, matched: k.matched, close: k.close, n: k.n };
  }

  return { CAP, ROLE_FULL, COV_FULL, weight, keywords, levelPoints, compute };
});
