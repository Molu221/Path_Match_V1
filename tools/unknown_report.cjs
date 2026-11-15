/* unknown_report.js - I-19: what many postings ask for that our dictionary does not know.
 *
 * Every posting's keywords are read with the dictionary. A keyword that stays a loose phrase - no
 * dictionary skill behind it - is either junk or a real skill we are missing. Sorted by how many
 * postings ask for it, the top of that list is the queue: the phrases worth adding next, each with
 * the postings that asked and the occupations they came from, so a person can judge.
 *
 * On the live site this runs weekly after the collection, and a person approves what gets added.
 *
 * Run: node tools/unknown_report.cjs docs [how many to show]
 */
const fs = require("fs"), path = require("path");
const dir = process.argv[2] || "docs";
const TOP = +(process.argv[3] || 40);
const { loadMatcher, docsJson } = require("./umd.cjs");
const M = loadMatcher();
const dict = docsJson("skills.json");
const eng = M.engine(dict);
const known = new Set(dict.skills.map((s) => s.n.toLowerCase()));

const seen = {};
const note = (name, kind, where) => {
  const k = name.toLowerCase();
  if (known.has(k)) return;
  const r = (seen[k] = seen[k] || { name: name, n: 0, kind: kind, where: new Set(), fam: new Set() });
  r.n++;
  if (r.where.size < 4) r.where.add(where);
  /* which kind of job asked. A real skill is asked for by a few trades; advert language is asked
     for by all of them, so the number of different job families is the thing that separates them. */
  r.fam.add(String(where).toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 2).join(" "));
};

const J = docsJson("jobs.json");
for (const j of (J.jobs || J)) for (const c of j.kw || []) {
  if (c[1] === "s") continue;                 /* already a skill we know */
  if (!eng.usefulKw(c)) continue;             /* junk we already drop */
  note(c.slice(3), c[0], j.title || "");
}
const idx = JSON.parse(fs.readFileSync(path.join(dir, "jobs", "noc", "index.json"), "utf8"));
for (const code in idx.nocs) {
  const o = idx.nocs[code];
  for (const c of (o.kw && o.kw.en) || []) {
    if (c[1] === "s" || !eng.usefulKw(c)) continue;
    note(c.slice(3), c[0], (o.en || code) + " [occupation]");
  }
}

/* A phrase is only worth a reviewer's time if it could be a skill. Three things rule one out:
 *   - it is one ordinary word ("equipment", "quality", "people"): a single common noun names a
 *     subject, not a skill, and the dictionary's own entries are almost all phrases.
 *   - it is part of a sentence about education ("degree", "Bachelor", "baccalaureat"): the education
 *     part of the score already reads those, and adding them as skills would count them twice.
 *   - every word in it is a word that appears in thousands of postings ("track record", "hands on",
 *     "team player"): that is the language of job adverts, not a skill.
 * What is left is what a person should look at: phrases with at least one uncommon word in them. */
const EDU_WORD = /\b(degree|diploma|bachelor|master|doctorate|phd|education|studies|dipl[oô]me|bacc|baccalaur[eé]at|ma[iî]trise|universitaire|coll[eé]gial|scolarit[eé])\b/i;
const freq = {};
for (const r of Object.values(seen)) for (const w of r.name.toLowerCase().split(/[^a-z0-9+#]+/)) if (w.length > 2) freq[w] = (freq[w] || 0) + r.n;
const COMMON = 2500;                        /* a word used this often across postings carries no meaning on its own */
const rows = Object.values(seen).filter((r) => {
  if (r.n < 3) return false;
  const words = r.name.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  if (EDU_WORD.test(r.name)) return false;
  const parts = r.name.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 2);
  if (!parts.length) return false;
  return parts.some((w) => (freq[w] || 0) < COMMON);   /* at least one word that means something */
}).sort((a, b) => b.n - a.n);
/* How many different job families asked, against how many postings. A phrase asked for by 700
   postings spread over 400 trades is the language of adverts. One asked for by 60 postings over 6
   trades is a skill of those trades. */
for (const r of rows) r.spread = r.fam.size / r.n;
const tight = rows.filter((r) => r.n >= 5 && r.spread < 0.35).sort((a, b) => b.n - a.n);
console.log(rows.length + " phrases that at least three postings ask for and the dictionary does not know.");
console.log(tight.length + " of them are asked for by a few trades rather than by everybody - the queue worth reading.\n");
console.log("the " + TOP + " most asked for, of those:\n");
console.log("  postings  trades  phrase                              asked by\n");
for (const r of tight.slice(0, TOP)) {
  console.log("  " + String(r.n).padStart(8) + "  " + String(r.fam.size).padStart(6) + "  " +
    r.name.slice(0, 34).padEnd(36) + [...r.where][0].slice(0, 38));
}
const outp = path.join("tools", "unknown_skills.json");
fs.writeFileSync(outp, JSON.stringify(tight.slice(0, 300).map((r) => ({ phrase: r.name, postings: r.n, trades: r.fam.size, seen_in: [...r.where] })), null, 1));
console.log("\nthe first 300 written to " + outp + " - this is the weekly queue a person reads.");
