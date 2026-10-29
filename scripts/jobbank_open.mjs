/* Job Bank open data: every posting first published on Job Bank in the newest month, all of Canada (about 50,000).

   Source: https://open.canada.ca/data/en/dataset/ea639e28-c0fc-48bf-b5dd-b8899bd43072 (Employment and Social Development
   Canada, Open Government Licence - Canada). One file per month, in English and in French, published a few days after
   the month ends. This is the allowed way to get Job Bank's postings in bulk (its website forbids scripts).

   The files have no employer name, no description and no posting link, but every posting has its official occupation
   (NOC 2021 code), its place, date, pay, and the language, education and experience it asks for. So the postings are
   grouped by occupation: docs/jobs/noc/<noc>.json holds the postings of one occupation, and docs/jobs/noc/index.json lists
   the occupations (name, number of postings, provinces, pay, languages and the keywords of the occupation's official
   description). The page compares a CV with the occupations first, then loads only the files of the closest ones.

   The files change once a month: a run only downloads them when the catalogue has a newer month than index.json. */
import fs from "node:fs";
import path from "node:path";

export const DATASET = "ea639e28-c0fc-48bf-b5dd-b8899bd43072";
const CATALOGUE = (id) => `https://open.canada.ca/data/api/action/package_show?id=${id}`;

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const PROV = { alberta: "AB", "british columbia": "BC", manitoba: "MB", "new brunswick": "NB", "newfoundland and labrador": "NL",
  "nova scotia": "NS", "northwest territories": "NT", nunavut: "NU", ontario: "ON", "prince edward island": "PE", quebec: "QC",
  saskatchewan: "SK", yukon: "YT" };
const fold = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const key = (s) => fold(s).replace(/[^a-z0-9]+/g, " ").trim();

/* ---------- the catalogue: the newest month that has both an English and a French file ---------- */
export function newestMonth(catalogue) {
  const res = ((catalogue && catalogue.result && catalogue.result.resources) || []).filter((r) => /\.csv$/i.test(r.url || ""));
  const months = new Map();
  for (const r of res) {
    const m = /^(\w+) (\d{4}) job postings/i.exec(r.name && (r.name.en || r.name) || "");
    if (!m) continue;
    const mi = MONTHS.indexOf(m[1].toLowerCase());
    if (mi < 0) continue;
    const id = `${m[2]}-${String(mi + 1).padStart(2, "0")}`;
    const lang = /-fr-/i.test(r.url) ? "fr" : /-en-/i.test(r.url) ? "en" : null;
    if (!lang) continue;
    if (!months.has(id)) months.set(id, { month: id, label: `${m[1]} ${m[2]}` });
    months.get(id)[lang] = r.url;
  }
  return [...months.values()].filter((x) => x.en && x.fr).sort((a, b) => (a.month < b.month ? 1 : -1))[0] || null;
}

/* ---------- the files: UTF-16, tab-separated, a header row; a field may be in double quotes ---------- */
export function decodeUtf16(buf) {
  const b = Buffer.from(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
  return new TextDecoder("utf-16le").decode(b);
}
export function parseTsv(text) {
  const rows = [];
  let row = [], f = "", i = 0, q = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
      f += c; i++; continue;
    }
    if (c === '"' && f === "") { q = true; i++; continue; }
    if (c === "\t") { row.push(f); f = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; i++; continue; }
    f += c; i++;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, k) => [h.trim(), (r[k] ?? "").trim()])));
}

