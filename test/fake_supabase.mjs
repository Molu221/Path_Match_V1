// In-memory stand-in for the parts of supabase-js that the site and the Edge Functions use. TEST HELPER ONLY.
// It mirrors the schema's unique keys, defaults, the `applications_view` ghosted status and the status rules of
// apply_email_event(); the real SQL is tested separately in test/sql against a real Postgres.

const UNIQUE = {
  applications: ["user_id", "job_key"], matches: ["user_id", "job_key"],
  email_events: ["user_id", "message_id"], blocked_companies: ["user_id", "company_key"], profiles: ["user_id"],
};
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const hex24 = () => [...Array(24)].map(() => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

/** Same rules as public.apply_email_event in the migration. */
export function applyEmailEvent(db, { p_user, p_app, p_kind, p_received }) {
  const a = db.applications.find((x) => x.id === p_app && x.user_id === p_user);
  if (!a) return;
  const rec = new Date(p_received);
  a.last_email_at = !a.last_email_at || rec > new Date(a.last_email_at) ? rec.toISOString() : a.last_email_at;
  if (p_kind === "confirmation" && !a.confirmed_at) a.confirmed_at = rec.toISOString();
  const next = { interview: "interview", offer: "offer", rejection: "rejected" }[p_kind];
  if (next && next !== a.status && rec > new Date(a.status_updated_at)) {
    Object.assign(a, { status: next, status_source: "email", status_updated_at: rec.toISOString() });
  }
}

export function makeFakeSb(seed = {}, { userId = null } = {}) {
  const db = { profiles: [], applications: [], email_events: [], matches: [], blocked_companies: [], ...seed };
  const rpcCalls = [];

  const defaults = (table, row) => {
    const now = new Date().toISOString();
    if (table === "applications") return { id: uuid(), status: "applied", status_source: "applied", applied_at: now, status_updated_at: now, confirmed_at: null, last_email_at: null, ...row };
    if (table === "profiles") return { inbox_token: hex24(), work_permit: null, target_term: null, ghost_days: 21, cv_keywords: null, cv_saved_at: null, last_inbound_at: null, ...row };
    if (table === "email_events") return { id: uuid(), application_id: null, needs_review: false, candidates: [], note: null, ...row };
    if (table === "matches") return { id: uuid(), ...row };
    return { ...row };
  };
  const present = (table, r) => {
    if (table !== "applications_view") return r;
    const p = db.profiles.find((x) => x.user_id === r.user_id) || { ghost_days: 21 };
    const ghosted = r.status === "applied" && Date.now() - Date.parse(r.applied_at) > p.ghost_days * 864e5;
    return { ...r, effective_status: ghosted ? "ghosted" : r.status, ghost_days: p.ghost_days };
  };
  const clash = (table, row) => db[table].find((x) => UNIQUE[table].every((c) => x[c] === row[c]));

  const from = (name) => {
    const table = name === "applications_view" ? "applications" : name;
    const st = { filters: [], op: "select", order: null, limit: null };
    const test = (r) => st.filters.every(([op, c, v]) => (op === "eq" ? r[c] === v : op === "neq" ? r[c] !== v : r[c] < v));
    const exec = () => {
      if (st.op === "insert") {
        const row = defaults(table, st.row);
        if (clash(table, row)) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        db[table].push(row); return { data: [row], error: null };
      }
      if (st.op === "upsert") {
        for (const r of st.rows) {
          const hit = clash(table, r);
          if (hit) Object.assign(hit, r); else db[table].push(defaults(table, r));
        }
        return { data: null, error: null };
      }
      if (st.op === "update") { const hit = db[table].filter(test); hit.forEach((r) => Object.assign(r, st.patch)); return { data: hit, error: null }; }
      if (st.op === "delete") { const keep = db[table].filter((r) => !test(r)); const n = db[table].length - keep.length; db[table].splice(0, db[table].length, ...keep); return { data: Array(n).fill({}), error: null }; }
      let rows = db[table].filter(test).map((r) => present(name, r));
      if (st.order) { const [c, asc] = st.order; rows = rows.sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1)); }
      if (st.limit != null) rows = rows.slice(0, st.limit);
      return { data: rows, error: null };
    };
    const api = {
      select: () => api,
      eq: (c, v) => { st.filters.push(["eq", c, v]); return api; },
      neq: (c, v) => { st.filters.push(["neq", c, v]); return api; },
      lt: (c, v) => { st.filters.push(["lt", c, v]); return api; },
      order: (c, o) => { st.order = [c, !o || o.ascending !== false]; return api; },
      limit: (n) => { st.limit = n; return api; },
      insert: (row) => { st.op = "insert"; st.row = row; return api; },
      upsert: (rows) => { st.op = "upsert"; st.rows = rows; return api; },
      update: (patch) => { st.op = "update"; st.patch = patch; return api; },
      delete: () => { st.op = "delete"; return api; },
      maybeSingle: async () => { const r = exec(); return { data: (r.data && r.data[0]) || null, error: r.error }; },
      then: (res, rej) => Promise.resolve(exec()).then(res, rej),
    };
    return api;
  };

  const handlers = {
    apply_email_event: (args) => applyEmailEvent(db, args),
    assign_email_event: (args) => {
      const e = db.email_events.find((x) => x.id === args.p_event && x.user_id === userId);
      const a = db.applications.find((x) => x.id === args.p_app && x.user_id === userId);
      if (!e || !a) return { message: "not found" };
      Object.assign(e, { application_id: a.id, needs_review: false });
      applyEmailEvent(db, { p_user: userId, p_app: a.id, p_kind: e.kind, p_received: e.received_at });
    },
    rotate_inbox_token: () => { const p = db.profiles.find((x) => x.user_id === userId); p.inbox_token = hex24(); return null; },
  };
  const rpc = async (name, args) => {
    rpcCalls.push([name, args]);
    const err = handlers[name] ? handlers[name](args || {}) : null;
    return { data: null, error: err && err.message ? err : null };
  };

  return { from, rpc, db, rpcCalls };
}
