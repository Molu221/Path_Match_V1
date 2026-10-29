// Offline checks for the NOC library (docs/noc). Run: node test/noc_library.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import * as nl from "../docs/noc/noc_library.js";

const lib = nl.prepare(JSON.parse(fs.readFileSync(new URL("../docs/noc/noc_library.lite.json", import.meta.url), "utf8")));
const cv = fs.readFileSync(new URL("../cv/sample_cv.txt", import.meta.url), "utf8");

// the library covers every NOC 2021 occupation
assert.equal(Object.keys(lib.nocs).length, 516);
assert.equal(Object.keys(lib.profiles).length, 900);

// Job Bank standard titles map to one occupation
assert.deepEqual([...new Set(lib.title_index["supermarket butcher"].map((c) => lib.profiles[c].noc))], ["63201"]);

// CV -> occupations
const fits = nl.findOccupations(lib, cv);
assert.ok(fits.length > 0, "the sample CV fits at least one occupation");

// CV vs occupation: only the 3 labels, and the 5 parts
const r = nl.compare(lib, cv, "21321", { postingLanguage: "Bilingual", fits });
assert.ok(r.items.length > 0);
assert.ok(r.items.every((i) => ["Matched", "Missing", "Guess"].includes(i.label)));
assert.ok(r.items.every((i) => ["duties", "skills", "education", "certifications", "languages"].includes(i.part)));
const lic = r.items.find((i) => i.part === "certifications");
assert.equal(lic.label, "Missing", "a student CV has no P.Eng. licence");
const edu = r.items.find((i) => i.part === "education");
assert.equal(edu.label, "Matched", "B.Eng. meets a bachelor's degree");
assert.deepEqual(r.items.filter((i) => i.part === "languages").map((i) => i.label), ["Matched", "Matched"]);

// "English or French" means either one is enough
const either = nl.compare(lib, "Supply chain intern. Languages: French.", "13201", { postingLanguage: "English or French" });
assert.deepEqual(either.items.filter((i) => i.part === "languages").map((i) => [i.en, i.label]), [["English or French", "Matched"]]);

// one Job Bank title -> one occupation (the same in Python: noc_for_title)
assert.deepEqual([nl.nocForTitle(lib, "supermarket butcher").noc, nl.nocForTitle(lib, "supermarket butcher").how], ["63201", "exact title"]);
assert.deepEqual([nl.nocForTitle(lib, "driver, truck").noc, nl.nocForTitle(lib, "driver, truck").how], ["73300", "closest title"]);
assert.equal(nl.nocForTitle(lib, "cook's helper").how, "exact title", "titles with an apostrophe or a slash are found");
assert.equal(nl.nocForTitle(lib, "transportation coordinator").noc, "13201");
assert.equal(nl.nocForTitle(lib, "intern").how, "none", "a vague title gives no occupation");
assert.equal(nl.nocForTitle(lib, "").how, "none");

// English <-> French
assert.deepEqual(nl.translate(lib, "Coordinating"), ["Coordination"]);

console.log("noc library tests passed:", fits.slice(0, 3).map((f) => f.code + " " + f.name.en).join(" | "));
