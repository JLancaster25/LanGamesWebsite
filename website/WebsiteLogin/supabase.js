const SUPABASE_URL = "https://kppgmvfdfuhmtuaukkdn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_e4AhlY9ZIgdlsG8rl111Fg_tWghrBW4";

window.supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
