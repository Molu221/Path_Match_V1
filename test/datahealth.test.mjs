/* datahealth.test.mjs - the job data checks of Nov 17, 2026: repeated company text, source health and alerts,
 * one more try after a timeout, and the Adzuna "all of Canada" plan.
 * Run: node test/datahealth.test.mjs
 */
import { stripBoilerplate } from "../scripts/boilerplate.mjs";
import { health, statusOf, toMarkdown } from "../scripts/source-health.mjs";
import { retryOnce, transient, adzunaCanadaRequests } from "../scripts/collect.mjs";
import { budgetPlan } from "../scripts/adzuna-test.mjs";

let pass = 0, fail = 0;
const ok = (what, cond, got) => {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (got !== undefined ? "   got: " + JSON.stringify(got) : "")); }
};

/* ---------- repeated company and legal text ---------- */
const legal = "We are an equal opportunity employer and welcome applications from all qualified candidates regardless of background.";
const about = "Acme Robotics builds the warehouse robots that move one third of the parcels shipped in Canada every single day.";
const jobs = [];
for (let c = 0; c < 9; c++) jobs.push({ company: "Company " + c, title: "Analyst " + c, desc: `Build dashboards in Power BI\n${legal}` });
["Mechanical engineer", "Electrician", "Buyer", "Planner"].forEach((t, i) => jobs.push({ company: "Acme Robotics", title: t, desc: `${about}\nDuty number ${i} for the ${t} role, with tasks that are only about this job and nothing else at all.` }));
for (let i = 0; i < 5; i++) jobs.push({ company: "Store Co", title: "Cashier", desc: "Serve customers at the till, count the cash drawer and keep the front of the store clean and tidy every shift." });
jobs.push({ company: "Company 0", title: "Guard", desc: "Be able to provide fingerprints and complete a criminal record check before your first shift begins with us." });
for (let c = 1; c < 9; c++) jobs.push({ company: "Company " + c, title: "Guard " + c, desc: "Be able to provide fingerprints and complete a criminal record check before your first shift begins with us." });
const r = stripBoilerplate(jobs, { keep: (l) => /criminal record/i.test(l) });
ok("a legal notice found in the postings of 9 companies is removed", !jobs[0].desc.includes("equal opportunity"), jobs[0].desc);
ok("...and the skill line next to it stays", jobs[0].desc.includes("Power BI"));
ok("a company's own paragraph repeated across 4 different titles is removed", !jobs[9].desc.includes("Acme Robotics builds"), jobs[9].desc);
ok("...and each posting keeps its own duties", jobs[9].desc.includes("Duty number 0"));
ok("the same job posted 5 times under one title keeps its text", jobs.filter((j) => j.company === "Store Co").every((j) => j.desc.includes("count the cash drawer")));
ok("a line the page reads for a flag is never removed, however often it repeats", jobs.filter((j) => /^Guard/.test(j.title)).every((j) => /criminal record/.test(j.desc)));
ok("each posting that lost lines says how many", jobs[0].bp === 1 && jobs[9].bp === 1 && !jobs[13].bp, [jobs[0].bp, jobs[9].bp, jobs[13].bp]);
ok("the summary counts postings, lines and the share of words", r.postings === 13 && r.lines === 13 && r.wordsShare > 0, r);
const pay = [];
for (let c = 0; c < 9; c++) pay.push({ company: "Firm " + c, title: "Clerk", desc: "The salary for this position is between $20 and $25 per hour depending on the experience you bring." });
stripBoilerplate(pay);
ok("a pay line is kept even when nine companies use the same sentence", pay.every((j) => j.desc.includes("$20")));

