// employer discovery and applying the finder results
import assert from "node:assert/strict";
import { norm, pick, tenantGuesses } from "../scripts/discover-employers.mjs";
import { similar, mergeBoards, mergeWorkday } from "../scripts/apply-finds.mjs";

assert.equal(norm("Bombardier Inc."), "bombardier");
assert.equal(norm("Groupe Robert Ltée"), "robert");
assert.equal(norm("L'Oréal Canada"), "l oreal");
assert.deepEqual(tenantGuesses("BMO Financial"), ["bmofinancial", "bmo"]);
assert.equal(tenantGuesses("University of British Columbia").length, 1, "a generic first word (university) is not a guess");

const NOW = Date.parse("2026-11-02T00:00:00Z");
const job = (company, ...src) => ({ company, title: "t", sources: src.map((s) => ({ src: s })) });
const jobs = [
  job("Acme Inc.", "Adzuna"), job("ACME", "Jooble"), job("Acme", "Job Bank"),          // search services only: 3 postings
  job("Bolt Ltd", "Adzuna"), job("Bolt", "Greenhouse"),                                  // already has a direct board
  job("Cargo Staffing Agency", "Adzuna"), job("Unknown", "Adzuna"), job("Dune", "Adzuna"), job("Dune", "Adzuna"),
];
const got = pick(jobs, { checked: {} }, { nowMs: NOW });
assert.deepEqual(got.map((x) => [x.key, x.postings]), [["acme", 3], ["dune", 2]], "busiest first; direct boards, staffing agencies and unknown names left out");
const again = pick(jobs, { checked: { acme: "2026-10-20" } }, { nowMs: NOW });
assert.deepEqual(again.map((x) => x.key), ["dune"], "an employer looked up recently is not looked up again");
assert.equal(pick(jobs, { checked: { acme: "2026-05-01" } }, { nowMs: NOW }).length, 2, "but it is after 90 days");

// a board counts only when its name looks like the employer that was searched for
assert.ok(similar("Taiga Motors", "Taigamotors"));
assert.ok(similar("Pratt & Whitney Canada", "Pratt Whitney"));
assert.ok(!similar("Vention", "Tim Hortons"));
const companies = { greenhouse: ["stripe"], lever: [], workday: [{ name: "CAE", host: "cae.wd3.myworkdayjobs.com", tenant: "cae", site: "career" }] };
const boards = { hits: {
  "Taiga Motors": { greenhouse: [{ slug: "taigamotors", company: "Taigamotors", montrealJobs: 15 }] },
  "Vention": { lever: [{ slug: "vention", company: "Vention" }, { slug: "vention-x", company: "Totally Other Company" }] },
  "Stripe": { greenhouse: [{ slug: "stripe", company: "Stripe" }] },
} };
const r = mergeBoards(companies, boards);
assert.deepEqual(companies.greenhouse, ["stripe", "taigamotors"]);
assert.deepEqual(companies.lever, ["vention"], "the slug of another company goes to review, not to the config");
assert.equal(r.review.length, 1); assert.equal(r.review[0].slug, "vention-x");

const wd = { hits: {
  bmo: [{ host: "bmo.wd3.myworkdayjobs.com", tenant: "bmo", site: "External", total: 900, canada: 700 }, { host: "bmo.wd3.myworkdayjobs.com", tenant: "bmo", site: "Careers", total: 900, canada: 650 }],
  cae: [{ host: "cae.wd3.myworkdayjobs.com", tenant: "cae", site: "career", total: 400, canada: 100 }],
  abroad: [{ host: "abroad.wd1.myworkdayjobs.com", tenant: "abroad", site: "External", total: 500, canada: 0 }],
  small: [{ host: "small.wd5.myworkdayjobs.com", tenant: "small", site: "Careers", total: 40, canada: null }],
} };
const w = mergeWorkday(companies, wd, { bmo: "BMO" });
assert.deepEqual(w.added.map((x) => x.tenant), ["bmo", "small"], "one site per tenant, the busiest; known tenants and sites without Canadian postings are left out");
assert.equal(companies.workday.find((x) => x.tenant === "bmo").site, "External");
assert.equal(companies.workday.find((x) => x.tenant === "bmo").name, "BMO");
assert.equal(companies.workday.find((x) => x.tenant === "small").name, "Small");
console.log("discovery tests passed");