/* ---------- one posting, tidied ---------- */
const PER_YEAR = { year: 1, month: 12, "bi-weekly": 26, week: 52, day: 260 };
/* the pay as a yearly amount: hourly pay x the weekly hours of the posting (37.5 when not given) x 52 */
export function yearly(amount, per, hoursPerWeek) {
  const a = parseFloat(amount);
  if (!(a > 0)) return null;
  const p = fold(per);
  if (p === "hour") return Math.round(a * (hoursPerWeek > 0 && hoursPerWeek <= 80 ? hoursPerWeek : 37.5) * 52);
  return PER_YEAR[p] ? Math.round(a * PER_YEAR[p]) : null;
}
/* education asked: 1 none, 2 high school, 3 college / trade, 4 bachelor's, 5 master's or medicine, 6 doctorate (same levels as docs/noc) */
export function educationLevel(t) {
  const s = fold(t);
  if (!s) return 0;
  if (/doctorate/.test(s)) return 6;
  if (/master|medicine|dentistry|veterinary|optometry/.test(s)) return 5;
  if (/bachelor|university/.test(s)) return 4;
  if (/no degree/.test(s)) return 1;
  if (/secondary|high school/.test(s)) return 2;
  if (/college|cegep|trades|apprenticeship|certificate|diploma/.test(s)) return 3;
  return 0;
}
const LANG = { english: "English", french: "French", "english or french": "English or French", bilingual: "Bilingual" };
export const jobBankSearchUrl = (title, city, prov) =>
  "https://www.jobbank.gc.ca/jobsearch/jobsearch?" + new URLSearchParams({ searchstring: title, locationstring: [city, prov].filter(Boolean).join(", ") }).toString();

/* English row (+ the French row with the same "WIC Job Location Snapshot ID") -> the compact record the page reads.
   Empty fields are written "NA" or "*No data" in the files. */
