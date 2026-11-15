/* scoring.js - the 0-100 match score, in one place so the page and the tests use the same rules.
 *
 *   score = Skills (0-70) + Education (0-20) + Credentials (0-10)
 *
 * What counts is what the person can do, what they studied and what they are certified for. The job
 * title gives no points: it only says which field a posting belongs to. The level gives no points
 * either: it decides whether a posting belongs in the list at all (see the stage filter on the page).
 * A posting that asks for no degree, or for no certificate, is scored out of the parts it does ask
 * for, so nobody loses points for something that was never wanted.
 *
 * It is a heuristic, not an applicant tracking system: scores that differ by 5 points or less are ties.
 * Language, work permit, security and term are shown as flags next to the score and never change it.
 * A mandatory licence the CV does not have is a red flag and takes the posting out of the top 10; it
 * is handled on the page, not here, because it is a yes/no gate and not a number.
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

  const CAP = { skills: 70, education: 20, credentials: 10 };
  /* a posting whose skills are covered this far earns the full 70 (full coverage is not realistic) */
  /* Set from the real spread, not from optimism: across 75,810 postings the best match any of the
     four test CVs had covered 32 to 46 per cent of what a posting asks for, and the median was 4 to
     6 per cent. At 75 per cent the top of the scale could never be reached by anyone, so a good
     match read as 58 and the band above 60 was dead. At 60 per cent the best real matches land in
     the low 80s and 90 stays for something exceptional. */
  const SKILL_FULL = 0.60;
  /* a posting with only a few keywords has not shown much: count a few absent keywords too, so 2 of 3 does not read as 67% */
  const PRIOR = 4;
  const TAGW = { T: 0, R: 1, K: 0.7, N: 0.7, P: 0.4 };
  /* How much a keyword's status is worth. A Match counts 1 and a Close a half. On top of that, the
     line of the CV it was found on can count less: work older than about eight years, and student
     work older than about five, counts half (I-03). cvW carries that. */
  const credit = (x) => {
    const st = typeof x === "string" ? x : x.st;
    const w = (typeof x === "object" && x && x.cvW != null) ? x.cvW : 1;
    return (st === "M" ? 1 : st === "R" ? 0.5 : 0) * w;
  };

  const plain = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  /* language is a flag beside the score (see the page), never part of it */
  const LANGUAGE = new Set(["bilingual (en/fr)", "bilingual", "bilingue", "english", "french", "anglais", "francais"]);

  /* how much a keyword counts: a dictionary skill counts fully; a phrase of several words a little less;
     a single ordinary word little. A word from the title counts nothing at all. */
  function weight(x) {
    const t = TAGW[x.tag] != null ? TAGW[x.tag] : 0.7;
    if (!t) return 0;
    if (x.cred) return 0;                       /* a certificate is scored in its own part, not twice */
    if (LANGUAGE.has(plain(x.n))) return 0;
    /* a skill nearly every posting asks for and nearly every CV has says little about this job */
    if (x.general) return t * 0.35;
    if (x.kind === "s") return t;
    return t * (/[\s-]/.test(String(x.n).trim()) ? 0.8 : 0.35);
  }

  /* One count, used by the score and by every place that shows numbers: the keywords this posting
     really asks for. A word from the job title is not one of them, because it earns nothing. */
  function counts(rows) {
    let asked = 0, matched = 0, close = 0;
    for (const x of rows || []) {
      if (!(weight(x) > 0 || x.cred)) continue;
      asked++;
      if (x.st === "M") matched++; else if (x.st === "R") close++;
    }
    return { asked: asked, matched: matched, close: close, gap: asked - matched - close };
  }

  /* Skills: how much of what the posting asks for is on the CV, weighted. */
  function skills(rows) {
    let w = 0, c = 0;
    const n = counts(rows);
    const matched = n.matched, close = n.close, asked = n.asked;
    for (const x of rows) {
      const k = weight(x);
      w += k; c += k * credit(x);
    }
    const cov = w ? c / (w + PRIOR) : 0;
    const pts = w ? Math.round(CAP.skills * Math.min(1, cov / SKILL_FULL)) : 0;
    return { pts, cov, matched, close, asked, n: rows.length, weighted: w };
  }

  /* Education, 0 to 6: none, high school, college/CEGEP/trade, bachelor, master, doctorate.
     Same level or higher in a related field is full marks. The same level in another field still
     shows the person can study at that level, so it keeps most of the points. One level short keeps
     half. Two levels short is a real gap. A degree in progress counts: the person will have it. */
  /* A posting that states a degree is scored out of 90 and one that does not out of 70. A person who
     holds the degree therefore scores a little higher on the posting that asks for it - about 13
     points - for the same skills. That was looked at closely and kept: meeting a stated requirement
     is really meeting one more of the posting's requirements, so the share is right. Handing the
     same 20 points to everyone instead was tried and dropped: it lifted a posting covered 20 per
     cent from 24 to 43, which is the inflation I-09 was about. */
  function education(asked, have, related) {
    if (!asked) return { pts: 0, asked: false };
    const gap = (have || 0) - asked;
    let share;
    if (gap >= 0) share = related === false ? 0.7 : 1;
    else if (gap === -1) share = related === false ? 0.35 : 0.5;
    else share = 0;
    return { pts: Math.round(CAP.education * share), asked: true, gap, share };
  }

  /* Credentials: the certificates and licences the posting names (rows marked cred), and how many
     of them are on the CV. A close match counts half, as everywhere else. */
  function credentials(rows) {
    const want = (rows || []).filter((x) => x.cred);
    if (!want.length) return { pts: 0, asked: false };
    let c = 0;
    for (const x of want) c += credit(x);
    const share = c / want.length;
    return { pts: Math.round(CAP.credentials * share), asked: true, got: want.filter((x) => x.st === "M").length, want: want.length, share };
  }

  /* The total is out of the parts the posting actually asks for. A posting that names no degree and
     no certificate is scored on its skills alone, out of 100. */
  function compute(rows, parts) {
    parts = parts || {};
    const s = skills(rows || []);
    const e = education(parts.eduAsked, parts.eduHave, parts.eduRelated);
    const c = credentials(rows || []);
    const available = CAP.skills + (e.asked ? CAP.education : 0) + (c.asked ? CAP.credentials : 0);
    const earned = s.pts + e.pts + c.pts;
    const total = available ? Math.round((100 * earned) / available) : 0;
    return {
      skills: s.pts, education: e.pts, credentials: c.pts,
      total: Math.max(0, Math.min(100, total)),
      cov: s.cov, matched: s.matched, close: s.close, asked: s.asked, n: s.n,
      eduAsked: e.asked, eduGap: e.gap, credAsked: c.asked, credGot: c.got, credWant: c.want,
      available: available
    };
  }

  return { CAP, SKILL_FULL, PRIOR, weight, counts, skills, education, credentials, compute };
});
