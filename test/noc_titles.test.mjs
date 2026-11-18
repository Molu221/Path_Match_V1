/* noc_titles.test.mjs - job title -> occupation, measured, plus the monthly library updates (titles, wages, outlooks).
 * Run: node test/noc_titles.test.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as nl from "../docs/noc/noc_library.js";
import { measure } from "../tools/noc_accuracy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (what, cond, got) => {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (got !== undefined ? "   got: " + JSON.stringify(got) : "")); }
};
const lib = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "noc", "noc_library.lite.json"), "utf8"));
const noc = (t) => nl.nocForTitle(lib, t).noc;

/* ---------- the 100 titles checked by hand ---------- */
const rows = JSON.parse(fs.readFileSync(path.join(ROOT, "test", "fixtures", "noc_titles_100.json"), "utf8")).titles;
const { by } = measure(lib, rows);
ok(`at least 80 of the 100 hand-checked titles get the right occupation (${by.all.right})`, by.all.right >= 80, by.all);
ok(`no more than 6 get a wrong one (${by.all.wrong})`, by.all.wrong <= 6, by.all);
ok(`Job Bank titles: at least 46 of 50 (${by["Job Bank"].right})`, by["Job Bank"].right >= 46);
ok(`titles of the other sites: at least 33 of 50, up from 19 (${by["other sites"].right})`, by["other sites"].right >= 33);

/* ---------- cleaning ---------- */
ok("a title found before keeps its occupation: driver, school bus", noc("driver, school bus") === "73301" || noc("driver, school bus") === nl.nocForTitle(lib, "school bus driver").noc);
ok("level and contract words go: Retail part time Cashier -> cashier", noc("Retail part time Cashier") === "65100");
ok("the employer and place after a dash go", noc("Senior Business Analyst - Health Insurance (Fully Remote)") === "21221");
ok("// separates two languages of one title", noc("Ingénieur(e) de production // Senior Manufacturing Engineer") === "21321");
ok("short forms are spelled out: ECG technician", noc("Electrocardiogram (ECG / EKG) Technician - Entry Level Training Program") === "32123");
ok("a tail such as 'position in Vancouver' goes", noc("Financial Controller Position in Vancouver Hotel Company") === "10010");
ok("a qualifier after a comma never stands in for the job: assistant manager, fast food", noc("assistant manager, fast food") !== "95106");
ok("a general word alone names nothing: crate builder, wood", !noc("crate builder, wood") || noc("crate builder, wood") !== "70011");
ok("a vague title still gives no occupation", nl.nocForTitle(lib, "intern").how === "none" && nl.nocForTitle(lib, "Engineer").how === "none");
ok("a cleaned title says so", nl.nocForTitle(lib, "Retail part time Cashier").how === "cleaned title");

/* ---------- monthly title update (Python, no packages) ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "noc-"));
fs.mkdirSync(path.join(tmp, "noc")); fs.mkdirSync(path.join(tmp, "jobs", "noc"), { recursive: true });
const small = { meta: { counts: { titles_from_job_bank: 1, titles_index: 1 }, built_from: "OaSIS" }, rules: {},
  nocs: { "13201": { noc: "13201", profiles: ["13201.01", "13201.02"], languages_in_postings: { English: 1 } } },
  profiles: {}, title_index: { "logistics coordinator": ["13201.01"] }, keyword_index: {}, translations: {} };
fs.writeFileSync(path.join(tmp, "noc", "noc_library.lite.json"), JSON.stringify(small));
fs.writeFileSync(path.join(tmp, "jobs", "noc", "postings.json"), JSON.stringify({ "13201": [
  { s: "production coordinator", f: "coordonnateur/coordonnatrice de la production" }, { s: "logistics coordinator", f: "" }], "99999": [{ s: "ghost job" }] }));
fs.writeFileSync(path.join(tmp, "jobs", "noc", "index.json"), JSON.stringify({ month: "2026-10", label: "October 2026", nocs: { "13201": { lang: { English: 47, "not stated": 34, French: 13 } } } }));
execFileSync("python3", [path.join(ROOT, "noc_library", "update_titles.py"), tmp]);
const up = JSON.parse(fs.readFileSync(path.join(tmp, "noc", "noc_library.lite.json"), "utf8"));
ok("the month's official titles are added to their occupation", JSON.stringify(up.title_index["production coordinator"]) === '["13201.01"]');
ok("a French title with two forms is stored in both", !!up.title_index["coordonnateur de la production"] && !!up.title_index["coordonnatrice de la production"], Object.keys(up.title_index));
ok("an occupation the library does not have adds nothing", !up.title_index["ghost job"]);
ok("languages are replaced by the newest month", up.nocs["13201"].languages_in_postings["*No data"] === 34 && up.nocs["13201"].languages_in_postings.English === 47);
ok("the library says which month it has", up.meta.job_bank_month === "2026-10" && /October 2026/.test(up.meta.built_from));
const again = execFileSync("python3", [path.join(ROOT, "noc_library", "update_titles.py"), tmp]).toString();
ok("running it twice in a month changes nothing", /already has/.test(again), again);

/* ---------- wages and outlooks ---------- */
const out = path.join(tmp, "market.json");
try { execFileSync("python3", [path.join(ROOT, "noc_library", "market.py"), "--wages", path.join(ROOT, "test/fixtures/market/wages_sample.csv"), "--outlook", path.join(ROOT, "test/fixtures/market/outlook_sample.csv"), "--out", out], { stdio: "pipe" }); }
catch { /* the sample has fewer than 100 occupations, so the script warns; the file is still written */ }
const m = JSON.parse(fs.readFileSync(out, "utf8"));
ok("the national wage row is kept as Canada", m.nocs["21232"].wage.CA.median === 45);
ok("a province-wide row is kept as the province", m.nocs["21232"].wage.QC.median === 42);
ok("a province with only regional rows gets the middle of its regions", m.nocs["21232"].wage.ON.median === 47 && m.nocs["21232"].wage.ON.fromRegions === 2);
ok("an annual wage is marked per year", m.nocs["00010"].wage.CA.per === "year");
ok("a province's outlook is the most common among its regions", m.nocs["21232"].outlook.QC === "Good" && m.nocs["21232"].outlookRegions.QC.Moderate === 1);
const mk = nl.marketOf(m, "21232.00", "ON");
ok("marketOf gives the wage and outlook of a province", mk.wage.median === 47 && mk.outlook === "Fair");
ok("...and falls back to Canada for a province with no wage row", nl.marketOf(m, "21232", "BC").wage.median === 45 && nl.marketOf(m, "21232", "BC").where === "CA");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
