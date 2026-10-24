// Collects Montreal-area postings from free sources and writes docs/jobs.json.
// Sources (all free, none needs a login):
//   open feeds of Job Bank Canada and The Muse; Workday career sites (the public JSON behind the career page);
//   public job boards of Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Breezy, BambooHR, Personio, Teamtailor;
//   any career page that publishes schema.org JobPosting data; Adzuna, Jooble and Careerjet when their free key is set.
// Sites that forbid or block automated reading (LinkedIn, Indeed, Glassdoor, Monster, ZipRecruiter, Talent.com) are not read.
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
const MAX_DESC = 30000;   // the whole posting: requirements often come after the first 7000 characters

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

const UA = "Mozilla/5.0 (compatible; path-match/1.0; +https://github.com/Molu221/Path_Match_V1)";
export async function fetchText(url, opts = {}) {
  const { headers, ...rest } = opts;
  const r = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { "User-Agent": UA, Accept: "application/json", ...(headers || {}) }, ...rest });
  if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
  return r.text();
}
export async function fetchJson(url, opts = {}) {
  const t = await fetchText(url, opts);
  try { return JSON.parse(t); }
  catch { const e = new Error("not JSON (the board does not exist or redirects to a web page)"); e.status = 404; throw e; }
}
export const postJson = (url, body, headers = {}) =>
  fetchJson(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Language": "en-US", ...headers }, body: JSON.stringify(body) });

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
  for (const j of out.slice(0, 80)) {
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

/* ---------- helpers for the sources below ---------- */
const cut = (s) => String(s || "").slice(0, MAX_DESC);
const cdata = (s) => String(s || "").replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
const xmlGet = (block, tag) => { const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(block); return m ? cdata(m[1]).trim() : ""; };
const xmlAll = (xml, tag) => [...String(xml).matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => m[1]);
/* some feeds give the whole posting as one paragraph: put the usual headings on their own line so the page can tag Required / Task / Preferred */
export function breakHeadings(text) {
  if ((String(text).match(/\n/g) || []).length > 6) return text;
  return String(text).replace(/\s*\b(What You'?ll Be Doing|A Day in the Life|Preferred Qualifications|Minimum Qualifications|Requirements?|Requirments|Qualifications|Responsibilities|Nice to Have|Education|Skills|Duties|Exigences|Qualifications requises|Responsabilit[ée]s|Atouts?)\s*:\s*/gi, "\n$1\n");
}
/* schema.org JobPosting data that many career pages publish for Google for Jobs */
export function jsonLdJobs(html) {
  const out = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    const t = o["@type"];
    if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) out.push(o);
    if (o["@graph"]) walk(o["@graph"]);
  };
  for (const m of String(html).matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* not valid JSON: skip this block */ }
  }
  return out;
}
export function jobFromJsonLd(x, nowMs, srcName, pageUrl) {
  const locs = [].concat(x.jobLocation || []).map((l) => { const a = (l && l.address) || {}; return [a.addressLocality, a.addressRegion, typeof a.addressCountry === "string" ? a.addressCountry : (a.addressCountry && a.addressCountry.name)].filter(Boolean).join(", "); });
  const org = x.hiringOrganization;
  return {
    company: (org && (org.name || (typeof org === "string" && org))) || "", title: x.title || x.name || "", loc: locs.filter(Boolean).join(" / "),
    date: String(x.datePosted || "").slice(0, 10), ageH: hoursSince(x.datePosted, nowMs),
    type: typeFrom([].concat(x.employmentType || []).join(" ") + " " + (x.title || "")),
    sources: [{ src: srcName, url: x.url || pageUrl }], desc: cut(stripHtml(x.description)),
  };
}

/* ---------- Job Bank Canada (free, public; robots.txt asks for 5 seconds between requests) ---------- */
export function atomEntries(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1], link = (/<link[^>]*href="([^"]+)"/.exec(e) || [])[1] || "";
    const sum = cdata(xmlGet(e, "summary"));
    const field = (label) => { const x = new RegExp("<strong>" + label + ":</strong>\\s*([^<]*)", "i").exec(sum); return x ? decode(x[1]).trim() : ""; };
    out.push({ title: decode(xmlGet(e, "title")), url: link, id: (/jobposting\/(\d+)/.exec(link) || [])[1], updated: xmlGet(e, "updated"), loc: field("Location"), employer: field("Employer"), salary: field("Salary") });
  }
  return out;
}
export function jobbankDetail(html) {
  const pick = (re) => { const m = re.exec(html); return m ? stripHtml(m[1]).trim() : ""; };
  const srcTitle = pick(/<span class="orig-title-label">[\s\S]*?<\/span>\s*([^<]+)</);
  const nocTitle = pick(/<span property="title">\s*([^<]+?)\s*<\/span>/);
  const employer = pick(/property="hiringOrganization"[\s\S]*?<span property="name">\s*(?:<strong>)?\s*([^<]+?)\s*(?:<\/strong>)?\s*<\/span>/);
  const description = pick(/<span class="hidden" property="description">([\s\S]*?)<\/span>/);
  const ext = /<a[^>]+id="externalJobLink"[^>]+href="([^"]+)"[^>]*>[\s\S]*?<span class="job-source[^"]*"><\/span>\s*([^<]+?)\s*<span/.exec(html);
  const brief = (/<ul class="job-posting-brief[^"]*">([\s\S]*?)<\/ul>/.exec(html) || [])[1] || "";
  const summary = stripHtml(brief.replace(/<\/li>/g, "\n").replace(/<span class="wb-inv">([^<]*)<\/span>/g, "$1: ")).split("\n").map((l) => l.trim()).filter((l) => l && !/^Salary:\s*$/.test(l)).join("\n");
  // a direct posting keeps its requirements in separate blocks
  const req = [...html.matchAll(/<(?:div|section)[^>]*class="[^"]*job-posting-detail-requirements[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>\s*(?=<(?:div|section)|$)/g)].map((m) => stripHtml(m[1].replace(/<\/(li|p|h\d)>/g, "\n"))).join("\n");
  return { title: srcTitle || nocTitle, nocTitle, employer, summary, description, req, partner: ext ? { url: decode(ext[1]), name: ext[2].trim() } : null };
}
/* an internship stays an internship even when the posting is part time; otherwise the "Terms of employment" line decides */
const jbType = (title, summary) => { const t = typeFrom(title); return t === "Internship" ? t : typeFrom(summary) || t; };
export async function jobbank(cfg, nowMs, log, pause = sleep) {
  const base = "https://www.jobbank.gc.ca/jobsearch/";
  const seen = new Map();
  let ok = 0, failed = 0;
  for (const q of cfg.queries) {
    const u = `${base}feed/jobSearchRSSfeed?searchstring=${encodeURIComponent(q)}&locationstring=${encodeURIComponent(cfg.where)}&fage=${cfg.maxDaysOld}&sort=D&rows=100`;
    try { const xml = await fetchText(u, { headers: { Accept: "application/atom+xml,application/xml,*/*" } }); ok++; for (const e of atomEntries(xml)) if (e.id && !seen.has(e.id)) seen.set(e.id, e); }
    catch (e) { failed++; log(`Job Bank "${q}": ${e.message}`); }
    await pause(cfg.delayMs);
  }
  const cand = [...seen.values()].filter((e) => AREA.test(e.loc) && RELEVANT.test(norm(e.title + " " + e.employer)))
    .sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated)).slice(0, cfg.maxDetails);
  const jobs = [];
  for (const e of cand) {
    const url = `https://www.jobbank.gc.ca/jobsearch/jobposting/${e.id}`;
    let d = null;
    try { d = jobbankDetail(await fetchText(url, { headers: { Accept: "text/html" } })); } catch (err) { failed++; log(`Job Bank ${e.id}: ${err.message}`); }
    await pause(cfg.delayMs);
    if (d && !d.description && !d.req) {      // partner postings show their text only on the French page
      try { const fr = jobbankDetail(await fetchText(`https://www.guichetemplois.gc.ca/jobsearch/jobposting/${e.id}`, { headers: { Accept: "text/html" } })); d.description = fr.description; d.req = fr.req; } catch { /* keep what we have */ }
      await pause(cfg.delayMs);
    }
    const body = d ? breakHeadings([d.summary && "Job summary:\n" + d.summary, d.description, d.req].filter(Boolean).join("\n")) : "";
    const full = d && (d.description || d.req);
    jobs.push({
      company: (d && d.employer) || e.employer || "Unknown", title: (d && d.title) || e.title, loc: e.loc.replace(/\s*\((\w\w)\)\s*$/, ", $1"),
      date: e.updated.slice(0, 10), ageH: hoursSince(e.updated, nowMs),
      type: jbType(((d && d.title) || e.title) + " " + e.title, (d && d.summary) || ""),
      sources: [{ src: "Job Bank", url }, ...(d && d.partner ? [{ src: d.partner.name, url: d.partner.url }] : [])], desc: cut(body), ...(full ? {} : { partial: true }),
    });
  }
  return { jobs: jobs.filter((j) => j.title && RELEVANT.test(norm(j.title + " " + j.desc.slice(0, 1500)))), ok, failed, listed: seen.size, inArea: cand.length };
}

