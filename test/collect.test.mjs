// Offline tests with a fake fetch. Run: npm test
import assert from "node:assert/strict";
const NOW = Date.parse("2026-10-11T12:00:00Z");
const routes = [
  [/boards-api\.greenhouse\.io\/v1\/boards\/acme\/jobs/, () => ({ jobs: [
    { title: "Industrial Engineering Intern (Winter 2027)", location: { name: "Montréal, QC" }, first_published: "2026-10-11T09:00:00Z", absolute_url: "https://gh/1", company_name: "Acme", content: "&lt;p&gt;Lean &amp;amp; Six Sigma. Python required.&lt;/p&gt;" },
    { title: "Senior Chef", location: { name: "Montréal, QC" }, first_published: "2026-10-01T09:00:00Z", absolute_url: "https://gh/2", content: "&lt;p&gt;cook&lt;/p&gt;" },
    { title: "Data Analyst Intern", location: { name: "Toronto, ON" }, first_published: "2026-10-10T09:00:00Z", absolute_url: "https://gh/3", content: "x" } ] })],
  [/boards-api\.greenhouse\.io\/v1\/boards\/missing/, () => { const e = new Error("HTTP 404"); e.status = 404; throw e; }],
  [/api\.lever\.co\/v0\/postings\/globex/, () => [{ text: "Stagiaire en qualité", categories: { location: "Laval, QC", commitment: "Internship" }, createdAt: NOW - 5 * 36e5, hostedUrl: "https://lever/1", descriptionPlain: "FMEA, SPC, root cause.", lists: [] }]],
  [/api\.ashbyhq\.com\/posting-api\/job-board\/initech/, () => ({ jobs: [{ title: "Supply Chain Co-op", location: "Montreal", publishedAt: "2026-10-10T12:00:00Z", jobUrl: "https://ashby/1", descriptionPlain: "Inventory planning, SAP.", employmentType: "Intern" }] })],
  [/api\.smartrecruiters\.com\/v1\/companies\/umbrella\/postings\/p1$/, () => ({ jobAd: { sections: { jobDescription: { text: "<p>Operations support, Excel.</p>" } } } })],
  [/api\.smartrecruiters\.com\/v1\/companies\/umbrella\/postings\?/, () => ({ content: [{ id: "p1", name: "Operations Intern", releasedDate: "2026-10-11T06:00:00Z", location: { city: "Dorval", region: "QC", country: "ca" }, company: { name: "Umbrella" }, ref: "https://api.smartrecruiters.com/v1/companies/umbrella/postings/p1" }] })],
  [/api\.adzuna\.com/, () => ({ results: [
    { title: "Stagiaire génie industriel", company: { display_name: "Acme" }, location: { display_name: "Montréal, Québec" }, created: "2026-10-11T08:00:00Z", redirect_url: "https://adzuna/1", description: "Amélioration continue…", contract_time: "full_time" },
    { title: "Industrial Engineering Intern (Winter 2027)", company: { display_name: "Acme" }, location: { display_name: "Montreal" }, created: "2026-10-11T07:00:00Z", redirect_url: "https://adzuna/2", description: "short snippet" } ] })],
];
globalThis.fetch = async (url) => {
  const r = routes.find(([re]) => re.test(String(url)));
  if (!r) { const e = new Error("HTTP 404"); e.status = 404; throw e; }
  try { const body = r[1](); return { ok: true, status: 200, json: async () => body }; } catch (e) { return { ok: false, status: e.status || 500, json: async () => ({}) }; }
};
process.env.ADZUNA_APP_ID = "x"; process.env.ADZUNA_APP_KEY = "y";
const c = await import("../scripts/collect.mjs");

// helpers
assert.equal(c.stripHtml("&lt;p&gt;Lean &amp;amp; Six&lt;/p&gt;"), "Lean & Six");
assert.ok(c.AREA.test("Montréal, QC") && c.AREA.test("Saint-Laurent") && !c.AREA.test("Toronto, ON"));

// each source
const gh = await c.greenhouse("acme", NOW);
assert.equal(gh.length, 1); assert.equal(gh[0].title.startsWith("Industrial"), true); assert.equal(gh[0].ageH, 3); assert.match(gh[0].desc, /Lean & Six Sigma/);
await assert.rejects(() => c.greenhouse("missing", NOW), (e) => e.status === 404);
const lv = await c.lever("globex", NOW); assert.equal(lv[0].type, "Internship"); assert.equal(lv[0].ageH, 5);
const ab = await c.ashby("initech", NOW); assert.equal(ab[0].type, "Internship");
const sr = await c.smartrecruiters("umbrella", NOW); assert.match(sr[0].desc, /Operations support/); assert.equal(sr[0].sources[0].url, "https://jobs.smartrecruiters.com/umbrella/p1");

// merge prefers full text over an Adzuna snippet and joins sources
const az = await c.adzuna({ queries: ["q"], pages: 1, resultsPerPage: 50, country: "ca", where: "Montreal", distanceKm: 40, maxDaysOld: 7, delayMs: 0 }, "x", "y", NOW, () => {});
assert.equal(az.jobs.length, 2);
const m = c.merge([...az.jobs, ...gh]);
const dup = m.find((j) => /Industrial Engineering Intern/.test(j.title));
assert.equal(dup.sources.length, 2); assert.equal(dup.partial, undefined); assert.match(dup.desc, /Six Sigma/);
assert.equal(m.length, 2);

// full run with the real config: unknown slugs are skipped, not fatal
const out = await c.main({
  nowMs: NOW, log: () => {}, write: false,
  companies: { greenhouse: ["acme", "missing"], lever: ["globex"], ashby: ["initech"], smartrecruiters: ["umbrella"] },
  searches: { adzuna: { queries: ["q"], pages: 1, resultsPerPage: 50, country: "ca", where: "Montreal", distanceKm: 40, maxDaysOld: 7, delayMs: 0 } },
});
assert.equal(out.notFoundCount, 1);
assert.equal(out.sources.Greenhouse.boards, 2); assert.equal(out.sources.Greenhouse.answered, 1);
assert.ok(out.jobs.length === 5, "expected postings from the fake sources, got " + out.jobs.length);
assert.ok(out.sources.Adzuna.jobs >= 1);
console.log("all tests passed:", out.jobs.length, "merged postings;", JSON.stringify(out.sources.Greenhouse));
