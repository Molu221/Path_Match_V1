// Finds Workday career sites. A site is addressed as https://<tenant>.wd<N>.myworkdayjobs.com/<site>, and Workday's own
// pages are not readable by scripts, so this tries the likely combinations against the JSON endpoint behind every site.
// Usage: node scripts/find-workday.mjs [--file config/candidates.json]   writes reports/workday.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postJson } from "./collect.mjs";
import { variants } from "./find-boards.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WDS = [1, 3, 5, 10, 12];
const siteGuesses = (t) => {
  const T = t.charAt(0).toUpperCase() + t.slice(1);
  return [...new Set(["External", "Careers", "careers", "External_Career_Site", "ExternalCareerSite", "External_Careers", "ExternalCareers", T, `${T}_Careers`, `${T}Careers`, `${T}_External`, `${T}External`, `${T}ExternalCareerSite`, `${T}_External_Career_Site`, `${T}_External_Careers`,
    "en-US", "Jobs", `${t}_careers`, `${t}careers`, t, "SearchJobs", "Global", "external", "Career", "career", "Careers_External", `${T}CareerSite`, `${T}Jobs`, `${T}_Jobs`, "Experienced", "careersite", "CareerSite"])];
};
const list = (host, tenant, site, searchText = "") => postJson(`https://${host}/wday/cxs/${tenant}/${site}/jobs`, { appliedFacets: {}, limit: 5, offset: 0, searchText });

export async function findWorkday(names, log = () => {}) {
  const tenants = [...new Set(names.flatMap(variants))];
  const hosts = tenants.flatMap((t) => WDS.map((n) => ({ t, host: `${t}.wd${n}.myworkdayjobs.com` })));
  const out = [], seen = { alive: 0, dead: 0 };
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < hosts.length) {
      const { t, host } = hosts[i++];
      let alive = false;
      for (const site of siteGuesses(t)) {
        try {
          const d = await list(host, t, site);
          const m = await list(host, t, site, "Montreal").catch(() => ({}));
          out.push({ host, tenant: t, site, total: d.total, montreal: m.total ?? null, sample: (d.jobPostings || []).slice(0, 2).map((p) => `${p.title} (${p.locationsText})`) });
          break;
        } catch (e) {
          if (e.status === 422) alive = true;                  // the tenant answers but this site name is not it: keep guessing
          else if (!alive) break;                               // no such host: do not try the other 30 names
        }
      }
      if (alive) seen.alive++; else seen.dead++;
      if ((i % 300) === 0) log(`${i}/${hosts.length}`);
    }
  }));
  return { out, seen };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const file = args.includes("--file") ? args[args.indexOf("--file") + 1] : "config/candidates.json";
  const names = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), "utf8")).names;
  const control = await list("zzqqxx9.wd3.myworkdayjobs.com", "zzqqxx9", "External").then(() => "200", (e) => String(e.status || e.message));
  console.log("control (a tenant that cannot exist) answers:", control);
  const { out, seen } = await findWorkday(names, console.log);
  fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "reports", "workday.json"), JSON.stringify({ at: new Date().toISOString(), control, checkedNames: names.length, hostsAnswering: seen.alive, found: out }, null, 1));
  console.log(`${out.length} Workday sites found`, out.map((x) => `${x.tenant}/${x.site}:${x.total}/${x.montreal}`).join(" "));
}
