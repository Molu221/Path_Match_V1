/* learn_general.mjs - which skills are "general" (asked for everywhere, so they say little about one job), learned from the
 * postings instead of typed by hand.
 *
 * A skill counts a little (scoring.js: weight x 0.35) when it is in docs/skills.json "general" or "soft". Those two lists were
 * typed by hand. This tool measures, over every posting of the daily feed, how many postings ask for each dictionary skill and
 * how evenly they spread over the kinds of job (normalised entropy over the fields of jobmeta.js, 1 = the same rate in every
 * field). A skill asked for by at least 5% of postings with a spread of at least 0.95 is general, and goes in
 * skills.json "general_learned" with its numbers. The page reads general + soft + general_learned.
 *
 * Measured on Nov 17, 2026 (18,623 postings with skills, 18 fields): every one of the 38 hand-typed general skills has a
 * spread of 0.93 or more, so the hand list was right; the data adds the ones it missed.
 * Usage: node tools/learn_general.mjs [--min-share 0.05] [--min-spread 0.95] [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadJobMeta } from "../scripts/umd.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function learnGeneral(jobs, fieldOf, { minShare = 0.05, minSpread = 0.95, minField = 150, never = [] } = {}) {
  const nf = {}, df = {}, dff = {};
  const use = jobs.filter((j) => Array.isArray(j.kw) && j.kw.length && !j.op);     // op: scored from an occupation profile, not its own text
  for (const j of use) {
    const f = fieldOf(j.title);
    nf[f] = (nf[f] || 0) + 1;
    for (const s of new Set(j.kw.filter((k) => k[1] === "s").map((k) => k.slice(3)))) { df[s] = (df[s] || 0) + 1; (dff[s] = dff[s] || {})[f] = (dff[s][f] || 0) + 1; }
  }
  const F = Object.keys(nf).filter((f) => nf[f] >= minField);
  const spread = (s) => {
    const r = F.map((f) => (dff[s][f] || 0) / nf[f]), t = r.reduce((a, b) => a + b, 0);
    if (!t || F.length < 2) return 0;
    return -r.filter((x) => x > 0).map((x) => x / t).reduce((a, p) => a + p * Math.log(p), 0) / Math.log(F.length);
  };
  const skip = new Set(never);
  const rows = Object.keys(df).map((s) => ({ n: s, share: Math.round((1000 * df[s]) / use.length) / 10, spread: Math.round(100 * spread(s)) / 100 }))
    .filter((r) => !skip.has(r.n)).sort((a, b) => b.share - a.share);
  return { postings: use.length, fields: F.length, general: rows.filter((r) => r.share >= minShare * 100 && r.spread >= minSpread), rows };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k, d) => (a.includes(k) ? +a[a.indexOf(k) + 1] : d);
  const meta = loadJobMeta();
  const jobs = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "jobs.json"), "utf8")).jobs;
  const file = path.join(ROOT, "docs", "skills.json");
  const text = fs.readFileSync(file, "utf8"), dict = JSON.parse(text);
  const languages = ["English", "French", "Bilingual (EN/FR)", "Bilingual"];   // a language is a flag beside the score, never a skill weight
  const r = learnGeneral(jobs, (t) => meta.fieldOf(t).id, { minShare: opt("--min-share", 0.05), minSpread: opt("--min-spread", 0.95), never: languages });
  const hand = new Set([...(dict.general || []), ...(dict.soft || [])]);
  const added = r.general.filter((g) => !hand.has(g.n));
  console.log(`${r.postings} postings, ${r.fields} fields. General by the data: ${r.general.length}; already typed by hand: ${r.general.length - added.length}; new: ${added.map((x) => `${x.n} (${x.share}%, ${x.spread})`).join(", ") || "none"}.`);
  const notByData = [...hand].filter((h) => !r.general.some((g) => g.n === h)).map((h) => { const x = r.rows.find((y) => y.n === h); return x ? `${h} (${x.share}%, ${x.spread})` : `${h} (not seen)`; });
  console.log(`Typed by hand but under the bar (kept, since the hand lists stay): ${notByData.join(", ")}`);
  if (!a.includes("--dry")) {
    dict.general_learned = { _note: "Learned by tools/learn_general.mjs from the postings of " + new Date().toISOString().slice(0, 10) + ": asked for by 5%+ of postings, spread 0.95+ over the kinds of job (1 = the same everywhere). Counts a little in the score, like general and soft.", skills: added.map((x) => ({ n: x.n, share: x.share, spread: x.spread })) };
    const indent = /^\{\n( +)"/.exec(text);                                    // keep the file's own layout: compact, or indented
    fs.writeFileSync(file, (indent ? JSON.stringify(dict, null, indent[1].length) : JSON.stringify(dict)) + (text.endsWith("\n") ? "\n" : ""));
    console.log(`Wrote ${added.length} skills to docs/skills.json general_learned.`);
  }
}
