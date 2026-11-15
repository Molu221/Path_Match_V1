// Checks of Reach out (docs/reach.js and its use in docs/pages.js, docs/index.html): people-search links and message drafts for one posting.
// The module only builds text. What matters: nothing is sent, only the employer, the role words and the school go into a link (never the name,
// the program or the CV), a hidden employer gives no links, a connection note fits its limit, and a draft names a skill only when it is passed.
// Run: node test/reach.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadUmd } from "../scripts/umd.mjs";

const R = loadUmd("reach.js", "Reach");
const plain = (x) => JSON.parse(JSON.stringify(x));      /* the module runs in its own context: compare plain copies */
const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
assert.ok(R && typeof R.links === "function" && typeof R.drafts === "function", "reach.js loads");

// --- the employer
assert.equal(R.orgOf("ABB Canada Inc."), "ABB Canada");
assert.equal(R.orgOf("Bombardier inc."), "Bombardier");
assert.equal(R.orgOf("CAE Inc., S.E.C."), "CAE");
assert.equal(R.orgOf("Pratt & Whitney Canada Corp."), "Pratt & Whitney Canada");
assert.equal(R.orgOf("Hydro-Québec"), "Hydro-Québec", "a name without a legal ending is left alone");
assert.equal(R.orgOf("Desjardins Groupe d'assurances générales (Canada)"), "Desjardins Groupe d'assurances générales", "a (Canada) tail is dropped");
assert.equal(R.orgOf('The "Best" Co'), "The Best", "quotes cannot break a search phrase");
assert.equal(R.orgOf("Inc"), "Inc", "a name that is only a legal ending is kept");
for (const c of ["Confidential", "Employeur confidentiel", "Company Confidential", "Undisclosed", "", " ", null]) assert.equal(R.hidden(c), true, `hidden: ${c}`);
for (const c of ["ABB", "Hydro-Québec", "Confidence Capital"]) assert.equal(R.hidden(c), false, `named: ${c}`);

// --- the role words of a title
const roles = [
  ["Industrial Engineering Intern - Winter 2027", "Industrial Engineering"],
  ["Stagiaire en génie industriel (Hiver 2027)", "génie industriel"],
  ["Contrôleur de projet (PCO)", "Contrôleur de projet"],
  ["Intern, Industrial Engineering", "Industrial Engineering"],
  ["Étudiant(e) en qualité – été 2027", "qualité"],
  ["Co-op Supply Chain Analyst (Summer 2026)", "Supply Chain Analyst"],
  ["Part-time Warehouse Associate", "Warehouse Associate"],
  ["Junior Quality Engineer H/F", "Quality Engineer"],
  ["Stage - Ingénierie de la fiabilité", "Ingénierie de la fiabilité"],
  ["Senior Manager of Continuous Improvement and Lean Transformation Programs", "Senior Manager of Continuous"]
];
for (const [t, want] of roles) assert.equal(R.roleOf(t), want, t);
assert.equal(R.roleOf("Intern"), "", "a title with nothing but the kind of job gives no role words");

