// Checks of Profile extras: certifications, awards, languages and the like that a person adds by hand (docs/pages.js, docs/index.html).
// The data layer is plain code inside index.html, so it is cut out of the page and run here; the page itself was clicked through in a real browser.
// What matters: an item can only ever add text under a standard heading, only its name is matched (an issuer such as "PMI" is also a skill),
// the stage the CV is read as never depends on the items, and every match that rests on an item can be told apart. Run: node test/extras.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (f) => fs.readFileSync(new URL("../docs/" + f, import.meta.url), "utf8");
const html = read("index.html"), js = read("pages.js"), css = read("pages.css");

// --- cut the data layer out of the page and run it with a stored list that has bad entries in it
const a = html.indexOf("const XKINDS="), b = html.indexOf("const TAGW=");
assert.ok(a > 0 && b > a, "the extras data layer is in index.html");
const src = html.slice(a, b);
const stored = JSON.stringify([
  { k: "cert", t: "PMP", w: "PMI", y: "2024" },
  { k: "nope", t: "Wrong kind" },                         // unknown kind: dropped
  { k: "cert", t: "   " },                                // nothing in it: dropped
  null, 7, "text",                                        // not items: dropped
  { k: "lang", t: "French, fluent", w: "", y: "20x4" },   // bad year: kept without the year
  { k: "award", t: "Dean's list\nSKILLS\nPython", w: "Concordia", y: "2023" }   // a line break must not write a heading
]);
const cvLevelCalls = [];
function load(storedValue) {
  const store = { pm_extras: storedValue };
  const ctx = vm.createContext({
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    JobMeta: { cvLevel: (t) => { cvLevelCalls.push(t); return { lvl: 1 }; } },
    CV: null, T: { shown: 10 }, paintStage() {}, renderCvRead() {}, renderDetails() {}, paintNav() {}, writeHash() {}, run() {}
  });
  vm.runInContext(src + "\nthis.api={XKINDS,XMAX,xClean,get XTRA(){return XTRA},saveExtras,withExtras,xSig,mkCV,xBy,setCV(c){CV=c}};", ctx);
  return { api: ctx.api, store };
}
const { api, store } = load(stored);
assert.deepEqual(JSON.parse(JSON.stringify(api.XTRA.map((x) => [x.k, x.t]))), [["cert", "PMP"], ["lang", "French, fluent"], ["award", "Dean's list SKILLS Python"]], "bad entries are dropped, a line break becomes a space");
assert.equal(api.XTRA[1].y, "", "a year that is not four digits is dropped");
assert.equal(load("not json").api.XTRA.length, 0, "a broken stored value gives an empty list");
assert.equal(load(JSON.stringify(Array.from({ length: 90 }, (_, i) => ({ k: "tool", t: "Tool " + i })))).api.XTRA.length, api.XMAX, "the list is capped");
assert.equal(api.xClean("x".repeat(500), 80).length, 80, "an item name is cut to 80 characters");
assert.equal(api.xClean("a\r\nb\tc\u0000d", 80), "a b c d", "control characters never reach the CV text");

// --- the text the score reads: the CV untouched, the items after it, one standard heading per kind
const base = "Alex Example\nEXPERIENCE\nAnalyst at Acme\nSKILLS\nExcel";
const w = api.withExtras(base);
assert.ok(w.raw.startsWith(base + "\n\n"), "the CV text is first and unchanged");
assert.equal(w.at, base.length + 2, "at = where the items start");
const HEADS = api.XKINDS.map((k) => k[2]);
const heads = w.raw.slice(w.at).split("\n").filter((l) => HEADS.includes(l));
assert.deepEqual(JSON.parse(JSON.stringify(heads)), ["CERTIFICATIONS", "AWARDS", "LANGUAGES"], "only the headings of the kinds in use, in the fixed order, and no heading an item wrote itself");
for (const sp of w.spans) assert.equal(w.raw.slice(sp.a, sp.b), api.XTRA[sp.i].t, "each span is exactly the name of its item");
assert.ok(!/PMI|Concordia|2024|2023/.test(w.raw), "issuer and year are not part of the text that is matched");
assert.ok(/PMP, PMI, 2024/.test(api.withExtras("", api.XTRA, true).raw), "the text to copy has issuer and year");
assert.equal(api.withExtras(base, []).raw, base, "no items: the CV text is untouched");
assert.equal(api.withExtras(base, []).at, -1, "no items: no start position");