/* ---------- The Muse (free public API, no key needed for testing: 500 requests an hour) ---------- */
export async function muse(cfg, nowMs, log) {
  const out = [];
  let ok = 0, failed = 0;
  const key = process.env.MUSE_API_KEY ? `&api_key=${encodeURIComponent(process.env.MUSE_API_KEY)}` : "";
  for (const level of cfg.levels) {
    for (let page = 0; page < cfg.pages; page++) {
      try {
        const d = await fetchJson(`https://www.themuse.com/api/public/jobs?page=${page}&location=${encodeURIComponent(cfg.location)}&level=${encodeURIComponent(level)}${key}`);
        ok++;
        for (const x of d.results || []) out.push({
          company: (x.company && x.company.name) || "Unknown", title: x.name, loc: (x.locations || []).map((l) => l.name).join(" / "),
          date: String(x.publication_date || "").slice(0, 10), ageH: hoursSince(x.publication_date, nowMs),
          type: (x.levels || []).some((l) => /intern/i.test(l.name)) ? "Internship" : typeFrom(x.name),
          sources: [{ src: "The Muse", url: (x.refs && x.refs.landing_page) || "" }], desc: cut(stripHtml(x.contents)),
        });
        if (page + 1 >= (d.page_count || 0)) break;
      } catch (e) { failed++; log(`The Muse ${level} page ${page}: ${e.message}`); break; }
      await sleep(250);
    }
  }
  return { jobs: out.filter(keep), ok, failed };
}