// --- links
const ctx = { company: "ABB Canada Inc.", title: "Industrial Engineering Intern - Winter 2027", school: "Concordia University" };
const L = R.links(ctx), id = (x) => L.find((l) => l.id === x);
assert.deepEqual(plain(L.map((l) => l.id)), ["alumni", "recruiters", "role", "leads", "company", "careers"]);
assert.equal(decodeURIComponent(id("alumni").url), 'https://www.linkedin.com/search/results/people/?keywords="ABB Canada" "Concordia University"');
assert.ok(/recruteur/.test(decodeURIComponent(id("recruiters").url)), "recruiters are searched for in French too");
assert.ok(L.every((l) => /^https:\/\/(www\.linkedin\.com|www\.google\.com)\//.test(l.url)), "only LinkedIn and Google");
assert.ok(!R.links({ ...ctx, school: "" }).some((l) => l.id === "alumni"), "no school: no alumni link");
assert.deepEqual(plain(R.links({ company: "Confidential", title: "Intern", school: "X" })), [], "a hidden employer gives no links");
assert.ok(!R.links({ company: "ABB", title: "Intern", school: "" }).some((l) => l.id === "role" || l.id === "leads"), "no role words: no role links");
const nasty = R.links({ company: 'A&B "Co" #1 Inc.', title: "Engineer?&x=1", school: "École <b>X</b>" });
for (const l of nasty) { const u = new URL(l.url); assert.ok([...u.searchParams.keys()].every((k) => k === "keywords" || k === "q"), "no extra parameter can be added through a name"); }
// the name, the program and the CV are never in an address
const withPerson = R.links({ ...ctx, name: "Alex Example", program: "Industrial Engineering", cv: "secret cv text" });
assert.ok(!JSON.stringify(withPerson).match(/Alex|secret|Example/), "the name and the CV never reach a link");

// --- drafts
const D = (o) => R.drafts({ ...ctx, name: "Alex", program: "Industrial Engineering", lang: "en", ...o });
const d1 = D({ skills: ["Excel", "Six Sigma", "Python"] }), by = (ds, k) => ds.find((d) => d.id === k);
assert.deepEqual(plain(d1.map((d) => d.id)), ["note", "recruiter", "advice"]);
assert.ok(by(d1, "note").text.length <= R.NOTE_MAX && !by(d1, "note").over, "the connection note fits");
assert.ok(/I'm studying Industrial Engineering at Concordia University/.test(by(d1, "note").text));
assert.ok(/asks for Excel and Six Sigma, which are on my CV/.test(by(d1, "recruiter").text) && !/Python/.test(by(d1, "recruiter").text), "at most two skills, only the ones passed");
assert.ok(!/asks for/.test(by(D({ skills: [] }), "recruiter").text), "no skill passed: no skill named");
assert.ok(/which is on my CV/.test(by(D({ skills: ["Excel"] }), "recruiter").text), "one skill: singular");
assert.ok(/Alex$/.test(by(d1, "recruiter").text) && /Hello \[Name\]/.test(by(d1, "recruiter").text));
const anon = D({ name: "", program: "", school: "" });
assert.ok(/\[Your name\]$/.test(by(anon, "advice").text), "no name: a placeholder, never a made-up one");
assert.ok(/I'm a student and/.test(by(anon, "advice").text) && !/at undefined|null/.test(JSON.stringify(anon)), "no program and no school: nothing invented");
// a long employer or program shortens the note instead of cutting it in the middle
const longNote = R.drafts({ company: "A Very Long Company Name Of Many Words International Holdings Group", title: "Industrial Engineering Intern", lang: "en", program: "Industrial Engineering and Supply Chain Management", school: "Concordia University" })[0];
assert.ok(longNote.text.length <= R.NOTE_MAX && !longNote.over && /[.?]$/.test(longNote.text), "the long version is dropped for a shorter one that still ends properly");
const huge = R.drafts({ company: "X".repeat(300), title: "Intern", lang: "en" })[0];
assert.equal(huge.over, true, "when even the shortest version is too long it says so");
// French
const f = R.drafts({ company: "CAE Inc.", title: "Stagiaire en génie industriel (Hiver 2027)", lang: "fr", program: "génie industriel", school: "Université Concordia", skills: ["Excel", "Python"] });
assert.ok(/j'étudie en génie industriel à l'Université Concordia/.test(by(f, "note").text), "à l' before Université");
assert.ok(/Le poste demande Excel et Python, qui figurent sur mon CV/.test(by(f, "recruiter").text));
assert.ok(/qui figure sur mon CV/.test(by(R.drafts({ company: "CAE", title: "Stage", lang: "fr", skills: ["Excel"] }), "recruiter").text));
assert.ok(/à Concordia/.test(by(R.drafts({ company: "CAE", title: "Stage - Qualité", lang: "fr", school: "Concordia", program: "génie" }), "note").text), "à before a school without an article");
assert.ok(/\[Prénom\]/.test(by(f, "recruiter").text) && /\[Votre nom\]/.test(by(f, "advice").text));
// no draft promises or claims anything that was not given
for (const d of [...d1, ...f]) assert.ok(!/undefined|null|NaN|\$\{/.test(d.text), "no leftover placeholder code in " + d.id);

// --- the module and its use in the page
const src = read("docs/reach.js"), pages = read("docs/pages.js"), html = read("docs/index.html");
assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|mailto:|window\.open|location\s*=|document\./.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "reach.js only builds text: it sends and opens nothing");
const ui = pages.slice(pages.indexOf("REACH OUT:"), pages.indexOf("the object index.html reads"));
assert.ok(ui.length > 500 && !/fetch\(|XMLHttpRequest|sendBeacon|mailto:|window\.open/.test(ui), "the Reach out page code sends and opens nothing by itself");
assert.ok(/target="_blank" rel="noopener noreferrer"/.test(ui), "links open in a new tab without handing over the page");
assert.ok(/pm_reach/.test(ui) && !/pm_reach/.test(html), "school, program and name are kept in this browser, under one key");
assert.ok(/x\.st === "M" && x\.kind === "s"/.test(ui), "only skills that are written on the CV are named in a draft");
assert.ok(/!isOcc\(job\)/.test(ui), "a skill is never named for an occupation profile");
assert.ok(html.includes('id="reachdlg"') && html.includes('id="reachclose"') && html.includes('<script src="reach.js"></script>'), "the dialog and the script are on the page");
assert.ok(html.indexOf('<script src="reach.js"></script>') < html.indexOf('<script src="pages.js"></script>'), "reach.js loads before pages.js");
assert.ok(/const reachBtn=\(j,jk\)=>isOcc\(j\)\?""/.test(html), "an occupation profile has no Reach out button: it has no employer");
assert.ok((html.match(/\$\{reachBtn\(j,jk\)\}/g) || []).length === 2, "scored cards and browse cards both have the button");
assert.ok(/data-reach="\$\{esc\(e\.k\)\}"/.test(pages), "board cards have the button");
assert.ok(/Path Match never sends a message or contacts anyone/.test(ui), "the dialog says it sends nothing");
console.log("reach.test.mjs: all checks passed");
