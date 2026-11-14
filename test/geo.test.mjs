// Checks of the Market map's Canada and World views: the outlines in docs/geo.js (made by scripts/build-maps.mjs from Natural Earth),
// the city areas defined in docs/index.html (CITIES), and the wiring in docs/pages.js. The drawing itself was checked in a real browser.
// Run: node test/geo.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
const geoSrc = read("docs/geo.js"), html = read("docs/index.html"), js = read("docs/pages.js");

// --- the outline file loads by itself and sets one global
const win = {};
vm.runInNewContext(geoSrc, { window: win }, { filename: "geo.js" });
const G = win.PMGEO;
assert.ok(G && G.canada && G.world, "geo.js sets window.PMGEO with a canada and a world part");
assert.match(G.source, /Natural Earth/, "the source is named in the file");
assert.ok(geoSrc.length < 200 * 1024, "the outlines stay under 200 KB (" + (geoSrc.length / 1024).toFixed(0) + " KB)");
assert.ok(!/<script[^>]+src="geo\.js"/.test(html), "index.html does not load geo.js up front: the page asks for it when a map is opened");
assert.ok(js.includes('s.src = "geo.js"') && js.includes("window.PMGEO"), "pages.js loads geo.js on demand");
assert.ok(/Natural Earth, public domain/.test(js), "the map credits Natural Earth on the page");

// --- Canada: the 13 provinces and territories of the tile map, each with a path and a label point inside the picture
const tiles = [...(js.match(/const TILES = \[(.*?)\];/s)[1]).matchAll(/\["([A-Z]{2})"/g)].map((m) => m[1]);
assert.equal(tiles.length, 13, "13 tiles");
const C = G.canada;
assert.equal(Object.keys(C.provinces).sort().join(), tiles.slice().sort().join(), "the map has the same 13 places as the tiles");
for (const [code, p] of Object.entries(C.provinces)) {
  assert.match(p.d, /^M[-\d. ]+l/, code + " has a path");
  assert.ok(p.n && p.c[0] > 0 && p.c[0] < C.w && p.c[1] > 0 && p.c[1] < C.h, code + " has a name and a label point in the picture");
}
assert.ok(C.context.length >= 2 && C.context.every((c) => c.d.startsWith("M")), "the United States and Greenland are drawn for context");
assert.ok(C.lakes.startsWith("M"), "the lakes are drawn");
assert.ok(C.w === 1000 && C.h > 600 && C.h < 1100, "the Canada picture is " + C.w + "x" + C.h);

// --- the city areas: the ones the page defines (CITIES) are the ones the map positions, and each one's name, side and province are set
const CITIES = vm.runInNewContext("(" + html.match(/const CITIES=(\[[\s\S]*?\n\]);/)[1] + ")");
const cityKeys = CITIES.map((c) => c[0]);
assert.equal(cityKeys.length, 10);
assert.equal(Object.keys(C.cities).sort().join(), ["MTL", ...cityKeys].sort().join(), "every city area (and Montréal) has a position on the map, and nothing else does");
for (const [k, [x, y]] of Object.entries(C.cities)) assert.ok(x > 0 && x < C.w && y > 0 && y < C.h, k + " is inside the picture");
const keysOf = (name) => [...(js.match(new RegExp(`const ${name} = \\{(.*?)\\};`, "s"))[1]).matchAll(/\b([A-Z]{3}):/g)].map((m) => m[1]).sort().join();
for (const name of ["CITY_SHORT", "CITY_SIDE", "CITY_PROV"]) assert.equal(keysOf(name), ["MTL", ...cityKeys].sort().join(), name + " covers every city area");
// the circles of two cities never overlap at their largest: the distance is more than the two biggest radii (4 + 17 map units for the biggest, less for others)
const names = Object.keys(C.cities);
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const a = C.cities[names[i]], b = C.cities[names[j]], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  assert.ok(d > 25, `${names[i]} and ${names[j]} are ${d.toFixed(0)} units apart, enough for two circles`);
}
// the city definitions read the places they should, and leave other places alone
const city = (loc) => CITIES.filter((c) => c[2].test(loc)).map((c) => c[0]).join();
for (const [loc, want] of [
  ["Toronto, ON", "TOR"], ["Mississauga, Ontario, Canada", "TOR"], ["Richmond Hill, ON", "TOR"], ["Ottawa, ON", "OTT"], ["Gatineau, QC", "OTT"], ["Orleans, ON", "OTT"], ["Saint-Laurent-de-l'Île-d'Orléans, L'Île-d'Orléans", ""], ["Hamilton, ON", ""], ["Milton, ON", "TOR"],
  ["Vancouver, BC", "VAN"], ["Burnaby, British Columbia", "VAN"], ["Richmond, BC", "VAN"], ["Calgary, AB", "CGY"], ["Edmonton, Alberta", "EDM"],
  ["Québec, QC", "QUE"], ["Quebec City, QC", "QUE"], ["Lévis, QC", "QUE"], ["Winnipeg, MB", "WPG"], ["Halifax, NS", "HAL"], ["Dartmouth, NS", "HAL"],
  ["Saskatoon, SK", "SAS"], ["Regina, SK", "REG"], ["Montréal, QC", ""], ["Sherbrooke, QC", ""], ["Remote – Canada", ""], ["Canada", ""]
]) assert.equal(city(loc), want, `"${loc}" is read as "${want}"`);
assert.equal(city("Calgary, AB / Edmonton, AB"), "CGY,EDM", "a posting that names two cities is in both");

