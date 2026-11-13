/* pasteparse.js - read a job posting that was copied from LinkedIn, Indeed, Job Bank, an employer page or an email.
 *
 * The site cannot read those boards for you, so the person copies the posting and pastes it. This file finds the parts a copy nearly always carries
 * (job title, employer, place, kind of job, link) so the person does not have to type them, and separates them from the description.
 * It is a rule reader, not a language model, and it only fills what it can see in the text:
 *   - a labelled line ("Company: ABB", "Employeur : ...", "COMPANY: ABB | LOCATION: Dorval, QC") is taken as written;
 *   - otherwise the top of the copy is read in the order the boards print it: title, then employer, then place and kind of job;
 *   - a first line that reads like a sentence is not guessed to be a title; the field stays empty and the person types it.
 * The page shows every field it filled, and each one can be changed before the posting is scored. Nothing is sent anywhere.
 *
 * Pasteparse.read(text) -> { title, company, loc, mode, type, typeSeen, url, body, found }
 *   type: "" (full-time or not stated), "Part-time" or "Internship": the same three values as the "Add a posting" form.
 *   typeSeen: true when the text itself says the type (including "full-time"), so the page can show it as read.
 *   mode: "On-site", "Hybrid" or "Remote" when the text says it; it is shown, never scored.
 *   body: the description without the header lines that were read and without button text such as "Show more" or "Easy Apply".
 *   found: which of title, company, loc, type, link were read from the text.
 * Pasteparse.problem({ title, company, body }) -> "" or the sentence to show when the posting cannot be scored yet
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Pasteparse = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MAX = 30000;      /* the same cap as the "Add a posting" form */
  const MIN_BODY = 80;    /* the same minimum: fewer characters than this cannot be scored */
  const HEADER = 14;      /* the labels and the title block are looked for in the first lines only */

  const PROV = "QC|ON|BC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU|Qu[eé]bec|Ontario|British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Newfoundland(?: and Labrador| & Labrador)?|Prince Edward Island|Yukon|Northwest Territories|Nunavut";
  const NAME = "[\\p{L}][\\p{L}.'’\\- ]{1,40}?";
  const LOC_RES = [
    new RegExp("^" + NAME + ",\\s*(?:" + PROV + ")(?:\\s*,\\s*Canada)?$", "iu"),
    new RegExp("^" + NAME + "\\s*\\((?:" + PROV + ")\\)$", "iu"),                                       /* Montréal (QC) */
    /^[\p{L}][\p{L}.'’\- ]{1,40}?,\s*[A-Z]{2}(?:\s+\d{5})?(?:,\s*(?:United States|USA|US|Canada))?$/u,  /* Boston, MA */
    /^(?:greater |grand |region de |région de )?(?:montr[eé]al|toronto|ottawa|vancouver|calgary|edmonton|winnipeg|qu[eé]bec(?: city| city)?|halifax|laval|longueuil|gatineau|mississauga|brampton|hamilton|kitchener|waterloo|victoria|saskatoon|regina|fredericton|moncton|sherbrooke|trois-rivi[eè]res|dorval|brossard|saint-laurent|boucherville|vaudreuil-dorion)(?: area| metropolitan area| region| metro)?(?:,\s*(?:canada))?$/iu,
    /^(?:remote|t[eé]l[eé]travail|[aà] distance|canada|anywhere in canada|partout au canada)(?:\s*[,–-]\s*canada)?$/iu
  ];
  const isLoc = (s) => LOC_RES.some((re) => re.test(s));

  /* text that is a button, a count or a time on the board, not part of the posting */
  const UI = /^(?:skip to (?:main )?content|show (?:more|less)(?: options)?|see (?:more|less)|easy apply|apply(?: now| on company website| on employer site)?|save(?:d)?(?: job)?|share|copy link|report(?: this job)?|set (?:job )?alerts?|create (?:job )?alert|follow|promoted|actively (?:hiring|recruiting)|reposted.*|be an early applicant|be among the first .*|(?:over )?\d[\d,]*\+? (?:applicants?|candidates?|people clicked apply|clicks?)|\d+ (?:minutes?|hours?|days?|weeks?|months?) ago|posted .{0,30} ago|just posted|il y a \d+ .*|candidature simplifi[eé]e|postuler(?: maintenant)?|enregistrer|partager|signaler|afficher (?:plus|moins)|voir (?:plus|moins)|about the job|job details?|full job description|description du poste|d[eé]tails? de l.emploi|meet the hiring team|more jobs|similar jobs|show all|sign in|join now|new|\d(?:\.\d)?\s*(?:★|stars?|out of 5.*)?)$/i;
  /* the trailing "2 weeks ago", "Over 100 applicants" a board prints after the place */
  const META_TAIL = /\s*[·•|,-]?\s*(?:\d+\s+(?:minute|hour|day|week|month)s?\s+ago|il y a \d+\s+\w+|reposted.*|(?:over\s+)?\d[\d,]*\+?\s+(?:applicants?|candidates?)|be among the first.*|promoted|easy apply|actively (?:hiring|recruiting))\s*$/i;
  const MODE = /\(?\b(on-?site|sur place|hybrid|hybride|remote|t[eé]l[eé]travail|[aà] distance)\b\)?/i;
  const ROLE = /\b(?:intern(?:ship)?s?|co-?op|stagiaires?|stages?|engineer(?:ing)?s?|ing[eé]nieur\w*|analysts?|analystes?|managers?|coordinat\w+|technicians?|technicien\w*|assistants?|developers?|d[eé]veloppeu\w+|specialists?|sp[eé]cialistes?|associates?|directors?|designers?|scientists?|accountants?|comptables?|nurses?|infirmi\w+|clerks?|representatives?|agents?|officers?|supervisors?|superviseurs?|planners?|buyers?|programmers?|consultants?|advisors?|advisers?|conseill\w+|operators?|op[eé]rateurs?|administrators?|leads?|heads?|cashiers?|drivers?|chefs?|cooks?|teachers?|researchers?|architects?|auditors?|writers?|editors?|trainees?|apprentic\w+|apprenti\w*|workers?|helpers?|laborers?|labourers?|mechanics?|electricians?|welders?|machinists?|inspectors?|estimators?|schedulers?|dispatchers?|handlers?|associ[eé]s?|g[eé]rants?|chargé\w*|responsables?)\b/i;

  /* "Intern", "Co-op", "Stagiaire" mean an internship; "part-time" means part-time. Full-time and contract are the default and read as "" */
  function typeOf(s) {
    const t = String(s || "");
    if (/\b(?:intern(?:ship)?s?|co-?op|stagiaires?|stages?|apprentice(?:ship)?s?)\b/i.test(t)) return "Internship";
    if (/\bpart[- ]?time\b|\btemps partiel\b/i.test(t)) return "Part-time";
    return "";
  }
  const TYPE_WORDS = /\b(?:full[- ]?time|part[- ]?time|intern(?:ship)?s?|co-?op|contract|temporary|permanent|temps (?:plein|partiel)|stages?|stagiaires?|cdi|cdd|apprentice(?:ship)?)\b/i;
  const looksType = (s) => s.length <= 90 && s.split(/\s+/).length <= 12 && TYPE_WORDS.test(s) && !/[.!?]$/.test(s);

  const LABELS = [
    ["title", /^(?:job\s*title|title|position(?: title)?|role|job|poste|titre(?: du poste)?|emploi)$/i],
    ["company", /^(?:company(?: name)?|employer|organi[sz]ation|entreprise|employeur|soci[eé]t[eé])$/i],
    ["loc", /^(?:location|work location|lieu(?: de travail)?|place|city|ville|endroit)$/i],
    ["type", /^(?:job type|employment type|type d.emploi|type de poste|type)$/i],
    ["url", /^(?:link|url|apply(?: link)?|lien)$/i],
    ["posted", /^(?:posted|date posted|date|publi[eé]e?|date de publication)$/i],
    ["source", /^source$/i]
  ];
  const labelOf = (k) => { const n = k.trim(); for (const [f, re] of LABELS) if (re.test(n)) return f; return ""; };
  /* "COMPANY: ABB | LOCATION: Dorval, Quebec, Canada | POSTED: 2026-10-15": every part must be a known label, or the line is text */
  function labelled(line) {
    const parts = line.split(/\s+\|\s+/), out = [];
    for (const p of parts) {
      const m = /^([\p{L}'’ ]{2,24}?)\s*:\s*(.+)$/u.exec(p.trim());
      const f = m ? labelOf(m[1]) : "";
      if (!f) return null;
      out.push([f, m[2].trim()]);
    }
    return out.length ? out : null;
  }

  const lenOk = (s) => s.length >= 2 && s.length <= 120;
  const words = (s) => s.split(/\s+/).filter(Boolean).length;
  const looksTitle = (s) => lenOk(s) && words(s) <= 14 && !/[.:;!?]$/.test(s) && !isLoc(s) && !UI.test(s) && !/^https?:\/\//i.test(s) && !/\b(?:an? hour|per hour|\/hr|a year|per year|\$\d)/i.test(s);
  /* "Bombardier Inc." and "Usine Delta ltée." end in a full stop that is part of the name; a sentence that ends in one is not an employer */
const SUFFIX = /\b(?:inc|ltd|ltee|ltée|corp|co|llc|llp|plc|sa|s\.a|gmbh|ag|bv|enr|sencrl|s\.e\.n\.c\.r\.l)\.$/i;
  const looksCompany = (s) => s.length >= 2 && s.length <= 70 && words(s) <= 9 && (!/[.!?:;]$/.test(s) || SUFFIX.test(s)) && !isLoc(s) && !UI.test(s) && !/^https?:\/\//i.test(s) && !/\$\s?\d|\b(?:an? hour|per hour|a year|per year)\b/i.test(s) && !looksType(s);

  /* a board line such as "Dorval, Quebec, Canada · 2 weeks ago · Over 100 applicants (Hybrid)": the place, and the work mode if it is in brackets */
  function placeOf(line) {
    let s = line, mode = "";
    for (let i = 0; i < 4; i++) { const t = s.replace(META_TAIL, "").trim(); if (t === s) break; s = t; }
    const m = /\(\s*(on-?site|sur place|hybrid|hybride|remote|t[eé]l[eé]travail|[aà] distance)\s*\)\s*$/i.exec(s);
    if (m) { mode = modeName(m[1]); s = s.slice(0, m.index).trim(); }
    s = s.replace(/[·•|,\-–\s]+$/, "").trim();
    return { loc: s, mode };
  }
  function modeName(w) {
    const t = w.toLowerCase();
    return /hybrid/.test(t) ? "Hybrid" : /remote|t[eé]l[eé]travail|distance/.test(t) ? "Remote" : "On-site";
  }

  const BOARD_URL = /linkedin\.com\/(?:jobs|comm\/jobs)|indeed\.|jobbank\.gc\.ca|guichetemplois\.gc\.ca|glassdoor\.|monster\.|workopolis\.|talent\.com|jobillico\.|myworkdayjobs\.com|greenhouse\.io|lever\.co|smartrecruiters\.com|ashbyhq\.com|workable\.com|icims\.com|taleo\.net|jobs\./i;
  function urlOf(lines) {
    const all = [];
    lines.forEach((l, i) => { const re = /https?:\/\/[^\s<>"')\]]+/gi; let m; while ((m = re.exec(l))) all.push({ u: m[0].replace(/[.,;:!?]+$/, ""), i, alone: l.trim() === m[0] }); });
    const ok = all.filter((x) => !/\.(?:png|jpe?g|gif|svg|webp|css|js)(?:\?|$)/i.test(x.u));
    return ok.find((x) => BOARD_URL.test(x.u)) || ok.find((x) => x.alone && x.i < HEADER) || null;
  }

  function read(text) {
    let raw = String(text == null ? "" : text).replace(/\r\n?/g, "\n").replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\u00a0/g, " ").replace(/[ \t]+$/gm, "");
    raw = raw.replace(/\n{3,}/g, "\n\n").trim();
    const lines = raw.split("\n");
    const out = { title: "", company: "", loc: "", mode: "", type: "", typeSeen: false, url: "", body: "", found: [] };
    const drop = new Set();
    const set = (f, v) => { if (v && !out[f]) { out[f] = v; return true; } return false; };

    /* header zone: the first non-empty lines */
    const zone = [];
    for (let i = 0; i < lines.length && zone.length < HEADER; i++) if (lines[i].trim()) zone.push(i);

    /* 1. labelled lines are taken as written */
    for (const i of zone) {
      const L = labelled(lines[i].trim());
      if (!L) continue;
      drop.add(i);
      for (const [f, v] of L) {
        if (f === "title") set("title", v);
        else if (f === "company") set("company", v);
        else if (f === "loc") { const p = placeOf(v); set("loc", p.loc); if (p.mode) out.mode = p.mode; }
        else if (f === "type") { out.typeSeen = true; out.type = out.type || typeOf(v); }
        else if (f === "url" && /^https?:\/\//i.test(v)) set("url", v.replace(/[.,;:!?]+$/, ""));
      }
    }

    /* 2. the title block, in the order the boards print it */
    const cand = zone.filter((i) => !drop.has(i)).map((i) => ({ i, s: lines[i].trim() }));
    let k = 0;
    while (k < cand.length && (/ logo$/i.test(cand[k].s) || UI.test(cand[k].s))) { drop.add(cand[k].i); k++; }
    if (!out.title && k < cand.length) {
      const a = cand[k], b = cand[k + 1];
      if (looksTitle(a.s)) {
        /* some boards print the employer first: when the first line has no job word and the second has, the first is the employer */
        if (b && !out.company && !ROLE.test(a.s) && ROLE.test(b.s) && looksTitle(b.s) && looksCompany(a.s)) { out.title = b.s; out.company = a.s; drop.add(a.i); drop.add(b.i); k += 2; }
        else { out.title = a.s; drop.add(a.i); k++; }
      }
    }
    /* the next few lines: employer, place, kind of job, and the counts and times that are only board text */
    for (let n = 0; k < cand.length && n < 6; k++, n++) {
      const c = cand[k], s = c.s;
      if (UI.test(s)) { drop.add(c.i); continue; }
      if (/ logo$/i.test(s)) { drop.add(c.i); continue; }
      const parts = s.split(/\s+[·•|]\s+|\s+[-–—]\s+/).map((x) => x.trim()).filter(Boolean);
      const first = placeOf(parts[0] || s);
      /* "Bombardier - Dorval, QC" or "ABB · Dorval, Quebec · 2 weeks ago" */
      if (parts.length > 1 && !isLoc(first.loc) && parts.slice(1).some((p) => isLoc(placeOf(p).loc)) && looksCompany(parts[0])) {
        const lp = placeOf(parts.slice(1).find((p) => isLoc(placeOf(p).loc)));
        if (set("company", parts[0])) { set("loc", lp.loc); if (lp.mode) out.mode = lp.mode; drop.add(c.i); const tp = parts.find((p) => looksType(p)); if (tp) { out.typeSeen = true; out.type = out.type || typeOf(tp); } continue; }
      }
      const pl = placeOf(s);
      if (isLoc(pl.loc)) { if (set("loc", pl.loc)) { if (pl.mode) out.mode = pl.mode; drop.add(c.i); } continue; }
      if (looksType(s) || (parts.length > 1 && parts.some(looksType) && !ROLE.test(parts[0]))) { out.typeSeen = true; out.type = out.type || typeOf(s); drop.add(c.i); const mm = MODE.exec(s); if (mm && !out.mode) out.mode = modeName(mm[1]); continue; }
      if (/^(?:on-?site|hybrid|remote|sur place|hybride)$/i.test(s)) { if (!out.mode) out.mode = modeName(s); drop.add(c.i); continue; }
      if (!out.company && looksCompany(s)) { out.company = s; drop.add(c.i); continue; }
      if (/\b(?:an? hour|per hour|a year|per year)\b|\$\s?\d/i.test(s) && s.length <= 70) { drop.add(c.i); continue; }   /* a pay line is not part of the description to score */
      break;   /* the first line that is none of these is where the description begins */
    }

    /* 3. the kind of job: the title and the header said it, or the body states it in a labelled phrase */
    if (!out.type && out.title) { const t = typeOf(out.title); if (t) { out.type = t; out.typeSeen = true; } }
    let body = lines.filter((l, i) => !drop.has(i)).filter((l) => !UI.test(l.trim())).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!out.typeSeen) {
      const m = /\b(?:employment|job|position)\s+type\s*[:\-–]\s*([^\n]{3,40})/i.exec(body) || /\btype d.emploi\s*[:\-–]\s*([^\n]{3,40})/i.exec(body) || /\bthis\s+(?:is\s+)?(?:a|an)\s+(part[- ]time|full[- ]time|intern(?:ship)?|co-?op)\b/i.exec(body);
      if (m) { out.typeSeen = true; out.type = typeOf(m[1]); }
    }

    /* 4. the link */
    const u = out.url ? null : urlOf(lines);
    if (u) out.url = u.u;

    out.body = (body || raw).slice(0, MAX);
    if (out.title) out.found.push("title");
    if (out.company) out.found.push("company");
    if (out.loc) out.found.push("loc");
    if (out.typeSeen) out.found.push("type");
    if (out.url) out.found.push("link");
    return out;
  }

  /* the same three checks as the "Add a posting" form, in one place */
  function problem(f) {
    const t = String((f && f.title) || "").trim(), c = String((f && f.company) || "").trim(), b = String((f && f.body) || "").trim();
    if (t.length < 3) return "Add the job title.";
    if (c.length < 2) return "Add the employer.";
    if (b.length < MIN_BODY) return "Paste at least a few lines of the posting, so it can be scored.";
    return "";
  }

  return { read, problem, typeOf, isLoc, MAX, MIN_BODY };
});