/* ---------- Workday career sites (the JSON behind every myworkdayjobs.com page, no login) ---------- */
const WD_AGE = (t) => { const s = norm(t); if (/today|aujourd/.test(s)) return 8; if (/yesterday|hier/.test(s)) return 32; const m = /(\d+)\+?\s*(?:days?|jours?)/.exec(s); return m ? (+m[1]) * 24 + (/\+/.test(s) ? 24 : 12) : null; };
export async function workday(b, nowMs, log) {
  const base = `https://${b.host}/wday/cxs/${b.tenant}/${b.site}`;
  const queries = b.queries || ["", "Montreal", "Montréal", "Quebec", "stage", "intern"];
  const found = new Map();
  let total = null;
  for (const q of queries) {
    for (let off = 0; off < 400; off += 20) {
      const d = await postJson(`${base}/jobs`, { appliedFacets: {}, limit: 20, offset: off, searchText: q });
      if (total == null) total = d.total;
      for (const p of d.jobPostings || []) found.set(p.externalPath, p);
      if ((d.jobPostings || []).length < 20 || (q === "" && d.total <= 400 && off + 20 >= d.total)) break;
      await sleep(120);
    }
    if (q === "" && total != null && total <= 400) break;       // a small career site was read completely
  }
  const wanted = [...found.values()].filter((p) => (AREA.test(p.locationsText || "") || /\d+\s+locations?|\bsites?\b/i.test(p.locationsText || "") || !p.locationsText) && RELEVANT.test(norm(p.title))).slice(0, b.maxDetails || 60);
  const out = [];
  for (const p of wanted) {
    try {
      const det = await fetchJson(`${base}${p.externalPath}`, { headers: { Accept: "application/json", "Accept-Language": "en-US" } });
      const i = det.jobPostingInfo || {};
      const loc = [i.location, ...(i.additionalLocations || [])].filter(Boolean).join(" / ") || p.locationsText || "";
      const posted = i.startDate ? Date.parse(i.startDate + "T00:00:00Z") : null;
      out.push({
        company: b.name, title: i.title || p.title, loc, date: i.startDate || "",
        ageH: posted ? Math.max(0, (nowMs - posted) / 36e5) : WD_AGE(i.postedOn || p.postedOn),
        type: typeFrom(`${i.timeType || ""} ${i.title || p.title}`),
        sources: [{ src: "Workday", url: i.externalUrl || `https://${b.host}/${b.site}${p.externalPath}` }], desc: cut(stripHtml(i.jobDescription)),
      });
    } catch (e) { if (e.status !== 404) log(`Workday ${b.tenant} ${p.externalPath}: ${e.message}`); }
    await sleep(120);
  }
  return out.filter(keep);
}

