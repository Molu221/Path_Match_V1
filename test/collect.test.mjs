// Offline tests with a fake fetch. Run: npm test
import assert from "node:assert/strict";
const NOW = Date.parse("2026-10-11T12:00:00Z");
const routes = [
  [/boards-api\.greenhouse\.io\/v1\/boards\/acme\/jobs/, () => ({ jobs: [
    { title: "Industrial Engineering Intern (Winter 2027)", location: { name: "Montréal, QC" }, first_published: "2026-10-11T09:00:00Z", absolute_url: "https://gh/1", company_name: "Acme", content: "&lt;p&gt;Lean &amp;amp; Six Sigma. Python required.&lt;/p&gt;" },
    { title: "Senior Chef", location: { name: "Montréal, QC" }, first_published: "2026-10-01T09:00:00Z", absolute_url: "https://gh/2", content: "&lt;p&gt;cook&lt;/p&gt;" },
    { title: "Data Analyst Intern", location: { name: "Toronto, ON" }, first_published: "2026-10-10T09:00:00Z", absolute_url: "https://gh/3", content: "x" },
    { title: "Operations Analyst Intern", location: { name: "Remote - Canada" }, first_published: "2026-10-10T08:00:00Z", absolute_url: "https://gh/4", content: "x" },
    { title: "Industrial Engineer", location: { name: "Berlin, Germany" }, first_published: "2026-10-10T07:00:00Z", absolute_url: "https://gh/5", content: "x" },
    { title: "Process Engineer Intern", location: { name: "Vancouver, WA" }, first_published: "2026-10-10T06:00:00Z", absolute_url: "https://gh/6", content: "x" },
    { title: "Registered Nurse", location: { name: "Winnipeg, MB" }, first_published: "2026-10-09T06:00:00Z", absolute_url: "https://gh/7", content: "&lt;p&gt;Patient care on a medical unit. Requirements: RN licence.&lt;/p&gt;" },
    { title: "Internal Auditor", location: { name: "Halifax, NS" }, first_published: "2026-10-09T05:00:00Z", absolute_url: "https://gh/8", content: "Audit work." } ] })],
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
  [/jobbank\.gc\.ca\/jobsearch\/jobposting\/222$/, () => jbPage({ noc: "industrial engineer", title: "Industrial engineer", employer: "Toronto Co", city: "Toronto", description: "Plant layout. Requirements: AutoCAD." })],
  [/jobbank\.gc\.ca\/jobsearch\/jobposting\/333$/, () => jbPage({ noc: "industrial engineer", title: "Industrial engineering co-op", employer: "Direct Employer", city: "Laval", description: "Time studies and Lean projects. Requirements: Excel. Preferred: Minitab." })],
  [/themuse\.com\/api\/public\/jobs/, () => ({ page_count: 1, results: [
    { name: "Supply Chain Intern", publication_date: "2026-10-10T10:00:00Z", company: { name: "Muse Co" }, locations: [{ name: "Montreal, Canada" }], levels: [{ name: "Internship" }], refs: { landing_page: "https://muse/1" }, contents: "<p>Inventory planning with SAP. Requirements: Excel.</p>" },
    { name: "Barista", publication_date: "2026-10-10T10:00:00Z", company: { name: "Muse Co" }, locations: [{ name: "Montreal, Canada" }], levels: [], refs: { landing_page: "https://muse/2" }, contents: "<p>coffee</p>" } ] })],
  [/wday\/cxs\/acme\/site\/jobs$/, (u, o) => { const q = JSON.parse(o.body); return { total: 2, jobPostings: (q.offset === 0 ? [
    { title: "Industrial Engineering Intern", externalPath: "/job/Montreal/Intern_R1", locationsText: "Montreal", postedOn: "Posted Today" },
    { title: "Welder", externalPath: "/job/Toronto/Welder_R2", locationsText: "Toronto", postedOn: "Posted 3 Days Ago" } ] : []) }; }],
  [/wday\/cxs\/acme\/site\/job\/Montreal\/Intern_R1$/, () => ({ jobPostingInfo: { title: "Industrial Engineering Intern", jobDescription: "<p>Lean projects</p><p>Qualifications</p><ul><li>Excel</li></ul>", location: "Montreal", startDate: "2026-10-11", timeType: "Full time", externalUrl: "https://acme.wd1.myworkdayjobs.com/site/job/Montreal/Intern_R1" } })],
  [/wday\/cxs\/bigco\/site\/jobs$/, (u, o) => {
    const q = JSON.parse(o.body), ca = (q.appliedFacets.locationCountry || [])[0] === "CAID";
    const facets = [{ descriptor: "Locations", facetParameter: "locationMainGroup", values: [{ descriptor: "Country", facetParameter: "locationCountry", values: [{ descriptor: "Canada", id: "CAID", count: 45 }, { descriptor: "United States", id: "USID", count: 3000 }] }] }];
    if (!ca) return { total: 3045, facets, jobPostings: Array.from({ length: 20 }, (_, i) => ({ title: "US job " + i, externalPath: "/job/US/u" + i, locationsText: "Austin, TX", postedOn: "Posted Today" })) };
    return { total: 45, facets, jobPostings: Array.from({ length: Math.max(0, Math.min(20, 45 - q.offset)) }, (_, i) => ({ title: "Store Associate " + (q.offset + i), externalPath: "/job/CA/c" + (q.offset + i), locationsText: i % 2 ? "2 Locations" : "Toronto, Ontario", postedOn: i < 3 ? "Posted Today" : "Posted " + (i + 1) + " Days Ago", bulletFields: ["R" + i] })) };
  }],
  [/wday\/cxs\/bigco\/site\/job\/CA\/c0$/, () => ({ jobPostingInfo: { title: "Store Associate 0", jobDescription: "<p>Serve customers</p>", location: "Toronto, Ontario", startDate: "2026-10-11", timeType: "Part time", externalUrl: "https://bigco.wd1.myworkdayjobs.com/site/job/CA/c0" } })],
  [/apply\.workable\.com\/api\/v1\/widget\/accounts\/wk2/, () => ({ name: "WK2", jobs: [{ title: "Operations Analyst", telecommuting: true, country: "Canada", city: "", state: "", published_on: "2026-10-10", url: "https://workable/2", description: "<p>Reporting</p>", locations: [{ country: "Canada", region: "Ontario", city: "Ottawa" }] }, { title: "Operations Analyst", country: "United States", city: "Austin", state: "Texas", url: "https://workable/3", description: "x" }] })],
  [/apply\.workable\.com\/api\/v1\/widget\/accounts\/wk/, () => ({ name: "WK", jobs: [{ title: "Quality Intern", city: "Montreal", state: "Quebec", country: "Canada", published_on: "2026-10-10", url: "https://workable/1", description: "<p>FMEA and SPC</p>" }] })],
  [/w2\.recruitee\.com\/api\/offers/, () => ({ offers: [{ title: "Quality Analyst", company_name: "Rec2", location: "Calgary", country_code: "CA", remote: true, published_at: "2026-10-09T10:00:00Z", careers_url: "https://rec/2", description: "<p>Audits</p>" }, { title: "Quality Analyst", company_name: "Rec2", location: "Lyon", country_code: "FR", published_at: "2026-10-09T10:00:00Z", careers_url: "https://rec/3", description: "x" }] })],
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

// where in Canada: the province of a location text; "" means not in Canada
const provinceCases = [["Montréal, QC, Canada", "QC"], ["Montreal", "QC"], ["Québec (QC)", "QC"], ["Lévis, Québec", "QC"], ["Dorval, QC", "QC"], ["Toronto, Ontario", "ON"], ["London, ON", "ON"], ["Mississauga, ON, CA", "ON"],
  ["Vancouver, BC", "BC"], ["Calgary, AB / Boston, MA", "AB"], ["Halifax, Nova Scotia", "NS"], ["Fredericton, NB", "NB"], ["Charlottetown, PEI", "PE"], ["Whitehorse, YT, Canada", "YT"], ["St. John’s, NL, Canada", "NL"],
  ["Saskatoon, SK", "SK"], ["Regina, SK, Canada", "SK"], ["Winnipeg, Manitoba", "MB"],
  ["Remote - Canada", "Remote – Canada"], ["Télétravail – Canada", "Remote – Canada"], ["Telework - Canada", "Remote – Canada"], ["Canada", "Canada"], ["Remote, Ontario", "ON"],
  ["Toronto / Montreal", "ON"], ["Montreal / Toronto", "QC"], ["Paris, France / Montreal, QC, Canada", "QC"], ["Boston, MA / Vancouver, BC", "BC"],
  ["Remote", ""], ["Remote - US", ""], ["On-site", ""], ["", ""], ["New York, NY", ""], ["Paris, France", ""], ["Anjou, France", ""], ["London, UK", ""],
  ["Amsterdam, NL", ""], ["Bratislava, SK", ""], ["Vancouver, WA", ""], ["Ontario, CA", ""]];
for (const [loc, want] of provinceCases) assert.equal(c.provinceOf(loc), want, JSON.stringify(loc));
assert.ok(c.inCanada("Toronto, ON") && !c.inCanada("Berlin, Germany"));

// no field is filtered out: a cook, a nurse and an engineer in Canada are all kept
assert.equal(c.RELEVANT, undefined); assert.equal(c.wantedTitle, undefined);

// each source
const gh = await c.greenhouse("acme", NOW);
assert.equal(gh.length, 6, "every Canadian posting is kept, whatever the field; Berlin and Vancouver, WA are not");
assert.equal(gh.find((j) => j.title === "Internal Auditor").type, "", "'Internal' is not an internship");
assert.equal(gh.find((j) => j.title === "Registered Nurse").loc, "Winnipeg, MB"); assert.equal(gh[0].title.startsWith("Industrial"), true); assert.equal(gh[0].ageH, 3); assert.match(gh[0].desc, /Lean & Six Sigma/);
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
assert.equal(m.length, 7);


// helpers for the new sources
assert.equal(c.breakHeadings("Intro. Requirements: Excel. Preferred Qualifications: Lean.").split("\n").filter(Boolean).length, 5);
assert.equal(c.breakHeadings("a\nb\nc\nd\ne\nf\ng\nh\nRequirements: x"), "a\nb\nc\nd\ne\nf\ng\nh\nRequirements: x", "text that already has lines is left alone");
assert.equal(c.jsonLdJobs('<script type="application/ld+json">{ not json</script>').length, 0);
assert.equal(c.jsonLdJobs('<script type="application/ld&#x2B;json">{"@graph":[{"@type":"JobPosting","title":"T"}]}</script>').length, 1, "the plus sign may be written as an entity");

// Job Bank: the feed lists, only Montreal-area relevant rows are opened; partner posts take their text from the French page
const noPause = async () => {};
const jb = await c.jobbank({ queries: ["engineer"], where: "Montréal, QC", maxDaysOld: 7, maxDetails: 10, delayMs: 0 }, NOW, () => {}, noPause);
assert.equal(jb.listed, 4); assert.equal(jb.inArea, 4, "the cook row and the Toronto row are kept too");
assert.equal(jb.jobs.length, 4);
// several places: every place is searched; rows past the detail limit stay as title-only rows
const jb2 = await c.jobbank({ queries: ["engineer", ""], places: ["Montréal, QC", "Toronto, ON"], maxDaysOld: 7, maxDetails: 1, maxListed: 2, delayMs: 0 }, NOW, () => {}, noPause);
assert.equal(jb2.ok, 4); assert.equal(jb2.jobs.length, 3); assert.equal(jb2.jobs.filter((j) => j.partial).length >= 2, true);
assert.ok(jb2.jobs.slice(1).every((j) => j.desc === "" && j.sources[0].url.includes("/jobposting/")));
const partnerPost = jb.jobs.find((j) => /Stagiaire/.test(j.title));
assert.equal(partnerPost.company, "Usine Alpha"); assert.equal(partnerPost.loc, "Montréal, QC"); assert.equal(partnerPost.type, "Internship");
assert.equal(partnerPost.partial, undefined); assert.match(partnerPost.desc, /\nExigences\n/); assert.match(partnerPost.desc, /Job summary:/);
assert.deepEqual(partnerPost.sources.map((x) => x.src), ["Job Bank", "Partner.example"]);
assert.equal(jb.jobs.find((j) => /co-op/.test(j.title)).type, "Internship");

// The Muse
const mu = await c.muse({ location: "Montreal, Canada", levels: ["Internship"], pages: 2 }, NOW, () => {});
assert.equal(mu.jobs.length, 2, "the barista is kept too"); assert.equal(mu.jobs[0].type, "Internship"); assert.match(mu.jobs[0].desc, /Inventory planning/);
const mu2 = await c.muse({ locations: ["Montreal, Canada", "Toronto, Canada"], levels: ["Internship", "Mid Level"], pages: 1 }, NOW, () => {});
assert.equal(mu2.ok, 4, "two places x two levels");

// Workday
const wd = await c.workday({ name: "Acme", host: "acme.wd1.myworkdayjobs.com", tenant: "acme", site: "site", queries: [""] }, NOW, () => {});
assert.equal(wd.length, 1); assert.equal(wd[0].company, "Acme"); assert.equal(wd[0].ageH, 12); assert.match(wd[0].desc, /Qualifications/);

// a big Workday site: the Canada facet is found in the answer and used, every Canadian posting is listed, the newest get their full text
assert.deepEqual({ ...c.canadaFacet([{ facetParameter: "locationMainGroup", values: [{ facetParameter: "locationCountry", values: [{ descriptor: "Canada", id: "X1", count: 5 }] }] }]) }, { param: "locationCountry", id: "X1", count: 5 });
assert.equal(c.canadaFacet([{ facetParameter: "jobFamily", values: [{ descriptor: "Canada", id: "no" }] }]), null, "only a country facet counts");
const big = await c.workday({ name: "BigCo", host: "bigco.wd1.myworkdayjobs.com", tenant: "bigco", site: "site", maxDetails: 1 }, NOW, () => {});
assert.equal(big.length, 45, "all 45 Canadian postings, none of the 3000 American ones: " + big.length);
assert.ok(big.every((j) => c.inCanada(j.loc)), "a place such as '2 Locations' gets ', Canada' so the posting is not lost");
assert.equal(big.filter((j) => j.desc).length, 1); assert.ok(big.filter((j) => j.partial).length === 44, "the rest are title-only records");
assert.ok(big.filter((j) => j.partial).every((j) => /^\d{4}-\d\d-\d\d$/.test(j.date) && j.ageH != null && j.sources[0].url.startsWith("https://bigco.wd1.myworkdayjobs.com/site/job/CA/")));
assert.deepEqual(c.workdayFromUrl("https://cae.wd3.myworkdayjobs.com/en-US/career/jobs?x=1", "CAE"), { name: "CAE", host: "cae.wd3.myworkdayjobs.com", tenant: "cae", site: "career" });
assert.equal(c.workdayFromUrl("https://acme.wd1.myworkdayjobs.com/External_Site").site, "External_Site");
assert.throws(() => c.workdayFromUrl("https://example.com/careers"));

// the other open boards
const wk = await c.workable("wk", NOW); assert.equal(wk[0].company, "WK"); assert.match(wk[0].desc, /FMEA/);
const wk2 = await c.workable("wk2", NOW); assert.equal(wk2.length, 1, "the Texas posting is dropped"); assert.equal(c.provinceOf(wk2[0].loc), "ON"); assert.match(wk2[0].loc, /Remote/);
const rc2 = await c.recruitee("w2", NOW); assert.equal(rc2.length, 1, "the Lyon posting is dropped"); assert.equal(c.provinceOf(rc2[0].loc), "AB"); assert.match(rc2[0].loc, /Canada/);
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
    workday: [{ name: "Acme", host: "acme.wd1.myworkdayjobs.com", tenant: "acme", site: "site", queries: [""] }, "https://gone.wd1.myworkdayjobs.com/en-US/site"],
    pages: ["https://careers.example.com/jobs"],
  },
  searches: searchCfg,
});
assert.equal(out.notFoundCount, 3, "missing, nobody and the Workday site that does not exist");
assert.equal(out.sources.Greenhouse.boards, 2); assert.equal(out.sources.Greenhouse.answered, 1);
assert.equal(out.sources.Recruitee.boards, 2); assert.equal(out.sources.Recruitee.answered, 1);
assert.equal(out.sources.Workday.answered, 1); assert.equal(out.sources["Job Bank"].jobs, 4); assert.equal(out.sources["The Muse"].jobs, 2);
assert.equal(out.sources.Jooble.jobs, 1); assert.match(out.sources.Careerjet.skipped, /CAREERJET_API_KEY is not set/);
assert.ok(out.sources.Adzuna.jobs >= 1);
assert.equal(out.jobs.length, 25, "expected postings from every fake source, got " + out.jobs.length);
assert.equal(out.collected, 25);
assert.ok(out.jobs.every((j) => Array.isArray(j.kw) && j.kw.length && /^[TRKNPA][st]\|/.test(j.kw[0]) && j.kt >= j.kw.length), "every job carries its keyword profile");
assert.ok(out.jobs.some((j) => j.title === "Registered Nurse") && out.jobs.some((j) => j.title === "Senior Chef"));
assert.equal(Object.values(out.fields).reduce((a, b) => a + b, 0), out.jobs.length);
assert.ok(out.jobs.every((j) => j.province), "every job carries its province");
assert.equal(out.provinces.ON, 2); assert.equal(out.provinces["Remote – Canada"], 1); assert.equal(out.provinces.QC, 20); assert.equal(out.provinces.MB, 1); assert.equal(out.provinces.NS, 1);
assert.equal(Object.values(out.provinces).reduce((a, b) => a + b, 0), out.jobs.length);
assert.ok(!out.jobs.some((j) => /Berlin|Vancouver, WA/.test(j.loc)), "jobs outside Canada are dropped");

