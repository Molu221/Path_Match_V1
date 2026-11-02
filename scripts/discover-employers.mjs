// Employer discovery: finds employers that show up in the search services (Adzuna, Jooble, The Muse, Job Bank) but whose own job board
// we do not read yet. Their names go to the board finder (scripts/find-boards.mjs), which looks for their own board; a direct board gives
// the full posting text and every open posting, where a search service gives a short snippet and a sample.
//   node scripts/discover-employers.mjs [--limit 300] [--workday 40] [--jobs docs/jobs.json]
//   writes config/candidates_discovered.json (for the board finder) and config/workday_discovered.json (for the Workday finder, the busiest --workday employers only,
//   because a Workday guess costs hundreds of requests) and updates config/discovered.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEARCH_SERVICES = new Set(["Adzuna", "Jooble", "Careerjet", "The Muse", "Job Bank"]);
const SUFFIX = /\b(inc|incorporated|ltd|ltee|limited|corp|corporation|co|company|llc|lp|llp|plc|gmbh|sa|sas|srl|s e n c|senc|canada|canadian|group|groupe|holdings?|international|the|de|du|des|la|le|les|et|and)\b/g;
/* "Bombardier Inc." and "BOMBARDIER" are the same employer */
export const norm = (n) => String(n || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(SUFFIX, " ").replace(/\s+/g, " ").trim();
/* a Workday tenant is nearly always the company name written as one word ("bmofinancial", or just "bmo"); a first word shared by many employers is not a guess */
const GENERIC = new Set("university universite college city ville royal national north south east west new first global general american united pacific atlantic health sante community capital family central western eastern northern southern trust interior vancouver toronto montreal ottawa calgary edmonton ontario quebec alberta british columbia canada service services solutions systems technologies technology industries energy financial".split(" "));
export const tenantGuesses = (name) => {
  const w = norm(name).split(" ").filter(Boolean);
  if (!w.length) return [];
  return [...new Set([w.join(""), w[0].length >= 3 && !GENERIC.has(w[0]) ? w[0] : ""])].filter((t) => t.length >= 3);
};
const SKIP = /^(unknown|confidential|private|anonymous|employer|company|n a|na|undisclosed|not specified)\b|\b(recruit|staffing|placement|agency|agence|temp|talent|headhunt|consulting group)\b/;

/* jobs: the posting list of docs/jobs.json. state: { checked: { normalizedName: "YYYY-MM-DD" } }. Returns the display names to check, busiest first. */
export function pick(jobs, state, { limit = 300, nowMs = Date.now(), recheckDays = 90 } = {}) {
  const direct = new Set(), seen = new Map();
  for (const j of jobs) {
    const key = norm(j.company);
    if (!key) continue;
    const viaSearchOnly = (j.sources || []).length > 0 && (j.sources || []).every((s) => SEARCH_SERVICES.has(s.src));
    if (!viaSearchOnly) { direct.add(key); continue; }          // a direct board already gives this employer's postings
    const e = seen.get(key) || { name: j.company, n: 0 };
    e.n++; seen.set(key, e);
  }
  const fresh = (key) => { const t = state.checked && state.checked[key]; return !(t && (nowMs - Date.parse(t)) / 864e5 < recheckDays); };
  return [...seen.entries()]
    .filter(([key, e]) => !direct.has(key) && key.length >= 3 && !SKIP.test(key) && !SKIP.test(e.name.toLowerCase()) && fresh(key))
    .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
    .slice(0, limit).map(([key, e]) => ({ key, name: e.name, postings: e.n }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const jobs = JSON.parse(fs.readFileSync(path.resolve(ROOT, opt("--jobs", "docs/jobs.json")), "utf8")).jobs || [];
  const statePath = path.join(ROOT, "config", "discovered.json");
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { checked: {} };
  state.checked ||= {};
  const picked = pick(jobs, state, { limit: +opt("--limit", 300) });
  const today = new Date().toISOString().slice(0, 10);
  for (const p of picked) state.checked[p.key] = today;
  state._note = "Employers already looked up by the board finder (name without legal words: date). They are looked up again after 90 days. Written by scripts/discover-employers.mjs.";
  fs.writeFileSync(statePath, JSON.stringify(state, null, 1) + "\n");
  fs.writeFileSync(path.join(ROOT, "config", "candidates_discovered.json"), JSON.stringify({ _note: "Employers from the search services without a direct board yet (scripts/discover-employers.mjs).", names: picked.map((p) => p.name) }, null, 1) + "\n");
  const known = new Set([...(JSON.parse(fs.readFileSync(path.join(ROOT, "config", "workday_candidates.json"), "utf8")).tenants || []),
    ...(JSON.parse(fs.readFileSync(path.join(ROOT, "config", "companies.json"), "utf8")).workday || []).map((w) => w.tenant)]);
  const tenants = [...new Set(picked.slice(0, +opt("--workday", 40)).flatMap((p) => tenantGuesses(p.name)))].filter((t) => !known.has(t));
  fs.writeFileSync(path.join(ROOT, "config", "workday_discovered.json"), JSON.stringify({ _note: "Workday tenant guesses for the busiest employers of the search services (scripts/discover-employers.mjs).", known: [], tenants }, null, 1) + "\n");
  console.log(`${picked.length} employers to look up; busiest: ${picked.slice(0, 8).map((p) => `${p.name} (${p.postings})`).join(", ")}`);
}
