// Entry point. Bundles all site modules + renders <App/>.
// All legacy modules keep their window-global side-effect pattern — they're imported
// here so esbuild includes them in the bundle in the right order.

import * as React from "preact/compat";
import { render } from "preact/compat";

import "./data.js";
import "./themes.js";
import "./prefs.js";
import "./fs.js";
import "./coreutils.js";
import "./calendar.js";
import "./qr.js";
import "./tools.js";
import "./extras.js";
import "./crisp.js";
import "./analytics.js";
import "./terminal-commands.js";

import { TerminalView } from "./terminal-view.jsx";
import { EasyMode } from "./easy-mode.jsx";
import { Desktop } from "./desktop.jsx";

const BOOT_LINES = [
  "[    0.000000] Linux version 6.10.0-jik (jeongin@99jik) #1 SMP",
  "[    0.000000] Command line: ro quiet console=tty1",
  "[    0.014221] Memory: 16384K available",
  "[    0.031885] Mount-cache hash table entries: 512",
  "[    0.052110] devtmpfs: initialized",
  "[    0.078943] clocksource: jiffies, resolution 1ms",
  "[    0.104518] NET: Registered protocol family 1",
  "[    0.131002] jikfs: mounting root filesystem read-only",
  "[    0.158774] jikfs: clean, 1024K blocks",
  "[    0.186290] Loading modules:",
  "[    0.201447]   coreutils .............. ok",
  "[    0.228016]   calendar ............... ok",
  "[    0.255330]   livechat ............... ok",
  "[    0.281905]   themes ................. ok",
  "[    0.319662] systemd[1]: Starting user sessions...",
  "[    0.346128] systemd[1]: Reached target Multi-User System.",
  "[    0.381004] eth0: link becomes ready",
  "[    0.415773] Locale set to ko_KR.UTF-8 (KST, UTC+09:00)",
  "[    0.488210] ",
  "[    0.531446] JIKOS 1.0  99jik  tty1",
  "[    0.612009] ",
  "[    0.988421] 99jik login: anonymous (autologin)",
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
      <div style={{ marginTop: 8, fontSize: 10, color: "var(--t-muted)" }}>
        터미널에서 <code>theme phosphor</code>, <code>easy</code> 로도 가능
      </div>
      <div style={{ textAlign: "right", marginTop: 6 }}>
        <button onClick={onClose}>close</button>
      </div>
    </div>
  );
}

// `?view=easy` is the link to hand to someone who should not meet a terminal:
// a recruiter, a professor, an application form. It beats the stored preference,
// so the link means the same thing for everyone who opens it.
function viewFromUrl() {
  try {
    const v = new URLSearchParams(location.search).get("view");
    return (v === "easy" || v === "terminal") ? v : null;
  } catch { return null; }
}

const BOOT_KEY = "99jik:booted";
const BOOT_VERSION = "1";

function App() {
  const [tweaks, setTweaks] = React.useState(window.PREFS.load);
  const [mode, setMode] = React.useState(() => viewFromUrl() || window.PREFS.load().defaultMode);
  const [showTweaks, setShowTweaks] = React.useState(false);
  const [bootDone, setBootDone] = React.useState(() => {
    // Reduced motion skips the boot log entirely: it is 28 timed lines of pure motion.
    if (window.prefersReducedMotion()) return true;
    return window.PREFS.store.get(BOOT_KEY) === BOOT_VERSION;
  });
  const onBootDone = () => {
    setBootDone(true);
    window.PREFS.store.set(BOOT_KEY, BOOT_VERSION);
  };

  const setTw = (patch) => {
    const next = { ...tweaks, ...patch };
    setTweaks(next);
    window.PREFS.save(next);
    if (patch.theme) window.applyTheme(patch.theme);
    try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*"); } catch {}
  };

  React.useEffect(() => { window.applyTheme(tweaks.theme); }, []);

  // Keep <html lang> in sync: screen readers pick voice from it, and crisp.js reads it
  // to choose the chat widget locale.
  React.useEffect(() => { document.documentElement.lang = tweaks.lang; }, [tweaks.lang]);

  // Make the current view copy-pasteable. The default view leaves the URL clean, so
  // 99jik.com stays 99jik.com and only the non-default one carries a parameter.
  React.useEffect(() => {
    try {
      const url = new URL(location.href);
      if (mode === tweaks.defaultMode) url.searchParams.delete("view");
      else url.searchParams.set("view", mode);
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch {}
  }, [mode, tweaks.defaultMode]);

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
      {mode === "terminal"
        ? <Desktop lang={tweaks.lang}>
            <TerminalView onModeChange={setMode} onTheme={(t) => setTw({ theme: t })} lang={tweaks.lang} onLang={(l) => setTw({ lang: l })} />
          </Desktop>
        : <EasyMode onBack={() => setMode("terminal")} onTheme={(t) => setTw({ theme: t })} currentTheme={tweaks.theme} lang={tweaks.lang} onLang={(l) => setTw({ lang: l })} />
      }
      {showTweaks && <Tweaks state={tweaks} set={setTw} onClose={() => setShowTweaks(false)} />}
    </>
  );
}

render(<App />, document.getElementById("root"));