// --- the CV object keeps the CV apart from the items, and reads its stage from the CV alone
const cv = api.mkCV(base);
assert.equal(cv.base, base);
assert.equal(cv.raw, w.raw);
assert.equal(cvLevelCalls.at(-1), base, "the stage is read from the CV text without the items");
assert.equal(cv.xsig, api.xSig());
const sigBefore = api.xSig();
api.XTRA.pop(); assert.notEqual(api.xSig(), sigBefore, "removing an item changes the signature, so the page offers to update the matches");
assert.equal(api.mkCV(base).extrasAt >= 0, true);
api.setCV(cv);
assert.equal(api.xBy({ first: cv.extrasAt }), true, "a skill whose first mention is in an item is marked as added by the person");
assert.equal(api.xBy({ first: cv.extrasAt - 1 }), false, "a skill already in the CV is not");
api.setCV(api.mkCV(base)); api.XTRA.length = 0; api.setCV(api.mkCV(base));
assert.equal(api.xBy({ first: 5 }), false, "with no items nothing is added by the person");

// --- with the real skill list: an item is found as the skill it names, and its issuer is not read as another skill
const sandbox = { self: {} };
vm.runInNewContext(read("matcher.js"), sandbox);
const engine = sandbox.self.Matcher.engine(JSON.parse(read("skills.json")));
const items = [{ k: "cert", t: "PMP", w: "PMI", y: "2024" }, { k: "award", t: "Dean's list", w: "Concordia", y: "2023" }];
const e = api.withExtras("Alex Example\nSKILLS\nExcel", items);
const found = engine.findCv(e.raw);
assert.ok(found["PMP"] && found["PMP"].first >= e.at, "PMP is found, and inside the items");
assert.ok(found["Excel"] && found["Excel"].first < e.at, "Excel is found, and in the CV");
assert.ok(!found["PMBOK"], "the issuer PMI is not read as PMBOK");
const full = engine.findCv(api.withExtras("Alex Example\nSKILLS\nExcel", items, true).raw);
assert.ok(full["PMBOK"], "the copied text, with the issuer, would have been read as PMBOK: this is why only the name is matched");
// loose words of an item never match a phrase of a posting: the word index is built from the CV alone
const ixBase = engine.indexCv("Alex Example\nSKILLS\nExcel"), ixWith = engine.indexCv(e.raw);
const listings = engine.matchTerms({ "technology partner listings": { name: "Listings", words: ["listings"], first: 0, count: 1, spans: [[0, 8]], line: "" } }, ixWith);
const listingsBase = engine.matchTerms({ "technology partner listings": { name: "Listings", words: ["listings"], first: 0, count: 1, spans: [[0, 8]], line: "" } }, ixBase);
assert.ok(ixBase && ixWith && listings && listingsBase, "the word index can be built both ways");
assert.ok(/function cvIx\(\)\{[^}]*indexCv\(CV\.base\)/.test(html), "cvIx() builds the word index from the CV alone, so \"Dean's list\" cannot match a posting that says \"listings\"");
assert.ok(/function cvFound\(\)\{[^}]*findCv\(CV\.raw\)/.test(html), "cvFound() reads the CV with the items");
const cvLangSrc = html.slice(html.indexOf("function cvLang"), html.indexOf("function cvLang") + 500);
assert.ok(/CV\.base/.test(cvLangSrc) && !/CV\.raw/.test(cvLangSrc.split("\nfunction ")[0]), "the language the CV is read in comes from the CV text alone");

// --- the page: wiring, labels, and what it says it does
assert.ok(html.includes('id="pg-extras"') && html.includes('id="x-extras"'), "the page has its <main> and its container");
assert.ok(/extras: \{ name: "Profile extras"/.test(js) && /const ORDER = \[[^\]]*"extras"/.test(js), "Profile extras is in the feature list");
assert.ok(css.includes("body[data-pg=extras]"), "Profile extras has its accent colour");
assert.ok(/data-act="xapply"/.test(js) && /Update my matches/.test(js), "after a change the person presses one button to score again");
assert.ok(/Matching is by skill name only/.test(js), "the page says what is matched");
assert.ok(/added by you/i.test(html), "matches that rest on an item say so");
assert.ok(/Saved in this browser only\. Nothing is uploaded\./.test(js), "the page says where the items are kept");
assert.ok(/data-act="xclear"/.test(js) && /data-act="xask"/.test(js) && /data-act="xkeep"/.test(js), "Remove all asks first");
assert.ok(/Job Bank occupation profiles are scored another way/.test(js), "the count says which postings it leaves out");
assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(js.slice(js.indexOf("PROFILE EXTRAS"), js.indexOf("the object index.html reads"))), "the page sends nothing anywhere");
assert.ok(js.includes("pm_extras") === false && html.includes("pm_extras"), "the items are kept under one storage key, written by index.html");
console.log("extras.test.mjs: all checks passed");
