// Checks of the Week plan maths (docs/planner.js) against the real score rules (docs/scoring.js).
// Run: node test/planner.test.mjs
import assert from "node:assert/strict";
import { loadUmd } from "../scripts/umd.mjs";
const Scoring = loadUmd("scoring.js", "Scoring");
const Planner = loadUmd("planner.js", "Planner");

const rows = (st, tag = "R") => st.split("").map((s, i) => ({ n: "kw" + i, kind: "s", tag, st: s }));
const TI = { past: false, intern: false, tgt: true, anyTerm: false };

// the range is stable, holds the score, and is wider when there are few keywords
const many = rows("MMMMMMGGGGGGMMGGMMGG".repeat(2)), few = rows("MG");
const a = Planner.range(Scoring, many, 0.8, TI, "acme|analyst"), b = Planner.range(Scoring, many, 0.8, TI, "acme|analyst");
assert.ok(a.lo === b.lo && a.mid === b.mid && a.hi === b.hi, "the same posting always gets the same range");
assert.ok(a.lo <= a.mid && a.mid <= a.hi, "the score sits inside its range");
assert.equal(a.mid, Scoring.compute(many, 0.8, TI).total, "mid is the score the page shows");
const f = Planner.range(Scoring, few, 0.8, TI, "acme|intern");
assert.ok(f.hi - f.lo > a.hi - a.lo, "few keywords give a wider range than many (" + (f.hi - f.lo) + " vs " + (a.hi - a.lo) + ")");
const one = Planner.range(Scoring, rows("M"), 0.8, TI, "x"), oneTotal = Scoring.compute(rows("M"), 0.8, TI).total;
assert.ok(one.mid === oneTotal && one.lo === oneTotal && one.hi === oneTotal, "one keyword has no range to draw");
const all = Planner.range(Scoring, rows("MMMMMMMMMMMMMMMMMMMM"), 1, TI, "full");
assert.equal(all.lo, all.hi, "a posting where every keyword matches cannot vary");

// freshness halves every H days
assert.ok(Math.abs(Planner.fresh(21, 21) - 0.5) < 1e-9 && Planner.fresh(0, 21) === 1 && Math.abs(Planner.fresh(42, 21) - 0.25) < 1e-9);
assert.equal(Planner.fresh(-3, 21), 1, "a posting from the future is not penalised");

// the pick: priority = cautious score x freshness, at most two per employer, blocked ones left out, every skip explained
const c = (key, company, lo, mid, hi, ageDays, block) => ({ key, company, lo, mid, hi, ageDays, block });
const cands = [
  c("a1", "Acme", 70, 74, 80, 2), c("a2", "Acme", 69, 73, 79, 3), c("a3", "Acme", 68, 72, 78, 4),
  c("b1", "Beta", 66, 70, 76, 5), c("c1", "Gamma", 80, 84, 88, 60), c("d1", "Delta", 75, 80, 85, 1, "security check"),
  c("e1", "Epsilon", 40, 70, 95, 2), c("f1", "Zeta", 55, 58, 62, 3)
];
const r = Planner.pick(cands, { n: 3, half: 21, perEmployer: 2 });
assert.equal(r.chosen.map((x) => x.key).join(), "a1,a2,b1", "the three best priorities, two from Acme at most");
assert.equal(r.chosen.length + r.skipped.length, cands.length, "every candidate is either chosen or skipped");
const why = Object.fromEntries(r.skipped.map((x) => [x.key, x.why]));
assert.equal(why.a3, "employer"); assert.equal(why.d1, "block"); assert.equal(why.c1, "old");
assert.equal(why.e1, "wide"); assert.equal(why.f1, "lower");
assert.ok(r.skipped.every((x) => x.why), "every skip has a reason");
// a person who cares more about fit than newness gets the older strong posting
const noDecay = Planner.pick(cands, { n: 3, half: 1000, perEmployer: 2 });
assert.ok(noDecay.chosen.some((x) => x.key === "c1"), "with almost no decay the older, stronger posting comes in");
assert.ok(!Planner.pick(cands, { n: 3, half: Planner.HALF.fit, perEmployer: 2 }).chosen.some((x) => x.key === "c1"), "a 60-day-old posting still loses to fresh ones at the longest preset (45 days)");
assert.ok(Planner.HALF.fit > Planner.HALF.balanced && Planner.HALF.balanced > Planner.HALF.fresh, "the three presets run from patient to impatient");
assert.equal(Planner.pick(cands, { n: 3, half: 21, perEmployer: 2 }).chosen.map((x) => x.key).join(), r.chosen.map((x) => x.key).join(), "the pick does not change between runs");
assert.equal(Planner.pick([], { n: 5, half: 21 }).chosen.length, 0, "an empty list gives an empty plan");
assert.equal(Planner.pick(cands.slice(0, 2), { n: 8, half: 21, perEmployer: 2 }).chosen.length, 2, "fewer candidates than places");

