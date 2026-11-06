// Checks of "Describe the job you want" (docs/describe.js): a sentence, in English or French, becomes filters and chips.
// It is a rule reader, so the tests pin down what it reads, what it refuses to read, and that it never sets a filter the list cannot check.
// Run: node test/describe.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadUmd, loadMatcher, loadSkills } from "../scripts/umd.mjs";

const D = loadUmd("describe.js", "Describe");
assert.ok(D && typeof D.parse === "function", "describe.js loads");
const CV = { hasCv: true };
const ids = (r) => r.chips.map((c) => c.id).join(",");
const roles = (r) => r.roles.join(" | ");
const ok = (r, title) => D.titleOk(r.roles.map(D.compile), r.not.map(D.compile), D.titleKey(title));

// --- the person's own target: industrial / quality / operations / supply chain, Montréal, co-op, bilingual
let r = D.parse("Winter 2027 industrial engineering co-op in Montréal, bilingual, no security clearance", CV);
assert.equal(r.tab, "intern");
assert.equal(r.loc, "MTL");
assert.equal(r.el, "nosec");
assert.equal(r.lg, "", "bilingual is not a filter: both languages are kept");
assert.equal(roles(r), "industrial engineering");
assert.ok(r.chips.some((c) => c.id === "note:bi" && c.kind === "note"), "bilingual is shown as a note");
assert.ok(r.chips.some((c) => c.id === "note:term" && /winter 2027/.test(c.text)), "the term is noted, not filtered");
assert.equal(r.w, null); assert.equal(r.lvl, null); assert.equal(r.min, 0);

// --- part-time with hours: part-time tab, hours noted as unverifiable
r = D.parse("part-time quality or operations job, about 24 hours a week, near Longueuil", CV);
assert.equal(r.tab, "part"); assert.equal(r.loc, "MTL");
assert.equal(roles(r), "quality | operations");
const hrs = r.chips.find((c) => c.id === "note:hours");
assert.ok(hrs && /24 hours/.test(hrs.text) && hrs.kind === "note", "the hours are a note");
r = D.parse("internship, 20 hours a week", CV);
assert.equal(r.tab, "intern", "a named type wins over the hours");
r = D.parse("20 hours a week, quality", CV);
assert.equal(r.tab, "part", "hours alone mean part-time");
r = D.parse("40 hours a week quality", CV);
assert.equal(r.tab, null, "full-time hours set no tab");

// --- French
r = D.parse("stage en génie industriel à Montréal, bilingue, sans habilitation de sécurité", CV);
assert.equal(r.tab, "intern"); assert.equal(r.loc, "MTL"); assert.equal(r.el, "nosec");
assert.equal(roles(r), "genie industriel");
assert.ok(ok(r, "Industrial Engineering Intern"), "a French request finds the English title");
assert.ok(ok(r, "Stagiaire en génie industriel"), "and the French one");
assert.ok(ok(r, "Ingénieur industriel stagiaire"));
assert.ok(!ok(r, "Marketing Intern"));
r = D.parse("stage en chaîne d'approvisionnement à Montréal", CV);
assert.equal(roles(r), "chaine approvisionnement");
assert.ok(ok(r, "Supply Chain Intern"), "chaîne d'approvisionnement is supply chain");
assert.ok(ok(r, "Stagiaire - Chaîne d'approvisionnement"));
assert.ok(ok(r, "Logistics Co-op"), "logistics is listed as an accepted word, and the chip says so");
assert.ok(D.alsoAccepts("supply chain").includes("logisti"));
assert.ok(!ok(r, "Chain Store Supervisor"), "both words of a phrase are needed");
r = D.parse("Je cherche un emploi à temps partiel en comptabilité", CV);
assert.equal(r.tab, "part"); assert.equal(roles(r), "comptabilite");
assert.ok(ok(r, "Accounting Clerk"), "comptabilité is accounting");