// --- the world: every country has a path, Canada is there, and its label and leader line are inside the picture
const W = G.world;
assert.ok(W.countries.length > 150 && W.countries.every((c) => c.a && c.n && c.d.startsWith("M")), "the world has more than 150 countries, each with a name and a path");
assert.ok(W.countries.some((c) => c.a === "CAN"), "Canada is in the world");
assert.ok(!W.countries.some((c) => c.a === "ATA"), "Antarctica is left out so the rest has room");
assert.equal(W.label.CAN.length, 4);
assert.ok(W.label.CAN.every((v, i) => v > 0 && v < (i % 2 ? W.h : W.w)), "the Canada label and its leader line are inside the picture");

// --- class names of the map are its own: .chips and .seg already style other things in index.html
assert.ok(!/\.chips[ {,.:\[>]/.test(read("docs/pages.css").replace(/\.citychips/g, "")), "pages.css does not restyle .chips, which All jobs uses for its window buttons");
assert.ok(!/class="[^"]*\bchips\b/.test(js) && !/class="[^"]*\bseg\b/.test(js), "pages.js does not use the class names chips or seg");
// --- the switch: the tiles stay the default, the choice is remembered, and the other two are alternatives to them
assert.ok(/view: \(\(v\) => \(v === "canada" \|\| v === "world" \? v : "tiles"\)\)\(store\.get\("pm_mapview", "tiles"\)\)/.test(js), "the view defaults to tiles and only accepts canada or world");
assert.ok(js.includes('store.set("pm_mapview", v)'), "the chosen view is remembered");
assert.ok(js.includes('role="group" aria-label="Map view"'), "the switch is a labelled group of buttons");
for (const v of ["tiles", "canada", "world"]) assert.ok(js.includes(`["${v}", `), `the switch has "${v}"`);
assert.ok(js.includes('class="tiles"') && js.includes("TILES.map(([c]) => tile(c, c))"), "the tile map is still there");
// a map is not a trap for the keyboard or a screen reader: every shape can be reached and pressed, and the cities have a list beside them
assert.ok(/tabindex="0" role="button" aria-pressed/.test(js) && js.includes('e.key === "Enter" || e.key === " "'), "provinces and cities take Tab, Enter and Space");
assert.ok(js.includes('class="citychips" role="group" aria-label="City areas"'), "the city areas are also a list of buttons");
assert.ok(js.includes("aria-live=\"polite\">Hover, or tab through"), "the reading under the map is a live region");

console.log("geo tests passed (" + Object.keys(C.provinces).length + " provinces, " + names.length + " cities, " + W.countries.length + " countries)");
