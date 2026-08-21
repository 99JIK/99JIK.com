// Window-manager arithmetic, kept out of the component so it can be reasoned about
// (and tested) without a DOM. Geometry, snapping, and the saved layout.

(function () {
  const MIN_W = 420;
  const MIN_H = 260;
  const DOCK_H = 44;          // the dock is always there, so it is not usable area
  const LAYOUT_KEY = "99jik:desktop:v1";
  const WORKSPACES = 4;

  // Usable area, i.e. the screen minus the dock. Everything below works in these
  // coordinates so a maximised window never hides behind the dock.
  function area(vw, vh) {
    return { x: 0, y: 0, w: vw, h: Math.max(MIN_H, vh - DOCK_H) };
  }

  // Where a drag ending at (px, py) should put the window. Edges are a band, not a
  // line, because nobody lands on a line: EDGE is how deep the band reaches.
  const EDGE = 28;
  function snapZone(px, py, vw, vh) {
    const left = px <= EDGE, right = px >= vw - EDGE;
    const top = py <= EDGE, bottom = py >= vh - EDGE - DOCK_H;
    if (top && left) return "tl";
    if (top && right) return "tr";
    if (bottom && left) return "bl";
    if (bottom && right) return "br";
    if (top) return "max";
    if (left) return "l";
    if (right) return "r";
    return null;
  }

  // The rectangle a zone means. Halves and quarters of the usable area.
  function snapRect(zone, vw, vh) {
    const a = area(vw, vh);
    const halfW = Math.round(a.w / 2), halfH = Math.round(a.h / 2);
    switch (zone) {
      case "max": return { max: true };
      case "l":  return { x: 0,     y: 0,     w: halfW,      h: a.h };
      case "r":  return { x: halfW, y: 0,     w: a.w - halfW, h: a.h };
      case "tl": return { x: 0,     y: 0,     w: halfW,      h: halfH };
      case "tr": return { x: halfW, y: 0,     w: a.w - halfW, h: halfH };
      case "bl": return { x: 0,     y: halfH, w: halfW,      h: a.h - halfH };
      case "br": return { x: halfW, y: halfH, w: a.w - halfW, h: a.h - halfH };
      default: return null;
    }
  }

  // A restored layout is not trusted: the window could have been saved on a wider
  // screen, or against a version of the app list that no longer has that app.
  function clamp(win, vw, vh) {
    const a = area(vw, vh);
    const w = Math.max(MIN_W, Math.min(a.w, win.w | 0));
    const h = Math.max(MIN_H, Math.min(a.h, win.h | 0));
    return {
      ...win, w, h,
      x: Math.max(0, Math.min(a.w - Math.min(w, 120), win.x | 0)),
      y: Math.max(0, Math.min(a.h - 40, win.y | 0)),
    };
  }

  const STATES = ["max", "windowed", "min"];

  function loadLayout(validApps) {
    try {
      const raw = window.PREFS.store.get(LAYOUT_KEY);
      if (!raw) return null;
      const j = JSON.parse(raw);
      if (!j || !Array.isArray(j.wins)) return null;
      const wins = j.wins
        .filter((w) => w && validApps.includes(w.app) && STATES.includes(w.state))
        .map((w, i) => clamp({
          app: w.app, state: w.state, z: i + 1,
          x: w.x, y: w.y, w: w.w, h: w.h,
          ws: Math.max(0, Math.min(WORKSPACES - 1, w.ws | 0)),
          snap: typeof w.snap === "string" ? w.snap : null,
          // What the window was showing. Capped, because it comes back from storage
          // and a window argument is a path or a URL, never an essay.
          arg: typeof w.arg === "string" && w.arg.length < 300 ? w.arg : undefined,
        }, window.innerWidth, window.innerHeight));
      if (!wins.length) return null;
      return { wins, ws: Math.max(0, Math.min(WORKSPACES - 1, j.ws | 0)) };
    } catch { return null; }
  }

  function saveLayout(wins, ws) {
    try {
      window.PREFS.store.set(LAYOUT_KEY, JSON.stringify({
        // Only the parts that describe a layout. Ids and nonces are per-session
        // and would be wrong on the next visit; `arg` is kept because a viewer
        // window without the file it was showing is not the same window.
        wins: wins.map((w) => ({
          app: w.app, state: w.state, x: w.x, y: w.y, w: w.w, h: w.h, ws: w.ws,
          snap: w.snap, arg: w.arg,
        })),
        ws,
      }));
    } catch {}
  }

  function clearLayout() {
    try { window.PREFS.store.del(LAYOUT_KEY); } catch {}
  }

  window.WM = { MIN_W, MIN_H, DOCK_H, WORKSPACES, EDGE, area, snapZone, snapRect, clamp,
                loadLayout, saveLayout, clearLayout };
})();
