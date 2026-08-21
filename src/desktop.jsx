// The desktop. JIKOS is its own distribution, so the wallpaper is generated from the
// active theme rather than shipped as an image: four themes get four wallpapers for
// no extra bytes.
//
// Windows are singletons per app: opening the browser twice raises the one that is
// already there, the way a dock icon does. Every window stays mounted for its whole
// life, wherever it appears to be. Minimised, on another workspace, behind the lock
// screen: all of those move it off-screen. Unmounting one would reload its iframes
// and stop whatever it was playing, which is a bug this has had three times.

import * as React from "preact/compat";
import { Browser } from "./browser.jsx";
import { ChatWindow } from "./chat.jsx";
import { MpvHost, MusicPlayer } from "./mpv.jsx";
import { PdfViewer } from "./pdf.jsx";
import { Files } from "./files.jsx";
import { Settings } from "./settings.jsx";
import { Viewer } from "./viewer.jsx";

const { MIN_W, MIN_H, DOCK_H, WORKSPACES, area, snapZone, snapRect,
        loadLayout, saveLayout, clearLayout } = window.WM;

// Windowing needs a pointer and room. On a phone the terminal simply is the screen.
function windowingAvailable() {
  try {
    return window.matchMedia("(min-width: 860px) and (pointer: fine)").matches;
  } catch { return false; }
}

// `multi` is one window per thing rather than one window in total. A shell, a file
// manager, a browser and a viewer are things you have several of; a settings panel,
// a conversation and a media player are not, and a second copy of those would just
// be a second view of the same state.
export const APPS = {
  // `code` is the physical key, not the character. With a Korean layout active
  // e.key for the M key is a jamo, so Ctrl+Alt+M matched nothing; e.code is
  // KeyM whatever the input method is doing. `key` is only the label.
  terminal: { glyph: "▶_", ko: "터미널",   en: "Terminal", w: 980, h: 640, key: "T", code: "KeyT", multi: true },
  files:    { glyph: "▤",  ko: "파일",     en: "Files",    w: 760, h: 520, key: "F", code: "KeyF", multi: true },
  browser:  { glyph: "◇",  ko: "브라우저", en: "Browser",  w: 900, h: 640, key: "B", code: "KeyB", multi: true },
  chat:     { glyph: "✉",  ko: "채팅",     en: "Chat",     w: 460, h: 560, key: "C", code: "KeyC" },
  music:    { glyph: "♪",  ko: "음악",     en: "Music",    w: 480, h: 600, key: "M", code: "KeyM" },
  cv:       { glyph: "PDF",ko: "이력서",   en: "CV",       w: 760, h: 760, key: "V", code: "KeyV" },
  settings: { glyph: "⚙",  ko: "설정",     en: "Settings", w: 520, h: 560, key: ",", code: "Comma" },
  // One window per file rather than one window in total: opening a second note
  // should not close the first, the way it would not in any file viewer.
  viewer:   { glyph: "≡",  ko: "뷰어",     en: "Viewer",   w: 640, h: 640, multi: true },
};
const APP_KEYS = Object.keys(APPS);
const DOCK_ORDER = ["terminal", "files", "browser", "chat", "music", "cv"];
const DESKTOP_DIR = "/home/jeongin/Desktop";

// The desktop is a folder, the way it is on the system this imitates. Icons are the
// files in ~/Desktop: a .desktop entry launches its Exec, anything else opens the
// way it would in the file manager. Nothing here is a second list to keep in step.
function desktopEntries() {
  const { node } = window.FS.resolve(DESKTOP_DIR);
  if (!node || node.type !== "dir") return [];
  return Object.entries(node.children).map(([file, n]) => {
    const path = DESKTOP_DIR + "/" + file;
    if (!/\.desktop$/.test(file)) {
      return { file, path, name: file, glyph: /\.md$/i.test(file) ? "≡" : "·", open: "viewer" };
    }
    const fields = {};
    for (const line of n.content || []) {
      const i = line.indexOf("=");
      if (i > 0) fields[line.slice(0, i)] = line.slice(i + 1);
    }
    // Exec has to name an app that exists, or the icon is a button that does
    // nothing. An unknown one falls back to showing the file.
    const exec = APPS[fields.Exec] ? fields.Exec : "viewer";
    return { file, path, name: fields.Name || file, glyph: fields.Icon || "·",
             title: fields.Comment, open: exec };
  }).sort((a, b) => {
    // Launchers first, in the order the folder lists them; documents after.
    const la = /\.desktop$/.test(a.file), lb = /\.desktop$/.test(b.file);
    if (la !== lb) return la ? -1 : 1;
    return 0;
  });
}

let seq = 0;

function defaultRect(app, n) {
  const spec = APPS[app];
  const a = area(window.innerWidth, window.innerHeight);
  const w = Math.min(spec.w, Math.max(MIN_W, a.w - 120));
  const h = Math.min(spec.h, Math.max(MIN_H, a.h - 80));
  return {
    x: Math.max(0, Math.round(a.w * 0.5 - w / 2) + n * 30),
    y: Math.max(0, Math.round(a.h * 0.45 - h / 2) + n * 26),
    w, h,
  };
}