// --- roles: OR terms, a shared last noun, words to leave out
r = D.parse("I am looking for an internship in industrial, mechanical or quality engineering in Montreal, not sales, English only", CV);
assert.equal(roles(r), "industrial engineering | mechanical engineering | quality engineering");
assert.equal(r.not.join(), "sales"); assert.equal(r.lg, "noFr");
assert.ok(ok(r, "Quality Engineer Intern")); assert.ok(ok(r, "Mechanical Engineering Co-op")); assert.ok(ok(r, "QA Engineer"));
assert.ok(!ok(r, "Sales Engineer Intern"), "a word to leave out removes the title");
assert.ok(!ok(r, "Quality Manager"), "an engineer is asked for");
r = D.parse("marketing and engineering interns", CV);
assert.equal(roles(r), "marketing | engineering", "a bare last noun is not spread");
r = D.parse("data analyst or software developer", CV);
assert.equal(roles(r), "data analyst | software developer");
assert.ok(ok(r, "Senior Data Analysts") && ok(r, "Software Developer II") && !ok(r, "Data Entry Clerk"));
r = D.parse("continuous improvement or lean", CV);
assert.ok(ok(r, "Amélioration continue - Stagiaire") && ok(r, "Lean Six Sigma Intern"));

// --- place
r = D.parse("remote data analyst", CV);
assert.equal(r.loc, D.REMOTE_LOC); assert.equal(roles(r), "data analyst");
r = D.parse("software developer in Toronto", CV);
assert.equal(r.loc, "ON"); assert.equal(r.city, "Toronto");
r = D.parse("software developer in Toronto, Ontario", CV);
assert.equal(r.loc, "ON"); assert.equal(r.locAlso.length, 0, "a province named with its own city is not a second place");
r = D.parse("work in Montréal, Québec", CV);
assert.equal(r.loc, "MTL"); assert.equal(r.locAlso.length, 0);
r = D.parse("Montréal or Toronto", CV);
assert.equal(r.loc, "MTL"); assert.equal(r.locAlso.join(), "Toronto", "the second place is listed, not silently dropped");
r = D.parse("full-time marketing manager in QC", CV);
assert.equal(r.loc, "QC"); assert.equal(roles(r), "marketing manager");
r = D.parse("QC inspector", CV);
assert.equal(r.loc, "", "QC as a word in a role is not Quebec"); assert.equal(roles(r), "qc inspector");
r = D.parse("work on site", CV);
assert.equal(r.loc, "", "'on' is a word, not Ontario");
r = D.parse("quality engineer in Quebec City", CV);
assert.equal(r.loc, "QC"); assert.equal(r.city, "Quebec City");

// --- level, posted when, score, order
r = D.parse("entry level analyst posted this week", CV);
assert.equal(r.lvl, 1); assert.equal(r.w, 7); assert.equal(roles(r), "analyst");
r = D.parse("senior engineer", CV); assert.equal(r.lvl, 3);
r = D.parse("entry level internship analyst", CV); assert.equal(r.lvl, null, "an internship is its own level: entry level would hide it"); assert.ok(!r.chips.some((c) => c.id === "lvl"));
r = D.parse("director of operations", CV); assert.equal(r.lvl, 4);
r = D.parse("new graduate engineer today", CV); assert.equal(r.lvl, 1); assert.equal(r.w, 1);
r = D.parse("good match internship, newest first", CV);
assert.equal(r.min, 60); assert.equal(r.sort, "new");
r = D.parse("internship score 45+", CV); assert.equal(r.min, 45);
r = D.parse("best matches internship", CV); assert.equal(r.sort, "match");
r = D.parse("good match internship, best matches", { hasCv: false });
assert.equal(r.min, 0, "without a CV there is no score filter");
assert.equal(r.sort, "");
assert.ok(r.chips.some((c) => c.id === "note:cv"), "and the page says it needs the CV");

// --- the things the list cannot check stay notes
r = D.parse("internship, I need a work permit, master's student, starting January 2027, 8 months", CV);
assert.ok(r.chips.some((c) => c.id === "note:permit"));
assert.ok(r.chips.some((c) => c.id === "note:degree"));
assert.ok(r.chips.some((c) => c.id === "note:term"));
const filters = r.chips.filter((c) => c.kind === "filter").map((c) => c.id).join();
assert.equal(filters, "tab", "permit, degree and dates set no filter, only the type does");
assert.equal(r.roles.length, 0, "and none of those words became a role word");
r = D.parse("international student looking for a co-op", CV);
assert.ok(!/\bpermit\b.*\bokay\b/.test(JSON.stringify(r)), "nothing is assumed about the work permit");

