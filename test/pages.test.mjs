// Offline checks of the extra pages (docs/pages.js, docs/pages.css) against docs/index.html.
// The pages draw into the DOM, so this does not click through them (that was done in a real browser); it checks the wiring:
// pages.js loads, every page it declares has its container and its colour, and index.html reads them from one place.
// Run: node test/pages.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (f) => fs.readFileSync(new URL("../docs/" + f, import.meta.url), "utf8");
const html = read("index.html"), css = read("pages.css"), js = read("pages.js");

// pages.js has to run without a page around it and hand index.html one object
const win = {};
const ctx = vm.createContext({
  window: win,
  document: { addEventListener() {}, getElementById() { return null; } },
  localStorage: { getItem() { return null; }, setItem() {} },
  matchMedia: () => ({ matches: false })
});
vm.runInContext(js, ctx, { filename: "pages.js" });
const XP = win.XP;
assert.ok(XP, "pages.js sets window.XP");
for (const fn of ["home", "init", "onStar", "close"]) assert.equal(typeof XP[fn], "function", "XP." + fn);
const ids = Object.keys(XP.pages);
assert.equal(ids.slice().sort().join(), ["board", "ladder", "lab", "market", "plan", "swipe", "target", "wayfinder"].sort().join(), "the eight extra pages");
for (const id of ids) {
  assert.equal(typeof XP.pages[id].render, "function", id + " has render()");
  assert.ok(XP.pages[id].title, id + " has a title");
  assert.ok(html.includes(`id="pg-${id}"`), id + " has its <main> in index.html");
  assert.ok(html.includes(`id="x-${id}"`), id + " has its container in index.html");
  assert.ok(css.includes(`body[data-pg=${id}]`), id + " has an accent colour");
}

// index.html loads the files in the right order: the page code before the script that reads window.XP
const at = (s) => html.indexOf(s);
assert.ok(at('<link rel="stylesheet" href="pages.css">') > 0, "pages.css is linked");
assert.ok(at('<script src="planner.js"></script>') > 0 && at('<script src="planner.js"></script>') < at('<script src="pages.js"></script>'), "planner.js loads before pages.js");
// the Describe box: describe.js loads before the page script, its form and chips container exist once, and the ids it adds do not clash with older ones
assert.ok(at('<script src="describe.js"></script>') > 0 && at('<script src="describe.js"></script>') < at('<script src="pages.js"></script>'), "describe.js loads before pages.js");
for (const id of ["dform", "dq", "dsub", "dclr", "dex", "dchips"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `id ${id} appears once`);
assert.ok(html.includes('$("dform").addEventListener("submit"'), "the Describe form is wired");
// Wayfinder on the start page: one form, one input, one list of examples, and the name appears on the start page and over the All jobs box
for (const id of ["wform", "wq", "wex"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `id ${id} appears once`);
assert.ok(html.includes('$("wform").addEventListener("submit"') && /function wayfind\(/.test(html), "the start page form is wired");
assert.ok((html.match(/Wayfinder/g) || []).length >= 4, "the name Wayfinder is on the start page and over the All jobs box");
// the Wayfinder page: the eighth feature, with a form, a live reading and sample prompts for students and graduates
assert.ok(/id="pg-wayfinder"[^>]*data-page="wayfinder"/.test(html) && /id="x-wayfinder"/.test(html), "the Wayfinder page has its section");
assert.ok(/wayfinder: \{ name: "Wayfinder"/.test(js) && /const ORDER = \["wayfinder", /.test(js), "Wayfinder is in the feature list, so it shows in Explore, the start-page tiles and the jump bar");
const wfq = (js.match(/const WF = \{[\s\S]*?\n  \};/) || [""])[0];
const stuQ = (wfq.match(/student: \{[\s\S]*?\] \},/) || [""])[0].match(/^\s+"[^"]+",?$/gm) || [];
const gradQ = (wfq.match(/grad: \{[\s\S]*?\] \}/) || [""])[0].match(/^\s+"[^"]+",?$/gm) || [];
assert.ok(stuQ.length >= 5 && stuQ.length <= 6 && gradQ.length >= 5 && gradQ.length <= 6, "five or six sample prompts for students and for graduates");
assert.ok(html.includes('href="#p=wayfinder"'), "the start page links to the Wayfinder page");
// every sample prompt reads into at least a type or a place plus something more, and never into a word to hide
{
  const { loadUmd } = await import("../scripts/umd.mjs");
  const D = loadUmd("describe.js", "Describe");
  for (const q of [...stuQ, ...gradQ].map((l) => l.trim().replace(/^"|",?$/g, ""))) {
    const r = D.parse(q, { hasCv: false });
    assert.ok(r.chips.length >= 2, `the prompt "${q}" reads into at least two chips`);
    assert.equal(r.not.length, 0, `the prompt "${q}" hides no words`);
  }
}
// the live reading under both Wayfinder boxes
for (const id of ["wprev", "dprev"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `id ${id} appears once`);
assert.ok(/function readingOf\(/.test(html) && html.includes('livePreview($("wq")') && html.includes('livePreview($("dq")'), "both boxes show how the sentence is read while typing");
// the score meter is the one way the score parts are drawn: posting cards, Quick sort and the compare table all call it, and the old small bars are gone
assert.ok(/function scoreMeter\(/.test(html) && js.includes("scoreMeter(s)") && html.includes("scoreMeter(r.s,true)"), "cards, Quick sort and compare use scoreMeter");
assert.ok(!/class="sb sb-/.test(html), "the old three small bars are gone");
assert.ok(at('<script src="pages.js"></script>') > 0 && at('<script src="pages.js"></script>') < at("const XP=window.XP"), "pages.js loads before index.html reads XP");
// a missing pages.js must not break the site
assert.ok(/window\.XP\|\|\{pages:\{\}/.test(html), "index.html has a fallback when pages.js is missing");

// the class names of the big shared layouts are not reused by the new pages (a clash once broke the top bar and the deck)
const clash = ["top", "bar", "hero", "wrap", "page", "side"];
for (const c of clash) assert.ok(!new RegExp(`class="[^"]*\\b${c}\\b[^"]*"`).test(js.replace(/class="wrap[^"]*"/g, "")), `pages.js does not use the layout class "${c}"`);

console.log("pages tests passed (" + ids.length + " pages)");