export function Desktop({ children, lang, onLang, theme, onTheme, cold, onEasy, onCloseSession }) {
  const [canWindow, setCanWindow] = React.useState(windowingAvailable);
  const reduceMotion = React.useMemo(() => {
    try { return window.prefersReducedMotion(); } catch { return false; }
  }, []);

  // A saved layout is a returning visitor's own arrangement, restored from their
  // browser. Nothing saved means a fresh machine: one terminal, filling the screen.
  const [boot] = React.useState(() => {
    const saved = windowingAvailable() ? loadLayout(APP_KEYS) : null;
    if (saved) return {
      wins: saved.wins.map((w) => ({ ...w, id: ++seq, nonce: 0 })), ws: saved.ws, restored: true,
    };
    // A window, not a full screen: the desktop is part of what this is, and hiding
    // it behind the first window on arrival gives that away for nothing. Anything
    // with no room for windows still gets the whole screen.
    const fits = windowingAvailable();
    return {
      wins: [{ id: ++seq, app: "terminal", state: fits ? "windowed" : "max",
               ws: 0, z: 1, nonce: 0, snap: fits ? null : "max",
               ...defaultRect("terminal", 0) }],
      ws: 0, restored: false,
    };
  });
  const [wins, setWins] = React.useState(boot.wins);
  // open() needs the list as it is after its own update, one frame later.
  const winsRef = React.useRef(boot.wins);
  React.useEffect(() => { winsRef.current = wins; }, [wins]);
  const [ws, setWs] = React.useState(boot.ws);
  const [locked, setLocked] = React.useState(false);
  const [menu, setMenu] = React.useState(null);       // { x, y }
  const [preview, setPreview] = React.useState(null); // snap target while dragging
  const [note, setNote] = React.useState(null);

  // The tree is built once at load, so reading it once is enough.
  const icons = React.useMemo(desktopEntries, []);
  const openedAt = React.useRef(performance.now());
  const dragRef = React.useRef(null);
  const peekRef = React.useRef(null);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 860px) and (pointer: fine)");
    const h = () => setCanWindow(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", h) : mq.addListener(h);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", h) : mq.removeListener(h); };
  }, []);

  // Losing the pointer (rotating a tablet, resizing down) must not strand a window
  // off-screen. Only the terminal survives; the rest have no room.
  React.useEffect(() => {
    if (canWindow) return;
    setWins((list) => {
      const term = list.find((w) => w.app === "terminal");
      return term ? [{ ...term, state: "max", ws: 0 }] : list;
    });
    setWs(0);
  }, [canWindow]);

  // Shrinking the window can leave a window sitting outside the viewport with no
  // way back, and a snapped one covering the wrong half. Both are re-derived.
  React.useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vw = window.innerWidth, vh = window.innerHeight;
        setWins((list) => list.map((w) => {
          if (w.snap && w.snap !== "max") {
            const r = snapRect(w.snap, vw, vh);
            return r ? { ...w, ...r } : w;
          }
          return window.WM.clamp(w, vw, vh);
        }));
      });
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  // The layout belongs to the visitor, so it is saved as they change it and never
  // leaves their browser. A static site has no server to keep it on, and would not
  // want one: this is their arrangement, not a record of them.
  React.useEffect(() => {
    if (!canWindow) return;
    const id = setTimeout(() => saveLayout(wins, ws), 400);
    return () => clearTimeout(id);
  }, [wins, ws, canWindow]);

  const T = lang === "en" ? {
    closed: (d) => `Session ended after ${d}. Double-click Terminal to start another.`,
    hintOpen: "double-click to open", desk: "show desktop", lock: "lock",
    newT: "new terminal", files: "Files", settings: "Settings", themeH: "Theme",
    wsLabel: (n) => `workspace ${n}`, restored: "your layout was restored",
    easy: "Easy Mode", easyHint: "the same content as a plain document",
    newWin: "shift-click for another window",
  } : {
    closed: (d) => `${d} 만에 세션이 끝났습니다. 터미널을 더블클릭하면 다시 시작합니다.`,
    hintOpen: "더블클릭해서 열기", desk: "바탕화면 보기", lock: "잠그기",
    newT: "새 터미널", files: "파일", settings: "설정", themeH: "테마",
    wsLabel: (n) => `작업공간 ${n}`, restored: "이전 배치를 복원했습니다",
    easy: "Easy Mode", easyHint: "같은 내용을 일반 문서로",
    newWin: "shift+클릭하면 새 창",
  };
  const appName = (app) => (lang === "en" ? APPS[app].en : APPS[app].ko);

  const sessionLength = () => {
    const s = Math.max(1, Math.round((performance.now() - openedAt.current) / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const here = wins.filter((w) => w.ws === ws);
  const visible = here.filter((w) => w.state !== "min" && !w.dying);
  const focused = visible.length ? visible.reduce((a, b) => (a.z >= b.z ? a : b)).id : null;

  // Raising a window has to take the keyboard with it. Without this a shortcut
  // opens Files, the window comes to the front, and everything you type still goes
  // to the terminal, because DOM focus never moved.
  const winRefs = React.useRef(new Map());
  const grab = React.useCallback((id) => {
    const el = winRefs.current.get(id);
    if (!el) return;
    // The first thing inside that can hold focus. The terminal's input is a real
    // input; the other windows lead with a button or a scroll pane.
    const target = el.querySelector(
      "input:not([type=hidden]), textarea, [contenteditable], [tabindex]:not([tabindex='-1']), button");
    try { (target || el).focus({ preventScroll: true }); } catch {}
  }, []);

  const focus = (id) => {
    setWins((list) => {
      const top = list.reduce((m, w) => Math.max(m, w.z), 0);
      return list.map((w) => (w.id === id ? { ...w, z: top + 1 } : w));
    });
    // After the render that brings it forward, not before.
    requestAnimationFrame(() => grab(id));
  };

  // `reuse` asks for whichever window of this app is already open instead of
  // another one: "open in the terminal" wants a shell, not necessarily a new shell.
  const open = (app, arg, opts) => {
    if (!APPS[app]) return;
    setNote(null);
    setWins((list) => {
      const top = list.reduce((m, w) => Math.max(m, w.z), 0);
      // A multi-instance app is identified by what it is showing. Asking for a
      // particular thing raises the window already showing it; asking for the app
      // with nothing in mind is a launch, and launching gives you another one.
      const found = APPS[app].multi
        ? (opts && opts.reuse ? list.find((w) => w.app === app)
           : arg === undefined ? null
           : list.find((w) => w.app === app && w.arg === arg))
        : list.find((w) => w.app === app);
      if (found) {
        return list.map((w) => (w.id !== found.id ? w : {
          ...w, z: top + 1, ws, dying: false,
          arg: arg === undefined ? w.arg : arg,
          // A second open with a new argument is a navigation, so the window has to
          // be told it changed: `nonce` is what forces the remount.
          nonce: arg === undefined || arg === w.arg ? w.nonce : (w.nonce || 0) + 1,
          state: w.state === "min" ? (canWindow ? "windowed" : "max") : w.state,
        }));
      }
      return [...list, {
        id: ++seq, app, arg, nonce: 0, ws, z: top + 1, snap: null,
        state: canWindow ? "windowed" : "max",
        ...defaultRect(app, list.filter((w) => w.ws === ws).length),
      }];
    });
    if (app === "terminal") openedAt.current = performance.now();
    // The window that a launcher or a shortcut just brought forward is the one you
    // meant to type into.
    requestAnimationFrame(() => {
      const w = winsRef.current.find((x) => x.app === app);
      if (w) grab(w.id);
    });
  };

  // Closing plays an unmap animation, so the window has to survive its own removal
  // for the length of it. `dying` marks it; the timer does the actual removal.
  const close = (id) => {
    const w = wins.find((x) => x.id === id);
    if (!w || w.dying) return;
    if (reduceMotion) {
      setWins((list) => list.filter((x) => x.id !== id));
    } else {
      setWins((list) => list.map((x) => (x.id === id ? { ...x, dying: true } : x)));
      setTimeout(() => setWins((list) => list.filter((x) => x.id !== id)), 130);
    }
    // The session ends when the last shell does, not when any of them does.
    const others = wins.filter((x) => x.app === "terminal" && x.id !== id && !x.dying);
    if (w.app === "terminal" && !others.length) {
      setNote(T.closed(sessionLength()));
      onCloseSession && onCloseSession();
    }
  };

  const setState = (id, state) =>
    setWins((list) => list.map((w) => (w.id === id ? { ...w, state } : w)));

  // Snapping remembers the size the window had before, so unsnapping puts it back
  // rather than leaving it stuck at half width.
  const applySnap = (id, zone) => {
    const r = snapRect(zone, window.innerWidth, window.innerHeight);
    if (!r) return;
    setWins((list) => list.map((w) => {
      if (w.id !== id) return w;
      const pre = w.snap ? w.pre : { x: w.x, y: w.y, w: w.w, h: w.h };
      if (r.max) return { ...w, state: "max", snap: "max", pre };
      return { ...w, state: "windowed", snap: zone, pre, ...r };
    }));
  };

  const restore = (id) => setWins((list) => list.map((w) => {
    if (w.id !== id) return w;
    const back = w.pre || { x: w.x, y: w.y, w: w.w, h: w.h };
    return { ...w, state: "windowed", snap: null, ...back };
  }));

  const toggleMax = (id) => {
    const w = wins.find((x) => x.id === id);
    if (!w) return;
    if (w.state === "max" || w.snap) restore(id);
    else applySnap(id, "max");
  };

  // ── drag and resize ───────────────────────────────────────────────────────
  // `kind` is "move" or one of the eight compass directions. Dragging a west or
  // north edge moves the origin as well as the size, and the minimum has to be
  // applied to the edge being dragged or the window walks away from the pointer.
  const startDrag = (e, kind, id) => {
    const win = wins.find((w) => w.id === id);
    if (!win) return;
    // Dragging a snapped or maximised window by its title bar pulls it loose, which
    // is what every window manager does and what the pointer clearly meant. The
    // window reappears under the cursor rather than jumping back to where it was.
    if (kind === "move" && (win.state !== "windowed" || win.snap)) {
      const back = win.pre || { x: win.x, y: win.y, w: win.w, h: win.h };
      setWins((list) => list.map((w) => (w.id !== id ? w : {
        ...w, state: "windowed", snap: null, w: back.w, h: back.h,
        x: Math.max(0, e.clientX - Math.round(back.w / 2)),
        y: Math.max(0, e.clientY - 18),
      })));
      return;
    }
    // A maximised window has no edges of its own to grab, so it never gets grips.
    if (win.state !== "windowed") return;
    // A snapped one does. Resizing it releases the snap and carries on from the
    // rectangle it is already occupying: putting a window against an edge should
    // not be the thing that makes it unresizable.
    e.preventDefault();
    e.stopPropagation();
    focus(id);

    // Windows flush against the edge being dragged move with it, so two tiled
    // halves share one divider instead of one growing over the other. Detected by
    // geometry rather than by snap name, so it keeps working after the first drag
    // has left them as plain adjacent windows.
    const TOL = 3;
    const partners = wins.filter((w) =>
      w.id !== id && w.ws === win.ws && w.state === "windowed" && !w.dying &&
      ((kind.includes("e") && Math.abs(w.x - (win.x + win.w)) <= TOL) ||
       (kind.includes("w") && Math.abs((w.x + w.w) - win.x) <= TOL) ||
       (kind.includes("s") && Math.abs(w.y - (win.y + win.h)) <= TOL) ||
       (kind.includes("n") && Math.abs((w.y + w.h) - win.y) <= TOL))
    ).map((w) => ({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }));

    // Both sides stop being "snapped" once their split is hand-set, or the next
    // viewport resize would recompute them back to an even half.
    const loose = new Set([id, ...partners.map((p) => p.id)]);
    setWins((list) => list.map((w) => (loose.has(w.id) && w.snap ? { ...w, snap: null } : w)));

    dragRef.current = {
      kind, id, px: e.clientX, py: e.clientY,
      x: win.x, y: win.y, w: win.w, h: win.h, partners,
    };

    const move = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.px, dy = ev.clientY - d.py;
      const a = area(window.innerWidth, window.innerHeight);

      if (d.kind === "move") {
        setPreview(snapZone(ev.clientX, ev.clientY, window.innerWidth, window.innerHeight));
        setWins((list) => list.map((w) => (w.id !== d.id ? w : {
          ...w,
          x: Math.max(0, Math.min(a.w - 120, d.x + dx)),
          y: Math.max(0, Math.min(a.h - 40, d.y + dy)),
        })));
        return;
      }

      // Each edge is solved as a position rather than as a size, because a shared
      // divider is one number that two windows read in opposite directions.
      let { x, y, w, h } = d;
      const moved = new Map();
      const lo = (vals, fallback) => (vals.length ? Math.max(...vals) : fallback);
      const hi = (vals, fallback) => (vals.length ? Math.min(...vals) : fallback);

      if (d.kind.includes("e")) {
        const right = d.partners.filter((p) => Math.abs(p.x - (d.x + d.w)) <= 3);
        const cap = hi(right.map((p) => p.x + p.w - MIN_W), a.w);
        const R = Math.max(d.x + MIN_W, Math.min(cap, d.x + d.w + dx));
        w = R - d.x;
        right.forEach((p) => moved.set(p.id, { x: R, w: p.x + p.w - R }));
      }
      if (d.kind.includes("w")) {
        const left = d.partners.filter((p) => Math.abs(p.x + p.w - d.x) <= 3);
        const floor = lo(left.map((p) => p.x + MIN_W), 0);
        const L = Math.max(floor, Math.min(d.x + d.w - MIN_W, d.x + dx));
        w = d.x + d.w - L; x = L;
        left.forEach((p) => moved.set(p.id, { w: L - p.x }));
      }
      if (d.kind.includes("s")) {
        const below = d.partners.filter((p) => Math.abs(p.y - (d.y + d.h)) <= 3);
        const cap = hi(below.map((p) => p.y + p.h - MIN_H), a.h);
        const B = Math.max(d.y + MIN_H, Math.min(cap, d.y + d.h + dy));
        h = B - d.y;
        below.forEach((p) => moved.set(p.id, { ...(moved.get(p.id) || {}), y: B, h: p.y + p.h - B }));
      }
      if (d.kind.includes("n")) {
        const above = d.partners.filter((p) => Math.abs(p.y + p.h - d.y) <= 3);
        const floor = lo(above.map((p) => p.y + MIN_H), 0);
        const Tp = Math.max(floor, Math.min(d.y + d.h - MIN_H, d.y + dy));
        h = d.y + d.h - Tp; y = Tp;
        above.forEach((p) => moved.set(p.id, { ...(moved.get(p.id) || {}), h: Tp - p.y }));
      }

      setWins((list) => list.map((wn) => {
        if (wn.id === d.id) return { ...wn, x, y, w, h, snap: null };
        const m = moved.get(wn.id);
        return m ? { ...wn, ...m, snap: null } : wn;
      }));
    };

    const up = (ev) => {
      const d = dragRef.current;
      dragRef.current = null;
      setPreview(null);
      if (d && d.kind === "move") {
        const zone = snapZone(ev.clientX, ev.clientY, window.innerWidth, window.innerHeight);
        if (zone) applySnap(d.id, zone);
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

  const controlsFor = (win) => ({
    canWindow,
    state: win.state,
    focused: win.id === focused,
    onClose: () => close(win.id),
    onMinimise: () => setState(win.id, "min"),
    onToggleMax: () => toggleMax(win.id),
    onDragStart: (e) => startDrag(e, "move", win.id),
    // Lets the terminal launch the rest of the desktop: `xdg-open` on a URL wants a
    // browser, on the CV wants the PDF window, on the playlist wants the player.
    onOpen: open,
  });

  const showDesktop = () => {
    const shown = here.filter((w) => w.state !== "min");
    if (shown.length) {
      peekRef.current = shown.map((w) => w.id);
      setWins((list) => list.map((w) => (peekRef.current.includes(w.id) ? { ...w, state: "min" } : w)));
    } else if (peekRef.current) {
      const back = peekRef.current;
      peekRef.current = null;
      setWins((list) => list.map((w) => (back.includes(w.id)
        ? { ...w, state: w.snap === "max" ? "max" : canWindow ? "windowed" : "max" } : w)));
    }
  };

  // ── keyboard ──────────────────────────────────────────────────────────────
  // Ctrl+Alt is the namespace: nothing in the terminal's readline uses it, and no
  // browser claims it. Alt+Tab would be the obvious choice and is unavailable,
  // because the operating system takes it before the page ever sees it.
  React.useEffect(() => {
    if (!canWindow) return;
    const onKey = (e) => {
      if (locked || !e.ctrlKey || !e.altKey) return;
      // e.code, not e.key: with a Korean layout the letter keys report jamo, so
      // Ctrl+Alt+M matched nothing at all. The physical key is what was pressed.
      const c = e.code;

      const app = APP_KEYS.find((a) => APPS[a].code === c);
      if (app) { e.preventDefault(); open(app); return; }

      // Ctrl+Alt+Tab never reaches the page: Windows takes it first. Backquote is
      // the key every desktop uses for cycling within an app, and it is in the same
      // place on a Korean keyboard.
      if (c === "Backquote") {
        e.preventDefault();
        const cycle = here.filter((w) => w.state !== "min").sort((a, b) => a.id - b.id);
        if (cycle.length < 2) return;
        const i = cycle.findIndex((w) => w.id === focused);
        focus(cycle[(i + (e.shiftKey ? -1 : 1) + cycle.length) % cycle.length].id);
        return;
      }
      if (c === "KeyD") { e.preventDefault(); showDesktop(); return; }
      if (c === "KeyL") { e.preventDefault(); setLocked(true); return; }
      if (c === "KeyQ") { e.preventDefault(); if (focused) close(focused); return; }
      const digit = /^Digit([1-9])$/.exec(c);
      if (digit && +digit[1] <= WORKSPACES) { e.preventDefault(); setWs(+digit[1] - 1); return; }
      if (c === "ArrowLeft" || c === "ArrowRight") {
        e.preventDefault();
        const d = c === "ArrowLeft" ? -1 : 1;
        if (e.shiftKey) { if (focused) applySnap(focused, d < 0 ? "l" : "r"); }
        else setWs((n) => (n + d + WORKSPACES) % WORKSPACES);
        return;
      }
      if (c === "ArrowUp") { e.preventDefault(); if (focused) applySnap(focused, "max"); return; }
      if (c === "ArrowDown") {
        e.preventDefault();
        if (!focused) return;
        const w = wins.find((x) => x.id === focused);
        if (w && (w.state === "max" || w.snap)) restore(focused);
        else setState(focused, "min");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wins, ws, focused, locked, canWindow]);

  // `reboot` means what it says: the machine comes up as a fresh one. Windows go,
  // the saved layout goes, and the boot sequence plays over an empty desktop. The
  // arrangement was the visitor's, so nothing else may throw it away.
  React.useEffect(() => {
    const go = () => {
      clearLayout();
      setWins([{ id: ++seq, app: "terminal", state: "max", ws: 0, z: 1, nonce: 0,
                 snap: "max", ...defaultRect("terminal", 0) }]);
      setWs(0);
      setLocked(false);
      setMenu(null);
      setNote(null);
      peekRef.current = null;
      openedAt.current = performance.now();
    };
    window.addEventListener("site-reboot", go);
    return () => window.removeEventListener("site-reboot", go);
  }, []);

  // A toast for an incoming message opens the chat window when clicked.
  React.useEffect(() => {
    const go = () => open("chat");
    window.addEventListener("open-chat", go);
    return () => window.removeEventListener("open-chat", go);
  }, [ws, canWindow]);

  // ── context menu ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!menu) return;
    const away = () => setMenu(null);
    const esc = (e) => { if (e.key === "Escape") setMenu(null); };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const terminalGone = !wins.some((w) => w.app === "terminal");
  const previewRect = preview && snapRect(preview, window.innerWidth, window.innerHeight);

  return (
    <div className={"desktop" + (cold ? " cold" : "")}
         onContextMenu={(e) => {
           // Only the desktop itself; a right-click inside a window is the window's.
           if (!canWindow || (e.target.closest && e.target.closest(".win"))) return;
           e.preventDefault();
           setMenu({ x: e.clientX, y: e.clientY });
         }}>
      <Wallpaper lang={lang} ws={ws} />
      {/* Outside the window list on purpose: the iframe must never be re-parented
          or unmounted, so it hangs off the desktop rather than off any window. */}
      <MpvHost />

      <div className="desk-icons">
        {icons.map((it) => (
          <DeskIcon key={it.file} glyph={it.glyph}
                    label={APPS[it.open] && it.open !== "viewer" ? appName(it.open) : it.name}
                    title={it.title || T.hintOpen}
                    onOpen={() => open(it.open, it.open === "viewer" ? it.path : undefined)} />
        ))}
      </div>

      {note && terminalGone && <div className="desk-note">{note}</div>}

      {/* Where the window would land, drawn while the drag is still going. */}
      {previewRect && (
        <div className="snap-preview" style={previewRect.max
          ? { left: 0, top: 0, width: "100%", height: `calc(100% - ${DOCK_H}px)` }
          : { left: previewRect.x + "px", top: previewRect.y + "px",
              width: previewRect.w + "px", height: previewRect.h + "px" }} />
      )}

      {wins.map((win) => {
        const framed = win.state === "windowed";
        // Off-screen, not unmounted: minimised, on another workspace, or behind the
        // lock screen all mean the same thing to the DOM.
        const hidden = win.state === "min" || win.ws !== ws;
        const style = hidden
          ? { left: "-99999px", top: 0, width: win.w + "px", height: win.h + "px" }
          : framed
          ? { left: win.x + "px", top: win.y + "px", width: win.w + "px", height: win.h + "px", zIndex: win.z }
          : { zIndex: win.z };
        const cls = "win"
          + (hidden ? " stowed" : framed ? " framed" : " maxed")
          + (win.id === focused && !hidden ? " on" : "")
          + (win.dying ? " closing" : "")
          + (reduceMotion ? "" : " animate");
        const wm = controlsFor(win);
        return (
          <div key={win.id} className={cls} style={style} tabIndex={-1}
               ref={(el) => { if (el) winRefs.current.set(win.id, el); else winRefs.current.delete(win.id); }}
               inert={hidden || undefined} aria-hidden={hidden ? "true" : undefined}
               onPointerDown={hidden ? undefined : () => focus(win.id)}>
            <WindowBoundary app={appName(win.app)} lang={lang} onClose={() => close(win.id)}>
            {win.app === "terminal" ? React.cloneElement(children, { wm })
              : win.app === "browser" ? <Browser key={win.nonce} lang={lang} wm={wm} initialUrl={win.arg} />
              : win.app === "music" ? <MusicPlayer lang={lang} wm={wm} />
              : win.app === "cv" ? <PdfViewer lang={lang} wm={wm} />
              : win.app === "files" ? <Files lang={lang} wm={wm} onOpen={open} />
              : win.app === "viewer" ? <Viewer key={win.nonce} lang={lang} wm={wm} path={win.arg} />
              : win.app === "settings"
                ? <Settings lang={lang} wm={wm} theme={theme} onTheme={onTheme} onLang={onLang}
                            onReset={() => { clearLayout(); location.reload(); }} apps={APPS} />
              : <ChatWindow lang={lang} wm={wm} focused={win.id === focused && !hidden} />}
            </WindowBoundary>
            {framed && EDGES.map((dir) => (
              <div key={dir} className={"win-edge win-" + dir} aria-hidden="true"
                   onPointerDown={(e) => startDrag(e, dir, win.id)} />
            ))}
          </div>
        );
      })}

      {menu && (
        <DeskMenu at={menu} lang={lang} theme={theme} onTheme={onTheme} T={T}
                  onPick={(fn) => { setMenu(null); fn(); }}
                  open={open} showDesktop={showDesktop} lock={() => setLocked(true)} />
      )}

      <Dock order={DOCK_ORDER} appName={appName} lang={lang}
            running={wins} ws={ws} setWs={setWs} focused={focused}
            onPick={(w) => {
              if (w.state === "min") { setState(w.id, canWindow ? "windowed" : "max"); focus(w.id); }
              else if (w.id === focused) setState(w.id, "min");
              else focus(w.id);
            }}
            onLaunch={open} onLock={() => setLocked(true)} T={T}
            onLang={onLang} onEasy={onEasy} />

      {locked && <LockScreen lang={lang} onUnlock={() => setLocked(false)} />}
      {boot.restored && <Restored text={T.restored} />}
    </div>
  );
}

// One window throwing used to take the whole page with it: Preact unmounts the tree
// and the site goes blank, which is exactly what happened when a component read a
// field that had been removed from data.js. A window is the right unit to contain
// that, so each one is wrapped and a crash costs you that window and nothing else.
class WindowBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) {
    // Visible in the console for whoever is debugging, and in the window for
    // whoever is not.
    try { console.error("window crashed:", this.props.app, err); } catch {}
  }
  render() {
    if (!this.state.err) return this.props.children;
    const en = this.props.lang === "en";
    return (
      <div className="win-crash">
        <div className="win-crash-app">{this.props.app}</div>
        <p>{en ? "This window stopped. The rest of the desktop is unaffected."
              : "이 창이 멈췄습니다. 나머지는 그대로입니다."}</p>
        <code>{String(this.state.err && this.state.err.message || this.state.err)}</code>
        <div className="win-crash-act">
          <button type="button" onClick={() => this.setState({ err: null })}>
            {en ? "try again" : "다시 시도"}
          </button>
          <button type="button" onClick={this.props.onClose}>
            {en ? "close" : "닫기"}
          </button>
        </div>
      </div>
    );
  }
}

// A one-off line saying this desktop is not the one the visitor is being given, it
// is the one they left. Fades itself out.
function Restored({ text }) {
  const [gone, setGone] = React.useState(false);
  React.useEffect(() => {
    const id = setTimeout(() => setGone(true), 2800);
    return () => clearTimeout(id);
  }, []);
  if (gone) return null;
  return <div className="desk-restored">{text}</div>;
}

function DeskIcon({ glyph, label, title, onOpen }) {
  return (
    <button type="button" className="desk-icon" title={title}
            onDblClick={onOpen}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
      <span className="desk-icon-glyph" aria-hidden="true">{glyph}</span>
      <span className="desk-icon-label">{label}</span>
    </button>
  );
}

function DeskMenu({ at, lang, theme, onTheme, T, onPick, open, showDesktop, lock }) {
  // Keep it on screen when the click was near an edge.
  const style = {
    left: Math.min(at.x, window.innerWidth - 220) + "px",
    top: Math.min(at.y, window.innerHeight - 330) + "px",
  };
  const themes = window.THEMES || {};
  const item = (label, key, fn, extra) => (
    <button type="button" role="menuitem" className={extra} onClick={() => onPick(fn)}>
      {label}{key && <span className="desk-menu-key">{key}</span>}
    </button>
  );
  return (
    <div className="desk-menu" style={style} role="menu"
         onPointerDown={(e) => e.stopPropagation()}>
      {item(T.newT, "Ctrl+Alt+T", () => open("terminal"))}
      {item(T.files, "Ctrl+Alt+F", () => open("files"))}
      <div className="desk-menu-sep" />
      <div className="desk-menu-head">{T.themeH}</div>
      {Object.entries(themes).map(([k, v]) => (
        <button key={k} type="button" role="menuitemradio" aria-checked={theme === k}
                className={theme === k ? "on" : ""}
                onClick={() => onPick(() => onTheme && onTheme(k))}>
          {lang === "en" ? (v.label_en || k) : (v.label_ko || k)}
        </button>
      ))}
      <div className="desk-menu-sep" />
      {item(T.desk, "Ctrl+Alt+D", showDesktop)}
      {item(T.lock, "Ctrl+Alt+L", lock)}
      {item(T.settings, "Ctrl+Alt+,", () => open("settings"))}
    </div>
  );
}

// Always there, unlike the old dock that only appeared when something was minimised.
// Launchers on the left, workspaces in the middle, clock on the right, which is the
// arrangement every panel has settled on.
function Dock({ order, appName, lang, running, ws, setWs, focused, onPick, onLaunch,
                onLock, onLang, onEasy, T }) {
  const [clock, setClock] = React.useState(() => stamp().time);
  React.useEffect(() => {
    const id = setInterval(() => setClock(stamp().time), 15000);
    return () => clearInterval(id);
  }, []);
  const hereRunning = running.filter((w) => w.ws === ws && !w.dying);
  // Anything running that has no launcher of its own still needs a way back from
  // being minimised, so the dock lists those windows individually.
  const extras = hereRunning.filter((w) => !order.includes(w.app));

  return (
    <div className="dock" role="toolbar" aria-label={lang === "en" ? "dock" : "독"}>
      <div className="dock-apps">
        {order.map((app) => {
          const mine = hereRunning.filter((w) => w.app === app);
          const active = mine.find((w) => w.id === focused && w.state !== "min");
          const cls = "dock-item"
            + (mine.length ? " running" : "")
            + (mine.length > 1 ? " many" : "")
            + (active ? " on" : "");
          const label = mine.length > 1
            ? `${appName(app)} (${mine.length})` : appName(app);
          return (
            <button key={app} type="button" className={cls}
                    title={`${label}  ·  Ctrl+Alt+${APPS[app].key}  ·  ${T.newWin}`}
                    aria-label={label}
                    onClick={(e) => {
                      // Shift, or a middle click, is "another one" the way it is in
                      // every dock. A plain click cycles what is already open.
                      if (e.shiftKey || !mine.length) return onLaunch(app);
                      if (active && mine.length === 1) return onPick(active);
                      const from = mine.findIndex((w) => w.id === focused);
                      onPick(mine[(from + 1) % mine.length]);
                    }}
                    onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onLaunch(app); } }}>
              <span aria-hidden="true">{APPS[app].glyph}</span>
            </button>
          );
        })}
        {extras.length > 0 && <span className="dock-sep" aria-hidden="true" />}
        {extras.map((w) => (
          <button key={w.id} type="button"
                  className={"dock-item running dock-win" + (w.id === focused && w.state !== "min" ? " on" : "")}
                  title={winLabel(w, lang)} aria-label={winLabel(w, lang)}
                  onClick={() => onPick(w)}>
            <span aria-hidden="true">{APPS[w.app].glyph}</span>
          </button>
        ))}
      </div>

      <div className="dock-ws" role="group" aria-label={lang === "en" ? "workspaces" : "작업공간"}>
        {Array.from({ length: WORKSPACES }, (_, i) => {
          const used = running.some((w) => w.ws === i && !w.dying);
          return (
            <button key={i} type="button"
                    className={"dock-wsx" + (i === ws ? " on" : "") + (used ? " used" : "")}
                    title={T.wsLabel(i + 1)} aria-label={T.wsLabel(i + 1)}
                    aria-current={i === ws ? "true" : undefined}
                    onClick={() => setWs(i)}>{i + 1}</button>
          );
        })}
      </div>

      <div className="dock-right">
        <Toasts lang={lang} />
        <DockWeather lang={lang} />
        {onLang && (
          <div className="lang-seg dock-lang" role="group" aria-label="language">
            <button className={"lang-btn" + (lang === "ko" ? " on" : "")}
                    onClick={() => onLang("ko")}>한</button>
            <button className={"lang-btn" + (lang === "en" ? " on" : "")}
                    onClick={() => onLang("en")}>EN</button>
          </div>
        )}
        {onEasy && (
          <button type="button" className="dock-easy" onClick={onEasy}
                  title={T.easyHint}>{T.easy}</button>
        )}
        <button type="button" className="dock-plain" title={T.lock} aria-label={T.lock}
                onClick={onLock}>⏻</button>
        <span className="dock-clock">{clock}</span>
      </div>
    </div>
  );
}

// The same wttr.in reading the `weather` command shows, cut down to what fits in a
// panel. Refreshed on the half hour rather than on a timer: the observation behind
// it only changes about that often.
function DockWeather({ lang }) {
  const [w, setW] = React.useState(null);
  React.useEffect(() => {
    let dead = false;
    const loc = encodeURIComponent(window.SITE_DATA.profile.weatherLocation);
    const load = () => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      fetch(`https://wttr.in/${loc}?format=j1`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => {
          clearTimeout(timer);
          const cc = d.current_condition && d.current_condition[0];
          if (!dead && cc) setW({ c: cc.temp_C, desc: (cc.weatherDesc?.[0]?.value) || "" });
        })
        .catch(() => { clearTimeout(timer); });
    };
    load();
    const id = setInterval(load, 1800000);
    return () => { dead = true; clearInterval(id); };
  }, []);
  if (!w) return null;
  return (
    <span className="dock-weather" title={w.desc}>
      <span aria-hidden="true">{glyphFor(w.desc)}</span> {w.c}°
    </span>
  );
}