// --- eligibility
r = D.parse("engineer, no background check", CV); assert.equal(r.el, "nosec");
r = D.parse("engineer without citizenship requirement", CV); assert.equal(r.el, "nosec");
r = D.parse("engineer, still a student", CV); assert.equal(r.el, "stud");
r = D.parse("engineer", CV); assert.equal(r.el, "");

// --- language
r = D.parse("engineer, French ok", CV); assert.equal(r.lg, ""); assert.ok(r.chips.some((c) => c.id === "note:bi"));
r = D.parse("engineer in French", CV); assert.equal(r.lg, "fr");
r = D.parse("engineer, no French", CV); assert.equal(r.lg, "noFr");

// --- skills come from the skills library and only after a cue
const skills = loadMatcher().engine(loadSkills());
const findSkills = (t) => Object.keys(skills.find(t));
r = D.parse("industrial engineering co-op with Six Sigma and AutoCAD", { hasCv: true, findSkills });
assert.ok(r.skills.length >= 1, "skills named after 'with' are looked up: " + JSON.stringify(r.skills));
assert.equal(roles(r), "industrial engineering", "and are not also role words");
assert.ok(r.skills.every((n) => typeof n === "string"));
r = D.parse("industrial engineering co-op", { hasCv: true, findSkills });
assert.equal(r.skills.length, 0, "a skill word without a cue is a role word, not a skill");
r = D.parse("python", { hasCv: true, findSkills });
assert.equal(r.skills.length, 0); assert.equal(roles(r), "python");

// --- nothing is hidden: unknown words stay as role words, every filter has a chip
r = D.parse("asdf qwerty", CV);
assert.equal(roles(r), "asdf qwerty"); assert.equal(ids(r), "role:0");
for (const t of ["Winter 2027 industrial engineering co-op in Montréal, bilingual, no security clearance", "remote data analyst, entry level, posted this week", "good match internship, newest first, Toronto"]) {
  const p = D.parse(t, CV);
  const wanted = [p.tab && "tab", p.loc && "loc", p.lvl !== null && "lvl", p.lg && "lg", p.el && "el", p.w !== null && "w", p.min && "min", p.sort && "sort"].filter(Boolean);
  for (const w of wanted) assert.ok(p.chips.some((c) => c.id === w && c.kind === "filter"), t + ": a chip for " + w);
}
const ids2 = D.parse("quality or operations or supply chain engineering", CV).chips.map((c) => c.id);
assert.equal(new Set(ids2).size, ids2.length, "chip ids are unique");

// --- empty, junk, very long input
r = D.parse("", CV); assert.equal(r.chips.length, 0); assert.equal(r.roles.length, 0);
r = D.parse("   ", CV); assert.equal(r.chips.length, 0);
r = D.parse(null, CV); assert.equal(r.chips.length, 0);
r = D.parse("???!!!", CV); assert.equal(r.roles.length, 0);
r = D.parse("engineer ".repeat(500), CV); assert.ok(r.text.length <= 400, "input is cut at 400 characters");
r = D.parse("<script>alert(1)</script> engineer", CV);
assert.ok(r.roles.every((x) => !/[<>]/.test(x)), "role words carry no markup");
const evil = D.parse("a.*+?^${}()|[]\\ engineer", CV);
assert.doesNotThrow(() => D.titleOk(evil.roles.map(D.compile), [], D.titleKey("x")));

// --- on the real list: a request for the person's own targets finds them and leaves the rest
const jobs = JSON.parse(fs.readFileSync(new URL("../docs/jobs.json", import.meta.url), "utf8")).jobs;
const want = D.parse("industrial or mechanical or quality engineering", CV);
const R = want.roles.map(D.compile);
const hit = jobs.filter((j) => D.titleOk(R, [], D.titleKey(j.title)));
assert.ok(hit.length > 20 && hit.length < jobs.length / 4, "a focused request keeps a small part of the list: " + hit.length);
const bad = hit.filter((j) => !/engineer|ingenieur|genie|ingenierie|industriel|industrial|mechanical|mecanique|quality|qualite|qa\b/i.test(D.titleKey(j.title)));
assert.equal(bad.length, 0, "every hit has a role word in its title");
const none = jobs.filter((j) => /\bregistered nurse\b/i.test(j.title)).filter((j) => D.titleOk(R, [], D.titleKey(j.title)));
assert.equal(none.length, 0, "unrelated titles are not kept");

console.log("describe tests passed: types, hours, places, levels, language, eligibility, notes, skills, French, titles on the real list");
