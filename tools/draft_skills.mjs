/* draft_skills.mjs - I-19's agent: draft dictionary entries for a person to approve.
 *
 * tools/unknown_report.cjs finds the phrases many postings ask for that skills.json does not know.
 * This reads that queue and asks Gemini, for each phrase, the only question that matters: is this
 * something an employer could test you on, or is it the language of job adverts?
 *
 * Three rules it is built around:
 *   1. It never writes skills.json. It writes a proposal file and a review sheet. A person signs,
 *      exactly as with the credentials map.
 *   2. It only ever sends PUBLIC posting vocabulary - phrases and job titles already published by
 *      employers. No CV text, ever. On the free tier Google may use what it receives to improve
 *      their products, so this boundary is the reason the key can live in a repo secret at all.
 *   3. Every proposal carries its evidence: how many postings asked, how many trades, and one real
 *      posting title. A reviewer should never have to take the model's word for it.
 *
 * Run:  GEMINI_API_KEY=... node tools/draft_skills.mjs [how many phrases] [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const KEY = process.env.GEMINI_API_KEY;
const LIMIT = Number(process.argv.find((a) => /^\d+$/.test(a)) || 60);
const DRY = process.argv.includes("--dry");
const BATCH = 20;
const ROOT = path.join(import.meta.dirname, "..");
const QUEUE = path.join(ROOT, "tools", "unknown_skills.json");
const OUT = path.join(ROOT, "tools", "skill_proposals.json");
const SHEET = path.join(ROOT, "tools", "skill_proposals.md");

if (!KEY && !DRY) {
  console.error("No GEMINI_API_KEY. In Actions it comes from the GEMINI_API_KEY_2 repository secret;\n" +
                "locally, prefix the command with it. Use --dry to see the prompt without calling.");
  process.exit(1);
}
const queue = JSON.parse(fs.readFileSync(QUEUE, "utf8"));
/* skip anything already proposed, so a weekly run moves down the queue instead of redoing the top */
const done = fs.existsSync(OUT) ? new Set(JSON.parse(fs.readFileSync(OUT, "utf8")).map((p) => p.phrase)) : new Set();
const todo = queue.filter((q) => !done.has(q.phrase)).slice(0, LIMIT);
console.log(`${queue.length} phrases in the queue, ${done.size} already proposed, ${todo.length} this run`);
if (!todo.length) { console.log("nothing left to do"); process.exit(0); }

/* Model names change. Ask which ones exist rather than hard-coding one that may be retired. */
async function pickModel() {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`);
  if (!r.ok) throw new Error(`listing models failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
  const names = (await r.json()).models
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
  /* cheapest first: this is a bulk job on short phrases, not a reasoning task */
  const want = [/flash-lite/, /flash/, /pro/];
  for (const re of want) { const hit = names.find((n) => re.test(n) && !/preview|exp/.test(n)); if (hit) return hit; }
  return names[0];
}

const PROMPT = `You are helping maintain the skills dictionary of a job-matching tool for Canadian job seekers.

For each phrase below, taken from real job postings, decide ONE thing: is it a SKILL - something an
employer could test or verify a candidate on - or is it the language of job adverts?

Say "not a skill" for: slogans and culture talk ("core values", "fast-paced environment"), hiring
process wording ("the person selected", "the following tasks"), job titles, company names, benefits,
and anything about the posting rather than the work.

Say it IS a skill for: concrete work a person does or knows ("operate a forklift", "record cargo
information", "plan menus"), tools, machines, certifications, regulations, and physical demands an
employer states as a requirement ("frequent lifting", "continuous standing").

Both English and French phrases appear. Keep the language of the phrase in the canonical name.

Reply with JSON only: an array, one object per phrase, in the same order, each with:
  phrase        the phrase exactly as given
  is_skill      true or false
  name          if a skill: the canonical name to put in the dictionary, tidied and singular where
                natural. Otherwise null.
  aliases       if a skill: up to 4 other ways employers write it. Otherwise [].
  category      if a skill, one of: tool, machine, process, certification, regulation, physical,
                software, material, other. Otherwise null.
  reason        one short sentence a human reviewer can check, naming what made you decide.`;

async function ask(model, items) {
  const body = {
    contents: [{ parts: [{ text: PROMPT + "\n\nPhrases:\n" +
      items.map((q, i) => `${i + 1}. "${q.phrase}"  (asked by ${q.postings} postings across ${q.trades} kinds of job; e.g. ${q.seen_in[0]})`).join("\n") }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" }
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 400)}`);
  const txt = (await r.json()).candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  return JSON.parse(txt);
}

if (DRY) { console.log("\n--- the prompt, unsent ---\n" + PROMPT + "\n\nfirst batch:\n" +
  todo.slice(0, 5).map((q) => `  "${q.phrase}"  (${q.postings} postings)`).join("\n")); process.exit(0); }

const model = await pickModel();
console.log(`using ${model}\n`);
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
let added = 0, skills = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  const items = todo.slice(i, i + BATCH);
  try {
    const res = await ask(model, items);
    for (const r of res) {
      const q = items.find((x) => x.phrase === r.phrase) || items[res.indexOf(r)];
      if (!q) continue;
      out.push({ phrase: q.phrase, postings: q.postings, trades: q.trades, seen_in: q.seen_in[0] || "",
                 is_skill: !!r.is_skill, name: r.name || null, aliases: r.aliases || [],
                 category: r.category || null, reason: r.reason || "", model,
                 drafted_on: new Date().toISOString().slice(0, 10), approved: null });
      added++; if (r.is_skill) skills++;
    }
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  } catch (e) {
    console.error(`  batch at ${i} failed: ${e.message}`);
    if (/429|quota|RESOURCE_EXHAUSTED/i.test(e.message)) { console.error("  rate limit - stopping here, the rest keeps for next run"); break; }
  }
  await new Promise((s) => setTimeout(s, 6000));     /* gentle on the free tier */
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

const fresh = out.slice(-added);
const rows = fresh.filter((p) => p.is_skill).sort((a, b) => b.postings - a.postings);
fs.writeFileSync(SHEET,
`# Skills proposed for the dictionary

Drafted by the agent from the phrases many postings ask for and the dictionary does not know.
**Nothing here is in use.** Mark the ones to add, and they go in. Model: ${model}. Drafted ${new Date().toISOString().slice(0, 10)}.

${added} phrases judged this run, ${skills} of them called skills.

| add? | postings | trades | proposed name | aliases | category | why | seen in |
|---|---|---|---|---|---|---|---|
${rows.map((p) => `| [ ] | ${p.postings} | ${p.trades} | **${p.name}** | ${(p.aliases || []).join(", ")} | ${p.category} | ${p.reason} | ${p.seen_in} |`).join("\n")}

## Called not a skill, for checking

If any of these is wrong, say so - it means the prompt needs work.

${fresh.filter((p) => !p.is_skill).map((p) => `- **${p.phrase}** (${p.postings} postings) - ${p.reason}`).join("\n")}
`);
console.log(`\n${added} judged, ${skills} proposed as skills.`);
console.log(`proposals: ${path.relative(ROOT, OUT)}\nreview sheet: ${path.relative(ROOT, SHEET)}`);