function glyphFor(desc) {
  const d = String(desc).toLowerCase();
  if (d.includes("thunder") || d.includes("storm")) return "!";
  if (d.includes("snow") || d.includes("sleet")) return "*";
  if (d.includes("rain") || d.includes("drizzle") || d.includes("shower")) return "/";
  if (d.includes("fog") || d.includes("mist") || d.includes("haze")) return "=";
  if (d.includes("cloud") || d.includes("overcast")) return "~";
  return "o";
}

// What to call a window that has no launcher: the app name, plus what it is
// showing when that is the thing telling two of them apart.
function winLabel(w, lang) {
  const name = lang === "en" ? APPS[w.app].en : APPS[w.app].ko;
  if (!w.arg) return name;
  const leaf = String(w.arg).split("/").filter(Boolean).pop();
  return leaf ? `${name} - ${leaf}` : name;
}

// Toasts. Anything on the page can raise one through window.NOTIFY; the chat window
// uses it for messages that arrive while it is not the window being looked at.
const NOTES = { list: [], subs: new Set(), seq: 0 };
window.NOTIFY = {
  push(n) {
    const item = { id: ++NOTES.seq, ...n };
    NOTES.list = [item, ...NOTES.list].slice(0, 4);
    NOTES.subs.forEach((f) => f());
    setTimeout(() => window.NOTIFY.dismiss(item.id), 7000);
    return item.id;
  },
  dismiss(id) {
    NOTES.list = NOTES.list.filter((n) => n.id !== id);
    NOTES.subs.forEach((f) => f());
  },
  sub(f) { NOTES.subs.add(f); return () => { NOTES.subs.delete(f); }; },
  peek() { return NOTES.list; },
};

