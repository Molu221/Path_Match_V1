/* planner.js - the maths behind the Week plan page, in one place so the page and the tests use the same rules.
 *
 * The question: given the postings that fit a person, which few are worth the applications of one week?
 * It is a small constrained optimisation, written so that every step can be explained:
 *
 *   1. Score range. A posting's score depends on which keywords the reader found in its text. To show how much it leans on that, the
 *      keywords are re-drawn with replacement 120 times and the posting is scored again each time. The 20th and 80th percentiles of those
 *      scores are the range. A posting with few keywords (a title, a short snippet) gets a wide range; a long text gets a narrow one.
 *      The draws use a seeded generator, so the same posting always gets the same range.
 *   2. Cautious score = the low end of the range (20th percentile). A posting has to look good even if the reading was a little unlucky.
 *   3. Freshness. An older posting is more likely to be filled, so its weight halves every H days. H is a choice of the person.
 *   4. Priority = cautious score x freshness. The plan takes the highest priorities, at most 2 postings from one employer,
 *      so one company cannot fill the week.
 *   5. Pareto front. A posting is on the front when no other posting is both newer and at least as good (cautious score).
 *      These are the postings no other one beats on both counts.
 *
 * This is a heuristic, not an applicant tracking system, and not a forecast of interviews: scores that differ by 5 points or less are ties.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Planner = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DRAWS = 120;
  /* half-life in days for the three choices on the page */
  const HALF = { fit: 45, balanced: 21, fresh: 10 };

  /* a 32-bit hash of a string, then a small seeded generator (mulberry32) */
  function hash(str) {
    let h = 1779033703 ^ String(str).length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* rows: the posting's keywords against the CV (see scoring.js). Returns {mid, lo, hi}: mid is the score the page shows. */
  function range(Scoring, rows, fit, termInfo, seed) {
    const mid = Scoring.compute(rows, fit, termInfo).total, n = rows.length;
    if (n < 2) return { mid, lo: mid, hi: mid };
    const r = rng(hash(seed)), out = [], pick = new Array(n);
    for (let b = 0; b < DRAWS; b++) {
      for (let i = 0; i < n; i++) pick[i] = rows[Math.floor(r() * n)];
      out.push(Scoring.compute(pick, fit, termInfo).total);
    }
    out.sort((a, b) => a - b);
    const q = (p) => out[Math.min(out.length - 1, Math.max(0, Math.round(p * (out.length - 1))))];
    return { mid, lo: Math.min(mid, q(0.2)), hi: Math.max(mid, q(0.8)) };
  }

  const fresh = (ageDays, half) => Math.pow(0.5, Math.max(0, ageDays) / half);

  /* a candidate: {key, company, lo, mid, hi, ageDays, block?}  (block = a reason the person asked to leave it out)
     opts: {n, half, perEmployer}. Returns {chosen, skipped}: every candidate that was not chosen, with the reason. */
  function pick(cands, opts) {
    const n = opts.n, half = opts.half, per = opts.perEmployer || 2;
    const list = cands.map((c) => Object.assign({}, c, { fresh: fresh(c.ageDays, half), priority: c.lo * fresh(c.ageDays, half) }));
    list.sort((a, b) => b.priority - a.priority || b.mid - a.mid || (a.key < b.key ? -1 : 1));
    const chosen = [], skipped = [], count = new Map();
    for (const c of list) {
      const emp = String(c.company).toLowerCase();
      if (c.block) { skipped.push(Object.assign(c, { why: "block", note: c.block })); continue; }
      if (chosen.length >= n) { skipped.push(Object.assign(c, { why: "full" })); continue; }
      if ((count.get(emp) || 0) >= per) { skipped.push(Object.assign(c, { why: "employer", note: c.company })); continue; }
      count.set(emp, (count.get(emp) || 0) + 1);
      chosen.push(c);
    }
    /* for the ones that were "full", say what kept them out: age, a wide range, or simply a lower priority */
    const last = chosen[chosen.length - 1];
    for (const s of skipped) {
      if (s.why !== "full" || !last) continue;
      if (s.fresh < 0.6 * last.fresh) { s.why = "old"; s.note = Math.round(s.ageDays); }
      else if (s.hi - s.lo > last.hi - last.lo + 6) { s.why = "wide"; s.note = s.lo + "–" + s.hi; }
      else { s.why = "lower"; s.note = Math.round(s.priority) + " against " + Math.round(last.priority); }
    }
    return { chosen, skipped };
  }

  /* the postings no other posting beats on both age (newer) and cautious score (higher): indexes into the list */
  function pareto(points) {
    const idx = points.map((p, i) => i).sort((a, b) => points[a].ageDays - points[b].ageDays || points[b].lo - points[a].lo);
    const front = [];
    let best = -Infinity;
    for (const i of idx) { if (points[i].lo > best) { front.push(i); best = points[i].lo; } }
    return front;
  }

  return { DRAWS, HALF, hash, rng, range, fresh, pick, pareto };
});