const EMPTY = /^(na|n\/a|\*?no data|nan|null)?$/i;
const clean = (row) => row && Object.fromEntries(Object.entries(row).map(([k, v]) => [k, EMPTY.test(String(v).trim()) ? "" : v]));
export function tidy(en, fr) {
  en = clean(en); fr = clean(fr);
  const prov = PROV[fold(en["Province/Territory"])] || "";
  const city = en["City"] || "";
  const date = (en["First Posting Date"] || "").replace(/\//g, "-");
  const hours = fold(en["Hours Per"]) === "week" ? parseFloat(en["Hours Maximum"] || en["Hours Minimum"]) : NaN;
  const lo = yearly(en["Salary Minimum"], en["Salary Per"], hours), hi = yearly(en["Salary Maximum"], en["Salary Per"], hours);
  const r = {
    i: en["WIC Job Location Snapshot ID"],
    t: en["Original Job Title"] || en["Job Title"],      // the employer's own title
    c: city, p: prov, d: date,
  };
  if (key(en["Job Title"]) !== key(r.t)) r.s = en["Job Title"];   // the standard Job Bank title, when it differs
  if (fr) { const f = fr["Appellation d'emploi"]; if (f) r.f = f; }
  const v = parseInt(en["Vacancy Count"], 10); if (v > 1) r.v = v;
  const l = LANG[fold(en["Official Language"])]; if (l) r.l = l;
  const e = educationLevel(en["Education LOS"]); if (e) r.e = e;
  if (en["Experience Level"]) r.x = en["Experience Level"];
  const ty = fold(en["Employment Type"]); if (ty) r.ty = ty.startsWith("part") ? "Part-time" : "Full-time";
  if (en["Employment Term"]) r.tm = en["Employment Term"];
  if (lo || hi) r.pay = [lo || hi, hi || lo];
  return r;
}

/* ---------- the run ---------- */
export const OUT_DIR = (root) => path.join(root, "docs", "jobs", "noc");
export function readIndex(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")); } catch { return null; } }

/* Downloads the newest month (when it is newer than the one on disk) and returns its postings, tidied:
   { month, label, rows: [{noc, record}], noNoc } or { skipped: reason }. */
export async function download(cfg, { root, log = console.log, fetchFn = fetch, force = false } = {}) {
  const cat = await (await fetchFn(CATALOGUE(cfg.dataset || DATASET), { signal: AbortSignal.timeout(30000) })).json();
  const m = newestMonth(cat);
  if (!m) throw new Error("no month with both an English and a French file in the catalogue");
  const old = readIndex(OUT_DIR(root));
  if (!force && old && old.month === m.month) return { skipped: `${m.label} is already on disk`, month: m.month, label: m.label };
  log(`Job Bank open data: downloading ${m.label} (English and French)`);
  const get = async (u) => decodeUtf16(await (await fetchFn(u, { signal: AbortSignal.timeout(300000) })).arrayBuffer());
  const [en, fr] = [parseTsv(await get(m.en)), parseTsv(await get(m.fr))];
  return { month: m.month, label: m.label, ...fromRows(en, fr) };
}
export function fromRows(en, fr) {
  const frById = new Map(fr.map((x) => [x["ID WIC Lieu emploi"], x]));
  const rows = [];
  let noNoc = 0;
  for (const x of en) {
    const noc = String(x["NOC21 Code"] || "").replace(/\.0$/, "").padStart(5, "0");
    if (!/^\d{5}$/.test(noc) || noc === "00000") { noNoc++; continue; }
    rows.push({ noc, r: tidy(x, frById.get(x["WIC Job Location Snapshot ID"])) });
  }
  return { rows, noNoc, total: en.length };
}

/* the same posting already collected from the Job Bank feed or an employer board: same title, city, province and day */
export const sameKey = (title, city, prov, date) => [key(title), key(city), prov, date].join("|");

/* Writes docs/jobs/noc/<noc>.json and index.json. `occupation(noc)` gives {code, en, fr, kw: {en, fr}} from docs/noc;
   `seen` holds sameKey() of the postings collected elsewhere (they are left out: the other copy has the employer and a link). */
export function write(data, { root, occupation, seen = new Set(), log = console.log, profileV = "" }) {
  const dir = OUT_DIR(root);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const by = new Map();
  let dup = 0, unknown = 0;
  for (const { noc, r } of data.rows) {
    if (seen.has(sameKey(r.s || r.t, r.c, r.p, r.d)) || seen.has(sameKey(r.t, r.c, r.p, r.d))) { dup++; continue; }
    if (!by.has(noc)) by.set(noc, []);
    by.get(noc).push(r);
  }
  const index = { month: data.month, label: data.label, updatedAt: new Date().toISOString(), profileV, total: 0, nocs: {},
    source: "Job Bank open data (ESDC), Open Government Licence - Canada" };
  const provinces = {};
  for (const [noc, list] of [...by.entries()].sort()) {
    const o = occupation(noc);
    if (!o) unknown += list.length;
    list.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.i < b.i ? -1 : 1));   // newest first
    fs.writeFileSync(path.join(dir, noc + ".json"), JSON.stringify(list));
    const prov = {}, lang = {}, pays = [];
    for (const r of list) {
      prov[r.p || "?"] = (prov[r.p || "?"] || 0) + 1; provinces[r.p || "?"] = (provinces[r.p || "?"] || 0) + 1;
      lang[r.l || "not stated"] = (lang[r.l || "not stated"] || 0) + 1;
      if (r.pay) pays.push((r.pay[0] + r.pay[1]) / 2);
    }
    pays.sort((a, b) => a - b);
    const q = (f) => (pays.length ? Math.round(pays[Math.floor(f * (pays.length - 1))] / 100) * 100 : null);
    index.nocs[noc] = { n: list.length, code: o ? o.code : null, en: o ? o.en : null, fr: o ? o.fr : null, prov, lang,
      ...(pays.length ? { pay: [q(0.25), q(0.5), q(0.75)] } : {}), ...(o ? { kw: o.kw } : {}) };
    index.total += list.length;
  }
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index));
  const report = { month: data.label, inFile: data.total, kept: index.total, occupations: by.size, noNocCode: data.noNoc,
    alsoCollectedElsewhere: dup, notInLibrary: unknown, provinces };
  log(`Job Bank open data (${data.label}): ${data.total} postings in the file, ${index.total} kept in ${by.size} occupations; ` +
    `${data.noNoc} without a NOC code, ${dup} already collected from another source, ${unknown} in an occupation the NOC library does not know.`);
  return report;
}
/* the occupation keywords only (same month, but the dictionary, the keyword engine or the NOC library changed) */
export function refreshKeywords(root, occupation, profileV) {
  const dir = OUT_DIR(root), idx = readIndex(dir);
  if (!idx) return false;
  for (const [noc, x] of Object.entries(idx.nocs)) { const o = occupation(noc); if (o) { x.kw = o.kw; x.code = o.code; x.en = o.en; x.fr = o.fr; } }
  idx.profileV = profileV;
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(idx));
  return true;
}
