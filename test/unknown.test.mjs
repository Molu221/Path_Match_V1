/* unknown.test.js - after 6: the weekly report of skills the dictionary does not know (I-19).
 * Run: node tests/unknown.test.js            (checks after-6 by default)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkills } from "../scripts/umd.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dict = loadSkills();
const queue = JSON.parse(fs.readFileSync(path.join(HERE, "..", "tools", "unknown_skills.json"), "utf8"));

let pass = 0, fail = 0;
const ok = (what, cond, got) => {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (got !== undefined ? "   got: " + got : "")); }
};
const known = new Set(dict.skills.map((s) => s.n.toLowerCase()));

console.log("the queue a person reads each week");
ok("it holds something", queue.length > 20, String(queue.length));
ok("nothing in it is already in the dictionary",
   queue.every((r) => !known.has(r.phrase.toLowerCase())),
   queue.filter((r) => known.has(r.phrase.toLowerCase())).map((r) => r.phrase).join(", "));
/* A skill is known by every word it answers to, not just its name. Without this
   the queue held "Software Engineer" and "Line Cook", which the dictionary
   already answers to, and the agent spent its budget judging them. */
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();
const answered = new Map();
for (const s of dict.skills) {
  answered.set(fold(s.n), s.n);
  for (const a of s.a || []) answered.set(fold(a), s.n);
}
ok("nor is anything the dictionary already answers to under another name",
   queue.every((r) => !answered.has(fold(r.phrase))),
   queue.filter((r) => answered.has(fold(r.phrase)))
        .map((r) => `${r.phrase} -> ${answered.get(fold(r.phrase))}`).slice(0, 6).join(", "));
ok("every phrase says how many postings asked for it", queue.every((r) => r.postings >= 5));
ok("...and how many kinds of job asked", queue.every((r) => r.trades >= 1));
ok("...and shows one of the postings, so a person can judge",
   queue.every((r) => Array.isArray(r.seen_in) && r.seen_in.length > 0));
ok("the most asked for comes first", queue.every((r, i) => i === 0 || queue[i - 1].postings >= r.postings));

console.log("\nwhat the report leaves out");
const txt = fs.readFileSync(path.join(HERE, "..", "tools", "unknown_report.cjs"), "utf8");
ok("single words are left out, because one common noun is not a skill",
   queue.every((r) => r.phrase.trim().split(/\s+/).length >= 2),
   queue.filter((r) => r.phrase.trim().split(/\s+/).length < 2).map((r) => r.phrase).join(", "));
ok("words about education are left out, because the score already reads those",
   queue.every((r) => !/\b(degree|diploma|bachelor|master|baccalaur)/i.test(r.phrase)),
   queue.filter((r) => /\b(degree|diploma|bachelor)/i.test(r.phrase)).map((r) => r.phrase).join(", "));
ok("a phrase every trade asks for is left out, because that is advert language not a skill",
   queue.every((r) => r.trades / r.postings < 0.35));
ok("the report writes nothing to the site: it only reads",
   !/docs[\/\\](skills|jobs)\.json["']\s*,\s*JSON/.test(txt) && !/writeFileSync\(\s*path\.join\(dir/.test(txt));

console.log("\nnothing is added without a person saying so");
ok("the queue is a list to review, not a list of changes",
   queue.every((r) => Object.keys(r).join(",") === "phrase,postings,trades,seen_in"),
   JSON.stringify(Object.keys(queue[0] || {})));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
