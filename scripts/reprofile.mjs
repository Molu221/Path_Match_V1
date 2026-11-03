// reprofile.mjs - work out again the keywords stored with every posting, from the texts already saved.
//
// Each posting in docs/jobs.json carries its keywords (kw, kt), its level and its language, read with the skill
// dictionary (docs/skills.json) and docs/matcher.js. When either changes (for example after editing
// python/skills_library.py and running scripts/build_site_dictionary.py), the stored keywords are out of date until
// the next daily collection. This script redoes them now, without downloading anything:
//   docs/jobs.json        every posting's record, from its text in docs/d (or its occupation, for Job Bank titles)
//   docs/jobs/noc         the occupation keywords of the Job Bank open data
//
// Run:  npm run reprofile        (or: node scripts/reprofile.mjs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addProfiles, loadNocLibrary, occupationText, profileVersion, writeOutput, SHARDS, shardOf } from "./collect.mjs";
import * as openData from "./jobbank_open.mjs";
import { loadMatcher, loadSkills } from "./umd.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");

const t0 = Date.now();
const index = JSON.parse(fs.readFileSync(path.join(DOCS, "jobs.json"), "utf8"));
const texts = Array.from({ length: SHARDS }, (_, i) => {
  try { return JSON.parse(fs.readFileSync(path.join(DOCS, "d", String(i).padStart(2, "0") + ".json"), "utf8")); } catch { return {}; }
});
const jobs = index.jobs.map((j) => {
  const desc = texts[+shardOf(j.id)][j.id];
  return desc ? { ...j, desc } : { ...j };
});

let lib = null;
try { lib = loadNocLibrary(); } catch (e) { console.log("NOC library not used: " + e.message); }
addProfiles(jobs, console.log, new Map(), lib);
const version = profileVersion();
const w = writeOutput({ ...index, profileV: version, jobs });
console.log(`docs/jobs.json: ${w.jobs} postings re-read in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

// the Job Bank open data: the keywords of each occupation, and of each posting title (as in collect.mjs)
if (lib) {
  const E = loadMatcher().engine(loadSkills());
  const memo = new Map();
  const occupation = (noc) => {
    if (memo.has(noc)) return memo.get(noc);
    const n = lib.nocs[noc];
    const o = n ? { code: n.profiles[0], en: n.name.en, fr: n.name.fr,
      kw: { en: E.profile("", occupationText(lib, n.profiles[0], "en")).kw, fr: E.profile("", occupationText(lib, n.profiles[0], "fr")).kw } } : null;
    memo.set(noc, o);
    return o;
  };
  const tk = new Map();
  const titleKw = (t) => { if (!tk.has(t)) tk.set(t, E.profile(t, "", 10).kw); return tk.get(t); };
  if (openData.refreshKeywords(ROOT, occupation, version, titleKw)) console.log("docs/jobs/noc: occupation keywords refreshed");
}
