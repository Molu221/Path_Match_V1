// Match a received job email to one of the user's tracked applications.
// Evidence-based score: company in sender domain / sender name / subject / body, title words in subject / body,
// plus a small recency bonus. Returns appId only when one application clearly wins; otherwise it returns the
// short list of plausible candidates so the user can pick (we never guess between two similar applications).

import { norm } from "./classify.js";

const COMPANY_STOP = new Set(["inc", "ltd", "ltee", "limited", "corp", "corporation", "company", "co", "group", "groupe", "canada",
  "canadian", "the", "de", "du", "la", "le", "les", "des", "and", "et", "by", "of", "sa", "llc", "lp", "international", "intl",
  "holdings", "solutions", "services", "in"]);
const TITLE_STOP = new Set(["intern", "internship", "stage", "stagiaire", "winter", "hiver", "summer", "ete", "fall", "automne",
  "coop", "student", "etudiant", "etudiante", "the", "and", "for", "with", "des", "les", "pour", "dans", "2026", "2027", "2028"]);
// Domains that send on behalf of many employers: the domain says nothing about which company it is.
const SHARED_SENDERS = new Set(["greenhouse", "lever", "ashbyhq", "smartrecruiters", "workday", "myworkday", "myworkdayjobs", "icims",
  "taleo", "oraclecloud", "successfactors", "sap", "jobvite", "workable", "bamboohr", "breezy", "jazzhr", "linkedin", "indeed",
  "glassdoor", "adzuna", "jobbank", "gmail", "outlook", "hotmail", "yahoo", "google", "talent", "recruitee", "teamtailor"]);

const words = (s) => norm(s).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
const compact = (s) => norm(s).replace(/[^a-z0-9]+/g, "");
export const domainOf = (email) => String(email || "").split("@").pop().toLowerCase().trim();

function companyTokens(company) {
  const tokens = words(company).filter((w) => !COMPANY_STOP.has(w) && w.length > 1);
  return { tokens, phrase: tokens.join(" "), compact: tokens.join("") };
}
function titleTokens(title) {
  return [...new Set(words(title).filter((w) => w.length >= 4 && !TITLE_STOP.has(w)))];
}
const hasWord = (hay, needle) => needle && new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hay);

export function scoreApplication(email, app, receivedAt = new Date()) {
  const subj = norm(email.subject);
  const body = norm(String(email.body || "").slice(0, 6000));
  const name = norm(email.fromName);
  const labels = domainOf(email.fromEmail).split(".").filter(Boolean);
  const co = companyTokens(app.company);
  let company = 0;
  const why = [];

  if (co.tokens.length) {
    const longTokens = co.tokens.filter((t) => t.length >= 4);
    if (hasWord(subj, co.phrase)) { company += 5; why.push("company in subject"); }
    else if (longTokens.some((t) => hasWord(subj, t))) { company += 3; why.push("company word in subject"); }

    if (hasWord(name, co.phrase) || longTokens.some((t) => hasWord(name, t))) { company += 4; why.push("company in sender name"); }

    // Short names (CAE, ABB, DSV, CGI) must equal a whole domain label; longer ones may be contained in it (modernatx).
    const domainHit = labels.some((l) => !SHARED_SENDERS.has(l) &&
      (l === co.compact || co.tokens.includes(l) ||
        (l.length >= 4 && (co.compact.includes(l) || longTokens.some((t) => l.includes(t) || t.includes(l))))));
    if (domainHit) { company += 4; why.push("company in sender domain"); }

    if (hasWord(body, co.phrase)) { company += 3; why.push("company in body"); }
    else if (longTokens.some((t) => t.length >= 5 && hasWord(body, t))) { company += 1; why.push("company word in body"); }
  }

  const tt = titleTokens(app.title);
  let title = 0;
  if (tt.length) {
    const inSubj = tt.filter((t) => hasWord(subj, t)).length / tt.length;
    const inBody = tt.filter((t) => hasWord(body, t)).length / tt.length;
    title = 4 * inSubj + 2 * inBody;
    if (inSubj > 0) why.push(`${Math.round(inSubj * 100)}% of title words in subject`);
    else if (inBody > 0) why.push(`${Math.round(inBody * 100)}% of title words in body`);
  }

  const days = (receivedAt - new Date(app.applied_at)) / 864e5;
  const recency = days >= 0 && days <= 14 ? 1 : 0;
  return { score: company + title + recency, company, title, why };
}

export function matchApplication(email, apps, receivedAt = new Date()) {
  const scored = [];
  for (const app of apps) {
    const days = (receivedAt - new Date(app.applied_at)) / 864e5;
    if (days < -1.5) continue;     // email predates the application by more than clock skew: not a reply to it
    if (days > 120) continue;      // too old to be the reply to this application
    const s = scoreApplication(email, app, receivedAt);
    if (s.company >= 3) scored.push({ id: app.id, ...s });   // title words alone never identify an application
  }
  scored.sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  const candidates = scored.filter((c) => c.score >= 3).slice(0, 5).map((c) => c.id);
  if (best && best.score >= 5 && (!second || best.score - second.score >= 2)) {
    return { appId: best.id, score: best.score, why: best.why, candidates };
  }
  return { appId: null, score: best ? best.score : 0, why: best ? best.why : [], candidates };
}
