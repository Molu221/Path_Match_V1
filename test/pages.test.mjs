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
assert.deepEqual(ids.slice().sort(), ["board", "ladder", "lab", "market", "swipe"].sort(), "the five extra pages");
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
assert.ok(at('<script src="pages.js"></script>') > 0 && at('<script src="pages.js"></script>') < at("const XP=window.XP"), "pages.js loads before index.html reads XP");
// a missing pages.js must not break the site
assert.ok(/window\.XP\|\|\{pages:\{\}/.test(html), "index.html has a fallback when pages.js is missing");

// the class names of the big shared layouts are not reused by the new pages (a clash once broke the top bar and the deck)
const clash = ["top", "bar", "hero", "wrap", "page", "side"];
for (const c of clash) assert.ok(!new RegExp(`class="[^"]*\\b${c}\\b[^"]*"`).test(js.replace(/class="wrap[^"]*"/g, "")), `pages.js does not use the layout class "${c}"`);

console.log("pages tests passed (" + ids.length + " pages)");
