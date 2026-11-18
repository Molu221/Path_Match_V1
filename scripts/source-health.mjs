/* source-health.mjs - after each refresh: is every source still working, and is the data still good?
 *
 * Compares the jobs.json just collected with the one of the previous refresh and writes
 *   reports/source_health.md    one table a person can read on GitHub
 *   reports/source_health.json  the same, for scripts
 * and prints the alerts. In GitHub Actions it also sets the step output `alert=1` when something needs a person, so the
 * workflow opens (or comments on) an issue labelled "data-alert" and everyone watching the repository gets an email.
 *
 * Why: from Nov 7 to Nov 10, 2026 the refresh failed four days in a row and nobody knew; The Muse has answered nothing
 * since Nov 11; two Workday sites refused every request for three weeks. Each was only found by reading the logs by hand.
 *
 * Usage: node scripts/source-health.mjs [previous jobs.json] [current jobs.json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 864e5;

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const jobsOf = (s) => (s && typeof s === "object" ? (s.jobs ?? s.collected ?? null) : null);
const failedOf = (s) => (s && typeof s === "object" ? (s.failed ?? s.requestsFailed ?? 0) : 0);

/* one source: working, partly (some boards or requests failed), broken (nothing came back), off (switched off or no key) */
export function statusOf(s) {
  if (!s || typeof s !== "object") return "unknown";
  if (s.skipped) return "off";
  const jobs = jobsOf(s) || 0, failed = failedOf(s);
  if (s.error && !jobs) return "broken";
  if (!jobs && (failed || s.requestsOk === 0)) return "broken";
  if (failed || s.error || s.stoppedEarly) return "partly";
  return "working";
}

export function health(prev, cur, now = Date.now()) {
  const rows = [], alerts = [];
  const names = [...new Set([...Object.keys(cur.sources || {}), ...Object.keys((prev && prev.sources) || {})])];
  const bySrc = new Map();
  for (const j of cur.jobs || []) { const k = (j.sources && j.sources[0] && j.sources[0].src) || "?"; if (!bySrc.has(k)) bySrc.set(k, []); bySrc.get(k).push(j); }
  const ageDays = (j) => { const t = Date.parse(j.date); return Number.isFinite(t) ? (now - t) / DAY : null; };
  for (const name of names) {
    const s = (cur.sources || {})[name], p = prev && prev.sources ? prev.sources[name] : undefined;
    const st = statusOf(s), jobs = jobsOf(s), before = jobsOf(p);
    const onSite = bySrc.get(name.replace(/ jobs$/, "")) || [];
    const ages = onSite.map(ageDays).filter((a) => a != null);
    const row = {
      source: name, status: st, jobs, before, change: jobs != null && before != null ? jobs - before : null, failed: failedOf(s), error: (s && s.error) || (s && s.skipped) || "",
      onSite: /open data/i.test(name) ? null : onSite.length, old90: ages.length ? Math.round((100 * ages.filter((a) => a > 90).length) / ages.length) : null,
      medianText: onSite.length ? median(onSite.map((j) => j.dl || 0)) : null,
    };
    rows.push(row);
    const wasUp = before != null && before >= 20;
    if (st === "broken" && wasUp) alerts.push(`${name} brought nothing this time (${before} postings the run before)${row.error ? ": " + row.error : ""}.`);
    else if (st === "broken" && !(p && statusOf(p) === "broken")) alerts.push(`${name} is not answering${row.error ? ": " + row.error : ""}.`);
    else if (wasUp && jobs != null && jobs < before * 0.5) alerts.push(`${name} fell from ${before} to ${jobs} postings.`);
  }
  const total = (cur.jobs || []).length, totalBefore = prev && prev.jobs ? prev.jobs.length : null;
  if (totalBefore && total < totalBefore * 0.7) alerts.push(`The daily feed fell from ${totalBefore} to ${total} postings.`);
  const ages = (cur.jobs || []).map(ageDays).filter((a) => a != null);
  const summary = {
    updatedAt: cur.updatedAt, total, totalBefore, boilerplate: cur.boilerplate || null,
    old90: ages.length ? Math.round((100 * ages.filter((a) => a > 90).length) / ages.length) : null,
    old365: ages.filter((a) => a > 365).length,
    working: rows.filter((r) => r.status === "working").length, partly: rows.filter((r) => r.status === "partly").length,
    broken: rows.filter((r) => r.status === "broken").length, off: rows.filter((r) => r.status === "off").length,
  };
  const order = { broken: 0, partly: 1, working: 2, off: 3, unknown: 4 };
  rows.sort((a, b) => order[a.status] - order[b.status] || (b.jobs || 0) - (a.jobs || 0));
  return { summary, rows, alerts };
}

export function toMarkdown(h) {
  const s = h.summary, n = (x) => (x == null ? "" : Number(x).toLocaleString("en-CA"));
  const icon = { working: "working", partly: "**partly**", broken: "**BROKEN**", off: "off", unknown: "?" };
  const L = [
    `# Source health`, ``,
    `- Refresh of ${String(s.updatedAt || "").slice(0, 16).replace("T", " ")} UTC: **${n(s.total)} postings** in the daily feed${s.totalBefore != null ? ` (${n(s.totalBefore)} the run before)` : ""}.`,
    `- Sources: **${s.working} working**, ${s.partly} partly, ${s.broken} broken, ${s.off} off.`,
    `- Postings older than 90 days: ${s.old90 ?? "?"}% (${n(s.old365)} older than a year; the Jobs page hides them unless "Everything collected" is chosen).`,
    s.boilerplate ? `- Repeated company and legal text removed: ${n(s.boilerplate.lines)} lines from ${n(s.boilerplate.postings)} postings (${s.boilerplate.wordsShare}% of the words).` : "",
    ``,
    h.alerts.length ? `\n## Needs a person\n\n${h.alerts.map((a) => "- " + a).join("\n")}\n` : `\nNo alerts.\n`,
    `| Source | Status | Postings | Before | Failed requests | On the site | Over 90 days | Median text | Note |`,
    `|---|---|---:|---:|---:|---:|---:|---:|---|`,
    ...h.rows.map((r) => `| ${r.source} | ${icon[r.status]} | ${n(r.jobs)} | ${n(r.before)} | ${r.failed || ""} | ${n(r.onSite)} | ${r.old90 == null ? "" : r.old90 + "%"} | ${r.medianText == null ? "" : n(r.medianText)} | ${String(r.error).replace(/\|/g, "/").slice(0, 80)} |`),
    ``, `Written by scripts/source-health.mjs after every refresh.`,
  ];
  return L.filter((x) => x !== "").join("\n").replace(/\n(\| Source)/, "\n\n$1") + "\n";
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const read = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
  const prev = read(process.argv[2] || "");
  const cur = read(process.argv[3] || path.join(ROOT, "docs", "jobs.json"));
  if (!cur) { console.error("No current jobs.json to check."); process.exit(1); }
  const h = health(prev, cur);
  fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "reports", "source_health.json"), JSON.stringify(h, null, 1) + "\n");
  const md = toMarkdown(h);
  fs.writeFileSync(path.join(ROOT, "reports", "source_health.md"), md);
  console.log(md);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `alert=${h.alerts.length ? 1 : 0}\n`);
    fs.writeFileSync(path.join(ROOT, "reports", "source_alert.md"), `The daily refresh found something that needs a person.\n\n${h.alerts.map((a) => "- " + a).join("\n")}\n\nFull table: reports/source_health.md`);
  }
}
