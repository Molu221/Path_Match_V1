// Checks, from the machine that runs it (GitHub Actions), which job sites answer and in what shape.
// Writes reports/probe.json: status, content type, size, the first characters, JSON-LD JobPosting count, and useful links.
// Usage: node scripts/probe.mjs [config/probe.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfgPath = process.argv[2] || path.join(ROOT, "config", "probe.json");
const probes = JSON.parse(fs.readFileSync(cfgPath, "utf8")).probes;
const UA = "Mozilla/5.0 (compatible; path-match/1.0; +https://github.com/Molu221/Path_Match_V1)";

const flat = (s, n) => String(s).replace(/\s+/g, " ").slice(0, n);
async function one(p, urlOverride) {
  const t0 = Date.now();
  const url = urlOverride || p.url;
  const r = { name: p.name, url, method: p.method || "GET" };
  try {
    const res = await fetch(url, {
      method: r.method, redirect: "follow", signal: AbortSignal.timeout(25000),
      headers: { "User-Agent": UA, "Accept-Language": "en-CA,en;q=0.8,fr;q=0.6", Accept: p.accept || "*/*", ...(p.body ? { "Content-Type": "application/json" } : {}), ...(p.headers || {}) },
      body: p.body ? JSON.stringify(p.body) : undefined,
    });
    const text = await res.text();
    r.status = res.status; r.finalUrl = res.url !== url ? res.url : undefined; r.contentType = res.headers.get("content-type"); r.bytes = text.length;
    r.head = flat(text, p.headChars || 700);
    r.jsonLdJobPostings = (text.match(/"@type"\s*:\s*"JobPosting"/g) || []).length;
    if (p.links) r.links = [...new Set([...text.matchAll(new RegExp(p.links, "gi"))].map((m) => m[1] || m[0]))].slice(0, 8);
    if (p.rssLinks) r.rss = [...new Set([...text.matchAll(/href="([^"]*(?:rss|feed)[^"]*)"/gi)].map((m) => m[1]))].slice(0, 5);
    r._text = text;
  } catch (e) { r.error = String(e && e.message || e); }
  r.ms = Date.now() - t0;
  return r;
}

const results = [];
const queue = probes.slice();
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const p = queue.shift();
    const r = await one(p);
    if (p.followFirst && r._text) {                      // fetch the first link found on the page too
      const m = new RegExp(p.followFirst, "i").exec(r._text);
      if (m) {
        const u = new URL(m[1] || m[0], r.finalUrl || r.url).toString();
        const f = await one({ ...p, name: p.name + " -> first link", links: undefined, rssLinks: false, followFirst: undefined, headChars: 1200 }, u);
        delete f._text; results.push(f);
      }
    }
    delete r._text; results.push(r);
    console.log(`${r.status || "ERR"}\t${r.ms}ms\t${p.name}\t${r.error || ""}`);
  }
}));
results.sort((a, b) => a.name.localeCompare(b.name));
fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "reports", "probe.json"), JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
