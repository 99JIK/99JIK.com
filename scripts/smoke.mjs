#!/usr/bin/env node
// Smoke test for the command layer. No browser: stubs just enough DOM for the
// window-global modules to load, then runs every command in both languages and
// checks the invariants that have regressed before. Preact views are out of scope.
//
// Run: `npm run check`

import { readFileSync, readdirSync } from "node:fs";
import { fallbackHtml } from "./build.mjs";
import { decode as qrDecode } from "./qr-decode.mjs";

// ── DOM shim ────────────────────────────────────────────────────────────────
const mem = new Map();
const stubEl = () => ({
  style: { setProperty() {}, cssText: "" },
  appendChild() {}, removeChild() {}, setAttribute() {},
  getBoundingClientRect: () => ({ width: 0 }),
  set textContent(_v) {}, get textContent() { return ""; },
});
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
globalThis.document = {
  documentElement: { style: { setProperty() {} }, setAttribute() {}, lang: "ko" },
  querySelector: () => null,
  createElement: stubEl,
  head: { appendChild() {} },
  body: stubEl(),
};
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
globalThis.window = globalThis;
Object.defineProperty(globalThis, "navigator", { value: { doNotTrack: "1" }, configurable: true });
globalThis.location = { hostname: "localhost", href: "http://localhost/", origin: "http://localhost" };
globalThis.matchMedia = () => ({ matches: false });
globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => {};
globalThis.performance = { now: () => 125000 };

