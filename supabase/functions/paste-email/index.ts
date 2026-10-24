// "Paste an email" fallback for users who do not set up forwarding. Requires a signed-in user.
import { createClient } from "npm:@supabase/supabase-js@2";
import { parsePastedEmail, processEmail, sha256Hex } from "../_shared/process.js";
import { cors, json } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORE_SUBJECT = (Deno.env.get("STORE_SUBJECT") ?? "true") !== "false";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token);
  if (!user) return json({ error: "not signed in" }, 401);

  const { text } = await req.json().catch(() => ({ text: "" }));
  if (typeof text !== "string" || text.trim().length < 20) return json({ error: "Paste the email text first." }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const email = parsePastedEmail(text.slice(0, 50000));
  try {
    const result = await processEmail(admin, user.id,
      { ...email, messageId: "paste-" + (await sha256Hex(text)).slice(0, 32) }, { storeSubject: STORE_SUBJECT });
    return json(result);
  } catch (e) {
    console.error("paste-email failed:", (e as Error).message);
    return json({ error: "Could not process that email." }, 500);
  }
});
