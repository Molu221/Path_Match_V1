// Checks of the paste reader (docs/pasteparse.js): a posting copied from LinkedIn, Indeed, Job Bank or an employer page is split into
// title, employer, place, kind of job and link, and the description. It is a rule reader, so the tests pin down what it fills, what it
// leaves empty on purpose (it never guesses a title from a sentence), and that the description is never cut short.
// Run: node test/pasteparse.test.mjs
import assert from "node:assert/strict";
import { loadUmd } from "../scripts/umd.mjs";

const P = loadUmd("pasteparse.js", "Pasteparse");
assert.ok(P && typeof P.read === "function", "pasteparse.js loads");
const DESC = "You will support the plant on continuous improvement projects, time studies and 5S audits, and report to the operations manager. ".repeat(3);
const f = (r) => `${r.title}|${r.company}|${r.loc}|${r.type}`;

// --- the labelled format used for posts saved to a file
let r = P.read(`JOB: Quality Engineering Intern - Winter 2027\nCOMPANY: ABB | LOCATION: Dorval, Quebec, Canada | POSTED: 2026-10-15\nSOURCE: LinkedIn job 4480174440\n\n${DESC}`);
assert.equal(f(r), "Quality Engineering Intern - Winter 2027|ABB|Dorval, Quebec, Canada|Internship");
assert.ok(!/COMPANY:|SOURCE:|JOB:/.test(r.body), "the labelled header lines are not part of the description");
assert.ok(r.body.startsWith("You will support"), "the description starts where the header ends");
assert.equal(r.found.join(), "title,company,loc,type");

// --- LinkedIn: title, employer, then the place with the time and the count of applicants
r = P.read(`Industrial Engineering Co-op (Winter 2027)\nCAE\nMontreal, Quebec, Canada · 2 weeks ago · Over 100 applicants\nOn-site\nInternship\nEasy Apply\nSave\nAbout the job\n\n${DESC}`);
assert.equal(f(r), "Industrial Engineering Co-op (Winter 2027)|CAE|Montreal, Quebec, Canada|Internship");
assert.ok(!/applicants|Easy Apply|About the job|^Save$/m.test(r.body), "buttons, counts and times are not part of the description");
assert.equal(r.mode, "On-site");
// the place with a work mode in brackets
r = P.read(`Operations Analyst\nNorthline Manufacturing\nLongueuil, Quebec, Canada (Hybrid)\nFull-time\n\n${DESC}`);
assert.equal(f(r), "Operations Analyst|Northline Manufacturing|Longueuil, Quebec, Canada|");
assert.equal(r.mode, "Hybrid");
assert.ok(r.typeSeen && r.found.includes("type"), "full-time is read as stated, and is the default kind");

// --- LinkedIn when the employer comes first
r = P.read(`Northline Manufacturing logo\nNorthline Manufacturing\nSupply Chain Intern\nBrossard, QC\n\n${DESC}`);
assert.equal(f(r), "Supply Chain Intern|Northline Manufacturing|Brossard, QC|Internship");
r = P.read(`Acme Logistics\nWarehouse Associate\nLaval, QC\n\n${DESC}`);
assert.equal(r.title, "Warehouse Associate", "an employer line without a job word, before a line with one, is the employer");
assert.equal(r.company, "Acme Logistics");

// --- Indeed: "Employer - Place", the pay line, then the kind of job
r = P.read(`Stagiaire en génie industriel\nUsine Delta - Saint-Laurent, QC\n$20 - $25 an hour - Internship\nJob details\nFull Job Description\n\n${DESC}`);
assert.equal(f(r), "Stagiaire en génie industriel|Usine Delta|Saint-Laurent, QC|Internship");
assert.ok(!/an hour|Job details|Full Job Description/.test(r.body), "the pay line and the section labels are not description text");
r = P.read(`Production Assistant\nBeta Foods\n3.8\nBoucherville, QC\nPart-time\n\n${DESC}`);
assert.equal(f(r), "Production Assistant|Beta Foods|Boucherville, QC|Part-time", "a star rating line is skipped");

// --- an employer name that ends in a full stop (Inc., Ltd., ltée) is still the employer
r = P.read(`Industrial Engineering Co-op (Winter 2027)\nExample Manufacturing Inc.\nLongueuil, Quebec, Canada\nInternship\n\nAbout the job\n${DESC}`);
assert.equal(f(r), "Industrial Engineering Co-op (Winter 2027)|Example Manufacturing Inc.|Longueuil, Quebec, Canada|Internship");
assert.ok(r.body.startsWith("This is") === false && r.body.startsWith("You will support"), "the header and the section label are not description text");
r = P.read(`Plant Clerk\nWe run a busy plant and need people who care.\nLaval, QC\n\n${DESC}`);
assert.equal(r.company, "", "a sentence that ends in a full stop is not an employer");

