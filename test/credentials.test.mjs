import { loadUmd, loadMatcher, loadJobMeta, loadSkills, loadCredentials, docsFile } from "../scripts/umd.mjs";
/* creds.test.js - after 5: the credentials map, and counting recent work more than old work.
 * Run: node tests/creds.test.js            (checks after-5 by default)
 */
const M = loadMatcher();
const J = loadJobMeta();
const S = loadUmd("scoring.js", "Scoring");
const dict = loadSkills();
const eng = M.engine(dict);
const C = loadCredentials();

let pass = 0, fail = 0;
const ok = (what, cond, got) => {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (got !== undefined ? "   got: " + got : "")); }
};
const entry = (id) => C.entries.find((e) => e.id === id);
const covers = (id) => (entry(id).covers || []).map((c) => c.skill);
const level = (id, skill) => (entry(id).covers.find((c) => c.skill === skill) || {}).level;

console.log("the map itself");
ok("every entry names an official source",
   C.entries.every((e) => e.source && /^https?:\/\//.test(e.source.url)),
   C.entries.filter((e) => !(e.source && /^https?:/.test(e.source.url))).map((e) => e.id).join(", "));
const signed = C.entries.filter((e) => typeof e.checked === "string");
const waiting = C.entries.filter((e) => e.checked === false);
ok("every signed entry names the person, the day and the source they read",
   signed.every((e) => e.checked.length > 3 && /^\d{4}-\d{2}-\d{2}$/.test(e.checked_on || "") && /^https?:/.test(e.checked_against || "")),
   signed.filter((e) => !e.checked_on).map((e) => e.id).join(", "));
ok("an entry is either signed or plainly waiting to be - never something in between",
   signed.length + waiting.length === C.entries.length,
   C.entries.filter((e) => typeof e.checked !== "string" && e.checked !== false).map((e) => e.id).join(", "));
/* The gate itself. An unsigned entry is drafted and visible in the file, and the page skips it, so
   nothing reaches an applicant that a person has not read. This is what makes it safe to let the
   agent and the drafting tool write into this file at all. */
ok("the page skips unsigned entries",
   /!CREDS\.draft_mode\s*&&\s*!e\.checked\s*\)\s*continue/.test(
     docsFile("index.html")));
ok("and the map is not in draft mode, so that skipping is live", C.draft_mode === false, String(C.draft_mode));
ok("every skill a credential covers exists in the dictionary",
   C.entries.every((e) => (e.covers || []).every((c) => dict.skills.some((s) => s.n === c.skill))));
ok("every skill says which words of the syllabus it came from",
   C.entries.every((e) => (e.covers || []).every((c) => c.from && c.from.length > 1)));
ok("a degree never gives full credit",
   C.entries.filter((e) => e.kind === "degree").every((e) => (e.covers || []).every((c) => c.level === "side")));
ok("what a reviewer took out stays out",
   !covers("six-sigma-green-belt").includes("Healthcare and clinical") &&
   !covers("first-aid").includes("Automation") &&
   !covers("forklift").includes("Occupational health nursing"));
ok("the reason for each removal is written down",
   Object.values(entry("six-sigma-green-belt").drop).every((r) => r.length > 20));

console.log("\nwhat a certificate covers");
ok("a Green Belt covers statistical process control", covers("six-sigma-green-belt").includes("Statistical process control"));
ok("...and root cause analysis, in full", level("six-sigma-green-belt", "Root cause analysis") === "core");
ok("a skill only reached through a related technique is half credit",
   level("six-sigma-green-belt", "Maintenance and reliability") === "side",
   level("six-sigma-green-belt", "Maintenance and reliability"));
ok("a Black Belt covers everything a Green Belt does",
   covers("six-sigma-green-belt").every((s) => covers("six-sigma-black-belt").includes(s)));
ok("the PMP covers risk management", covers("pmp").includes("Risk management"));
ok("CPIM covers MRP in full", level("cpim", "MRP") === "core");
ok("an engineering degree covers its own subjects at half credit",
   covers("deg-mechanical-engineering").includes("Mechanical design") &&
   level("deg-mechanical-engineering", "Mechanical design") === "side");