/* ---------- source health and alerts ---------- */
ok("a source with a key missing is off", statusOf({ skipped: "KEY is not set" }) === "off");
ok("a source whose every request failed is broken", statusOf({ requestsOk: 0, requestsFailed: 24, jobs: 0 }) === "broken");
ok("a source with some failed boards is partly working", statusOf({ boards: 109, answered: 107, jobs: 7500, failed: 2, error: "HTTP 403" }) === "partly");
ok("a source that answered is working", statusOf({ boards: 95, answered: 43, jobs: 841 }) === "working");
const prev = { sources: { "The Muse": { requestsOk: 24, requestsFailed: 0, jobs: 115 }, Lever: { jobs: 860 }, Jooble: { jobs: 900 } }, jobs: Array(1000).fill({}) };
const cur = { updatedAt: "2026-11-17T19:47:04Z", sources: { "The Muse": { requestsOk: 0, requestsFailed: 24, jobs: 0 }, Lever: { jobs: 841 }, Jooble: { jobs: 300 } },
  jobs: [{ sources: [{ src: "Lever" }], date: "2026-11-10", dl: 3000 }, { sources: [{ src: "Lever" }], date: "2026-01-01", dl: 1000 }] };
const h = health(prev, cur, Date.parse("2026-11-17T20:00:00Z"));
ok("a source that brought 115 postings and now brings none raises an alert", h.alerts.some((a) => /The Muse brought nothing/.test(a)), h.alerts);
ok("a source that fell by more than half raises an alert", h.alerts.some((a) => /Jooble fell from 900 to 300/.test(a)), h.alerts);
ok("a small change does not", !h.alerts.some((a) => /Lever/.test(a)));
ok("a feed that shrank by more than 30% raises an alert", h.alerts.some((a) => /daily feed fell/.test(a)));
ok("the share of postings older than 90 days is counted per source", h.rows.find((x) => x.source === "Lever").old90 === 50);
ok("broken sources come first in the table", h.rows[0].status === "broken");
const quiet = health({ sources: { "The Muse": { requestsOk: 0, requestsFailed: 24, jobs: 0 } } }, { sources: { "The Muse": { requestsOk: 0, requestsFailed: 24, jobs: 0 } }, jobs: [] });
ok("a source already broken the day before does not raise a new alert every day", quiet.alerts.length === 0, quiet.alerts);
ok("the report is a table a person can read", /\| The Muse \| \*\*BROKEN\*\*/.test(toMarkdown(h)));

/* ---------- one more try ---------- */
ok("a timeout is worth one more try", transient(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" })));
ok("an HTTP 500 is worth one more try", transient(Object.assign(new Error("HTTP 500"), { status: 500 })));
ok("an HTTP 404 is not: the board does not exist", !transient(Object.assign(new Error("HTTP 404"), { status: 404 })));
ok("an HTTP 403 is not: the site refuses us", !transient(Object.assign(new Error("HTTP 403"), { status: 403 })));
let calls = 0;
const got = await retryOnce(async () => { calls++; if (calls === 1) throw Object.assign(new Error("HTTP 503"), { status: 503 }); return "jobs"; }, 1);
ok("a board that timed out once is read on the second try", got === "jobs" && calls === 2, calls);
calls = 0;
try { await retryOnce(async () => { calls++; throw Object.assign(new Error("HTTP 404"), { status: 404 }); }, 1); } catch { /* expected */ }
ok("a missing board is asked only once", calls === 1, calls);

/* ---------- Adzuna, all of Canada ---------- */
ok("all of Canada asks nothing while it is switched off", adzunaCanadaRequests({ canada: { enabled: false, searches: [{ category: "it-jobs" }] } }).length === 0);
const reqs = adzunaCanadaRequests({ canada: { enabled: true, searches: [{ category: "it-jobs", pages: 2 }, { what: "stagiaire" }] } });
ok("each category is asked page by page, with no city", reqs.length === 3 && reqs[0].params.category === "it-jobs" && !reqs[0].params.where && reqs[1].page === 2, reqs);
const plan = budgetPlan([{ kind: "category", label: "IT", tag: "it-jobs", count: 900 }, { kind: "category", label: "Sales", tag: "sales-jobs", count: 300 }, { kind: "province", label: "Manitoba", count: 50 }], 10);
ok("the daily plan never goes over the budget", plan.pagesPlanned <= 10, plan.pagesPlanned);
ok("...and gives the busiest category the most requests", plan.categories[0].tag === "it-jobs" && plan.categories[0].plan > plan.categories[1].plan, plan.categories);
ok("...and a 31-day month of it stays under the free 2,500", budgetPlan([{ kind: "category", label: "A", count: 99999 }], 75).perMonth31 <= 2500);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
