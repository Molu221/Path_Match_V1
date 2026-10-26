// Offline tests of docs/jobmeta.js: the level of a posting, the level of a CV, the fit between them, and the field of a posting.
// Run: node test/jobmeta.test.mjs
import assert from "node:assert/strict";
import { loadJobMeta } from "../scripts/umd.mjs";
const J = loadJobMeta();

// ---- level of a posting, read from the title ----
const levels = [
  ["Summer Student", 0], ["Stagiaire en construction", 0], ["Co-op Student – Quality", 0], ["Industrial Engineering Intern (Winter 2027)", 0], ["Stage - Hiver 2027 - Ingénierie", 0], ["Software Engineering Intern", 0],
  ["Junior Accountant", 1], ["Data Analyst (Entry Level)", 1], ["Management Trainee", 1], ["Electrician Apprentice", 1], ["Software Engineer I", 1], ["Marketing Assistant", 1], ["Sales Associate", 1], ["Graduate Engineer", 1],
  ["Registered Nurse", 2], ["Marketing Coordinator", 2], ["Software Engineer II", 2], ["Account Manager", 2], ["Assistant Manager", 2], ["Executive Assistant", 2], ["Logistics Coordinator", 2], ["Product Manager", 2], ["Mid-level Developer", 2],
  ["Senior Software Engineer", 3], ["Team Lead, Customer Support", 3], ["Warehouse Supervisor", 3], ["Principal Engineer", 3], ["Chef de projet", 3], ["Engineering Manager", 3], ["Associate Director, Finance", 3], ["Art Director", 3], ["Gestionnaire, achats", 3], ["Software Engineer III", 3],
  ["Director of Marketing", 4], ["VP Engineering", 4], ["Head of Product", 4], ["Directeur général", 4], ["Chief Financial Officer", 4], ["Managing Director", 4], ["Director, Performance Marketing", 4],
];
for (const [t, want] of levels) assert.equal(J.jobLevel(t, "", "").lvl, want, t);
// words that only look like level words
for (const t of ["Internal Auditor", "International Sales Representative", "Student Success Advisor", "Early-stage Startup Marketer", "Stage Manager", "Lead Generation Specialist", "Counsellor for Students"])
  assert.ok(J.jobLevel(t, "", "").lvl >= 2 || t === "Early-stage Startup Marketer" && J.jobLevel(t, "", "").lvl === 2, t + " is not an internship: level " + J.jobLevel(t, "", "").lvl);
assert.equal(J.jobLevel("Marketing Specialist", "", "Internship").lvl, 0, "the source says internship");
// no level word: the years the text asks for decide
assert.equal(J.jobLevel("Marketing Specialist", "You have 1-2 years of experience in marketing.", "").lvl, 1);
assert.equal(J.jobLevel("Marketing Specialist", "Requirements: 3+ years of related experience.", "").lvl, 2);
assert.equal(J.jobLevel("Marketing Specialist", "Requirements: Minimum 8 years of progressive experience.", "").lvl, 3);
assert.equal(J.jobLevel("Marketing Specialist", "Au moins 5 ans d'expérience en marketing.", "").lvl, 3);
assert.equal(J.jobLevel("Marketing Specialist", "With over 25 years of experience, we are a leader in the field. Entry level welcome.", "").lvl, 1, "company history is not a requirement");
assert.equal(J.jobLevel("Cashier", "No experience required. Training provided.", "").lvl, 1);
assert.equal(J.jobLevel("Senior Analyst", "1 year of experience", "").lvl, 3, "the title wins over the text");
assert.equal(J.jobLevel("Analyst", "", "").src, "default");
assert.match(J.jobLevel("Director of Marketing").why, /director/);

