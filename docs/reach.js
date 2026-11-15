/* reach.js - people-search links and message drafts for reaching out about a posting.
 *
 * A referral or a short conversation with someone who works there is how many students get a first look, and most boards do not help with it.
 * This file only builds TEXT for the person to use. It never sends anything, never contacts anyone and never reads a profile:
 *   - links: addresses of search pages on LinkedIn and Google that the person opens in their own tab (alumni of their school at the employer,
 *     recruiters, people who do the same job, team leads, the company page, the employer's own student pages). Only the employer name, the role
 *     words from the title and the school the person typed go into an address. The CV, the name and the program never do.
 *   - drafts: short messages in English or French with the person's own words filled in. A skill is named only when the page passes it, and the
 *     page passes only skills that are written on the CV and asked for by the posting. Nothing else about the person is claimed.
 *
 * Reach.hidden(company) -> true when the posting does not name the employer ("Confidential", "Confidentiel"...), so there is nobody to look for
 * Reach.orgOf(company)  -> the name to search for: legal endings ("Inc.", "Ltée", "S.E.C.") and a "(Canada)" tail removed
 * Reach.roleOf(title)   -> the role words of the title, without the kind of job, the term and the year: "Industrial Engineering Intern - Winter 2027" -> "Industrial Engineering"
 * Reach.links({ company, title, school }) -> [{ id, label, why, url }]
 * Reach.drafts({ company, title, lang, name, program, school, skills }) -> [{ id, label, use, text, max, over }]
 *   max: a length limit that the text was fitted to (the short note for a connection request), or 0. over: true when even the shortest version is longer.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Reach = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const NOTE_MAX = 200;       /* a connection note: short enough for the shortest limit LinkedIn has used */
  const clean = (s) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  const noQuotes = (s) => s.replace(/["“”«»]/g, "").trim();

  const HIDDEN = /confidenti|anonym|undisclosed|not disclosed|non divulgu|private employer|employeur priv|hidden employer/i;
  function hidden(company) {
    const c = clean(company);
    return c.length < 2 || HIDDEN.test(c);
  }

  /* "ABB Canada Inc." -> "ABB Canada"; "Bombardier inc." -> "Bombardier"; "Desjardins Groupe d'assurances générales (Canada)" keeps its words */
  const ENDING = /[\s,]+(?:inc|incorporated|ltd|limited|ltée|ltee|llc|corp|corporation|co|company|s\.?e\.?c|s\.?e\.?n\.?c|s\.?a|gmbh|l\.?p|ulc|plc)\.?$/i;
  function orgOf(company) {
    let c = noQuotes(clean(company)).replace(/\s*\([^)]*\)\s*$/, "").trim();
    for (let i = 0; i < 3; i++) { const n = c.replace(ENDING, "").replace(/[\s,;-]+$/, "").trim(); if (n === c) break; c = n; }
    return c.length >= 2 ? c : noQuotes(clean(company));
  }

  /* the kind of job, the term and the year are not what the person does; what is left is what to search for */
  const KIND_WORDS = "intern(?:ship)?s?|co-?op|stagiaires?|stages?|student|étudiant(?:e)?s?|etudiant(?:e)?s?|part[- ]time|temps partiel|summer|winter|fall|autumn|spring|été|ete|hiver|automne|printemps|junior|jr\\.?|h/f|f/h|m/f/d|f/m/d|m/w/d|w/m/d";
  /* boundaries are written as look-arounds: \b does not see the accent in "été" or "étudiant" */
  const KIND = new RegExp("(?<![\\p{L}\\p{N}])(?:" + KIND_WORDS + ")(?![\\p{L}\\p{N}])", "giu");
  function roleOf(title) {
    let t = clean(title).replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
    const seg = t.split(/\s+[-–—|:]\s+|\s*[|,;]\s*/).map((s) => s.replace(KIND, " ").replace(/\b(?:19|20)\d\d\b/g, " ").replace(/\s+/g, " ").trim()).filter((s) => /[a-zà-ÿ]{3}/i.test(s));
    let r = (seg[0] || "").replace(/^(?:en|de|d'|du|des|in|of|for|pour|à|a)\s+/i, "").replace(/\s+(?:en|de|d'|in|of|for|pour|à)$/i, "").trim();
    const words = r.split(" ").filter(Boolean);
    if (words.length > 4) r = words.slice(0, 4).join(" ");
    return noQuotes(r);
  }

  const people = (q) => "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(q);
  const google = (q) => "https://www.google.com/search?q=" + encodeURIComponent(q);

  function links(ctx) {
    ctx = ctx || {};
    if (hidden(ctx.company)) return [];
    const org = orgOf(ctx.company), role = roleOf(ctx.title), school = noQuotes(clean(ctx.school)).slice(0, 80);
    const O = `"${org}"`, out = [];
    if (school) out.push({ id: "alumni", label: `People from ${school} at ${org}`, why: "A shared school is a reason to say hello.", url: people(`${O} "${school}"`) });
    out.push({ id: "recruiters", label: `Recruiters at ${org}`, why: "Recruiters and talent acquisition, in English and French.", url: people(`${O} (recruiter OR "talent acquisition" OR recruteur OR recruteuse OR "acquisition de talents")`) });
    if (role) {
      out.push({ id: "role", label: `People in ${role} at ${org}`, why: "Someone who does the job can tell you what it is really like.", url: people(`${O} ${role}`) });
      out.push({ id: "leads", label: `Team leads and managers for ${role}`, why: "The person this role would report to, or someone near them.", url: people(`${O} ${role} (manager OR supervisor OR lead OR gestionnaire OR superviseur OR directeur OR directrice)`) });
    }
    out.push({ id: "company", label: `${org} on LinkedIn`, why: "Its People tab can be filtered by where people studied.", url: "https://www.linkedin.com/search/results/companies/?keywords=" + encodeURIComponent(org) });
    out.push({ id: "careers", label: `Student and early-career pages at ${org}`, why: "Some employers hire students through a separate page or event.", url: google(`${O} careers students internship OR stagiaire OR "early careers" OR carrières`) });
    return out;
  }

  /* ---------- drafts ---------- */
  const FR_ELIDE = /^(?:universit|école|ecole|institut|éts\b|ets\b)/i;
  const fix = (s) => s.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim();
  /* "I'm studying Industrial Engineering at Concordia" / "I'm a student at Concordia" / "I'm a student" */
  function who(L, program, school) {
    if (L === "fr") {
      const at = school ? (FR_ELIDE.test(school) ? "à l'" : "à ") + school : "";
      if (program) return `j'étudie en ${program}${at ? " " + at : ""}`;
      return at ? `j'étudie ${at}` : "je suis étudiant(e)";
    }
    if (program) return `I'm studying ${program}${school ? " at " + school : ""}`;
    return school ? `I'm a student at ${school}` : "I'm a student";
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const list = (L, a) => a.length > 1 ? a[0] + (L === "fr" ? " et " : " and ") + a[1] : a[0] || "";

  function drafts(ctx) {
    ctx = ctx || {};
    const L = ctx.lang === "fr" ? "fr" : "en";
    const org = orgOf(ctx.company), title = clean(ctx.title), role = roleOf(ctx.title) || title;
    const name = clean(ctx.name).slice(0, 60), program = noQuotes(clean(ctx.program)).slice(0, 80), school = noQuotes(clean(ctx.school)).slice(0, 80);
    const skills = (ctx.skills || []).map(clean).filter(Boolean).slice(0, 2);
    const me = name || (L === "fr" ? "[Votre nom]" : "[Your name]");
    const to = L === "fr" ? "[Prénom]" : "[Name]";
    const out = [];

    /* 1. the connection note: the longest version that fits */
    const w = who(L, program, school);
    const note = L === "fr"
      ? [`Bonjour, ${w} et je m'intéresse aux postes « ${role} » chez ${org}. J'aimerais avoir votre point de vue sur le travail là-bas. Pourrions-nous nous connecter ?`,
         `Bonjour, ${w} et je m'intéresse aux postes « ${role} » chez ${org}. Pourrions-nous nous connecter ?`,
         `Bonjour, je m'intéresse à ${org}. Pourrions-nous nous connecter ?`]
      : [`Hi, ${w} and I'm looking into ${role} roles at ${org}. I'd value your view on the work there. Could we connect?`,
         `Hi, ${w} and I'm looking into ${role} roles at ${org}. Could we connect?`,
         `Hi, I'm interested in ${org}. Could we connect?`];
    let pick = note.find((t) => t.length <= NOTE_MAX);
    const over = !pick; if (over) pick = note[note.length - 1];
    out.push({ id: "note", label: L === "fr" ? "Note d'invitation (alumni ou pair)" : "Connection note (alumni or peer)", use: L === "fr" ? "À joindre à une demande de connexion. Courte pour respecter la limite de LinkedIn." : "Goes with a connection request. Kept short for LinkedIn's limit.", text: pick, max: NOTE_MAX, over });

    /* 2. a recruiter or the contact named in the posting */
    const sk = skills.length ? (L === "fr" ? ` Le poste demande ${list(L, skills)}, qui ${skills.length > 1 ? "figurent" : "figure"} sur mon CV.` : ` The posting asks for ${list(L, skills)}, which ${skills.length > 1 ? "are" : "is"} on my CV.`) : "";
    out.push(L === "fr"
      ? { id: "recruiter", label: "Message à un recruteur", use: "Pour un message ou un courriel. Demande si le poste est ouvert, rien de plus.", max: 0, over: false,
          text: fix(`Objet : ${title || role}, ${org}\n\nBonjour ${to},\n\n${cap(w)}. Je suis tombé(e) sur l'offre « ${title || role} » chez ${org} et je vous écris pour savoir si elle est toujours ouverte et quelle est la meilleure façon de postuler.${sk}\n\nJe vous enverrai volontiers mon CV ou répondrai à vos questions.\n\nMerci de votre temps,\n${me}`) }
      : { id: "recruiter", label: "Message to a recruiter", use: "For a message or an email. It asks whether the role is open, nothing more.", max: 0, over: false,
          text: fix(`Subject: ${title || role}, ${org}\n\nHello ${to},\n\n${cap(w)}. I came across the "${title || role}" posting at ${org} and I'm writing to ask whether it is still open and what the best way to apply is.${sk}\n\nI'd be glad to send my CV or answer any questions.\n\nThank you for your time,\n${me}`) });

    /* 3. someone who does the job: ask for advice, not for a job */
    out.push(L === "fr"
      ? { id: "advice", label: "Message à quelqu'un qui fait ce travail", use: "Demande un conseil de 15 minutes, pas un emploi.", max: 0, over: false,
          text: fix(`Bonjour ${to},\n\n${cap(w)} et j'explore les postes « ${role} » chez ${org}. Auriez-vous 15 minutes dans les prochaines semaines pour me dire à quoi ressemble le travail au quotidien et ce que vous conseilleriez à quelqu'un qui débute ? Je comprends si vous êtes occupé(e).\n\nMerci,\n${me}`) }
      : { id: "advice", label: "Message to someone who does the job", use: "Asks for 15 minutes of advice, not for a job.", max: 0, over: false,
          text: fix(`Hello ${to},\n\n${cap(w)} and I'm exploring ${role} work at ${org}. Would you have 15 minutes in the next couple of weeks to tell me what the work looks like day to day and what you'd advise someone starting out? I understand if you're busy.\n\nThank you,\n${me}`) });
    return out;
  }

  return { hidden, orgOf, roleOf, links, drafts, NOTE_MAX };
});
