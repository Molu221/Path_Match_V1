// Checks of the start page's numbers: scripts/cover-stats.mjs counts them once a day into docs/stats.json, and the page reads that file
// (docs/index.html, docs/pages.js) when it describes the postings now loaded. Run: node test/cover-stats.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { coverStats } from "../scripts/cover-stats.mjs";
import { loadJobMeta } from "../scripts/umd.mjs";

const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
const meta = loadJobMeta();

// --- the counting, on a small made-up set
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cover-"));
const jobsFile = path.join(dir, "jobs.json");
fs.writeFileSync(jobsFile, JSON.stringify({
  updatedAt: "2026-01-02T03:04:05.000Z",
  jobs: [
    { title: "Industrial Engineering Intern", company: "Acme", province: "QC", lv: [0] },
    { title: "Industrial Engineering Intern", company: "ACME ", province: "QC", lv: [0] },        // the same posting again: counted once
    { title: "Industrial Engineering Intern", company: "Acme", province: "ON", lv: [0] },        // another province: another posting
    { title: "Registered Nurse", company: "Clinic", province: "BC", lv: [2] },
    { title: "Welder", company: "Shop", loc: "Montréal, QC", lv: [2] },                            // no province field: Montréal's area is Quebec
    { title: "Welder", company: "Shop", loc: "Elsewhere", lv: [2] }                               // a province nobody knows is not counted as one
  ]
}));
const noOpen = coverStats({ jobsFile, openDir: path.join(dir, "none"), meta });
assert.equal(noOpen.updatedAt, "2026-01-02T03:04:05.000Z", "the numbers carry the time of the postings they describe");
assert.equal(noOpen.total, 5, "one duplicate is not counted");
assert.equal(noOpen.collected, 5);
assert.equal(noOpen.open, 0, "with no open data the numbers are those of jobs.json alone");
assert.equal(noOpen.students, 3, "postings at the student level (0) are counted");
assert.equal(noOpen.provinces, 3, "QC, ON and BC; a posting with no province adds none");
assert.equal(noOpen.fields, new Set(["Industrial Engineering Intern", "Registered Nurse", "Welder"].map((t) => meta.fieldOf(t).id)).size, "the fields are those the page gives the titles");

// --- with open data: only postings of a known occupation count, and the level comes from what the posting asks for
const open = path.join(dir, "noc");
fs.mkdirSync(open);
fs.writeFileSync(path.join(open, "index.json"), JSON.stringify({ label: "October 2026", nocs: { "21332": { code: "21332" }, "00000": {} } }));
fs.writeFileSync(path.join(open, "postings.json"), JSON.stringify({
  "21332": [{ t: "Chemical Engineering Intern", p: "AB", x: "", e: "", ty: "" }, { t: "Process Engineer", p: "NS", x: "", e: "", ty: "" }],
  "00000": [{ t: "Unknown occupation", p: "YT", x: "", e: "", ty: "" }]
}));
const withOpen = coverStats({ jobsFile, openDir: open, meta });
assert.equal(withOpen.open, 2, "the two postings of the known occupation are added, the third is not");
assert.equal(withOpen.total, withOpen.collected + withOpen.open);
assert.equal(withOpen.openLabel, "October 2026");
assert.equal(withOpen.provinces, 5, "AB and NS are added; YT is not, its occupation is unknown");
fs.rmSync(dir, { recursive: true, force: true });

// --- the published file is the one the workflow makes: the same time as the postings, and the parts add up
const s = JSON.parse(read("docs/stats.json")), jobs = JSON.parse(read("docs/jobs.json"));
assert.equal(s.updatedAt, jobs.updatedAt, "docs/stats.json describes the docs/jobs.json that is published with it (run: node scripts/cover-stats.mjs)");
for (const k of ["total", "collected", "open", "fields", "provinces", "students"]) assert.ok(Number.isInteger(s[k]) && s[k] >= 0, k + " is a count");
assert.equal(s.total, s.collected + s.open, "total = collected + open data");
assert.ok(s.students <= s.total && s.provinces <= 13 && s.fields <= 40, "the numbers are possible");
assert.ok(s.total > 0 && s.fields > 1 && s.provinces > 1, "the numbers are not empty");
assert.ok(read("docs/stats.json").length < 400, "the file stays tiny");

// --- the wiring
const html = read("docs/index.html"), js = read("docs/pages.js"), wf = read(".github/workflows/refresh.yml");
assert.ok(wf.includes("node scripts/cover-stats.mjs"), "the daily workflow counts the numbers");
assert.ok(wf.indexOf("node scripts/cover-stats.mjs") > wf.indexOf("node scripts/collect.mjs"), "...after the collector has run");
assert.ok(/git add [^\n]*docs\/stats\.json/.test(wf), "...and publishes docs/stats.json with the postings");
assert.ok(html.includes('fetch("stats.json"'), "the page reads docs/stats.json");
assert.ok(/COVER\.updatedAt===DATA_V/.test(html), "it uses those numbers only when they describe the postings loaded (otherwise it counts for itself)");
assert.ok(/function heroStat\(\)\{\s*const el=\$\("herostat"\),c=coverNow\(\);/.test(html), "the line under the search box and the Browse button read those numbers");
assert.ok(!html.includes("bigstats") && !/\.bs\b/.test(read("docs/pages.css")) && !js.includes("bigStats"), "the four number cards are gone from the cover");
assert.ok(html.includes('class="hometrail"') && js.includes("function stagePreview"), "the climb trail and its stage preview stay");
// --- the colours: the cover and the top bar are light by default (near-white, navy ink, one orange accent), the dark theme keeps its spruce palette,
// and the two surfaces that are dark in both themes (the stage card, the compare tray) pin that palette on themselves
const css = read("docs/pages.css");
const lumOf = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lumOf(a), lumOf(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const root = html.match(/:root\{--bg[\s\S]*?\n--f-disp/)[0];
const tok = (src, name) => (src.match(new RegExp("--" + name + ":(#[0-9a-f]{6})")) || [])[1];
assert.ok(lumOf(tok(root, "hero")) > .9, "the cover's background is near-white in the light theme");
assert.ok(ratio(tok(root, "hero"), tok(root, "hero-ink")) >= 12, "navy ink on it reads strongly");
assert.ok(ratio(tok(root, "hero"), tok(root, "hero-mute")) >= 4.5, "the muted ink on it passes 4.5:1");
const pinned = html.match(/\.stagecard,#cmptray\{([^}]*)\}/);
assert.ok(pinned && /--hero:#0e2c2b/.test(pinned[1]) && /--hero-rgb:234 246 243/.test(pinned[1]), "the stage card and the compare tray keep the dark palette");
assert.equal((html.match(/:root\[data-theme="dark"\]\{--hero:#0e2c2b/g) || []).length, 1, "the dark theme sets the spruce palette back");
assert.ok(/@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{--hero:#0e2c2b/.test(html), "...also when the device asks for dark");
assert.ok(!/rgba\(234,246,243,/.test(html) && !/rgba\(234,246,243,/.test(css), "no fixed light-on-dark colour is left outside the tokens");
assert.ok(/--contours:none;/.test(root), "the light cover has no contour lines behind it");
assert.ok(/--contours:url\(contours\.svg\)/.test(pinned[1]), "the dark surfaces keep theirs");
assert.ok(!fs.existsSync(new URL("../docs/contours-light.svg", import.meta.url)), "no unused light contour file is left");
assert.ok(css.includes("--aurora:radial-gradient(38% 50% at 88% 14%,rgb(255 107 44"), "the light cover has one soft orange wash");
console.log("cover-stats tests passed");
