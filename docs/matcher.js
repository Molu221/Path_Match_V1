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
 *   Open vocabulary (no skill list): every phrase of a posting, compared with the CV
 *   const found = engine.terms(jobText);            // { key: {name, words, first, count, spans, line, evidence} }
 *   const ix    = engine.indexCv(cvText);           // the CV as lines of words (build once per CV)
 *   const hits  = engine.matchTerms(found, ix);     // { key: {st: "M"|"R"|"G", line, shared, spans, cvWord} }
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
      .replace(/[’‘]/g, "'").replace(/[‑–—]/g, "-").replace(/œ/g, "oe").replace(/æ/g, "ae");
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


  /* ---- open vocabulary: the same steps as python/terms.py ---- */
  const TOKEN = /[a-z0-9]+(?:[.&][a-z0-9]+)*[+#]*/g;
  const NUMERIC = /^(?:[0-9]+[+#]*|[0-9]+(?:\.[0-9]+)+)$/;
  const YEAR = /^(?:19|20)[0-9][0-9]$/;
  const JOIN = /^(?:[ \t ]+|-)$/;
  const SUFFIXES = ["ation", "ment", "ing", "ers", "er", "ors", "or", "ed", "ly", "ity", "ive", "al"];
  const MAX_WORDS = 4, CHUNK = 3;
  /* a word without its plural: "dashboards" and "dashboard" are one word */
  function nw(w) {
    if (w.length > 3) {
      if (w.endsWith("ies")) return w.slice(0, -3) + "y";
      if (/(?:sses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
      if (w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) return w.slice(0, -1);
    }
    return w;
  }
  /* a rough stem: "planning", "planner" and "plan" share one */
  function stem(word) {
    let w = nw(word).replace(/z/g, "s");
    for (const suf of SUFFIXES) {
      if (w.endsWith(suf) && w.length - suf.length >= 4) {
        w = w.slice(0, -suf.length);
        if (w.length > 3 && w[w.length - 1] === w[w.length - 2] && "ls".indexOf(w[w.length - 1]) < 0) w = w.slice(0, -1);
        break;
      }
    }
    if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
    return w;
  }
  function chunks(run) {
    if (run.length <= MAX_WORDS) return [run];
    const out = [];
    let i = 0;
    while (run.length - i > MAX_WORDS) { out.push(run.slice(i, i + CHUNK)); i += CHUNK; }
    out.push(run.slice(i));
    return out;
  }

  /* one regular expression per skill; group 1 is the character before the word (JS has no safe lookbehind on old Safari) */
  function pattern(aliases, noPlural) {
    const parts = aliases.map(a => escapeRe(a).replace(/ /g, "[\\s-]+") + (noPlural.has(a) ? "" : "s?"));
    return new RegExp("(^|[^a-z0-9])(?:" + parts.join("|") + ")(?![a-z0-9])", "g");
  }

  /* words that make a short line a heading, and what kind of skills sit under it */
  const HEAD = {
    PREFERRED: /nice to have|preferred|an asset|atout|assets\b|un plus|souhait/,
    TASK: /responsibilit|responsabilit|what you.ll do|your role|votre role|\btasks\b|mandat|\btaches\b|your challenges|vos defis|accountabilit|contributions|vos fonctions|ce que vous ferez|what you will|\bduties\b|quotidien|day.to.day|a quoi ressemblera|what you.ll be doing|what will you|a quoi vous attendre|what to expect|description du poste|job description|a propos du poste|about the (role|position|job)/,
    REQUIRED: /qualification|requirement|\brequis\b|exigence|your profile|votre profil|your skills|key skills|required skills|competences requises|how to thrive|what you bring|ce que vous apportez|profil recherche|profil du candidat|ce que nous recherchons|ideal candidate|must have|you have|vous avez|il vous faut|pour reussir|what you need|to succeed|looking for|nous recherchons|ce que nous cherchons|vous possedez|bring to the role|about you|a propos de vous/
  };
  /* company, benefits and application text: its phrases are listed but not counted */
  HEAD.ABOUT = /about us|about the company|about our|who we are|our (story|values|culture|mission|company|people)|why join|why work|why you.ll|what we offer|we offer|benefits|perks|compensation|equal opportunity|diversity|inclusion|accommodat|how to apply|application process|a propos de nous|a propos de l.entreprise|qui sommes|notre (entreprise|culture|mission|histoire)|^a propos de |^about |travailler chez|work(ing)? (at|for) |life at|rejoignez|join (us|our)|avantages|ce que nous offrons|nous offrons|remuneration|egalite|diversite|comment postuler/;
  const PREFERRED_LINE = /\bassets?\b|nice to have|preferred|\batouts?\b|un plus/;
  const TAG_NAME = { REQUIRED: "Required", TASK: "Task", PREFERRED: "Preferred", ABOUT: "About" };

  function engine(dict) {
    const noPlural = new Set(dict.noPlural || []);
    const skills = dict.skills.map(s => ({ name: s.n, source: s.s, re: pattern(s.a, noPlural) }));
    const related = dict.related || {};
    const inferred = dict.inferred || {};
    const why = dict.why || {};
    const headings = new Set((dict.cv_headings || []).map(h => fold(h).trim()));
    const stop = new Set((dict.terms && dict.terms.stop) || []);
    const weak = new Set((dict.terms && dict.terms.weak) || []);
    const termsOn = stop.size > 0;
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


    /* where the dictionary skills sit on an already folded line (nested ones left out), in folded positions */
    function keptSpans(line) {
      const spans = {};
      for (const s of skills) {
        s.re.lastIndex = 0;
        let m;
        while ((m = s.re.exec(line))) (spans[s.name] = spans[s.name] || []).push([m.index + m[1].length, m.index + m[0].length]);
      }
      const all = [];
      for (const name in spans) for (const sp of spans[name]) all.push([name, sp]);
      const out = [];
      for (const name in spans) {
        const own = spans[name];
        if (own.every(([a, b]) => all.some(([o, [x, y]]) => o !== name && x <= a && b <= y && (y - x) > (b - a)))) continue;
        out.push(...own);
      }
      return out;
    }

    function runsInLine(line, covered) {
      const runs = [];
      let cur = [], prevEnd = 0;
      const flush = () => { if (cur.length) runs.push(cur); cur = []; };
      TOKEN.lastIndex = 0;
      let m;
      while ((m = TOKEN.exec(line))) {
        const t = m[0], a = m.index, b = a + t.length;
        if (cur.length && !JOIN.test(line.slice(prevEnd, a))) flush();
        const numeric = NUMERIC.test(t);
        if (t.length < 2 || stop.has(t) || covered.some(([x, y]) => x <= a && b <= y) ||
            (numeric && (!cur.length || t.length > 4 || YEAR.test(t)))) { flush(); continue; }
        cur.push({ t, a, b });
        prevEnd = b;
      }
      flush();
      return runs.flatMap(chunks);
    }

    function usable(words) {
      if (words.length > 1) return true;
      const w = words[0];
      return w.length >= 3 && !NUMERIC.test(w) && !weak.has(w);
    }

    /* Every phrase of a text that is not one of the dictionary skills, in order of first appearance. */
    function terms(text) {
      const out = {};
      if (!termsOn) return out;
      let offset = 0;
      for (const raw of String(text).split("\n")) {
        const lineStart = offset;
        offset += raw.length + 1;
        const fm = foldMap(raw), line = fm.s;
        for (const run of runsInLine(line, keptSpans(line))) {
          const words = run.map(x => nw(x.t));
          if (!usable(words)) continue;
          const key = words.join(" ");
          const a = run[0].a, b = run[run.length - 1].b;
          const span = [lineStart + toStart(fm, a), lineStart + toEnd(fm, b)];
          let e = out[key];
          if (!e) {
            const shown = raw.slice(toStart(fm, a), toEnd(fm, b)).replace(/\s+/g, " ").trim();
            e = out[key] = {
              name: shown, key, words, first: span[0], count: 0, spans: [], line,
              evidence: (a > 60 ? "…" : "") + line.slice(Math.max(0, a - 60), b + 60).trim() + (line.length > b + 60 ? "…" : "")
            };
          }
          e.count++;
          e.spans.push(span);
        }
      }
      return out;
    }

    /* the CV as lines of words, built once per CV */
    function indexCv(text) {
      const lines = [];
      let offset = 0;
      for (const raw of String(text).split("\n")) {
        const fm = foldMap(raw), s = fm.s, toks = [];
        TOKEN.lastIndex = 0;
        let m;
        while ((m = TOKEN.exec(s))) toks.push({ n: nw(m[0]), st: stem(m[0]), a: m.index, b: m.index + m[0].length, w: m[0] });
        lines.push({ raw: raw.trim(), s, fm, start: offset, toks, have: new Set(toks.map(k => k.st)) });
        offset += raw.length + 1;
      }
      return lines;
    }

    function matchTerm(words, ix) {
      const n = words.length;
      for (const L of ix) {
        const t = L.toks;
        for (let i = 0; i + n <= t.length; i++) {
          let ok = true;
          for (let k = 0; k < n && ok; k++) ok = t[i + k].n === words[k];
          for (let k = 0; k < n - 1 && ok; k++) ok = JOIN.test(L.s.slice(t[i + k].b, t[i + k + 1].a));
          if (ok) return { st: "M", line: L.raw, shared: words.slice(), spans: [[L.start + toStart(L.fm, t[i].a), L.start + toEnd(L.fm, t[i + n - 1].b)]] };
        }
      }
      const stems = words.map(stem);
      if (n === 1) {
        for (const L of ix) for (const k of L.toks) {
          if (k.st === stems[0] && stems[0].length >= 3) return { st: "R", line: L.raw, shared: [words[0]], cvWord: k.n, spans: [[L.start + toStart(L.fm, k.a), L.start + toEnd(L.fm, k.b)]] };
        }
        return { st: "G" };
      }
      const main = [];
      words.forEach((w, i) => { if (!weak.has(w) && w.length >= 4) main.push([w, stems[i]]); });
      const need = n <= 3 ? 1 : 2;
      let best = null;
      for (const L of ix) {
        const have = L.have;
        const shared = main.filter(([, s]) => have.has(s)).map(([w]) => w);
        if (shared.length >= need && (!best || shared.length > best.shared.length)) best = { L, shared };
      }
      if (!best) return { st: "G" };
      const ss = new Set(main.filter(([w]) => best.shared.includes(w)).map(([, s]) => s));
      const spans = best.L.toks.filter(k => ss.has(k.st)).map(k => [best.L.start + toStart(best.L.fm, k.a), best.L.start + toEnd(best.L.fm, k.b)]);
      return { st: "R", line: best.L.raw, shared: best.shared, spans };
    }

    function matchTerms(found, ix) {
      const out = {};
      for (const k in found) out[k] = matchTerm(found[k].words, ix);
      return out;
    }

    /* Heading lines of a posting: [{pos, tag}] with tag REQUIRED, TASK or PREFERRED. Short lines only. */
    function sections(text) {
      const out = [];
      let offset = 0;
      for (const raw of String(text).split("\n")) {
        const t = fold(raw).trim();
        if (t && t.split(/\s+/).length <= 8 && !/[.;,]$/.test(t) && !/^[-*•\d]/.test(t)) {
          const tag = HEAD.PREFERRED.test(t) ? "PREFERRED" : HEAD.TASK.test(t) ? "TASK" : HEAD.REQUIRED.test(t) ? "REQUIRED" : HEAD.ABOUT.test(t) ? "ABOUT" : null;
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

    /* ---- the keywords the 0-100 score reads ----
       profile() is run once per posting (by the collector) and stored with it, so the page can score thousands of postings
       without reading their text again. It lists the posting's counted keywords, the ones that matter most first:
       the title, then "Required", "Task", untagged, "Preferred". A word that only names the level of the job (senior, intern...)
       is left out: the level is scored on its own.
       Each entry is "<tag><kind>|<name>": tag T title, R required, K task, N untagged, P preferred, A about-the-company;
       kind s = a dictionary skill, t = any other phrase. `kt` is how many keywords the posting has in all. */
    const LEVEL_WORDS = new Set(["senior", "junior", "sr", "jr", "intern", "internship", "stage", "stagiaire", "coop", "co-op", "student", "etudiant", "entry", "level", "trainee", "graduate", "lead", "apprentice", "associate", "i", "ii", "iii"]);
    const TAGCODE = { Title: "T", Required: "R", Task: "K", "": "N", Preferred: "P", About: "A" };
    const TAGRANK = { T: 0, R: 1, K: 2, N: 3, P: 4, A: 5 };
    function profile(title, body, max) {
      max = max || 40;
      const text = body ? title + "\n" + body : title;
      const tl = String(title).length;
      const job = find(text), secs = sections(text), rows = [];
      let kt = 0;
      for (const n in job) {
        const e = job[n];
        const t = TAGCODE[e.first < tl ? "Title" : tagOf(e, secs)];
        kt++;
        rows.push({ code: t + "s|" + n, t, k: 0, w: n.split(/\s+/).length, c: e.count, f: e.first });
      }
      const tf = terms(text);
      for (const key in tf) {
        const e = tf[key];
        const t = TAGCODE[e.first < tl ? "Title" : tagOf(e, secs)];
        if (t === "A") continue;
        kt++;
        if (e.words.every(w => LEVEL_WORDS.has(w))) continue;
        rows.push({ code: t + "t|" + e.name, t, k: 1, w: e.words.length, c: e.count, f: e.first });
      }
      rows.sort((a, b) => TAGRANK[a.t] - TAGRANK[b.t] || a.k - b.k || b.w - a.w || b.c - a.c || a.f - b.f);
      const keep = rows.filter(r => r.t !== "A");
      return { kw: keep.slice(0, max).map(r => r.code), kt };
    }
    /* the words of a stored keyword, the same way terms() cut them (cached: the same phrase turns up in many postings) */
    const WORDS = new Map();
    function termWords(name) {
      let w = WORDS.get(name);
      if (w) return w;
      w = [];
      const s = foldMap(String(name)).s;
      TOKEN.lastIndex = 0;
      let m;
      while ((m = TOKEN.exec(s))) w.push(nw(m[0]));
      if (WORDS.size > 20000) WORDS.clear();
      WORDS.set(name, w);
      return w;
    }
    /* A stored profile against a CV: [{n, kind: "s"|"t", tag, st: "M"|"R"|"G"}]. Close ("R") is never a match. */
    function profileStatus(kw, cvFound, ix) {
      const dec = kw.map(c => ({ n: c.slice(3), kind: c[1], tag: c[0] }));
      const skills = dec.filter(x => x.kind === "s");
      const linked = new Set();
      if (skills.length) {
        const fake = {};
        skills.forEach(x => { fake[x.n] = {}; });
        report("", cvFound, fake).links.forEach(l => linked.add(l.job));
      }
      return dec.map(x => {
        if (x.kind === "s") { x.st = cvFound[x.n] ? "M" : linked.has(x.n) ? "R" : "G"; return x; }
        const w = termWords(x.n);
        x.st = w.length ? matchTerm(w, ix).st : "G";
        return x;
      });
    }

    return { profile, profileStatus, termWords, find, findCv, report, flags, sections, tagOf, terms, indexCv, matchTerms, termsOn, stopWords: [...stop].sort(), weakWords: [...weak].sort(), meta: dict.meta || {}, size: skills.length };
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