// a source can be switched off in the config
const off = await c.main({ nowMs: NOW, log: () => {}, write: false, env: {}, companies: {}, searches: { ...searchCfg, jobbank: { ...searchCfg.jobbank, enabled: false } } });
assert.match(off.sources["Job Bank"].skipped, /switched off/);

// a source that breaks does not stop the others, and the page is told why
globalThis.fetch = async (url, opts) => (/themuse|jobbank/.test(String(url)) ? { ok: false, status: 503, text: async () => "", json: async () => ({}) } : fetchOk(url, opts));
const broken = await c.main({ nowMs: NOW, log: () => {}, write: false, env: {}, companies: { greenhouse: ["acme"] }, searches: searchCfg });

assert.equal(broken.sources["Job Bank"].jobs, 0); assert.equal(broken.sources["The Muse"].jobs, 0);
assert.equal(broken.sources["The Muse"].requestsFailed, 1);
assert.equal(broken.sources.Greenhouse.jobs, 6);
globalThis.fetch = fetchOk;

// everything is kept; only above the limit are the rare kinds first, one employer cannot fill the list, and every field gets a share
const mk = (company, title, ageH, extra = {}) => ({ company, title, loc: "Toronto, ON", ageH, desc: "x".repeat(1000), type: "", sources: [{ src: "t", url: "u" }], ...extra });
const pool = [
  ...Array.from({ length: 40 }, (_, i) => mk("BigCo", "Software Engineer " + i, i)),
  ...Array.from({ length: 6 }, (_, i) => mk("Clinic" + i, "Registered Nurse " + i, 50 + i)),
  ...Array.from({ length: 6 }, (_, i) => mk("Bank" + i, "Accountant " + i, 60 + i)),
  mk("Uni", "Summer Student", 500), mk("Shop", "Cashier", 300, { type: "Part-time" }),
];
assert.equal(c.selectJobs(pool).length, pool.length, "nothing is dropped below the limit, even 40 postings of one employer");
const pick = c.selectJobs(pool, { maxJobs: 12, perCompany: 3 });
assert.ok(pick.length <= 12 && pick.some((j) => j.title === "Summer Student") && pick.some((j) => j.type === "Part-time"), "internships and part-time go in first even when old");
assert.ok(pick.filter((j) => j.company === "BigCo").length <= 3, "at most perCompany from one employer");
assert.ok(pick.some((j) => /Nurse/.test(j.title)) && pick.some((j) => /Accountant/.test(j.title)), "other fields get a share");
assert.ok(pick.every((j, i) => i === 0 || (pick[i - 1].ageH ?? 1e9) <= (j.ageH ?? 1e9)), "the result is newest first");

