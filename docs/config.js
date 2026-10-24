// Public site configuration. Leave supabaseUrl empty and the site works exactly as before (no accounts).
// Everything here is safe to publish: the anon key only works inside the Row-Level Security rules.
// NEVER put the service_role key here.
window.PM_CONFIG = {
  supabaseUrl: "",       // https://<project-ref>.supabase.co
  supabaseAnonKey: "",   // Supabase > Project Settings > API > "anon public" key
  inboundDomain: "",     // e.g. mail.yourdomain.com. Enables each user's private forwarding address
  providers: [],         // add "google" after enabling Google in Supabase > Authentication > Providers
};
