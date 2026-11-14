// Writes docs/stats.json: the four numbers on the start page (postings collected, fields, provinces and territories, postings for students
// and new graduates), counted here once a day instead of in every visitor's browser. The page reads this small file first, so the cover
// shows its numbers before the 25 MB of postings have arrived, and the browser no longer reads every title to count them.
//
// It counts what the page counts: the postings of docs/jobs.json (one per employer, title and province) plus the Job Bank open data in
// docs/jobs/noc, with the same rules (the field of a title and the level of a posting come from docs/jobmeta.js). A posting a visitor adds
// by hand is not collected, so it is not in these numbers.
//
// Run: node scripts/cover-stats.mjs   (the daily workflow runs it after the collector)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadJobMeta } from "./umd.mjs";
import { AREA } from "./collect.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
/* the same text folding as the page (docs/index.html, norm) */
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");

export function coverStats({ jobsFile = path.join(DOCS, "jobs.json"), openDir = path.join(DOCS, "jobs", "noc"), meta = loadJobMeta() } = {}) {
  const data = JSON.parse(fs.readFileSync(jobsFile, "utf8"));
  const fields = new Set(), provs = new Set();
  let total = 0, students = 0;
  const count = (title, province, lvl) => {
    total++;
    fields.add(meta.fieldOf(title).id);
    if (/^[A-Z]{2}$/.test(province || "")) provs.add(province);
    if (lvl === 0) students++;
  };
  /* the postings of the collector: a record keeps its level (lv), and one with none gets it from its title */
  const seen = new Set();
  for (const x of data.jobs || []) {
    const k = norm(x.company) + "|" + norm(x.title) + (x.province ? "|" + x.province : "");
    if (seen.has(k)) continue;
    seen.add(k);
    const province = x.province || (AREA.test(x.loc || "") ? "QC" : "");
    const lvl = x.lv ? x.lv[0] : meta.jobLevel(x.title, x.desc || "", x.type || "").lvl;
    count(x.title, province, lvl);
  }
  const collected = total;
  /* Job Bank open data: a posting counts when its occupation is known, and its level comes from what the posting asks for */
  let openLabel = "";
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(openDir, "index.json"), "utf8")), all = JSON.parse(fs.readFileSync(path.join(openDir, "postings.json"), "utf8"));
    openLabel = idx.label || "";
    for (const noc in all) {
      const o = idx.nocs[noc]; if (!o || !o.code) continue;
      for (const r of all[noc]) count(r.t, r.p || "Canada", meta.factsLevel(r.t, r.x, r.e, r.ty === "Part-time" ? "Part-time" : "").lvl);
    }
  } catch { /* no open data yet: the numbers are those of jobs.json alone */ }
  return { updatedAt: data.updatedAt, total, collected, open: total - collected, openLabel, fields: fields.size, provinces: provs.size, students };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const s = coverStats();
  fs.writeFileSync(path.join(DOCS, "stats.json"), JSON.stringify(s) + "\n");
  console.log("docs/stats.json", JSON.stringify(s));
}
