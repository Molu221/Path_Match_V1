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
  /* words a suffix rule would merge with an unrelated word ("career" / "care", "united" / "unit") */
  const NO_STEM = new Set(["career", "united"]);
  /* a rough stem: "planning", "planner" and "plan" share one */
  function stem(word) {
    let w = nw(word).replace(/z/g, "s");
    if (NO_STEM.has(w)) return w;
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
    /* A word index, so a line is only searched for the skills it could hold (with thousands of skills, testing every
       skill on every line is slow). Each spelling is filed under its longest run of letters and digits: wherever the
       spelling matches, that run is a whole word of the line, or that word with a plural "s". The answers are the
       same as testing every skill. A spelling with no letter or digit is tested on every line. */
    const byWord = new Map(), always = [];
    skills.forEach((s, i) => {
      for (const a of dict.skills[i].a) {
        const runs = a.match(/[a-z0-9]+/g);
        if (!runs) { always.push(i); continue; }
        const key = runs.reduce((x, y) => (y.length > x.length ? y : x));
        let list = byWord.get(key);
        if (!list) byWord.set(key, list = []);
        if (list[list.length - 1] !== i) list.push(i);
      }
    });
    /* A skill added by the skills library never hides a skill that was there before it ("aerospace manufacturing" does
       not hide "Aerospace experience"), so everything found before the library is still found. */
    const fromLibrary = new Set(dict.skills.filter(s => s.s === "library").map(s => s.n));
    const canHide = (longer, shorter) => !fromLibrary.has(longer) || fromLibrary.has(shorter);
    /* the skills to test on one folded line, in dictionary order */
    function candidates(line) {
      const pick = new Set(always);
      const words = line.match(/[a-z0-9]+/g) || [];
      for (const w of words) {
        const a = byWord.get(w);
        if (a) for (const i of a) pick.add(i);
        if (w.length > 1 && w[w.length - 1] === "s") {
          const b = byWord.get(w.slice(0, -1));
          if (b) for (const i of b) pick.add(i);
        }
      }
      return [...pick].sort((x, y) => x - y).map(i => skills[i]);
    }
    const related = dict.related || {};
    const inferred = dict.inferred || {};
    const why = dict.why || {};
    const headings = new Set((dict.cv_headings || []).map(h => fold(h).trim()));
    /* I-03: parts of a CV that must not feed the matching. What you do on a Sunday and the prizes you
       won are not skills an employer is buying ("Cooking: beginner" was read as Culinary arts), and a
       high-school line is too old and too general to count. */
    const OFF_SECTION = new Set(["interests", "interest", "hobbies", "hobby", "interets", "interet",
      "centres d'interet", "centre d'interet", "loisirs", "loisir", "activites", "personal interests",
      "awards", "award", "achievements", "achievement", "honours", "honors", "distinctions", "prix",
      "scholarships", "bourses", "references", "reference", "references professionnelles",
      "extracurricular activities", "activites parascolaires", "parascolaire"]);
    /* A hobbies or prizes list is short. In a two-column CV the reading order can carry real work
     * lines in under such a heading (CV3: the ACHIEVEMENTS heading sits in one column and the next
     * job follows it), so the part left out stops after this many lines; after that we are plainly
     * reading something else and it counts again. */
    const OFF_MAX = 12;
    const SCHOOL_LINE = /\b(high school|secondary school|middle school|junior high|lycee|college d'enseignement secondaire|ecole secondaire|ecole primaire|elementary school|diplome d'etudes secondaires|high school diploma|secondaire \d|3eme|troisieme|stage d'observation|stage de decouverte)\b/;
    const stop = new Set((dict.terms && dict.terms.stop) || []);
    const weak = new Set((dict.terms && dict.terms.weak) || []);
    /* I-20: words spelled the same in French and English with a different meaning; never a match on their own */
    const friends = new Set((dict.terms && dict.terms.falseFriends) || []);
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
      let section = "HEADER", offLeft = 0;
      for (const raw of String(text).split("\n")) {
        const lineStart = offset;
        offset += raw.length + 1;
        if (cv) {
          const h = fold(raw).trim();
          if (headings.has(h)) { section = raw.trim().toUpperCase(); offLeft = OFF_SECTION.has(fold(section).trim()) ? OFF_MAX : 0; continue; }
          if (SCHOOL_LINE.test(fold(raw))) { offset = lineStart + raw.length + 1; continue; }
          if (offLeft > 0) { if (h) offLeft--; offset = lineStart + raw.length + 1; continue; }
        }
        const fm = foldMap(raw);
        let line = fm.s;
        /* I-04: on a CV, hide the parts that name an employer or a school before looking for skills */
        if (cv) for (const [a, b] of orgSpans(raw, line)) line = line.slice(0, a) + " ".repeat(b - a) + line.slice(b);
        const spans = {};
        const here = candidates(line);
        for (const s of here) {
          s.re.lastIndex = 0;
          let m;
          while ((m = s.re.exec(line))) {
            const a = m.index + m[1].length, b = m.index + m[0].length;
            (spans[s.name] = spans[s.name] || []).push([a, b]);
          }
        }
        const all = [];
        for (const name in spans) for (const sp of spans[name]) all.push([name, sp]);
        for (const s of here) {
          const own = spans[s.name];
          if (!own) continue;
          const inside = own.every(([a, b]) => all.some(([other, [x, y]]) =>
            other !== s.name && canHide(other, s.name) && x <= a && b <= y && (y - x) > (b - a)));
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
      for (const s of candidates(line)) {
        s.re.lastIndex = 0;
        let m;
        while ((m = s.re.exec(line))) (spans[s.name] = spans[s.name] || []).push([m.index + m[1].length, m.index + m[0].length]);
      }
      const all = [];
      for (const name in spans) for (const sp of spans[name]) all.push([name, sp]);
      const out = [];
      for (const name in spans) {
        const own = spans[name];
        if (own.every(([a, b]) => all.some(([o, [x, y]]) => o !== name && canHide(o, name) && x <= a && b <= y && (y - x) > (b - a)))) continue;
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

    /* What a CV line holds that is not a skill or a phrase of the person: a heading line ("EDUCATION"), the name at the top
       ("Alex Example" in "Alex Example, RN") and dates ("Sep 2025", "- Present"). Same rule as python/terms.py. */
    const CV_DATE = /\b(?:jan(?:uary)?|janv(?:ier)?|feb(?:ruary)?|fev(?:rier)?|mar(?:ch|s)?|apr(?:il)?|avr(?:il)?|may|mai|june?|juin|july?|juil(?:let)?|aug(?:ust)?|aout|sept?(?:ember|embre)?|oct(?:ober|obre)?|nov(?:ember|embre)?|dec(?:ember|embre)?)\.?\s*(?:19|20)\d\d\b|(?:-|\bto\b|\bau\b|\buntil\b)\s*(?:present|current|now|today|aujourd'hui|ce jour|presentement|maintenant|en cours)\b/g;
    const NAME_SEP = /,|\||•|·|\s[-–—]\s/;

    /* I-04: the name of an employer or a school is not a skill.
     * A CV line is cut into parts at commas, bars and dashes. A part is left out of the skill search
     * when it names an organisation: it holds a word that only organisations use (University, Collège,
     * Inc., Ltd, Group…), it is short, and it holds a capitalised word, so it is a name and not a
     * sentence. "B.Eng. Industrial Engineering, Concordia University" keeps the degree and drops the
     * university; "Maintenance (GIM), IUT of Lorient" keeps the trade and drops the school.
     * A part with 8 words or more is kept: at that length it is a sentence, not a name. */
    const ORG_WORD = /\b(?:university|universite|college|cegep|polytechnique|institute|institut|school|schools|ecole|academy|academie|faculty|faculte|inc|ltd|ltee|limited|corp|corporation|incorporated|llc|llp|plc|sarl|gmbh|s\.a|pty|holdings|iut|lycee|high school|elementary school|secondary school)\b|\b(?:group|groupe|enterprises|entreprises|industries)\b(?=[\s.,)]*$)/;
    function orgSpans(raw, s) {
      const out = [];
      let at = 0;
      for (const piece of raw.split(/(,|\||•|·|\t|\s{3,}|\s[-–—]\s)/)) {
        const start = at; at += piece.length;
        const seg = piece.trim();
        if (!seg || seg.length < 3) continue;
        const words = seg.split(/\s+/).filter(Boolean);
        if (words.length > 7) continue;                               /* a sentence, not a name */
        if (!/^\p{Lu}/u.test(seg) && !words.some((w) => /^\p{Lu}\p{L}/u.test(w))) continue;
        if (!ORG_WORD.test(fold(seg))) continue;
        const a = start + piece.indexOf(seg);
        out.push([Math.min(a, s.length), Math.min(a + seg.length, s.length)]);
      }
      return out;
    }
    function cvSkips(raw, s, first) {
      const skip = [];
      CV_DATE.lastIndex = 0;
      let m;
      while ((m = CV_DATE.exec(s))) skip.push([m.index, m.index + m[0].length]);
      skip.push(...orgSpans(raw, s));
      if (first) {
        /* the first line of a CV starts with the person's name: 2 to 4 capitalized words before a comma or a dash */
        const seg = raw.split(NAME_SEP)[0].trim(), words = seg.split(/\s+/).filter(Boolean);
        if (words.length >= 2 && words.length <= 4 && !/\d/.test(seg) && words.every((w) => /^\p{Lu}/u.test(w))) {
          const cut = s.search(NAME_SEP);
          skip.push([0, cut < 0 ? s.length : cut]);
        }
      }
      return skip;
    }

    /* the CV as lines of words, built once per CV */
    function indexCv(text) {
      const lines = [];
      let offset = 0, first = true, section = "HEADER", offLeft = 0;
      for (const raw of String(text).split("\n")) {
        const fm = foldMap(raw), s = fm.s, toks = [];
        const h = fold(raw).trim();
        if (headings.has(h)) { section = raw.trim().toUpperCase(); offLeft = OFF_SECTION.has(fold(section).trim()) ? OFF_MAX : 0; offset += raw.length + 1; continue; }
        if (SCHOOL_LINE.test(h)) { offset += raw.length + 1; continue; }
        if (offLeft > 0) { if (h) offLeft--; offset += raw.length + 1; continue; }
        const skip = headings.has(fold(raw).trim()) ? [[0, s.length]] : cvSkips(raw, s, first && s.trim() !== "");
        if (s.trim()) first = false;
        TOKEN.lastIndex = 0;
        let m;
        while ((m = TOKEN.exec(s))) {
          const a = m.index, b = a + m[0].length;
          if (skip.some(([x, y]) => x <= a && b <= y)) continue;
          toks.push({ n: nw(m[0]), st: stem(m[0]), a, b, w: m[0] });
        }
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
        /* I-20: a word that is written the same in French and in English but means something else
           ("ventes au détail" against "attention to details") never matches on its own. It can still
           match inside a phrase, where the other words settle the meaning. */
        if (friends.has(words[0]) || friends.has(stems[0])) return { st: "G" };
        for (const L of ix) for (const k of L.toks) {
          if (k.st === stems[0] && stems[0].length >= 3) return { st: "R", line: L.raw, shared: [words[0]], cvWord: k.n, spans: [[L.start + toStart(L.fm, k.a), L.start + toEnd(L.fm, k.b)]] };
        }
        return { st: "G" };
      }
      /* a phrase of 2 or 3 words: all its words (of 3 letters or more) on one CV line, in any form or order ("assess patients" /
         "patient assessment"); a longer phrase: at least half of its main words, and at least 2. One shared word is not enough:
         "cutting edge" is not close to "cut changeover time". Same rule as python/terms.py. */
      const main = [];
      words.forEach((w, i) => { if (n <= 3 ? w.length >= 3 : !weak.has(w) && w.length >= 4) main.push([w, stems[i]]); });
      if (!main.length) return { st: "G" };
      const need = n <= 3 ? main.length : Math.max(2, Math.ceil(main.length / 2));
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

    /* A title holds words that are not the job: French gender endings ("Infirmier(ère)", "Conseiller·ère", "H/F"), places
       ("Sept-Îles | Côte-Nord", "Toronto, ON"), the kind of contract or schedule ("Part Time", "Temps plein", "Hybrid") and
       brackets with no skill in them ("(Emailable)", "(12 months)"). They never match a CV, yet the title is most of Role fit,
       so they are taken out of the title before its keywords are read. Brackets that name a skill ("(React)") stay. */
    const T_GENDER = /\((?:\s*-\s*)?(?:e|es|ne|nes|se|ses|ere|eres|euse|euses|trice|trices|ice|le|te|ve|fe|eur)\s*\)|[·•/](?:e|es|ne|ere|euse|trice)\b|\.(?:ere|euse|trice)\b|\(?\b[hfm]\s*\/\s*[hfmx](?:\s*\/\s*[hfmx])?\b\)?/g;
    const T_PLACE = new RegExp("\\b(?:" + [
      "quebec|ontario|alberta|manitoba|saskatchewan|nova scotia|nouvelle-ecosse|new brunswick|nouveau-brunswick|newfoundland(?: and labrador)?|terre-neuve(?:-et-labrador)?",
      "prince edward island|ile-du-prince-edouard|british columbia|colombie-britannique|yukon|nunavut|northwest territories|territoires du nord-ouest|canada",
      "abitibi(?:-temiscamingue)?|cote-nord|gaspesie|bas-saint-laurent|saguenay(?:-lac-saint-jean)?|lac-saint-jean|monteregie|laurentides|lanaudiere|estrie",
      "outaouais|mauricie|chaudiere-appalaches|centre-du-quebec|nord-du-quebec|capitale-nationale|iles-de-la-madeleine",
      "montreal|toronto|vancouver|calgary|edmonton|ottawa|gatineau|laval|longueuil|mississauga|brampton|hamilton|winnipeg|halifax|saskatoon|regina|kitchener",
      "markham|vaughan|burnaby|surrey|sherbrooke|trois-rivieres|levis|sept-iles|rimouski|chicoutimi|saint-jerome|saint-jean-sur-richelieu|drummondville|granby",
      "boucherville|brossard|terrebonne|repentigny|blainville|mirabel|dorval|pointe-claire|kingston|windsor|oshawa|barrie|guelph|burlington|oakville|moncton",
      "fredericton|charlottetown|kelowna|kamloops|nanaimo|red deer|lethbridge|whitehorse|yellowknife|iqaluit|val-d'or|rouyn-noranda|baie-comeau|joliette",
      "victoriaville|shawinigan|thetford mines|saint-hyacinthe|valleyfield|vaudreuil|chateauguay|amos|alma|gaspe|matane"].join("|") + ")\\b", "g");
    const T_CODE = /\b(?:QC|ON|AB|BC|MB|SK|NS|NB|NL|PE|PEI|YT|NT|NU)\b/g;   // province codes, only in capitals ("on" is a word)
    const T_NOISE = /\b(?:full[- ]time|part[- ]time|temps (?:plein|partiel)|permanent|temporary|temporaire|contract|contractuel|contrat|seasonal|saisonnier|casual|occasionnel|on[- ]call|sur appel|remote|hybrid|hybride|on[- ]site|onsite|teletravail|sur place|en presentiel|open applications?|general application(?: form)?|candidature spontanee|job fair|urgent(?:ly)?|immediate (?:start|hire)|now hiring|hiring|day shift|night shift|evening shift|quart de (?:jour|nuit|soir))\b/g;
    function cleanTitle(title) {
      title = String(title || "");
      const fm = foldMap(title), s = fm.s, cut = [];
      /* a gender ending is removed outright ("Préposé(e) aux bénéficiaires" -> "Préposé aux bénéficiaires"); anything else leaves a break */
      const take = (re, str, join) => { re.lastIndex = 0; let m; while ((m = re.exec(str))) { if (!m[0].length) { re.lastIndex++; continue; } cut.push([m.index, m.index + m[0].length, join]); } };
      take(T_GENDER, s, true); take(T_PLACE, s); take(T_NOISE, s);
      /* province codes: on the original title (they must be capitals), whose positions are those of s when the title is plain ASCII */
      if (!fm.idx) take(T_CODE, title);
      else { T_CODE.lastIndex = 0; let m; while ((m = T_CODE.exec(title))) { const a = fm.idx.indexOf(m.index); if (a >= 0) cut.push([a, a + m[0].length]); } }
      /* brackets with no skill of the dictionary in them */
      const B = /\(([^()]*)\)|\[([^[\]]*)\]/g;
      let m;
      while ((m = B.exec(s))) {
        const inner = title.slice(toStart(fm, m.index + 1), toEnd(fm, m.index + m[0].length - 1));
        if (!Object.keys(find(inner)).length) cut.push([m.index, m.index + m[0].length]);
      }
      if (!cut.length) return title;
      cut.sort((a, b) => a[0] - b[0]);
      let out = "", pos = 0;
      for (const [a, b, join] of cut) {
        const A = toStart(fm, a), Bn = toEnd(fm, b);
        if (A < pos) { pos = Math.max(pos, Bn); continue; }
        out += title.slice(pos, A) + (join ? "" : " , ");   // a comma: the words on each side are not one phrase
        pos = Bn;
      }
      out += title.slice(pos);
      /* a bracket that stays (it names a skill) is set aside while the leftover separators are tidied, so its ")" is not
         taken for one ("Registered Nurse (RN), Part Time" gives "Registered Nurse (RN)", not "Registered Nurse (RN") */
      const kept = [];
      out = out.replace(/\(([^()]*[a-z0-9][^()]*)\)/gi, (m, inner) => {
        kept.push("(" + inner.replace(/\s+/g, " ").replace(/(?:\s*[,|\-–—/:]\s*){2,}/g, " , ").replace(/^[\s,|\-–—/:]+|[\s,|\-–—/:]+$/g, "") + ")");
        return "\u0000" + (kept.length - 1) + "\u0001";
      });
      out = out.replace(/\s+/g, " ").replace(/(?:\s*[,|\-–—/:()]\s*){2,}/g, " , ").replace(/^[\s,|\-–—/:.]+|[\s,|\-–—/:.]+$/g, "").trim();
      return out.replace(/\u0000(\d+)\u0001/g, (_, i) => kept[+i]);
    }

    /* I-13: a posting carries text that is not about the work. The lines that are only an
     * administrative label and its value (Job ID, Application Deadline, Contact, Salary, Posting
     * Status...) and the paragraphs at the end about equal opportunity and how to apply are cut
     * before the keywords are read, so a contact's name, a postal code or "Post Internally" can no
     * longer be listed as a skill the CV is missing. Lines that do say something about the work
     * (Education, Experience, Languages, Skills, Duties...) are kept. The person still sees the
     * whole posting: only the keyword reading uses the shortened text. */
    const ADMIN_LABEL = /^\s*(?:job\s*(?:id|number|code|req|requisition)|requisition(?:\s*(?:id|number))?|competition(?:\s*number)?|reference(?:\s*number)?|posting\s*(?:id|status|date|type|period)|post(?:ed|ing)?\s*(?:internally|externally|date|on)|application\s*deadline|apply\s*by|closing\s*date|date\s*(?:posted|limite)|deadline|position\s*title|job\s*title|titre\s*du\s*poste|location|lieu(?:\s*de\s*travail)?|city|province|state|address|adresse|postal\s*code|code\s*postal|salary|pay(?:\s*range|\s*rate)?|wage|remuneration|salaire|hourly|contact(?:\s*(?:person|name|information|us))?|personne[- ]ressource|courriel|e?-?mail|telephone|phone|tel|fax|website|site\s*web|url|number\s*of\s*(?:positions|vacancies)|vacancies|poste[s]?\s*vacant[s]?|hours?(?:\s*per\s*week)?|heures|shift|quart\s*de\s*travail|start\s*date|date\s*de\s*debut|employment\s*(?:type|status)|union|syndicat|classification|pay\s*grade|grade|division|bargaining\s*unit|ops\s*ops|category|categorie|sector|noc|job\s*bank|source)\s*[:\-\u2013]\s*\S/i;
    const TAIL_LINE = /\b(?:equal opportunit|equal employment|accommodation|accessibilit|we thank all applicant|only those selected|only candidates selected|will be contacted|how to apply|apply (?:online|now|today|via|through|by)|submit your (?:resume|application)|please (?:apply|submit|send)|background check|criminal record check|employeur souscrit|equite en matiere d'emploi|nous remercions|seules les personnes|mesures d'adaptation|comment postuler|faire parvenir votre|veuillez (?:postuler|soumettre|faire))\b/i;
    function trimPosting(body) {
      const lines = String(body).split("\n");
      const out = [];
      let cut = lines.length;
      for (let i = Math.max(0, Math.floor(lines.length / 2)); i < lines.length; i++) {
        if (TAIL_LINE.test(lines[i])) { cut = i; break; }           /* the end of the posting, not the work */
      }
      for (let i = 0; i < cut; i++) {
        const l = lines[i];
        if (ADMIN_LABEL.test(l) && l.trim().split(/\s+/).length <= 14) continue;
        out.push(l);
      }
      return out.join("\n");
    }
    /* a phrase that is plainly not a skill: a postal code, an amount of money, a code, a bare number */
    const JUNK_TERM = /\b[a-z]\d[a-z]\s?\d[a-z]\d\b|\$|\b\d+[.,]\d{2}\b|\b(?:\d+\s*)?(?:per|par)\s*(?:hour|heure|annum|an|year|annee)\b|^\W*\d[\d\s.,-]*\W*$|\b[a-z]{1,3}\d{3,}\b|\b(\w+)\s+\1\b/i;

    /* I-13, part two. The Job Bank occupations come with their keywords worked out in advance, so they
     * never pass through profile() above. Half a sentence is listed as a skill the CV is missing
     * ("efficient manner", "oversee operational", "coordinate activities", "accessible manner"). A
     * phrase that begins or ends on one of these words says nothing on its own, so it is dropped.
     * A skill from the dictionary is never dropped: only loose phrases. */
    /* A phrase that ENDS on one of these says nothing on its own: "efficient manner", "oversee
     * operational", "coordinate activities". */
    const LAST_BAD = new Set(("manner manners basis way ways activities activity tasks duties matters items " +
      "aspects areas issues needs levels operational appropriate various relevant necessary required " +
      "daily timely efficient effective overall general other others related applicable additional " +
      "suitable obtained assigned provided needed requested ongoing accessible internal external " +
      "proper correct available possible usage use uses clean " +
      /* French. 1,010 postings were asking for "personne retenue" (the person selected), "conduire
         valide" (from "permis de conduire valide", which belongs to the licence check) and
         "diplome reconnu" as if they were skills. Accents are already stripped by fold(). */
      "retenue retenu retenus suivantes suivants suivante suivant reconnu reconnue connexes connexe " +
      "pouvant necessaires necessaire requises requise pertinentes pertinente appropriees appropriee " +
      "diverses variees similaires associees demandees exigees preuve valide valides dessous " +
      "souhaitable souhaitables").split(/\s+/).filter(Boolean));
    /* A phrase that BEGINS with one of these says nothing either. The two lists are kept apart on
     * purpose: "general labourer" and "heavy duty technician" are real jobs, and an earlier version
     * that used one list for both ends threw 771 real keywords away. */
    const FIRST_BAD = new Set(("efficient effective various relevant necessary appropriate ongoing proper " +
      "correct overall timely daily additional other others related applicable suitable accessible " +
      "available possible operational " +
      /* French openers that qualify rather than name: "bonne connaissance de", "interet marque",
         "souhaitez parfaire". "marque" is deliberately NOT in LAST_BAD, because a phrase can end on
         it and be real (image de marque, gestion de marque). */
      "interet remarque remarques avancement souhaitez souhaite soutient taches bonne bonnes " +
      "excellente excellentes solide solides forte fortes grande grandes").split(/\s+/).filter(Boolean));

    /* A posting's own form labels, read as one-word skills: "Description", "Schedule", "Standard",
     * "Office", "Fri". On their own they say nothing about the work. A dictionary skill of the same
     * name (Microsoft Office, Scheduling) is untouched: this only drops loose single words. */
    const LABEL_WORD = new Set(("description schedule standard conditions requirements qualifications responsibilities " +
      "overview summary benefits salary wage department location title posting position status type category shift " +
      "hours ops opsops apply application deadline reference competition division classification union grade " +
      "mon tue tues wed thu thur thurs fri sat sun monday tuesday wednesday thursday friday saturday sunday " +
      "january february march april june july august september october november december lundi mardi mercredi " +
      "jeudi vendredi samedi dimanche poste lieu salaire horaire statut categorie " +
      "usually typically often generally normally sometimes less more extensive several completion " +
      "preferred asset minimum maximum equivalent plus various including etc may might " +
      /* French form labels, read as one-word skills on their own */
      "detenir posseder consentement exigence exigences atout atouts profil candidat candidats " +
      "candidate candidature entreprise employeur offre mandat aptitudes remuneration avantages " +
      "description sommaire responsabilite responsabilites qualification qualifications").split(/\s+/).filter(Boolean));
    function usefulKw(code) {
      const n = String(code).slice(3);
      if (String(code)[1] === "s") return true;                 /* a skill from the dictionary */
      const w = fold(n).split(/[^a-z0-9+#]+/).filter(Boolean);
      if (!w.length) return false;
      if (FIRST_BAD.has(w[0]) || LAST_BAD.has(w[w.length - 1])) return false;
      if (w.length === 1 && LABEL_WORD.has(w[0])) return false;
      /* the degree a posting asks for is scored in the education part; as a "skill" it is a phrase
         nobody can have ("post-secondary education program", "completion of a college program") */
      if (/\b(post-?secondary|education program|degree program|diploma program|completion of|undergraduate degree|graduate degree)\b/.test(fold(n))) return false;
      if (JUNK_TERM.test(n)) return false;
      return true;
    }

    function profile(title, body, max) {
      max = max || 40;
      title = cleanTitle(title);
      body = trimPosting(body || "");
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
        if (JUNK_TERM.test(e.name)) continue;                        /* I-13 */
        kt++;
        if (e.words.every(w => LEVEL_WORDS.has(w))) continue;
        rows.push({ code: t + "t|" + e.name, t, k: 1, w: e.words.length, c: e.count, f: e.first });
      }
      /* A broad skill can swallow the job itself: "Registered Nurse", "Physiotherapist" and "Préposé aux bénéficiaires" are all the
         skill "Healthcare and clinical", "Line cook" and "Cashier" are "Food safety and hospitality". In the title, the words a
         skill was found by are also kept as a title phrase when they are not the skill's own name and they end the job's name
         (followed by the end of the title or a break), so a nurse's CV tells a nurse posting from a physiotherapist posting.
         A skill word that only qualifies the job is not added ("Nursing" in "Nursing Unit Clerk": the job is "Unit Clerk"),
         nor a title that is the skill's own name ("Sales"), nor the industry after the job ("general labourer - manufacturing"). */
      const own = (x) => fold(x).split(/[^a-z0-9+#]+/).filter(Boolean).map(nw).join(" ");
      const seenT = new Set(rows.filter((r) => r.t === "T").map((r) => own(r.code.slice(3))));
      const endsName = (b) => /^\s*(?:$|[,|\-–—/:(\[*.;])/.test(text.slice(b, tl).replace(/^(?:\s+(?:i{1,3}|iv|[1-5]|senior|junior|sr|jr)\b\.?)+/i, ""));
      /* only in the first part of the title: after " - " or a comma, Job Bank titles name the industry ("manager, operations - manufacturing") */
      const cut = text.slice(0, tl).search(/\s[-–—]\s|\s*\|\s*|,/), firstPart = cut < 0 ? tl : cut;
      for (const n in job) {
        /* a title that also writes the skill's own name (a bilingual title: "Amélioration continue / Continuous Improvement") needs no more */
        if (job[n].spans.some(([a, b]) => b <= tl && own(text.slice(a, b)) === own(n))) continue;
        for (const [a, b] of job[n].spans) {
          if (b > firstPart || !endsName(b)) continue;
          const name = text.slice(a, b).replace(/\s+/g, " ").trim(), key = own(name);
          if (!key || key === own(n) || seenT.has(key) || key.length < 3 || key.split(" ").every((w) => LEVEL_WORDS.has(w))) continue;
          seenT.add(key);
          kt++;
          rows.push({ code: "Tt|" + name, t: "T", k: 1, w: key.split(" ").length, c: 1, f: a });
        }
      }
      rows.sort((a, b) => TAGRANK[a.t] - TAGRANK[b.t] || a.k - b.k || b.w - a.w || b.c - a.c || a.f - b.f);
      const keep = rows.filter(r => r.t !== "A" && usefulKw(r.code));
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
      const dec = kw.filter(usefulKw).map(c => ({ n: c.slice(3), kind: c[1], tag: c[0] }));
      const skills = dec.filter(x => x.kind === "s");
      const linked = new Set();
      if (skills.length) {
        const fake = {};
        skills.forEach(x => { fake[x.n] = {}; });
        report("", cvFound, fake).links.forEach(l => linked.add(l.job));
      }
      return dec.map(x => {
        if (x.kind === "s") {
          const f = cvFound[x.n];
          /* a skill that comes from a credential instead of from the CV's own words carries "via";
             a side skill of a credential, and a degree's subjects, count half (half: true).
             "w" is how much the line it was found on still counts: older work counts less (I-03). */
          x.st = f ? (f.half ? "R" : "M") : linked.has(x.n) ? "R" : "G";
          if (f) { if (f.via) x.via = f.via; if (f.w != null) x.cvW = f.w; }
          return x;
        }
        const w = termWords(x.n);
        x.st = w.length ? matchTerm(w, ix).st : "G";
        return x;
      });
    }

    return { profile, cleanTitle, profileStatus, usefulKw, termWords, find, findCv, report, flags, sections, tagOf, terms, indexCv, matchTerms, termsOn, stopWords: [...stop].sort(), weakWords: [...weak].sort(), meta: dict.meta || {}, size: skills.length, soft: dict.soft || [] };
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
