/* Tests for docs/scoring.js: the 0-100 score, its three parts and the rules that keep it honest.
   The score was rebuilt: Skills 70 + Education 20 + Credentials 10, counted out of the parts a
   posting actually asks for. The job title and the career stage no longer give points - the stage
   decides which postings are in the list at all, and the field decides the order.
   Run: node test/scoring.test.mjs */
import assert from "node:assert/strict";
import { loadUmd, loadJobMeta } from "../scripts/umd.mjs";

const S = loadUmd("scoring.js", "Scoring");
const J = loadJobMeta();
const row = (n, tag, st, o) => Object.assign({ n, tag, st, kind: "s" }, o || {});
/* a posting asking for ten specific skills, of which the CV has `hits` */
const ten = (hits) => ["MRP", "SolidWorks", "PLC programming", "Inventory control", "Lean Six Sigma",
  "AutoCAD", "SAP", "Quality control", "Procurement", "Maintenance and reliability"]
  .map((n, i) => row(n, i < 4 ? "R" : "K", i < hits ? "M" : "G"));

/* the three parts add up to 100 */
assert.equal(S.CAP.skills + S.CAP.education + S.CAP.credentials, 100);

/* the title and the stage are worth nothing */
assert.equal(S.weight(row("supply chain coordinator", "T", "M")), 0, "a word from the job title pays nothing");
assert.equal(S.weight(row("MRP", "R", "M")), 1, "a required skill is worth the most");
assert.ok(S.weight(row("MRP", "P", "M")) < S.weight(row("MRP", "R", "M")), "a nice-to-have is worth less");
assert.ok(Math.abs(S.weight(row("Communication", "R", "M", { general: true })) - 0.35) < 0.01,
  "a skill nearly every CV has counts about a third of a specific one");

/* the score follows the coverage, and half a posting is not full marks */
const low = S.compute(ten(2), {}), mid = S.compute(ten(5), {}), high = S.compute(ten(9), {});
assert.ok(low.total < 35, "covering 2 of 10 scores low: " + low.total);
assert.ok(mid.total >= 50 && mid.total <= 75, "covering 5 of 10 sits in the middle: " + mid.total);
assert.ok(high.total >= 85, "covering 9 of 10 scores high: " + high.total);
assert.ok(low.total < mid.total && mid.total < high.total, "more coverage is always more points");
assert.ok(mid.total < 80, "a posting covered half does not score 100");

/* a Close counts exactly half a Match */
const allClose = S.compute(ten(0).map((x, i) => (i < 4 ? Object.assign({}, x, { st: "R" }) : x)), {});
assert.ok(allClose.total < S.compute(ten(4), {}).total, "a Close is worth less than a Match");

/* scored out of what the posting asks for, so nobody loses points for what was never wanted */
assert.equal(S.compute(ten(5), {}).available, 70, "a posting naming no degree is scored out of 70");
const withEdu = S.compute(ten(5), { eduAsked: 4, eduHave: 4, eduRelated: true });
assert.equal(withEdu.available, 90, "a posting naming a degree is scored out of 90");
assert.equal(withEdu.education, 20, "the right degree in the right field earns all 20");
assert.equal(S.compute(ten(5), { eduAsked: 4, eduHave: 4, eduRelated: false }).education, 14,
  "the right level in another field keeps most of it");
assert.equal(S.compute(ten(5), { eduAsked: 4, eduHave: 3, eduRelated: true }).education, 10, "one level short keeps half");
assert.equal(S.compute(ten(5), { eduAsked: 4, eduHave: 2, eduRelated: true }).education, 0, "two levels short earns none");
assert.equal(S.compute(ten(5), { eduAsked: 4, eduHave: 5, eduRelated: true }).education, 20, "a higher degree is not punished");

/* a certificate is scored once, as a credential, never twice */
const credGap = S.compute(ten(5).concat([row("PMP certification", "R", "G", { cred: true })]), {});
assert.equal(credGap.available, 80, "a posting naming a certificate is scored out of 80");
assert.equal(credGap.credentials, 0, "a certificate you do not have earns none of its 10");
const credGot = S.compute(ten(5).concat([row("PMP certification", "R", "M", { cred: true })]), {});
assert.equal(credGot.credentials, 10, "a certificate you have earns all 10");
assert.equal(credGot.skills, S.compute(ten(5), {}).skills, "and it is not also counted among the skills");

