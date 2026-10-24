/* matcher.js - the website's copy of python/keyword_extractor.py's matching.
 *
 * Reads docs/skills.json (written by scripts/build_site_dictionary.py) and, for a piece of text, finds
 * the skills that are WRITTEN in it, in English or French. Everything runs in the browser.
 *
 *   const engine = Matcher.engine(skillsJson);
 *   const cv  = engine.findCv(cvText);              // { skillName: {first, count, evidence, line, spans, section} }
 *   const rep = engine.report(jobText, cv);         // matched, missing, links (close, not counted), coverage
 *   engine.flags(jobText);                          // things to check yourself, never scored
 *   Matcher.highlight(text, marks);                 // the text as safe HTML with <mark> around the marks
 *
 * The rules are the same as the Python file, and test/test_oasis.py checks both give the same answers:
 *   - whole words only, a space may be a hyphen, a plural "s" is allowed, accents and capitals do not matter
 *   - a skill is not counted when each place it appears sits inside a longer skill's words
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

  /* fold a line and remember where each folded character came from, so a match can be shown in the original text.
     idx is null when the line is plain ASCII (every position is the same). */
  function foldMap(raw) {
    if (/^[\x00-\x7f]*$/.test(raw)) return { s: raw.toLowerCase(), idx: null };
    let s = "";
    const idx = [];
    for (let i = 0; i < raw.length; i++) {
      const f = fold(raw[i]);
      for (let k = 0; k < f.length; k++) { s += f[k]; idx.push(i); }
    }
    return { s, idx };
  }
  const toStart = (m, a) => (m.idx ? m.idx[a] : a);
  const toEnd = (m, b) => (m.idx ? m.idx[b - 1] + 1 : b);

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* one regular expression per skill; group 1 is the character before the word (JS has no safe lookbehind on old Safari) */
  function pattern(aliases) {
    const parts = aliases.map(a => escapeRe(a).replace(/ /g, "[\\s-]+") + "s?");
    return new RegExp("(^|[^a-z0-9])(?:" + parts.join("|") + ")(?![a-z0-9])", "g");
  }

  /* words that make a short line a heading, and what kind of skills sit under it */
  const HEAD = {
    PREFERRED: /nice to have|preferred|an asset|atout|assets\b|un plus|souhait/,
    TASK: /responsibilit|responsabilit|what you.ll do|your role|votre role|\btasks\b|mandat|\btaches\b|your challenges|vos defis|accountabilit|contributions|vos fonctions|ce que vous ferez|what you will|\bduties\b/,
    REQUIRED: /qualification|requirement|\brequis\b|exigence|your profile|votre profil|your skills|key skills|required skills|competences requises|how to thrive|what you bring|ce que vous apportez|profil recherche|profil du candidat|ce que nous recherchons|ideal candidate|must have|you have|vous avez/
  };
  const PREFERRED_LINE = /\bassets?\b|nice to have|preferred|\batouts?\b|un plus/;
  const TAG_NAME = { REQUIRED: "Required", TASK: "Task", PREFERRED: "Preferred" };

  function engine(dict) {
    const skills = dict.skills.map(s => ({ name: s.n, source: s.s, re: pattern(s.a) }));
    const related = dict.related || {};
    const inferred = dict.inferred || {};
    const why = dict.why || {};
    const headings = new Set((dict.cv_headings || []).map(h => fold(h).trim()));
    const flagRes = [];
    for (const f of (dict.flags || [])) {
      try { flagRes.push({ name: f.n, re: new RegExp(f.p, "gi") }); } catch (e) { /* a pattern this browser cannot read */ }
    }

    /* Every skill written in `text`. Returns { name: {first, count, evidence, line, spans[, section]} } in dictionary order.
       Positions are positions in `text` itself. With `cv`, each skill also remembers the CV heading it sits under. */
    function find(text, cv) {
      const out = {};
      let offset = 0;
      let section = "HEADER";
      for (const raw of String(text).split("\n")) {
        const lineStart = offset;
        offset += raw.length + 1;
        if (cv) {
          const h = fold(raw).trim();
          if (headings.has(h)) { section = raw.trim().toUpperCase(); continue; }
        }
        const fm = foldMap(raw), line = fm.s;
        const spans = {};
        for (const s of skills) {
          s.re.lastIndex = 0;
          let m;
          while ((m = s.re.exec(line))) {
            const a = m.index + m[1].length, b = m.index + m[0].length;
            (spans[s.name] = spans[s.name] || []).push([a, b]);
          }
        }
        const all = [];
        for (const name in spans) for (const sp of spans[name]) all.push([name, sp]);
        for (const s of skills) {
          const own = spans[s.name];
          if (!own) continue;
          const inside = own.every(([a, b]) => all.some(([other, [x, y]]) =>
            other !== s.name && x <= a && b <= y && (y - x) > (b - a)));
          if (inside) continue;
          const real = own.map(([a, b]) => [lineStart + toStart(fm, a), lineStart + toEnd(fm, b)]);
          let entry = out[s.name];
          if (!entry) {
            const a = own[0][0], b = own[0][1];
            entry = out[s.name] = {
              first: real[0][0], count: 0, spans: [], line,
              evidence: (a > 60 ? "…" : "") + line.slice(Math.max(0, a - 60), b + 60).trim() + (line.length > b + 60 ? "…" : "")
            };
            if (cv) entry.section = section;
          }
          entry.count += own.length;
          entry.spans.push(...real);
        }
      }
      return out;
    }

    /* A CV: a line that is only a heading ("Languages", "Skills"...) is not a skill. Same rule as the Python file. */
    function findCv(text) { return find(text, true); }

    /* Things to check yourself (degree level, years of experience, citizenship, security...). Never scored. */
    function flags(text) {
      const found = {};
      let offset = 0;
      for (const raw of String(text).split("\n")) {
        const fm = foldMap(raw);
        for (const f of flagRes) {
          f.re.lastIndex = 0;
          let m;
          while ((m = f.re.exec(fm.s))) {
            if (m[0].length === 0) { f.re.lastIndex++; continue; }
            (found[f.name] = found[f.name] || []).push([offset + toStart(fm, m.index), offset + toEnd(fm, m.index + m[0].length)]);
          }
        }
        offset += raw.length + 1;
      }
      return Object.keys(found).map(name => ({ name, spans: found[name] }));
    }

    /* Heading lines of a posting: [{pos, tag}] with tag REQUIRED, TASK or PREFERRED. Short lines only. */
    function sections(text) {
      const out = [];
      let offset = 0;
      for (const raw of String(text).split("\n")) {
        const t = fold(raw).trim();
        if (t && t.split(/\s+/).length <= 8 && !/[.;,]$/.test(t) && !/^[-*•\d]/.test(t)) {
          const tag = HEAD.PREFERRED.test(t) ? "PREFERRED" : HEAD.TASK.test(t) ? "TASK" : HEAD.REQUIRED.test(t) ? "REQUIRED" : null;
          if (tag) out.push({ pos: offset, tag });
        }
        offset += raw.length + 1;
      }
      return out;
    }

    /* "Required", "Task", "Preferred" or "" for a skill found at `entry.first`. A line that says "asset" is Preferred. */
    function tagOf(entry, secs) {
      if (PREFERRED_LINE.test(entry.line || "")) return "Preferred";
      let tag = "";
      for (const s of secs) { if (s.pos <= entry.first) tag = TAG_NAME[s.tag]; else break; }
      return tag;
    }

    /* Compare the skills of a job text with the skills found on a CV (the result of findCv()). */
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
      const links = [
        ...linkedCurated.map(([m, c]) => ({ job: m, cv: c, kind: "curated", label: "Strong",
          why: why[m + "|" + c] || "listed as related in the dictionary" })),
        ...inf.map(([m, c, j, n]) => ({ job: m, cv: c, kind: "oasis", label: "Likely", jaccard: j, shared: n,
          why: "both skills are rated high in " + n + " of the same OaSIS occupations" }))
      ];
      const linked = new Set(links.map(l => l.job));
      const total = jobNames.length;
      const pct = x => total ? Math.round(1000 * x / total) / 10 : 0;
      return {
        total, matched, missing, job, links, relatedCurated: linkedCurated, inferred: inf,
        linkedCount: [...linked].filter(n => missing.includes(n)).length,
        coveragePct: pct(matched.length),
        coverageWithRelatedPct: pct(matched.length + 0.5 * [...linked].filter(n => missing.includes(n)).length)
      };
    }

    return { find, findCv, report, flags, sections, tagOf, meta: dict.meta || {}, size: skills.length };
  }

  /* The text as safe HTML, with <mark class="..."> around each mark {a, b, cls, title}. Where marks overlap, the one
     that starts first (then the longer) wins; `soft` marks (things to check) never cover a skill mark. */
  function highlight(text, marks, soft) {
    text = String(text);
    const taken = [];
    const overlaps = (m) => taken.some(t => m.a < t.b && t.a < m.b);
    const order = (x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a);
    const kept = [];
    for (const m of marks.slice().sort(order)) { if (!overlaps(m)) { kept.push(m); taken.push(m); } }
    for (const m of (soft || []).slice().sort(order)) { if (!overlaps(m)) { kept.push(m); taken.push(m); } }
    kept.sort((x, y) => x.a - y.a);
    let out = "", pos = 0;
    for (const m of kept) {
      out += escapeHtml(text.slice(pos, m.a));
      out += '<mark class="' + m.cls + '" title="' + escapeHtml(m.title || "") + '">' + escapeHtml(text.slice(m.a, m.b)) + "</mark>";
      pos = m.b;
    }
    return out + escapeHtml(text.slice(pos));
  }

  return { fold, engine, highlight };
});
