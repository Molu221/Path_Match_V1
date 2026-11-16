/* apply.test.mjs - the gate between what the agent proposes and what the
 * dictionary holds. The agent writes proposals; this script is the only way one
 * becomes a skill, and these checks are what stop it from adding something a
 * person never ticked.
 * Run: node test/apply.test.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "..", "tools", "apply_proposals.mjs");

let pass = 0, fail = 0;
const ok = (what, cond, got) => {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (got !== undefined ? "   got: " + got : "")); }
};

/* A sandbox: a tiny dictionary and whatever proposals the check needs. */
let n = 0;
const run = (proposals, extra = []) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apply" + n++ + "-"));
  const dictFile = path.join(dir, "skills.json");
  const propFile = path.join(dir, "proposals.json");
  fs.writeFileSync(dictFile, JSON.stringify({
    meta: { skills: 2, aliases: 3 },
    skills: [
      { n: "Forklift operation", a: ["forklift operation", "cariste"], s: "library" },
      { n: "Welding", a: ["welding"], s: "library" },
    ],
  }));
  fs.writeFileSync(propFile, JSON.stringify(proposals));
  let out = "", code = 0;
  try {
    out = execFileSync("node", [SCRIPT, "--signer", "A Reviewer",
      "--proposals", propFile, "--dict", dictFile, ...extra],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
    code = e.status;
  }
  return {
    out, code,
    dict: JSON.parse(fs.readFileSync(dictFile, "utf8")),
    props: JSON.parse(fs.readFileSync(propFile, "utf8")),
  };
};

const prop = (over = {}) => ({
  phrase: "menu planning", is_skill: true, name: "Menu planning",
  aliases: ["planning menus", "menu development"], category: "process",
  postings: 87, trades: 20, approved: null, ...over,
});

console.log("nothing moves without a person");
let r = run([prop({ approved: null })]);
ok("a proposal nobody ticked is not added", r.dict.skills.length === 2, r.dict.skills.length);
ok("...and the script says so plainly", /approved.*true/.test(r.out));
r = run([prop({ approved: false })]);
ok("a proposal turned down is not added", r.dict.skills.length === 2, r.dict.skills.length);
r = run([prop({ approved: true })], ["--dry"]);
ok("--dry writes nothing", r.dict.skills.length === 2, r.dict.skills.length);
ok("...but still says what it would add", /Menu planning/.test(r.out));

console.log("\nand not without a name on it");
try {
  execFileSync("node", [SCRIPT], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  ok("refuses to run unsigned", false);
} catch (e) {
  ok("refuses to run unsigned", e.status === 2, e.status);
}

console.log("\nwhat a tick actually does");
r = run([prop({ approved: true })]);
const addedEntry = r.dict.skills.find((s) => s.n === "Menu planning");
ok("the skill is in the dictionary", !!addedEntry);
ok("its aliases are folded to the form the page matches on",
   addedEntry && addedEntry.a.includes("menu planning") && addedEntry.a.includes("planning menus"),
   addedEntry && addedEntry.a.join(", "));
ok("the name itself is one of them", addedEntry && addedEntry.a.includes("menu planning"));
ok("the entry says a person signed it, and when",
   addedEntry && /^agent, signed by A Reviewer \d{4}-\d{2}-\d{2}$/.test(addedEntry.s),
   addedEntry && addedEntry.s);
ok("the dictionary stays in alphabetical order",
   r.dict.skills.map((s) => s.n.toLowerCase()).every((x, i, all) => i === 0 || all[i - 1] <= x),
   r.dict.skills.map((s) => s.n).join(" | "));
ok("the count at the top of the file is brought up to date",
   r.dict.meta.skills === r.dict.skills.length, r.dict.meta.skills);
ok("the proposal records that it was applied, so a second run cannot repeat it",
   r.props[0].applied_on && r.props[0].applied_by === "A Reviewer");

console.log("\nwhat it refuses even when ticked");
r = run([prop({ approved: true, is_skill: false, name: "Software Engineer" })]);
ok("a phrase the agent called not-a-skill cannot be ticked into the dictionary",
   r.dict.skills.length === 2 && /did not call this a skill/.test(r.out));
r = run([prop({ approved: true, name: "Fork lift driving", aliases: ["cariste"] })]);
ok("a word another skill already answers to is refused, not guessed at",
   r.dict.skills.length === 2 && /already belongs to "Forklift operation"/.test(r.out), r.out.trim());
r = run([prop({ approved: true, name: "Menu planning", aliases: ["mp"] })]);
const short = r.dict.skills.find((s) => s.n === "Menu planning");
ok("an alias too short to be safe is dropped, and the rest still goes in",
   short && !short.a.includes("mp") && /too short/.test(r.out), short && short.a.join(", "));
r = run([prop({ approved: true, name: "" })]);
ok("a proposal with no name is refused", r.dict.skills.length === 2 && /no name/.test(r.out));
r = run([prop({ approved: true, name: "Welding", aliases: ["welding"] })]);
ok("a skill already in the dictionary is not added twice",
   r.dict.skills.length === 2 && /already belongs/.test(r.out));

console.log("\none bad proposal does not stop a good one");
r = run([
  prop({ approved: true, name: "Fork lift driving", aliases: ["cariste"] }),
  prop({ approved: true, name: "Menu planning" }),
]);
ok("the good one is added", !!r.dict.skills.find((s) => s.n === "Menu planning"));
ok("...and the bad one is still refused, with the reason printed",
   !r.dict.skills.find((s) => s.n === "Fork lift driving") && /already belongs/.test(r.out));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
