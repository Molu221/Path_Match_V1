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
  // ---- more sources (shapes taken from the live responses saved in reports/probe) ----
  [/jobbank\.gc\.ca\/jobsearch\/feed\/jobSearchRSSfeed/, () => ATOM],
  [/jobbank\.gc\.ca\/jobsearch\/jobposting\/111$/, () => jbPage({ noc: "industrial engineer", title: "Stagiaire en génie industriel", employer: "Usine Alpha", city: "Montréal", partner: "https://partner.example/offre/111", description: "" })],
  [/guichetemplois\.gc\.ca\/jobsearch\/jobposting\/111$/, () => jbPage({ noc: "industrial engineer", title: "Stagiaire en génie industriel", employer: "Usine Alpha", city: "Montréal", description: "Soutien à l'amélioration continue. Exigences: baccalauréat en génie industriel. Atouts: Lean, Excel." })],
  [/jobbank\.gc\.ca\/jobsearch\/jobposting\/333$/, () => jbPage({ noc: "industrial engineer", title: "Industrial engineering co-op", employer: "Direct Employer", city: "Laval", description: "Time studies and Lean projects. Requirements: Excel. Preferred: Minitab." })],
  [/themuse\.com\/api\/public\/jobs/, () => ({ page_count: 1, results: [
    { name: "Supply Chain Intern", publication_date: "2026-10-10T10:00:00Z", company: { name: "Muse Co" }, locations: [{ name: "Montreal, Canada" }], levels: [{ name: "Internship" }], refs: { landing_page: "https://muse/1" }, contents: "<p>Inventory planning with SAP. Requirements: Excel.</p>" },
    { name: "Barista", publication_date: "2026-10-10T10:00:00Z", company: { name: "Muse Co" }, locations: [{ name: "Montreal, Canada" }], levels: [], refs: { landing_page: "https://muse/2" }, contents: "<p>coffee</p>" } ] })],
  [/wday\/cxs\/acme\/site\/jobs$/, (u, o) => { const q = JSON.parse(o.body); return { total: 2, jobPostings: (q.offset === 0 ? [
    { title: "Industrial Engineering Intern", externalPath: "/job/Montreal/Intern_R1", locationsText: "Montreal", postedOn: "Posted Today" },
    { title: "Welder", externalPath: "/job/Toronto/Welder_R2", locationsText: "Toronto", postedOn: "Posted 3 Days Ago" } ] : []) }; }],
  [/wday\/cxs\/acme\/site\/job\/Montreal\/Intern_R1$/, () => ({ jobPostingInfo: { title: "Industrial Engineering Intern", jobDescription: "<p>Lean projects</p><p>Qualifications</p><ul><li>Excel</li></ul>", location: "Montreal", startDate: "2026-10-11", timeType: "Full time", externalUrl: "https://acme.wd1.myworkdayjobs.com/site/job/Montreal/Intern_R1" } })],
  [/apply\.workable\.com\/api\/v1\/widget\/accounts\/wk/, () => ({ name: "WK", jobs: [{ title: "Quality Intern", city: "Montreal", state: "Quebec", country: "Canada", published_on: "2026-10-10", url: "https://workable/1", description: "<p>FMEA and SPC</p>" }] })],
  [/wr\.recruitee\.com\/api\/offers/, () => ({ offers: [{ title: "Stagiaire logistique", company_name: "Rec", location: "Montréal, QC", published_at: "2026-10-09T10:00:00Z", careers_url: "https://rec/1", description: "<p>Logistique</p>", requirements: "<p>Excel</p>" }] })],
  [/bz\.breezy\.hr\/json/, () => [{ name: "Process Engineer Co-op", company: { name: "Bz" }, location: { name: "Montreal, QC" }, published_date: "2026-10-09T10:00:00Z", url: "https://bz.breezy.hr/p/1", type: { name: "Internship" } }]],
  [/bz\.breezy\.hr\/p\/1$/, () => '<script type="application/ld+json">{"@type":"JobPosting","title":"Process Engineer Co-op","description":"<p>Six Sigma and process mapping</p>"}</script>'],
  [/bh\.bamboohr\.com\/careers\/list/, () => ({ result: [{ id: 5, jobOpeningName: "Maintenance Intern", location: { city: "Dorval", state: "QC" }, employmentStatusLabel: "Internship" }] })],
  [/bh\.bamboohr\.com\/careers\/5\/detail/, () => ({ result: { jobOpening: { description: "<p>Preventive maintenance</p>", datePosted: "2026-10-08" } } })],
  [/pe\.jobs\.personio\.de\/xml/, () => '<workzag-jobs><position><id>7</id><subcompany>Pe GmbH</subcompany><office>Montréal</office><name>Operations Intern</name><employmentType>intern</employmentType><createdAt>2026-10-10T08:00:00+00:00</createdAt><jobDescriptions><jobDescription><name>Your profile</name><value><![CDATA[<p>Excel, Lean</p>]]></value></jobDescription></jobDescriptions></position></workzag-jobs>'],
  [/tt\.teamtailor\.com\/jobs\.rss/, () => '<rss><channel><item><title>Quality Co-op</title><link>https://tt/1</link><pubDate>Fri, 09 Oct 2026 10:00:00 +0000</pubDate><description><![CDATA[<p>Audits and SPC</p>]]></description><tt:locations><tt:location><tt:city>Montréal</tt:city></tt:location></tt:locations></item></channel></rss>'],
  [/careers\.example\.com\/jobs/, () => '<html><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"JobPosting","title":"Supply Chain Intern","datePosted":"2026-10-10","employmentType":"INTERN","hiringOrganization":{"name":"Example Inc"},"jobLocation":{"address":{"addressLocality":"Montréal","addressRegion":"QC","addressCountry":"CA"}},"description":"<p>Planning and procurement</p>","url":"https://careers.example.com/jobs/1"}]}</script></html>'],
  [/jooble\.org\/api\/KEY/, () => ({ jobs: [{ title: "Stagiaire qualité", company: "Jo Co", location: "Montréal, QC", updated: "2026-10-11T00:00:00Z", link: "https://jooble/1", snippet: "Contrôle qualité", type: "" }] })],
  [/search\.api\.careerjet\.net\/v4\/query/, () => ({ jobs: [{ title: "Operations intern", company: "Cj Co", locations: "Montreal, QC", date: "Sun, 11 Oct 2026 08:00:00 GMT", url: "https://careerjet/1", description: "Warehouse operations" }] })],
];

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>x</title>
<entry><title type="html"><![CDATA[industrial engineer]]></title><link rel="alternate" type="text/html" href="https://www.jobbank.gc.ca/jobsearch/jobposting/111"/><updated>2026-10-11T02:00:00Z</updated><summary type="html"><![CDATA[<strong>Job number:</strong> 1<br /><strong>Location:</strong> Montréal (QC)  <br /><strong>Employer:</strong> Usine Alpha<br /><strong>Salary:</strong> $30 hourly]]></summary></entry>
<entry><title type="html"><![CDATA[industrial engineer]]></title><link rel="alternate" type="text/html" href="https://www.jobbank.gc.ca/jobsearch/jobposting/222"/><updated>2026-10-11T02:00:00Z</updated><summary type="html"><![CDATA[<strong>Location:</strong> Toronto (ON)  <br /><strong>Employer:</strong> Far Away]]></summary></entry>
<entry><title type="html"><![CDATA[industrial engineer]]></title><link rel="alternate" type="text/html" href="https://www.jobbank.gc.ca/jobsearch/jobposting/333"/><updated>2026-10-10T02:00:00Z</updated><summary type="html"><![CDATA[<strong>Location:</strong> Laval (QC)  <br /><strong>Employer:</strong> Direct Employer]]></summary></entry>
<entry><title type="html"><![CDATA[cook]]></title><link rel="alternate" type="text/html" href="https://www.jobbank.gc.ca/jobsearch/jobposting/444"/><updated>2026-10-10T02:00:00Z</updated><summary type="html"><![CDATA[<strong>Location:</strong> Montréal (QC)  <br /><strong>Employer:</strong> Diner]]></summary></entry>
</feed>`;
/* the parts of a Job Bank page the collector reads, in the order and markup of the live page */
const jbPage = ({ noc, title, employer, city, description = "", partner }) => `<h1 property="name"><span property="title">${noc} </span></h1>
<p class="source-title"><span class="source-title-inner"><span class="orig-title-label">Title posted on Partner - </span>${title}</span></p>
<span property="hiringOrganization" typeof="Organization"><span property="name"><strong>${employer}</strong></span></span>
<span class="hidden" property="description">${description}</span>
<ul class="job-posting-brief colcount-lg-2 "><li><span class="wb-inv">Location</span><span><span property="addressLocality">${city}</span>, <span property="addressRegion">QC</span></span></li>
<li><span class="wb-inv">Terms of employment</span><span>Temporary employment Part time</span></li></ul>
${partner ? `<a id="externalJobLink" class="btn" href="${partner}"><span>View the full job posting on</span> <span class="job-source job-source-icon-33"></span> Partner.example <span class="fa"></span></a>` : ""}`;
globalThis.fetch = async (url, opts = {}) => {
  const r = routes.find(([re]) => re.test(String(url)));
  if (!r) return { ok: false, status: 404, text: async () => "", json: async () => ({}) };
  try {
    const body = r[1](String(url), opts);
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
  } catch (e) { return { ok: false, status: e.status || 500, text: async () => "", json: async () => ({}) }; }
};
const fetchOk = globalThis.fetch;
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


// helpers for the new sources
assert.equal(c.breakHeadings("Intro. Requirements: Excel. Preferred Qualifications: Lean.").split("\n").filter(Boolean).length, 5);
assert.equal(c.breakHeadings("a\nb\nc\nd\ne\nf\ng\nh\nRequirements: x"), "a\nb\nc\nd\ne\nf\ng\nh\nRequirements: x", "text that already has lines is left alone");
assert.equal(c.jsonLdJobs('<script type="application/ld+json">{ not json</script>').length, 0);

// Job Bank: the feed lists, only Montreal-area relevant rows are opened; partner posts take their text from the French page
const noPause = async () => {};
const jb = await c.jobbank({ queries: ["engineer"], where: "Montréal, QC", maxDaysOld: 7, maxDetails: 10, delayMs: 0 }, NOW, () => {}, noPause);
assert.equal(jb.listed, 4); assert.equal(jb.inArea, 2, "Toronto and the cook row are not opened");
assert.equal(jb.jobs.length, 2);
const partnerPost = jb.jobs.find((j) => /Stagiaire/.test(j.title));
assert.equal(partnerPost.company, "Usine Alpha"); assert.equal(partnerPost.loc, "Montréal, QC"); assert.equal(partnerPost.type, "Internship");
assert.equal(partnerPost.partial, undefined); assert.match(partnerPost.desc, /\nExigences\n/); assert.match(partnerPost.desc, /Job summary:/);
assert.deepEqual(partnerPost.sources.map((x) => x.src), ["Job Bank", "Partner.example"]);
assert.equal(jb.jobs.find((j) => /co-op/.test(j.title)).type, "Internship");

// The Muse
const mu = await c.muse({ location: "Montreal, Canada", levels: ["Internship"], pages: 2 }, NOW, () => {});
assert.equal(mu.jobs.length, 1); assert.equal(mu.jobs[0].type, "Internship"); assert.match(mu.jobs[0].desc, /Inventory planning/);

// Workday
const wd = await c.workday({ name: "Acme", host: "acme.wd1.myworkdayjobs.com", tenant: "acme", site: "site", queries: [""] }, NOW, () => {});
assert.equal(wd.length, 1); assert.equal(wd[0].company, "Acme"); assert.equal(wd[0].ageH, 12); assert.match(wd[0].desc, /Qualifications/);

// the other open boards
const wk = await c.workable("wk", NOW); assert.equal(wk[0].company, "WK"); assert.match(wk[0].desc, /FMEA/);
const rc = await c.recruitee("wr", NOW); assert.equal(rc[0].type, "Internship"); assert.match(rc[0].desc, /Excel/);
const bz = await c.breezy("bz", NOW); assert.match(bz[0].desc, /Six Sigma/, "Breezy's list has no text, so the posting page is read");
const bh = await c.bamboohr("bh", NOW); assert.equal(bh[0].date, "2026-10-08"); assert.match(bh[0].desc, /Preventive/);
const pe = await c.personio("pe", NOW); assert.equal(pe[0].company, "Pe GmbH"); assert.equal(pe[0].type, "Internship"); assert.match(pe[0].desc, /Your profile\nExcel, Lean/);
const tt = await c.teamtailor("tt", NOW); assert.equal(tt[0].loc, "Montréal"); assert.equal(tt[0].date, "2026-10-09");
await assert.rejects(() => c.recruitee("nobody", NOW), (e) => e.status === 404);
const pg = await c.pages(["https://careers.example.com/jobs"], NOW, () => {});
assert.equal(pg.jobs.length, 1); assert.equal(pg.jobs[0].company, "Example Inc"); assert.equal(pg.jobs[0].loc, "Montréal, QC, CA"); assert.equal(pg.jobs[0].type, "Internship");

// search services with a free key
const jo = await c.jooble({ queries: ["q"], where: "Montréal", delayMs: 0 }, "KEY", NOW, () => {});
assert.equal(jo.jobs.length, 1); assert.equal(jo.jobs[0].partial, true);
const cj = await c.careerjet({ queries: ["q"], where: "Montreal", locale: "en_CA", delayMs: 0 }, "KEY", NOW, () => {});
assert.equal(cj.jobs.length, 1); assert.equal(cj.jobs[0].sources[0].src, "Careerjet");

// full run with the real config: unknown slugs are skipped, not fatal
const searchCfg = {
  adzuna: { queries: ["q"], pages: 1, resultsPerPage: 50, country: "ca", where: "Montreal", distanceKm: 40, maxDaysOld: 7, delayMs: 0 },
  jobbank: { queries: ["engineer"], where: "Montréal, QC", maxDaysOld: 7, maxDetails: 10, delayMs: 0 },
  muse: { location: "Montreal, Canada", levels: ["Internship"], pages: 1 },
  jooble: { queries: ["q"], where: "Montréal", delayMs: 0 },
  careerjet: { queries: ["q"], where: "Montreal", locale: "en_CA", delayMs: 0 },
};
const out = await c.main({
  nowMs: NOW, log: () => {}, write: false, env: { ADZUNA_APP_ID: "x", ADZUNA_APP_KEY: "y", JOOBLE_API_KEY: "KEY" },
  companies: {
    greenhouse: ["acme", "missing"], lever: ["globex"], ashby: ["initech"], smartrecruiters: ["umbrella"],
    workable: ["wk"], recruitee: ["wr", "nobody"], breezy: ["bz"], bamboohr: ["bh"], personio: ["pe"], teamtailor: ["tt"],
    workday: [{ name: "Acme", host: "acme.wd1.myworkdayjobs.com", tenant: "acme", site: "site", queries: [""] }, { name: "Gone", host: "gone.wd1.myworkdayjobs.com", tenant: "gone", site: "site" }],
    pages: ["https://careers.example.com/jobs"],
  },
  searches: searchCfg,
});
assert.equal(out.notFoundCount, 3, "missing, nobody and the Workday site that does not exist");
assert.equal(out.sources.Greenhouse.boards, 2); assert.equal(out.sources.Greenhouse.answered, 1);
assert.equal(out.sources.Recruitee.boards, 2); assert.equal(out.sources.Recruitee.answered, 1);
assert.equal(out.sources.Workday.answered, 1); assert.equal(out.sources["Job Bank"].jobs, 2); assert.equal(out.sources["The Muse"].jobs, 1);
assert.equal(out.sources.Jooble.jobs, 1); assert.match(out.sources.Careerjet.skipped, /CAREERJET_API_KEY is not set/);
assert.ok(out.sources.Adzuna.jobs >= 1);
assert.equal(out.jobs.length, 17, "expected postings from every fake source, got " + out.jobs.length);

// a source that breaks does not stop the others, and the page is told why
globalThis.fetch = async (url, opts) => (/themuse|jobbank/.test(String(url)) ? { ok: false, status: 503, text: async () => "", json: async () => ({}) } : fetchOk(url, opts));
const broken = await c.main({ nowMs: NOW, log: () => {}, write: false, env: {}, companies: { greenhouse: ["acme"] }, searches: searchCfg });

assert.equal(broken.sources["Job Bank"].jobs, 0); assert.equal(broken.sources["The Muse"].jobs, 0);
assert.equal(broken.sources["The Muse"].requestsFailed, 1);
assert.equal(broken.sources.Greenhouse.jobs, 1);
globalThis.fetch = fetchOk;

console.log("all tests passed:", out.jobs.length, "merged postings;", JSON.stringify(out.sources.Greenhouse));