// Load order mirrors the imports at the top of src/main.jsx.
for (const f of ["data.js", "themes.js", "prefs.js", "wm.js", "fs.js", "coreutils.js",
                 "calendar.js", "qr.js", "tools.js", "extras.js", "terminal-commands.js"]) {
  new Function(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"))();
}

// ── harness ─────────────────────────────────────────────────────────────────
let failed = 0;
const verbose = process.argv.includes("--verbose");
const run = (cmd, lang = "ko") => window.TERMINAL.run(cmd, lang);
const flat = (cmd, lang = "ko") => JSON.stringify(run(cmd, lang));
const lines = (cmd, lang = "ko") =>
  (run(cmd, lang) || []).filter(b => b.kind === "text").map(b => b.text);

function check(label, fn) {
  try {
    const out = fn();
    if (out === null || out === undefined) throw new Error(`returned ${out}`);
    if (verbose) console.log(`  ok   ${label}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${label}: ${e.message}`);
  }
}

// ── every command, both languages, must return blocks rather than throw ─────
const SITE = [
  "help", "?", "about", "research", "projects", "publications",
  "experience", "skills", "contact", "cv", "til", "chat", "clear",
  "theme", "theme phosphor", "theme nope", "lang ko", "lang en", "lang zz",
  "easy", "now", "now --week", "now --month", "weather", "weather seoul",
  "cat til", "cat nope", "cat", "book", "definitely-not-a-command",
];
const SHELL = [
  "ls", "ls -a", "ls -al", "ls -alrt", "ls nope", "pwd", "cd projects", "cd ..",
  "cd ~", "cd nope", "tree", "tree -a", "find", "find /", "find -name *.md",
  "find / -name *.md", "find / -a -name *.md", "grep testing", "grep -i TESTING /",
  "grep -n oracle /", "grep -a secret /", "grep -v x /etc/hostname", "grep",
  "history", "history -c", "whoami", "logname",
];
const COREUTILS = [
  "head ~/about", "head -3 ~/about", "head", "head nope",
  "tail ~/about", "tail -2 ~/about", "wc ~/about", "wc -l ~/about", "wc",
  "nl ~/about", "sort ~/about", "sort -ru ~/about", "uniq ~/about", "uniq -c ~/about",
  "env", "printenv", "echo hello", "echo $USER at $PWD", "echo",
  "stat ~/about", "stat nope", "stat", "file ~/cv", "file ~/projects", "file", "cat /home/memo/til.log", "cat ~/repos",
  "du", "du -sh /", "du -h ~", "du nope", "df", "df -h", "free", "free -h",
  "which ls", "which nope", "which", "man ls", "man grep", "man nope", "man",
  "ps", "date", "uptime", "uname", "uname -a", "uname -r", "uname -m", "yes", "yes ok",
  "mkdir x", "touch x", "rm x", "rm /", "rmdir x", "cp a b", "mv a b", "ln -s a b",
  "chmod 777 x", "chown me x", "mkdir",
  "ping 8.8.8.8", "ssh a@b", "curl https://example.com/x", "wget http://x",
  "ifconfig", "netstat", "kill 1", "kill 999", "kill", "shutdown", "poweroff",
  "dd if=/dev/zero of=/dev/sda", "fsck",
  // second batch
  "cat -n ~/about", "cat -b ~/about", "cut -d: -f1 /etc/passwd", "cut -c1-4 ~/about", "cut",
  "seq 5", "seq 2 2 10", "seq", "rev ~/about", "tee out.txt", "tee",
  "basename /home/jeongin/about", "basename /a/b.md .md", "dirname /home/jeongin/about",
  "basename", "dirname", "realpath ~/til", "realpath ~/about", "realpath nope",
  "readlink ~/til", "readlink ~/about", "readlink", "id", "hostname", "mount",
  "type ls", "type nope", "type",
  "cal", "cal 3 2026", "cal 13", "bc 2^10 + 24", "bc 1/0", "bc nonsense", "bc",
  "neofetch", "xdg-open ~/til", "xdg-open https://example.com", "xdg-open ~/about", "xdg-open",
  "vi ~/about", "vim ~/projects", "vi nope", "vi",
  "qrencode", "qrencode https://99jik.com", "qrencode " + "x".repeat(200),
  "curl /calendar.json", "curl -I /robots.txt", "curl https://example.com/x", "curl",
  "wget /styles.css",
  // third batch
  "head -c 20 ~/about", "tail -c 20 ~/about", "wc -m ~/about", "sort -n ~/about",
  "uniq -d ~/about", "uniq -u ~/about", "ls -1", "grep -c testing /", "grep -l testing /",
  "find / -type d", "find / -type f -name *.md", "cat -A ~/about",
  "base64 ~/about", "xxd ~/about", "xxd", "cat /var/log/deploy.log", "diff ~/about ~/contact",
  "diff ~/about ~/about", "diff ~/about", "diff nope nope2",
  "nproc", "arch", "tty", "groups", "logname", "who", "w", "lsb_release -a",
  "alias", "time ls", "time", "less ~/about", "more ~/about", "lolcat ~/about", "lolcat",
  "sed s/a/b/ ", "sed",
];
const EXTRAS = [
  "su alice", "su root", "su", "whoami", "exit", "logout",
  "sudo rm -rf /", "sudo apt install x", ":(){ :|:& };:",
  "sl", "cowsay", "cowsay hello there", "fortune", "cmatrix", "matrix", "reboot",
];
const PIPES = [
  "ls | wc -l", "ls -a ~ | sort | head -3", "cat ~/about | head -2",
  "grep oracle / | wc -l", "env | grep USER", "tree | tail -1",
  "contact | wc -l", "skills | grep -i rust", "ls |", "| ls",
  "cat /etc/passwd | cut -d: -f1", "ls | tr a-z A-Z", "ls -al | awk '{print $5, $9}'",
  "env | awk -F= '{print $1}'", "seq 5 | tac", "seq 5 | rev", "ls | tee x | wc -l",
  "cat ~/about | awk 'NR==1 {print}'", "cat ~/about | awk '{print NF}'",
  "du / | sort -n | tail -3", "ls | lolcat", "cat ~/about | sed 's/a/A/g'",
  "cat ~/about | sed '/^$/d'", "cat ~/about | base64 | base64 -d", "ls | sort -u | wc -l",
];

console.log("site commands");
for (const c of SITE) for (const l of ["ko", "en"]) check(`${c} [${l}]`, () => run(c, l));
console.log("shell commands");
for (const c of SHELL) for (const l of ["ko", "en"]) check(`${c} [${l}]`, () => run(c, l));
console.log("coreutils");
for (const c of COREUTILS) for (const l of ["ko", "en"]) check(`${c} [${l}]`, () => run(c, l));
console.log("extras");
for (const c of EXTRAS) for (const l of ["ko", "en"]) check(`${c} [${l}]`, () => run(c, l));
console.log("pipelines");
for (const c of PIPES) check(c, () => run(c));

// ── invariants ──────────────────────────────────────────────────────────────
console.log("invariants");

check("real commands are not shadowed by the free-form handlers", () => {
  // The old dispatch ran the joke layer first, so `df`/`ps`/`man` never reached
  // their implementations.
  if (!flat("df").includes("jikfs")) throw new Error("df did not reach coreutils");
  if (!flat("man ls").includes("SYNOPSIS")) throw new Error("man did not reach coreutils");
  if (!flat("ps").includes("init")) throw new Error("ps did not reach coreutils");
  // sudo has no table entry, so it must fall through to the sudoers response.
  if (!flat("sudo x").includes("sudoers")) throw new Error("sudo did not reach extras");
  return true;
});

check("mpv reaches the playlist and refuses everything else", () => {
  const play = run("mpv ~/.midnight/playlist.m3u");
  if (!play.some(b => b.kind === "player")) throw new Error("no player block");
  if (!flat("mpv --playlist-start=4 ~/.midnight/playlist.m3u").includes('"start":4'))
    throw new Error("--playlist-start ignored");
  if (!flat("mpv ~/nope").includes("No such file")) throw new Error("missing file not reported");
  if (!flat("mpv /etc/passwd").includes("Format detection failed"))
    throw new Error("a text file should not be playable");
  return true;
});

check("the player outlives every window that shows it", () => {
  // Three ways to lose the music, all found the hard way: `clear` unmounting the
  // block, minimising unmounting the window, and closing the player window. The
  // iframe hangs off the desktop instead, and nothing else may own it.
  const mpv = readFileSync(new URL("../src/mpv.jsx", import.meta.url), "utf8");
  if (!mpv.includes("new YT.Player")) throw new Error("mpv.jsx does not own the player");
  const block = mpv.slice(mpv.indexOf("export function PlayerBlock"),
                          mpv.indexOf("export function MpvStrip"));
  if (!block) throw new Error("PlayerBlock is gone");
  for (const bad of ["new YT.Player", "createElement", "setHost"]) {
    if (block.includes(bad)) throw new Error(`PlayerBlock owns the player again (${bad})`);
  }
  const strip = mpv.slice(mpv.indexOf("export function MpvStrip"),
                          mpv.indexOf("export function MusicPlayer"));
  if (strip.includes("setHost")) throw new Error("the terminal strip hosts the player again");

  const host = mpv.slice(mpv.indexOf("export function MpvHost"));
  if (!host.includes("MPV.setHost")) throw new Error("MpvHost no longer registers the host node");

  // The host must be a plain child of the desktop, not of the window list.
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  if (!/<MpvHost \/>/.test(d)) throw new Error("the desktop does not render MpvHost");
  if (d.indexOf("<MpvHost />") > d.indexOf("{wins.map(")) {
    throw new Error("MpvHost is rendered inside the window list, so a window owns it");
  }
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const rule = /\.mpv-host\.off\s*\{([^}]*)\}/.exec(css);
  if (!rule) throw new Error("no idle rule for .mpv-host");
  // The picture is hidden by moving it, never by removing it from the layout: a
  // detached or zero-sized frame has nothing to decode into and stops.
  if (/display:\s*none/.test(rule[1])) throw new Error("display:none detaches the frame and stops playback");
  if (/visibility:\s*hidden/.test(rule[1])) throw new Error("visibility:hidden risks the same");
  if (/(^|[;{\s])(width|height):\s*0/.test(rule[1])) throw new Error("a zero-sized player has nothing to decode into");
  if (!/left:\s*-\d/.test(rule[1])) throw new Error("the hidden player is not parked off-screen");
  return true;
});

check("the mpv strip always occupies its grid row", () => {
  // .term-shell is a three-row grid. If MpvStrip returns null there are only two
  // children left, the scrollback lands in the strip's auto row, and it stops
  // filling the window. Nothing throws; the layout just quietly collapses.
  const mpv = readFileSync(new URL("../src/mpv.jsx", import.meta.url), "utf8");
  const from = mpv.indexOf("export function MpvStrip");
  if (from < 0) throw new Error("MpvStrip is gone");
  const NL = String.fromCharCode(10);
  const body = mpv.slice(from, mpv.indexOf(NL + "}", from));
  if (/return null/.test(body)) throw new Error("MpvStrip returns null and drops its grid row");

  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const rows = /\.term-shell\s*\{[^}]*grid-template-rows:\s*([^;]+);/.exec(css);
  if (!rows) throw new Error("no grid-template-rows on .term-shell");
  const n = rows[1].trim().split(/\s+(?![^(]*\))/).length;
  if (n !== 3) throw new Error(`grid declares ${n} rows, the shell renders 3 children`);
  return true;
});

check("xdg-open hands each thing to its application", () => {
  // Real xdg-open asks the desktop what opens a thing. Returning a bare link for
  // everything was what it did before there was a desktop to ask.
  const win = (cmd, app) => {
    const b = run(cmd).find((x) => x.kind === "mode" && x.action === "open-window");
    if (!b) throw new Error(`${cmd} opened no window`);
    if (b.app !== app) throw new Error(`${cmd} opened ${b.app}, expected ${app}`);
    return b;
  };
  win("xdg-open ~/cv", "cv");
  win("xdg-open ~/.midnight/playlist.m3u", "music");
  if (win("xdg-open ~/til", "browser").arg !== window.SITE_DATA.site.tilUrl) {
    throw new Error("the symlink target was not passed to the browser");
  }
  if (win("xdg-open https://example.com/x", "browser").arg !== "https://example.com/x") {
    throw new Error("a plain URL was not passed through");
  }
  // Text goes to the viewer, and a .desktop entry launches what it names, which is
  // what the desktop icons are built from. Both have to agree with files.jsx.
  if (win("xdg-open ~/about", "viewer").arg !== "/home/jeongin/about") {
    throw new Error("a text file did not open in the viewer");
  }
  win("xdg-open ~/Desktop/music.desktop", "music");
  if (!flat("xdg-open ~/nope").includes("No such file")) throw new Error("missing file not reported");
  if (!flat("xdg-open ~/projects").includes("no application")) {
    throw new Error("a directory is for cd, not for opening");
  }
  return true;
});

check("the desktop is a folder, and its icons are its contents", () => {
  // Two lists would drift. The icons are read from ~/Desktop, so a launcher that
  // is not in the folder cannot appear and one that is cannot be forgotten.
  const dir = window.FS.resolve("/home/jeongin/Desktop").node;
  if (!dir || dir.type !== "dir") throw new Error("~/Desktop is missing");
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  if (!d.includes("desktopEntries")) throw new Error("the icons are not read from the folder");
  if (/const DESK_ICONS = \[/.test(d)) throw new Error("a hardcoded icon list is back");

  const apps = [...d.matchAll(/^  (\w+):\s*\{ icon:/gm)].map((m) => m[1]);
  for (const [file, node] of Object.entries(dir.children)) {
    if (!/\.desktop$/.test(file)) continue;
    const exec = (node.content || []).find((l) => l.startsWith("Exec="));
    if (!exec) throw new Error(`${file} has no Exec`);
    const app = exec.slice(5).trim();
    if (!apps.includes(app)) throw new Error(`${file} launches "${app}", which is not an app`);
  }
  const readme = dir.children["README.md"];
  if (!readme || !(readme.content || []).length) throw new Error("the desktop README is missing");
  return true;
});

check("the CV renders from a blob, because raw github refuses to be framed", () => {
  // raw.githubusercontent.com sends X-Frame-Options: deny, so the file cannot go
  // straight into an iframe. It does send Access-Control-Allow-Origin: *, so the
  // bytes can be fetched and handed to a blob: URL, which is same-origin.
  const v = readFileSync(new URL("../src/pdf.jsx", import.meta.url), "utf8");
  if (!v.includes("createObjectURL")) throw new Error("the PDF is not fetched into a blob");
  if (!v.includes("revokeObjectURL")) throw new Error("the blob URL is never released");
  if (/<iframe src=\{(src|raw)\}/.test(v)) throw new Error("framing the remote URL directly cannot work");
  if (!v.includes("raw.githubusercontent.com")) throw new Error("the blob URL is not rewritten");
  return true;
});

check("closing a window waits for its own animation", () => {
  // Removing the window on click cuts the unmap animation off at frame one. It is
  // marked dying, then removed on a timer.
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  const close = d.slice(d.indexOf("const close = (id)"), d.indexOf("const setState = (id"));
  if (!close.includes("dying")) throw new Error("close removes the window immediately");
  if (!close.includes("reduceMotion")) throw new Error("close ignores prefers-reduced-motion");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  if (!css.includes("win-unmap")) throw new Error("no unmap animation");
  if (!/@media \(prefers-reduced-motion: reduce\)[^}]*\{[\s\S]{0,400}?win\.animate/.test(css)) {
    throw new Error("the window animations are not withdrawn for reduced motion");
  }
  return true;
});

check("a snapped window can still be resized", () => {
  // The guard that pulls a snapped window loose when you drag its title bar used to
  // catch the resize grips too, so putting a window against an edge was the thing
  // that made it unresizable.
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  const fn = d.slice(d.indexOf("const startDrag = (e, kind, id)"), d.indexOf("const EDGES"));
  if (/if \(kind !== "move"\) return;/.test(fn)) {
    throw new Error("resizing a snapped window still bails out");
  }
  if (!/if \(kind === "move" && \(win\.state !== "windowed" \|\| win\.snap\)\)/.test(fn)) {
    throw new Error("the pull-loose guard no longer checks the drag kind");
  }
  if (!/loose\.has\(w\.id\) && w\.snap/.test(fn)) {
    throw new Error("resizing does not release the snap on the windows it moves");
  }
  return true;
});

check("two windows sharing an edge resize together", () => {
  // A divider between tiled windows is one number. Moving only the dragged window
  // leaves it overlapping its neighbour or a gap between them.
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  const fn = d.slice(d.indexOf("const startDrag = (e, kind, id)"), d.indexOf("const EDGES"));
  if (!fn.includes("partners")) throw new Error("no neighbour detection at drag start");
  // Geometry, not snap names: after one hand-set drag the pair are ordinary
  // adjacent windows and must still move together.
  if (!/Math\.abs\(w\.x - \(win\.x \+ win\.w\)\)/.test(fn)) {
    throw new Error("neighbours are matched by something other than their edges");
  }
  for (const guard of ["MIN_W", "MIN_H"]) {
    if (!fn.includes(guard)) throw new Error(`the shared divider ignores ${guard}`);
  }
  if (!/moved\.set/.test(fn)) throw new Error("neighbours are detected but never moved");
  return true;
});

check("snapping and the dock agree on where the screen ends", () => {
  // A maximised window is laid out by CSS and snap targets are computed in JS. If
  // those two disagree about the dock, windows sit under it or float above it.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const m = /\.win\.maxed\s*\{[^}]*bottom:\s*(\d+)px/.exec(css);
  if (!m) throw new Error(".win.maxed does not reserve room for the dock");
  if (+m[1] !== window.WM.DOCK_H) {
    throw new Error(`css leaves ${m[1]}px, WM.DOCK_H is ${window.WM.DOCK_H}`);
  }
  const dock = /\.dock\s*\{[^}]*height:\s*(\d+)px/.exec(css);
  if (!dock || +dock[1] !== window.WM.DOCK_H) {
    throw new Error("the dock is not the height the arithmetic assumes");
  }
  return true;
});

check("snap zones tile the screen without gaps or overlap", () => {
  const W = 1600, H = 900;
  const { snapRect, area, DOCK_H } = window.WM;
  const a = area(W, H);
  if (a.h !== H - DOCK_H) throw new Error("usable height ignores the dock");
  const halves = ["l", "r"].map((z) => snapRect(z, W, H));
  if (halves[0].w + halves[1].w !== a.w) throw new Error("halves do not add up to the width");
  if (halves[0].x !== 0 || halves[1].x !== halves[0].w) throw new Error("halves overlap or gap");
  const quads = ["tl", "tr", "bl", "br"].map((z) => snapRect(z, W, H));
  if (quads.reduce((s, q) => s + q.w * q.h, 0) !== a.w * a.h) {
    throw new Error("quarters do not cover the usable area exactly");
  }
  if (!snapRect("max", W, H).max) throw new Error("the top edge does not maximise");
  return true;
});

check("a saved layout is not trusted on the way back in", () => {
  // It could have been written by a wider screen, or against an app list that has
  // since changed. Everything restored is clamped and filtered.
  const { clamp, MIN_W, MIN_H, area } = window.WM;
  const a = area(1000, 700);
  const big = clamp({ x: 5000, y: 5000, w: 99999, h: 99999 }, 1000, 700);
  if (big.w > a.w || big.h > a.h) throw new Error("an oversized window was not clamped");
  if (big.x > a.w || big.y > a.h) throw new Error("an off-screen window was not pulled back");
  const tiny = clamp({ x: 0, y: 0, w: 1, h: 1 }, 1000, 700);
  if (tiny.w < MIN_W || tiny.h < MIN_H) throw new Error("a sub-minimum window was allowed");

  const src = readFileSync(new URL("../src/wm.js", import.meta.url), "utf8");
  if (!src.includes("validApps.includes")) throw new Error("a layout can name an app that no longer exists");
  return true;
});

check("a run of messages from one sender is labelled once", () => {
  // Repeating the name on every line reads like two people taking turns when it is
  // one person still talking. Both chat surfaces group runs.
  const view = readFileSync(new URL("../src/terminal-view.jsx", import.meta.url), "utf8");
  if (!view.includes("cont:")) throw new Error("the terminal does not mark continuations");
  const chat = readFileSync(new URL("../src/chat.jsx", import.meta.url), "utf8");
  if (!/prev\.role === m\.role/.test(chat)) throw new Error("the chat window does not group runs");
  // Easy Mode has no names on its bubbles, so the run shows in the tail instead:
  // every bubble having one made three messages look like three conversations.
  const easy = readFileSync(new URL("../src/easy-mode.jsx", import.meta.url), "utf8");
  if (!/messages\[i - 1\]\.role === m\.role/.test(easy)) {
    throw new Error("Easy Mode does not group runs");
  }
  if (!easy.includes("tail")) throw new Error("Easy Mode marks no end of turn");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  if (!/\.easy-chat-msg\.tail\.role-user/.test(css)) {
    throw new Error("the tail is still on every bubble, not the last of a run");
  }
  return true;
});

check("markdown tables survive the renderer", () => {
  // The domain notes are mostly tables. Without table support they came out as
  // lines of pipes, which is worse than not rendering at all.
  const md = readFileSync(new URL("../src/md.jsx", import.meta.url), "utf8");
  if (!md.includes("md-table")) throw new Error("the renderer has no table branch");
  // A row is only a header once the separator underneath says so, which needs one
  // line of lookahead, which is why the loop must be indexed.
  if (!/for \(let n = 0; n < src\.length; n\+\+\)/.test(md)) {
    throw new Error("the parser cannot look ahead, so tables cannot be detected");
  }
  if (md.includes("src.indexOf(raw)")) {
    throw new Error("rows are located by value, which breaks on two identical rows");
  }
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const rule = /\.md-table \{([^}]*)\}/.exec(css);
  if (!rule) throw new Error("no .md-table rule");
  // Wide tables scroll inside their own box, like every other wide thing here.
  if (!/overflow-x:\s*auto/.test(rule[1])) throw new Error("a wide table would push the window sideways");

  // ...and the notes that need them actually have them.
  const D = window.SITE_DATA;
  const withTables = D.notes.memo.filter(m => m.md.some(l => /^\s*\|/.test(l)));
  if (withTables.length < 3) throw new Error("the domain notes lost their tables");
  return true;
});

check("markdown is rendered as nodes, never as HTML", () => {
  // A note that contains a tag has to come out as that tag's text. Building an
  // HTML string and assigning it would make the preview an injection point.
  const md = readFileSync(new URL("../src/md.jsx", import.meta.url), "utf8")
    .split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith("//")).join(" ");
  if (/dangerouslySetInnerHTML|innerHTML/.test(md)) throw new Error("md.jsx builds HTML");
  const fm = readFileSync(new URL("../src/files.jsx", import.meta.url), "utf8");
  if (!fm.includes("Markdown")) throw new Error("the file manager does not render markdown");
  if (!/\.md\$/i.test(fm)) throw new Error("nothing picks the renderer by extension");
  return true;
});

check("the weather has one idea of where here is", () => {
  // Two hardcoded defaults would drift the moment one of them moved.
  const D = window.SITE_DATA;
  if (!D.profile.weatherLocation) throw new Error("profile.weatherLocation is missing");
  for (const f of ["terminal-view.jsx", "desktop.jsx", "terminal-commands.js"]) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
    if (/"Daegu"/.test(src)) throw new Error(`${f} still hardcodes the location`);
  }
  return true;
});