// the two kinds of file: a short record per posting (jobs.json) and the text in 64 files by id (docs/d)
const fsx = await import("node:fs"), osx = await import("node:os"), pathx = await import("node:path");
const dir = fsx.mkdtempSync(pathx.join(osx.tmpdir(), "pm-"));
const withText = [
  mk("Acme", "Registered Nurse", 30, { desc: "Provide patient care. Requirements: RN licence. Bilingual (French and English) required.", province: "ON" }),
  mk("Acme", "Cashier", 5000, { desc: "", partial: true, province: "ON" }),
  mk("Beta", "Software Developer", null, { desc: "Python and SQL. Security clearance required.", province: "QC" }),
];
c.addProfiles(withText, () => {});
const ids = withText.map((j) => j.id);
assert.ok(ids.every((i) => /^[0-9a-f]{10}$/.test(i)) && new Set(ids).size === 3, "every posting has its own id");
assert.equal(c.jobId({ company: "ACME ", title: "registered  nurse" }), withText[0].id, "the id follows the key that merges duplicates (case, accents, spaces)");
assert.ok(withText.every((j) => Array.isArray(j.lv) && ["en", "fr", "bi"].includes(j.lg) && Number.isInteger(j.dl)), "level, language and text length are saved with the record");
assert.ok(withText[0].df.some((f) => /French\/English/.test(f[1])) && withText[2].df.some((f) => /Security/.test(f[1])), "wording flags are saved with the record");
const written = c.writeOutput({ updatedAt: "2026-10-11T12:00:00.000Z", mock: false, sources: {}, jobs: withText }, { indexFile: pathx.join(dir, "jobs.json"), textDir: pathx.join(dir, "d") });
assert.equal(written.jobs, 3);
const idx = JSON.parse(fsx.readFileSync(pathx.join(dir, "jobs.json"), "utf8"));
assert.ok(idx.jobs.every((j) => j.desc === undefined && j.ageH === undefined), "the index has no text and no 'hours ago'");
assert.equal(idx.jobs.find((j) => j.title === "Registered Nurse").postedAt, "2026-10-10T06:00:00.000Z", "postedAt = collection time minus the age");
assert.ok(idx.jobs.every((j, i) => i === 0 || idx.jobs[i - 1].id < j.id), "the index is sorted by id, the same order every day");
assert.equal(fsx.readdirSync(pathx.join(dir, "d")).length, 64);
for (const j of withText) {
  const shard = JSON.parse(fsx.readFileSync(pathx.join(dir, "d", c.shardOf(j.id) + ".json"), "utf8"));
  assert.equal(shard[j.id], j.desc || undefined, "the text is in the file named by the id");
}
assert.equal(c.shardOf("ffffffffff"), "63"); assert.equal(c.shardOf("0000000000"), "00");
fsx.rmSync(dir, { recursive: true });

console.log("all tests passed:", out.jobs.length, "merged postings;", JSON.stringify(out.sources.Greenhouse));
