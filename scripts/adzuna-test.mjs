/* adzuna-test.mjs - Adzuna "test mode, all of Canada" (INDU 6993, Presentation 4).
 *
 * One manual run answers four questions without touching docs/jobs.json:
 *   1. How many NEW jobs (posted in the last day) does Adzuna have in each category, all of Canada?  (the `count` Adzuna returns)
 *   2. Which provinces do they come from? (today our Adzuna jobs come only from QC, ON, BC and AB)
 *   3. How many of them do we already have from another source? (same employer + title + province as docs/jobs.json)
 *   4. What daily search plan would fit the free plan (250 a day, 1,000 a week, 2,500 a month)?
 *
 * Usage: ADZUNA_APP_ID=... ADZUNA_APP_KEY=... node scripts/adzuna-test.mjs [config/adzuna_test.json]
 * Writes reports/adzuna_test.json and reports/adzuna_test.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchJson, stripHtml, provinceOf, dedupKey } from "./collect.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function budgetPlan(rows, daily) {
  /* pages needed to read every new job of a category once a day, then shared out in proportion when the total is over budget */
  const want = rows.filter((r) => r.kind === "category" && r.count > 0).map((r) => ({ label: r.label, tag: r.tag, count: r.count, pages: Math.ceil(r.count / 50) }));
  const need = want.reduce((n, r) => n + r.pages, 0);
  const scale = need > daily ? daily / need : 1;
  for (const r of want) r.plan = Math.max(1, Math.floor(r.pages * scale));
  let used = want.reduce((n, r) => n + r.plan, 0);
  for (const r of [...want].sort((a, b) => b.count / b.plan - a.count / a.plan)) { if (used >= daily) break; if (r.plan < r.pages) { r.plan++; used++; } }
  while (used > daily) { const r = want.filter((x) => x.plan > 1).sort((a, b) => a.count / a.plan - b.count / b.plan)[0]; if (!r) break; r.plan--; used--; }
  const covered = want.reduce((n, r) => n + Math.min(r.count, r.plan * 50), 0), total = want.reduce((n, r) => n + r.count, 0);
  return { daily, pagesNeeded: need, pagesPlanned: used, newJobsPerDay: total, readPerDay: covered, share: total ? Math.round((100 * covered) / total) : 0,
    perMonth31: used * 31, perWeek: used * 7, categories: want.sort((a, b) => b.count - a.count) };
}

export async function run({ cfg, id, key, siteJobs, get = fetchJson, log = console.log, wait = sleep }) {
  const base = `https://api.adzuna.com/v1/api/jobs/${cfg.country}`;
  const auth = { app_id: id, app_key: key, "content-type": "application/json" };
  let requests = 0, stop = "";
  const call = async (url) => { if (requests >= cfg.maxRequests) throw Object.assign(new Error("request cap reached"), { cap: true }); requests++; const d = await get(url); await wait(cfg.delayMs); return d; };
  const known = new Set(siteJobs.map((j) => dedupKey(j)));

  let cats = [];
  if (cfg.categories === "all") {
    try { const d = await call(`${base}/categories?${new URLSearchParams(auth)}`); cats = (d.results || []).map((c) => ({ tag: c.tag, label: c.label })); }
    catch (e) { log(`categories: ${e.message}`); stop = e.message; }
  } else cats = cfg.categories;

  const searches = [
    ...cats.map((c) => ({ kind: "category", label: c.label, tag: c.tag, params: { category: c.tag } })),
    ...(cfg.provinces || []).map((p) => ({ kind: "province", label: p, params: { where: p } })),
    ...(cfg.keywords || []).map((k) => ({ kind: "keyword", label: k, params: { what: k } })),
  ];
  const rows = [], allProv = {};
  for (const s of searches) {
    if (stop) break;
    const qs = new URLSearchParams({ ...auth, results_per_page: String(cfg.resultsPerPage), max_days_old: String(cfg.maxDaysOld), sort_by: "date", ...s.params });
    try {
      const d = await call(`${base}/search/1?${qs}`);
      const res = d.results || [];
      const prov = {}; let dup = 0; const text = [];
      for (const x of res) {
        const j = { company: (x.company && x.company.display_name) || "Unknown", title: x.title || "", loc: (x.location && x.location.display_name) || "" };
        j.province = provinceOf(j.loc) || "?";
        prov[j.province] = (prov[j.province] || 0) + 1; allProv[j.province] = (allProv[j.province] || 0) + 1;
        if (known.has(dedupKey(j))) dup++;
        text.push(stripHtml(x.description || "").length);
      }
      rows.push({ kind: s.kind, label: s.label, tag: s.tag, count: d.count ?? null, returned: res.length, alreadyOnSite: dup, newToSite: res.length - dup, medianText: median(text), provinces: prov });
    } catch (e) {
      if (e.cap) { stop = "request cap reached"; break; }
      rows.push({ kind: s.kind, label: s.label, tag: s.tag, error: e.message });
      if (e.status === 401 || e.status === 403 || e.status === 429) stop = e.message;
    }
  }
  const ok = rows.filter((r) => !r.error);
  const returned = ok.reduce((n, r) => n + r.returned, 0), dup = ok.reduce((n, r) => n + r.alreadyOnSite, 0);
  return {
    ranAt: new Date().toISOString(), requests, stop: stop || null, maxDaysOld: cfg.maxDaysOld,
    summary: { searches: rows.length, failed: rows.length - ok.length, returned, alreadyOnSite: dup, newToSite: returned - dup, duplicateShare: returned ? Math.round((100 * dup) / returned) : 0, provinces: allProv, medianText: median(ok.map((r) => r.medianText)) },
    plan: budgetPlan(rows, cfg.dailyBudget || 75), rows,
  };
}

