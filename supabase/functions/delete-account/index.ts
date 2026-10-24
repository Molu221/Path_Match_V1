// Deletes the signed-in user. Every table references auth.users with ON DELETE CASCADE,
// so profile, matches, applications, email events and blocked companies go with it.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cors, json } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token);
  if (!user) return json({ error: "not signed in" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: "Could not delete the account." }, 500);
  return json({ ok: true });
});
