// Collects Montreal-area postings from free sources and writes docs/jobs.json.
// Sources: Adzuna (free API key), and public job boards of Greenhouse, Lever, Ashby and SmartRecruiters.
// No dependencies. Node 20+.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "jobs.json");

export const AREA = /montr[eé]al|laval\b|longueuil|brossard|dorval|saint[- ]laurent|st[- ]laurent|pointe[- ]claire|sainte?[- ]anne[- ]de[- ]bellevue|boucherville|saint[- ]hubert|st[- ]hubert|vaudreuil|terrebonne|mirabel|varennes|candiac|la prairie|saint[- ]bruno|kirkland|lachine|anjou|westmount|verdun|mont[- ]royal|mount royal|saint[- ]eustache|repentigny|blainville|dollard|beaconsfield|pierrefonds|lasalle|ahuntsic|greater montr/i;
export const RELEVANT = /intern|stage|stagiaire|co-?op|student|etudiant|apprenti|engineer|ingenieur|analyst|analyste|operations|operation|supply|logisti|qualit|planner|planific|procure|achat|manufactur|industr|process|procede|\blean\b|continuous|amelioration|project|projet|data|donnees|production|method|maintenance|reliab|safety|securite|environment|coordinat|coordonna|technician|technicien|specialist|specialiste|associate|junior|entry|graduate|diplom/;

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pretty = (slug) => slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const MAX_DESC = 7000;

export function decode(s) {
  return String(s || "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#x27;/g, "'");
}
export function stripHtml(s) {
  // Greenhouse returns escaped HTML, so decode first, then strip tags, then decode again.
  return decode(decode(s).replace(/<\s*(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
const hoursSince = (iso, nowMs) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, (nowMs - t) / 36e5) : null;
};
const typeFrom = (s) => {
  const t = norm(s);
  if (/intern|stage|stagiaire|co-?op|student|etudiant/.test(t)) return "Internship";
  if (/part[- ]?time|temps partiel/.test(t)) return "Part-time";
  if (/contract|contrat|temporary|temporaire/.test(t)) return "Contract";
  if (/full[- ]?time|temps plein|permanent/.test(t)) return "Full-time";
  return "";
};

export async function fetchJson(url, opts = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { "User-Agent": "path-match/1.0", Accept: "application/json" }, ...opts });
  if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
  return r.json();
}

const keep = (j) => AREA.test(j.loc || "") && RELEVANT.test(norm(j.title + " " + (j.desc || "").slice(0, 1500)));

/* ---------- Greenhouse ---------- */
export async function greenhouse(slug, nowMs) {
  const d = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  return (d.jobs || []).map((x) => ({
    company: x.company_name || pretty(slug), title: x.title, loc: (x.location && x.location.name) || "",
    date: String(x.first_published || x.updated_at || "").slice(0, 10), ageH: hoursSince(x.first_published || x.updated_at, nowMs),
    type: typeFrom(x.title), sources: [{ src: "Greenhouse", url: x.absolute_url }], desc: stripHtml(x.content).slice(0, MAX_DESC),
  })).filter((j) => j.title && keep(j));
}
/* ---------- Lever ---------- */
export async function lever(slug, nowMs) {
  const d = await fetchJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  return (Array.isArray(d) ? d : []).map((x) => {
    const c = x.categories || {};
    const loc = [c.location, ...(c.allLocations || [])].filter(Boolean).join(" / ");
    const lists = (x.lists || []).map((l) => l.text + ": " + stripHtml(l.content)).join("\n");
    return {
      company: pretty(slug), title: x.text, loc,
      date: x.createdAt ? new Date(x.createdAt).toISOString().slice(0, 10) : "", ageH: x.createdAt ? Math.max(0, (nowMs - x.createdAt) / 36e5) : null,
      type: typeFrom((c.commitment || "") + " " + x.text), sources: [{ src: "Lever", url: x.hostedUrl }],
      desc: ((x.descriptionPlain || stripHtml(x.description)) + "\n" + lists).slice(0, MAX_DESC),
    };
  }).filter((j) => j.title && keep(j));
}
/* ---------- Ashby ---------- */
export async function ashby(slug, nowMs) {
  const d = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=false`);
  return (d.jobs || []).filter((x) => x.isListed !== false).map((x) => ({
    company: pretty(slug), title: x.title, loc: [x.location, ...((x.secondaryLocations || []).map((s) => s.location))].filter(Boolean).join(" / "),
    date: String(x.publishedAt || "").slice(0, 10), ageH: hoursSince(x.publishedAt, nowMs),
    type: typeFrom((x.employmentType || "") + " " + x.title), sources: [{ src: "Ashby", url: x.jobUrl }],
    desc: (x.descriptionPlain || stripHtml(x.descriptionHtml)).slice(0, MAX_DESC),
  })).filter((j) => j.title && keep(j));
}
/* ---------- SmartRecruiters ---------- */
export async function smartrecruiters(slug, nowMs) {
  const out = [];
  for (let off = 0; off < 300; off += 100) {
    const d = await fetchJson(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&offset=${off}&country=ca`);
    const items = d.content || [];
    for (const x of items) {
      const l = x.location || {};
      const loc = [l.city, l.region, l.country].filter(Boolean).join(", ");
      if (!AREA.test(loc) || !RELEVANT.test(norm(x.name))) continue;
      out.push({
        company: (x.company && x.company.name) || pretty(slug), title: x.name, loc,
        date: String(x.releasedDate || "").slice(0, 10), ageH: hoursSince(x.releasedDate, nowMs),
        type: typeFrom((x.typeOfEmployment && x.typeOfEmployment.label) + " " + x.name),
        sources: [{ src: "SmartRecruiters", url: `https://jobs.smartrecruiters.com/${slug}/${x.id}` }], desc: "", _ref: x.ref,
      });
    }
    if (items.length < 100) break;
  }
  for (const j of out.slice(0, 40)) {
    try {
      const det = await fetchJson(j._ref);
      const s = (det.jobAd && det.jobAd.sections) || {};
      j.desc = ["jobDescription", "qualifications", "additionalInformation"].map((k) => stripHtml(s[k] && s[k].text)).join("\n").slice(0, MAX_DESC);
    } catch {}
    delete j._ref;
  }
  out.forEach((j) => delete j._ref);
  return out;
}
/* ---------- Adzuna ---------- */
export async function adzuna(cfg, id, key, nowMs, log) {
  const out = [];
  let ok = 0, failed = 0;
  for (const q of cfg.queries) {
    for (let page = 1; page <= cfg.pages; page++) {
      const u = new URL(`https://api.adzuna.com/v1/api/jobs/${cfg.country}/search/${page}`);
      u.search = new URLSearchParams({
        app_id: id, app_key: key, results_per_page: String(cfg.resultsPerPage), what: q, where: cfg.where,
        distance: String(cfg.distanceKm), max_days_old: String(cfg.maxDaysOld), sort_by: "date", "content-type": "application/json",
      }).toString();
      try {
        const d = await fetchJson(u.toString());
        ok++;
        for (const x of d.results || []) {
          out.push({
            company: (x.company && x.company.display_name) || "Unknown", title: x.title, loc: (x.location && x.location.display_name) || "",
            date: String(x.created || "").slice(0, 10), ageH: hoursSince(x.created, nowMs),
            type: x.contract_time === "part_time" ? "Part-time" : typeFrom(x.title + " " + (x.description || "")),
            sources: [{ src: "Adzuna", url: x.redirect_url }], desc: stripHtml(x.description).slice(0, MAX_DESC), partial: true,
          });
        }
        if ((d.results || []).length < cfg.resultsPerPage) break;
      } catch (e) { failed++; log(`Adzuna "${q}" page ${page}: ${e.message}`); if (e.status === 401 || e.status === 403) return { jobs: out, ok, failed, stop: e.message }; }
      await sleep(cfg.delayMs);
    }
  }
  return { jobs: out.filter((j) => j.title && RELEVANT.test(norm(j.title + " " + j.desc.slice(0, 600)))), ok, failed };
}

