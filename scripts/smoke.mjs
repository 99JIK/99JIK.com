#!/usr/bin/env node
// Smoke test for the command layer. No browser: stubs just enough DOM for the
// window-global modules to load, then runs every command in both languages and
// checks the invariants that have regressed before. Preact views are out of scope.
//
// Run: `npm run check`

import { readFileSync } from "node:fs";
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
for (const f of ["data.js", "themes.js", "prefs.js", "fs.js", "coreutils.js",
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
  "stat ~/about", "stat nope", "stat", "file ~/cv.pdf", "file ~/projects", "file",
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
  "base64 ~/about", "xxd ~/about", "xxd", "diff ~/about ~/dreams.txt",
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
  if (flat("grep secret /").includes("secret_todo")) throw new Error("grep leaked .secret_todo");
  if (!flat("grep -a secret /").includes("secret_todo")) throw new Error("grep -a found nothing");
  if (flat("find / -name *.md").includes("notebook-")) throw new Error("find -name leaked .lab");
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
    ...D.publications.map(p => p.title),
    ...D.research.map(r => r.tag),
    D.site.cvKo, D.site.cvEn,
  ];
  for (const needle of must) {
    if (!html.includes(needle)) throw new Error(`fallback HTML is missing "${needle}"`);
  }
  if (html.length < 500) throw new Error(`fallback HTML is suspiciously short (${html.length} bytes)`);
  return `${html.length} bytes`;
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
    ["vi c", "vi contact"], ["head ~/ab", "head ~/about"], ["stat cv", "stat cv.pdf"],
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
  const d = flat("diff ~/about ~/dreams.txt");
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
  const RENDERABLE = new Set(["text", "link", "mode", "now", "weather", "chatmsg"]);
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
