// Finds the Workday career sites of employers. A site is https://{tenant}.{wdN}.myworkdayjobs.com/{site}; the tenant is nearly always the company's name,
// but the number (wd1, wd3, wd5...) and the site name vary, so each tenant is tried against the usual ones.
//   node scripts/find-workday.mjs [config/workday_candidates.json]     writes reports/workday.json (workflow: Find Workday sites)
// A site counts as found when its answer has a number of postings; the report also gives how many of them are in Canada.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJson, canadaFacet } from "./collect.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const HOSTS = ["wd3", "wd1", "wd5", "wd10", "wd12", "wd501", "wd2", "wd103"];
export const sitesFor = (t) => {
  const T = t[0].toUpperCase() + t.slice(1);
  return [...new Set(["External", "Careers", "careers", "External_Career_Site", "ExternalCareerSite", "External_Careers", "ExternalCareers", T + "Careers", t + "careers", T + "_Careers", t + "_careers",
    T + "_External", t + "_external", T + "External", t, T, "jobs", "Jobs", "search", "Search", "external", "Career", "career", T + "_Career", T + "CareerSite", T + "_Career_Site", "Professional", "Campus",
    "Students", "Experienced", "Experienced-Jobs", T + "_Jobs", "External_Site", "Careers_External", "ExternalSite", "Global", "en-US"])];
};
const ask = async (host, tenant, site) => {
  try {
    const d = await fetchJson(`https://${tenant}.${host}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Language": "en-US" },
      body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }), signal: AbortSignal.timeout(8000) });
    if (typeof d.total !== "number") return null;
    const ca = canadaFacet(d.facets);
    return { host: `${tenant}.${host}.myworkdayjobs.com`, tenant, site, total: d.total, canada: ca ? ca.count : null };
  } catch { return null; }
};
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
export async function find(tenants, log = () => {}) {
  const hits = {};
  await pool(tenants, 4, async (t) => {
    const found = [];
    for (const h of HOSTS) {
      await pool(sitesFor(t), 10, async (site) => { const r = await ask(h, t, site); if (r) found.push(r); });
      if (found.length) break;
    }
    if (found.length) { hits[t] = found; log(`${t}: ${found.map((f) => `${f.site} (${f.total}${f.canada != null ? ", Canada " + f.canada : ""})`).join(", ")}`); }
  });
  return hits;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const cfg = JSON.parse(fs.readFileSync(path.resolve(ROOT, process.argv[2] || "config/workday_candidates.json"), "utf8"));
  const known = [];
  await pool(cfg.known || [], 8, async (k) => { const r = await ask(k.host.split(".")[1], k.host.split(".")[0], k.site); known.push({ name: k.name, ...(r || { host: k.host, site: k.site, failed: true }) }); });
  const hits = await find(cfg.tenants || [], console.log);
  const out = { at: new Date().toISOString(), known: known.sort((a, b) => (b.canada ?? b.total ?? -1) - (a.canada ?? a.total ?? -1)), checked: (cfg.tenants || []).length, found: Object.keys(hits).length, hits };
  fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "reports", "workday.json"), JSON.stringify(out, null, 1));
  console.log(`${out.found} of ${out.checked} tenants have a Workday site; ${known.filter((k) => !k.failed).length} of ${known.length} known sites answered`);
}