// the Pareto front: nobody on it is beaten on both age and score
const pts = [{ ageDays: 1, lo: 50 }, { ageDays: 2, lo: 60 }, { ageDays: 3, lo: 55 }, { ageDays: 10, lo: 80 }, { ageDays: 12, lo: 70 }, { ageDays: 0.5, lo: 40 }];
assert.equal(Planner.pareto(pts).sort((x, y) => x - y).join(), "0,1,3,5", "front of the example");
for (const i of Planner.pareto(pts)) assert.ok(!pts.some((q) => q !== pts[i] && q.ageDays <= pts[i].ageDays && q.lo >= pts[i].lo && (q.ageDays < pts[i].ageDays || q.lo > pts[i].lo)), "point " + i + " is not beaten");
assert.equal(Planner.pareto([]).length, 0);

// ---------- Target or spray? ----------
const near = (x, y, e, msg) => assert.ok(Math.abs(x - y) <= e, msg + " (" + x + " vs " + y + ")");
near(Planner.chance(30, 30, 0.03, 1.7), 0.03, 1e-9, "a typical posting has the chance the person set");
assert.ok(Planner.chance(60, 30, 0.03, 1.5) > Planner.chance(40, 30, 0.03, 1.5) && Planner.chance(20, 30, 0.03, 1.5) < 0.03, "the chance rises with the score when the multiplier is above 1");
near(Planner.chance(90, 30, 0.03, 1), 0.03, 1e-9, "with a multiplier of 1 the score does not matter");
assert.ok(Planner.chance(100, 10, 0.5, 3) <= 0.9, "the chance is capped");
const pool = Array.from({ length: 1000 }, (_, i) => 5 + (i % 40));            // scores 5..44, mean 24.5
const hist = Planner.histogram(pool), mean = Planner.meanOf(pool);
near(Planner.expectedSpray(hist, 30, mean, 0.03, 1), 0.9, 1e-9, "at a multiplier of 1, spraying 30 applications expects 30 x 3%");
const picks = [70, 68, 66, 65, 64, 62, 60, 60, 59, 58];
const be = Planner.breakEven(hist, picks, 30, mean, 0.03, 6);
assert.equal(be.kind, "found"); assert.ok(be.m > 1 && be.m < 3, "break-even multiplier is plausible: " + be.m);
const at = (m) => Planner.expectedTarget(picks, mean, 0.03, m) - Planner.expectedSpray(hist, 30, mean, 0.03, m);
assert.ok(at(be.m) >= 0 && at(be.m - 0.01) < 0, "break-even is the first multiplier where targeting catches up");
assert.ok(Planner.breakEven(hist, picks, 60, mean, 0.03, 6).m > be.m, "the more volume spraying buys, the higher the break-even");
assert.equal(Planner.breakEven(hist, picks, 10, mean, 0.03, 6).kind, "always", "with equal numbers of applications targeting wins whatever the multiplier");
assert.equal(Planner.breakEven(hist, [25, 24, 26, 25], 30, mean, 0.03, 6).kind, "never", "picks no better than average never catch up with more volume");
const sim = Planner.simulate(hist, picks, 30, mean, 0.03, 1.6, 2000, "t1"), sim2 = Planner.simulate(hist, picks, 30, mean, 0.03, 1.6, 2000, "t1");
assert.ok(sim.spray.mean === sim2.spray.mean && sim.target.mean === sim2.target.mean, "the simulation is repeatable");
const eS = Planner.expectedSpray(hist, 30, mean, 0.03, 1.6), eT = Planner.expectedTarget(picks, mean, 0.03, 1.6);
near(sim.spray.mean, eS, 0.12, "simulated spray matches its expected value"); near(sim.target.mean, eT, 0.12, "simulated target matches its expected value");
assert.ok(sim.target.lo <= sim.target.mean && sim.target.mean <= sim.target.hi && sim.target.any >= 0 && sim.target.any <= 1, "ranges are ordered");
// what the person's own applications imply
assert.equal(Planner.impliedMultiplier([{ score: 50, iv: true }]), null, "too few applications to say anything");
const mine = [];
for (let i = 0; i < 20; i++) mine.push({ score: 70, iv: i < 5 });             // 5 of 20 interviews at 70
for (let i = 0; i < 20; i++) mine.push({ score: 30, iv: i < 1 });             // 1 of 20 at 30
const imp = Planner.impliedMultiplier(mine);
assert.ok(imp && imp.m > 1.2 && imp.n === 40 && imp.k === 6, "higher scores that got more interviews imply a multiplier above 1: " + JSON.stringify(imp));
assert.equal(Planner.impliedMultiplier(mine.map((x) => ({ score: 50, iv: x.iv }))), null, "no spread in the scores: cannot tell");

console.log("planner tests passed: range, freshness, pick, Pareto front, target or spray");
