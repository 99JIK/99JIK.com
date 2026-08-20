// A window manager around the terminal. JIKOS is its own distribution, so the
// wallpaper is generated from the active theme rather than shipped as an image:
// four themes get four wallpapers for no extra bytes.
//
// The terminal starts maximised, which is exactly what the site looked like before
// this existed. The window controls are something you find, not something you have
// to deal with on arrival.

import * as React from "preact/compat";

const MIN_W = 420;
const MIN_H = 260;

// Windowing needs a pointer and room. On a phone the terminal simply is the screen.
function windowingAvailable() {
  try {
    return window.matchMedia("(min-width: 860px) and (pointer: fine)").matches;
  } catch { return false; }
}

export function Desktop({ children, lang, onCloseSession }) {
  const [wm, setWm] = React.useState(() => ({
    state: "max",                       // max | windowed | min | closed
    x: 90, y: 60, w: 980, h: 620,
  }));
  const [canWindow, setCanWindow] = React.useState(windowingAvailable);
  const [note, setNote] = React.useState(null);
  const openedAt = React.useRef(performance.now());
  const dragRef = React.useRef(null);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 860px) and (pointer: fine)");
    const h = () => setCanWindow(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", h) : mq.addListener(h);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", h) : mq.removeListener(h); };
  }, []);

  // Losing the pointer (rotating a tablet, resizing down) must not strand the
  // terminal off-screen or minimised.
  React.useEffect(() => { if (!canWindow) setWm(s => ({ ...s, state: "max" })); }, [canWindow]);

  const T = lang === "en" ? {
    terminal: "Terminal", cv: "CV", til: "TIL",
    closed: (d) => `Session ended after ${d}. Double-click Terminal to start another.`,
    restore: "Terminal", hintOpen: "double-click to open",
  } : {
    terminal: "터미널", cv: "이력서", til: "TIL",
    closed: (d) => `${d} 만에 세션이 끝났습니다. 터미널을 더블클릭하면 다시 시작합니다.`,
    restore: "터미널", hintOpen: "더블클릭해서 열기",
  };

  const sessionLength = () => {
    const s = Math.max(1, Math.round((performance.now() - openedAt.current) / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const open = () => {
    openedAt.current = performance.now();
    setNote(null);
    setWm(s => ({ ...s, state: canWindow ? "windowed" : "max" }));
  };
  const close = () => {
    setNote(T.closed(sessionLength()));
    setWm(s => ({ ...s, state: "closed" }));
    onCloseSession && onCloseSession();
  };

  // ── drag and resize ───────────────────────────────────────────────────────
  const startDrag = (e, kind) => {
    if (wm.state !== "windowed") return;
    e.preventDefault();
    dragRef.current = {
      kind, px: e.clientX, py: e.clientY,
      x: wm.x, y: wm.y, w: wm.w, h: wm.h,
    };
    const move = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.px, dy = ev.clientY - d.py;
      setWm(s => d.kind === "move"
        ? { ...s, x: Math.max(0, Math.min(window.innerWidth - 120, d.x + dx)),
                  y: Math.max(0, Math.min(window.innerHeight - 40, d.y + dy)) }
        : { ...s, w: Math.max(MIN_W, Math.min(window.innerWidth - d.x, d.w + dx)),
                  h: Math.max(MIN_H, Math.min(window.innerHeight - d.y, d.h + dy)) });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const controls = {
    canWindow,
    state: wm.state,
    onClose: close,
    onMinimise: () => setWm(s => ({ ...s, state: "min" })),
    onToggleMax: () => setWm(s => ({ ...s, state: s.state === "max" ? "windowed" : "max" })),
    onDragStart: (e) => startDrag(e, "move"),
  };

  const framed = wm.state === "windowed";
  const style = framed
    ? { left: wm.x + "px", top: wm.y + "px", width: wm.w + "px", height: wm.h + "px" }
    : null;

  return (
    <div className="desktop">
      <Wallpaper lang={lang} />

      <div className="desk-icons">
        <DeskIcon glyph="▶_" label={T.terminal} title={T.hintOpen} onOpen={open} />
        <DeskIcon glyph="↗" label={T.til} onOpen={() => window.open(window.SITE_DATA.site.tilUrl, "_blank", "noopener")} />
        <DeskIcon glyph="PDF" label={T.cv} onOpen={() => window.open(
          // Hand an English reader the English CV.
          lang === "en" ? window.SITE_DATA.site.cvEn : window.SITE_DATA.site.cvKo,
          "_blank", "noopener")} />
      </div>

      {note && wm.state === "closed" && <div className="desk-note">{note}</div>}

      {(wm.state === "max" || wm.state === "windowed") && (
        <div className={"win" + (framed ? " framed" : " maxed")} style={style}>
          {React.cloneElement(children, { wm: controls })}
          {framed && (
            <div className="win-resize" onPointerDown={(e) => startDrag(e, "resize")}
                 role="separator" aria-label="resize" />
          )}
        </div>
      )}

      {wm.state === "min" && (
        <div className="dock">
          <button type="button" className="dock-item" onClick={() => setWm(s => ({ ...s, state: "windowed" }))}>
            <span aria-hidden="true">▶_</span> {T.restore}
          </button>
        </div>
      )}
    </div>
  );
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

// The wallpaper is the theme. Colours come from the same custom properties the
// terminal uses, so switching themes repaints the desktop too.
function Wallpaper({ lang }) {
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
    <div className="wall" aria-hidden="true">
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