function Toasts({ lang }) {
  const [, bump] = React.useState(0);
  React.useEffect(() => window.NOTIFY.sub(() => bump((n) => n + 1)), []);
  const list = window.NOTIFY.peek();
  if (!list.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((n) => (
        <button key={n.id} type="button" className="toast"
                onClick={() => { window.NOTIFY.dismiss(n.id); if (n.onOpen) n.onOpen(); }}>
          <span className="toast-app">{n.app}</span>
          <span className="toast-body">{n.body}</span>
        </button>
      ))}
    </div>
  );
}

// Not a login screen. A password shipped in a static bundle is theatre, so this is a
// screen lock in the screensaver sense: it covers the desktop and any key lifts it.
function LockScreen({ lang, onUnlock }) {
  const [now, setNow] = React.useState(() => stamp());
  React.useEffect(() => {
    const id = setInterval(() => setNow(stamp()), 10000);
    // A frame's delay, or the keystroke that locked the screen unlocks it again.
    const arm = setTimeout(() => {
      window.addEventListener("keydown", onUnlock);
      window.addEventListener("pointerdown", onUnlock);
    }, 250);
    return () => {
      clearInterval(id); clearTimeout(arm);
      window.removeEventListener("keydown", onUnlock);
      window.removeEventListener("pointerdown", onUnlock);
    };
  }, [onUnlock]);
  return (
    <div className="lock" role="dialog" aria-label={lang === "en" ? "locked" : "잠김"}>
      <div className="lock-time">{now.time}</div>
      <div className="lock-date">{now.date}</div>
      <div className="lock-hint">{lang === "en" ? "press any key" : "아무 키나 누르세요"}</div>
    </div>
  );
}

