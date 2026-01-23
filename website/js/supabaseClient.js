// IMPORTANT:
// This file is loaded ONCE and owns Supabase completely.

const SUPABASE_URL = "https://kppgmvfdfuhmtuaukkdn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_e4AhlY9ZIgdlsG8rl111Fg_tWghrBW4";

// Supabase CDN must already be loaded in index.html
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Expose a SINGLE global reference
window.supabaseClient = supabaseClient
