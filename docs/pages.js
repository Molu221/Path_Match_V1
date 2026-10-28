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
    board: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/></svg>'
  };
  const META = {
    market: { name: "Market map", title: "Market map", hue: "var(--violet)", blurb: "See where the postings are: by province, field and stage." },
    lab: { name: "Skill lab", title: "Skill lab", hue: "var(--mint)", blurb: "Try a skill before you learn it and watch your top 10 move." },
    ladder: { name: "Career ladder", title: "Career ladder", hue: "var(--coral)", blurb: "What each rung asks for in your field, and what is new on the next one." },
    swipe: { name: "Quick sort", title: "Quick sort", hue: "var(--berry)", blurb: "Go through postings one card at a time: save or skip." },
    board: { name: "Application board", title: "Application board", hue: "var(--peach)", blurb: "Track what you saved, applied to, and heard back about." }
  };
  const ORDER = ["market", "lab", "ladder", "swipe", "board"];
  const LANGSKILL = new Set(["english", "french", "anglais", "francais", "bilingual", "bilingue", "bilingual (en/fr)"]);
  /* general strengths: postings name them, but they are not something to "learn first". They are shown apart from role skills. */
  const SOFT = new Set(("leadership|attention to detail|initiative|autonomy|organizational skills|explaining complex ideas|patience|perseverance|curiosity|takes on challenges|problem solving|analytical skills|communication|teamwork|collaboration|interpersonal skills|time management|prioritization|multitasking|works under pressure|meets deadlines|adaptability|critical thinking|creativity|innovation|proactivity|resourcefulness|rigor|accountability|dependability|punctuality|professionalism|integrity|discretion and confidentiality|active listening|empathy|emotional intelligence|diplomacy and tact|conflict resolution|negotiation|persuasion and influence|decision making|presentation skills|written communication|verbal communication|strategic thinking|synthesis|learning agility|resilience|motivation|enthusiasm|entrepreneurial spirit|cultural awareness|results orientation|mentoring and coaching|stakeholder management|cross-functional work|team management|facilitation|diversity and inclusion").split("|"));
  const KINDS = [["all", "All kinds"], ["full", "Full-time"], ["part", "Part-time"], ["intern", "Internships & co-ops"]];
  const KIND_TAB = { full: "full", part: "part", intern: "intern" };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  /* a count becomes one of five shades (q1 lightest to q5 darkest); the text colour of each shade is set in pages.css */
  const shade = (t) => 1 + Math.min(4, Math.floor(t * 5));
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
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
    const o = { n: 0, prov: {}, mtl: 0, field: {}, days: new Array(30).fill(0), new30: 0, emp: new Map(), skill: new Map(), cell: {} };
    for (const j of JOBS) {
      if (kind !== "all" && j.kind !== kind) continue;
      o.n++;
      const p = j.province || "";
      o.prov[p] = (o.prov[p] || 0) + 1;
      if (MTL.test(j.loc || "")) o.mtl++;
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
  const MK = { kind: "all", sel: null, skill: null, sk: "skill" };
  const TILES = [["YT", 0, 0], ["NT", 1, 0], ["NU", 2, 0], ["BC", 0, 1], ["AB", 1, 1], ["SK", 2, 1], ["MB", 3, 1], ["ON", 4, 1], ["QC", 5, 1], ["NL", 6, 1], ["NB", 5, 2], ["PE", 6, 2], ["NS", 6, 3]];
  const EXTRA = [["MTL", "Montréal area"], ["Remote – Canada", "Remote, Canada"], ["Canada", "Canada, no province"]];
  const scale = (n, max) => (n <= 0 ? 0.04 : 0.12 + 0.88 * (Math.log(1 + n) / Math.log(1 + max)));
  function inPlace(j, code) { return code === "MTL" ? MTL.test(j.loc || "") : (j.province || "") === code; }
  const placeName = (c) => (c === "MTL" ? "Montréal area" : PROV_NAME[c] || c);

  function placeDetail(code) {
    const list = JOBS.filter((j) => (MK.kind === "all" || j.kind === MK.kind) && inPlace(j, code));
    const lv = [0, 0, 0, 0, 0], fd = {}, em = new Map(), kinds = { full: 0, part: 0, intern: 0 };
    for (const j of list) {
      lv[lvOf(j).lvl]++; const f = fdOf(j).id; fd[f] = (fd[f] || 0) + 1;
      em.set(j.company, (em.get(j.company) || 0) + 1); kinds[j.kind]++;
    }
    return { n: list.length, lv, fd: Object.entries(fd).sort((a, b) => b[1] - a[1]).slice(0, 6), em: [...em.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5), kinds };
  }
  function marketHtml() {
    const st = stats(MK.kind);
    const counts = {};
    for (const [c] of TILES) counts[c] = st.prov[c] || 0;
    counts.MTL = st.mtl; counts["Remote – Canada"] = st.prov["Remote – Canada"] || 0; counts.Canada = st.prov.Canada || 0;
    const max = Math.max(...TILES.map(([c]) => counts[c]), 1);
    if (!MK.sel) MK.sel = P.loc && counts[P.loc] != null ? P.loc : TILES.slice().sort((a, b) => counts[b[0]] - counts[a[0]])[0][0];
    const tile = (c, label, x) => `<button class="tile q${shade(scale(counts[c], max))}${x ? " extra" : ""}" data-f="t-${esc(c)}" data-place="${esc(c)}" aria-pressed="${MK.sel === c}" style="${x ? "" : `grid-column:${TILES.find((t) => t[0] === c)[1] + 1};grid-row:${TILES.find((t) => t[0] === c)[2] + 1}`}" aria-label="${esc(placeName(c))}: ${nf(counts[c])} postings"><b>${esc(label)}</b><small>${nf(counts[c])}</small></button>`;
    const d = placeDetail(MK.sel);
    const lvTot = d.lv.reduce((a, b) => a + b, 0) || 1;
    const detail = `<div class="pd"><h3>${esc(placeName(MK.sel))}</h3><div class="big">${nf(d.n)}</div><div class="note">${pct(d.n, st.n)}% of the ${nf(st.n)} postings shown${MK.sel === "MTL" ? " (the Montréal area is inside Quebec)" : ""}</div>
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
    const sk = [...st.skill.entries()].filter(([k]) => SOFT.has(k) === (MK.sk === "soft")).sort((a, b) => b[1].n - a[1].n).slice(0, 36);
    const smax = sk.length ? sk[0][1].n : 1, smin = sk.length ? sk[sk.length - 1][1].n : 1, mine = cvSkills();
    const cloud = `<div class="cloud">${sk.map(([k, e]) => `<button data-f="s-${esc(k)}" data-skill="${esc(k)}" aria-pressed="${MK.skill === k}" class="${mine && mine.has(k) ? "mine" : ""}" style="--t:${(smin === smax ? 1 : (Math.log(e.n) - Math.log(smin)) / (Math.log(smax) - Math.log(smin))).toFixed(2)}" title="${nf(e.n)} postings">${esc(e.name)}</button>`).join("")}</div><div class="skillread" id="skillread" aria-live="polite">${skillRead(st)}</div>`;

    return head("Market map", `Where the ${nf(JOBS.length)} collected postings are, in which fields and for which stage. Darker means more postings. Click a province, a cell or an employer to open those jobs.`) +
      `<div class="tog" role="group" aria-label="Kind of work">${KINDS.map(([k, l]) => `<button data-f="k-${k}" data-kind="${k}" aria-pressed="${MK.kind === k}">${l}</button>`).join("")}</div>
      <div class="xgrid two">
        <section class="xp" aria-labelledby="mkMap"><h2 id="mkMap">Postings by province</h2><p class="note">Each tile is a province or territory. The shade follows the number of postings.</p>
          <div class="tiles">${TILES.map(([c]) => tile(c, c)).join("")}</div>
          <div class="tilerow">${EXTRA.map(([c, l]) => tile(c, l, true)).join("")}</div>
          <div class="ramp"><span>fewer</span><i class="q1"></i><i class="q2"></i><i class="q3"></i><i class="q4"></i><i class="q5"></i><span>more</span></div></section>
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
  }
  function onMarketClick(e) {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.kind) { MK.kind = t.dataset.kind; renderMarket(); }
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
    return [...m.values()].filter((e) => e.idx.length >= 3).map((e) => { e.soft = SOFT.has(e.k); return e; });
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
      if (sh >= 0.05 && sh >= 1.5 * ps && e.n >= 5) out.push({ k, name: e.name, sh, lift: sh - ps, soft: SOFT.has(k) });
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
    const skills = allSk.filter(([k]) => !SOFT.has(k)).slice(0, 9).map(([, e]) => e), strengths = allSk.filter(([k]) => SOFT.has(k)).slice(0, 5).map(([, e]) => e);
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
      ${s ? `<div class="sc2score"><b class="${scCls(s.total)}">${s.total}</b><span>out of 100 · ${s.conf === "Full text" ? "from the full text" : s.conf === "Short snippet" ? "from a short snippet" : "from the title only"}</span></div>` : ""}
      <div class="why2">${s ? (ms.length ? `<h3>On your CV</h3><div class="kw">${ms.map((m) => `<span class="M">${esc(m)}</span>`).join("")}</div>` : "") + (gs.length ? `<h3>Asked for, not on your CV</h3><div class="kw">${gs.map((m) => `<span class="G">${esc(m)}</span>`).join("")}</div>` : "") : (kws.length ? `<h3>What the posting asks for</h3><div class="kw">${kws.map((m) => `<span class="N">${esc(m)}</span>`).join("")}</div><p class="note" style="margin-top:8px">Add your CV and these cards come ranked by how well you fit.</p>` : "")}</div>
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
     START PAGE: numbers that count up, the stage preview, the Explore tiles
     ===================================================================== */
  let HKEY = "", counted = false;
  function bigStats() {
    const el = g("bigstats"); if (!el) return;
    if (!JOBS.length) { el.innerHTML = ""; return; }
    const key = JOBS_VER + "|" + JOBS.length; if (key === HKEY) return; HKEY = key;
    const fields = new Set(JOBS.map((j) => fdOf(j).id)).size, provs = new Set(JOBS.map((j) => j.province).filter((p) => /^[A-Z]{2}$/.test(p || ""))).size;
    const stu = JOBS.filter((j) => lvOf(j).lvl === 0).length;
    const vals = [[JOBS.length, "postings collected"], [fields, "fields, from trades to tech"], [provs, "provinces and territories"], [stu, "for students and new graduates"]];
    el.innerHTML = vals.map(([n, l]) => `<div class="bs"><b data-n="${n}">${counted || reduceMotion() ? nf(n) : "0"}</b><span>${l}</span></div>`).join("");
    if (!counted && !reduceMotion()) {
      counted = true;
      const t0 = performance.now(), dur = 1100;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
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
    const extra = { market: lead, lab: CV ? "Your CV is loaded: open the lab" : "Needs your CV", ladder: "From intern to director, by field", swipe: "Up to 80 cards, ready to sort", board: SAVED.size ? `${SAVED.size} saved so far` : "Nothing saved yet" };
    el.innerHTML = `<section class="xsec" aria-labelledby="xsH"><h2 id="xsH">Go further than a list</h2><div class="xtiles">${ORDER.map((id) => `<a class="xtile" style="--c:${META[id].hue}" href="#p=${id}" data-p="${id}">${ICON[id]}<b>${META[id].name}</b><span>${META[id].blurb}</span><em>${esc(extra[id] || "")}</em></a>`).join("")}</div></section>`;
  }
  function home() { bigStats(); homeTiles(); }

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
      market: { title: META.market.title, render: renderMarket },
      lab: { title: META.lab.title, render: renderLab },
      ladder: { title: META.ladder.title, render: renderLadder },
      swipe: { title: META.swipe.title, render: renderSwipe },
      board: { title: META.board.title, render: renderBoard }
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
      g("x-lab").addEventListener("click", onLabClick);
      g("x-ladder").addEventListener("click", onLadderClick);
      g("x-ladder").addEventListener("change", (e) => { if (e.target.id === "ladField") { LAD.fd = e.target.value; renderLadder(); } });
      g("x-swipe").addEventListener("click", onSwipeClick);
      bindBoard(g("x-board"));
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