/* work that ended years ago is weaker evidence than work from this year */
const recent = ["MRP", "Inventory control", "Procurement"].map((n) => row(n, "R", "M", { cvW: 1 }));
const old = ["MRP", "Inventory control", "Procurement"].map((n) => row(n, "R", "M", { cvW: 0.5 }));
assert.ok(S.compute(recent, {}).total > S.compute(old, {}).total, "current work scores more than old work");

/* reading the education from both sides */
assert.equal(J.eduAsked("Bachelor's degree in engineering required"), 4);
assert.equal(J.eduAsked("College diploma or DEC required"), 3);
assert.equal(J.eduAsked("We will train the right person."), 0, "a posting naming no degree asks for none");
assert.equal(J.eduAsked("Maîtrise du français exigée"), 0, "maîtrise usually means being good at something");
const cv = J.cvEdu("EDUCATION\nMaster of Engineering - Industrial Engineering\nConcordia University\n2025 - 2027\n");
assert.equal(cv.level, 5, "a master's reads as 5");
assert.ok(cv.fields.includes("engineering"), "the field comes from the degree line");

/* a licence the posting calls mandatory is found and named */
const mh = J.mustHaves("A valid Water Treatment Operator Certificate is mandatory.");
assert.equal(mh.length, 1);
assert.ok(/Water Treatment Operator Certificate/.test(mh[0].what || ""), "the licence is named: " + JSON.stringify(mh[0]));
assert.equal(J.mustHaves("A PMP certification is an asset.").length, 0, "an asset is not a must-have");
assert.equal(J.mustHaves("A valid driver's licence is required.")[0].driving, true, "a driving licence is reported apart");

// ---- the title the keywords are read from (docs/matcher.js cleanTitle): words that are not the job are left out ----
{
  const { loadMatcher, loadSkills } = await import("../scripts/umd.mjs");
  const E = loadMatcher().engine(loadSkills());
  const title = (t) => E.profile(t, "", 40).kw.filter((k) => k[0] === "T").map((k) => k.slice(3));

  // French gender endings are removed, and the words around them stay one phrase
  assert.equal(E.cleanTitle("Préposé(e) aux bénéficiaires - Temps plein - Laval"), "Préposé aux bénéficiaires");
  assert.equal(E.cleanTitle("Conseiller·ère en communication"), "Conseiller en communication");
  assert.equal(E.cleanTitle("Agent de bureau H/F"), "Agent de bureau");
  assert.ok(!title("Infirmier(ère) - Urgence Sept-Îles | Côte-Nord.").some((k) => /^(ère|Îles|Côte-Nord)$/i.test(k)), "no ending or place as a title keyword");
  assert.ok(title("Infirmier(ère) - Urgence Sept-Îles | Côte-Nord.").includes("Urgence"), "the specialty stays");
  // places, the contract and the schedule
  assert.equal(E.cleanTitle("Cook - Toronto, ON"), "Cook");
  // "RN" is a spelling of a skill (skills library), so the bracket stays, closed
  assert.equal(E.cleanTitle("Registered Nurse (RN), Part Time"), "Registered Nurse (RN)");
  assert.equal(title("Registered Nurse (RN), Part Time").join(" | "), "Healthcare and clinical | Registered Nurse");
  assert.equal(E.cleanTitle("Rope Access Technician / Wind Turbine Technician - Canada | Open Applications"), "Rope Access Technician / Wind Turbine Technician");
  assert.equal(E.cleanTitle("Sales Associate on call"), "Sales Associate", "on call is a schedule");
  // brackets: kept when they name a skill, removed otherwise
  assert.equal(E.cleanTitle("VP of Operations (Emailable)"), "VP of Operations");
  assert.equal(E.cleanTitle("Full-Stack Developer (Go, Javascript)"), "Full-Stack Developer (Go, Javascript)");
  assert.ok(title("Python Full-Stack Software Engineer -(React)").includes("Python"));
  // "on" is a word, ON only a province code in capitals
  assert.equal(E.cleanTitle("Sign-on bonus: Welder"), "Sign-on bonus: Welder");
  // a title with nothing to remove is unchanged
  assert.equal(E.cleanTitle("Financial Analyst – Manufacturing Operations"), "Financial Analyst – Manufacturing Operations");
}

console.log("scoring tests passed");
