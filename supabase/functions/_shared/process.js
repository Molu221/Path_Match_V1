// Shared pipeline: classify one email, match it to an application, store a small event row, update the status.
// `sb` is a supabase-js client with the service role (the caller has already authenticated the user).
// The email body is read in memory only and is never written anywhere.

import { classifyEmail } from "./classify.js";
import { matchApplication, domainOf } from "./match.js";

const REVIEWABLE = new Set(["confirmation", "interview", "rejection", "offer"]);

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function must(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

/** Pull From / Subject / Date out of a pasted email if the user included the header lines. */
export function parsePastedEmail(text) {
  const raw = String(text || "").replace(/\r/g, "");
  const head = raw.split("\n").slice(0, 25);
  const pick = (re) => { for (const l of head) { const m = l.match(re); if (m) return m[1].trim(); } return ""; };
  const from = pick(/^from:\s*(.+)$/i);
  const subject = pick(/^(?:subject|objet):\s*(.+)$/i);
  const date = pick(/^date:\s*(.+)$/i);
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const fromEmail = m ? m[2].trim() : (from.match(/[^\s<>]+@[^\s<>]+/) || [""])[0];
  const fromName = m ? m[1].trim() : "";
  return { subject, fromEmail, fromName, date, body: raw };
}

export async function processEmail(sb, userId, email, { storeSubject = true, now = new Date() } = {}) {
  let received = email.date ? new Date(email.date) : now;
  if (Number.isNaN(received.getTime()) || received.getTime() > now.getTime() + 36e5) received = now;

  // So the user can see that forwarding works, even when the email itself is ignored.
  must(await sb.from("profiles").update({ last_inbound_at: now.toISOString() }).eq("user_id", userId), "profile stamp");

  const cls = classifyEmail(email);
  if (cls.kind === "other") return { kind: "other", stored: false };

  const messageId = String(email.messageId || "").trim().slice(0, 300) ||
    "h-" + (await sha256Hex(`${email.fromEmail}|${email.subject}|${received.toISOString()}`)).slice(0, 32);

  const dup = must(await sb.from("email_events").select("id").eq("user_id", userId).eq("message_id", messageId).maybeSingle(), "dedupe lookup");
  if (dup) return { kind: cls.kind, stored: false, duplicate: true };

  let match = { appId: null, candidates: [], why: [] };
  let apps = [];
  if (REVIEWABLE.has(cls.kind)) {
    apps = must(await sb.from("applications").select("id, company, title, applied_at, status")
      .eq("user_id", userId).neq("status", "withdrawn").limit(500), "applications lookup") || [];
    match = matchApplication(email, apps, received);
  }

  const row = {
    user_id: userId,
    application_id: match.appId,
    message_id: messageId,
    kind: cls.kind,
    confidence: cls.confidence,
    from_domain: domainOf(email.fromEmail) || null,
    subject_hint: storeSubject ? String(email.subject || "").slice(0, 100) : null,
    received_at: received.toISOString(),
    needs_review: REVIEWABLE.has(cls.kind) && !match.appId,
    candidates: match.candidates,
    note: cls.kind === "verification" ? cls.code : null,
  };
  const ins = await sb.from("email_events").insert(row);
  if (ins.error) {
    if (ins.error.code === "23505") return { kind: cls.kind, stored: false, duplicate: true };  // delivered twice at once
    throw new Error(`event insert: ${ins.error.message}`);
  }

  if (match.appId) {
    must(await sb.rpc("apply_email_event", { p_user: userId, p_app: match.appId, p_kind: cls.kind, p_received: received.toISOString() }), "status update");
  }

  const app = apps.find((a) => a.id === match.appId);
  return {
    kind: cls.kind,
    confidence: cls.confidence,
    stored: true,
    matched: !!match.appId,
    needsReview: row.needs_review,
    application: app ? { company: app.company, title: app.title } : null,
    code: cls.code || null,
  };
}