/* ---------- more public job boards ---------- */
export async function workable(slug, nowMs) {
  const d = await fetchJson(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`);
  return (d.jobs || []).map((x) => ({
    company: d.name || pretty(slug), title: x.title, loc: [x.city, x.state, x.country].filter(Boolean).join(", "),
    date: String(x.published_on || x.created_at || "").slice(0, 10), ageH: hoursSince(x.published_on || x.created_at, nowMs),
    type: typeFrom((x.employment_type || "") + " " + x.title), sources: [{ src: "Workable", url: x.url || x.shortlink }], desc: cut(stripHtml(x.description)),
  })).filter((j) => j.title && keep(j));
}
export async function recruitee(slug, nowMs) {
  const d = await fetchJson(`https://${slug}.recruitee.com/api/offers/`);
  return (d.offers || []).map((x) => ({
    company: x.company_name || pretty(slug), title: x.title, loc: x.location || [x.city, x.country].filter(Boolean).join(", "),
    date: String(x.published_at || x.created_at || "").slice(0, 10), ageH: hoursSince(x.published_at || x.created_at, nowMs),
    type: typeFrom((x.employment_type_code || "") + " " + x.title), sources: [{ src: "Recruitee", url: x.careers_url }],
    desc: cut(stripHtml((x.description || "") + "\n" + (x.requirements || ""))),
  })).filter((j) => j.title && keep(j));
}
export async function breezy(slug, nowMs) {
  const d = await fetchJson(`https://${slug}.breezy.hr/json`);
  if (!Array.isArray(d)) throw Object.assign(new Error("not a Breezy board"), { status: 404 });
  const jobs = d.map((x) => ({
    company: (x.company && x.company.name) || pretty(slug), title: x.name, loc: (x.location && x.location.name) || "",
    date: String(x.published_date || "").slice(0, 10), ageH: hoursSince(x.published_date, nowMs),
    type: typeFrom(((x.type && x.type.name) || "") + " " + x.name), sources: [{ src: "Breezy", url: x.url }], desc: cut(stripHtml(x.description || "")),
  }));
  for (const j of jobs.filter((j) => !j.desc && AREA.test(j.loc) && RELEVANT.test(norm(j.title))).slice(0, 20)) {   // the list has no text: read the posting's own page
    try { const ld = jsonLdJobs(await fetchText(j.sources[0].url, { headers: { Accept: "text/html" } }))[0]; if (ld) j.desc = cut(stripHtml(ld.description)); } catch { /* keep the title only */ }
  }
  return jobs.filter((j) => j.title && keep(j));
}
export async function bamboohr(slug, nowMs) {
  const d = await fetchJson(`https://${slug}.bamboohr.com/careers/list`);
  if (!d || !Array.isArray(d.result)) throw Object.assign(new Error("not a BambooHR board"), { status: 404 });
  const out = [];
  for (const x of d.result) {
    const loc = [x.location && x.location.city, x.location && x.location.state].filter(Boolean).join(", ");
    if (!AREA.test(loc) || !RELEVANT.test(norm(x.jobOpeningName))) continue;
    let desc = "", date = "";
    try { const det = await fetchJson(`https://${slug}.bamboohr.com/careers/${x.id}/detail`); const o = (det.result && det.result.jobOpening) || {}; desc = cut(stripHtml(o.description)); date = String(o.datePosted || "").slice(0, 10); } catch { /* title only */ }
    out.push({ company: pretty(slug), title: x.jobOpeningName, loc, date, ageH: hoursSince(date, nowMs), type: typeFrom((x.employmentStatusLabel || "") + " " + x.jobOpeningName),
      sources: [{ src: "BambooHR", url: `https://${slug}.bamboohr.com/careers/${x.id}` }], desc });
  }
  return out.filter(keep);
}
export async function personio(slug, nowMs) {
  let xml = "", base = "";
  for (const host of [`${slug}.jobs.personio.de`, `${slug}.jobs.personio.com`]) {
    try { xml = await fetchText(`https://${host}/xml?language=en`, { headers: { Accept: "application/xml,text/xml,*/*" } }); } catch (e) { if (e.status === 404) continue; throw e; }
    if (xml.includes("<workzag-jobs")) { base = host; break; }
    xml = "";
  }
  if (!xml) throw Object.assign(new Error("not a Personio board"), { status: 404 });
  return xmlAll(xml, "position").map((p) => {
    const parts = xmlAll(p, "jobDescription").map((d) => `${xmlGet(d, "name")}\n${stripHtml(xmlGet(d, "value"))}`);
    const created = xmlGet(p, "createdAt");
    return { company: xmlGet(p, "subcompany") || pretty(slug), title: xmlGet(p, "name"), loc: [xmlGet(p, "office"), ...xmlAll(p, "additionalOffices").flatMap((a) => xmlAll(a, "office"))].filter(Boolean).join(" / "),
      date: created.slice(0, 10), ageH: hoursSince(created, nowMs), type: typeFrom(`${xmlGet(p, "employmentType")} ${xmlGet(p, "schedule")} ${xmlGet(p, "name")}`),
      sources: [{ src: "Personio", url: `https://${base}/job/${xmlGet(p, "id")}` }], desc: cut(parts.join("\n")) };
  }).filter((j) => j.title && keep(j));
}
export async function teamtailor(slug, nowMs) {
  const xml = await fetchText(`https://${slug}.teamtailor.com/jobs.rss`, { headers: { Accept: "application/rss+xml,application/xml,*/*" } });
  if (!/<rss|<channel/.test(xml)) throw Object.assign(new Error("not a Teamtailor board"), { status: 404 });
  return xmlAll(xml, "item").map((it) => {
    const pub = xmlGet(it, "pubDate");
    const cities = xmlAll(it, "tt:city").map(cdata).filter(Boolean);
    return { company: pretty(slug), title: decode(xmlGet(it, "title")), loc: cities.length ? cities.join(" / ") : xmlGet(it, "tt:location") || "", date: pub ? new Date(pub).toISOString().slice(0, 10) : "",
      ageH: hoursSince(pub, nowMs), type: typeFrom(decode(xmlGet(it, "title"))), sources: [{ src: "Teamtailor", url: xmlGet(it, "link") }], desc: cut(stripHtml(xmlGet(it, "description"))) };
  }).filter((j) => j.title && keep(j));
}
/* any career page or posting page that publishes schema.org JobPosting data */
export async function pages(urls, nowMs, log) {
  const out = [];
  let ok = 0, failed = 0;
  for (const u of urls) {
    try { const html = await fetchText(u, { headers: { Accept: "text/html" } }); ok++; for (const x of jsonLdJobs(html)) out.push(jobFromJsonLd(x, nowMs, "Career page", u)); }
    catch (e) { failed++; log(`Career page ${u}: ${e.message}`); }
    await sleep(500);
  }
  return { jobs: out.filter((j) => j.title && j.company && keep(j)), ok, failed };
}

/* ---------- search services that give a free key (set the key as a repository secret to switch them on) ---------- */
export async function jooble(cfg, key, nowMs, log) {
  const out = [];
  let ok = 0, failed = 0;
  for (const q of cfg.queries) {
    try {
      const d = await postJson(`https://jooble.org/api/${key}`, { keywords: q, location: cfg.where, page: 1 });
      ok++;
      for (const x of d.jobs || []) out.push({ company: x.company || "Unknown", title: stripHtml(x.title), loc: x.location || "", date: String(x.updated || "").slice(0, 10), ageH: hoursSince(x.updated, nowMs),
        type: typeFrom((x.type || "") + " " + x.title), sources: [{ src: "Jooble", url: x.link }], desc: cut(stripHtml(x.snippet)), partial: true });
    } catch (e) { failed++; log(`Jooble "${q}": ${e.message}`); if (e.status === 401 || e.status === 403) break; }
    await sleep(cfg.delayMs || 1000);
  }
  return { jobs: out.filter((j) => j.title && keep(j)), ok, failed };
}
export async function careerjet(cfg, key, nowMs, log) {
  const out = [];
  let ok = 0, failed = 0;
  for (const q of cfg.queries) {
    try {
      const u = new URL("https://search.api.careerjet.net/v4/query");
      u.search = new URLSearchParams({ locale_code: cfg.locale || "en_CA", keywords: q, location: cfg.where, sort: "date", page: "1", page_size: "50", user_ip: "127.0.0.1", user_agent: UA }).toString();
      const d = await fetchJson(u.toString(), { headers: { Authorization: "Basic " + Buffer.from(key + ":").toString("base64"), Accept: "application/json" } });
      ok++;
      for (const x of d.jobs || []) out.push({ company: x.company || "Unknown", title: stripHtml(x.title), loc: x.locations || "", date: String(x.date || "").slice(0, 10), ageH: hoursSince(x.date, nowMs),
        type: typeFrom(x.title + " " + (x.description || "")), sources: [{ src: "Careerjet", url: x.url }], desc: cut(stripHtml(x.description)), partial: true });
    } catch (e) { failed++; log(`Careerjet "${q}": ${e.message}`); if (e.status === 401 || e.status === 403) break; }
    await sleep(cfg.delayMs || 1000);
  }
  return { jobs: out.filter((j) => j.title && keep(j)), ok, failed };
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

/* the employer boards that publish an open feed: one request (or a few) per employer slug */
export const ATS = { greenhouse, lever, ashby, smartrecruiters, workable, recruitee, breezy, bamboohr, personio, teamtailor };
export const LABEL = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters", workable: "Workable", recruitee: "Recruitee", breezy: "Breezy", bamboohr: "BambooHR", personio: "Personio", teamtailor: "Teamtailor" };

/* Every source reports the same few numbers so the page (and you) can see which ones worked:
   jobs (kept for Montreal and the target roles), ok / failed requests, and the first error seen. */
const note = (s, e) => { s.failed = (s.failed || 0) + 1; if (!s.error) s.error = String(e.message || e).slice(0, 160); };

export async function main({ nowMs = Date.now(), log = console.log, write = true, companies, searches, env = process.env } = {}) {
  companies = companies || JSON.parse(fs.readFileSync(path.join(ROOT, "config", "companies.json"), "utf8"));
  searches = searches || JSON.parse(fs.readFileSync(path.join(ROOT, "config", "searches.json"), "utf8"));
  const sources = {};
  const all = [];
  const notFound = [];

  /* 1. employer boards that publish an open feed: one request per employer */
  const ats = ATS, label = LABEL;
  const tasks = [];
  for (const k of Object.keys(ats)) {
    const slugs = [...new Set(companies[k] || [])];
    if (!slugs.length) continue;
    sources[label[k]] = { boards: 0, answered: 0, jobs: 0 };
    for (const slug of slugs) tasks.push({ k, slug });
  }
  await pool(tasks, 8, async ({ k, slug }) => {
    const s = sources[label[k]]; s.boards++;
    try { const jobs = await ats[k](slug, nowMs); s.answered++; s.jobs += jobs.length; all.push(...jobs); }
    catch (e) { if (e.status === 404) notFound.push(`${label[k]}:${slug}`); else { note(s, e); log(`${label[k]} ${slug}: ${e.message}`); } }
  });

  /* 2. Workday career sites: a few requests per employer */
  if ((companies.workday || []).length) {
    const s = sources.Workday = { boards: 0, answered: 0, jobs: 0 };
    await pool(companies.workday, 3, async (b) => {
      s.boards++;
      try { const jobs = await workday(b, nowMs, log); s.answered++; s.jobs += jobs.length; all.push(...jobs); }
      catch (e) { if (e.status === 404 || e.status === 422) notFound.push(`Workday:${b.tenant}/${b.site}`); else { note(s, e); log(`Workday ${b.tenant}: ${e.message}`); } }
    });
  }

  /* 3. career pages that publish schema.org JobPosting data */
  if ((companies.pages || []).length) {
    const r = await pages(companies.pages, nowMs, log);
    sources["Career pages"] = { pages: companies.pages.length, requestsOk: r.ok, requestsFailed: r.failed, jobs: r.jobs.length };
    all.push(...r.jobs);
  }

  /* 4. public search boards */
  const run = async (name, cfg, fn) => {
    if (!cfg) return;
    try {
      const r = await fn();
      sources[name] = { requestsOk: r.ok, requestsFailed: r.failed, jobs: r.jobs.length, ...(r.listed != null ? { listed: r.listed, inMontreal: r.inArea } : {}) };
      all.push(...r.jobs);
    } catch (e) { sources[name] = { jobs: 0, error: String(e.message || e).slice(0, 160) }; log(`${name}: ${e.message}`); }
  };
  await run("Job Bank", searches.jobbank, () => jobbank(searches.jobbank, nowMs, log));
  await run("The Muse", searches.muse, () => muse(searches.muse, nowMs, log));

  /* 5. search services that need a free key: switched on by a repository secret */
  const withKey = async (name, cfg, keys, fn) => {
    if (!cfg) return;
    const missing = keys.filter((k) => !env[k]);
    if (missing.length) { sources[name] = { skipped: `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set` }; log(`${name} skipped: set ${missing.join(" and ")}`); return; }
    await run(name, cfg, fn);
  };
  const id = env.ADZUNA_APP_ID, key = env.ADZUNA_APP_KEY;
  if (id && key) {
    const r = await adzuna(searches.adzuna, id, key, nowMs, log);
    sources.Adzuna = { queries: searches.adzuna.queries.length, requestsOk: r.ok, requestsFailed: r.failed, jobs: r.jobs.length, ...(r.stop ? { error: r.stop } : {}) };
    all.push(...r.jobs);
  } else {
    sources.Adzuna = { skipped: "ADZUNA_APP_ID and ADZUNA_APP_KEY are not set" };
    log("Adzuna skipped: set ADZUNA_APP_ID and ADZUNA_APP_KEY");
  }
  await withKey("Jooble", searches.jooble, ["JOOBLE_API_KEY"], () => jooble(searches.jooble, env.JOOBLE_API_KEY, nowMs, log));
  await withKey("Careerjet", searches.careerjet, ["CAREERJET_API_KEY"], () => careerjet(searches.careerjet, env.CAREERJET_API_KEY, nowMs, log));

  const jobs = merge(all).sort((a, b) => (a.ageH ?? 1e9) - (b.ageH ?? 1e9)).slice(0, 2500);
  const out = { updatedAt: new Date(nowMs).toISOString(), mock: false, sources, notFoundCount: notFound.length, jobs };
  log(`Collected ${jobs.length} postings. ` + Object.entries(sources).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(" | "));
  if (write) {
    if (jobs.length < 10) { log("Fewer than 10 postings. Keeping the previous jobs.json."); process.exitCode = 1; return out; }
    fs.writeFileSync(OUT, JSON.stringify(out));
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) await main();
