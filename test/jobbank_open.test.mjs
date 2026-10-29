/* Job Bank open data (scripts/jobbank_open.mjs): offline, with a two-posting file */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as O from "../scripts/jobbank_open.mjs";

const EN_HEAD = ["WIC Job Location Snapshot ID", "Job Title", "Original Job Title", "NOC21 Code", "NOC21 Code Name", "First Posting Date", "Vacancy Count",
  "Official Language", "Education LOS", "Experience Level", "Province/Territory", "City", "Employment Type", "Employment Term", "Salary Per", "Salary Minimum", "Salary Maximum", "Hours Per", "Hours Minimum", "Hours Maximum"];
const en = [EN_HEAD,
  ["101", "supermarket butcher", "Butcher \"A\"", "63201", "Butchers", "2026/09/03", "2", "English or French", "Secondary (high) school graduation certificate", "No experience", "Québec", "Laval", "Full time", "Permanent employment", "Hour", "20", "24", "Week", "40", "40"],
  ["102", "cook", "NA", "63200", "Cooks", "2026/09/20", "1", "*No data", "NA", "NA", "Ontario", "Toronto", "Part time", "NA", "Year", "40000", "NA", "NA", "NA", "NA"],
  ["103", "manager", "Boss", "NA", "NA", "2026/09/21", "1", "English", "", "", "Ontario", "Toronto", "Full time", "", "", "", "", "", "", ""]];
const fr = [["ID WIC Lieu emploi", "Appellation d'emploi"], ["101", "boucher/bouchère de supermarché"], ["102", "cuisinier/cuisinière"]];
const utf16 = (rows) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(rows.map((r) => r.map((x) => (x.includes('"') ? '"' + x.replace(/"/g, '""') + '"' : x)).join("\t")).join("\r\n") + "\r\n", "utf16le")]);

const enRows = O.parseTsv(O.decodeUtf16(utf16(en))), frRows = O.parseTsv(O.decodeUtf16(utf16(fr)));
assert.equal(enRows.length, 3);
assert.equal(enRows[0]["Original Job Title"], 'Butcher "A"', "quoted fields keep their quotes");

const data = O.fromRows(enRows, frRows);
assert.equal(data.noNoc, 1, "a posting without a NOC code is left out");
const [a, b] = data.rows.map((x) => x.r);
assert.deepEqual([data.rows[0].noc, a.t, a.s, a.f, a.c, a.p, a.d, a.v, a.l, a.e, a.ty], ["63201", 'Butcher "A"', "supermarket butcher", "boucher/bouchère de supermarché", "Laval", "QC", "2026-09-03", 2, "English or French", 2, "Full-time"]);
assert.deepEqual(a.pay, [41600, 49920], "hourly pay x 40 hours x 52 weeks");
assert.ok(!b.s && b.t === "cook" && !b.l && !b.x && b.ty === "Part-time" && b.pay[0] === 40000, "NA and *No data are empty");

assert.equal(O.yearly(20, "Hour"), 39000, "37.5 hours a week when the posting does not say");
assert.equal(O.yearly(5000, "Month"), 60000);
assert.deepEqual(["Bachelor's degree", "College/CEGEP", "No degree, certificate or diploma", "Earned doctorate degree", ""].map(O.educationLevel), [4, 3, 1, 6, 0]);

// the catalogue: the newest month with both files
const cat = { result: { resources: [
  { name: "August 2026 Job Postings Advertised on Canada's National Job Bank Website", url: "https://x/job-bank-open-data-all-job-postings-en-aug2026.csv" },
  { name: "August 2026 Job Postings Advertised on Canada's National Job Bank Website", url: "https://x/job-bank-open-data-all-job-postings-fr-aout2026.csv" },
  { name: "September 2026 Job Postings Advertised on Canada's National Job Bank Website", url: "https://x/job-bank-open-data-all-job-postings-en-sept2026.csv" }] } };
assert.equal(O.newestMonth(cat).month, "2026-08", "September has no French file yet");

// the files: one per occupation, an index, the postings also collected elsewhere left out
const root = fs.mkdtempSync(path.join(os.tmpdir(), "jbod-"));
const occupation = (noc) => ({ "63201": { code: "63201.00", en: "Butchers", fr: "Bouchers", kw: { en: ["Kt|cut meat"], fr: ["Kt|couper la viande"] } } })[noc] || null;
const rep = O.write({ month: "2026-09", label: "September 2026", ...data }, { root, occupation, titleKw: (t) => ["Tt|" + t.toLowerCase()], log: () => {}, seen: new Set([O.sameKey("cook", "Toronto", "ON", "2026-09-20")]) });
assert.deepEqual([rep.kept, rep.alsoCollectedElsewhere, rep.occupations], [1, 1, 1]);
const idx = O.readIndex(O.OUT_DIR(root));
assert.deepEqual([idx.month, idx.total, idx.nocs["63201"].n, idx.nocs["63201"].code, idx.nocs["63201"].prov.QC], ["2026-09", 1, 1, "63201.00", 1]);
const all = JSON.parse(fs.readFileSync(path.join(O.OUT_DIR(root), O.POSTINGS), "utf8"));
assert.deepEqual(Object.keys(all), ["63201"]);
assert.equal(all["63201"][0].i, "101");
assert.deepEqual(all["63201"][0].k, ['Tt|butcher "a"'], "the keywords of the title are saved with the posting");
// the same month is not downloaded again
const fetchFn = async () => ({ json: async () => ({ result: { resources: [
  { name: "September 2026 Job Postings Advertised", url: "https://x/a-en-sept2026.csv" }, { name: "September 2026 Job Postings Advertised", url: "https://x/a-fr-sept2026.csv" }] } }) });
assert.ok((await O.download({}, { root, fetchFn, log: () => {} })).skipped);
fs.rmSync(root, { recursive: true, force: true });
console.log("job bank open data tests passed");
