// Adds what the finders found to config/companies.json, so the next collection reads those boards without anyone editing the file.
//   node scripts/apply-finds.mjs [--boards reports/boards.json] [--workday reports/workday.json] [--workday more.json] [--names config/workday_names.json]
// A board is added only when the company name on the board looks like the employer that was searched for (a slug can belong to someone else).
// Matches that do not look alike are listed in the report as "review" and are not added. A Workday site is added when it has Canadian postings
// (or, without that facet, a size the collector can read); the busiest site name of each tenant wins.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { norm } from "./discover-employers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const squash = (s) => norm(s).replace(/ /g, "");

/* does the name on a board look like the employer that was searched for? */
export function similar(searched, boardName) {
  const a = squash(searched), b = squash(boardName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.includes(a)) return true;
  if (b.length >= 4 && a.includes(b)) return true;
  const fa = norm(searched).split(" ")[0], fb = norm(boardName).split(" ")[0];
  return fa.length >= 4 && fa === fb;
}
const pretty = (t) => t.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

export function mergeBoards(companies, boards) {
  const added = {}, review = [];
  for (const [name, kinds] of Object.entries(boards.hits || {})) {
    for (const [kind, hits] of Object.entries(kinds)) {
      if (!Array.isArray(companies[kind])) continue;
      for (const h of hits) {
        if (companies[kind].includes(h.slug)) continue;
        if (!similar(name, h.company) && squash(h.slug) !== squash(name)) { review.push({ searched: name, kind, slug: h.slug, boardName: h.company, jobs: h.montrealJobs }); continue; }
        companies[kind].push(h.slug); (added[kind] ||= []).push(h.slug);
      }
    }
  }
  return { added, review };
}

export function mergeWorkday(companies, report, names = {}) {
  const added = [], skipped = [];
  const have = new Set((companies.workday || []).map((w) => w.tenant));
  for (const [tenant, sites] of Object.entries(report.hits || {})) {
    if (have.has(tenant)) continue;
    const ok = sites.filter((s) => (s.canada != null ? s.canada > 0 : s.total > 0 && s.total <= 3000));
    if (!ok.length) { skipped.push({ tenant, why: "no Canadian postings" }); continue; }
    const best = ok.slice().sort((x, y) => (y.canada ?? y.total) - (x.canada ?? x.total) || y.total - x.total)[0];
    companies.workday.push({ name: names[tenant] || pretty(tenant), host: best.host, tenant, site: best.site });
    have.add(tenant); added.push({ tenant, site: best.site, canada: best.canada, total: best.total });
  }
  return { added, skipped };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const read = (f) => (fs.existsSync(path.resolve(ROOT, f)) ? JSON.parse(fs.readFileSync(path.resolve(ROOT, f), "utf8")) : null);
  const cpath = path.join(ROOT, "config", "companies.json");
  const companies = JSON.parse(fs.readFileSync(cpath, "utf8"));
  const boards = read(opt("--boards", "reports/boards.json")), names = read(opt("--names", "config/workday_names.json")) || {};
  const wdFiles = args.flatMap((a, i) => (a === "--workday" ? [args[i + 1]] : []));
  const wds = (wdFiles.length ? wdFiles : ["reports/workday.json"]).map(read).filter(Boolean);
  const b = boards ? mergeBoards(companies, boards) : { added: {}, review: [] };
  const w = { added: [], skipped: [] };
  for (const wd of wds) { const x = mergeWorkday(companies, wd, names); w.added.push(...x.added); w.skipped.push(...x.skipped); }
  fs.writeFileSync(cpath, JSON.stringify(companies, null, 1) + "\n");
  const nb = Object.values(b.added).reduce((n, x) => n + x.length, 0);
  console.log(`added ${nb} boards (${Object.entries(b.added).map(([k, v]) => `${k} ${v.length}`).join(", ") || "none"}) and ${w.added.length} Workday sites; ${b.review.length} board matches to review, ${w.skipped.length} Workday sites without Canadian postings`);
  for (const r of b.review.slice(0, 20)) console.log(`  review: searched "${r.searched}" but ${r.kind} "${r.slug}" is "${r.boardName}" (${r.jobs} postings)`);
  const rp = path.join(ROOT, "reports", "applied.json");
  fs.writeFileSync(rp, JSON.stringify({ at: new Date().toISOString(), boards: b.added, workday: w.added, review: b.review, workdaySkipped: w.skipped }, null, 1) + "\n");
}
