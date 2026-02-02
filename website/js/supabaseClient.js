// supabaseClient.js — SINGLETON, FINAL

if (!window.supabase) {
  throw new Error("❌ Supabase CDN not loaded");
}

if (!window.__SB_SINGLETON__) {
  window.__SB_SINGLETON__ = supabase.createClient(
    "https://kppgmvfdfuhmtuaukkdn.supabase.co",
    "sb_publishable_e4AhlY9ZIgdlsG8rl111Fg_tWghrBW4",
    {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    }
  );

  console.log("✅ Supabase singleton created");
} else {
  console.log("ℹ️ Supabase singleton reused");
}

window.sb = window.__SB_SINGLETON__;
