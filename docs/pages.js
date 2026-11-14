/* pages.js - the extra pages of Path Match: market map, skill lab, career ladder, quick sort and the application board,
   plus the Explore menu, the jump bar (Ctrl K) and the start-page extras.

   Everything here is worked out in the browser from the postings already loaded by index.html (JOBS) and, when there is one, from the CV.
   Nothing is invented: a count is a count of collected postings, a score is the page's own score, and the board only holds what the person put on it.
   index.html calls XP.pages[id].render() when a page is shown, XP.home() on the start page and XP.init() once at startup.
   It reads globals of index.html only when a function runs (JOBS, RES, P, F, CV, norm, esc, nf, goJobs ...), so the load order does not matter. */
(function () {
  "use strict";
  const g = (id) => document.getElementById(id);
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: the page still works, it just does not remember */ } }
  };
  const ICON = {
    market: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/></svg>',
    lab: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 14h8"/></svg>',
    ladder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h5v-5h5v-5h5V6h3"/></svg>',
    swipe: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 12.5l2 2 4-4.5"/></svg>',
    board: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/></svg>',
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/></svg>',
    target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></svg>',
    wayfinder: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    paste: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM12 11v6M9 14h6"/></svg>'
  };
  const META = {
    market: { name: "Market map", title: "Market map", hue: "var(--violet)", blurb: "See where the postings are: by province, field and stage." },
    lab: { name: "Skill lab", title: "Skill lab", hue: "var(--mint)", blurb: "Try a skill before you learn it and watch your top 10 move." },
    ladder: { name: "Career ladder", title: "Career ladder", hue: "var(--coral)", blurb: "What each rung asks for in your field, and what is new on the next one." },
    swipe: { name: "Quick sort", title: "Quick sort", hue: "var(--berry)", blurb: "Go through postings one card at a time: save or skip." },
    board: { name: "Application board", title: "Application board", hue: "var(--peach)", blurb: "Track what you saved, applied to, and heard back about." },
    plan: { name: "Week plan", title: "Week plan", hue: "var(--sun)", blurb: "The few postings worth your applications this week, with a score range for each." },
    target: { name: "Target or spray?", title: "Target or spray?", hue: "#19a7b8", blurb: "How much a high score must help before a few tailored applications beat many quick ones." },
    wayfinder: { name: "Wayfinder", title: "Wayfinder", hue: "var(--pin)", blurb: "Say the job you want in one sentence, in English or French. Sample prompts for students and graduates." },
    paste: { name: "Paste a posting", title: "Paste a posting", hue: "#96b21f", blurb: "Found a job on LinkedIn, Indeed or anywhere else? Paste it and see how it matches your CV." }
  };
  const ORDER = ["wayfinder", "market", "lab", "plan", "target", "ladder", "swipe", "board", "paste"];
  const LANGSKILL = new Set(["english", "french", "anglais", "francais", "bilingual", "bilingue", "bilingual (en/fr)"]);
  /* general strengths: postings name them, but they are not something to "learn first". They are shown apart from role skills. */
  const SOFT = new Set(("leadership|attention to detail|initiative|autonomy|organizational skills|explaining complex ideas|patience|perseverance|curiosity|takes on challenges|problem solving|analytical skills|communication|teamwork|collaboration|interpersonal skills|time management|prioritization|multitasking|works under pressure|meets deadlines|adaptability|critical thinking|creativity|innovation|proactivity|resourcefulness|rigor|accountability|dependability|punctuality|professionalism|integrity|discretion and confidentiality|active listening|empathy|emotional intelligence|diplomacy and tact|conflict resolution|negotiation|persuasion and influence|decision making|presentation skills|written communication|verbal communication|strategic thinking|synthesis|learning agility|resilience|motivation|enthusiasm|entrepreneurial spirit|cultural awareness|results orientation|mentoring and coaching|stakeholder management|cross-functional work|team management|facilitation|diversity and inclusion").split("|"));
  /* ...plus the soft skills the skills library added (skills.json "soft"), read once the dictionary has loaded */
  let SOFT_FROM = null;
  const isSoft = (k) => {
    if (typeof DICT !== "undefined" && DICT && DICT.soft && SOFT_FROM !== DICT) { DICT.soft.forEach((n) => SOFT.add(norm(n))); SOFT_FROM = DICT; }
    return SOFT.has(k);
  };
  const KINDS = [["all", "All kinds"], ["full", "Full-time"], ["part", "Part-time"], ["intern", "Internships & co-ops"]];
  const KIND_TAB = { full: "full", part: "part", intern: "intern" };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  /* a count becomes one of five shades (q1 lightest to q5 darkest); the text colour of each shade is set in pages.css */
  const shade = (t) => 1 + Math.min(4, Math.floor(t * 5));
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  /* a share for people to read: a place with a few postings is "<1%", not "0%" */
  const pctTxt = (a, b) => (a && pct(a, b) === 0 ? "<1" : pct(a, b));
  const head = (h, p) => `<div class="pghead xhead"><h1 tabindex="-1">${h}</h1><p class="note">${p}</p></div>`;
  const noJobs = (id) => head(META[id].name, "Loading the postings…");
  const bestTab = (c) => { const m = Math.max(c.full || 0, c.part || 0, c.intern || 0); return !m ? "full" : c.full === m ? "full" : c.intern === m ? "intern" : "part"; };

  /* put html in a page, and keep the keyboard focus on the same control if it is still there */
  function paint(root, html) {
    const a = document.activeElement, key = a && root.contains(a) && a.dataset ? a.dataset.f : null;
    const y = window.scrollY;
    root.innerHTML = html;
    if (key) { const n = root.querySelector('[data-f="' + CSS.escape(key) + '"]'); if (n) { n.focus({ preventScroll: true }); window.scrollTo(0, y); } }
  }

  /* ---------- what the loaded postings add up to (counted once per kind of work, then reused) ---------- */
  let ST = null, ST_KEY = "";
  function stats(kind) {
    const key = JOBS_VER + "|" + JOBS.length + "|" + kind;
    if (ST && ST_KEY === key) return ST;
    const o = { n: 0, prov: {}, mtl: 0, city: {}, field: {}, days: new Array(30).fill(0), new30: 0, emp: new Map(), skill: new Map(), cell: {} };
    for (const j of JOBS) {
      if (kind !== "all" && j.kind !== kind) continue;
      o.n++;
      const p = j.province || "";
      o.prov[p] = (o.prov[p] || 0) + 1;
      if (MTL.test(j.loc || "")) o.mtl++;
      for (const k of cityKeys(j)) o.city[k] = (o.city[k] || 0) + 1;
      const f = fdOf(j).id, l = lvOf(j).lvl;
      (o.field[f] || (o.field[f] = [0, 0, 0, 0, 0, 0]))[l]++;
      o.field[f][5]++;
      const ck = f + "|" + l;
      (o.cell[ck] || (o.cell[ck] = { full: 0, part: 0, intern: 0 }))[j.kind]++;
      const d = Math.floor(age(j) / 24);
      if (d >= 0 && d < 30) { o.days[d]++; o.new30++; }
      o.emp.set(j.company, (o.emp.get(j.company) || 0) + 1);
      if (j.kw) {
        const seen = new Set();
        for (const c of j.kw) {
          if (c[1] !== "s") continue;
          const nm = c.slice(3), k = norm(nm);
          if (seen.has(k) || LANGSKILL.has(k)) continue;
          seen.add(k);
          let e = o.skill.get(k);
          if (!e) { e = { name: nm, n: 0, f: {}, l: [0, 0, 0, 0, 0] }; o.skill.set(k, e); }
          e.n++; e.f[f] = (e.f[f] || 0) + 1; e.l[l]++;
        }
      }
    }
    ST = o; ST_KEY = key;
    return o;
  }
  const fieldLabel = (id) => { const f = JobMeta.FIELD_LIST.find((x) => x.id === id); return f ? f.label : id; };
  const hue = (id) => hueOf(id);
  const onCv = (k) => { if (!CV || !DICT) return false; const f = cvFound(); if (!f) return false; return Object.keys(f).some((n) => norm(n) === k); };
  let CVSET = null, CVSET_FOR = null;
  function cvSkills() {
    if (!CV || !DICT) return null;
    const f = cvFound(); if (!f) return null;
    if (CVSET_FOR !== f) { CVSET = new Set(Object.keys(f).map((n) => norm(n))); CVSET_FOR = f; }
    return CVSET;
  }
  /* key -> posting, so a saved posting can be shown again */
  let JM = null, JM_V = "";
  function jobByKey(k) {
    const v = JOBS_VER + "|" + JOBS.length;
    if (!JM || JM_V !== v) { JM = new Map(); for (const j of JOBS) JM.set(jkey(j), j); JM_V = v; }
    return JM.get(k) || null;
  }
  let RM = null, RM_FOR = null;
  function scoreOf(k) {
    if (!CV || SCORED_FOR !== CV || SCORING) return null;
    if (!RM || RM_FOR !== RES) { RM = new Map(); for (const r of RES) if (r.s) RM.set(jkey(r.j), r.s.total); RM_FOR = RES; }
    return RM.has(k) ? RM.get(k) : null;
  }

  /* =====================================================================
     MARKET MAP
     ===================================================================== */
  const MK = { kind: "all", sel: null, skill: null, sk: "skill", view: ((v) => (v === "canada" || v === "world" ? v : "tiles"))(store.get("pm_mapview", "tiles")) };
  const TILES = [["YT", 0, 0], ["NT", 1, 0], ["NU", 2, 0], ["BC", 0, 1], ["AB", 1, 1], ["SK", 2, 1], ["MB", 3, 1], ["ON", 4, 1], ["QC", 5, 1], ["NL", 6, 1], ["NB", 5, 2], ["PE", 6, 2], ["NS", 6, 3]];
  const EXTRA = [["MTL", "Montréal area"], ["Remote – Canada", "Remote, Canada"], ["Canada", "Canada, no province"]];
  const scale = (n, max) => (n <= 0 ? 0.04 : 0.12 + 0.88 * (Math.log(1 + n) / Math.log(1 + max)));
  /* a place is a province, the Montréal area or one of the city areas (CITIES, in index.html) */
  const inPlace = (j, code) => inPlaceOf(j, code);
  const placeName = (c) => placeLabel(c);
  const isCity = (c) => c === "MTL" || !!CITY_RE[c];

  function placeDetail(code) {
    const list = JOBS.filter((j) => (MK.kind === "all" || j.kind === MK.kind) && inPlace(j, code));
    const lv = [0, 0, 0, 0, 0], fd = {}, em = new Map(), kinds = { full: 0, part: 0, intern: 0 };
    for (const j of list) {
      lv[lvOf(j).lvl]++; const f = fdOf(j).id; fd[f] = (fd[f] || 0) + 1;
      em.set(j.company, (em.get(j.company) || 0) + 1); kinds[j.kind]++;
    }
    return { n: list.length, lv, fd: Object.entries(fd).sort((a, b) => b[1] - a[1]).slice(0, 6), em: [...em.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5), kinds };
  }
  /* ---------- three ways to see the same numbers: tiles (the default), a map of Canada, a map of the world ----------
     The outlines are in geo.js (made by scripts/build-maps.mjs from Natural Earth, public domain). The page asks for that file only when a map is opened. */
  const VIEWS = [["tiles", "Tiles"], ["canada", "Canada"], ["world", "World"]];
  const CITY_SHORT = { MTL: "Montréal", TOR: "Toronto", OTT: "Ottawa", QUE: "Québec", VAN: "Vancouver", CGY: "Calgary", EDM: "Edmonton", WPG: "Winnipeg", HAL: "Halifax", SAS: "Saskatoon", REG: "Regina" };
  /* the province whose tile stands for a city when the tiles are shown again */
  const CITY_PROV = { MTL: "QC", TOR: "ON", OTT: "ON", QUE: "QC", VAN: "BC", CGY: "AB", EDM: "AB", WPG: "MB", HAL: "NS", SAS: "SK", REG: "SK" };
  /* which side of its circle a city's name is written: r right, l left, t above, b below (chosen so that the names of neighbours do not meet) */
  const CITY_SIDE = { MTL: "r", TOR: "l", OTT: "l", QUE: "t", VAN: "b", CGY: "b", EDM: "t", WPG: "r", HAL: "b", SAS: "t", REG: "r" };
  /* where a province's code and count are written when its centre is crowded by a circle or is too small for them: [x, y] in the map's own units */
  const PLOC = { AB: [222, 520], SK: [318, 556] };
  /* NS and PE are written in the sea with a line to the province: [text x, text y, line end x, line end y] */
  const SMALL = new Set(["NB", "NL"]); /* on a phone their counts are left off the map (the chips and the details give them) */
  const CALL = { NS: [972, 706, 932, 700], PE: [906, 628, 899, 658] };
  let GEO_LOAD = "";
  function geoReady() {
    if (window.PMGEO) return true;
    if (GEO_LOAD === "failed") GEO_LOAD = "";
    if (!GEO_LOAD) {
      GEO_LOAD = "loading";
      const s = document.createElement("script"); s.src = "geo.js";
      const done = (ok) => { GEO_LOAD = ok && window.PMGEO ? "ready" : "failed"; if (MK.view !== "tiles") renderMarket(); };
      s.onload = () => done(true); s.onerror = () => done(false);
      document.head.appendChild(s);
    }
    return false;
  }
  function setView(v) {
    if (v === "tiles" && isCity(MK.sel) && MK.sel !== "MTL") MK.sel = CITY_PROV[MK.sel] || MK.sel;
    MK.view = v; store.set("pm_mapview", v);
    if (v !== "tiles") geoReady();
    renderMarket();
  }
  function mapSection(counts, max, st) {
    const tile = (c, label, x) => `<button class="tile q${shade(scale(counts[c], max))}${x ? " extra" : ""}" data-f="t-${esc(c)}" data-place="${esc(c)}" aria-pressed="${MK.sel === c}" style="${x ? "" : `grid-column:${TILES.find((t) => t[0] === c)[1] + 1};grid-row:${TILES.find((t) => t[0] === c)[2] + 1}`}" aria-label="${esc(placeName(c))}: ${nf(counts[c])} postings"><b>${esc(label)}</b><small>${nf(counts[c])}</small></button>`;
    const seg = `<div class="tog seg" role="group" aria-label="Map view">${VIEWS.map(([v, l]) => `<button data-f="v-${v}" data-mapview="${v}" aria-pressed="${MK.view === v}">${l}</button>`).join("")}</div>`;
    const ramp = `<div class="ramp"><span>fewer</span><i class="q1"></i><i class="q2"></i><i class="q3"></i><i class="q4"></i><i class="q5"></i><span>more</span></div>`;
    const credit = `<p class="note geocredit">Outlines: Natural Earth, public domain.</p>`;
    const rd = (c) => `${placeName(c)}: ${nf(counts[c] || 0)} postings, ${pctTxt(counts[c] || 0, st.n)}% of the ${nf(st.n)} shown.`;
    let view = MK.view, aside = "";
    if (view !== "tiles" && !window.PMGEO) {
      if (GEO_LOAD === "failed") { view = "tiles"; aside = `<p class="note warnline">The map outlines did not load, so the tiles are shown. Choose the map again to retry.</p>`; }
      else { geoReady(); return `<section class="xp" aria-labelledby="mkMap"><h2 id="mkMap">Postings by place</h2>${seg}<div class="geoload" role="status">Loading the map…</div></section>`; }
    }
    if (view === "tiles") {
      return `<section class="xp" aria-labelledby="mkMap"><h2 id="mkMap">Postings by province</h2><p class="note">Each tile is a province or territory. The shade follows the number of postings.</p>${seg}${aside}
          <div class="tiles">${TILES.map(([c]) => tile(c, c)).join("")}</div>
          <div class="tilerow">${EXTRA.map(([c, l]) => tile(c, l, true)).join("")}</div>${ramp}</section>`;
    }
    const GEO = window.PMGEO;
    if (view === "canada") {
      const C = GEO.canada, PV = C.provinces;
      const order = TILES.map(([c]) => c).filter((c) => PV[c]).sort((a, b) => (MK.sel === a) - (MK.sel === b));
      const provs = order.map((c) => { const n = counts[c] || 0; return `<path class="p s${shade(scale(n, max))}${MK.sel === c ? " on" : ""}" data-f="p-${c}" data-place="${c}" data-rd="${esc(rd(c))}" tabindex="0" role="button" aria-pressed="${MK.sel === c}" aria-label="${esc(placeName(c))}: ${nf(n)} postings" d="${PV[c].d}"/>`; }).join("");
      const labels = TILES.map(([c]) => {
        const p = PV[c]; if (!p) return ""; const n = counts[c] || 0, k = shade(scale(n, max)), co = CALL[c];
        if (co) return `<path class="lead" d="M${co[0]} ${co[1]}L${co[2]} ${co[3]}"/><text class="lb out sm" x="${co[0]}" y="${co[1]}"><tspan x="${co[0]}" dy="-.2em">${c}</tspan><tspan x="${co[0]}" dy="1.1em" class="lc">${nf(n)}</tspan></text>`;
        const at = PLOC[c] || p.c;
        return `<text class="lb s${k}${SMALL.has(c) ? " sm" : ""}" x="${at[0]}" y="${at[1]}"><tspan x="${at[0]}" dy="-.2em">${c}</tspan><tspan x="${at[0]}" dy="1.1em" class="lc">${nf(n)}</tspan></text>`;
      }).join("");
      const maxC = Math.max(...Object.keys(C.cities).map((k) => counts[k] || 0), 1);
      const cities = Object.keys(C.cities).sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).sort((a, b) => (MK.sel === a) - (MK.sel === b)).map((k) => {
        const n = counts[k] || 0, xy = C.cities[k];
        return `<g class="city${MK.sel === k ? " on" : ""}${n ? "" : " zero"}" data-f="c-${k}" data-place="${k}" data-rd="${esc(rd(k))}" tabindex="0" role="button" aria-pressed="${MK.sel === k}" aria-label="${esc(placeName(k))}: ${nf(n)} postings" transform="translate(${xy[0]} ${xy[1]})"><circle data-pr="${(4 + 17 * Math.sqrt(n / maxC)).toFixed(1)}" r="8"/><text data-side="${CITY_SIDE[k] || "r"}">${esc(CITY_SHORT[k] || k)}</text></g>`;
      }).join("");
      const chips = ["MTL", ...CITIES.map((c) => c[0])].sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).map((k) => `<button data-f="h-${k}" data-place="${k}" aria-pressed="${MK.sel === k}" aria-label="${esc(placeName(k))}: ${nf(counts[k] || 0)} postings">${esc(CITY_SHORT[k] || k)} <small>${nf(counts[k] || 0)}</small></button>`).join("");
      return `<section class="xp geo" aria-labelledby="mkMap"><h2 id="mkMap">Postings by province and city</h2><p class="note">Provinces are shaded by the number of postings. Each circle is a city area, and its size follows its postings. A city's postings are also in its province.</p>${seg}
          <svg class="geosvg" viewBox="0 0 ${C.w} ${C.h}" role="group" aria-label="Map of Canada: ${TILES.length} provinces and territories shaded by postings, with circles for ${Object.keys(C.cities).length} city areas">
            <g class="ctxg" aria-hidden="true">${C.context.map((c) => `<path d="${c.d}"/>`).join("")}</g>
            <g>${provs}</g><path class="lakes" aria-hidden="true" d="${C.lakes}"/><g aria-hidden="true">${labels}</g><g>${cities}</g>
          </svg>
          <p class="readout" id="geoRead" aria-live="polite">Hover, or tab through, the map. A click opens the details beside it.</p>
          <div class="chips" role="group" aria-label="City areas">${chips}</div>
          <div class="tilerow">${EXTRA.filter((e) => e[0] !== "MTL").map(([c, l]) => tile(c, l, true)).join("")}</div>${ramp}${credit}</section>`;
    }
    /* the world: only Canada has postings */
    const Wd = GEO.world, can = Wd.label.CAN, ca = st.n;
    const others = Wd.countries.filter((c) => c.a !== "CAN").map((c) => `<path class="cn" data-cn="${esc(c.n)}" d="${c.d}"/>`).join("");
    const canPath = (Wd.countries.find((c) => c.a === "CAN") || {}).d || "";
    return `<section class="xp geo" aria-labelledby="mkMap"><h2 id="mkMap">Postings around the world</h2><p class="note">Path Match collects postings for Canada, so only Canada is shaded. The other countries are there for the picture. Click Canada to open its map.</p>${seg}
          <svg class="geosvg world" viewBox="0 0 ${Wd.w} ${Wd.h}" role="group" aria-label="World map. Canada has ${nf(ca)} postings; no other country has postings">
            <g aria-hidden="true">${others}</g>
            <path class="p s5" data-f="w-CAN" data-mapview="canada" data-rd="Canada: ${nf(ca)} postings. Click to open the map of Canada." tabindex="0" role="button" aria-label="Canada: ${nf(ca)} postings. Open the map of Canada" d="${canPath}"/>
            <g aria-hidden="true"><path class="lead" d="M${can[0] - 2} ${can[1]}L${can[2]} ${can[3]}"/><text class="lb out wl" x="${can[0]}" y="${can[1]}"><tspan x="${can[0]}" dy="-.2em">Canada</tspan><tspan x="${can[0]}" dy="1.1em" class="lc">${nf(ca)}</tspan></text></g>
          </svg>
          <p class="readout" id="geoRead" aria-live="polite">Hover over a country. Only Canada has postings.</p>
          <div class="row"><button class="xbtn solid" data-mapview="canada" data-f="zoomca">Zoom to Canada</button></div>${ramp}${credit}</section>`;
  }
  /* the maps are drawn in a 1000-unit box that is shown at any width, so the size of a name and of a circle is set from the width on screen */
  function fitGeo() {
    const root = g("x-market"); if (!root) return;
    root.querySelectorAll("svg.geosvg").forEach((svg) => {
      const w = svg.getBoundingClientRect().width, vb = svg.viewBox.baseVal.width; if (!w || !vb) return;
      const u = vb / w; svg.style.setProperty("--u", u.toFixed(3));
      /* a circle is never smaller than a fingertip dot, and its name sits just outside it */
      svg.querySelectorAll("circle[data-pr]").forEach((c) => c.setAttribute("r", Math.max(+c.dataset.pr, 4 * u).toFixed(1)));
      svg.querySelectorAll(".city text[data-side]").forEach((t) => {
        const r = +t.previousElementSibling.getAttribute("r"), gap = r + 4 * u, sd = t.dataset.side, h = 8 * u;
        t.setAttribute("x", sd === "r" ? gap : sd === "l" ? -gap : 0); t.setAttribute("y", sd === "t" ? -gap - h + 4 * u : sd === "b" ? gap + h : 0);
        t.setAttribute("text-anchor", sd === "r" ? "start" : sd === "l" ? "end" : "middle");
      });
    });
  }
  function onGeoRead(e) {
    const r = g("geoRead"); if (!r) return;
    const b = e.target.closest("[data-rd],[data-cn]"); if (!b) return;
    r.textContent = b.dataset.rd || `${b.dataset.cn}: no postings collected. Path Match covers Canada.`;
  }
  function marketHtml() {
    const st = stats(MK.kind);
    const counts = {};
    for (const [c] of TILES) counts[c] = st.prov[c] || 0;
    counts.MTL = st.mtl; counts["Remote – Canada"] = st.prov["Remote – Canada"] || 0; counts.Canada = st.prov.Canada || 0;
    for (const c of CITIES) counts[c[0]] = st.city[c[0]] || 0;
    const max = Math.max(...TILES.map(([c]) => counts[c]), 1);
    if (!MK.sel) MK.sel = P.loc && counts[P.loc] != null ? P.loc : TILES.slice().sort((a, b) => counts[b[0]] - counts[a[0]])[0][0];
    const d = placeDetail(MK.sel);
    const lvTot = d.lv.reduce((a, b) => a + b, 0) || 1;
    const detail = `<div class="pd"><h3>${esc(placeName(MK.sel))}</h3><div class="big">${nf(d.n)}</div><div class="note">${pctTxt(d.n, st.n)}% of the ${nf(st.n)} postings shown${MK.sel === "MTL" ? " (the Montréal area is inside Quebec)" : isCity(MK.sel) ? " (found by the city named in the posting, so they are also in the count of their province)" : ""}</div>
      <h4>By stage</h4><div class="lvbar" role="img" aria-label="${d.lv.map((v, i) => LV[i].short + " " + v).join(", ")}">${d.lv.map((v) => `<i style="flex:${Math.max(v, 0) / lvTot}"></i>`).join("")}</div>
      <div class="note" style="margin-top:4px">${d.lv.map((v, i) => `${LV[i].short} ${nf(v)}`).join(" · ")}</div>
      <h4>Most postings by field</h4><ul class="barlist">${d.fd.map(([f, n]) => `<li><span class="bl"><span>${esc(fieldLabel(f))}</span><span class="n">${nf(n)}</span><i style="--w:${pct(n, d.fd[0][1] || 1)}%;--bc:${hue(f)}"></i></span></li>`).join("") || '<li class="note">Nothing here for this kind of work.</li>'}</ul>
      <h4>Employers with the most postings</h4><ul class="barlist">${d.em.map(([c, n]) => `<li><span class="bl"><span>${esc(c)}</span><span class="n">${nf(n)}</span></span></li>`).join("") || '<li class="note">None.</li>'}</ul>
      <div class="row"><button class="xbtn solid" data-act="seeplace" data-f="seeplace"${d.n ? "" : " disabled"}>See these ${nf(d.n)} jobs</button></div></div>`;

    /* field x stage */
    const fields = Object.entries(st.field).sort((a, b) => (a[0] === "other") - (b[0] === "other") || b[1][5] - a[1][5]);
    let maxCell = 1; for (const [, v] of fields) for (let i = 0; i < 5; i++) maxCell = Math.max(maxCell, v[i]);
    const me = meBand();
    const heat = `<div class="scrollx"><table class="heat"><thead><tr><th></th>${LV.map((l, i) => `<th class="${me === i ? "me" : ""}">${esc(l.short)}</th>`).join("")}<th></th></tr></thead><tbody>${fields.map(([f, v]) => `<tr><th><i style="--fc:${hue(f)}"></i>${esc(fieldLabel(f))}</th>${[0, 1, 2, 3, 4].map((i) => { const q = v[i] ? shade(Math.sqrt(v[i] / maxCell) * 0.999) : 0; return `<td><button data-f="h-${f}-${i}" data-fd="${f}" data-lv="${i}" class="${q ? "q" + q : ""}" aria-label="${esc(fieldLabel(f))}, ${esc(LV[i].label)}: ${nf(v[i])} postings">${v[i] ? nf(v[i]) : ""}</button></td>`; }).join("")}<td class="tot">${nf(v[5])}</td></tr>`).join("")}</tbody></table></div>`;

    /* the last 30 days */
    const dmax = Math.max(...st.days, 1);
    const bars = st.days.map((v, i) => i).reverse().map((i) => `<button data-f="d-${i}" data-day="${i}" class="${i === 0 ? "today" : ""}" style="--h:${Math.max(2, (st.days[i] / dmax) * 100)}%" aria-label="${dayLabel(i)}: ${nf(st.days[i])} postings"></button>`).join("");
    const pulse = `<div class="pulse" id="pulse">${bars}</div><div class="pulseaxis"><span>30 days ago</span><span>today</span></div><p class="readout" id="pulseRead" aria-live="polite">${nf(st.new30)} of the ${nf(st.n)} postings were published in the last 30 days. Hover or tab through the bars.</p>`;

    /* employers */
    const emp = [...st.emp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const employers = `<ul class="barlist">${emp.map(([c, n]) => `<li><button data-f="e-${esc(c)}" data-emp="${esc(c)}"><span>${esc(c)}</span><span class="n">${nf(n)}</span><i style="--w:${pct(n, emp[0][1])}%"></i></button></li>`).join("")}</ul>`;

    /* skills */
    const sk = [...st.skill.entries()].filter(([k]) => isSoft(k) === (MK.sk === "soft")).sort((a, b) => b[1].n - a[1].n).slice(0, 36);
    const smax = sk.length ? sk[0][1].n : 1, smin = sk.length ? sk[sk.length - 1][1].n : 1, mine = cvSkills();
    const cloud = `<div class="cloud">${sk.map(([k, e]) => `<button data-f="s-${esc(k)}" data-skill="${esc(k)}" aria-pressed="${MK.skill === k}" class="${mine && mine.has(k) ? "mine" : ""}" style="--t:${(smin === smax ? 1 : (Math.log(e.n) - Math.log(smin)) / (Math.log(smax) - Math.log(smin))).toFixed(2)}" title="${nf(e.n)} postings">${esc(e.name)}</button>`).join("")}</div><div class="skillread" id="skillread" aria-live="polite">${skillRead(st)}</div>`;

    return head("Market map", `Where the ${nf(JOBS.length)} collected postings are, in which fields and for which stage. Darker means more postings. Show the places as tiles, on a map of Canada or on a map of the world. Click a place, a cell or an employer to open those jobs.`) +
      `<div class="tog" role="group" aria-label="Kind of work">${KINDS.map(([k, l]) => `<button data-f="k-${k}" data-kind="${k}" aria-pressed="${MK.kind === k}">${l}</button>`).join("")}</div>
      <div class="xgrid two">
        ${mapSection(counts, max, st)}
        <section class="xp" aria-label="Detail">${detail}</section>
      </div>
      <section class="xp" style="margin-top:16px" aria-labelledby="mkHeat"><h2 id="mkHeat">Field by stage</h2><p class="note">How many postings each field has at each stage${me !== null ? `. Your stage is marked` : ""}. A cell opens those postings.</p>${heat}</section>
      <div class="xgrid eq">
        <section class="xp" aria-labelledby="mkPulse"><h2 id="mkPulse">Published in the last 30 days</h2><p class="note">Postings per day, by the date on the posting.</p>${pulse}</section>
        <section class="xp" aria-labelledby="mkEmp"><h2 id="mkEmp">Employers with the most postings</h2><p class="note">Click one to see its postings.</p>${employers}</section>
      </div>
      <section class="xp" style="margin-top:16px" aria-labelledby="mkSk"><h2 id="mkSk">${MK.sk === "soft" ? "General strengths named most" : "Skills asked for most"}</h2><p class="note">Counted from the keywords of each posting. ${mine ? "A ✓ means it is on your CV. " : "Add your CV to see which of these you already have. "}Click one for the detail.</p><div class="tog" role="group" aria-label="Which keywords"><button data-f="sk-skill" data-sk="skill" aria-pressed="${MK.sk !== "soft"}">Role and tool skills</button><button data-f="sk-soft" data-sk="soft" aria-pressed="${MK.sk === "soft"}">General strengths</button></div>${cloud}</section>`;
  }
  function dayLabel(i) {
    const d = new Date(Date.parse(TODAY + "T12:00:00") - i * 864e5);
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }
  function skillRead(st) {
    if (!MK.skill) return "";
    const e = st.skill.get(MK.skill); if (!e) return "";
    const fd = Object.entries(e.f).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => `${esc(fieldLabel(f))} (${nf(n)})`).join(", ");
    const lv = e.l.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1])[0];
    const mine = cvSkills();
    return `<b>${esc(e.name)}</b> is asked for in ${nf(e.n)} postings (${pct(e.n, st.n)}%). Most often in ${fd}. Most common at the <b>${esc(LV[lv[0]].label)}</b> stage.${mine ? (mine.has(MK.skill) ? " It is on your CV." : " It is not on your CV.") : ""}`;
  }
  function renderMarket() {
    const root = g("x-market");
    if (!JOBS.length) { paint(root, noJobs("market")); return; }
    paint(root, marketHtml());
    fitGeo();
  }
  function onMarketClick(e) {
    const t = e.target.closest("button,[data-place],[data-mapview]"); if (!t) return;
    if (t.dataset.mapview) setView(t.dataset.mapview);
    else if (t.dataset.kind) { MK.kind = t.dataset.kind; renderMarket(); }
    else if (t.dataset.place) { MK.sel = t.dataset.place; renderMarket(); }
    else if (t.dataset.act === "seeplace") { const d = placeDetail(MK.sel); goJobs({ f: { loc: MK.sel }, tab: MK.kind === "all" ? bestTab(d.kinds) : KIND_TAB[MK.kind] }); }
    else if (t.dataset.fd) { const c = stats(MK.kind).cell[t.dataset.fd + "|" + t.dataset.lv] || {}; goJobs({ f: { fd: t.dataset.fd, lvl: t.dataset.lv }, tab: MK.kind === "all" ? bestTab(c) : KIND_TAB[MK.kind] }); }
    else if (t.dataset.emp) { const c = { full: 0, part: 0, intern: 0 }; JOBS.forEach((j) => { if (j.company === t.dataset.emp) c[j.kind]++; }); goJobs({ f: { q: t.dataset.emp, lvl: "" }, tab: bestTab(c) }); }
    else if (t.dataset.sk) { MK.sk = t.dataset.sk; MK.skill = null; renderMarket(); }
    else if (t.dataset.skill) { MK.skill = MK.skill === t.dataset.skill ? null : t.dataset.skill; renderMarket(); }
  }
  function onPulse(e) {
    const b = e.target.closest("[data-day]"); const r = g("pulseRead"); if (!b || !r) return;
    const i = +b.dataset.day, st = stats(MK.kind);
    r.textContent = `${dayLabel(i)}: ${nf(st.days[i])} postings published.`;
  }

  /* =====================================================================
     SKILL LAB
     ===================================================================== */
  const LAB = { on: new Set() };
  const okGap = (x) => {
    if (x.st === "M") return false;
    const k = norm(x.n);
    if (LANGSKILL.has(k)) return false;
    return x.kind === "s" || (/\s/.test(x.n.trim()) && (x.tag === "T" || x.tag === "R" || x.tag === "K"));
  };
  function labPool() {
    const p = rankPool(200, 2), pool = p.all;
    for (const r of pool) if (!r._keys) r._keys = r.s.rows.map((x) => norm(x.n));
    return pool;
  }
  /* the score of one posting if the skills in L (a Set of folded names) were on the CV */
  function totalWith(r, L) {
    if (!L.size) return r.s.total;
    let hit = false;
    const rows = r.s.rows.map((x, i) => { if (x.st !== "M" && L.has(r._keys[i])) { hit = true; return { n: x.n, kind: x.kind, tag: x.tag, st: "M" }; } return x; });
    return hit ? Scoring.compute(rows, r.s.fit, r.s.ti).total : r.s.total;
  }
  function labCands(pool) {
    const m = new Map();
    pool.forEach((r, i) => {
      const seen = new Set();
      r.s.rows.forEach((x, ri) => {
        if (!okGap(x)) return;
        const k = r._keys[ri]; if (seen.has(k)) return; seen.add(k);
        let e = m.get(k); if (!e) { e = { k, name: x.n, idx: [] }; m.set(k, e); }
        e.idx.push(i);
      });
    });
    return [...m.values()].filter((e) => e.idx.length >= 3).map((e) => { e.soft = isSoft(e.k); return e; });
  }
  function gainOf(pool, e, L, base) {
    const L2 = new Set(L); L2.add(e.k);
    let s = 0; for (const i of e.idx) s += totalWith(pool[i], L2) - base[i];
    return s;
  }
  function renderLab() {
    const root = g("x-lab");
    const intro = head("Skill lab", "Switch on a skill your best postings ask for and see how your ranking would change. This is a what-if only: nothing is added to your CV, and you should write a skill on your CV only when you have really used it.");
    if (!CV) { paint(root, intro + `<div class="xempty"><b>Add your CV to use the lab</b>The lab compares your CV with the postings, so it needs your CV first.<div class="row"><a class="xbtn solid" href="#p=details" data-p="details">Add my CV</a></div></div>`); return; }
    if (SCORING || SCORED_FOR !== CV || !DICT) { paint(root, intro + `<div class="xempty"><b>Reading your CV against every posting…</b>${esc(SCORING || "One moment.")}</div>`); return; }
    const pool = labPool();
    if (pool.length < 5) { paint(root, intro + `<div class="xempty"><b>Too few postings fit your details</b>The lab needs at least five. Widen your choices on the details page.<div class="row"><a class="xbtn solid" href="#p=details" data-p="details">Edit my details</a></div></div>`); return; }
    const L = LAB.on;
    const base = pool.map((r) => totalWith(r, L));
    const cands = labCands(pool);
    const all = cands.map((e) => ({ e, gain: gainOf(pool, e, L, base) }));
    const lift = (arr, n) => arr.filter((x) => L.has(x.e.k) || x.gain > 0).sort((a, b) => (L.has(b.e.k) - L.has(a.e.k)) || b.gain - a.gain).slice(0, n);
    const hard = all.filter((x) => !x.e.soft), shown = lift(hard, 24), shownSoft = lift(all.filter((x) => x.e.soft), 12);
    const chip = (x) => `<button class="gain${x.e.soft ? " soft" : ""}" data-f="g-${esc(x.e.k)}" data-skill="${esc(x.e.k)}" aria-pressed="${L.has(x.e.k)}">${esc(x.e.name)} <em>${L.has(x.e.k) ? "on" : "+" + x.gain}</em></button>`;
    /* the three skills that lift the most, one after the other */
    const picks = []; const L3 = new Set(L); let b3 = base.slice();
    for (let s = 0; s < 3; s++) {
      let best = null;
      for (const x of hard) { if (L3.has(x.e.k)) continue; const gv = gainOf(pool, x.e, L3, b3); if (gv > 0 && (!best || gv > best.gain)) best = { e: x.e, gain: gv }; }
      if (!best) break;
      picks.push(best); L3.add(best.e.k); b3 = pool.map((r) => totalWith(r, L3));
    }
    const today = pool.map((r) => r.s.total);
    const order = (arr) => arr.map((t, i) => i).sort((a, b) => arr[b] - arr[a] || a - b);
    const o0 = order(today), o1 = order(base);
    const avg = (arr, o) => Math.round(o.slice(0, 10).reduce((s, i) => s + arr[i], 0) / Math.min(10, o.length));
    const strong = (arr) => arr.filter((v) => v >= 60).length;
    const d1 = avg(base, o1) - avg(today, o0), d2 = strong(base) - strong(today);
    const rank0 = new Map(o0.map((i, r) => [i, r + 1]));
    const list = o1.slice(0, 10).map((i, r) => {
      const jr = pool[i], up = rank0.get(i) - (r + 1), dl = base[i] - today[i];
      return `<li class="${dl > 0 || up !== 0 ? "moved" : ""}"><span class="rk">${r + 1}</span><span class="tt"><b>${esc(jr.j.title)}</b><span>${esc(jr.j.company)} · ${esc(jr.j.loc || "")}</span></span><span class="sc">${dl > 0 ? `<s>${today[i]}</s>` : ""}<b>${base[i]}</b>${dl > 0 || up > 0 ? `<span class="up">${dl > 0 ? "+" + dl + " points" : ""}${up > 0 ? (dl > 0 ? ", " : "") + "up from #" + rank0.get(i) : ""}</span>` : ""}</span></li>`;
    }).join("");
    const names = (arr) => arr.map((x) => esc(x.e.name)).join(", then ");
    const plan = picks.length ? `<div class="plan"><ol>${picks.map((x) => `<li><b>${esc(x.e.name)}</b>${x.e.idx.length ? ` · in ${x.e.idx.length} of your ${pool.length} best` : ""}</li>`).join("")}</ol><button class="xbtn solid" data-act="plan" data-f="plan">Try these ${picks.length}</button></div>` : `<p class="note">No single skill lifts your best postings any further.</p>`;
    paint(root, intro + `<div class="xgrid two">
      <section class="xp" aria-labelledby="labPick"><h2 id="labPick">Skills your best postings ask for</h2><p class="note">From your ${pool.length} best-fitting postings. The number is the total points the skill would add across them. Click to switch one on.</p>
        <div class="gains">${shown.map(chip).join("") || '<span class="note">Your CV already covers the role skills these postings ask for.</span>'}</div>
        ${shownSoft.length ? `<h3 style="font-size:14px;margin:16px 0 4px">General strengths these postings name</h3><p class="note" style="margin:0 0 8px">You may already have these. The score counts only what is written on your CV, so if you do, show each one with an example.</p><div class="gains">${shownSoft.map(chip).join("")}</div>` : ""}
        <div class="row" style="margin-top:12px"><button class="xbtn" data-act="clear" data-f="clear"${L.size ? "" : " disabled"}>Switch all off</button></div></section>
      <section class="xp" aria-labelledby="labPlan"><h2 id="labPlan">The fastest way up</h2><p class="note">The three role or tool skills that lift your best postings the most, one after the other.</p>${plan}
        <p class="note" style="margin-top:10px">A skill counts only where a posting names it. Learning it takes time, and an employer may still want experience. Use this to choose what to learn first, not as a promise.</p></section>
    </div>
    <section class="xp" style="margin-top:16px" aria-labelledby="labRes"><h2 id="labRes">${L.size ? `Your top 10 with ${L.size} skill${L.size === 1 ? "" : "s"} switched on` : "Your top 10 today"}</h2>
      <div class="kpis"><div class="kpi"><b>${avg(base, o1)}${d1 > 0 ? `<span class="d">+${d1}</span>` : ""}</b><span>average score of the top 10</span></div><div class="kpi"><b>${strong(base)}${d2 > 0 ? `<span class="d">+${d2}</span>` : ""}</b><span>of your ${pool.length} best score 60 or more</span></div><div class="kpi"><b>${L.size}</b><span>skills switched on</span></div></div>
      <ol class="reorder">${list}</ol>
      <p class="note" style="margin-top:10px">These scores come from the same rules as the main score, with the skills you switched on counted as present. This is a heuristic: differences of 5 points or less are ties.</p></section>`);
  }
  function onLabClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.skill) { if (LAB.on.has(b.dataset.skill)) LAB.on.delete(b.dataset.skill); else LAB.on.add(b.dataset.skill); renderLab(); }
    else if (b.dataset.act === "clear") { LAB.on.clear(); renderLab(); }
    else if (b.dataset.act === "plan") {
      const pool = labPool(), L = new Set(LAB.on); let base = pool.map((r) => totalWith(r, L));
      const cands = labCands(pool).filter((e) => !e.soft);
      for (let s = 0; s < 3; s++) {
        let best = null;
        for (const e of cands) { if (L.has(e.k)) continue; const gv = gainOf(pool, e, L, base); if (gv > 0 && (!best || gv > best.gain)) best = { e, gain: gv }; }
        if (!best) break; L.add(best.e.k); base = pool.map((r) => totalWith(r, L));
      }
      LAB.on = L; renderLab();
    }
  }

  /* =====================================================================
     CAREER LADDER
     ===================================================================== */
  const LAD = { fd: null, sel: null };
  let LC = new Map(), LC_V = "";
  function ladData(fd) {
    const v = JOBS_VER + "|" + JOBS.length;
    if (LC_V !== v) { LC = new Map(); LC_V = v; }
    if (LC.has(fd)) return LC.get(fd);
    const rungs = [0, 1, 2, 3, 4].map(() => ({ n: 0, titles: new Map(), skills: new Map() }));
    for (const j of JOBS) {
      if (fd && fdOf(j).id !== fd) continue;
      const r = rungs[lvOf(j).lvl]; r.n++;
      const tk = norm(j.title), te = r.titles.get(tk);
      if (te) te.n++; else r.titles.set(tk, { t: j.title, n: 1 });
      if (j.kw) {
        const seen = new Set();
        for (const c of j.kw) {
          if (c[1] !== "s") continue;
          const nm = c.slice(3), k = norm(nm);
          if (seen.has(k) || LANGSKILL.has(k)) continue;
          seen.add(k); const e = r.skills.get(k);
          if (e) e.n++; else r.skills.set(k, { name: nm, n: 1 });
        }
      }
    }
    LC.set(fd, rungs);
    return rungs;
  }
  /* skills that are much more common on rung i than on the one below it */
  function newOn(rungs, i) {
    const r = rungs[i], p = i ? rungs[i - 1] : null;
    if (!r || r.n < 15) return [];
    const out = [];
    for (const [k, e] of r.skills) {
      const sh = e.n / r.n, ps = p && p.n >= 15 ? (p.skills.get(k) ? p.skills.get(k).n / p.n : 0) : 0;
      if (sh >= 0.05 && sh >= 1.5 * ps && e.n >= 5) out.push({ k, name: e.name, sh, lift: sh - ps, soft: isSoft(k) });
    }
    out.sort((a, b) => b.lift - a.lift);
    return out.filter((x) => !x.soft).slice(0, 9).concat(out.filter((x) => x.soft).slice(0, 5));
  }
  function renderLadder() {
    const root = g("x-ladder");
    if (!JOBS.length) { paint(root, noJobs("ladder")); return; }
    const fc = {}; for (const j of JOBS) { const f = fdOf(j).id; fc[f] = (fc[f] || 0) + 1; }
    const fields = Object.keys(fc).sort((a, b) => (a === "other") - (b === "other") || fc[b] - fc[a]);
    if (LAD.fd === null) LAD.fd = P.fd && fc[P.fd] ? P.fd : "";
    const me = meBand();
    if (LAD.sel === null) LAD.sel = me !== null ? me : 1;
    const rungs = ladData(LAD.fd), sel = LAD.sel, mine = cvSkills();
    const total = rungs.reduce((s, r) => s + r.n, 0);
    const fldLabel = LAD.fd ? fieldLabel(LAD.fd) : "all fields";
    const stairs = `<div class="stairs" role="group" aria-label="Rungs of the ladder">${rungs.map((r, i) => `<button class="rung" data-f="r-${i}" data-rung="${i}" aria-pressed="${sel === i}" style="--h:${70 + i * 40}px">${me === i ? '<span class="you">You are here</span>' : ""}<b>${nf(r.n)}</b><small>${esc(LV[i].label)}</small></button>`).join("")}</div>`;
    const R = rungs[sel];
    const tlist = [...R.titles.values()].sort((a, b) => b.n - a.n).slice(0, 7);
    const repeated = tlist.length && tlist[0].n > 1;
    const allSk = [...R.skills.entries()].sort((a, b) => b[1].n - a[1].n);
    const skills = allSk.filter(([k]) => !isSoft(k)).slice(0, 9).map(([, e]) => e), strengths = allSk.filter(([k]) => isSoft(k)).slice(0, 5).map(([, e]) => e);
    const nw = newOn(rungs, sel);
    const next = sel < 4 ? newOn(rungs, sel + 1) : [];
    const chip = (x) => `<span class="${mine && mine.has(x.k) ? "mine" : ""}${x.soft ? " soft" : ""}">${esc(x.name)}</span>`;
    const detail = R.n
      ? `<div class="lad"><section class="xp" aria-labelledby="ladA"><h2 id="ladA">${esc(LV[sel].label)} in ${esc(fldLabel)}</h2><p class="note">${nf(R.n)} postings (${pct(R.n, total)}% of this field).</p>
          <h3 style="font-size:14px;margin:6px 0 4px">${repeated ? "Titles that come up most" : "Examples of titles"}</h3>
          <ul class="barlist">${tlist.map((t) => `<li><span class="bl"><span>${esc(t.t)}</span><span class="n">${repeated ? nf(t.n) : ""}</span></span></li>`).join("")}</ul>
          <h3 style="font-size:14px;margin:14px 0 4px">Skills asked for most</h3>
          <ul class="barlist">${skills.map((s) => `<li><span class="bl"><span>${esc(s.name)}${mine && mine.has(norm(s.name)) ? " ✓" : ""}</span><span class="n">${pct(s.n, R.n)}%</span><i style="--w:${pct(s.n, skills[0].n)}%;--bc:var(--l${sel})"></i></span></li>`).join("")}</ul>
          ${strengths.length ? `<p class="note" style="margin:8px 0 0">General strengths named: ${strengths.map((s) => esc(s.name) + " " + pct(s.n, R.n) + "%").join(", ")}.</p>` : ""}
          <div class="row" style="margin-top:12px"><button class="xbtn solid" data-act="see" data-f="see">See these ${nf(R.n)} postings</button></div></section>
        <section class="xp" aria-labelledby="ladB"><h2 id="ladB">${nw.length ? "New on this rung" : "What stands out"}</h2><p class="note">Skills far more common here than one rung down.</p>
          ${nw.length ? `<div class="newsk">${nw.map(chip).join("")}</div>` : '<p class="note">Nothing stands out against the rung below (too few postings, or the same skills carry up).</p>'}
          ${mine ? '<p class="note" style="margin-top:10px">A ✓ marks a skill that is on your CV.</p>' : ""}</section></div>
        ${sel < 4 ? `<section class="climb" aria-labelledby="ladC"><h2 id="ladC">To climb from ${esc(LV[sel].label)} to ${esc(LV[sel + 1].label)}</h2>${next.length ? `<p class="note" style="margin:0 0 8px">These skills show up much more on the next rung in ${esc(fldLabel)}:</p><div class="newsk">${next.map(chip).join("")}</div>` : '<p class="note" style="margin:0">The next rung has too few postings in this field to say.</p>'}<div class="row" style="margin-top:12px"><button class="xbtn" data-act="seenext" data-f="seenext">See the ${nf(rungs[sel + 1].n)} postings one rung up</button></div></section>` : ""}`
      : `<div class="xempty" style="margin-top:16px"><b>No postings on this rung</b>There are no ${esc(LV[sel].label)} postings in ${esc(fldLabel)}. Try another rung or field.</div>`;
    paint(root, head("Career ladder", `Five rungs, from student to executive. Pick a field to see how many postings sit on each rung, what they ask for, and what is new on the next one.`) +
      `<div class="row" style="margin-bottom:6px"><label for="ladField" style="margin:0">Field</label><select id="ladField" style="width:auto;max-width:100%" data-f="ladField">${[["", "All fields (" + nf(JOBS.length) + ")"], ...fields.map((f) => [f, fieldLabel(f) + " (" + nf(fc[f]) + ")"])].map(([v, l]) => `<option value="${esc(v)}"${LAD.fd === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>` + stairs + detail);
  }
  function onLadderClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rung != null) { LAD.sel = +b.dataset.rung; renderLadder(); }
    else if (b.dataset.act === "see" || b.dataset.act === "seenext") {
      const lvl = LAD.sel + (b.dataset.act === "seenext" ? 1 : 0), c = { full: 0, part: 0, intern: 0 };
      JOBS.forEach((j) => { if ((!LAD.fd || fdOf(j).id === LAD.fd) && lvOf(j).lvl === lvl) c[j.kind]++; });
      goJobs({ f: { fd: LAD.fd, lvl: String(lvl) }, tab: bestTab(c) });
    }
  }

  /* =====================================================================
     QUICK SORT
     ===================================================================== */
  const SW = { dec: store.get("pm_swipe", {}), undo: [], lock: false };
  const saveSw = () => { const k = Object.keys(SW.dec); if (k.length > 3000) k.slice(0, k.length - 3000).forEach((x) => delete SW.dec[x]); store.set("pm_swipe", SW.dec); };
  function deck() {
    let pool;
    if (CV && SCORED_FOR === CV && !SCORING && DICT) pool = rankPool(80, 2).all;
    else pool = JOBS.filter(prefOk).sort((a, b) => age(a) - age(b)).slice(0, 80).map((j) => ({ j, s: null }));
    const todo = pool.filter((r) => { const k = jkey(r.j); return SW.dec[k] === undefined && !SAVED.has(k); });
    return { pool, todo, scored: pool.length > 0 && !!pool[0].s };
  }
  function cardHtml(r, cls) {
    const j = r.j, s = r.s, lv = lvOf(j), a = age(j);
    const ms = s ? s.rows.filter((x) => x.st === "M" && (x.kind === "s" || /\s/.test(x.n))).slice(0, 4).map((x) => x.n) : [];
    const gs = s ? s.rows.filter((x) => x.st === "G" && (x.tag === "T" || x.tag === "R" || x.tag === "K") && (x.kind === "s" || /\s/.test(x.n)) && !LANGSKILL.has(norm(x.n))).slice(0, 3).map((x) => x.n) : [];
    const kws = !s ? (j.kw || []).filter((c) => c[1] === "s").slice(0, 5).map((c) => c.slice(3)) : [];
    return `<article class="sc2 ${cls}" style="--c:var(--l${lv.lvl})" aria-label="${esc(j.title)} at ${esc(j.company)}">
      <span class="stamp save">SAVE</span><span class="stamp skip">SKIP</span>
      <div class="kind">${esc(KIND_NAME[j.kind])} · ${esc(whenOf(j))}</div>
      <h2>${esc(j.title)}</h2>
      <div class="meta"><span>${esc(j.company)}</span><span>${esc(j.loc || PROV_NAME[j.province] || "")}</span></div>
      <div class="tags" style="margin-top:10px"><span class="pill lvl lv${lv.lvl}" title="${esc(lv.why || "")}">${esc(LV[lv.lvl].label)}</span>${fieldPill(fdOf(j))}${j.type ? pill("", j.type) : ""}${a < 24 ? pill("n", "24h") : ""}</div>
      ${s ? `<div class="sc2score"><b class="${scCls(s.total)}">${s.total}</b><span>out of 100 · ${s.conf === "Full text" ? "from the full text" : s.conf === "Occupation profile" ? "from the occupation profile" : s.conf === "Short snippet" ? "from a short snippet" : "from the title only"}</span></div>${scoreMeter(s)}` : ""}
      <div class="why2">${s ? (ms.length ? `<h3>Match <span class="note">on your CV</span></h3><div class="kw">${ms.map((m) => `<span class="M">${esc(m)}</span>`).join("")}</div>` : "") + (gs.length ? `<h3>Gap <span class="note">asked for, not on your CV</span></h3><div class="kw">${gs.map((m) => `<span class="G">${esc(m)}</span>`).join("")}</div>` : "") : (kws.length ? `<h3>What the posting asks for</h3><div class="kw">${kws.map((m) => `<span class="N">${esc(m)}</span>`).join("")}</div><p class="note" style="margin-top:8px">Add your CV and these cards come ranked by how well you fit.</p>` : "")}</div>
      <div class="foot">${s && s.flags.length ? s.flags.filter((f) => f[0] === "b" || f[0] === "w").slice(0, 2).map((f) => esc(f[1])).join(" · ") : ""}</div></article>`;
  }
  function renderSwipe() {
    const root = g("x-swipe");
    const intro = head("Quick sort", "One posting at a time: save the ones you would apply to, skip the rest. Drag the card, use the buttons, or press the left and right arrow keys.");
    if (!JOBS.length) { paint(root, noJobs("swipe")); return; }
    if (CV && (SCORING || SCORED_FOR !== CV || !DICT)) { paint(root, intro + `<div class="xempty"><b>Reading your CV against every posting…</b>${esc(SCORING || "One moment.")}</div>`); return; }
    const d = deck(), done = d.pool.length - d.todo.length;
    const saved = d.pool.filter((r) => SW.dec[jkey(r.j)] === 1 || SAVED.has(jkey(r.j))).length;
    if (!d.pool.length) { paint(root, intro + `<div class="xempty"><b>Nothing fits your choices</b>Widen the place, the kind of work or the language on the details page.<div class="row"><a class="xbtn solid" href="#p=details" data-p="details">Edit my details</a></div></div>`); return; }
    if (!d.todo.length) {
      const skipped = Object.values(SW.dec).filter((v) => v === 0).length;
      paint(root, intro + `<div class="xempty"><b>You have been through all ${d.pool.length} cards</b>You saved ${saved}. ${saved ? "They are on your board, ready to apply to." : "Nothing is saved yet."}<div class="row"><a class="xbtn solid" href="#p=board" data-p="board">Open my board</a>${skipped ? '<button class="xbtn" data-act="reset" data-f="reset">Bring the skipped ones back</button>' : ""}<a class="xbtn" href="#p=details" data-p="details">Change my details for a new deck</a></div></div>`);
      return;
    }
    const cards = d.todo.slice(0, 3).map((r, i) => cardHtml(r, i === 0 ? "cur" : "b" + i)).reverse().join("");
    paint(root, intro + `<div class="deckwrap"><div class="swprog" role="progressbar" aria-valuemin="0" aria-valuemax="${d.pool.length}" aria-valuenow="${done}" aria-label="Cards sorted"><i style="--w:${pct(done, d.pool.length)}%"></i></div>
      <div class="swmeta" style="margin:0 0 12px">${done} of ${d.pool.length} sorted · ${saved} saved${d.scored ? "" : " · newest postings that fit your choices"}</div>
      <div class="deck" id="deck">${cards}</div>
      <div class="swbtns"><button class="swb no" data-act="skip" data-f="skip" aria-label="Skip (left arrow)"><span>✕</span><small>Skip</small></button>
        <button class="swb mid" data-act="undo" data-f="undo" aria-label="Undo (Z)"${SW.undo.length ? "" : " disabled"}><span>↶</span></button>
        <button class="swb mid" data-act="open" data-f="open" aria-label="Open the posting in a new tab (up arrow)"><span>↗</span></button>
        <button class="swb yes" data-act="save" data-f="save" aria-label="Save (right arrow)"><span>★</span><small>Save</small></button></div>
      <p class="swmeta" aria-live="polite" id="swsay"></p></div>`);
    bindDeck();
  }
  function topCard() { return document.querySelector("#deck .sc2.cur"); }
  function decide(v) {
    if (SW.lock) return;
    const d = deck(), r = d.todo[0]; if (!r) return;
    const card = topCard(); SW.lock = true;
    const finish = () => {
      const k = jkey(r.j);
      SW.dec[k] = v; SW.undo.push(k);
      if (v === 1) { SAVED.add(k); saveSaved(); XP.onStar(k, true); }
      saveSw(); SW.lock = false; renderSwipe();
      const say = g("swsay"); if (say) say.textContent = (v ? "Saved: " : "Skipped: ") + r.j.title;
    };
    if (!card || reduceMotion()) { finish(); return; }
    card.classList.add("fly");
    card.style.transform = `translateX(${v ? 700 : -700}px) rotate(${v ? 22 : -22}deg)`; card.style.opacity = "0";
    setTimeout(finish, 270);
  }
  function undo() {
    const k = SW.undo.pop(); if (!k) return;
    if (SW.dec[k] === 1) { SAVED.delete(k); saveSaved(); XP.onStar(k, false); }
    delete SW.dec[k]; saveSw(); renderSwipe();
  }
  function bindDeck() {
    const card = topCard(); if (!card) return;
    let x0 = null, dx = 0;
    const stamp = (cls) => card.querySelector(".stamp." + cls);
    const move = (e) => {
      if (x0 === null) return; dx = e.clientX - x0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
      stamp("save").style.opacity = Math.max(0, Math.min(1, dx / 110)); stamp("skip").style.opacity = Math.max(0, Math.min(1, -dx / 110));
    };
    const up = () => {
      if (x0 === null) return; x0 = null; card.classList.remove("drag");
      if (dx > 110) decide(1); else if (dx < -110) decide(0);
      else { card.style.transform = ""; stamp("save").style.opacity = 0; stamp("skip").style.opacity = 0; }
      dx = 0;
    };
    card.addEventListener("pointerdown", (e) => { if (e.target.closest("a,button")) return; x0 = e.clientX; dx = 0; card.classList.add("drag"); card.setPointerCapture(e.pointerId); });
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerup", up);
    card.addEventListener("pointercancel", up);
  }
  function onSwipeClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    const a = b.dataset.act;
    if (a === "save") decide(1); else if (a === "skip") decide(0); else if (a === "undo") undo();
    else if (a === "open") { const r = deck().todo[0]; if (r && r.j.sources[0]) window.open(r.j.sources[0].url, "_blank", "noopener"); }
    else if (a === "reset") { Object.keys(SW.dec).forEach((k) => { if (SW.dec[k] === 0) delete SW.dec[k]; }); saveSw(); renderSwipe(); }
  }
  document.addEventListener("keydown", (e) => {
    if (PG !== "swipe" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName || "")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); decide(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); decide(0); }
    else if (e.key === "ArrowUp") { e.preventDefault(); const r = deck().todo[0]; if (r && r.j.sources[0]) window.open(r.j.sources[0].url, "_blank", "noopener"); }
    else if (e.key === "z" || e.key === "Z") undo();
  });

  /* =====================================================================
     APPLICATION BOARD
     ===================================================================== */
  const COLS = [["saved", "Saved"], ["applied", "Applied"], ["interview", "Interview"], ["offer", "Offer"], ["closed", "Closed"]];
  const BOARD = store.get("pm_board", {});
  let GOAL = store.get("pm_goal", 5);
  const saveBoard = () => store.set("pm_board", BOARD);
  function snapshot(j, k) {
    const s = scoreOf(k);
    return { t: j.title, co: j.company, pv: j.province || "", u: j.sources && j.sources[0] ? j.sources[0].url : "", sc: s, at: Date.now() };
  }
  function boardAdd(k) {
    if (BOARD[k]) return;
    const j = jobByKey(k); if (!j) return;
    BOARD[k] = Object.assign({ c: "saved" }, snapshot(j, k)); saveBoard();
  }
  function entries() {
    const keys = new Set([...SAVED, ...Object.keys(BOARD)]);
    return [...keys].map((k) => {
      const b = BOARD[k] || {}, j = jobByKey(k);
      let t = b.t, co = b.co, pv = b.pv, u = b.u;
      if (j) { t = t || j.title; co = co || j.company; pv = pv != null ? pv : j.province; u = u || (j.sources[0] && j.sources[0].url) || ""; }
      if (!t) { const p = k.split("|"); t = p[1] || k; co = p[0] || ""; pv = p[2] || ""; }
      const sc = b.sc != null ? b.sc : scoreOf(k);
      return { k, c: b.c || "saved", t, co, pv, u, sc, a: b.a || null, m: b.m || b.at || 0, iv: !!b.iv, gone: !j && !b.t, manual: !!b.manual };
    }).sort((x, y) => y.m - x.m);
  }
  function move(k, c) {
    const b = BOARD[k] || (BOARD[k] = Object.assign({ c: "saved" }, jobByKey(k) ? snapshot(jobByKey(k), k) : { at: Date.now() }));
    const was = b.c; b.c = c; b.m = Date.now();
    if (c !== "saved" && !b.a) b.a = Date.now();
    if (c === "interview" || c === "offer") b.iv = true;
    if (b.sc == null) { const s = scoreOf(k); if (s != null) b.sc = s; }
    if (was !== c) { saveBoard(); }
  }
  const weekStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };
  function sprint(list) {
    const WK = 7 * 864e5, ws = weekStart(Date.now()), ap = list.filter((e) => e.a).map((e) => e.a);
    const inWeek = (w) => ap.filter((t) => t >= w && t < w + WK).length;
    const now = inWeek(ws);
    let streak = 0, w = ws - WK;
    if (now >= GOAL) streak = 1;
    while (inWeek(w) >= GOAL && streak < 520) { streak++; w -= WK; }
    return { now, streak };
  }
  function yieldTable(list) {
    const apps = list.filter((e) => e.a);
    const bands = [["60 or more", (s) => s != null && s >= 60], ["45 to 59", (s) => s != null && s >= 45 && s < 60], ["under 45", (s) => s != null && s < 45], ["not scored", (s) => s == null]];
    return { n: apps.length, rows: bands.map(([l, f]) => { const a = apps.filter((e) => f(e.sc)); return { l, n: a.length, iv: a.filter((e) => e.iv).length }; }) };
  }
  function cardB(e) {
    const idx = COLS.findIndex((c) => c[0] === e.c), prev = COLS[idx - 1], next = COLS[idx + 1];
    return `<div class="bc" draggable="true" data-k="${esc(e.k)}"><b>${esc(e.t)}${e.sc != null ? `<span class="chipsc ${scCls(e.sc)}" title="Match score when it was saved or applied to">${e.sc}</span>` : ""}</b>
      <div class="m">${esc(e.co)}${e.pv ? " · " + esc(PROV_NAME[e.pv] || e.pv) : ""}</div>
      <div class="m">${e.c === "saved" ? "" : (e.a ? "Applied " + ago(e.a) : "") + (e.c === "interview" || e.c === "offer" ? " · got an interview" : "")}${e.gone ? "No longer in the collection" : ""}</div>
      <div class="bt">${prev ? `<button data-mv="${prev[0]}" aria-label="Move to ${prev[1]}" title="Move to ${prev[1]}">◀</button>` : ""}${next ? `<button data-mv="${next[0]}" aria-label="Move to ${next[1]}" title="Move to ${next[1]}">▶</button>` : ""}${e.u ? `<a href="${esc(e.u)}" target="_blank" rel="noopener">Open ↗</a>` : ""}<button class="sp1" data-rm="1" aria-label="Remove from the board" title="Remove from the board">✕</button></div></div>`;
  }
  const ago = (t) => { const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? "today" : d === 1 ? "1 day ago" : d + " days ago"; };
  function renderBoard() {
    const root = g("x-board");
    const list = entries(), sp = sprint(list), y = yieldTable(list);
    const by = {}; COLS.forEach((c) => (by[c[0]] = []));
    list.forEach((e) => (by[e.c] || by.saved).push(e));
    const pc = Math.min(100, Math.round((100 * sp.now) / GOAL));
    const msg = sp.now >= GOAL ? "Goal reached this week. Well done." : `${GOAL - sp.now} more to reach this week's goal.`;
    const empty = !list.length;
    const yieldHtml = y.n < 5
      ? `<p class="note">You have ${y.n} application${y.n === 1 ? "" : "s"} on the board. With fewer than 5 there is nothing to compare yet. Mark applications as they happen and this table fills in.</p>`
      : `<table class="yield"><thead><tr><th>Match score when you applied</th><th>Applications</th><th>Got an interview</th><th>Rate</th></tr></thead><tbody>${y.rows.map((r) => `<tr><td>${r.l}</td><td class="r">${r.n}</td><td class="r">${r.iv}</td><td class="r">${r.n ? pct(r.iv, r.n) + "%" : "–"}</td></tr>`).join("")}</tbody></table><p class="note" style="margin-top:8px">This is your own small sample, not a measure of the score. Few applications make these rates very uncertain.</p>`;
    paint(root, head("Application board", "Everything you saved, in one place. Move a card along as things happen. It lives in this browser only. Path Match never applies for you or contacts an employer.") +
      `<div class="boardtop"><section class="xp" aria-labelledby="bdSp"><h2 id="bdSp">This week</h2><div class="sprint"><div class="ring" style="--p:${pc}" role="img" aria-label="${sp.now} of ${GOAL} applications this week"><span>${sp.now}/${GOAL}</span></div>
          <div><p><b>${esc(msg)}</b></p><p class="note">${sp.streak ? `${sp.streak} week${sp.streak === 1 ? "" : "s"} in a row on target.` : "No streak yet."}</p>
          <label for="goal" style="margin:6px 0 2px">Applications a week I aim for</label><select id="goal" data-f="goal" style="width:auto">${[3, 5, 8, 10, 15, 20].map((n) => `<option${n === GOAL ? " selected" : ""}>${n}</option>`).join("")}</select></div></div></section>
        <section class="xp" aria-labelledby="bdY"><h2 id="bdY">Does a higher score lead to more interviews?</h2><p class="note">Your own applications, grouped by the match score they had.</p>${yieldHtml}</section></div>
      <section class="xp" style="margin-top:16px" aria-labelledby="bdAdd"><h2 id="bdAdd">Add an application by hand</h2><p class="note">For a job you found somewhere else.</p>
        <form class="addform" id="addform"><input type="text" id="addT" placeholder="Job title" aria-label="Job title" required><input type="text" id="addC" placeholder="Company" aria-label="Company" required><button class="xbtn solid" type="submit">Add as applied</button><button class="xbtn" type="button" data-act="csv" data-f="csv"${empty ? " disabled" : ""}>Download as CSV</button></form></section>
      ${empty ? `<div class="xempty" style="margin-top:16px"><b>Your board is empty</b>Star a posting in All jobs or your top 10, or save cards in Quick sort, and they land here.<div class="row"><a class="xbtn solid" href="#p=swipe" data-p="swipe">Start Quick sort</a><a class="xbtn" href="#p=jobs" data-p="jobs">Browse all jobs</a></div></div>` : ""}
      <div class="cols" id="cols">${COLS.map(([c, l]) => `<section class="col" data-c="${c}" aria-label="${l}"><h2>${l}<span>${by[c].length}</span></h2>${by[c].map(cardB).join("") || '<p class="note" style="margin:0">Nothing here.</p>'}</section>`).join("")}</div>
      <p class="note" style="margin-top:10px">Drag a card to another column, or use the arrows. Moving a card to Applied only records that you applied.</p>`);
  }
  function csv() {
    const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const rows = [["Title", "Company", "Province", "Stage", "Match score", "Applied", "Link"], ...entries().map((e) => [e.t, e.co, e.pv, (COLS.find((c) => c[0] === e.c) || [])[1], e.sc, e.a ? new Date(e.a).toISOString().slice(0, 10) : "", e.u])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "path-match-board.csv"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function onBoardClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    const card = b.closest(".bc"), k = card && card.dataset.k;
    if (b.dataset.mv && k) { move(k, b.dataset.mv); renderBoard(); }
    else if (b.dataset.rm && k) { delete BOARD[k]; if (SAVED.delete(k)) saveSaved(); saveBoard(); renderBoard(); }
    else if (b.dataset.act === "csv") csv();
  }
  function bindBoard(root) {
    root.addEventListener("click", onBoardClick);
    root.addEventListener("change", (e) => { if (e.target.id === "goal") { GOAL = +e.target.value || 5; store.set("pm_goal", GOAL); renderBoard(); } });
    root.addEventListener("submit", (e) => {
      if (e.target.id !== "addform") return; e.preventDefault();
      const t = g("addT").value.trim(), c = g("addC").value.trim(); if (!t || !c) return;
      const k = "manual|" + Date.now();
      BOARD[k] = { c: "applied", t, co: c, pv: "", u: "", sc: null, at: Date.now(), a: Date.now(), m: Date.now(), manual: true }; saveBoard(); renderBoard();
    });
    let drag = null;
    root.addEventListener("dragstart", (e) => { const c = e.target.closest(".bc"); if (!c) return; drag = c.dataset.k; c.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", drag); } catch (x) { /* some browsers */ } });
    root.addEventListener("dragend", () => { drag = null; root.querySelectorAll(".dragging,.over").forEach((n) => n.classList.remove("dragging", "over")); });
    root.addEventListener("dragover", (e) => { const col = e.target.closest(".col"); if (col && drag) { e.preventDefault(); root.querySelectorAll(".over").forEach((n) => n !== col && n.classList.remove("over")); col.classList.add("over"); } });
    root.addEventListener("drop", (e) => { const col = e.target.closest(".col"); if (!col || !drag) return; e.preventDefault(); move(drag, col.dataset.c); drag = null; renderBoard(); });
  }

  /* =====================================================================
     WEEK PLAN: the few postings worth this week's applications (the maths is in planner.js)
     ===================================================================== */
  const PLAN = { n: store.get("pm_plan_n", null), half: store.get("pm_plan_half", "balanced"), noelig: !!store.get("pm_plan_elig", false), msg: "" };
  const planN = () => Math.max(3, Math.min(15, +PLAN.n || GOAL || 5));
  const dayAge = (j) => Math.max(0, age(j) / 24);
  const whenTxt = (d) => { d = Math.round(d); return d < 1 ? "Posted today" : d === 1 ? "Posted 1 day ago" : "Posted " + d + " days ago"; };
  const onBoardKeys = () => new Set(Object.keys(BOARD).filter((k) => BOARD[k].c && BOARD[k].c !== "saved"));
  /* postings of named employers with a full text that fit the person's details, minus what is already on the board as applied */
  function planPool(done) {
    const out = [];
    for (const r of RES) {
      const j = r.j, s = r.s;
      if (!s || j.od || isOcc(j) || s.past || !hasText(j) || j.partial || !prefOk(j) || done.has(jkey(j))) continue;
      out.push(r);
    }
    return out;
  }
  function planData(nOverride) {
    const half = Planner.HALF[PLAN.half] || Planner.HALF.balanced, done = onBoardKeys(), pool = planPool(done);
    const top = pool.map((r) => ({ r, u: r.s.total * Planner.fresh(dayAge(r.j), half) })).sort((a, b) => b.u - a.u).slice(0, 300);
    const cands = top.map(({ r }) => {
      if (!r._rg || r._rg.s !== r.s) { const x = Planner.range(Scoring, r.s.rows, r.s.fit, r.s.ti, jkey(r.j)); r._rg = { s: r.s, lo: x.lo, mid: x.mid, hi: x.hi }; }
      return { key: jkey(r.j), company: r.j.company, lo: r._rg.lo, mid: r._rg.mid, hi: r._rg.hi, ageDays: dayAge(r.j), block: PLAN.noelig && eligOf(r.j).sec ? "security" : "", r };
    });
    const res = Planner.pick(cands, { n: nOverride || planN(), half, perEmployer: 2 });
    const mean = pool.length ? pool.reduce((a, r) => a + r.s.total, 0) / pool.length : 0;
    return { chosen: res.chosen, skipped: res.skipped, cands, front: Planner.pareto(cands), half, considered: pool.length, mean };
  }
  const WHY = {
    block: () => "Mentions a security check or citizenship, which you chose to leave out",
    employer: (s) => "Your plan already has two postings from " + esc(s.company),
    old: (s) => "Posted " + s.note + " days ago: older postings count for less",
    wide: (s) => "Wide score range (" + s.note + "): less to go on",
    lower: (s) => "Lower priority than your last pick (" + s.note + ")",
    full: () => "All places are taken"
  };
  function planRow(c, i) {
    const j = c.r.j, s = c.r.s, e = eligOf(j), url = j.sources.find((x) => x.url);
    const kws = s.rows.filter((x) => x.st === "M" && (x.tag === "T" || x.tag === "R")).slice(0, 3).map((x) => x.n);
    return `<li class="wkrow" data-k="${esc(c.key)}"><span class="wkrk">${i + 1}</span><div class="wkb"><b class="wkt">${esc(j.title)}</b>
      <span class="wkm">${esc(j.company)} · ${esc(j.loc || "Location not stated")} · ${whenTxt(c.ageDays)}</span>
      <div class="wkrg"><span class="rg" role="img" aria-label="Score ${c.mid}, likely range ${c.lo} to ${c.hi}"><i style="left:${c.lo}%;width:${Math.max(2, c.hi - c.lo)}%"></i><b style="left:${c.mid}%"></b></span><span class="wks"><b>${c.mid}</b> <small>range ${c.lo}–${c.hi}</small></span></div>
      ${kws.length ? `<span class="wkm">On your CV: ${kws.map(esc).join(", ")}</span>` : ""}
      ${e.sec || e.grad ? `<span class="wkf">${e.sec ? '<span class="pill w">Security or citizenship wording: verify</span>' : ""}${e.grad ? '<span class="pill w">May be for new graduates only</span>' : ""}</span>` : ""}
      <div class="row">${url ? `<a class="xbtn" href="${esc(url.url)}" target="_blank" rel="noopener">Open posting</a>` : ""}<button class="xbtn solid" data-act="applied" data-k="${esc(c.key)}">I applied</button></div></div></li>`;
  }
  /* score against age: grey dots are all candidates, the line is the Pareto front, numbered dots are the plan */
  function planChart(d) {
    const pts = d.cands; if (pts.length < 5) return "";
    const W = 640, H = 300, L = 40, R = 14, T = 12, B = 42;
    const maxAge = Math.max(14, Math.min(120, Math.ceil(Math.max(...pts.map((p) => p.ageDays)) / 7) * 7));
    const ys = pts.map((p) => p.lo), y0 = Math.max(0, Math.floor((Math.min(...ys) - 4) / 10) * 10), y1 = Math.min(100, Math.ceil((Math.max(...ys) + 4) / 10) * 10);
    const X = (a) => +(L + (Math.min(a, maxAge) / maxAge) * (W - L - R)).toFixed(1), Y = (v) => +(T + (1 - (v - y0) / Math.max(1, y1 - y0)) * (H - T - B)).toFixed(1);
    const rank = new Map(d.chosen.map((c, i) => [c.key, i + 1]));
    const front = d.front.map((i) => pts[i]).sort((a, b) => a.ageDays - b.ageDays);
    let path = ""; front.forEach((p, i) => { path += i ? `H${X(p.ageDays)}V${Y(p.lo)}` : `M${X(p.ageDays)} ${Y(p.lo)}`; }); if (front.length) path += `H${W - R}`;
    const grid = []; for (let v = y0; v <= y1; v += 10) grid.push(`<line class="pcg" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="pct" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`);
    for (let a = 0; a <= maxAge; a += maxAge > 60 ? 14 : 7) grid.push(`<text class="pct" x="${X(a)}" y="${H - B + 16}" text-anchor="middle">${a}</text>`);
    const dots = pts.filter((p) => !rank.has(p.key)).map((p) => `<circle class="pcd" cx="${X(p.ageDays)}" cy="${Y(p.lo)}" r="3"/>`).join("");
    const picks = d.chosen.map((c, i) => `<g><circle class="pcp" cx="${X(c.ageDays)}" cy="${Y(c.lo)}" r="10"/><text class="pcn" x="${X(c.ageDays)}" y="${Y(c.lo) + 4}" text-anchor="middle">${i + 1}</text></g>`).join("");
    return `<svg class="wkchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${pts.length} candidate postings by days since posted and cautious score. The ${d.chosen.length} numbered points are your plan; the line joins the postings that no other posting beats on both newness and score.">${grid.join("")}<path class="pcl" d="${path}"/>${dots}${picks}
      <text class="pct" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">Days since posted (newer on the left)</text><text class="pct" transform="translate(11 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Cautious score</text></svg>`;
  }
  function savedPlanHtml() {
    const sp = store.get("pm_plan", null);
    if (!sp || !Array.isArray(sp.items) || !sp.items.length || !JOBS.length) return "";
    const rows = sp.items.map((it) => { const j = jobByKey(it.k), b = BOARD[it.k]; return { it, st: b && b.c !== "saved" ? "applied" : !j ? "gone" : dayAge(j) >= 30 ? "old" : "listed" }; });
    const n = (st) => rows.filter((r) => r.st === st).length;
    const lab = { applied: ["g", "Applied"], listed: ["", "Still listed"], old: ["w", "Listed, 30+ days old"], gone: ["b", "No longer listed"] };
    const when = new Date(sp.at).toLocaleDateString("en-CA");
    return `<section class="xp" style="margin-top:16px" aria-labelledby="wkSaved"><h2 id="wkSaved">Your saved plan, checked again today</h2>
      <p class="note">Saved on ${esc(when)}. Today: <b>${n("listed") + n("old")}</b> still listed, <b>${n("applied")}</b> applied, <b>${n("gone")}</b> no longer listed${n("gone") ? " (probably filled or taken down)" : ""}. The list of postings is collected again every day.</p>
      <ul class="wkchk">${rows.map((r) => `<li><span>${esc(r.it.t)} <small>${esc(r.it.co)}</small></span><span class="pill ${lab[r.st][0]}">${lab[r.st][1]}</span></li>`).join("")}</ul>
      <div class="row" style="margin-top:10px"><button class="xbtn" data-act="clearplan" data-f="clearplan">Delete the saved plan</button></div></section>`;
  }
  function renderPlan() {
    const root = g("x-plan");
    const intro = head("Week plan", "The few postings worth your applications this week. Each one gets a cautious score, a range for how sure that score is, and a weight for how fresh it is. Nothing is applied for you.");
    if (!CV) { paint(root, intro + `<div class="xempty"><b>Add your CV to plan your week</b>The plan compares your CV with the postings, so it needs your CV first.<div class="row"><a class="xbtn solid" href="#p=details" data-p="details">Add my CV</a></div></div>`); return; }
    if (SCORING || SCORED_FOR !== CV || !DICT) { paint(root, intro + `<div class="xempty"><b>Reading your CV against every posting…</b>${esc(SCORING || "One moment.")}</div>`); return; }
    const d = planData();
    if (d.considered < 5) { paint(root, intro + `<div class="xempty"><b>Too few postings fit your details</b>The plan needs at least five employer postings with a full text. Widen your choices on the details page.<div class="row"><a class="xbtn solid" href="#p=details" data-p="details">Edit my details</a></div></div>`); return; }
    const N = planN(), ch = d.chosen, avgLo = ch.length ? Math.round(ch.reduce((a, c) => a + c.lo, 0) / ch.length) : 0, avgMid = ch.length ? Math.round(ch.reduce((a, c) => a + c.mid, 0) / ch.length) : 0;
    const fresh7 = ch.filter((c) => c.ageDays < 7).length, meanR = Math.round(d.mean);
    const doneWk = sprint(entries()).now;
    const halves = [["fit", "Fit first", "weight halves every " + Planner.HALF.fit + " days"], ["balanced", "Balanced", "weight halves every " + Planner.HALF.balanced + " days"], ["fresh", "Newest first", "weight halves every " + Planner.HALF.fresh + " days"]];
    const skip = d.skipped.filter((x) => x.why !== "full").sort((a, b) => b.mid - a.mid).slice(0, 5);
    const msg = PLAN.msg; PLAN.msg = "";
    paint(root, intro + `${msg ? `<p class="wkmsg" role="status">${esc(msg)}</p>` : ""}
    <section class="xp" aria-labelledby="wkSet"><h2 id="wkSet">Set up the week</h2>
      <div class="wkset">
        <div><label for="plN"><b>Applications this week</b></label><div class="wkn"><input type="range" id="plN" min="3" max="15" step="1" value="${N}" data-f="plN" aria-describedby="plNo"><output id="plNo" for="plN">${N}</output></div><p class="note">${doneWk} already logged on your board this week.</p></div>
        <fieldset><legend><b>How much should newness count?</b></legend>${halves.map((h) => `<label class="wkopt"><input type="radio" name="plHalf" value="${h[0]}" ${PLAN.half === h[0] ? "checked" : ""}> <span>${h[1]} <small>${h[2]}</small></span></label>`).join("")}</fieldset>
        <div><label class="wkopt"><input type="checkbox" id="plElig" ${PLAN.noelig ? "checked" : ""}> <span>Leave out postings that mention a security check or citizenship</span></label><p class="note">Read from the posting text. Your place, kinds of work, language and field come from <a href="#p=details" data-p="details">your details</a>.</p></div>
      </div></section>
    <div class="kpis wkk"><div class="kpi"><b>${avgMid}</b><span>average score of the plan, against ${meanR} for a posting picked at random from the same ${nf(d.considered)}</span></div><div class="kpi"><b>${avgLo}</b><span>average cautious score (the low end of each range)</span></div><div class="kpi"><b>${fresh7} of ${ch.length}</b><span>posted in the last 7 days</span></div></div>
    <div class="xgrid two">
      <section class="xp" aria-labelledby="wkList"><h2 id="wkList">Your ${ch.length} for this week</h2><p class="note">In order of priority: cautious score times freshness, at most two from one employer. The bar shows the range, the tick the score.</p>
        <ol class="wklist">${ch.map(planRow).join("") || '<li class="note">Nothing to plan with these choices.</li>'}</ol>
        <div class="row" style="margin-top:12px"><button class="xbtn solid" data-act="saveplan" data-f="saveplan">Save this plan</button><button class="xbtn" data-act="copyplan" data-f="copyplan">Copy the plan</button><a class="xbtn" href="#p=board" data-p="board">Open the board</a></div></section>
      <div>
        <section class="xp" aria-labelledby="wkChart"><h2 id="wkChart">Where your picks sit</h2><p class="note">Each dot is a posting. The line joins the ones no other posting beats on both newness and score.</p>${planChart(d)}</section>
        <section class="xp" style="margin-top:16px" aria-labelledby="wkWhy"><h2 id="wkWhy">Next in line, and why they missed out</h2>${skip.length ? `<ul class="wkchk">${skip.map((x) => `<li><span>${esc(x.r.j.title)} <small>${esc(x.company)} · score ${x.mid}</small><em>${(WHY[x.why] || WHY.full)(x)}</em></span></li>`).join("")}</ul>` : '<p class="note">Nothing close was left out.</p>'}</section>
      </div>
    </div>
    ${savedPlanHtml()}
    <details class="xp wkhow" style="margin-top:16px"><summary>How the plan is worked out</summary>
      <ol><li><b>Range.</b> A score depends on which keywords were found in the text. Each posting's keywords are re-drawn 120 times and scored again; the 20th to 80th percentile is the range. Few keywords make a wide range.</li>
      <li><b>Cautious score.</b> The low end of the range. A posting has to look good even if the reading was a little unlucky.</li>
      <li><b>Freshness.</b> An older posting is more likely filled, so its weight halves every ${Planner.HALF[PLAN.half]} days (your choice above).</li>
      <li><b>Priority</b> is cautious score times freshness. The plan takes the highest priorities, at most two per employer.</li>
      <li><b>Left out</b> are postings that already sit on your board as applied, occupation profiles and the Job Bank monthly file (no employer to apply to), and postings with only a title or snippet.</li></ol>
      <p class="note">A heuristic, not an applicant tracking system and not a forecast of interviews: scores within 5 points are ties. Log what you apply for and the board will show, in your own data, whether higher scores led to more replies.</p></details>`);
  }
  function planText(d) {
    return ["Week plan (" + new Date().toLocaleDateString("en-CA") + ")", ...d.chosen.map((c, i) => { const j = c.r.j, u = j.sources.find((x) => x.url); return `${i + 1}. ${j.title}, ${j.company} (${j.loc || "location not stated"}) · score ${c.mid}, range ${c.lo}-${c.hi} · ${whenTxt(c.ageDays).toLowerCase()}${u ? " · " + u.url : ""}`; })].join("\n");
  }
  function onPlanClick(e) {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    if (b.dataset.act === "applied") {
      const k = b.dataset.k, j = jobByKey(k); if (!j) return;
      move(k, "applied"); PLAN.msg = `Logged on your board as applied: ${j.title}, ${j.company}. Its score at the time (${BOARD[k] && BOARD[k].sc != null ? BOARD[k].sc : "not scored"}) is kept for the board's chart.`;
      renderPlan(); return;
    }
    if (b.dataset.act === "saveplan") {
      const d = planData();
      store.set("pm_plan", { at: Date.now(), items: d.chosen.map((c) => ({ k: c.key, t: c.r.j.title, co: c.r.j.company })) });
      PLAN.msg = "Plan saved in this browser. Come back later and it is checked against what is still listed."; renderPlan(); return;
    }
    if (b.dataset.act === "clearplan") { store.set("pm_plan", null); PLAN.msg = "Saved plan deleted."; renderPlan(); return; }
    if (b.dataset.act === "copyplan") {
      const t = planText(planData()), o = b.textContent, ok = () => { b.textContent = "Copied"; setTimeout(() => { b.textContent = o; }, 1500); };
      const fb = () => { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (x) { b.textContent = "Select and copy manually"; } ta.remove(); };
      try { navigator.clipboard.writeText(t).then(ok, fb); } catch (x) { fb(); }
    }
  }
  function onPlanChange(e) {
    const t = e.target;
    if (t.id === "plN") { PLAN.n = +t.value; store.set("pm_plan_n", PLAN.n); }
    else if (t.name === "plHalf") { PLAN.half = t.value; store.set("pm_plan_half", PLAN.half); }
    else if (t.id === "plElig") { PLAN.noelig = t.checked; store.set("pm_plan_elig", PLAN.noelig); }
    else return;
    renderPlan();
  }

  /* =====================================================================
     TARGET OR SPRAY?: how much must a high score help before a few tailored applications beat many quick ones (maths in planner.js)
     ===================================================================== */
  const TG_DEFAULT = { base: 3, m: 1.5, hours: 8, quick: 15, tailor: 3 };
  const TG = Object.assign({}, TG_DEFAULT, store.get("pm_tgt", {}) || {});
  const TG_LIMITS = { base: [1, 10, 0.5], m: [1, 3, 0.05], hours: [2, 20, 1], quick: [5, 45, 5], tailor: [1, 6, 0.5] };
  const pc1 = (x) => (x * 100 < 10 ? (x * 100).toFixed(1) : Math.round(x * 100)) + "%";
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  /* applications on the board that are old enough to have had an answer (14 days), with the score they had when sent */
  function boardOutcomes() {
    const cut = Date.now() - 14 * 864e5;
    return entries().filter((e) => e.c !== "saved" && e.sc != null && e.a && e.a <= cut).map((e) => ({ score: e.sc, iv: !!e.iv }));
  }
  function targetChart(hist, picks, nSpray, mean, r0, mNow, be) {
    const W = 640, H = 280, L = 44, R = 16, T = 14, B = 42, ms = [];
    for (let m = 1; m <= 3.0001; m += 0.05) ms.push(Math.round(m * 100) / 100);
    const sp = ms.map((m) => Planner.expectedSpray(hist, nSpray, mean, r0, m)), tg = ms.map((m) => Planner.expectedTarget(picks, mean, r0, m));
    const ymax = Math.max(0.5, ...sp, ...tg) * 1.08;
    const X = (m) => +(L + ((m - 1) / 2) * (W - L - R)).toFixed(1), Y = (v) => +(T + (1 - v / ymax) * (H - T - B)).toFixed(1);
    const line = (a) => a.map((v, i) => (i ? "L" : "M") + X(ms[i]) + " " + Y(v)).join("");
    const step = ymax > 8 ? 2 : ymax > 3 ? 1 : 0.5, grid = [];
    for (let v = 0; v <= ymax; v += step) grid.push(`<line class="pcg" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="pct" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v % 1 ? v.toFixed(1) : v}</text>`);
    for (let m = 1; m <= 3.001; m += 0.5) grid.push(`<text class="pct" x="${X(m)}" y="${H - B + 16}" text-anchor="middle">×${m.toFixed(1)}</text>`);
    const bx = be.kind === "found" ? X(be.m) : null;
    return `<svg class="wkchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Expected interviews this week against the multiplier per 10 score points, for spraying and for targeting. Targeting catches up at ${be.kind === "found" ? "about ×" + be.m : be.kind === "always" ? "any multiplier" : "no multiplier up to ×6"}.">${grid.join("")}
      <line class="tgnow" x1="${X(mNow)}" x2="${X(mNow)}" y1="${T}" y2="${H - B}"/><text class="pct" x="${X(mNow)}" y="${T + 10}" text-anchor="${mNow > 2.5 ? "end" : "start"}" dx="${mNow > 2.5 ? -4 : 4}">your guess ×${mNow.toFixed(2).replace(/0$/, "")}</text>
      <path class="tgsp" d="${line(sp)}"/><path class="tgtg" d="${line(tg)}"/>
      ${bx !== null ? `<circle class="pcp" cx="${bx}" cy="${Y(Planner.expectedTarget(picks, mean, r0, be.m))}" r="6"/>` : ""}
      <text class="pct tgl" x="${W - R}" y="${Y(sp[sp.length - 1]) - 6}" text-anchor="end">spray</text><text class="pct tgl" x="${W - R}" y="${Y(tg[tg.length - 1]) - 6}" text-anchor="end">target</text>
      <text class="pct" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">Odds multiply by this for every +10 score points</text><text class="pct" transform="translate(11 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Expected interviews</text></svg>`;
  }
  function renderTarget() {
    const root = g("x-target");
    const intro = head("Target or spray?", "Is it better to send many quick applications or a few tailored ones? This lab shows how much a high score has to raise your chance of an interview before targeting wins. The scores are your real ones. The chances are guesses you set, so nothing here is a forecast.");
    if (!CV) { paint(root, intro + `<div class="xempty"><b>Add your CV to run the lab</b>The lab uses your scores, so it needs your CV first.<div class="row"><a class="xbtn solid" href="#p=details" data-p="details">Add my CV</a></div></div>`); return; }
    if (SCORING || SCORED_FOR !== CV || !DICT) { paint(root, intro + `<div class="xempty"><b>Reading your CV against every posting…</b>${esc(SCORING || "One moment.")}</div>`); return; }
    const pool = planPool(onBoardKeys());
    if (pool.length < 20) { paint(root, intro + `<div class="xempty"><b>Too few postings fit your details</b>The lab needs at least twenty employer postings with a full text. Widen your choices on the details page.<div class="row"><a class="xbtn solid" href="#p=details" data-p="details">Edit my details</a></div></div>`); return; }
    const scores = pool.map((r) => r.s.total), hist = Planner.histogram(scores), mean = Planner.meanOf(scores), r0 = TG.base / 100;
    const nSpray = Math.max(1, Math.min(300, Math.round((TG.hours * 60) / TG.quick))), nTarget = Math.max(1, Math.min(40, Math.floor((TG.hours * 60) / (TG.quick * TG.tailor))));
    const picks = planData(nTarget).chosen.map((c) => c.mid);
    if (!picks.length) { paint(root, intro + '<div class="xempty"><b>Nothing to target</b>No posting fits your choices.</div>'); return; }
    const sim = Planner.simulate(hist, picks, nSpray, mean, r0, TG.m, 2000, "tgt|" + nSpray + "|" + picks.join()), be = Planner.breakEven(hist, picks, nSpray, mean, r0, 6);
    const pS = Planner.poolChance(hist, mean, r0, TG.m), pT = picks.reduce((t, sc) => t + Planner.chance(sc, mean, r0, TG.m), 0) / picks.length;
    const eS = sim.spray.mean, eT = sim.target.mean, win = eT > eS * 1.1 ? "target" : eS > eT * 1.1 ? "spray" : "close";
    const sentence = win === "target" ? `With the same ${TG.hours} hours, targeting expects about <b>${f1(eT)}</b> interviews against <b>${f1(eS)}</b> for spraying.` : win === "spray" ? `With the same ${TG.hours} hours, spraying expects about <b>${f1(eS)}</b> interviews against <b>${f1(eT)}</b> for targeting. Volume wins at these settings.` : `At these settings the two are too close to call: about <b>${f1(eT)}</b> interviews for targeting and <b>${f1(eS)}</b> for spraying.`;
    const beText = be.kind === "found" ? `Targeting catches up once every +10 score points multiplies your odds by about <b>×${be.m.toFixed(2)}</b>. You guessed ×${TG.m.toFixed(2)}, which is ${TG.m >= be.m ? "above" : "below"} that line.` : be.kind === "always" ? "Targeting wins whatever the multiplier: it costs no more time than sending quickly." : "No multiplier up to ×6 lets targeting catch up: your picks are not far enough above a typical posting, or tailoring takes too long.";
    const out = boardOutcomes(), imp = Planner.impliedMultiplier(out), k = out.filter((x) => x.iv).length;
    const own = !out.length ? "Nothing here yet. Press “I applied” on the <a href=\"#p=plan\" data-p=\"plan\">Week plan</a> (or move cards on the <a href=\"#p=board\" data-p=\"board\">board</a>) and mark who answered. Only applications sent at least 14 days ago count, so late replies are not missed."
      : `You logged <b>${out.length}</b> applications with a score that are at least 14 days old. <b>${k}</b> led to an interview (${pc1(k / out.length)}). ${imp ? `Splitting them at the middle score, the higher half did ${imp.m >= 1 ? "better" : "worse"} by about <b>×${imp.m.toFixed(2)}</b> per +10 points. A rough number from a small sample: do not lean on it.` : out.length < 20 || k < 3 ? "After about 20 applications with at least 3 interviews, this page compares your real results with your guess above." : "The scores are too close together to tell."}`;
    const slider = (id, key, label, unit, note) => { const l = TG_LIMITS[key]; return `<div><label for="${id}"><b>${label}</b></label><div class="wkn"><input type="range" id="${id}" min="${l[0]}" max="${l[1]}" step="${l[2]}" value="${TG[key]}" data-f="${id}" aria-describedby="${id}o"><output id="${id}o" for="${id}" data-fmt="${key}">${tgFmt(key, TG[key])}</output></div><p class="note">${note}</p></div>`; };
    const row = (l, a, b) => `<tr><th scope="row">${l}</th><td${win === "spray" ? ' class="win"' : ""}>${a}</td><td${win === "target" ? ' class="win"' : ""}>${b}</td></tr>`;
    paint(root, intro + `<section class="xp" aria-labelledby="tgSet"><h2 id="tgSet">Your guesses</h2>
      <div class="wkset tgset">${slider("tgBase", "base", "Interview chance for a typical posting", "%", "Across all postings that fit you, the average-score one.")}${slider("tgM", "m", "Odds multiply by this for every +10 score points", "×", "×1.0 means the score does not matter.")}${slider("tgHours", "hours", "Hours for applications this week", "h", "Your time budget.")}${slider("tgQuick", "quick", "A quick application takes", "min", "Send the CV, little tailoring.")}${slider("tgTailor", "tailor", "A tailored one takes this many times longer", "×", "Reading the posting, tuning the CV and the message.")}</div>
      <div class="row" style="margin-top:8px"><button class="xbtn" data-act="tgreset" data-f="tgreset">Back to the starting guesses</button></div></section>
    <section class="xp" style="margin-top:16px" aria-labelledby="tgRes"><h2 id="tgRes">Same hours, two strategies</h2><p class="note">${sentence}</p>
      <div class="tgtab"><table><thead><tr><td></td><th scope="col">Spray: ${nSpray} quick applications to postings picked at random</th><th scope="col">Target: your best ${picks.length}, tailored</th></tr></thead><tbody>
        ${row("Average score", Math.round(mean), Math.round(Planner.meanOf(picks)))}
        ${row("Interview chance per application", pc1(pS), pc1(pT))}
        ${row("Expected interviews (middle 80% of 2,000 runs)", `<b>${f1(eS)}</b> <small>${sim.spray.lo}–${sim.spray.hi}</small>`, `<b>${f1(eT)}</b> <small>${sim.target.lo}–${sim.target.hi}</small>`)}
        ${row("Chance of at least one interview", pc1(sim.spray.any), pc1(sim.target.any))}
        ${row("Applications for each interview", pS ? Math.round(1 / pS) : "–", pT ? Math.round(1 / pT) : "–")}
        ${row("Interviews per hour of work", (eS / TG.hours).toFixed(2), (eT / TG.hours).toFixed(2))}</tbody></table></div></section>
    <div class="xgrid eq">
      <section class="xp" aria-labelledby="tgBe"><h2 id="tgBe">The break-even line</h2><p class="note" style="margin:2px 0 8px">${beText}</p>${targetChart(hist, picks, nSpray, mean, r0, TG.m, be)}</section>
      <section class="xp" aria-labelledby="tgOwn"><h2 id="tgOwn">What your own applications say</h2><p class="note">${own}</p>
        <details class="wkhow" style="margin-top:12px"><summary>How this is worked out</summary><ol>
          <li><b>Your scores.</b> The pool is the employer postings with a full text that fit your details. Spray picks postings from it at random; target takes the best ones for your Week plan.</li>
          <li><b>Hours.</b> The hours you give buy ${nSpray} quick or ${picks.length} tailored applications.</li>
          <li><b>Chance.</b> A typical posting (average score ${Math.round(mean)}) has the chance you set; the odds change by your multiplier for every 10 points above or below it.</li>
          <li><b>Runs.</b> 2,000 simulated weeks give the range. The break-even line is the smallest multiplier at which targeting expects as many interviews as spraying.</li></ol>
          <p class="note">The shape is an assumption. The page does not show that targeting works; it shows how strong the effect would have to be, and your board is where the real number comes from. A heuristic: scores within 5 points are ties.</p></details></section>
    </div>`);
  }
  const tgFmt = (key, v) => key === "base" ? v + "%" : key === "m" ? "×" + (+v).toFixed(2) : key === "hours" ? v + " h" : key === "quick" ? v + " min" : "×" + v;
  const TG_IDS = { tgBase: "base", tgM: "m", tgHours: "hours", tgQuick: "quick", tgTailor: "tailor" };
  function onTargetInput(e) { const k = TG_IDS[e.target.id]; if (k) g(e.target.id + "o").textContent = tgFmt(k, e.target.value); }
  function onTargetChange(e) { const k = TG_IDS[e.target.id]; if (!k) return; const l = TG_LIMITS[k]; TG[k] = Math.max(l[0], Math.min(l[1], +e.target.value)); store.set("pm_tgt", TG); renderTarget(); }

  /* =====================================================================
     START PAGE: numbers that count up, the stage preview, the Explore tiles
     ===================================================================== */
  let HKEY = "", counted = false;
  function bigStats() {
    const el = g("bigstats"); if (!el) return;
    /* the numbers counted by the daily job (docs/stats.json), when they describe the postings now loaded; otherwise counted here */
    const cv = typeof coverNow === "function" ? coverNow() : null;
    if (!JOBS.length && !cv) { el.innerHTML = ""; return; }
    const key = cv ? "cover|" + cv.updatedAt : JOBS_VER + "|" + JOBS.length; if (key === HKEY) return; HKEY = key;
    let n0, fields, provs, stu;
    if (cv) { n0 = cv.total; fields = cv.fields; provs = cv.provinces; stu = cv.students; }
    else {
      n0 = JOBS.length;
      fields = new Set(JOBS.map((j) => fdOf(j).id)).size; provs = new Set(JOBS.map((j) => j.province).filter((p) => /^[A-Z]{2}$/.test(p || ""))).size;
      stu = JOBS.filter((j) => lvOf(j).lvl === 0).length;
    }
    const vals = [[n0, "postings collected"], [fields, "fields, from trades to tech"], [provs, "provinces and territories"], [stu, "for students and new graduates"]];
    el.innerHTML = vals.map(([n, l]) => `<div class="bs"><b data-n="${n}">${counted || reduceMotion() ? nf(n) : "0"}</b><span>${l}</span></div>`).join("");
    if (!counted && !reduceMotion()) {
      counted = true;
      const t0 = performance.now(), dur = 1100;
      const step = (t) => {
        const p = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 3);   /* the first frame can be stamped a hair before t0: without the max the numbers flashed negative */
        el.querySelectorAll("b").forEach((b) => { b.textContent = nf(Math.round(+b.dataset.n * e)); });
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else counted = true;
  }
  function stagePreview(b) {
    const el = g("stageprev"); if (!el) return;
    document.querySelectorAll(".hometrail .stop").forEach((s) => s.setAttribute("aria-pressed", String(+s.dataset.b === b)));
    const list = JOBS.filter((j) => lvOf(j).lvl === b);
    const fd = {}, tt = new Map(); for (const j of list) { const f = fdOf(j).id; fd[f] = (fd[f] || 0) + 1; const k = norm(j.title); const e = tt.get(k); if (e) e.n++; else tt.set(k, { t: j.title, n: 1 }); }
    const topF = Object.entries(fd).sort((a, c) => c[1] - a[1]).slice(0, 4), topT = [...tt.values()].sort((a, c) => c.n - a.n).slice(0, 4);
    el.innerHTML = `<div class="sp" style="--c:var(--l${b})"><div><h3>${esc(BAND[b].label)}<small>${nf(list.length)} postings, ${pct(list.length, JOBS.length)}% of the collection</small></h3></div>
      <ul><li><b>Most postings in:</b> ${topF.map(([f, n]) => `${esc(fieldLabel(f))} (${nf(n)})`).join(", ")}</li><li><b>${topT[0] && topT[0].n > 1 ? "Titles that come up most:" : "Examples:"}</b> ${topT.map((t) => esc(t.t)).join("; ")}</li></ul>
      <div class="row"><a class="btng" href="#p=jobs" data-act="stagejobs" data-b="${b}">Show these jobs</a><a class="btng" href="#p=ladder" data-act="stageladder" data-b="${b}">Climb from here</a></div></div>`;
  }
  function homeTiles() {
    const el = g("x-home"); if (!el) return;
    const key = JOBS_VER + "|" + JOBS.length + "|" + SAVED.size + "|" + (CV ? 1 : 0);
    if (el.dataset.key === key) return; el.dataset.key = key;
    let lead = "";
    if (JOBS.length) { const st = stats("all"), top = Object.entries(st.prov).filter(([p]) => /^[A-Z]{2}$/.test(p)).sort((a, b) => b[1] - a[1])[0]; if (top) lead = `${PROV_NAME[top[0]]} leads with ${nf(top[1])} postings`; }
    const extra = { market: lead, lab: CV ? "Your CV is loaded: open the lab" : "Needs your CV", ladder: "From intern to director, by field", swipe: "Up to 80 cards, ready to sort", board: SAVED.size ? `${SAVED.size} saved so far` : "Nothing saved yet", plan: CV ? "Pick this week's applications" : "Needs your CV", target: "Does a high score pay off?", wayfinder: "Say the job in one sentence", paste: "Works with any board" };
    el.innerHTML = `<section class="xsec" aria-labelledby="xsH"><h2 id="xsH">Go further than a list</h2><div class="xtiles">${ORDER.map((id) => `<a class="xtile" style="--c:${META[id].hue}" href="#p=${id}" data-p="${id}">${ICON[id]}<b>${META[id].name}</b><span>${META[id].blurb}</span><em>${esc(extra[id] || "")}</em></a>`).join("")}</div></section>`;
  }
  function home() { bigStats(); homeTiles(); }

  /* =====================================================================
     WAYFINDER: say the job you want in one sentence
     The reading is done by describe.js in the browser. The sample prompts below are only sentences: each card shows,
     from the same reader, how it reads them, so a card can never promise something Wayfinder does not do.
     ===================================================================== */
  const WF = {
    student: { h: "If you are a student", p: "Part-time jobs, internships and co-ops.", q: [
      "Part-time job in Montréal, about 15 hours a week",
      "Part-time job in Vancouver, no experience",
      "Part-time job in Québec City for an international student, 20 hours a week",
      "Winter 2027 co-op in Montréal, bilingual",
      "Engineering or data internship in Ontario",
      "Stage en ingénierie à Montréal"
    ] },
    grad: { h: "If you are a graduate", p: "Entry-level and new-grad roles.", q: [
      "Entry level engineer in Montréal, bilingual",
      "New grad software developer",
      "Entry level accountant in Alberta",
      "Entry level nurse in Alberta",
      "Analyste débutant à Montréal",
      "Entry level marketing coordinator in British Columbia"
    ] }
  };
  const wfChips = (text) => Describe.parse(text, describeCtx()).chips.map((c) => `<span class="dchip ${c.kind === "note" ? "nt" : "fix"}">${esc(c.text)}</span>`).join("");
  function renderWayfinder() {
    const root = g("x-wayfinder");
    if (root.dataset.built) return;   /* built once, so what was typed is still there when the page is shown again */
    root.dataset.built = "1";
    const col = (k) => `<section class="wfcol" aria-labelledby="wfh-${k}"><h2 id="wfh-${k}">${WF[k].h}</h2><p class="note">${WF[k].p}</p><ul class="wfl">${WF[k].q.map((q) => `<li><button type="button" class="wfs" data-q="${esc(q)}"><span class="wfq">${esc(q)}</span><span class="wfr" aria-hidden="true">${wfChips(q)}</span></button></li>`).join("")}</ul></section>`;
    root.innerHTML = head("Wayfinder", "Say the job you want in one sentence, in English or French. Wayfinder turns it into filters you can see and change, then opens the matching postings.") +
      `<form class="wfp" id="wfpForm" role="search" autocomplete="off"><label for="wfpQ">${ICON.wayfinder}Describe the job you want</label>
        <div class="wfprow"><input type="text" id="wfpQ" maxlength="400" placeholder="e.g. part-time job in Montréal" enterkeyhint="search"><button type="submit" class="xbtn solid">Find jobs</button></div>
        <div class="dchips" id="wfpRead" aria-live="polite" hidden></div></form>
      <div class="wfsets">${col("student")}${col("grad")}</div>
      <p class="note wfnote">Pick a prompt to run it, or write your own. Wayfinder is a rule reader that works in your browser, not an AI model: it sets only the filters it can check, and shows work permit, dates and hours as notes. Nothing you type is sent anywhere.</p>`;
  }
  function onWayfinderSubmit(e) {
    e.preventDefault();
    const q = g("wfpQ").value.trim();
    if (!q) { g("wfpQ").focus(); return; }
    wayfind(q);
  }
  function onWayfinderClick(e) {
    const b = e.target.closest("[data-q]");
    if (!b) return;
    g("wfpQ").value = b.dataset.q;
    wayfind(b.dataset.q);
  }
  let WFT = 0;
  function onWayfinderInput(e) {
    if (e.target.id !== "wfpQ") return;
    clearTimeout(WFT);
    WFT = setTimeout(() => { const h = readingOf(e.target.value), b = g("wfpRead"); b.innerHTML = h; b.hidden = !h; }, 160);
  }

  /* =====================================================================
     PASTE A POSTING: a job found on LinkedIn, Indeed or anywhere else, matched against the CV
     The site cannot read those boards, so the person pastes the posting. It goes through the same pipeline as every collected posting
     (addMine in index.html: kept in this browser, scored by scoreJob, ranked with the others), and is drawn with the same card as the Top 10.
     Left: the CV, with its words marked by what this posting asks for. Right: the posting, with its words marked by what the CV has.
     ===================================================================== */
  const PS = { key: "", view: "edit", dirty: {}, status: "" };
  const PP_SAMPLE = `Industrial Engineering Co-op (Winter 2027)
Example Manufacturing Inc.
Longueuil, Quebec, Canada
Internship

About the job
This is an example posting written for this page. It is not a real job.

As an Industrial Engineering Co-op you will support the plant's continuous improvement program and work with production, quality and supply chain teams.

Responsibilities
- Lead small Lean and Six Sigma projects: 5S, kaizen events, value stream mapping and root cause analysis
- Run time studies and map processes in Visio
- Build simulation models of the assembly line in FlexSim
- Analyze production and inventory data in Excel, SQL and Power BI
- Support SPC charts, FMEA and ISO 9001 internal audits
- Plan project tasks and milestones in MS Project
- Help with demand forecasting and inventory control in SAP

Requirements
- Enrolled in a bachelor's or master's program in industrial, mechanical or manufacturing engineering
- Available for a four-month term starting January 2027
- Good written and spoken English and French
- Eligible to work in Canada
- CATIA or SolidWorks is an asset
- Strong communication and teamwork skills`;
  const PP_KINDS = [["", "Full-time"], ["Part-time", "Part-time"], ["Internship", "Internship or co-op"]];
  const PP_FIELDS = { ppTitle: "title", ppCo: "company", ppLoc: "loc", ppKind: "type", ppUrl: "url" };
  const LEG_POST = '<div class="legend"><mark class="m-ok">Match</mark><mark class="m-near">Close</mark><mark class="m-bad">Gap</mark><mark class="m-off">company / benefits</mark><mark class="m-chk">check yourself</mark></div>';
  const LEG_CV = '<div class="legend"><mark class="m-ok">Asked by the posting</mark><mark class="m-near">Close to something asked</mark><mark class="m-off">not asked by this post</mark></div>';

  function renderPaste() {
    const root = g("x-paste");
    if (!root.dataset.built) {
      root.dataset.built = "1";
      root.innerHTML = head("Paste a posting", "Found a job on LinkedIn, Indeed or any other site? Paste it on the right. It is scored against your CV on the left the same way as your Top 10, and added to your list. Nothing you paste leaves this browser.") + `
      <div class="psplit" id="ppSplit">
        <section class="pcol pcv" aria-labelledby="pcvH"><h2 id="pcvH">Your CV</h2>
          <div id="pcvNo" hidden>
            <p class="note">Add your CV here, and every posting you paste is compared with it. It stays in this browser.</p>
            <label for="pcvText">Paste the text of your CV</label>
            <textarea id="pcvText" rows="9" placeholder="Your education, experience and skills"></textarea>
            <div class="row"><button type="button" class="xbtn solid" data-pp="cvuse">Use this CV</button><button type="button" class="xbtn" data-pp="cvex">Try an example CV</button><a class="note" href="#p=details" data-p="details">Upload a file instead</a></div>
            <p class="note" id="pcvMsg" aria-live="polite"></p>
          </div>
          <div id="pcvHas" hidden></div>
        </section>
        <section class="pcol pjob" aria-labelledby="pjH"><h2 id="pjH">The job post</h2>
          <form id="ppForm" autocomplete="off" novalidate>
            <div id="ppEdit">
              <label for="ppText">Paste the whole posting, from the title down to the last requirement</label>
              <textarea id="ppText" rows="12" placeholder="Open the posting on LinkedIn, Indeed, Job Bank or the employer's page, select all of it and paste it here."></textarea>
              <div class="dchips" id="ppRead" aria-live="polite" hidden></div>
              <div class="ppf">
                <div><label for="ppTitle">Job title</label><input type="text" id="ppTitle" maxlength="160"></div>
                <div><label for="ppCo">Employer</label><input type="text" id="ppCo" maxlength="120"></div>
                <div><label for="ppLoc">Place (optional)</label><input type="text" id="ppLoc" maxlength="120" placeholder="Montréal, QC"></div>
                <div><label for="ppKind">Kind of job</label><select id="ppKind">${PP_KINDS.map((k) => `<option value="${k[0]}">${k[1]}</option>`).join("")}</select></div>
                <div class="wide"><label for="ppUrl">Link to the posting (optional)</label><input type="text" id="ppUrl" maxlength="500" placeholder="https://"></div>
              </div>
              <div class="row ppact"><button type="submit" class="xbtn solid" id="ppGo">Match it to my CV</button><button type="button" class="xbtn" data-pp="sample">Try an example post</button><button type="button" class="ppx" data-pp="clear">Clear</button></div>
              <p class="note" id="ppMsg" aria-live="polite"></p>
            </div>
            <div id="ppShown" hidden></div>
          </form>
        </section>
      </div>
      <div id="ppResult" class="ppres" aria-live="polite"></div>
      <div id="ppMine"></div>
      <p class="note ppnote">Paste one posting at a time. Fields marked as read were taken from the text by a rule reader (not an AI model), so check them before you rely on the score. This is a heuristic, not an applicant tracking system: scores within 5 points of each other are ties. Open the original posting and read it before you apply. Work permit and eligibility are shown as flags to check, never assumed.</p>`;
    }
    paintPasteCv();
    paintPasteShown();
    paintPasteResult();
    paintPasteMine();
  }

  /* ----- the job a person pasted, as the page and the list know it ----- */
  const ppJob = () => (PS.key ? jobByKey(PS.key) : null);
  const ppReady = () => !!CV && !!DICT && SCORED_FOR === CV && !SCORING;
  const ppResult = (j) => { if (!ppReady()) return null; const r = RES.find((x) => x.j === j); return r && r.s ? r : null; };
  const hlOf = (m) => m.hl || (m.hl = hlPair(m));   /* the two marked-up texts, worked out once per posting and CV */
  const kindWord = (j) => ({ full: "Full-time", part: "Part-time", intern: "Internship or co-op" })[j.kind] || "";

  function paintPasteCv() {
    const no = g("pcvNo"), has = g("pcvHas");
    if (!no) return;
    no.hidden = !!CV; has.hidden = !CV;
    if (!CV) return;
    const j = ppJob(), m = j && ppReady() && ppResult(j) ? mapData(j) : null;
    const cf = cvFound(), n = cf ? Object.keys(cf).length : 0;
    const band = typeof meBand === "function" ? meBand() : null;
    const example = Object.values(SAMPLES).includes(CV.raw);
    has.innerHTML = `<div class="pcvfacts">${band !== null && BAND[band] ? `<span class="pill lvl lv${band}">${esc(BAND[band].label)}</span>` : ""}${cf ? `<span class="pill">${n} skills found</span>` : ""}<a class="note" href="#p=details" data-p="details">Change my CV</a></div>
      ${example ? '<span class="exnote">This is an example CV, not a real person.</span>' : ""}
      ${m ? LEG_CV : '<p class="note">Paste a posting and the words of your CV it asks for will be marked here.</p>'}
      <pre class="hl pcvtext" tabindex="0" aria-label="The text of your CV">${m ? hlOf(m).cv : esc(CV.raw)}</pre>`;
  }

  /* the right-hand panel once a posting is matched: its text with every keyword marked, and a way back to the text */
  function paintPasteShown() {
    const ed = g("ppEdit"), sh = g("ppShown");
    if (!ed) return;
    const j = ppJob();
    if (!j) { PS.key = ""; PS.view = "edit"; }
    const read = PS.view === "read" && !!j;
    ed.hidden = read; sh.hidden = !read;
    if (!read) return;
    const m = ppResult(j) ? mapData(j) : null;
    sh.innerHTML = `<h3 class="ppt">${esc(j.title)}</h3><div class="ppm"><span>${esc(j.company)}</span>${j.loc ? `<span>${esc(j.loc)}</span>` : ""}<span>${kindWord(j)}</span>${(j.sources[0] || {}).url ? `<a href="${esc(j.sources[0].url)}" target="_blank" rel="noopener">Open the link you saved</a>` : ""}</div>
      ${m ? LEG_POST : '<p class="note">' + esc(SCORING || (CV ? "Scoring this posting against your CV…" : "Add your CV on the left to score it.")) + "</p>"}
      <pre class="hl pptext" tabindex="0" aria-label="The text of the posting">${m ? hlOf(m).post : esc(j.title + "\n" + bodyOf(j))}</pre>
      <div class="row ppact"><button type="button" class="xbtn" data-pp="edit">Edit the text</button><button type="button" class="xbtn solid" data-pp="new">Paste another posting</button></div>`;
  }

  function ppFill(rd) {
    for (const [id, f] of Object.entries(PP_FIELDS)) { if (PS.dirty[id]) continue; const el = g(id); if (el) el.value = rd[f] || ""; }
  }
  function ppChips(rd, len) {
    const c = [], ok = (t, title) => c.push(`<span class="dchip fix" title="${esc(title)}">${esc(t)}</span>`), miss = (t) => c.push(`<span class="dchip nt">${esc(t)}</span>`);
    if (!len) return "";
    rd.title ? ok("Title read", rd.title) : miss("Add the job title");
    rd.company ? ok("Employer read", rd.company) : miss("Add the employer");
    if (rd.loc) ok("Place read", rd.loc);
    if (rd.typeSeen) ok(rd.type || "Full-time", "Kind of job read from the text");
    if (rd.mode) c.push(`<span class="dchip nt" title="Shown, not scored">${esc(rd.mode)}</span>`);
    if (rd.url) ok("Link read", rd.url);
    if (rd.body.length < Pasteparse.MIN_BODY) miss("A few more lines are needed");
    return c.join("");
  }
  let PPT = 0;
  function onPasteInput(e) {
    const id = e.target.id;
    if (id === "ppText") {
      clearTimeout(PPT);
      PPT = setTimeout(() => {
        const t = g("ppText").value, rd = Pasteparse.read(t);
        ppFill(rd);
        const h = ppChips(rd, t.trim().length);
        g("ppRead").innerHTML = h; g("ppRead").hidden = !h;
        g("ppMsg").textContent = "";
      }, 180);
    } else if (PP_FIELDS[id]) PS.dirty[id] = id === "ppKind" ? true : !!e.target.value.trim();
  }

  function ppSubmit(e) {
    e.preventDefault();
    const msg = (t) => { g("ppMsg").textContent = t; };
    if (!CV) { msg("Add your CV on the left first, then match the posting."); (g("pcvText") || {}).focus && g("pcvText").focus(); return; }
    const raw = g("ppText").value, rd = Pasteparse.read(raw), v = (id) => g(id).value.trim();
    const title = v("ppTitle") || rd.title, company = v("ppCo") || rd.company;
    const bad = Pasteparse.problem({ title, company, body: rd.body });
    if (bad) { msg(bad); const f = !title || title.length < 3 ? "ppTitle" : !company || company.length < 2 ? "ppCo" : "ppText"; g(f).focus(); return; }
    let url = v("ppUrl");
    if (url && !/^https?:\/\//i.test(url)) url = /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url) ? "https://" + url : "";   /* only web links; anything else is dropped */
    const x = { title, company, loc: v("ppLoc"), type: g("ppKind").value, url, desc: rd.body, date: TODAY };
    if (raw.trim() === PP_SAMPLE.trim()) x.ex = 1;   /* the example post is scored like any other, but is never put in the Top 10 */
    PS.key = jkey(mineJob(x)); PS.view = "read";
    const r = addMine(x);
    PS.key = r.k; PS.status = r.status;
    msg("");
    renderPaste();
    const sp = g("ppSplit"); if (sp) sp.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" });
  }

  function onPasteClick(e) {
    const b = e.target.closest("[data-pp]");
    if (!b) return;
    const a = b.dataset.pp;
    if (a === "cvuse") {
      const t = g("pcvText").value;
      if (t.trim().length < 80) { g("pcvMsg").textContent = "Paste at least a few lines of your CV."; return; }
      g("paste").value = t; go(); g("pcvMsg").textContent = "";
    } else if (a === "cvex") {
      g("paste").value = SAMPLES.student; go("Example CV, not a real person.");
    } else if (a === "sample") {
      g("ppText").value = PP_SAMPLE; PS.dirty = {};
      clearTimeout(PPT);
      const rd = Pasteparse.read(PP_SAMPLE); ppFill(rd); g("ppRead").innerHTML = ppChips(rd, 1); g("ppRead").hidden = false;
      g("ppMsg").textContent = "This is an example posting, not a real job. Press “Match it to my CV” to score it.";
    } else if (a === "clear" || a === "new") {
      PS.key = ""; PS.view = "edit"; PS.dirty = {}; PS.status = "";
      g("ppText").value = ""; for (const id of Object.keys(PP_FIELDS)) g(id).value = ""; g("ppRead").innerHTML = ""; g("ppRead").hidden = true; g("ppMsg").textContent = "";
      renderPaste(); g("ppText").focus();
    } else if (a === "edit") {
      const j = ppJob(); if (!j) return;
      g("ppText").value = bodyOf(j);
      g("ppTitle").value = j.title; g("ppCo").value = j.company; g("ppLoc").value = j.loc || ""; g("ppKind").value = j.type || ""; g("ppUrl").value = (j.sources[0] || {}).url || "";
      PS.dirty = { ppTitle: true, ppCo: true, ppLoc: true, ppKind: true, ppUrl: true };
      g("ppMsg").textContent = "Change the text and match it again. The posting you added before is replaced.";
      PS.view = "edit"; renderPaste(); g("ppText").focus();
    } else if (a === "show") {
      const j = jobByKey(b.dataset.k); if (!j) return;
      PS.key = b.dataset.k; PS.view = "read"; PS.status = ""; OPEN.add(PS.key);
      renderPaste();
      const sp = g("ppSplit"); if (sp) sp.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" });
    }
  }

  /* ----- where the posting sits among everything that was collected ----- */
  function sitsData(j, s) {
    const fit = RES.filter((r) => r.s && r.j !== j && prefOk(r.j) && !r.s.past);
    const full = fit.filter((r) => (hasText(r.j) && !r.j.partial) || isOcc(r.j));
    const relaxed = P.fullOnly && full.length < 10 && fit.length > full.length;
    const pool = P.fullOnly && !relaxed ? full : fit;
    const bins = new Array(25).fill(0);
    let better = 0, tied = 0, lower = 0;
    for (const r of pool) {
      bins[Math.min(24, Math.floor(r.s.total / 4))]++;
      const d = r.s.total - s.total;
      if (d > 5) better++; else if (d >= -5) tied++; else lower++;
    }
    const tp = rankPool(50, 2), idx = tp.all.findIndex((r) => r.j === j);
    const t10 = tp.all.filter((r) => r.j !== j).slice(0, 10).map((r) => r.s.total);
    return { n: pool.length, better, tied, lower, bins, idx, t10, why: prefWhy(j), past: !!s.past, fullOnly: P.fullOnly && !relaxed };
  }
  function sitsHtml(j, s, d) {
    const here = Math.min(24, Math.floor(s.total / 4));
    const lo = d.t10.length ? Math.min(...d.t10) : null, hi = d.t10.length ? Math.max(...d.t10) : null;
    const mx = Math.max(1, ...d.bins);
    const bars = d.bins.map((n, i) => {
      const a = i * 4, inTop = lo !== null && a + 3 >= lo && a <= hi;
      return `<i class="${i === here ? "me" : inTop ? "t10" : ""}" style="height:${Math.max(n ? 6 : 2, Math.round(100 * Math.sqrt(n / mx)))}%"></i>`;
    }).join("");
    let line;
    if (j.ex) line = `It is the example posting, so it is never put in your Top 10.`;
    else if (d.past) line = `Its term is in the past, so it stays out of your Top 10.`;
    else if (d.why) line = `It is outside your details because ${esc(d.why)}, so it will not show in your Top 10. Its score does not change. <a href="#p=details" data-p="details">Edit my details</a> if you want postings like it counted.`;
    else if (d.idx >= 0 && d.idx < 10) line = `It is in your Top 10, at rank <b>${d.idx + 1}</b>.${d.tied ? ` ${d.tied === 1 ? "One posting is" : nf(d.tied) + " postings are"} within 5 points of it, so treat the order among them as a tie.` : ""}`;
    else if (d.idx >= 10) line = `It ranks <b>${d.idx + 1}</b> in your list, below your Top 10. The Top 10 page shows more with “Show the next 10”.`;
    else line = `It is below the first 50 of your list, so it does not show on the Top 10 page.`;
    const cmp = d.n ? `Of the <b>${nf(d.n)}</b> other postings that fit your details${d.fullOnly ? " and have a full text" : ""}: <b>${nf(d.better)}</b> score clearly higher, <b>${nf(d.tied)}</b> are within 5 points (a tie) and <b>${nf(d.lower)}</b> score lower.` : "There are no other scored postings that fit your details to compare it with yet.";
    return `<section class="sits" aria-labelledby="sitsH"><div class="sitsh"><b class="sitsn ${scCls(s.total)}">${s.total}</b><div><h2 id="sitsH">Where it sits</h2><p>${line}</p><p>${cmp}</p></div></div>
      <div class="sitsc" role="img" aria-label="How many postings fall at each score, from 0 to 100. The bar of this posting is at ${s.total}${lo !== null ? `. Your Top 10 scores run from ${lo} to ${hi}` : ""}."><div class="sbars">${bars}</div><div class="saxis" aria-hidden="true"><span>0</span><span>45</span><span>60</span><span>100</span></div>
        <div class="sleg" aria-hidden="true"><span class="k me">This posting</span>${lo !== null ? '<span class="k t10">Scores of your Top 10</span>' : ""}<span class="k">Other postings that fit your details</span></div></div></section>`;
  }

  function paintPasteResult() {
    const root = g("ppResult");
    if (!root) return;
    const j = ppJob();
    if (!j) { if (root.innerHTML) root.innerHTML = ""; return; }
    const k = jkey(j);
    OPEN.add(k);
    if (!CV) { root.innerHTML = `<p class="note ppwait">Your posting is saved in this browser. Add your CV on the left to score it.</p>`; return; }
    if (!ppReady()) { root.innerHTML = `<p class="note ppwait">${esc(SCORING || "Reading your CV against every posting…")}</p>`; return; }
    const r = ppResult(j) || { j, s: scoreJob(j) };
    const d = sitsData(j, r.s), rank = d.idx >= 0 ? d.idx + 1 : "–";   /* a number only when it is on the ranked list: ties make any other number look more exact than it is */
    const note = PS.status === "dup" ? `<p class="note ppst">A collected posting has the same employer and title. Your pasted text is now its full text.</p>` : PS.status === "updated" ? `<p class="note ppst">Updated: this replaces the posting you added before with the same employer and title.</p>` : "";
    const ex = j.ex ? `<p class="exnote">This is the example posting, not a real job. It is scored like any other but never put in your Top 10. Use “Remove this posting from my list” at the bottom of the card when you are done.</p>` : "";
    paint(root, note + ex + sitsHtml(j, r.s, d) + jobHtml(r, rank, true));
  }

  /* ----- the postings the person has added, best score first ----- */
  function paintPasteMine() {
    const root = g("ppMine");
    if (!root) return;
    const list = JOBS.filter((j) => j.mine);
    if (!list.length) { root.innerHTML = ""; return; }
    const sc = new Map();
    if (ppReady()) for (const r of RES) if (r.j.mine && r.s) sc.set(r.j, r.s.total);
    const rows = list.map((j) => ({ j, k: jkey(j), sc: sc.has(j) ? sc.get(j) : null })).sort((a, b) => (b.sc === null ? -1 : b.sc) - (a.sc === null ? -1 : a.sc));
    root.innerHTML = `<section class="pmine" aria-labelledby="pmH"><h2 id="pmH">Postings you added (${rows.length})</h2><p class="note">Kept in this browser only. They are scored and ranked with all the others, so they can show in your Top 10.</p>
      <ul>${rows.map((r) => `<li${r.k === PS.key ? ' class="on"' : ""}><b class="pmsc ${r.sc === null ? "" : scCls(r.sc)}">${r.sc === null ? "–" : r.sc}</b><span class="pmt"><b>${esc(r.j.title)}</b><small>${esc(r.j.company)}${r.j.loc ? " · " + esc(r.j.loc) : ""} · ${kindWord(r.j)}</small></span><button type="button" class="xbtn" data-pp="show" data-k="${esc(r.k)}"${r.k === PS.key ? ' aria-current="true"' : ""}>${r.k === PS.key ? "Shown above" : "Show"}</button></li>`).join("")}</ul></section>`;
  }

  /* =====================================================================
     EXPLORE MENU AND JUMP BAR
     ===================================================================== */
  function buildExplore() {
    const ex = g("explore"), btn = g("exploreBtn");
    ex.innerHTML = `<div class="wrap exin">${ORDER.map((id) => `<a class="etile" style="--c:${META[id].hue}" href="#p=${id}" data-p="${id}">${ICON[id]}<b>${META[id].name}</b><span>${META[id].blurb}</span></a>`).join("")}</div>`;
    const close = () => { ex.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    XP.close = close;
    btn.hidden = false;
    btn.onclick = () => { const open = ex.hidden; ex.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
    document.addEventListener("click", (e) => { if (!ex.hidden && !e.target.closest("#explore,#exploreBtn")) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ex.hidden) { close(); btn.focus(); } });
  }
  function buildCmd() {
    const box = document.createElement("div");
    box.className = "cmd"; box.id = "cmd"; box.hidden = true;
    box.innerHTML = `<div class="cmdbox" role="dialog" aria-modal="true" aria-label="Search and jump"><input type="text" id="cmdq" placeholder="Jump to a page, or search postings…" autocomplete="off" aria-controls="cmdlist" aria-label="Search"><ul class="cmdlist" id="cmdlist" role="listbox"></ul><div class="cmdfoot">Up and down to choose, Enter to open, Esc to close.</div></div>`;
    document.body.appendChild(box);
    const btn = g("cmdBtn"); btn.hidden = false;
    let items = [], sel = 0;
    const pages = [["home", "Start", "var(--pin)"], ["details", "Your CV and details", "var(--accent)"], ["matches", "Your top 10", "var(--sun)"], ["jobs", "All jobs", "var(--sky)"], ...ORDER.map((id) => [id, META[id].name, META[id].hue])];
    const build = () => {
      const q = g("cmdq").value.trim(), nq = norm(q);
      items = pages.filter((p) => !nq || norm(p[1]).includes(nq)).map((p) => ({ t: p[1], c: p[2], s: "Page", go: () => showPage(p[0], true) }));
      if (nq.length >= 2) {
        const w = nq.split(" ").filter(Boolean), hits = [];
        for (const j of JOBS) { if (w.every((x) => j._s.includes(x))) { hits.push(j); if (hits.length >= 6) break; } }
        hits.forEach((j) => items.push({ t: j.title + " · " + j.company, c: "var(--l" + lvOf(j).lvl + ")", s: "Posting", go: () => goJobs({ f: { q: j.title, lvl: "" }, tab: j.kind }) }));
        items.push({ t: `Search all jobs for “${q}”`, c: "var(--sky)", s: "Search", go: () => goJobs({ f: { q } }) });
      }
      sel = 0; draw();
    };
    const draw = () => {
      g("cmdlist").innerHTML = items.map((it, i) => `<li role="option" id="cmdo${i}" aria-selected="${i === sel}" data-i="${i}" style="--c:${it.c}"><i></i><span>${esc(it.t)}</span><small>${it.s}</small></li>`).join("") || '<li class="grp">Nothing matches.</li>';
      const s = g("cmdlist").querySelector('[aria-selected="true"]'); if (s) { s.scrollIntoView({ block: "nearest" }); g("cmdq").setAttribute("aria-activedescendant", s.id); } else g("cmdq").removeAttribute("aria-activedescendant");
    };
    const open = () => { box.hidden = false; g("cmdq").value = ""; build(); g("cmdq").focus(); };
    const close = () => { box.hidden = true; };
    const run = (i) => { const it = items[i]; if (!it) return; close(); it.go(); };
    btn.onclick = open;
    box.addEventListener("click", (e) => { if (e.target === box) close(); const li = e.target.closest("li[data-i]"); if (li) run(+li.dataset.i); });
    g("cmdq").addEventListener("input", build);
    g("cmdq").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === "Enter") { e.preventDefault(); run(sel); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); box.hidden ? open() : close(); } });
  }

  /* =====================================================================
     the object index.html reads
     ===================================================================== */
  const XP = {
    pages: {
      wayfinder: { title: META.wayfinder.title, render: renderWayfinder },
      paste: { title: META.paste.title, render: renderPaste },
      market: { title: META.market.title, render: renderMarket },
      lab: { title: META.lab.title, render: renderLab },
      ladder: { title: META.ladder.title, render: renderLadder },
      swipe: { title: META.swipe.title, render: renderSwipe },
      board: { title: META.board.title, render: renderBoard },
      plan: { title: META.plan.title, render: renderPlan },
      target: { title: META.target.title, render: renderTarget }
    },
    home,
    close() { /* replaced when the menu is built */ },
    onStar(k, on) {
      if (on) boardAdd(k);
      else if (BOARD[k] && BOARD[k].c === "saved") { delete BOARD[k]; saveBoard(); }
      if (PG === "board") renderBoard();
    },
    init() {
      buildExplore(); buildCmd();
      const m = g("x-market"); m.addEventListener("click", onMarketClick); m.addEventListener("pointerover", onPulse); m.addEventListener("focusin", onPulse);
      m.addEventListener("pointerover", onGeoRead); m.addEventListener("focusin", onGeoRead);
      m.addEventListener("pointerover", (e) => { if (e.target.closest("[data-mapview]")) geoReady(); }); m.addEventListener("focusin", (e) => { if (e.target.closest("[data-mapview]")) geoReady(); });
      m.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("svg [data-place],svg [data-mapview]")) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
      if (typeof ResizeObserver === "function") new ResizeObserver(() => fitGeo()).observe(m);
      const wf = g("x-wayfinder");
      wf.addEventListener("submit", onWayfinderSubmit); wf.addEventListener("click", onWayfinderClick); wf.addEventListener("input", onWayfinderInput);
      const pp = g("x-paste");
      pp.addEventListener("submit", ppSubmit); pp.addEventListener("click", onPasteClick); pp.addEventListener("input", onPasteInput); pp.addEventListener("change", onPasteInput);
      /* the card under the match is the Top 10 card, so it takes the same clicks: star, compare, talking points, remove, and opening it */
      pp.addEventListener("click", starClick, true); pp.addEventListener("click", onAct); pp.addEventListener("toggle", onCardToggle, true);
      g("x-lab").addEventListener("click", onLabClick);
      g("x-ladder").addEventListener("click", onLadderClick);
      g("x-ladder").addEventListener("change", (e) => { if (e.target.id === "ladField") { LAD.fd = e.target.value; renderLadder(); } });
      g("x-swipe").addEventListener("click", onSwipeClick);
      bindBoard(g("x-board"));
      g("x-plan").addEventListener("click", onPlanClick);
      g("x-plan").addEventListener("change", onPlanChange);
      g("x-plan").addEventListener("input", (e) => { if (e.target.id === "plN") g("plNo").textContent = e.target.value; });
      g("x-target").addEventListener("input", onTargetInput);
      g("x-target").addEventListener("change", onTargetChange);
      g("x-target").addEventListener("click", (e) => { if (e.target.closest("[data-act=tgreset]")) { Object.assign(TG, TG_DEFAULT); store.set("pm_tgt", TG); renderTarget(); } });
      const trail = document.querySelector(".hometrail");
      if (trail) trail.addEventListener("click", (e) => {
        const a = e.target.closest("a[data-act]");
        if (a) { e.preventDefault(); const b = +a.dataset.b; if (a.dataset.act === "stagejobs") { const c = { full: 0, part: 0, intern: 0 }; JOBS.forEach((j) => { if (lvOf(j).lvl === b) c[j.kind]++; }); goJobs({ f: { lvl: String(b) }, tab: bestTab(c) }); } else { LAD.sel = b; LAD.fd = P.fd || ""; showPage("ladder", true); } return; }
        const s = e.target.closest("button.stop"); if (s) stagePreview(+s.dataset.b);
      });
    }
  };
  window.XP = XP;
})();
