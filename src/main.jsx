// Entry point. Bundles all site modules + renders <App/>.
// All legacy modules keep their window-global side-effect pattern — they're imported
// here so esbuild includes them in the bundle in the right order.

import * as React from "preact/compat";
import { render } from "preact/compat";

import "./data.js";
import "./themes.js";
import "./fs.js";
import "./calendar.js";
import "./eggs.js";
import "./crisp.js";
import "./terminal-commands.js";

import { TerminalView } from "./terminal-view.jsx";
import { EasyMode } from "./easy-mode.jsx";

const TWEAKS_DEFAULT = {
  theme: "dark",
  defaultMode: "terminal",
  cursorTrail: true,
  lang: "ko",
};

const BOOT_LINES = [
  "[    0.000] Booting JIKOS 25.04 (jik-kernel 6.10-coffee)",
  "[    0.003] BIOS: 99jik Research Labs v4.2",
  "[    0.012] Memory: 16384 MB -- 12288 MB reserved for coffee cache",
  "[    0.034] CPU0: CaffeinatedCore(TM) i99-2026K @ 4.2 GHz",
  "[    0.058] Detecting hardware...",
  "[    0.089]   hid.usb: keyboard (ANSI layout) -- OK",
  "[    0.105]   hid.usb: coffee mug -- mounted at /mnt/fuel",
  "[    0.142] Loading kernel modules:",
  "[    0.158]   testing.ko ............. OK",
  "[    0.174]   oracle.ko .............. OK",
  "[    0.201]   llm.ko ................. OK",
  "[    0.228]   sil.ko ................. OK",
  "[    0.261]   easter-eggs.ko ......... OK",
  "[    0.288] Starting services:",
  "[    0.319]   sshd.service ........... [  OK  ]",
  "[    0.346]   calendar.service ....... [  OK  ]",
  "[    0.381]   crisp-chat.service ..... [  OK  ]",
  "[    0.415]   sanity.service ......... [ FAIL ]",
  "[    0.449]   coffee.service ......... [  OK  ]",
  "[    0.488] Network: eth0 up -- 99jik.com",
  "[    0.531] Locale: ko_KR.UTF-8 / KST (+09:00)",
  "[    0.612] ",
  "[    0.658]   +----------------------------------+",
  "[    0.661]   |   Welcome to 99jik.com           |",
  "[    0.664]   |   99jik tty1 -- bash 5.2         |",
  "[    0.667]   +----------------------------------+",
  "[    0.912] ",
  "[    0.988] anonymous login: ",
];

function BootSequence({ onDone }) {
  const [count, setCount] = React.useState(1);
  const [fading, setFading] = React.useState(false);
  const doneRef = React.useRef(false);

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    setTimeout(onDone, 500);
  }, [onDone]);

  React.useEffect(() => {
    if (count > BOOT_LINES.length) {
      const t = setTimeout(finish, 700);
      return () => clearTimeout(t);
    }
    // Emulate slow early lines, faster middle, pause at tail for presence.
    const line = BOOT_LINES[count - 1] || "";
    let delay = 20 + Math.random() * 70;
    if (line.includes("Loading") || line.includes("Starting")) delay += 120;
    if (line.trim() === "") delay = 300;
    const t = setTimeout(() => setCount(c => c + 1), delay);
    return () => clearTimeout(t);
  }, [count, finish]);

  React.useEffect(() => {
    window.addEventListener("keydown", finish);
    window.addEventListener("mousedown", finish);
    window.addEventListener("touchstart", finish);
    return () => {
      window.removeEventListener("keydown", finish);
      window.removeEventListener("mousedown", finish);
      window.removeEventListener("touchstart", finish);
    };
  }, [finish]);

  return (
    <div className={"boot-overlay" + (fading ? " fading" : "")}>
      <pre className="boot-log">
        {BOOT_LINES.slice(0, count).join("\n")}
        <span className="boot-cursor" />
      </pre>
      <div className="boot-skip">press any key to skip</div>
    </div>
  );
}

