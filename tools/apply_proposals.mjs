#!/usr/bin/env node
/* apply_proposals.mjs - put approved proposals into the dictionary.
 *
 * The agent proposes. A person reads the proposals and writes "approved": true
 * beside the ones worth keeping. This script is the only thing that turns that
 * tick into a dictionary entry, and it will not move a proposal that nobody has
 * ticked.
 *
 *   node tools/apply_proposals.mjs --signer "Your Name"        write the changes
 *   node tools/apply_proposals.mjs --signer "Your Name" --dry  say what it would do
 *
 * Refuses, and changes nothing, when a proposal is malformed, already known, or
 * would claim a word another skill already answers to.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const after = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const signer = after("--signer", null);
/* The two files are arguments so a test can run this on a sandbox copy rather
   than on the real dictionary. */
const PROPOSALS = after("--proposals", path.join(ROOT, "tools", "skill_proposals.json"));
const DICT = after("--dict", path.join(ROOT, "docs", "skills.json"));

if (!signer || signer.length < 3) {
  console.error("A person has to sign this. Pass --signer \"Your Name\".");
  process.exit(2);
}

/* The dictionary matches on lowercase, unaccented text, the same way the page
   does, so that is the shape a collision has to be checked in. */
const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const proposals = JSON.parse(fs.readFileSync(PROPOSALS, "utf8"));
const dict = JSON.parse(fs.readFileSync(DICT, "utf8"));

/* Every word the dictionary already answers to, and which skill owns it. */
const owner = new Map();
for (const s of dict.skills) {
  owner.set(fold(s.n), s.n);
  for (const a of s.a || []) owner.set(fold(a), s.n);
}

const ticked = proposals.filter((p) => p.approved === true);
const notTicked = proposals.filter((p) => p.approved !== true);

console.log(
  `${proposals.length} proposals in the file, ${ticked.length} ticked, ` +
    `${notTicked.length} left alone.`
);

if (!ticked.length) {
  console.log("Nothing to add. Write \"approved\": true beside a proposal first.");
  process.exit(0);
}

const added = [];
const refused = [];

for (const p of ticked) {
  const why = [];   /* reasons to refuse the whole proposal */
  const notes = []; /* things dropped along the way, worth printing */

  /* A person can only approve something the agent actually called a skill. */
  if (p.is_skill !== true)
    why.push("the agent did not call this a skill, so there is nothing to add");
  if (!p.name || String(p.name).trim().length < 2)
    why.push("no name to add it under");

  const name = String(p.name || "").trim();

  /* Aliases: folded, de-duplicated, the name itself included, nothing tiny. */
  const aliases = [];
  const seen = new Set();
  for (const raw of [name, ...(p.aliases || [])]) {
    const a = fold(raw);
    /* A two-letter alias fires on half the CVs in the country. Drop it and keep
       the rest of the entry, rather than losing a good skill over one word. */
    if (a.length < 3) {
      if (a) notes.push(`dropped alias "${raw}", too short to be safe`);
      continue;
    }
    if (seen.has(a)) continue;
    seen.add(a);
    aliases.push(a);
  }
  if (!aliases.length) why.push("no usable aliases");

  /* A word two skills both answer to makes the match ambiguous, so it is
     refused rather than guessed at. */
  for (const a of aliases) {
    const held = owner.get(a);
    if (held) why.push(`"${a}" already belongs to "${held}"`);
  }

  if (why.length) {
    refused.push({ name: name || p.phrase, why });
    continue;
  }

  for (const note of notes) console.log(`  ${name}: ${note}`);

  added.push({
    n: name,
    a: aliases,
    s: `agent, signed by ${signer} ${new Date().toISOString().slice(0, 10)}`,
  });
  for (const a of aliases) owner.set(a, name);
}

for (const r of refused) {
  console.log(`  refused "${r.name}": ${r.why.join("; ")}`);
}

if (!added.length) {
  console.log("\nNothing could be added. The dictionary is unchanged.");
  process.exit(refused.length ? 1 : 0);
}

/* The file is kept in alphabetical order, so put each new entry where it goes
   rather than on the end. */
dict.skills.push(...added);
dict.skills.sort((x, y) => fold(x.n).localeCompare(fold(y.n)));

dict.meta = dict.meta || {};
dict.meta.skills = dict.skills.length;
dict.meta.aliases = dict.skills.reduce((n, s) => n + (s.a || []).length, 0);
dict.meta.agent_last_applied = new Date().toISOString().slice(0, 10);

console.log("\nadding:");
for (const a of added) console.log(`  ${a.n}  (${a.a.length} aliases)`);

if (dry) {
  console.log("\n--dry: nothing written.");
  process.exit(0);
}

fs.writeFileSync(DICT, JSON.stringify(dict, null, 1) + "\n");

/* The proposals file records what happened, so the same tick cannot be applied
   twice and the history stays readable. */
for (const p of proposals) {
  if (p.approved === true && added.some((a) => a.n === String(p.name || "").trim())) {
    p.applied_on = new Date().toISOString().slice(0, 10);
    p.applied_by = signer;
  }
}
fs.writeFileSync(PROPOSALS, JSON.stringify(proposals, null, 1) + "\n");

console.log(
  `\n${added.length} added. The dictionary now holds ${dict.skills.length} skills.`
);
console.log("Run npm test before pushing.");