console.log("\nreading a credential off a CV");
const eduText = (t) => J.cvEduText(t);
ok("a degree is read from the education section",
   /Mechanical/i.test(eduText("EDUCATION\nBachelor of Engineering, Mechanical\nTIET\n2018 - 2022\n")));
ok("a subject named inside a job description is not a degree",
   !/industrial engineering/i.test(eduText("WORK EXPERIENCE\nIntern\nWorked in an industrial engineering team\n2022\n")),
   JSON.stringify(eduText("WORK EXPERIENCE\nIntern\nWorked in an industrial engineering team\n2022\n")));

console.log("\ncounting recent work more than old work (I-03)");
const now = new Date("2026-11-14T12:00:00-05:00");
const cv = "WORK EXPERIENCE\nProduction Coordinator\nWajax\nMarch 2024 - Present\nMRP and purchasing.\n" +
  "Warehouse Worker\nOld Co\nJune 2010 - June 2012\nForklift and shipping.\n";
const lv = J.cvLevel(cv, now);
ok("each dated entry says which line it is on", lv.entries.every((e) => e.at != null));
ok("...and how long ago it ended", lv.entries.every((e) => e.endAgeY != null));
const recent = lv.entries.find((e) => /Production Coordinator/.test(e.label || ""));
const old = lv.entries.find((e) => /Warehouse/.test(e.label || ""));
ok("a job that ended this year reads as recent", recent && recent.endAgeY < 1, recent && recent.endAgeY);
ok("a job that ended fourteen years ago reads as old", old && old.endAgeY > 8, old && old.endAgeY);

console.log("\nwhat the weight does to the score");
const rows = (w) => ["MRP", "Inventory control", "Forklift operation", "Shipping and receiving", "Procurement"]
  .map((n, i) => ({ n: n, tag: i < 2 ? "R" : "K", st: "M", kind: "s", cvW: w }));
const full = S.compute(rows(1), {}), half = S.compute(rows(0.5), {});
ok("skills from current work score more than the same skills from old work", full.total > half.total,
   full.total + " vs " + half.total);
ok("a skill from a credential counts, a side one at half",
   S.compute([{ n: "MRP", tag: "R", st: "M", kind: "s" }], {}).total >
   S.compute([{ n: "MRP", tag: "R", st: "R", kind: "s" }], {}).total);

console.log("\nthe licence question");
const mh = J.mustHaves("A valid Water Treatment Operator Certificate is mandatory.");
ok("a mandatory licence is still found and named", mh.length === 1 && /Water Treatment/.test(mh[0].what || ""));
ok("a licence with no name to look for is only a note", J.mustHaves("A valid License is required.")[0].what === null);

console.log("\nQuebec and French credentials");
const fr = (id) => C.entries.find((e) => e.id === id);
ok("the Quebec engineering licence is in the map, apart from the Engineers Canada one",
   !!fr("oiq") && !!fr("p-eng") && fr("oiq").id !== fr("p-eng").id);
ok("a CV saying \"ing.\" or \"membre de l'OIQ\" finds it",
   ["ing.", "membre de l'ordre des ingenieurs", "cpi"].every((a) => fr("oiq").also.includes(a)));
ok("the ASP Construction card is in, with its 19 modules as the source",
   !!fr("asp-construction") && /asp-construction\.org/.test(fr("asp-construction").source.url));
ok("...and it covers confined space and lockout in full",
   (fr("asp-construction").covers || []).some((c) => c.skill === "Confined space" && c.level === "core"));
ok("what a reviewer took out of it stays out, with the reason",
   !(fr("asp-construction").covers || []).some((c) => /Mentoring|Physics/.test(c.skill)) &&
   Object.values(fr("asp-construction").drop).every((r) => r.length > 20));
ok("the CCQ competency certificate is in", !!fr("ccq-competence"));
ok("French spellings reach the credentials people actually write",
   fr("forklift").also.includes("cariste") &&
   fr("first-aid").also.includes("secourisme") &&
   fr("red-seal").also.includes("sceau rouge") &&
   fr("whmis").also.includes("simdut"));
ok("the Quebec entries have been signed, so the page uses them",
   ["oiq", "asp-construction", "ccq-competence"].every((id) =>
     typeof fr(id).checked === "string" && fr(id).checked_on === "2026-11-15"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