export function merge(list) {
  const m = new Map();
  for (const j of list) {
    const k = norm(j.company) + "|" + norm(j.title);
    const e = m.get(k);
    if (!e) { m.set(k, { ...j }); continue; }
    if (!e.sources.some((s) => s.url === j.sources[0].url)) e.sources.push(...j.sources);
    if ((e.partial || !e.desc) && j.desc && !j.partial) { e.desc = j.desc; delete e.partial; }
    if (j.ageH != null && (e.ageH == null || j.ageH < e.ageH)) { e.ageH = j.ageH; e.date = j.date || e.date; }
  }
  return [...m.values()];
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; results[k] = await fn(items[k]); }
  }));
  return results;
}

export async function main({ nowMs = Date.now(), log = console.log, write = true, companies, searches } = {}) {
  companies = companies || JSON.parse(fs.readFileSync(path.join(ROOT, "config", "companies.json"), "utf8"));
  searches = searches || JSON.parse(fs.readFileSync(path.join(ROOT, "config", "searches.json"), "utf8"));
  const sources = {};
  const all = [];
  const notFound = [];

  const ats = { greenhouse, lever, ashby, smartrecruiters };
  const label = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters" };
  for (const k of Object.keys(ats)) sources[label[k]] = { boards: 0, answered: 0, jobs: 0 };
  const tasks = [];
  for (const k of Object.keys(ats)) for (const slug of [...new Set(companies[k] || [])]) tasks.push({ k, slug });
  await pool(tasks, 8, async ({ k, slug }) => {
    const s = sources[label[k]]; s.boards++;
    try { const jobs = await ats[k](slug, nowMs); s.answered++; s.jobs += jobs.length; all.push(...jobs); }
    catch (e) { if (e.status === 404) notFound.push(`${label[k]}:${slug}`); else log(`${label[k]} ${slug}: ${e.message}`); }
  });

  const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
  if (id && key) {
    const r = await adzuna(searches.adzuna, id, key, nowMs, log);
    sources.Adzuna = { queries: searches.adzuna.queries.length, requestsOk: r.ok, requestsFailed: r.failed, jobs: r.jobs.length, ...(r.stop ? { error: r.stop } : {}) };
    all.push(...r.jobs);
  } else {
    sources.Adzuna = { skipped: "ADZUNA_APP_ID and ADZUNA_APP_KEY are not set" };
    log("Adzuna skipped: set ADZUNA_APP_ID and ADZUNA_APP_KEY");
  }

  const jobs = merge(all).sort((a, b) => (a.ageH ?? 1e9) - (b.ageH ?? 1e9)).slice(0, 1500);
  const out = { updatedAt: new Date(nowMs).toISOString(), mock: false, sources, notFoundCount: notFound.length, jobs };
  log(`Collected ${jobs.length} postings. ` + Object.entries(sources).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(" | "));
  if (write) {
    if (jobs.length < 10) { log("Fewer than 10 postings. Keeping the previous jobs.json."); process.exitCode = 1; return out; }
    fs.writeFileSync(OUT, JSON.stringify(out));
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) await main();
