// Finds which hiring systems publish a company's open board.
//   npm run find -- "Lion Electric" "Vention" "Moderna"          prints what it finds
//   node scripts/find-boards.mjs --file config/candidates.json    checks a long list and writes reports/boards.json
// A company can use several systems; the slug is the company's name in the system's public address.
// Only boards that currently list at least one relevant Montreal-area posting are reported.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ATS } from "./collect.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const variants = (n) => {
  const base = n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const words = base.split(" ");
  return [...new Set([words.join(""), words.join("-"), words.length > 1 && words[0].length >= 5 ? words[0] : ""])].filter(Boolean);
};
/* A board counts as found only when it gives at least one Montreal-area posting that passes the collector's own filter right now.
   Many systems answer 200 for any name, and tiny or empty accounts share names with big companies, so "exists" is not enough. */
export const probes = Object.fromEntries(Object.entries(ATS).map(([k, fn]) => [k, async (slug) => {
  try { return await fn(slug, Date.now()); } catch { return []; }
}]));

export async function find(names, { only, concurrency = 8, log = () => {} } = {}) {
  const kinds = Object.keys(probes).filter((k) => !only || only.includes(k));
  const work = [];
  for (const name of names) for (const v of variants(name)) for (const k of kinds) work.push({ name, v, k });
  const hits = {};
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < work.length) {
      const w = work[i++];
      const jobs = await probes[w.k](w.v);
      if (jobs.length) ((hits[w.name] ||= {})[w.k] ||= []).push({ slug: w.v, montrealJobs: jobs.length, company: jobs[0].company, sample: jobs.slice(0, 3).map((j) => `${j.title} (${j.loc})`) });
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
    for (const h of Object.values(hits)) for (const [k, slugs] of Object.entries(h)) for (const x of slugs) (byKind[k] ||= new Set()).add(x.slug);
    const out = { at: new Date().toISOString(), checked: names.length, found: Object.keys(hits).length, hits, slugsByKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, [...v].sort()])) };
    fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "reports", "boards.json"), JSON.stringify(out, null, 1));
    console.log(`${out.found} of ${out.checked} companies have an open board`);
  } else if (args.length) {
    const hits = await find(args);
    for (const n of args) {
      const h = hits[n];
      console.log(`${n}: ${h ? Object.entries(h).map(([k, v]) => `${k}: "${v[0]}"`).join(", ") : "no open board with Montreal postings found (they may use Workday, Taleo or SuccessFactors; Workday sites are added by hand under \"workday\")"}`);
    }
    console.log("\nAdd working slugs to config/companies.json under the matching system.");
  } else console.log('Usage: npm run find -- "Company name" ["Another company"]');
}