function CursorTrail() {
  const dotRef = React.useRef(null);
  const ringRef = React.useRef(null);
  React.useEffect(() => {
    let x = 0, y = 0, rx = 0, ry = 0;
    const onMove = (e) => {
      x = e.clientX; y = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.left = x + "px";
        dotRef.current.style.top = y + "px";
      }
    };
    let raf;
    const tick = () => {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.left = rx + "px";
        ringRef.current.style.top = ry + "px";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);
  return (
    <>
      <div ref={ringRef} className="cursor-ring" />
      <div ref={dotRef} className="cursor-dot" />
    </>
  );
}

function Tweaks({ state, set, onClose }) {
  return (
    <div className="tweaks">
      <h3>Tweaks</h3>
      <div className="tweaks-row">
        <span>Theme</span>
        <select value={state.theme} onChange={e => set({ theme: e.target.value })}>
          {Object.entries(window.THEMES).map(([k, v]) => <option key={k} value={k}>{v.label_ko}</option>)}
        </select>
      </div>
      <div className="tweaks-row">
        <span>Default mode</span>
        <select value={state.defaultMode} onChange={e => set({ defaultMode: e.target.value })}>
          <option value="terminal">Terminal</option>
          <option value="easy">Easy</option>
        </select>
      </div>
      <div className="tweaks-row">
        <span>Cursor trail</span>
        <button onClick={() => set({ cursorTrail: !state.cursorTrail })}>{state.cursorTrail ? "on" : "off"}</button>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "var(--t-muted)" }}>
        터미널에서 <code>theme phosphor</code>, <code>easy</code> 로도 가능
      </div>
      <div style={{ textAlign: "right", marginTop: 6 }}>
        <button onClick={onClose}>close</button>
      </div>
    </div>
  );
}

const BOOT_KEY = "99jik:booted";
const BOOT_VERSION = "1";

function App() {
  const [tweaks, setTweaks] = React.useState(TWEAKS_DEFAULT);
  const [mode, setMode] = React.useState(() => tweaks.defaultMode);
  const [showTweaks, setShowTweaks] = React.useState(false);
  const [bootDone, setBootDone] = React.useState(() => {
    try { return localStorage.getItem(BOOT_KEY) === BOOT_VERSION; }
    catch { return true; }
  });
  const onBootDone = () => {
    setBootDone(true);
    try { localStorage.setItem(BOOT_KEY, BOOT_VERSION); } catch {}
  };

  const setTw = (patch) => {
    const next = { ...tweaks, ...patch };
    setTweaks(next);
    if (patch.theme) window.applyTheme(patch.theme);
    try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*"); } catch {}
  };

  React.useEffect(() => { window.applyTheme(tweaks.theme); }, []);

  React.useEffect(() => {
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.type === "__activate_edit_mode") setShowTweaks(true);
      if (d.type === "__deactivate_edit_mode") setShowTweaks(false);
    };
    window.addEventListener("message", onMsg);
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch {}
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // `reboot` easter egg → replay the boot sequence on demand.
  React.useEffect(() => {
    const onReboot = () => setBootDone(false);
    window.addEventListener("site-reboot", onReboot);
    return () => window.removeEventListener("site-reboot", onReboot);
  }, []);

  return (
    <>
      {!bootDone && <BootSequence onDone={onBootDone} />}
      {tweaks.cursorTrail && <CursorTrail />}
      {mode === "terminal"
        ? <TerminalView onModeChange={setMode} onTheme={(t) => setTw({ theme: t })} lang={tweaks.lang} onLang={(l) => setTw({ lang: l })} />
        : <EasyMode onBack={() => setMode("terminal")} onTheme={(t) => setTw({ theme: t })} currentTheme={tweaks.theme} lang={tweaks.lang} onLang={(l) => setTw({ lang: l })} />
      }
      {showTweaks && <Tweaks state={tweaks} set={setTw} onClose={() => setShowTweaks(false)} />}
    </>
  );
}

render(<App />, document.getElementById("root"));