check("language and Easy Mode are offered in exactly one place", () => {
  // The dock is always on screen, so the copies that used to sit in the terminal's
  // title bar were a second control for the same setting.
  const view = readFileSync(new URL("../src/terminal-view.jsx", import.meta.url), "utf8");
  const bar = view.slice(view.indexOf("function TermTitleBar"), view.indexOf("// wttr.in"));
  if (!bar.includes("{!wm && (")) {
    throw new Error("the terminal title bar shows them unconditionally again");
  }
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  if (!d.includes("dock-easy") || !d.includes("dock-lang")) {
    throw new Error("the dock does not carry them");
  }
  // ...and the dock has to keep them at every width, now that nothing else does.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  // Scanned rather than matched: a regex spanning blocks is more trouble here
  // than walking the braces.
  for (let i = css.indexOf("@media"); i >= 0; i = css.indexOf("@media", i + 1)) {
    const open = css.indexOf("{", i);
    let depth = 0, end = open;
    for (; end < css.length; end++) {
      if (css[end] === "{") depth++;
      else if (css[end] === "}" && --depth === 0) break;
    }
    const body = css.slice(open, end);
    if (/\.dock-(easy|lang)[^{]*\{[^}]*display:\s*none/.test(body)) {
      throw new Error("a breakpoint hides the only copy there is");
    }
  }

  // Both are still reachable from the shell too, which is a command, not a control.
  for (const cmd of ["easy", "lang"]) {
    if (flat(cmd).includes("command not found")) throw new Error(`\`${cmd}\` no longer works`);
  }
  return true;
});

check("cmatrix runs in its window, and runs until stopped", () => {
  const view = readFileSync(new URL("../src/terminal-view.jsx", import.meta.url), "utf8");
  // It used to disappear on a 3.5s timer, which is not what the program does.
  if (/action === "matrix"[^;]*setTimeout/.test(view)) {
    throw new Error("cmatrix still stops itself on a timer");
  }
  const fn = view.slice(view.indexOf("function MatrixRain"), view.indexOf("export { TerminalView }"));
  if (!fn.includes("onDone")) throw new Error("there is no way to quit it");
  // Sized from its own box: the terminal is a window, and a window is not the screen.
  if (/c\.width = window\.innerWidth/.test(fn)) throw new Error("it is sized to the viewport again");
  if (!fn.includes("getBoundingClientRect")) throw new Error("it does not measure its own box");

  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const rule = /\.matrix\s*\{([^}]*)\}/.exec(css);
  if (!rule) throw new Error("no .matrix rule");
  if (/position:\s*fixed/.test(rule[1])) throw new Error("it covers the whole viewport again");
  // Every animation named in CSS has to exist, or it silently does nothing.
  const KEYWORDS = ["none", "inherit", "initial", "unset", "revert"];
  for (const m of css.matchAll(/animation:\s*([\w-]+)/g)) {
    if (KEYWORDS.includes(m[1])) continue;
    if (!css.includes("@keyframes " + m[1])) throw new Error(`@keyframes ${m[1]} is never defined`);
  }
  return true;
});

