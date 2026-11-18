/* noc_accuracy.mjs - how often does the library give the right occupation for a job title?
 * Reads test/fixtures/noc_titles_100.json (100 titles labelled by hand) and prints the share right, wrong and not found,
 * for Job Bank titles and for the titles of the other sites.
 * Usage: node tools/noc_accuracy.mjs [--fn nocForTitle|nocForJob] [--show]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as nl from "../docs/noc/noc_library.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function measure(lib, rows, fn = (t) => nl.nocForTitle(lib, t)) {
  const by = {};
  const detail = [];
  for (const r of rows) {
    const g = fn(r.title, r);
    const got = g && g.noc ? g.noc : "none";
    const verdict = r.accept.includes(got) ? "right" : got === "none" ? "not found" : "wrong";
    for (const k of ["all", r.source]) { by[k] = by[k] || { n: 0, right: 0, wrong: 0, "not found": 0 }; by[k].n++; by[k][verdict]++; }
    detail.push({ title: r.title, got, how: g && g.how, accept: r.accept, verdict });
  }
  return { by, detail };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lib = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "noc", "noc_library.lite.json"), "utf8"));
  const rows = JSON.parse(fs.readFileSync(path.join(ROOT, "test", "fixtures", "noc_titles_100.json"), "utf8")).titles;
  const fnName = process.argv.includes("--fn") ? process.argv[process.argv.indexOf("--fn") + 1] : "nocForTitle";
  const { by, detail } = measure(lib, rows, (t) => nl[fnName](lib, t));
  for (const [k, v] of Object.entries(by)) console.log(`${k.padEnd(12)} right ${v.right}/${v.n}  wrong ${v.wrong}  not found ${v["not found"]}`);
  if (process.argv.includes("--show")) for (const d of detail.filter((x) => x.verdict !== "right")) console.log(`  ${d.verdict.padEnd(9)} ${d.title}  -> ${d.got} (${d.how})  want ${d.accept.join("/")}`);
}
