// Finds which hiring systems publish a company's open board.
//   npm run find -- "Lion Electric" "Vention" "Moderna"          prints what it finds
//   node scripts/find-boards.mjs --file config/candidates.json    checks a long list and writes reports/boards.json
// A company can use several systems; the slug is the company's name in the system's public address.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJson, fetchText } from "./collect.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const variants = (n) => {
  const base = n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const words = base.split(" ");
  return [...new Set([words.join(""), words.join("-"), words.length > 1 && words[0].length >= 5 ? words[0] : ""])].filter(Boolean);
};
const xml = (marker, hosts) => async (s) => {
  for (const h of hosts(s)) { try { if ((await fetchText(h, { headers: { Accept: "application/xml,text/xml,*/*" } })).includes(marker)) return true; } catch { /* next host */ } }
  return false;
};
const json = (url, ok) => async (s) => { try { return ok(await fetchJson(url(s))); } catch { return false; } };
export const probes = {
  greenhouse: json((s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`, (d) => Array.isArray(d.jobs)),
  lever: json((s) => `https://api.lever.co/v0/postings/${s}?mode=json&limit=1`, Array.isArray),
  ashby: json((s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`, (d) => Array.isArray(d.jobs)),
  smartrecruiters: json((s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=1`, (d) => Array.isArray(d.content) && d.totalFound > 0),
  workable: json((s) => `https://apply.workable.com/api/v1/widget/accounts/${s}`, (d) => Array.isArray(d.jobs)),
  recruitee: json((s) => `https://${s}.recruitee.com/api/offers/`, (d) => Array.isArray(d.offers)),
  breezy: json((s) => `https://${s}.breezy.hr/json`, Array.isArray),
  bamboohr: json((s) => `https://${s}.bamboohr.com/careers/list`, (d) => Array.isArray(d.result)),
  personio: xml("<workzag-jobs", (s) => [`https://${s}.jobs.personio.de/xml`, `https://${s}.jobs.personio.com/xml`]),
  teamtailor: xml("<rss", (s) => [`https://${s}.teamtailor.com/jobs.rss`]),
};

export async function find(names, { only, concurrency = 8, log = () => {} } = {}) {
  const kinds = Object.keys(probes).filter((k) => !only || only.includes(k));
  const work = [];
  for (const name of names) for (const v of variants(name)) for (const k of kinds) work.push({ name, v, k });
  const hits = {};
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < work.length) {
      const w = work[i++];
      if (await probes[w.k](w.v)) ((hits[w.name] ||= {})[w.k] ||= []).push(w.v);
      if (++done % 200 === 0) log(`${done}/${work.length}`);
    }
  }));
  return hits;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const fi = args.indexOf("--file");
  if (fi >= 0) {
    const names = JSON.parse(fs.readFileSync(path.resolve(ROOT, args[fi + 1]), "utf8")).names;
    const hits = await find(names, { log: console.log });
    const byKind = {};
    for (const h of Object.values(hits)) for (const [k, slugs] of Object.entries(h)) (byKind[k] ||= new Set()).add(...slugs.slice(0, 1));
    const out = { at: new Date().toISOString(), checked: names.length, found: Object.keys(hits).length, hits, slugsByKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, [...v].sort()])) };
    fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "reports", "boards.json"), JSON.stringify(out, null, 1));
    console.log(`${out.found} of ${out.checked} companies have an open board`);
  } else if (args.length) {
    const hits = await find(args);
    for (const n of args) {
      const h = hits[n];
      console.log(`${n}: ${h ? Object.entries(h).map(([k, v]) => `${k}: "${v[0]}"`).join(", ") : "no open board found (they may use Workday, Taleo or SuccessFactors; Workday sites are added by hand under \"workday\")"}`);
    }
    console.log("\nAdd working slugs to config/companies.json under the matching system.");
  } else console.log('Usage: npm run find -- "Company name" ["Another company"]');
}
