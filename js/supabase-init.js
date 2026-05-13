// ── Supabase Singleton ────────────────────────────────────────────────────
(function() {
  var cfg = window.APP_CONFIG || {};
  try {
    if (!window.supabase || !window.supabase.createClient) {
      window.supabaseClient = null;
      return;
    }
    window.supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: cfg.SUPABASE_AUTH_STORAGE_KEY || "turbo-gpt-auth",
      },
    });
  } catch (_err) {
    window.supabaseClient = null;
  }
})();