check("several windows of the same app can be open at once", () => {
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  const apps = d.slice(d.indexOf("export const APPS"), d.indexOf("const APP_KEYS"));
  // A shell, a file manager, a browser and a viewer are things you have several
  // of. A settings panel, a conversation and one media player are not.
  for (const a of ["terminal", "files", "browser", "viewer"]) {
    if (!new RegExp(a + ":[^\n]*multi: true").test(apps)) throw new Error(a + " is still a singleton");
  }
  for (const a of ["chat", "music", "settings"]) {
    if (new RegExp(a + ":[^\n]*multi: true").test(apps)) throw new Error(a + " should stay a singleton");
  }

  const open = d.slice(d.indexOf("const open = (app, arg, opts)"), d.indexOf("// Closing plays"));
  if (!/APPS\[app\]\.multi/.test(open)) throw new Error("open ignores multi-instance apps");
  // Launching with nothing in mind means another window; asking for a particular
  // thing raises the window already showing it.
  if (!/arg === undefined \? null/.test(open)) throw new Error("launching a multi app reuses a window");
  if (!/w\.app === app && w\.arg === arg/.test(open)) {
    throw new Error("a multi-instance app is not matched by what it is showing");
  }
  if (!/opts && opts\.reuse/.test(open)) throw new Error("nothing can ask for an existing window");

  // A window with no launcher in the dock row would have no way back from being
  // minimised, so the dock lists those individually.
  if (!d.includes("const extras =")) throw new Error("the dock drops windows that have no launcher");
  if (!d.includes("winLabel")) throw new Error("dock entries for those windows are unlabelled");
  // The session ends with the last shell, not with any of them.
  if (!/x\.app === "terminal" && x\.id !== id/.test(d)) {
    throw new Error("closing one of several terminals still ends the session");
  }
  // ...and the layout has to remember which file each one held.
  const wm = readFileSync(new URL("../src/wm.js", import.meta.url), "utf8");
  if (!/snap: w\.snap, arg: w\.arg/.test(wm)) throw new Error("the saved layout forgets the file");
  if (!/w\.arg\.length < \d+/.test(wm)) throw new Error("a restored argument is not bounded");
  return true;
});

check("each terminal has its own identity", () => {
  // `su` in one shell is not `su` in the others. Same shape as the directory fix:
  // whoever runs a command points the global at their own name first.
  const shell = (st, line) => {
    window.FS.enter(st.cwd);
    window.enterPromptName(st.name);
    run(line);
    st.cwd = window.FS.getCwd();
    st.name = window.getPromptName();
  };
  const a = { cwd: "/home/jeongin", name: "anonymous" };
  const b = { cwd: "/home/jeongin", name: "anonymous" };
  shell(a, "su alice");
  if (a.name !== "alice") throw new Error("su did not take in the shell that ran it");
  if (b.name !== "anonymous") throw new Error("su in one shell changed another");
  shell(b, "su bob");
  if (a.name !== "alice") throw new Error("a second su overwrote the first shell");
  shell(a, "exit");
  if (a.name !== "anonymous" || b.name !== "bob") throw new Error("exit reached past its own shell");

  const view = readFileSync(new URL("../src/terminal-view.jsx", import.meta.url), "utf8");
  if (/window\.addEventListener\("promptname"/.test(view)) {
    throw new Error("the terminal listens to the global name event again");
  }
  // crisp.js does still listen: the chat nickname is one identity for the visitor,
  // not one per window.
  const crisp = readFileSync(new URL("../src/crisp.js", import.meta.url), "utf8");
  if (!/addEventListener\("promptname"/.test(crisp)) {
    throw new Error("the chat nickname no longer follows the name");
  }
  return true;
});

check("each terminal stands in its own directory", () => {
  // The filesystem holds one cwd. With more than one shell open, `cd` in one used
  // to move all of them, so each points it at its own before running anything.
  const view = readFileSync(new URL("../src/terminal-view.jsx", import.meta.url), "utf8");
  if (!view.includes("cwdRef")) throw new Error("a terminal does not track its own directory");
  if (!/atCwd\(\(\) => window\.TERMINAL\.run/.test(view)) {
    throw new Error("commands run against the shared directory again");
  }
  if (!/atCwd\(\(\) => window\.TERMINAL\.complete/.test(view)) {
    throw new Error("tab completion reads the shared directory");
  }
  if (/window\.addEventListener\("promptpath"/.test(view)) {
    throw new Error("the global promptpath event is back, so every shell hears every cd");
  }
  if (!window.FS.enter) throw new Error("FS.enter is missing");
  // enter() must not persist, or one shell's cd becomes everyone's starting point.
  const before = window.FS.getCwd();
  window.FS.enter("/etc");
  if (window.FS.getCwd() !== "/etc") throw new Error("enter did not move the filesystem");
  if (window.FS.displayCwd("/home/jeongin") !== "~") throw new Error("displayCwd ignores its argument");
  window.FS.enter(before);
  return true;
});

check("a window that throws does not take the page with it", () => {
  // This has happened: a component read a field that had been removed from data.js
  // and the whole site went blank. A window is the unit that should absorb that.
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  if (!d.includes("getDerivedStateFromError")) throw new Error("there is no error boundary");
  const body = d.slice(d.indexOf("{wins.map((win)"), d.indexOf("{menu && ("));
  if (!body.includes("<WindowBoundary")) throw new Error("windows are not wrapped in it");
  if (body.indexOf("<WindowBoundary") > body.indexOf("win.app === \"terminal\"")) {
    throw new Error("the boundary is inside the content it is meant to catch");
  }
  return true;
});

check("shortcuts are keyed to the physical key", () => {
  // e.key is what the input method produced. With a Korean layout the letter keys
  // report jamo, so every Ctrl+Alt+<letter> matched nothing at all.
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  const fn = d.slice(d.indexOf("const onKey = (e) =>"), d.indexOf('window.addEventListener("keydown", onKey)'))
    // The comments in there explain why e.key is wrong, so they must not count.
    .split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith("//")).join(" ");
  if (/e\.key/.test(fn)) throw new Error("the handler reads e.key again");
  if (!/const c = e\.code/.test(fn)) throw new Error("the handler does not read e.code");
  // Ctrl+Alt+Tab never reaches the page; Windows takes it.
  if (/=== "Tab"/.test(fn)) throw new Error("Ctrl+Alt+Tab is bound again, and the OS eats it");

  const apps = d.slice(d.indexOf("export const APPS"), d.indexOf("const APP_KEYS"));
  // The whole line, not a greedy slice of it: `key:` comes before `code:` and a
  // greedy match ends at the first and never sees the second.
  for (const line of apps.split(String.fromCharCode(10))) {
    const m = /^  (\w+):.*key: "[^"]+"/.exec(line);
    if (!m) continue;
    if (!/code: "\w+"/.test(line)) throw new Error(`${m[1]} has a key label but no physical code`);
  }
  // A settings row for an app with no shortcut printed "Ctrl+Alt+undefined".
  const set = readFileSync(new URL("../src/settings.jsx", import.meta.url), "utf8");
  if (!/filter\(\(a\) => apps\[a\]\.key\)/.test(set)) {
    throw new Error("the settings list includes apps that have no shortcut");
  }
  return true;
});

check("raising a window takes the keyboard with it", () => {
  // Without this a shortcut opens Files, the window comes to the front, and what
  // you type still goes to the terminal because DOM focus never moved.
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  if (!d.includes("winRefs")) throw new Error("windows are not registered for focusing");
  const focus = d.slice(d.indexOf("const focus = (id) =>"), d.indexOf("const open = (app, arg, opts)"));
  if (!/grab\(id\)/.test(focus)) throw new Error("focus() does not move DOM focus");
  return true;
});

check("every app icon is a drawn shape that exists", () => {
  // The icons used to be characters, and which shape a visitor saw depended on what
  // their system substituted for the ones the font lacked.
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  if (/glyph:/.test(d.slice(d.indexOf("export const APPS"), d.indexOf("const APP_KEYS")))) {
    throw new Error("an app still names its icon as a character");
  }
  const icons = readFileSync(new URL("../src/icons.jsx", import.meta.url), "utf8");
  const drawn = new Set([...icons.matchAll(/^  ([a-z]+): /gm)].map((m) => m[1]));
  for (const m of d.matchAll(/icon: "([a-z]+)"/g)) {
    if (!drawn.has(m[1])) throw new Error(`no icon drawn for "${m[1]}"`);
  }
  // The launchers in the filesystem name the same set.
  const dir = window.FS.resolve("/home/jeongin/Desktop").node;
  for (const [file, node] of Object.entries(dir.children)) {
    if (!/\.desktop$/.test(file)) continue;
    const line = (node.content || []).find((l) => l.startsWith("Icon="));
    if (!line) throw new Error(`${file} has no Icon`);
    if (!drawn.has(line.slice(5).trim())) throw new Error(`${file} names an icon that is not drawn`);
  }
  return true;
});

check("the CV is a file, and the PDF window is a PDF window", () => {
  // It used to be a launcher whose two URLs were baked into the component. It is a
  // document, and the window that opens it reads its sources from the file.
  const dir = window.FS.resolve("/home/jeongin/Desktop").node;
  const cv = Object.entries(dir.children).find(([f]) => /\.pdf$/i.test(f));
  if (!cv) throw new Error("there is no PDF on the desktop");
  if (!cv[1].pdf || !cv[1].pdf.ko || !cv[1].pdf.en) throw new Error("the PDF file names no sources");
  if (dir.children["cv.desktop"]) throw new Error("the CV launcher is back alongside the file");

  const v = readFileSync(new URL("../src/pdf.jsx", import.meta.url), "utf8");
  if (!/const pdf = node\.pdf/.test(v)) throw new Error("the viewer ignores the file it was opened on");
  // A .pdf node with no sources must say so rather than quietly showing the CV.
  if (!/unreadable/.test(v)) throw new Error("a PDF file with no source falls back to the CV");
  // Two ways to show a PDF, each blocked by a different header, so both are tried.
  if (!/state\.direct/.test(v)) throw new Error("no fallback when the bytes cannot be fetched");

  // ...and both openers hand it the path.
  if (!flat("xdg-open ~/Desktop/이력서.pdf").includes("Desktop")) {
    throw new Error("xdg-open does not pass the path to the viewer");
  }
  const fm = readFileSync(new URL("../src/files.jsx", import.meta.url), "utf8");
  if (!/app: "cv", arg: path/.test(fm)) throw new Error("the file manager does not pass the path");
  return true;
});

check("a PDF anywhere goes to the PDF window", () => {
  const win = (cmd, app) => {
    const b = run(cmd).find((x) => x.kind === "mode" && x.action === "open-window");
    if (!b) throw new Error(`${cmd} opened no window`);
    if (b.app !== app) throw new Error(`${cmd} opened ${b.app}, expected ${app}`);
    return b;
  };
  // arXiv serves at /pdf/<id> with no extension, and it is the single most likely
  // PDF anyone here will open, so the test is not just the extension.
  if (win("xdg-open https://arxiv.org/pdf/1706.03762", "cv").arg !== "https://arxiv.org/pdf/1706.03762") {
    throw new Error("the URL was not handed to the viewer");
  }
  win("xdg-open https://example.com/a/b.pdf", "cv");
  win("xdg-open https://dblp.org", "browser");
  if (!window.looksLikePdf("x.PDF?v=2")) throw new Error("the extension test is case sensitive");
  if (window.looksLikePdf("https://example.com/pdfs")) throw new Error("too eager");

  // One test, because two openers were about to grow their own.
  for (const f of ["tools.js", "browser.jsx"]) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
    if (!src.includes("looksLikePdf")) throw new Error(`${f} has its own idea of what a PDF is`);
  }
  return true;
});

check("booking asks, and says that it is asking", () => {
  // Nothing on this page can write to the owner's calendar: the browser key is
  // read-only and creating an event would need OAuth from him, not from a visitor.
  // So the form must never read as a confirmed booking.
  const c = readFileSync(new URL("../src/cal.jsx", import.meta.url), "utf8");
  for (const word of ["요청", "request"]) {
    if (!c.includes(word)) throw new Error(`the form never calls it a ${word}`);
  }
  if (!/확정된 예약이 아니라/.test(c)) throw new Error("the result does not say it is not a booking");

  // Slots come from the same events the grid is drawn from, so an offered slot is
  // one that is actually free.
  if (!/function freeSlots\(day, events\)/.test(c)) throw new Error("slots are not computed from the calendar");
  if (!/if \(s <= now\) continue/.test(c)) throw new Error("the past is bookable");
  if (!/dow === 0 \|\| dow === 6/.test(c)) throw new Error("weekends are offered");

  // It goes down the chat pipe, and says so when that pipe is missing rather than
  // swallowing the message.
  if (!/chatReady\(\)/.test(c)) throw new Error("the form does not check the channel exists");
  if (!/mailto:/.test(c)) throw new Error("there is no fallback when chat is blocked");
  const chat = readFileSync(new URL("../src/chat.jsx", import.meta.url), "utf8");
  if (!/export function sendChat/.test(chat)) throw new Error("chat.jsx does not expose sending");
  return true;
});

check("minimised windows stay mounted", () => {
  // Filtering them out of the render unmounts their iframes, which stops whatever
  // was playing. They are moved off-screen instead.
  const d = readFileSync(new URL("../src/desktop.jsx", import.meta.url), "utf8");
  if (/wins\.filter\(\s*\(?w\)?\s*=>\s*w\.state\s*!==\s*"min"/.test(d)) {
    throw new Error("minimised windows are filtered out of the render again");
  }
  if (!d.includes("stowed")) throw new Error("no off-screen state for minimised windows");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const rule = /\.win\.stowed\s*\{([^}]*)\}/.exec(css);
  if (!rule) throw new Error("no .win.stowed rule");
  if (/display:\s*none/.test(rule[1])) throw new Error("display:none detaches the frame and stops playback");
  return true;
});

check("the live chat feed has one implementation", () => {
  // Three surfaces read this conversation. When each wired up its own listeners
  // they drifted; the hook in chat.jsx is the only place that may subscribe.
  const easy = readFileSync(new URL("../src/easy-mode.jsx", import.meta.url), "utf8");
  if (easy.includes("livechat-agent-message")) {
    throw new Error("easy-mode subscribes to the chat feed directly again");
  }
  if (!easy.includes("useLiveChat")) throw new Error("easy-mode no longer uses the shared hook");
  const chat = readFileSync(new URL("../src/chat.jsx", import.meta.url), "utf8");
  if (!chat.includes("livechat-agent-message")) throw new Error("chat.jsx lost the subscription");
  return true;
});

check("the browser tells the truth about what it cannot load", () => {
  // A blank frame with no explanation reads as a broken feature. Hosts that were
  // checked and refuse framing get named, and youtube gets its embed rewrite.
  const b = readFileSync(new URL("../src/browser.jsx", import.meta.url), "utf8");
  for (const host of ["github.com", "www.youtube.com", "raw.githubusercontent.com"]) {
    if (!b.includes(`"${host}"`)) throw new Error(`${host} is not listed as a refuser`);
  }
  if (!b.includes("youtube-nocookie.com/embed")) throw new Error("no youtube embed rewrite");
  if (!b.includes("ERR_BLOCKED_BY_RESPONSE")) throw new Error("no visible reason shown");

  // A bookmark for a host the same file lists as a refuser is a button that only
  // ever shows an error page.
  const refusers = new Set(
    [...b.matchAll(/^  "([^"]+)":\s*"X-Frame-Options/gm)].map((m) => m[1]));
  const marks = b.slice(b.indexOf("function bookmarks"), b.indexOf("function playlistUrl"));
  for (const m of marks.matchAll(/url:\s*"(https:\/\/[^"]+)"/g)) {
    const host = new URL(m[1]).hostname;
    if (refusers.has(host)) throw new Error(`${host} is bookmarked but listed as a refuser`);
  }
  // The playlist bookmark is the one exception: it is rewritten to the embed.
  if (/url:\s*"https:\/\/(www\.)?99jik\.com/.test(marks)) {
    throw new Error("the browser bookmarks the page it is running inside");
  }
  return true;
});

