// Finds which hiring systems publish a company's open board.
// Usage: npm run find -- "Lion Electric" "Vention" "Moderna"
import { fetchJson } from "./collect.mjs";
const names = process.argv.slice(2);
if (!names.length) { console.log('Usage: npm run find -- "Company name" ["Another company"]'); process.exit(0); }
const variants = (n) => {
  const base = n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "");
  return [...new Set([base.replace(/ /g, ""), base.replace(/ /g, "-"), base.split(" ")[0]])].filter(Boolean);
};
const probes = {
  greenhouse: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
  lever: (s) => `https://api.lever.co/v0/postings/${s}?mode=json&limit=1`,
  ashby: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
  smartrecruiters: (s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=1`,
};
for (const n of names) {
  const hits = [];
  for (const v of variants(n)) for (const [k, u] of Object.entries(probes)) {
    try { await fetchJson(u(v)); hits.push(`${k}: "${v}"`); } catch {}
  }
  console.log(`${n}: ${hits.length ? hits.join(", ") : "no open board found (they may use Workday, Taleo or SuccessFactors, which have no open feed)"}`);
}
console.log('\nAdd working slugs to config/companies.json under the matching system.');
