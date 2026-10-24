/* Path Match accounts (optional). Private per-user storage on Supabase, protected by Row-Level Security.
   Loaded after the main script in index.html. When config.js has no keys, this file does nothing and the
   site behaves exactly as before. */
(function () {
  "use strict";
  const PM = window.PM, esc = PM.esc, $ = PM.$, C = window.PM_CONFIG || {};
  const H = (window.PM_HOOKS = window.PM_HOOKS || {});
  const configured = !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase && window.supabase.createClient);

  if (!configured) {
    const t = document.querySelector('.tab[data-t="apps"]');
    if (t) t.hidden = true;
    return;
  }

  const S = { sb: null, user: null, profile: null, apps: [], events: [], blocked: [], blockedKeys: new Set(),
              save: true, msg: "", pasteMsg: "", loadedAt: 0, skipNextSave: false, channel: null };
  let lastSig = "", saveTimer = null, toastTimer = null, reloadTimer = null;

  const fmtDate = (x) => (x ? new Date(x).toLocaleDateString([], { month: "short", day: "numeric" }) : "");
  const fmtDT = (x) => (x ? new Date(x).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
  const STATUS = { applied: "Applied", interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn", ghosted: "Ghosted?" };
  const KIND = { confirmation: "Confirmation", interview: "Interview invitation", rejection: "Rejection", offer: "Offer", verification: "Gmail forwarding code" };
  const jobKey = (j) => PM.jobKey(j);
  const appFor = (key) => S.apps.find((a) => a.job_key === key);
  const must = (r) => { if (r.error) throw r.error; return r.data; };

  /* ------------------------------------------------------------ toast */
  const toast = document.createElement("div");
  toast.className = "pm-toast"; toast.setAttribute("role", "status"); toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);
  function flash(text) {
    toast.textContent = text; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 6000);
  }

  /* ------------------------------------------------------------ account panel */
  const panel = document.createElement("div");
  panel.className = "panel"; panel.id = "acct";
  document.querySelector(".side").prepend(panel);

  function setMsg(t) { S.msg = t; const m = $("acctMsg"); if (m) m.textContent = t; }

  function renderAccount() {
    if (!S.user) {
      panel.innerHTML = `<h2>Your private account</h2>
        <p class="note">Optional. Sign in to keep your CV profile, matches and applications in an account only you can open. Without an account nothing is saved.</p>
        <label for="acctEmail">Email</label>
        <input type="email" id="acctEmail" autocomplete="email" placeholder="you@example.com">
        <div class="row" style="margin-top:8px">
          <button class="primary" id="acctLink">Email me a sign-in link</button>
          ${(C.providers || []).includes("google") ? '<button id="acctGoogle">Continue with Google</button>' : ""}
        </div>
        <p class="note" id="acctMsg" aria-live="polite">${esc(S.msg)}</p>`;
      $("acctLink").onclick = sendLink;
      $("acctEmail").onkeydown = (e) => { if (e.key === "Enter") sendLink(); };
      if ($("acctGoogle")) $("acctGoogle").onclick = () => S.sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
    } else {
      panel.innerHTML = `<h2>Your private account</h2>
        <p class="note">Signed in as <b>${esc(S.user.email || "")}</b></p>
        <label class="pm-check"><input type="checkbox" id="acctSave" ${S.save ? "checked" : ""}> Save my CV profile and top matches in my account</label>
        <p class="note">Stores the keywords found on your CV with short excerpts, and your top 50 matches. Your CV file and its full text are never stored. Only you can read it.</p>
        <p class="note" id="acctMsg" aria-live="polite">${esc(S.msg)}</p>
        <div class="row"><button id="acctApps">My applications</button><button id="acctOut">Sign out</button></div>`;
      $("acctSave").onchange = (e) => { S.save = e.target.checked; if (S.save) { lastSig = ""; H.afterRun(); } else setMsg("Saving is off. Nothing new will be stored."); };
      $("acctApps").onclick = () => { PM.setTab("apps"); };
      $("acctOut").onclick = () => S.sb.auth.signOut();
    }
  }

  async function sendLink() {
    const email = $("acctEmail").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg("Enter a valid email address.");
    setMsg("Sending…");
    const { error } = await S.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    setMsg(error ? "Could not send the link: " + error.message : "Check your inbox for the sign-in link.");
  }

  /* ------------------------------------------------------------ session */
  async function init() {
    S.sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    S.sb.auth.onAuthStateChange((_ev, session) => {
      const u = session && session.user;
      if ((u && u.id) !== (S.user && S.user.id)) setTimeout(() => setUser(u), 0);   // never await supabase calls inside this callback
    });
    const { data } = await S.sb.auth.getSession();
    if (data.session && !S.user) await setUser(data.session.user);
    else renderAccount();
  }

  async function setUser(u) {
    const was = S.user;
    S.user = u || null;
    if (S.user) {
      try { await ensureProfile(); await loadAll(); subscribe(); } catch (e) { S.msg = "Could not load your account: " + (e.message || e); }
      restoreProfile();
    } else {
      unsubscribe();
      Object.assign(S, { profile: null, apps: [], events: [], blocked: [], blockedKeys: new Set(), msg: "" });
      lastSig = "";
      if (was) {   // shared computers: leave nothing of the previous user on the page
        PM.setCV(null); $("paste").value = ""; $("status").textContent = "Signed out. Your CV profile was cleared from this page.";
      }
    }
    renderAccount();
    if (PM.cv) PM.run(); else PM.render();
  }

  async function ensureProfile() {
    let p = must(await S.sb.from("profiles").select("*").eq("user_id", S.user.id).maybeSingle());
    if (!p) { must(await S.sb.from("profiles").insert({ user_id: S.user.id })); }
  }

  async function loadAll() {
    const uid = S.user.id;
    const [p, a, b, e] = await Promise.all([
      S.sb.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      S.sb.from("applications_view").select("*").order("applied_at", { ascending: false }),
      S.sb.from("blocked_companies").select("*").order("created_at", { ascending: false }),
      S.sb.from("email_events").select("*").order("received_at", { ascending: false }).limit(100),
    ]);
    S.profile = must(p) || {}; S.apps = must(a) || []; S.blocked = must(b) || []; S.events = must(e) || [];
    S.blockedKeys = new Set(S.blocked.map((x) => x.company_key));
    S.loadedAt = Date.now();
  }

  function restoreProfile() {
    const p = S.profile;
    if (!p || !p.cv_keywords || !p.cv_keywords.hits || PM.cv) return;
    const hits = p.cv_keywords.hits, fam = {};
    Object.values(hits).forEach((h) => { fam[h.fam] = (fam[h.fam] || 0) + 1; });
    PM.setCV({ text: "", hits, fam });
    PM.setSettings({ permit: p.work_permit, term: p.target_term });
    S.skipNextSave = true;
    $("status").textContent = `Loaded your saved CV profile (${Object.keys(hits).length} keywords, saved ${fmtDate(p.cv_saved_at)}). Upload a new CV to replace it.`;
  }

  function subscribe() {
    unsubscribe();
    try {
      const uid = S.user.id, f = "user_id=eq." + uid;
      S.channel = S.sb.channel("pm-" + uid)
        .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: f }, reloadSoon)
        .on("postgres_changes", { event: "*", schema: "public", table: "email_events", filter: f }, reloadSoon)
        .subscribe();
    } catch (_) { /* live updates are optional; the tracker also refreshes when opened */ }
  }
  function unsubscribe() { if (S.channel) { try { S.sb.removeChannel(S.channel); } catch (_) {} S.channel = null; } }

  function reloadSoon() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => { if (!S.user) return; try { await loadAll(); refreshTracker(); refreshAllJobUI(); } catch (_) {} }, 600);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.user && Date.now() - S.loadedAt > 15000) reloadSoon(); });

  /* ------------------------------------------------------------ save profile + matches */
  H.afterRun = function () {
    if (!S.user || !S.save || !PM.cv || !Object.keys(PM.cv.hits || {}).length) return;
    if (S.skipNextSave) { S.skipNextSave = false; return; }
    clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 1500);
  };

  async function saveNow() {
    if (!S.user || !S.save || !PM.cv) return;
    const cv = PM.cv, names = Object.keys(cv.hits || {}).sort();
    if (!names.length) return;
    const st = PM.settings(), top = PM.results().slice(0, 50);
    const sig = JSON.stringify([names, st, top.map((r) => [jobKey(r.j), r.s.total])]);
    if (sig === lastSig) return;
    const uid = S.user.id, t0 = new Date().toISOString();
    try {
      must(await S.sb.from("profiles").update({ cv_keywords: { v: 1, hits: cv.hits }, cv_saved_at: t0, work_permit: st.permit, target_term: st.term }).eq("user_id", uid));
      if (top.length) {
        const rows = top.map(({ j, s }) => {
          const src = j.sources[0] || {};
          return { user_id: uid, job_key: jobKey(j), company: j.company, title: j.title, loc: j.loc || null, url: src.url || null, source: src.src || null,
            posted_on: /^\d{4}-\d{2}-\d{2}/.test(j.date || "") ? j.date.slice(0, 10) : null,
            score: s.total, role_fit: s.role, level_fit: s.level, overlap: s.overlap, flags: s.flags.map((f) => f[1]), saved_at: t0 };
        });
        must(await S.sb.from("matches").upsert(rows, { onConflict: "user_id,job_key" }));
        must(await S.sb.from("matches").delete().eq("user_id", uid).lt("saved_at", t0));   // drop matches from earlier runs
      }
      lastSig = sig; if (S.profile) S.profile.cv_saved_at = t0;
      setMsg("Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ".");
    } catch (e) { setMsg("Could not save: " + (e.message || e)); }
  }

  /* ------------------------------------------------------------ per-job buttons ("I applied", block) */
  function pillsInner(j) {
    const a = appFor(jobKey(j));
    if (a) return `<span class="pill ${a.effective_status === "interview" || a.effective_status === "offer" ? "g" : a.effective_status === "rejected" ? "b" : a.effective_status === "ghosted" ? "w" : "n"}">${esc(STATUS[a.effective_status] || a.status)}</span>`;
    const nk = PM.norm(j.company);
    if (S.apps.some((x) => PM.norm(x.company) === nk && x.effective_status === "ghosted")) return `<span class="pill w">Ghosted you before</span>`;
    return "";
  }
  function actionsInner(j) {
    if (!S.user) return `<button data-pm="signin">I applied</button> <span class="note">Sign in (left) to track this application and follow its status from your email.</span>`;
    const a = appFor(jobKey(j));
    const main = a
      ? `<span class="pill g">Tracked · applied ${esc(fmtDate(a.applied_at))}</span> <button data-pm="goapps">Open tracker</button>`
      : `<button class="primary" data-pm="applied">I applied</button> <span class="note">Apply on the employer's site first, then press this.</span>`;
    return main + ` <button data-pm="block">Block company</button>`;
  }
  H.jobActions = (j) => `<div class="pm-actions" data-key="${esc(jobKey(j))}">${actionsInner(j)}</div>`;
  H.jobPills = (j) => `<span class="pm-pill" data-pk="${esc(jobKey(j))}">${pillsInner(j)}</span>`;
  H.isBlocked = (j) => !!S.user && S.blockedKeys.has(PM.norm(j.company));

  function refreshJobUI(key) {
    const j = PM.jobs().find((x) => jobKey(x) === key);
    if (!j) return;
    document.querySelectorAll(".pm-actions").forEach((el) => { if (el.dataset.key === key) el.innerHTML = actionsInner(j); });
    document.querySelectorAll(".pm-pill").forEach((el) => { if (el.dataset.pk === key) el.innerHTML = pillsInner(j); });
  }
  function refreshAllJobUI() {
    const keys = new Set([...document.querySelectorAll(".pm-actions")].map((el) => el.dataset.key));
    keys.forEach(refreshJobUI);
  }

  /* ------------------------------------------------------------ tracker tab */
  const lastEvent = (appId) => S.events.find((e) => e.application_id === appId && e.kind !== "verification");

  function emailCard() {
    const p = S.profile || {};
    if (!C.inboundDomain) {
      return `<div class="panel"><h2>Email tracking</h2><p class="note">Email forwarding is not switched on for this site yet. You can still paste emails below, or change a status by hand.</p></div>`;
    }
    const addr = `${p.inbox_token}@${C.inboundDomain}`;
    const ver = S.events.find((e) => e.kind === "verification" && Date.now() - Date.parse(e.received_at) < 3 * 864e5);
    const filter = 'subject:(application OR applying OR candidature OR postulé OR interview OR entrevue OR entretien OR "thank you for your interest")';
    return `<div class="panel"><h2>Email tracking</h2>
      <p class="note">Forward only your job emails to this private address. Each one is read once, sorted (confirmation, interview, rejection, offer), matched to an application and discarded. We keep the status, the sender's domain and the subject line, never the email body.</p>
      <div class="row"><code class="pm-addr">${esc(addr)}</code><button data-pm="copyaddr" data-addr="${esc(addr)}">Copy</button></div>
      ${ver ? `<div class="pm-ver" role="status"><b>Gmail asked you to confirm forwarding.</b> ${ver.note ? `Your code: <code>${esc(ver.note)}</code>. Enter it in Gmail's forwarding settings.` : "The code could not be read from that email. In Gmail, choose “Resend email” and try again."}</div>` : ""}
      <p class="note">${p.last_inbound_at ? "Last email received " + esc(fmtDT(p.last_inbound_at)) + "." : "No email received yet."} Anyone who knows this address could send to it, so keep it private. <button data-pm="rotate">Get a new address</button></p>
      <div class="pm-steps">
        <details><summary>Set up Gmail</summary><ol>
          <li>Gmail, Settings (gear), See all settings, <b>Forwarding and POP/IMAP</b>, Add a forwarding address. Paste the address above.</li>
          <li>Gmail sends a confirmation to it. The code appears on this page within a minute. Enter it in Gmail and press Verify.</li>
          <li>Do not turn on “Forward a copy of incoming mail” (that sends everything). Instead open Settings, <b>Filters and Blocked Addresses</b>, Create a new filter, paste this into “Has the words”: <code>${esc(filter)}</code></li>
          <li>Press Create filter, tick “Forward it to” and choose the address. Done.</li>
        </ol></details>
        <details><summary>Set up Outlook</summary><ol>
          <li>Outlook, Settings (gear), Mail, <b>Rules</b>, Add new rule.</li>
          <li>Condition: Subject includes <code>application</code>, <code>candidature</code>, <code>interview</code>, <code>entrevue</code>. Action: Forward to, then paste the address above. Save.</li>
          <li>Some work and school accounts (many universities) block forwarding to outside addresses. If yours does, use “Paste an email” below.</li>
        </ol></details>
      </div></div>`;
  }

  function reviewCard() {
    const list = S.events.filter((e) => e.needs_review && e.kind !== "verification");
    if (!list.length) return "";
    return `<div class="panel"><h2>Needs your confirmation (${list.length})</h2>
      <p class="note">We could not tell which application these emails belong to, so we did not guess. Pick one, or dismiss.</p>
      ${list.map((e) => {
        const cands = (e.candidates || []).map((id) => S.apps.find((a) => a.id === id)).filter(Boolean);
        const pool = cands.length ? cands : S.apps;
        const opts = pool.map((a) => `<option value="${esc(a.id)}">${esc(a.company)} · ${esc(a.title)}</option>`).join("");
        return `<div class="pm-ev" data-ev="${esc(e.id)}">
          <div><b>${esc(KIND[e.kind] || e.kind)}</b> from ${esc(e.from_domain || "an unknown sender")} · ${esc(fmtDate(e.received_at))}${e.subject_hint ? `<br><span class="note">“${esc(e.subject_hint)}”</span>` : ""}</div>
          <div class="row">${pool.length ? `<select data-pm="evsel" aria-label="Application">${opts}</select><button class="primary" data-pm="assign">Assign</button>` : '<span class="note">No tracked applications yet.</span>'}<button data-pm="dismiss">Dismiss</button></div>
        </div>`;
      }).join("")}</div>`;
  }

  function tableCard() {
    if (!S.apps.length) return `<div class="empty">Nothing tracked yet. Open a posting, apply on the employer's site, then press “I applied”.</div>`;
    const counts = {};
    S.apps.forEach((a) => { counts[a.effective_status] = (counts[a.effective_status] || 0) + 1; });
    const cls = { interview: "g", offer: "g", rejected: "b", ghosted: "w" };
    const chips = ["applied", "interview", "offer", "rejected", "ghosted", "withdrawn"].map((k) => `<span class="pill ${cls[k] || ""}">${STATUS[k]} ${counts[k] || 0}</span>`).join("");
    const rows = S.apps.map((a) => {
      const ev = lastEvent(a.id);
      const opts = ["applied", "interview", "offer", "rejected", "withdrawn"].map((s) => `<option value="${s}"${s === a.status ? " selected" : ""}>${STATUS[s]}</option>`).join("");
      return `<tr data-app="${esc(a.id)}">
        <td><a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">${esc(a.title)}</a><div class="note">${esc(a.company)}${a.loc ? " · " + esc(a.loc) : ""}</div></td>
        <td>${esc(fmtDate(a.applied_at))}</td>
        <td><select data-pm="status" aria-label="Status of ${esc(a.title)}">${opts}</select>
          ${a.effective_status === "ghosted" ? `<div><span class="pill w">Ghosted? No reply in ${esc(a.ghost_days)} days</span></div>` : ""}
          ${a.status_source === "email" ? '<div class="note">set from an email</div>' : ""}</td>
        <td>${ev ? `${esc(KIND[ev.kind])}<div class="note">${esc(fmtDate(ev.received_at))}</div>` : '<span class="note">none yet</span>'}</td>
        <td><button data-pm="remove">Remove</button></td></tr>`;
    }).join("");
    const gd = (S.profile && S.profile.ghost_days) || 21;
    return `<div class="panel"><h2>My applications (${S.apps.length})</h2>
      <div class="pm-chips">${chips}</div>
      <div class="tabwrap"><table class="pm-table"><thead><tr><th>Role</th><th>Applied</th><th>Status</th><th>Last email</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <label for="pmGhost">Count an application as ghosted after</label>
      <select id="pmGhost" data-pm="ghost" style="width:auto">${[14, 21, 30, 45].map((d) => `<option value="${d}"${d === gd ? " selected" : ""}>${d} days without a reply</option>`).join("")}</select></div>`;
  }

  function pasteCard() {
    return `<div class="panel"><h2>Paste an email</h2>
      <p class="note">Not forwarding? Paste a confirmation, interview or rejection email, with its From and Subject lines if you can. It is read once and not kept.</p>
      <textarea id="pmPaste" placeholder="From: Careers &lt;careers@company.com&gt;&#10;Subject: Thank you for applying&#10;&#10;We have received your application…"></textarea>
      <div class="row" style="margin-top:8px"><button class="primary" data-pm="paste">Add this email</button></div>
      <p class="note" id="pmPasteMsg" aria-live="polite">${esc(S.pasteMsg)}</p></div>`;
  }

  function privacyCard() {
    const blocked = S.blocked.length
      ? `<p class="note">Blocked companies (hidden from your lists):</p><div class="row">${S.blocked.map((b) => `<span class="pill">${esc(b.company)} <button data-pm="unblock" data-ck="${esc(b.company_key)}" aria-label="Unblock ${esc(b.company)}" style="padding:0 6px;margin-left:4px">×</button></span>`).join("")}</div>` : "";
    return `<div class="panel"><h2>Your data</h2>${blocked}
      <p class="note">Everything here is visible only to you. You can take it with you or erase it at any time.</p>
      <div class="row"><button data-pm="export">Download my data</button><button data-pm="delcv">Delete my saved CV profile and matches</button><button class="pm-danger" data-pm="delacct">Delete my account and all data</button></div></div>`;
  }

  function trackerHtml() {
    return `<div class="pm-stack">${emailCard()}${reviewCard()}${tableCard()}${pasteCard()}${privacyCard()}</div>`;
  }

  H.renderApps = function (v) {
    if (!S.user) {
      v.innerHTML = `<div class="empty"><strong>Sign in to track your applications.</strong><br>Use the account box on the left. Jobs you mark as applied appear here and update from your confirmation, interview and rejection emails.</div>`;
      return;
    }
    const keep = $("pmPaste") ? $("pmPaste").value : "";
    v.innerHTML = trackerHtml();
    if (keep && $("pmPaste")) $("pmPaste").value = keep;
    if (Date.now() - S.loadedAt > 15000) reloadSoon();
  };
  function refreshTracker() { if (PM.tab() === "apps") H.renderApps($("view")); }

  /* ------------------------------------------------------------ actions */
  async function markApplied(key) {
    const j = PM.jobs().find((x) => jobKey(x) === key);
    if (!j) return;
    const src = j.sources[0] || {};
    const { error } = await S.sb.from("applications").insert({ user_id: S.user.id, job_key: key, company: j.company, title: j.title, loc: j.loc || null, url: src.url || null, source: src.src || null });
    if (error && error.code !== "23505") throw error;
    await loadAll(); refreshJobUI(key);
    flash(C.inboundDomain ? "Saved. If forwarding is on, the confirmation email will update it." : "Saved in My applications.");
  }
  async function blockCompany(key) {
    const j = PM.jobs().find((x) => jobKey(x) === key);
    if (!j) return;
    const ck = PM.norm(j.company);
    const { error } = await S.sb.from("blocked_companies").insert({ user_id: S.user.id, company_key: ck, company: j.company });
    if (error && error.code !== "23505") throw error;
    await loadAll(); PM.render();
    flash(j.company + " is blocked. You can unblock it in My applications, Your data.");
  }
  async function setStatus(id, status) {
    must(await S.sb.from("applications").update({ status, status_source: "manual", status_updated_at: new Date().toISOString() }).eq("id", id));
    await loadAll(); refreshTracker(); refreshAllJobUI();
  }
  async function exportData() {
    const uid = S.user.id, t = (n) => S.sb.from(n).select("*").eq("user_id", uid);
    const [p, m, a, e, b] = await Promise.all([t("profiles"), t("matches"), t("applications"), t("email_events"), t("blocked_companies")]);
    const out = { exportedAt: new Date().toISOString(), email: S.user.email, profile: must(p), matches: must(m), applications: must(a), email_events: must(e), blocked_companies: must(b) };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    link.download = "path-match-my-data.json"; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  const view = $("view");
  view.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-pm]");
    if (!b || !view.contains(b) || b.tagName === "SELECT") return;
    const act = b.dataset.pm;
    const key = b.closest("[data-key]") && b.closest("[data-key]").dataset.key;
    const appId = b.closest("[data-app]") && b.closest("[data-app]").dataset.app;
    const evRow = b.closest("[data-ev]");
    b.disabled = true;
    try {
      switch (act) {
        case "signin": panel.scrollIntoView({ behavior: "smooth", block: "center" }); if ($("acctEmail")) $("acctEmail").focus(); break;
        case "goapps": PM.setTab("apps"); break;
        case "applied": await markApplied(key); break;
        case "block": await blockCompany(key); break;
        case "unblock": must(await S.sb.from("blocked_companies").delete().eq("user_id", S.user.id).eq("company_key", b.dataset.ck)); await loadAll(); refreshTracker(); PM.render(); break;
        case "copyaddr": try { await navigator.clipboard.writeText(b.dataset.addr); flash("Address copied."); } catch (_) { flash("Select the address and copy it."); } break;
        case "rotate":
          if (confirm("Get a new address? The old one stops working, so update your Gmail or Outlook forwarding.")) { must(await S.sb.rpc("rotate_inbox_token")); await loadAll(); refreshTracker(); }
          break;
        case "assign": {
          const sel = evRow.querySelector("select");
          must(await S.sb.rpc("assign_email_event", { p_event: evRow.dataset.ev, p_app: sel.value }));
          await loadAll(); refreshTracker(); refreshAllJobUI(); flash("Assigned. The status was updated."); break;
        }
        case "dismiss": must(await S.sb.from("email_events").update({ needs_review: false }).eq("id", evRow.dataset.ev)); await loadAll(); refreshTracker(); break;
        case "remove":
          if (confirm("Remove this application from your tracker?")) { must(await S.sb.from("applications").delete().eq("id", appId)); await loadAll(); refreshTracker(); refreshAllJobUI(); }
          break;
        case "paste": {
          const text = ($("pmPaste") || {}).value || "";
          S.pasteMsg = "Reading…"; $("pmPasteMsg").textContent = S.pasteMsg;
          const { data, error } = await S.sb.functions.invoke("paste-email", { body: { text } });
          if (error) throw new Error(error.message || "Could not process that email.");
          if (data && data.error) throw new Error(data.error);
          S.pasteMsg = data.stored === false
            ? (data.duplicate ? "You already added that email." : "That does not look like a job application email, so it was ignored.")
            : data.kind === "verification" ? "That is a Gmail forwarding confirmation. Your code is " + (data.code || "(not found)") + "."
            : data.matched ? `Recognised as ${KIND[data.kind].toLowerCase()} and matched to ${data.application.title} at ${data.application.company}.`
            : `Recognised as ${KIND[data.kind].toLowerCase()}, but it could not be matched to one application. Pick one under “Needs your confirmation”.`;
          if (data.stored) { $("pmPaste").value = ""; }
          await loadAll(); const keep = S.pasteMsg; refreshTracker(); S.pasteMsg = keep; if ($("pmPasteMsg")) $("pmPasteMsg").textContent = keep; refreshAllJobUI();
          break;
        }
        case "export": await exportData(); break;
        case "delcv":
          if (confirm("Delete your saved CV profile and matches? Your applications are kept.")) {
            must(await S.sb.from("profiles").update({ cv_keywords: null, cv_saved_at: null }).eq("user_id", S.user.id));
            must(await S.sb.from("matches").delete().eq("user_id", S.user.id));
            S.save = false; lastSig = ""; renderAccount(); flash("Deleted. Saving is now off; turn it on in the account box if you want it back.");
          }
          break;
        case "delacct":
          if (confirm("Delete your account and everything in it (profile, matches, applications, email records)? This cannot be undone.")) {
            const { error } = await S.sb.functions.invoke("delete-account");
            if (error) throw new Error("Could not delete the account. Try again, or contact the site owner.");
            await S.sb.auth.signOut(); flash("Your account and data were deleted.");
          }
          break;
      }
    } catch (err) { flash((err && err.message) || "Something went wrong."); }
    finally { if (b.isConnected) b.disabled = false; }
  });

  view.addEventListener("change", async (ev) => {
    const el = ev.target.closest("[data-pm]");
    if (!el || el.tagName !== "SELECT") return;
    try {
      if (el.dataset.pm === "status") await setStatus(el.closest("[data-app]").dataset.app, el.value);
      else if (el.dataset.pm === "ghost") {
        must(await S.sb.from("profiles").update({ ghost_days: +el.value }).eq("user_id", S.user.id));
        await loadAll(); refreshTracker(); refreshAllJobUI();
      }
    } catch (err) { flash((err && err.message) || "Could not save that change."); }
  });

  renderAccount();
  init().catch((e) => { S.msg = "Accounts are unavailable right now: " + (e.message || e); renderAccount(); });
})();
