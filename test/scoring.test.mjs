/* Tests for docs/scoring.js: the 0-100 score, its three parts and the rules that keep it honest. Run: node test/scoring.test.mjs */
import assert from "node:assert/strict";
import { loadUmd, loadJobMeta } from "../scripts/umd.mjs";

const S = loadUmd("scoring.js", "Scoring");
const J = loadJobMeta();
const row = (n, tag, st, kind = "s") => ({ n, kind, tag, st });

/* the caps add up to 100 and nothing can go past them */
assert.equal(S.CAP.role + S.CAP.level + S.CAP.overlap, 100);
const perfect = Array.from({ length: 12 }, (_, i) => row("Skill " + i, i < 3 ? "T" : "R", "M"));
const top = S.compute(perfect, 1, {});
assert.ok(top.role === 40 && top.overlap === 35 && top.level === 25 && top.total === 100, "a full match with the right level is 100: " + JSON.stringify(top));

/* nothing on the CV: no keyword points, and the score is only what the level gives */
const none = S.compute(Array.from({ length: 12 }, (_, i) => row("Skill " + i, "R", "G")), 1, {});
assert.equal(none.role, 0);
assert.equal(none.overlap, 0);
assert.equal(none.total, 25);

/* a posting with almost no keywords cannot look perfect: 2 of 3 is not 67% */
const few = S.keywords([row("A", "T", "M"), row("B", "R", "M"), row("C", "R", "G")]);
assert.ok(few.cov < 0.4 && few.overlap < 35, "few keywords are scored cautiously: " + JSON.stringify(few));

/* a close keyword counts half, never as much as a match */
const m = S.keywords([row("A", "R", "M"), row("B", "R", "M"), row("C", "R", "M"), row("D", "R", "M")]);
const r = S.keywords([row("A", "R", "R"), row("B", "R", "R"), row("C", "R", "R"), row("D", "R", "R")]);
assert.ok(r.overlap < m.overlap && r.overlap > 0, "close < match");
assert.ok(Math.abs(r.cov * 2 - m.cov) < 1e-9, "a close keyword is exactly half a match");

/* language is a flag, not points: a posting that only shares "Bilingual" with the CV earns nothing */
const lang = S.keywords([row("Bilingual (EN/FR)", "R", "M"), row("English", "R", "M"), row("French", "R", "M"), row("Welding", "R", "G")]);
assert.equal(lang.overlap, 0);
assert.equal(lang.role, 0);

/* a bare job noun in a title says little: Analyst alone does not carry the role fit */
const noun = S.keywords([row("Analyst", "T", "M", "t"), row("Credit", "T", "G", "t"), row("Risk management", "T", "G")]);
const field = S.keywords([row("Welding", "T", "M"), row("Credit", "T", "G", "t"), row("Risk management", "T", "G")]);
assert.ok(noun.role < field.role, "the name of a skill outweighs the name of a job: " + noun.role + " vs " + field.role);

/* weights: a skill of the dictionary beats a single ordinary word, a title word beats a preferred one */
assert.ok(S.weight(row("Python", "R", "G", "s")) > S.weight(row("reporting", "R", "G", "t")));
assert.ok(S.weight(row("Python", "T", "G", "s")) > S.weight(row("Python", "P", "G", "s")));

/* level fit uses the table of jobmeta.js */
assert.equal(S.levelPoints(J.fit(0, 0), {}), 25);
assert.equal(S.levelPoints(J.fit(0, 4), {}), 0, "a director role is worth nothing to a student");
assert.ok(S.levelPoints(J.fit(0, 1), {}) >= 22, "an entry-level job suits a graduate");
assert.ok(S.levelPoints(J.fit(0, 2), {}) <= 10, "a mid-level job is a stretch for a graduate");
assert.ok(S.levelPoints(J.fit(2, 0), {}) <= 5, "an internship is far below a mid-level person");
assert.equal(S.levelPoints(J.fit(null, 3), {}), 15, "unknown stage: a middle value, not a free ride");

/* an internship whose term is not the one wanted loses a few points; a past term is capped */
assert.equal(S.levelPoints(1, { intern: true, tgt: true }), 25);
assert.equal(S.levelPoints(1, { intern: true, tgt: false, anyTerm: true }), 20);
assert.equal(S.levelPoints(1, { intern: true, tgt: false, anyTerm: false }), 22);
assert.equal(S.levelPoints(1, { intern: true, tgt: true, past: true }), 3);
assert.equal(S.levelPoints(0, { intern: true, tgt: false, anyTerm: true }), 0, "never below zero");

/* the same CV and the same keywords: the better-fitting level always ranks first */
const kw = [row("Python", "T", "M"), row("SQL", "R", "M"), row("Dashboards", "R", "G")];
const forGrad = (lvl) => S.compute(kw, J.fit(0, lvl), {}).total;
assert.ok(forGrad(1) > forGrad(2) && forGrad(2) > forGrad(3) && forGrad(3) >= forGrad(4), "for a new graduate: entry > mid > senior >= director");
const forExec = (lvl) => S.compute(kw, J.fit(4, lvl), {}).total;
assert.ok(forExec(4) > forExec(3) && forExec(3) > forExec(1) && forExec(1) > forExec(0), "for an executive: director > senior > entry > intern");

/* no keywords at all (nothing could be read): a small floor for the role, nothing for the keywords */
const empty = S.compute([], 1, {});
assert.equal(empty.overlap, 0);
assert.equal(empty.role, 2);

console.log("scoring tests passed");
