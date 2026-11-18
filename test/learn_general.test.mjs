/* learn_general.test.mjs - "general" skills (asked for everywhere, so they count little) learned from the postings.
 * Run: node test/learn_general.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { learnGeneral } from "../tools/learn_general.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (what, cond, got) => {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (got !== undefined ? "   got: " + JSON.stringify(got) : "")); }
};
/* 4 fields x 200 postings. "Teamwork" is in a third of every field; "Welding" only in trades; "Python" in a third of tech only. */
const jobs = [];
for (const f of ["tech", "trades", "health", "retail"]) for (let i = 0; i < 200; i++) {
  const kw = [];
  if (i % 3 === 0) kw.push("Ks|Teamwork");
  if (f === "trades" && i % 2 === 0) kw.push("Ks|Welding");
  if (f === "tech" && i % 3 === 0) kw.push("Ks|Python");
  if (i === 0) kw.push("Ks|Rare skill");
  jobs.push({ title: f + " job " + i, kw: kw.length ? kw : ["Kp|something"] });
}
jobs.push({ title: "tech job x", kw: ["Ks|Teamwork"], op: 1 });   // scored from an occupation profile: not counted
const r = learnGeneral(jobs, (t) => t.split(" ")[0], { minField: 100 });
const names = r.general.map((g) => g.n);
ok("a skill asked for evenly in every field is general", names.includes("Teamwork"), r.general);
ok("a skill of one field is not, however often it is asked for there", !names.includes("Welding") && !names.includes("Python"));
ok("a rare skill is not", !names.includes("Rare skill"));
ok("the spread is 1 for the same rate in every field", r.rows.find((x) => x.n === "Teamwork").spread === 1);
ok("the spread is 0 for one field only", r.rows.find((x) => x.n === "Welding").spread === 0);
ok("postings scored from an occupation profile are left out", r.postings === 800);
ok("a skill can be kept out on purpose (the languages)", !learnGeneral(jobs, (t) => t.split(" ")[0], { minField: 100, never: ["Teamwork"] }).general.length);

const dict = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "skills.json"), "utf8"));
const learned = (dict.general_learned && dict.general_learned.skills) || [];
const known = new Set(dict.skills.map((s) => s.n));
ok("every learned general skill is a skill of the dictionary", learned.every((x) => known.has(x.n)), learned.filter((x) => !known.has(x.n)));
ok("none of them is already typed by hand", learned.every((x) => !(dict.general || []).includes(x.n) && !(dict.soft || []).includes(x.n)));
ok("each says how many postings ask for it and how evenly", learned.every((x) => x.share >= 5 && x.spread >= 0.95));
ok("the page reads the learned list with the hand lists", /general_learned/.test(fs.readFileSync(path.join(ROOT, "docs", "index.html"), "utf8")));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
