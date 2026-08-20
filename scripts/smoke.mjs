#!/usr/bin/env node
// Smoke test for the command layer. No browser: stubs just enough DOM for the
// window-global modules to load, then runs every command in both languages and
// checks the invariants that have regressed before. Preact views are out of scope.
//
// Run: `npm run check`

import { readFileSync } from "node:fs";
import { fallbackHtml } from "./build.mjs";

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
globalThis.location = { hostname: "localhost" };
globalThis.matchMedia = () => ({ matches: false });
globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => {};
globalThis.performance = { now: () => 125000 };

// Load order mirrors the imports at the top of src/main.jsx.
for (const f of ["data.js", "themes.js", "prefs.js", "fs.js", "coreutils.js",
                 "calendar.js", "tools.js", "extras.js", "terminal-commands.js"]) {
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
  "help", "?", "about", "whoami", "research", "projects", "publications",
  "experience", "skills", "contact", "cv", "til", "chat", "clear",
  "theme", "theme phosphor", "theme nope", "lang ko", "lang en", "lang zz",
  "easy", "now", "now --week", "now --month", "weather", "weather seoul",
  "cat til", "cat nope", "cat", "definitely-not-a-command",
];
const SHELL = [
  "ls", "ls -a", "ls -al", "ls -alrt", "ls nope", "pwd", "cd projects", "cd ..",
  "cd ~", "cd nope", "tree", "tree -a", "find", "find /", "find -name *.md",
  "find / -name *.md", "find / -a -name *.md", "grep testing", "grep -i TESTING /",
  "grep -n oracle /", "grep -a secret /", "grep -v x /etc/hostname", "grep",
  "history", "history -c",
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
// about/whoami are deliberately bilingual; projects ships the raw record to the
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

check("tab completion only offers real commands", () => {
  const cmds = Object.keys(window.TERMINAL.buildCommands("ko"));
  for (const c of window.TERMINAL.complete("c", "ko")) {
    if (!cmds.includes(c)) throw new Error(`completion offered unknown command: ${c}`);
  }
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
