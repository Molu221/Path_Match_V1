/* matcher.js - the website's copy of python/keyword_extractor.py's matching.
 *
 * Reads docs/skills.json (written by scripts/build_site_dictionary.py) and, for a piece of text, finds
 * the skills that are WRITTEN in it, in English or French. Everything runs in the browser.
 *
 *   const engine = Matcher.engine(skillsJson);
 *   const cv  = engine.findCv(cvText);                     // { skillName: {first, count, evidence} }
 *   const rep = engine.report(jobText, cv);                // matched, missing, related, inferred, coverage
 *
 * The rules are the same as the Python file, and test/test_oasis.py checks both give the same answers:
 *   - whole words only, a space may be a hyphen, a plural "s" is allowed, accents and capitals do not matter
 *   - a skill that came from OaSIS is not counted when each place it appears sits inside a longer skill
 *   - "related" (hand-written pairs) and "inferred" (shared OaSIS occupations) are listed, never counted as matches
 *   - coverage = matched / job skills;  coverage incl. related = (matched + 0.5 x linked) / job skills
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Matcher = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* lowercase, straight quotes and dashes, accents removed: "Qualité" and "qualite" are the same word */
  function fold(text) {
    text = String(text).toLowerCase()
      .replace(/[’‘]/g, "'").replace(/[‑–—]/g, "-");
    return text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  /* one regular expression per skill; group 1 is the character before the word (JS has no safe lookbehind on old Safari) */
  function pattern(aliases) {
    const parts = aliases.map(a => escapeRe(a).replace(/ /g, "[\\s-]+") + "s?");
    return new RegExp("(^|[^a-z0-9])(?:" + parts.join("|") + ")(?![a-z0-9])", "g");
  }

  function engine(dict) {
    const skills = dict.skills.map(s => ({ name: s.n, source: s.s, re: pattern(s.a) }));
    const related = dict.related || {};
    const inferred = dict.inferred || {};
    const headings = new Set((dict.cv_headings || []).map(h => h.toLowerCase()));

    /* Every skill written in `text`. Returns { name: {first, count, evidence} } in dictionary order. */
    function find(text, skipLine) {
      const out = {};
      let offset = 0;
      const lines = String(text).split("\n");
      for (const raw of lines) {
        if (skipLine && skipLine(raw)) { offset += raw.length + 1; continue; }
        const line = fold(raw);
        const spans = {};
        for (const s of skills) {
          s.re.lastIndex = 0;
          let m;
          while ((m = s.re.exec(line))) {
            const a = m.index + m[1].length, b = m.index + m[0].length;
            (spans[s.name] = spans[s.name] || []).push([a, b]);
            if (m[0].length === 0) s.re.lastIndex++;
          }
        }
        const all = [];
        for (const name in spans) for (const sp of spans[name]) all.push([name, sp]);
        for (const s of skills) {
          const own = spans[s.name];
          if (!own) continue;
          if (s.source !== "curated") {
            const inside = own.every(([a, b]) => all.some(([other, [x, y]]) =>
              other !== s.name && x <= a && b <= y && (y - x) > (b - a)));
            if (inside) continue;
          }
          const entry = out[s.name] || (out[s.name] = { first: offset + own[0][0], count: 0, evidence: "" });
          entry.count += own.length;
          if (!entry.evidence) {
            const a = own[0][0], b = own[0][1];
            entry.evidence = (a > 60 ? "…" : "") + line.slice(Math.max(0, a - 60), b + 60).trim() + (line.length > b + 60 ? "…" : "");
          }
        }
        offset += raw.length + 1;
      }
      return out;
    }

    /* Compare the skills of a job text with the skills found on a CV (the result of find()). */
    function report(jobText, cvFound, jobFound) {
      const job = jobFound || find(jobText);
      const jobNames = Object.keys(job);
      const matched = jobNames.filter(n => cvFound[n]);
      const missing = jobNames.filter(n => !cvFound[n]);
      const linkedCurated = [];
      for (const m of missing) for (const other of (related[m] || [])) if (cvFound[other]) linkedCurated.push([m, other]);
      const seen = new Set(linkedCurated.map(p => p[0] + "\u0000" + p[1]));
      const inf = [];
      for (const m of missing) {
        const hits = [];
        for (const [c, j, n] of (inferred[m] || [])) {
          if (!cvFound[c] || seen.has(m + "\u0000" + c)) continue;
          hits.push([m, c, j, n]);
          if (hits.length === 2) break;
        }
        inf.push(...hits);
      }
      const linked = new Set([...linkedCurated.map(p => p[0]), ...inf.map(p => p[0])]);
      const total = jobNames.length;
      const pct = x => total ? Math.round(1000 * x / total) / 10 : 0;
      return {
        total, matched, missing, job, relatedCurated: linkedCurated, inferred: inf,
        coveragePct: pct(matched.length),
        coverageWithRelatedPct: pct(matched.length + 0.5 * [...linked].filter(n => missing.includes(n)).length)
      };
    }

    /* A CV: a line that is only a heading ("Languages", "Skills"...) is not a skill. Same rule as the Python file. */
    function findCv(text) { return find(text, raw => headings.has(raw.trim().toLowerCase())); }

    return { find, findCv, report, meta: dict.meta || {}, size: skills.length };
  }

  return { fold, engine };
});
