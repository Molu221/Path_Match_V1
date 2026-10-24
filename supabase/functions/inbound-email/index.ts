// Inbound email webhook. An inbound-email service (Postmark) posts every message sent to
// <inbox_token>@<INBOUND_DOMAIN> here. Deployed WITHOUT JWT verification: it is protected by INBOUND_SECRET instead.
//   https://<project>.supabase.co/functions/v1/inbound-email?key=<INBOUND_SECRET>
import { createClient } from "npm:@supabase/supabase-js@2";
import { processEmail } from "../_shared/process.js";
import { json, safeEqual } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("INBOUND_SECRET") ?? "";
const DOMAIN = (Deno.env.get("INBOUND_DOMAIN") ?? "").toLowerCase();
// Set STORE_SUBJECT=false to keep subject lines out of the database entirely (the review list then shows the sender only).
const STORE_SUBJECT = (Deno.env.get("STORE_SUBJECT") ?? "true") !== "false";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const addresses = (v: unknown): string[] =>
  typeof v === "string" ? (v.match(/[^\s<>,;"']+@[^\s<>,;"']+/g) ?? []).map((s) => s.toLowerCase()) : [];

function recipients(p: any): string[] {
  return [
    ...addresses(p.OriginalRecipient),                      // Postmark: the address the message was delivered to
    ...(p.ToFull ?? []).flatMap((r: any) => addresses(r.Email)),
    ...(p.CcFull ?? []).flatMap((r: any) => addresses(r.Email)),
    ...addresses(p.To), ...addresses(p.to), ...addresses(p.recipient),
  ];
}

function inboxToken(addrs: string[]): string | null {
  for (const a of addrs) {
    const [local, domain] = a.split("@");
    if (DOMAIN && domain !== DOMAIN) continue;
    const token = local.split("+")[0];
    if (/^[0-9a-f]{24}$/.test(token)) return token;
  }
  return null;
}

const stripTags = (h: string) => h.replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!SECRET) return json({ error: "INBOUND_SECRET is not configured" }, 500);
  if (!safeEqual(new URL(req.url).searchParams.get("key") ?? "", SECRET)) return json({ error: "unauthorized" }, 401);
  if (Number(req.headers.get("content-length") ?? 0) > 35e6) return json({ error: "too large" }, 413);

  let p: any;
  try { p = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const token = inboxToken(recipients(p));
  if (!token) return json({ ok: true, ignored: "no inbox address" });        // 200 so the provider does not retry

  const { data: profile, error } = await admin.from("profiles").select("user_id").eq("inbox_token", token).maybeSingle();
  if (error) return json({ error: "lookup failed" }, 500);
  if (!profile) return json({ ok: true, ignored: "unknown address" });

  const headers: any[] = p.Headers ?? [];
  const mid = headers.find((h) => String(h.Name).toLowerCase() === "message-id")?.Value ?? p.MessageID ?? p.messageId ?? "";

  try {
    const result = await processEmail(admin, profile.user_id, {
      fromEmail: p.FromFull?.Email ?? p.From ?? p.from ?? "",
      fromName: p.FromFull?.Name ?? p.FromName ?? "",
      subject: p.Subject ?? p.subject ?? "",
      date: p.Date ?? p.date ?? "",
      body: p.TextBody ?? p.text ?? (p.HtmlBody || p.html ? stripTags(p.HtmlBody ?? p.html) : ""),
      messageId: String(mid),
    }, { storeSubject: STORE_SUBJECT });
    return json({ ok: true, kind: result.kind, stored: result.stored });
  } catch (e) {
    console.error("inbound-email failed:", (e as Error).message);       // never log the email content
    return json({ error: "processing failed" }, 500);                    // provider retries; duplicates are ignored by message_id
  }
});