// The wallpaper is the theme. Colours come from the same custom properties the
// terminal uses, so switching themes repaints the desktop too.
function Wallpaper({ lang, ws }) {
  const [clock, setClock] = React.useState(() => stamp());
  const [next, setNext] = React.useState(null);

  React.useEffect(() => {
    const id = setInterval(() => setClock(stamp()), 20000);
    return () => clearInterval(id);
  }, []);

  // The desktop shows the same calendar the `now` command reads, so closing the
  // terminal does not mean losing the one piece of live data on the site.
  React.useEffect(() => {
    let dead = false;
    window.CALENDAR.load().then(data => {
      if (dead) return;
      const upcoming = (data.events || [])
        .map(e => ({ ...e, _t: new Date(e.start) }))
        .filter(e => e._t >= new Date())
        .sort((a, b) => a._t - b._t)[0];
      if (upcoming) setNext(upcoming);
    });
    return () => { dead = true; };
  }, []);

  return (
    <div className="wall" aria-hidden="true" data-ws={ws}>
      <div className="wall-grid" />
      <div className="wall-mark">◐</div>
      <div className="wall-clock">
        <div className="wall-time">{clock.time}</div>
        <div className="wall-date">{clock.date}</div>
        {next && (
          <div className="wall-next">
            {window.CALENDAR.fmtDay(next._t, lang)} {window.CALENDAR.fmtTime(next._t)} · {next.title}
          </div>
        )}
      </div>
      <div className="wall-brand">JIKOS 1.0</div>
    </div>
  );
}

function stamp() {
  const d = new Date();
  const opts = { timeZone: "Asia/Seoul" };
  return {
    time: d.toLocaleTimeString("en-GB", { ...opts, hour: "2-digit", minute: "2-digit", hour12: false }),
    date: d.toLocaleDateString("en-GB", { ...opts, weekday: "short", day: "2-digit", month: "short" }),
  };
}
