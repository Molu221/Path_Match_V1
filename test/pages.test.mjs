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
assert.equal(ids.slice().sort().join(), ["board", "ladder", "lab", "market", "paste", "plan", "swipe", "target", "wayfinder"].sort().join(), "the nine extra pages");
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
// the start page no longer carries a Wayfinder box or the career trail; Wayfinder lives on its own page, in the Explore menu and over the All jobs box
for (const id of ["wform", "wq", "wex", "wprev", "htrail"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 0, `the start page has no ${id}`);
assert.ok(/function wayfind\(/.test(html) && js.includes("wayfind(q)"), "the Wayfinder page still applies a sentence through wayfind()");
assert.ok((html.match(/Wayfinder/g) || []).length >= 2, "the name Wayfinder is over the All jobs box");
// the Wayfinder page: the eighth feature, with a form, a live reading and sample prompts for students and graduates
assert.ok(/id="pg-wayfinder"[^>]*data-page="wayfinder"/.test(html) && /id="x-wayfinder"/.test(html), "the Wayfinder page has its section");
assert.ok(/wayfinder: \{ name: "Wayfinder"/.test(js) && /const ORDER = \["wayfinder", /.test(js), "Wayfinder is in the feature list, so it shows in Explore, the start-page tiles and the jump bar");
const wfq = (js.match(/const WF = \{[\s\S]*?\n  \};/) || [""])[0];
const stuQ = (wfq.match(/student: \{[\s\S]*?\] \},/) || [""])[0].match(/^\s+"[^"]+",?$/gm) || [];
const gradQ = (wfq.match(/grad: \{[\s\S]*?\] \}/) || [""])[0].match(/^\s+"[^"]+",?$/gm) || [];
assert.ok(stuQ.length >= 5 && stuQ.length <= 6 && gradQ.length >= 5 && gradQ.length <= 6, "five or six sample prompts for students and for graduates");
assert.ok(/const ORDER = \[[^\]]*"wayfinder"/.test(js) && js.includes('href="#p=${id}"'), "the start page links to the Wayfinder page from its tiles (Go further than a list)");
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
// the Paste a posting page (the ninth feature): the CV on the left, the posting on the right, the match below, through the same pipeline as every posting
assert.ok(/id="pg-paste"[^>]*data-page="paste"/.test(html) && /id="x-paste"/.test(html), "the Paste page has its section");
assert.ok(/const ORDER = \[[^\]]*"board", "paste"\]/.test(js), "Paste a posting is the ninth page in the feature list, after the Application board");
assert.ok(at('<script src="pasteparse.js"></script>') > 0 && at('<script src="pasteparse.js"></script>') < at('<script src="pages.js"></script>'), "pasteparse.js loads before pages.js");
for (const id of ["ppText", "ppTitle", "ppCo", "ppLoc", "ppKind", "ppUrl", "ppGo", "pcvText", "ppResult", "ppSplit"]) assert.ok(js.includes(`id="${id}"`), `the Paste page has #${id}`);
assert.ok(js.indexOf('id="pcvH"') < js.indexOf('id="pjH"'), "the CV panel comes first (left) and the posting second (right)");
for (const fn of ["addMine", "hlPair", "prefWhy"]) assert.ok(new RegExp(`function ${fn}\\(`).test(html), `index.html defines ${fn}, which the Paste page uses`);
assert.ok(js.includes("addMine(x)") && html.includes("addMine(x)"), "the Paste page and the Add a posting form both add through addMine");
assert.ok(js.includes("jobHtml(r, rank, true)"), "the match is drawn with the Top 10 card");
assert.ok(js.includes('pp.addEventListener("toggle", onCardToggle, true)') && js.includes("onAct") && js.includes("starClick"), "the card on the Paste page takes the same clicks as the Top 10 card");
assert.ok(/!r\.j\.ex&&prefOk/.test(html), "the example posting is kept out of the Top 10");
assert.ok(js.includes("Example Manufacturing Inc.") && js.includes("not a real job"), "the example posting says it is not a real job");
assert.ok(!/class="[^"]*\bt10\b/.test(html), "the score-histogram class t10 is not used by index.html");
// the live reading under the Describe box (and on the Wayfinder page)
assert.equal((html.match(/id="dprev"/g) || []).length, 1, "id dprev appears once");
assert.ok(/function readingOf\(/.test(html) && html.includes('livePreview($("dq")'), "the box shows how the sentence is read while typing");
// the score meter is the one way the score parts are drawn: posting cards, Quick sort and the compare table all call it, and the old small bars are gone
assert.ok(/function scoreMeter\(/.test(html) && js.includes("scoreMeter(s)") && html.includes("scoreMeter(r.s,true)"), "cards, Quick sort and compare use scoreMeter");
assert.ok(!/class="sb sb-/.test(html), "the old three small bars are gone");
// one click to a scored Top 10 without a CV: the start page and the All jobs banner both offer the example
assert.ok((html.match(/data-tryex/g) || []).length >= 3 && /function tryExample\(/.test(html), "the example CV is one click from the start page and from All jobs");
assert.ok(html.includes("This is an example CV, not a real person."), "the Top 10 says when it is showing the example CV");
assert.ok(at('<script src="pages.js"></script>') > 0 && at('<script src="pages.js"></script>') < at("const XP=window.XP"), "pages.js loads before index.html reads XP");
// a missing pages.js must not break the site
assert.ok(/window\.XP\|\|\{pages:\{\}/.test(html), "index.html has a fallback when pages.js is missing");

// batch of CV-aware insights: the map can be shaded by the CV's fit, the Skill lab has a plan for each goal, the ladder reads the CV against each rung
assert.ok(js.includes('const METRICS = [["count", "Postings"], ["fit", "Your strong matches"], ["rate", "Your fit rate"]]'), "the Market map can be shaded by postings, strong matches or fit rate");
assert.ok(js.includes("const STRONG = 60, RATE_MIN = 30") && /disabled title="Add your CV to use this"/.test(js), "the 60 line is the site's strong line, and the fit shadings need a CV");
assert.ok(js.includes("fitStats(MK.kind)") && js.includes("scoreOf(jkey(j))"), "the fit counts come from the same scores as the Top 10");
assert.ok(js.includes('labPlan(pool, hardE, L, "avg")') && js.includes('labPlan(pool, hardE, L, "doors")') && js.includes("Open more doors") && js.includes("Raise my average"), "the Skill lab offers a plan for each goal");
assert.ok(js.includes("function readiness(") && js.includes("How your CV reads against each rung") && js.includes("A quick read, not a score"), "the ladder reads the CV against each rung and says it is not a score");

// the class names of the big shared layouts are not reused by the new pages (a clash once broke the top bar and the deck)
const clash = ["top", "bar", "hero", "wrap", "page", "side"];
for (const c of clash) assert.ok(!new RegExp(`class="[^"]*\\b${c}\\b[^"]*"`).test(js.replace(/class="wrap[^"]*"/g, "")), `pages.js does not use the layout class "${c}"`);

console.log("pages tests passed (" + ids.length + " pages)");
