// Visitor preferences: theme, language, default mode, cursor trail.
// Loaded before crisp.js and the view modules on purpose - <html lang> has to be
// settled before Crisp reads it at import time to pick its widget locale.
(function () {
  const KEY = "99jik:tweaks:v1";

  // localStorage access itself throws where storage is disabled (sandboxed iframe,
  // dom.storage.enabled=false). Every module here runs at bundle-eval time, so one
  // uncaught throw takes render() down with it. Never let it escape.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  const DEFAULTS = { theme: "dark", defaultMode: "terminal", lang: "ko" };

  // Stored prefs outlive releases: a theme gets renamed, an option gets dropped.
  // Validate each field against what exists now instead of spreading the blob in blind.
  function load() {
    let saved = {};
    try { saved = JSON.parse(store.get(KEY) || "{}") || {}; } catch {}
    return {
      theme: window.THEMES[saved.theme] ? saved.theme : DEFAULTS.theme,
      defaultMode: saved.defaultMode === "easy" ? "easy" : DEFAULTS.defaultMode,
      lang: saved.lang === "en" ? "en" : DEFAULTS.lang,
    };
  }

  function save(next) { store.set(KEY, JSON.stringify(next)); }

  window.PREFS = { store, load, save, DEFAULTS };

  document.documentElement.lang = load().lang;
})();