export function toMarkdown(r) {
  const s = r.summary, p = r.plan;
  const prov = Object.entries(s.provinces).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ");
  const L = [
    `# Adzuna test, all of Canada (${r.ranAt.slice(0, 10)})`, "",
    `Requests used: **${r.requests}**${r.stop ? ` (stopped: ${r.stop})` : ""}. Jobs posted in the last ${r.maxDaysOld} day(s).`, "",
    `- Jobs returned: **${s.returned}**, already on our site: **${s.alreadyOnSite}** (${s.duplicateShare}%), new to our site: **${s.newToSite}**`,
    `- Provinces in the results: ${prov || "none"}`,
    `- Median description length: ${s.medianText} characters (Adzuna gives a snippet, not the full posting)`, "",
    `## Daily plan that fits the free plan`, "",
    `Adzuna has about **${p.newJobsPerDay}** new jobs a day across its categories. Reading all of them needs ${p.pagesNeeded} requests a day.`,
    `With **${p.pagesPlanned} requests a day** (${p.perWeek} a week, ${p.perMonth31} in a 31-day month; limits 1,000 and 2,500) we read about **${p.readPerDay} jobs a day (${p.share}%)**.`, "",
    `| Category | New jobs / day | Requests / day |`, `|---|---:|---:|`,
    ...p.categories.map((c) => `| ${c.label} | ${c.count} | ${c.plan} |`), "",
    `## Every search`, "", `| Kind | Search | Count (Canada) | Returned | Already on site | New | Provinces |`, `|---|---|---:|---:|---:|---:|---|`,
    ...r.rows.map((x) => x.error ? `| ${x.kind} | ${x.label} | error: ${x.error} | | | | |` : `| ${x.kind} | ${x.label} | ${x.count ?? ""} | ${x.returned} | ${x.alreadyOnSite} | ${x.newToSite} | ${Object.entries(x.provinces).map(([k, v]) => k + " " + v).join(", ")} |`),
  ];
  return L.join("\n") + "\n";
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) { console.error("Set ADZUNA_APP_ID and ADZUNA_APP_KEY (repository secrets)."); process.exit(1); }
  const cfg = JSON.parse(fs.readFileSync(path.resolve(ROOT, process.argv[2] || "config/adzuna_test.json"), "utf8"));
  const siteJobs = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "jobs.json"), "utf8")).jobs || [];
  const r = await run({ cfg, id, key, siteJobs });
  fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "reports", "adzuna_test.json"), JSON.stringify(r, null, 1));
  fs.writeFileSync(path.join(ROOT, "reports", "adzuna_test.md"), toMarkdown(r));
  console.log(toMarkdown(r));
}