// ---- level of a person, read from a CV ----
const NOW = new Date("2026-10-25");
const CVS = {
  ie_student: [`Alex Example, M.Eng. Industrial Engineering, Concordia University.\nExperience: Operations intern, manufacturing plant. Quality analyst co-op: root cause analysis.\nLeadership: president of the industrial engineering student association.`, 0],
  marketing_grad: [`Priya Singh\nEDUCATION\nBachelor of Commerce, Marketing - McGill University, Sept 2021 - May 2025\nEXPERIENCE\nSocial Media Intern, Lumen Studio, Jun 2024 - Aug 2024\nMarketing Assistant (part-time), Campus Bookstore, Sep 2023 - Apr 2024`, 0],
  student_still_enrolled: [`EDUCATION\nB.Sc. Computer Science, University of Toronto, 2023 - 2027 (expected)\nEXPERIENCE\nSoftware Developer, Acme, Jun 2026 - Present`, 0],
  working_part_time_student: [`EDUCATION\nMBA (part-time), HEC Montréal, 2025 - 2027 (expected)\nEXPERIENCE\nOperations Analyst, Acme, Jan 2020 - Present`, 2],
  early_career: [`Sam Lee\nEXPERIENCE\nJunior Developer, Acme Web, Jan 2024 - Present\nB.Sc. Computer Science, Concordia University, 2019 - 2023`, 1],
  mid: [`Marc\nEXPERIENCE\nSoftware Developer, Agency, Mar 2022 - Present\nJunior Developer, Acme Web, Jan 2021 - Feb 2022\nEDUCATION\nB.Sc., 2016 - 2020`, 2],
  senior: [`EXPERIENCE\nSenior Developer, Shopify, 2017 - Present\nDeveloper, Acme, 2014 - 2017\nEDUCATION\nB.Sc., 2010 - 2014`, 3],
  exec: [`Vice President, Operations — 20+ years of experience.\nVice President, Operations, Groupe Laval Inc., 2016 - Present\nDirector of Supply Chain, Metalex, 2010 - 2016\nPlant Manager, Metalex, 2004 - 2010\nEDUCATION: B.Eng., McGill University, 1995 - 1999. MBA.`, 4],
  french: [`EXPÉRIENCE\nAnalyste financier, Banque Nationale, janvier 2022 - présent\nStagiaire, Desjardins, mai 2018 - août 2018\nFORMATION\nBaccalauréat en finance, HEC Montréal, 2015 - 2018`, 2],
};
for (const [k, [text, want]] of Object.entries(CVS)) { const r = J.cvLevel(text, NOW); assert.equal(r.band, want, k + " -> " + JSON.stringify(r)); assert.ok(r.why.length, k + " explains itself"); }
assert.equal(J.cvLevel("Lorem ipsum dolor sit amet. I like turtles.", NOW).band, null, "nothing to read: the level is unknown, not guessed");
assert.equal(J.cvLevel("I have 9 years of experience in sales and marketing.", NOW).band, 3);
// "Dec 2021" is a month, not a degree
assert.equal(J.cvLevel("EXPERIENCE\nAnalyst, Acme, Dec 2018 - Present\nEDUCATION\nB.A., 2014 - 2018", NOW).band, 3);

// ---- fit between a person and a posting ----
assert.ok(J.fit(0, 0) >= 0.9 && J.fit(0, 1) >= 0.85, "a fresher fits internships and entry-level");
assert.ok(J.fit(0, 3) < 0.15 && J.fit(0, 4) === 0, "a fresher does not fit senior or director roles");
assert.ok(J.fit(4, 4) === 1 && J.fit(4, 0) === 0);
assert.equal(J.relation(0, 4), "far"); assert.equal(J.relation(0, 3), "far"); assert.equal(J.relation(0, 2), "step"); assert.equal(J.relation(0, 1), "fits"); assert.equal(J.relation(0, 0), "fits");
assert.equal(J.relation(2, 0), "well-below"); assert.equal(J.relation(2, 1), "below"); assert.equal(J.relation(2, 3), "fits"); assert.equal(J.relation(2, 4), "far");
assert.equal(J.relation(null, 3), "unknown"); assert.equal(J.fit(null, 3), 0.6);
for (let b = 0; b < 5; b++) for (let l = 0; l < 5; l++) assert.ok(J.fit(b, l) >= 0 && J.fit(b, l) <= 1);
for (let b = 0; b < 5; b++) assert.equal(Math.max(...[0, 1, 2, 3, 4].map((l) => J.fit(b, l))), 1.0 === J.fit(b, b) ? 1 : J.fit(b, b), "the best fit is at the person's own level or next to it");

// ---- field of a posting ----
const fields = [
  ["Senior Software Engineer", "software"], ["Server Engineer", "software"], ["Mid-level Developer", "software"], ["Data Analyst", "data"], ["Business Intelligence Developer", "data"],
  ["Registered Nurse", "health"], ["Dental Hygienist", "health"], ["Pharmacy Assistant", "health"], ["Line Cook", "hospitality"], ["Server - JOEY Kelowna", "hospitality"], ["Barista", "hospitality"], ["Sales Associate", "hospitality"],
  ["Elementary School Teacher", "education"], ["Social Worker", "education"], ["Staff Accountant", "finance"], ["Financial Analyst", "finance"], ["Human Resources Generalist", "hr"], ["Recruiter", "hr"],
  ["Graphic Designer", "creative"], ["Digital Marketing Specialist", "marketing"], ["Account Executive", "marketing"], ["Supply Chain Analyst", "ops"], ["Warehouse Associate", "ops"], ["Quality Assurance Inspector", "ops"],
  ["Mechanical Engineer", "engineering"], ["Industrial Engineer", "engineering"], ["Licensed Electrician", "trades"], ["Welder", "trades"], ["Construction Project Manager", "product"], ["Project Coordinator", "product"],
  ["Paralegal", "legal"], ["Research Scientist", "data"], ["Lab Technician", "science"], ["Customer Service Representative", "admin"], ["Administrative Assistant", "admin"], ["Stagiaire en construction", "construction"],
];
for (const [t, want] of fields) assert.equal(J.fieldOf(t).id, want, t + " -> " + J.fieldOf(t).id);
assert.equal(J.fieldOf("Quelque chose d'inclassable").id, "other");
assert.ok(J.FIELD_LIST.length >= 15 && J.FIELD_LIST.at(-1).id === "other");
console.log("jobmeta tests passed:", levels.length, "titles,", Object.keys(CVS).length, "CVs,", fields.length, "fields");