check("no .jsx file calls a helper that does not exist", () => {
  // Deleting a block by character offset has silently taken the next function with
  // it three times now, and esbuild bundles the result without complaint: the
  // ReferenceError only shows up in the browser, as a blank page.
  //
  // The rule is deliberately narrow so it cannot cry wolf. Comments and string
  // literals are stripped first, capitalised names are left alone (components and
  // constructors), and a lower-case name that is *called* must either be declared
  // in the file or appear somewhere that is not a call: a parameter, a destructured
  // binding, an object key. A deleted helper appears only as `name(`, which is
  // exactly what this catches and nothing else is.
  //
  // The stripper is approximate and only has to be good enough to stop the noise.
  // Ordinary quotes go first because they cannot nest.
  const strip = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ");

  const GLOBALS = new Set([
    "if", "for", "while", "switch", "catch", "return", "typeof", "function", "await",
    "new", "super", "in", "of", "do", "else", "case", "delete", "void", "yield", "async",
    "require", "parseInt", "parseFloat", "isNaN", "isFinite",
    "encodeURIComponent", "decodeURIComponent", "setTimeout", "clearTimeout",
    "setInterval", "clearInterval", "fetch", "alert", "confirm", "prompt",
    "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle",
    "structuredClone", "queueMicrotask", "atob", "btoa", "matchMedia",
  ]);

  const files = readdirSync(new URL("../src/", import.meta.url)).filter((f) => f.endsWith(".jsx"));
  const bad = [];

  for (const f of files) {
    const src = strip(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"));

    const declared = new Set(GLOBALS);
    const add = (re) => { for (const m of src.matchAll(re)) declared.add(m[1]); };
    add(/function\s+([A-Za-z_$][\w$]*)/g);
    add(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g);
    add(/class\s+([A-Za-z_$][\w$]*)/g);
    add(/import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from/g);
    // Shorthand methods, in object literals and in classes: `name(args) {`
    add(/(?:^|[\s,{])([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/gm);
    for (const m of src.matchAll(/import\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (name) declared.add(name);
      }
    }

    // Every place a name is used as something other than a call. Parameters,
    // destructured bindings and object properties all land here.
    const nonCall = new Set();
    for (const m of src.matchAll(/([A-Za-z_$][\w$]*)(?!\s*\()/g)) nonCall.add(m[1]);

    // The leading guard matters: without it `String(` matches from the `t` and the
    // uppercase test never sees the real first letter.
    for (const m of src.matchAll(/(?:^|[^\w$.?])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = m[1];
      if (/^[A-Z]/.test(name)) continue;   // a component or a constructor
      if (declared.has(name) || nonCall.has(name)) continue;
      bad.push(`${f}: ${name}()`);
    }
  }

  if (bad.length) throw new Error("called but never defined: " + [...new Set(bad)].join(", "));
  return true;
});

check("the renderer still dispatches every block kind a command can emit", () => {
  // Blocks that no branch in Block() matches render as nothing at all, silently.
  // `parts` and `mode` have each vanished this way before.
  const view = readFileSync(new URL("../src/terminal-view.jsx", import.meta.url), "utf8");
  for (const kind of ["weather", "fetch", "qr", "live", "now", "player", "link"]) {
    if (!view.includes(`block.kind === "${kind}"`)) throw new Error(`no branch for ${kind}`);
  }
  if (!view.includes("block.parts")) throw new Error("parts rendering lost again");
  return true;
});

check("df and du agree on bytes used", () => {
  const used = lines("du -s /")[0].trim().split(/\s+/)[0];       // 1K blocks
  const dfUsed = lines("df")[1].trim().split(/\s+/)[2];
  if (used !== dfUsed) throw new Error(`du says ${used}K, df says ${dfUsed}K`);
  return `${used}K`;
});

check("pipes actually filter", () => {
  const all = lines("ls -a ~").join(" ").trim().split(/\s+/).length;
  const three = lines("ls -a ~ | sort | head -3").length;
  if (three !== 3) throw new Error(`head -3 produced ${three} lines`);
  const wc = parseInt(lines("cat ~/about | wc -l")[0].trim(), 10);
  const direct = lines("cat ~/about").length;
  if (wc !== direct) throw new Error(`wc counted ${wc}, cat printed ${direct}`);
  if (!all) throw new Error("ls produced nothing to pipe");
  return true;
});

check("a bar inside shell syntax is not a pipe", () => {
  // `:(){ :|:& };:` contains a bar but is one construct.
  if (!flat(":(){ :|:& };:").includes("fork")) throw new Error("fork bomb was split on |");
  return true;
});

check("writes fail with EROFS", () => {
  for (const [cmd, needle] of [["mkdir x", "Read-only file system"],
                               ["touch x", "Read-only file system"],
                               ["cp a b", "Read-only file system"]]) {
    if (!flat(cmd).includes(needle)) throw new Error(`${cmd} did not report EROFS`);
  }
  // preserve-root is checked before the filesystem is touched
  if (!flat("rm /").includes("preserve-root")) throw new Error("rm / skipped the failsafe");
  return true;
});

check("uname stays consistent with /etc/os-release", () => {
  const osr = window.FS.resolve("/etc/os-release").node.content.join("\n");
  const name = /NAME="([^"]+)"/.exec(osr)[1];
  if (!flat("uname").includes(name)) throw new Error(`uname disagrees with os-release (${name})`);
  return name;
});

// The feed URL is config now, not a secret, so a typo here silently empties the
// calendar on the whole site.
check("the calendar feed is configured and reachable in shape", () => {
  const u = window.SITE_DATA.site.icalUrl;
  if (!/^https:\/\/calendar\.google\.com\/calendar\/ical\/.+basic\.ics$/.test(u)) {
    throw new Error("site.icalUrl does not look like a Google iCal feed: " + u);
  }
  if (!/^https:\/\/calendar\.app\.google\//.test(window.SITE_DATA.site.bookingUrl)) {
    throw new Error("site.bookingUrl does not look like a Google booking page");
  }
  return true;
});

check("whoami reports the effective user", () => {
  // It used to print a bilingual introduction, which meant `su alice; whoami` still
  // answered with the site owner. That is `about`'s job.
  const before = lines("whoami")[0];
  if (before !== "anonymous") throw new Error(`whoami said "${before}" before any su`);
  run("su alice");
  const after = lines("whoami")[0];
  run("exit");
  if (after !== "alice") throw new Error(`after su alice, whoami said "${after}"`);
  if (lines("whoami")[0] !== "anonymous") throw new Error("exit did not restore anonymous");
  return true;
});

check("cv links are ko then en", () => {
  const links = run("cv").filter(b => b.kind === "link");
  if (links.length !== 2) throw new Error(`expected 2 links, got ${links.length}`);
  if (!links[0].href.endsWith("cv-ko.pdf")) throw new Error(`first link is not ko: ${links[0].href}`);
  if (!links[1].href.endsWith("cv-en.pdf")) throw new Error(`second link is not en: ${links[1].href}`);
  return links;
});

check("every hint referencing a slug uses a real one", () => {
  const slugs = window.SITE_DATA.projects.map(p => p.slug);
  for (const c of Object.values(window.TERMINAL.buildCommands("ko"))) {
    const m = String(c.hint).match(/cat ([a-z0-9-]+)\)/);
    if (m && !slugs.includes(m[1])) throw new Error(`dead slug in hint: ${c.hint}`);
  }
  return true;
});

check("hidden files stay behind -a", () => {
  // .lab is hidden, so a plain grep must not reach into it. The probe is a word
  // that only appears inside that directory.
  const probe = "판정";
  if (flat("grep " + probe + " /").includes("principles.md")) throw new Error("grep leaked .lab without -a");
  if (!flat("grep -a " + probe + " /").includes("principles.md")) throw new Error("grep -a found nothing");
  if (flat("find / -name *.md").includes(".lab")) throw new Error("find -name leaked .lab");
  if (!flat("find / -a -name *.md").includes(".lab")) throw new Error("find -a missed .lab");
  return true;
});

check("find -name defaults to cwd", () => {
  if (flat("find -name *.md").includes("No such file")) throw new Error("pattern treated as a path");
  return true;
});

check("every command in the table has a usage string", () => {
  const missing = Object.entries(window.TERMINAL.buildCommands("ko"))
    .filter(([, v]) => !v.usage).map(([k]) => k);
  if (missing.length) throw new Error(`no usage for: ${missing.join(", ")}`);
  return true;
});

check("bilingual data fields are paired", () => {
  const D = window.SITE_DATA;
  for (const r of D.research) {
    if (!r.blurb_ko || !r.blurb_en) throw new Error(`research "${r.tag}" is missing a blurb translation`);
  }
  for (const e of D.experience) {
    if (!e.where_ko || !e.where_en) throw new Error(`experience "${e.when}" is missing a where translation`);
  }
  if (!D.profile.location_ko || !D.profile.location_en) throw new Error("profile.location is not paired");
  return true;
});

// Guards the class of bug where a ko-only field gets rendered in en mode.
// `about` is deliberately bilingual; projects ships the raw record to the
// grid component, so both legitimately carry Hangul.
check("english mode renders no Korean", () => {
  const HANGUL = /[가-힣]/;
  for (const cmd of ["research", "experience", "skills", "publications", "contact", "cv", "til"]) {
    const out = flat(cmd, "en");
    if (HANGUL.test(out)) throw new Error(`"${cmd}" in en mode renders Hangul: ${out.slice(0, 140)}`);
  }
  return true;
});

// The crawler fallback is generated at build time from the same data. If it ever
// goes empty the site silently becomes invisible to search and link previews.
check("the crawler fallback carries the real content", () => {
  const html = fallbackHtml();
  const D = window.SITE_DATA;
  const must = [
    D.profile.name_ko, D.profile.name_en, D.profile.email,
    ...D.projects.map(p => p.title_ko),
    ...D.publications.map(p => p.title_ko),
    ...D.patents.map(p => p.title_ko),
    ...D.research.map(r => r.tag),
    D.site.cvKo, D.site.cvEn,
  ];
  for (const needle of must) {
    if (!html.includes(needle)) throw new Error(`fallback HTML is missing "${needle}"`);
  }
  if (html.length < 500) throw new Error(`fallback HTML is suspiciously short (${html.length} bytes)`);
  // An em-dash written as an entity slipped past the sweep that removed the rest.
  for (const bad of ["&mdash;", String.fromCharCode(8212)]) {
    if (html.includes(bad)) throw new Error("the crawler fallback still contains an em-dash");
  }
  return `${html.length} bytes`;
});

// Sizes used to be typed in by hand and disagreed with the content, which made df
// report a quarter of a megabyte for five kilobytes of text.
check("reported sizes match the actual content", () => {
  const enc = new TextEncoder();
  const walk = (node, path, seen) => {
    if (node.type === "dir") {
      for (const [name, child] of Object.entries(node.children)) {
        walk(child, path === "/" ? "/" + name : path + "/" + name, seen);
      }
      return;
    }
    if (node.type === "link") return;
    // Live files are 0 until read, like /proc, so there is nothing to compare.
    if (node.live) {
      if (node.size !== 0) seen.push(`${path}: live but reports ${node.size}`);
      return;
    }
    const NL = String.fromCharCode(10);
    const real = enc.encode((node.content || []).join(NL) + NL).length;
    if (node.size !== real) seen.push(`${path}: says ${node.size}, holds ${real}`);
  };
  const wrong = [];
  walk(window.FS.root(), "/", wrong);
  if (wrong.length) throw new Error(wrong.slice(0, 3).join("; "));
  return true;
});

// Every note file is user-owned now. If one ever renders invented content again,
// this is what catches it.
check("note files are data-driven, not hand-written fiction", () => {
  const D = window.SITE_DATA;
  // memo is one file per domain, so the check is that the set of files matches the
  // set of entries exactly: no orphan file, no entry without a file.
  const dir = window.FS.resolve("/home/memo").node;
  if (!dir) throw new Error("/home/memo is missing");
  const generated = new Set(D.notes.memo.map(m => m.file));
  for (const m of D.notes.memo) {
    const f = dir.children[m.file];
    if (!f) throw new Error(`${m.file} is in notes.memo but not in /home/memo`);
    if (f.content !== m.md) throw new Error(`${m.file} does not read from data.js`);
    if (!m.md.length) throw new Error(`${m.file} is empty`);
    if (!m.title) throw new Error(`${m.file} has no title for the README`);
  }
  for (const name of Object.keys(dir.children)) {
    // README and til.log are fixtures, work.md has its own data.js field; every
    // other file here has to come from notes.memo.
    if (["README", "til.log", "work.md", "social.md"].includes(name)) continue;
    if (!generated.has(name)) throw new Error(`/home/memo/${name} is not in notes.memo`);
  }
  // The two long-form documents live in data.js like everything else, so they can
  // be edited without touching the filesystem code.
  for (const [path, field] of [["/home/memo/work.md", D.notes.work],
                               ["/home/memo/social.md", D.notes.social],
                               ["/home/jeongin/.lab/grad.md", D.notes.grad],
                               ["/home/jeongin/.lab/principles.md", D.notes.principles]]) {
    const f = window.FS.resolve(path).node;
    if (!f) throw new Error(path + " is missing");
    if (f.content !== field) throw new Error(path + " does not read from data.js");
    if (!field.length) throw new Error(path + " is empty");
  }
  return true;
});

check("now.log is generated, never typed", () => {
  // Hand-written "what I'm up to" always rots. It reads the calendar instead.
  const node = window.FS.resolve("/home/jeongin/now.log").node;
  if (!node) throw new Error("now.log is missing");
  if (node.live !== "now") throw new Error("now.log is not calendar-backed");
  if ("now" in window.SITE_DATA) throw new Error("data.js still carries a hand-written now[]");
  return true;
});

check("every project carries both languages, and the featured ones carry detail", () => {
  const D = window.SITE_DATA;
  for (const p of D.projects) {
    for (const f of ["slug", "title_ko", "title_en", "summary_ko", "summary_en", "year"]) {
      if (!p[f]) throw new Error(`${p.slug || "a project"} is missing ${f}`);
    }
    // The two detail lists describe the same work, so they cannot be different
    // lengths: one language would silently say less than the other.
    const dk = p.detail_ko || [], de = p.detail_en || [];
    if (dk.length !== de.length) {
      throw new Error(`${p.slug}: ${dk.length} Korean detail lines vs ${de.length} English`);
    }
    if (p.featured && !dk.length) throw new Error(`${p.slug} is featured but has no detail`);
  }
  // `cat <slug>` is the only place the detail shows, so it has to reach it.
  const abb = flat("cat ABB");
  if (!abb.includes("엣지")) throw new Error("cat does not show the detail lines");
  if (!abb.includes("와이디자인랩")) throw new Error("the ABB client is missing");
  return true;
});

check("the site says what the CV says", () => {
  // cv-en.pdf is the record. The site used to date the MS a term early, name the
  // wrong university for the degree, and claim four skills that appear neither in
  // the CV nor in any public repository.
  const D = window.SITE_DATA;
  const flat = JSON.stringify(D).toLowerCase();
  for (const gone of ["rust", "llvm", "tree-sitter", "oracle problem", "2024.09"]) {
    if (flat.includes(gone)) throw new Error(`"${gone}" is back, and the CV does not say it`);
  }
  if (!D.experience.some(e => e.when.startsWith("2025.03") && /석사/.test(e.what_ko))) {
    throw new Error("the MS start date does not match the CV");
  }
  if (!D.experience.some(e => /영진/.test(e.where_ko))) throw new Error("the degrees lost their university");

  // Every publication carries both titles and its authors, because the papers are
  // Korean originals with an English title in the CV.
  for (const p of D.publications) {
    for (const f of ["title_ko", "title_en", "authors", "venue"]) {
      if (!p[f]) throw new Error(`a publication is missing ${f}`);
    }
    if (p.role !== "first author") throw new Error("authorship is not recorded as first author");
  }
  // A filed patent is filed, not granted, and has to say so.
  for (const x of D.patents) {
    if (!/provisional|in progress/i.test(x.status_en)) throw new Error("the patent overstates its status");
  }
  return true;
});

check("Korean never sits in a padded middle column", () => {
  // Hangul has no glyphs in JetBrains Mono, so it renders from the next font in the
  // stack, whose advance is not reliably twice the Latin one. Cells can be counted
  // correctly and the column will still drift, so Korean goes last in every table.
  for (const cmd of ["projects", "publications", "experience", "skills", "research", "patents"]) {
    for (const b of run(cmd, "ko")) {
      if (b.kind !== "text" || !b.parts || b.parts.length < 2) continue;
      const tail = b.parts.slice(0, -1).map(x => x.t || "").join("");
      if (/[가-힣]/.test(tail)) {
        throw new Error(`${cmd} pads a Korean column: "${tail.trim().slice(0, 40)}"`);
      }
    }
  }
  return true;
});

check("a calendar that cannot be read says so", () => {
  // The last-resort fallback used to carry nine invented meetings and the UI
  // reported them as freshly synced. Empty and honest beats plausible and false.
  const cal = readFileSync(new URL("../src/calendar.js", import.meta.url), "utf8");
  const mock = /const MOCK = \{([^;]*)\};/.exec(cal);
  if (!mock) throw new Error("no fallback object");
  if (/title:/.test(mock[1])) throw new Error("the fallback invents events again");
  if (!/failed: true/.test(mock[1])) throw new Error("the fallback does not mark itself as a failure");

  // ...and both surfaces have to distinguish it from an empty week.
  for (const f of ["terminal-view.jsx", "easy-mode.jsx"]) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
    if (!/data\.failed/.test(src)) throw new Error(`${f} shows an empty calendar as if it loaded`);
  }
  return true;
});

check("nothing in CI writes to the repository", () => {
  // The daily cron that committed public/calendar.json is gone. The deploy only
  // refreshes the snapshot inside the runner.
  const dir = new URL("../.github/workflows/", import.meta.url);
  const files = readdirSync(dir);
  if (files.includes("calendar.yml")) throw new Error("the calendar cron is back");
  for (const f of files) {
    const y = readFileSync(new URL(f, dir), "utf8");
    if (/git (commit|push)/.test(y)) throw new Error(`${f} writes to the repository`);
    if (/contents:\s*write/.test(y)) throw new Error(`${f} asks for write permission`);
  }
  return true;
});

check("no placeholder text left in data", () => {
  const blob = JSON.stringify(window.SITE_DATA).toLowerCase();
  for (const bad of ["placeholder", "sil-harness", "lorem", "todo"]) {
    if (blob.includes(bad)) throw new Error(`data.js still contains "${bad}"`);
  }
  return true;
});

// Completion used to be hardcoded to five commands, so `vi <tab>` did nothing.
// It is derived from each command's `usage` now, and this checks the derivation.
check("tab completion follows usage strings", () => {
  const cases = [
    ["vi c", "vi contact"], ["head ~/ab", "head ~/about"], ["stat cv", "stat cv"],
    ["man gr", "man grep"], ["which se", "which seq"], ["cat ti", "cat til"],
    ["xdg-open ~/t", "xdg-open ~/til"], ["theme pho", "theme phosphor"],
  ];
  for (const [input, want] of cases) {
    const got = window.TERMINAL.complete(input, "ko");
    if (!got.includes(want)) throw new Error(`complete("${input}") missing "${want}": ${JSON.stringify(got)}`);
  }
  // A trailing space starts a new word and must not double up the separator.
  for (const c of window.TERMINAL.complete("vi ", "ko")) {
    if (/\s\s/.test(c)) throw new Error(`doubled space in completion: "${c}"`);
  }
  // Commands that take no path must not offer one.
  for (const c of ["tr a", "awk x", "bc 1"]) {
    if (window.TERMINAL.complete(c, "ko").length) throw new Error(`"${c}" should not complete paths`);
  }
  return true;
});

check("every path-taking command documents it in usage", () => {
  // The derivation only works if usage says <file>/<path>/<dir>.
  const C = window.TERMINAL.buildCommands("ko");
  for (const name of ["cat", "ls", "cd", "tree", "find", "head", "tail", "wc", "stat",
                      "file", "du", "realpath", "readlink", "vi", "xdg-open", "tee"]) {
    if (!/\b(file|path|dir)\b/.test(String(C[name].usage))) {
      throw new Error(`${name} takes a path but its usage does not say so: ${C[name].usage}`);
    }
  }
  return true;
});

check("tab completion only offers real commands", () => {
  const cmds = Object.keys(window.TERMINAL.buildCommands("ko"));
  for (const c of window.TERMINAL.complete("c", "ko")) {
    if (!cmds.includes(c)) throw new Error(`completion offered unknown command: ${c}`);
  }
  return true;
});

check("base64 survives a round trip through Hangul", () => {
  const src = lines("cat ~/about");
  const back = lines("cat ~/about | base64 | base64 -d");
  if (back.join("|") !== src.join("|")) throw new Error("base64 round trip changed the text");
  return true;
});

check("sort -n orders numerically", () => {
  const got = lines("du / | sort -n").map(l => parseInt(l.trim(), 10)).filter(v => !Number.isNaN(v));
  for (let i = 1; i < got.length; i++) {
    if (got[i] < got[i - 1]) throw new Error(`sort -n produced ${got[i - 1]} before ${got[i]}`);
  }
  return got.length + " rows";
});

check("diff finds a difference and none when identical", () => {
  if (run("diff ~/about ~/about").length) throw new Error("diff reported a change against itself");
  const d = flat("diff ~/about ~/contact");
  if (!d.includes("<") || !d.includes(">")) throw new Error("diff produced no hunks for different files");
  return true;
});

check("grep -c agrees with the number of matches", () => {
  const n = parseInt(lines("grep -c testing /")[0], 10);
  const full = lines("grep testing /").filter(l => l && !l.startsWith("("));
  if (n !== full.length) throw new Error(`grep -c said ${n}, grep listed ${full.length}`);
  return n;
});

// A wrong Galois field yields a code that looks perfect and scans as nothing, so
// this checks the arithmetic against the published QR test vector.
check("the QR encoder matches the standard Reed-Solomon vector", () => {
  const data = [32,91,11,120,209,114,220,77,67,64,236,17,236,17,236,17];
  const want = [196,35,39,119,235,215,231,226,93,23];
  const got = window.QR._rsRemainder(data, 10);
  if (got.join(",") !== want.join(",")) throw new Error("RS remainder is " + got.join(","));
  return true;
});

// The encoder was correct while the output was unscannable, because the monospace
// cell is not square. Structure checks cannot see that, but a round trip proves the
// data path and the SVG renderer keeps the geometry honest.
check("every QR round-trips back to its input", () => {
  const cases = [
    "https://99jik.com",
    window.SITE_DATA.site.bookingUrl,
    window.SITE_DATA.site.cvKo,
    "짧은 한글",
    "x".repeat(120),
  ];
  for (const text of cases) {
    const grid = window.QR.encode(text);
    if (!grid) throw new Error(`encode returned nothing for ${text.length} bytes`);
    const back = qrDecode(grid);
    if (back.text !== text) {
      throw new Error(`round trip changed "${text.slice(0, 30)}" into "${String(back.text || back.error).slice(0, 30)}"`);
    }
  }
  return cases.length + " codes";
});

check("qrencode defaults to ASCII and can still emit SVG", () => {
  const def = (run("qrencode") || [])[0];
  if (def.kind !== "qr" || def.mode !== "ascii") throw new Error("qrencode no longer defaults to ASCII");
  const svg = (run("qrencode -t SVG") || [])[0];
  if (svg.kind !== "qr" || svg.mode !== "svg") throw new Error("-t SVG lost its form");
  // The ASCII grid must be two characters per module or the square-module fix breaks.
  const rows = window.QR.toAscii(def.grid, 2);
  if (rows[0].length !== (def.grid.length + 4) * 2) throw new Error("ASCII grid is not 2 chars per module");
  return true;
});

// The round-trip test reads only the first format copy, so it stayed green while the
// second copy was missing a bit. A reader that checks both detects the symbol and
// then refuses it, which is exactly the failure that showed up on a phone.
// Checked against the format strings published in the QR standard, not against our
// own reading of the matrix. The encoder and the decoder previously shared a mirrored
// placement, so every self-consistent test passed while no scanner could read it.
check("format information matches the published table", () => {
  const TABLE = {
    "101010000010010": "M0", "101000100100101": "M1",
    "101111001111100": "M2", "101101101001011": "M3",
    "100010111111001": "M4", "100000011001110": "M5",
    "100111110010111": "M6", "100101010100000": "M7",
    "111011111000100": "L0", "111001011110011": "L1",
    "111110110101010": "L2", "111100010011101": "L3",
  };
  // Bit i of the masked word lives at (i,8) going down column 8.
  const readWord = (g, size) => {
    let raw = 0;
    for (let i = 0; i < 15; i++) {
      const v = i < 6 ? g[i][8] : i < 8 ? g[i + 1][8] : g[size - 15 + i][8];
      raw |= (v ? 1 : 0) << i;
    }
    return raw.toString(2).padStart(15, "0");
  };
  for (const text of ["https://99jik.com", window.SITE_DATA.site.bookingUrl, "x".repeat(120)]) {
    const g = window.QR.encode(text);
    const word = readWord(g, g.length);
    if (!TABLE[word]) throw new Error(`format word ${word} is not one of the 32 valid strings`);
  }
  return true;
});

check("both QR format copies carry the same value", () => {
  // Both runs, read the way the standard lays them out.
  const readA = (g, size) => {
    let v = 0;
    for (let i = 0; i < 15; i++) {
      const b = i < 6 ? g[i][8] : i < 8 ? g[i + 1][8] : g[size - 15 + i][8];
      v |= (b ? 1 : 0) << i;
    }
    return v;
  };
  const readB = (g, size) => {
    let v = 0;
    for (let i = 0; i < 15; i++) {
      const b = i < 8 ? g[8][size - 1 - i] : i < 9 ? g[8][7] : g[8][14 - i];
      v |= (b ? 1 : 0) << i;
    }
    return v;
  };
  // A valid format word is a BCH(15,5) codeword once the 0x5412 mask is removed.
  const bchValid = (f) => {
    let rem = f ^ 0x5412;
    for (let i = 14; i >= 10; i--) if (rem & (1 << i)) rem ^= 0x537 << (i - 10);
    return rem === 0;
  };
  for (const text of ["https://99jik.com", window.SITE_DATA.site.bookingUrl, "x".repeat(120)]) {
    const g = window.QR.encode(text);
    const size = g.length;
    const a = readA(g, size), b = readB(g, size);
    if (a !== b) throw new Error(`format copies disagree: 0x${a.toString(16)} vs 0x${b.toString(16)}`);
    if (!bchValid(a)) throw new Error(`format word 0x${a.toString(16)} fails its BCH check`);
  }
  return true;
});

check("QR function patterns land where a scanner looks for them", () => {
  const g = window.QR.encode("https://99jik.com");
  if (!g) throw new Error("encode returned nothing");
  const size = g.length;
  const finder = (r0, c0) => {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const ring = (r === 0 || r === 6 || c === 0 || c === 6);
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (g[r0 + r][c0 + c] !== ((ring || core) ? 1 : 0)) return false;
    }
    return true;
  };
  if (!finder(0, 0) || !finder(0, size - 7) || !finder(size - 7, 0)) throw new Error("finder pattern is malformed");
  for (let i = 8; i < size - 8; i++) {
    if (g[6][i] !== (i % 2 === 0 ? 1 : 0)) throw new Error("horizontal timing pattern broken at " + i);
    if (g[i][6] !== (i % 2 === 0 ? 1 : 0)) throw new Error("vertical timing pattern broken at " + i);
  }
  if (g[size - 8][8] !== 1) throw new Error("the always-dark module is not dark");
  return size + "x" + size;
});

check("curl fetches same origin and refuses the rest", () => {
  const same = (run("curl /calendar.json") || []).find(b => b.kind === "fetch");
  if (!same) throw new Error("same-origin curl did not produce a real request");
  const cross = flat("curl https://example.com/x");
  if (!cross.includes("CORS")) throw new Error("cross-origin curl did not explain CORS");
  return true;
});

check("bc computes rather than evals", () => {
  const val = (e) => lines("bc " + e)[0].trim();
  if (val("2^10") !== "1024") throw new Error("2^10 gave " + val("2^10"));      // xor in JS
  if (val("(1+2)*3") !== "9") throw new Error("(1+2)*3 gave " + val("(1+2)*3"));
  if (!flat("bc 1/0").includes("divide by zero")) throw new Error("1/0 not caught");
  if (!flat("bc alert(1)").includes("syntax error")) throw new Error("bc accepted non-arithmetic input");
  return true;
});

check("neofetch reports the same disk figure as df", () => {
  const dfUsed = lines("df -h")[1].trim().split(/\s+/)[2];
  if (!flat("neofetch").includes(dfUsed)) throw new Error(`neofetch disagrees with df (${dfUsed})`);
  return dfUsed;
});

check("vi opens a real buffer", () => {
  const m = (run("vi ~/about") || []).find(b => b.kind === "mode" && b.action === "vi");
  if (!m) throw new Error("vi did not hand back an editor mode");
  const direct = window.FS.resolve("/home/jeongin/about").node.content;
  if (m.lines.length !== direct.length) throw new Error("vi buffer does not match the file");
  if (!flat("vi ~/projects").includes("Is a directory")) throw new Error("vi opened a directory");
  return m.lines.length + " lines";
});

check("awk and cut actually split fields", () => {
  const users = lines("cat /etc/passwd | cut -d: -f1").map(l => l.trim());
  if (!users.includes("jeongin")) throw new Error("cut -d: -f1 did not yield jeongin");
  const first = lines("env | awk -F= '{print $1}'").map(l => l.trim());
  if (!first.includes("USER")) throw new Error("awk -F= did not yield USER");
  return true;
});

check("output is text only", () => {
  // The terminal renders monospace text. kv tables and card grids were web widgets
  // and the renderers for them are gone, so emitting one now would render nothing.
  const RENDERABLE = new Set(["text", "link", "mode", "now", "weather", "chatmsg", "qr", "fetch", "live"]);
  for (const cmd of ["help", "about", "research", "projects", "publications",
                     "experience", "skills", "contact", "cv", "theme", "ls -al", "df"]) {
    for (const b of run(cmd) || []) {
      if (!RENDERABLE.has(b.kind)) throw new Error(`"${cmd}" emits an unrenderable block: ${b.kind}`);
    }
  }
  return true;
});

check("the banner hint names commands that exist", () => {
  // The login banner replaced the chip row as the discovery path.
  const cmds = window.TERMINAL.buildCommands("ko");
  for (const c of ["help", "about"]) {
    if (!cmds[c]) throw new Error(`banner points at missing command "${c}"`);
  }
  return true;
});

console.log(failed ? `\n${failed} failure(s)` : "\nall green");
process.exit(failed ? 1 : 0);