// --- Job Bank, in French
r = P.read(`Technicien en contrôle de la qualité\nEmployeur: Aciers Nord inc.\nLieu: Montréal (QC)\nType d'emploi: Temps partiel\n\n${DESC}`);
assert.equal(f(r), "Technicien en contrôle de la qualité|Aciers Nord inc.|Montréal (QC)|Part-time");
assert.ok(!/Employeur|Lieu/.test(r.body));

// --- a kind of job stated in the body, never guessed from a loose mention
r = P.read(`Plant Clerk\nBeta Foods\nLaval, QC\n\nEmployment type: Part-time\n${DESC}`);
assert.equal(r.type, "Part-time");
r = P.read(`Plant Clerk\nBeta Foods\nLaval, QC\n\n${DESC} Part-time students are welcome to join our social events.`);
assert.equal(r.type, "", "a passing mention of part-time students does not make the job part-time");
assert.ok(!r.typeSeen);

// --- the link: a job-board link anywhere, an employer link only when it stands alone near the top, never an image
r = P.read(`Operations Analyst\nNorthline\nLaval, QC\nhttps://www.linkedin.com/jobs/view/4480174440\n\n${DESC}\nSee our values at https://www.northline.example/values`);
assert.equal(r.url, "https://www.linkedin.com/jobs/view/4480174440");
assert.ok(r.found.includes("link"));
r = P.read(`Operations Analyst\nNorthline\nLaval, QC\n\n${DESC}\nSee our values at https://www.northline.example/values and https://cdn.example/logo.png`);
assert.equal(r.url, "", "a link in the middle of the text is not taken for the link to the posting");

// --- what it refuses to guess
r = P.read(`At Northline, we help plants run leaner and cleaner, and every person here makes that happen.\n\n${DESC}`);
assert.equal(r.title, "", "a first line that reads like a sentence is not a title");
assert.equal(r.company, "");
assert.ok(r.body.startsWith("At Northline"), "and it stays in the description");
r = P.read("");
assert.equal(f(r), "|||");
assert.equal(r.body, "");

// --- the description is never cut short, and is capped at what the form allows
const long = "Tasks: " + "inventory control and scheduling. ".repeat(2000);
r = P.read("Planner\nBeta Foods\nLaval, QC\n\n" + long);
assert.equal(r.body.length, P.MAX, "capped at 30,000 characters, like the Add a posting form");
r = P.read(`Planner\nBeta Foods\nLaval, QC\n\nLine one of the posting.\r\n\r\n\r\n\r\nLine two with a non-breaking space and a zero​width space.`);
assert.ok(/Line one of the posting\.\n\nLine two with a non-breaking space and a zerowidth space\./.test(r.body), "line breaks and odd spaces are normalised, the words are kept");

// --- the three checks of the form
assert.equal(P.problem({ title: "Planner", company: "Beta Foods", body: DESC }), "");
assert.match(P.problem({ title: "", company: "Beta Foods", body: DESC }), /title/);
assert.match(P.problem({ title: "Planner", company: "B", body: DESC }), /employer/);
assert.match(P.problem({ title: "Planner", company: "Beta Foods", body: "too short" }), /few lines/);

// --- the type words
assert.equal(P.typeOf("Co-op student"), "Internship");
assert.equal(P.typeOf("Stagiaire"), "Internship");
assert.equal(P.typeOf("Temps partiel"), "Part-time");
assert.equal(P.typeOf("Full-time, permanent"), "");
assert.equal(P.typeOf("Part-time internship"), "Internship", "an internship stays an internship, like the Add a posting form");
// --- the places it knows, and those it does not mistake for an employer
for (const s of ["Montréal, QC", "Dorval, Quebec, Canada", "Montréal (QC)", "Greater Montreal Area", "Toronto, ON", "Boston, MA", "Remote", "Canada"]) assert.ok(P.isLoc(s), s + " is a place");
for (const s of ["ABB", "Bombardier Inc.", "Smith, Jones & Co", "Quality Engineering Intern"]) assert.ok(!P.isLoc(s), s + " is not a place");

console.log("pasteparse: all checks passed");
