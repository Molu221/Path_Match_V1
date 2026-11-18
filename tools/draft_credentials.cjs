/* draft_credentials.js - fill the "covers" list of each credential from its official syllabus.
 *
 * For every entry in credentials.json it runs the site's own dictionary over the official text held
 * in "topics" and keeps the skills the dictionary recognises. Nothing is invented: a skill only
 * reaches the list if the official body of knowledge names it in words our dictionary knows, and the
 * line it came from is written beside it so a person can check the draft.
 *
 * Core and side:
 *   - a certificate's skill is core when the syllabus names it in its own right, side when the
 *     dictionary only matched a single ordinary word. The split is a draft: the reviewer decides.
 *   - a degree's skills are all side, because sitting a course is not being examined on a skill.
 *
 * Run:  node tools/draft_credentials.cjs docs           (writes the draft)
 *       node tools/draft_credentials.cjs docs --check   (prints it, writes nothing)
 */
const fs = require("fs"), path = require("path");
const dir = process.argv[2] || "docs";
const checkOnly = process.argv.includes("--check");
const { loadMatcher, docsJson } = require("./umd.cjs");
const M = loadMatcher();
const dict = docsJson("skills.json");
const eng = M.engine(dict);
const cp = path.join(dir, "credentials.json");
const C = JSON.parse(fs.readFileSync(cp, "utf8"));
const GENERAL = new Set((dict.general || []).concat(dict.soft || [], ((dict.general_learned || {}).skills || []).map((x) => x.n)));
const STOPW = new Set(["and", "the", "for", "with", "des", "les", "and/or"]);

let total = 0;
for (const e of C.entries) {
  /* a credential that builds on another one carries its skills too */
  let topics = String(e.topics || "");
  for (const id of e.includes || []) {
    const base = C.entries.find((x) => x.id === id);
    if (base) topics += "\n" + String(base.topics || "");
    else console.error("  ! includes: no credential called " + id);
  }
  const found = eng.findCv(topics);
  /* what a person reading the draft took out, and why. These stay in the file so the next run
     cannot quietly put them back. */
  const dropped = new Set(Object.keys(e.drop || {}));
  for (const n of dropped) if (!found[n]) console.error("  ! drop: \"" + n + "\" is no longer found anyway, the line can go");
  const names = Object.keys(found).sort();
  const covers = [];
  for (const n of names) {
    if (dropped.has(n)) continue;
    const hit = found[n];
    const words = [...new Set((hit.spans || []).map(([a, b]) => topics.slice(a, b).replace(/\s+/g, " ").trim()))];
    /* Core only when the official syllabus names the skill itself. When we only reached the skill
       through a related technique - "Maintenance and reliability" from "total productive
       maintenance", "Market research" from "voice of the customer" - it is side, worth half. The
       test: do most of the words of the skill's own name appear in what the syllabus said? */
    const norm = (x) => M.engine ? String(x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : String(x).toLowerCase();
    const nameWords = norm(n).split(/[^a-z0-9+#]+/).filter((x) => x.length > 2 && !STOPW.has(x));
    const said = norm(words.join(" "));
    const named = nameWords.length ? nameWords.filter((x) => said.indexOf(x) >= 0).length / nameWords.length : 0;
    const weak = GENERAL.has(n) || words.every((w) => !/\s/.test(w)) || named < 0.6;
    covers.push({
      skill: n,
      level: (e.kind === "degree" || e.all_side) ? "side" : (weak ? "side" : "core"),
      from: words.slice(0, 3).join(", ")
    });
  }
  e.covers = covers;
  total += covers.length;
  console.log("\n" + e.name + "  (" + e.kind + ", " + covers.length + " skills" +
    (dropped.size ? ", " + dropped.size + " taken out by a reviewer" : "") + ", source: " + e.source.name + ")");
  for (const c of covers) console.log("   " + (c.level === "core" ? "core " : "side ") + c.skill.padEnd(34) + "  from “" + c.from + "”");
}
if (!checkOnly) {
  fs.writeFileSync(cp, JSON.stringify(C, null, 1));
  console.log("\n" + C.entries.length + " credentials, " + total + " skills drafted. Every entry still has checked = false: nothing is used on the site until a person signs it.");
} else {
  console.log("\n" + C.entries.length + " credentials, " + total + " skills. Nothing written.");
}
