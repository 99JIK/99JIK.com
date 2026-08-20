// Real utilities over the virtual filesystem. Everything here computes from the
// actual tree in fs.js instead of printing a canned answer, so `du`, `df` and
// `ls -l` all agree with each other.
//
// Shape: run(args, stdin, lang) -> blocks[]. `stdin` is an array of lines when the
// command sits downstream of a pipe, otherwise null. Tools that accept both read
// stdin when present and fall back to their file operands when not, same as the
// real ones.
(function () {
  // Column alignment for a monospace grid. CJK occupies two cells, so padEnd on
  // raw string length skews any table with Korean in it.
  function cells(str) {
    let w = 0;
    for (const ch of String(str)) {
      const c = ch.codePointAt(0);
      w += ((c >= 0xAC00 && c <= 0xD7A3) || (c >= 0x3131 && c <= 0x318E) ||
            (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3040 && c <= 0x30FF) ||
            (c >= 0xFF00 && c <= 0xFFEF) || (c >= 0x2E80 && c <= 0x303E)) ? 2 : 1;
    }
    return w;
  }
  const padEnd = (str, n) => String(str) + " ".repeat(Math.max(0, n - cells(str)));
  window.TEXT = { cells, padEnd };

  // Empty strings stay empty here. Turning "" into " " to give the div height would
  // corrupt the data the moment it flows through a pipe; the renderer substitutes a
  // space at display time instead.
  const T = (text, opts = {}) => ({ kind: "text", text, ...opts });
  const err = (text) => T(text, { warn: true });
  const FS = () => window.FS;

  // ── shared helpers ────────────────────────────────────────────────────────
  function parseArgs(args) {
    const flags = new Set();
    const opts = {};
    const rest = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if ((a === "-n" || a === "-c") && args[i + 1] !== undefined && /^\d+$/.test(args[i + 1])) {
        opts[a.slice(1)] = parseInt(args[++i], 10);
      } else if (/^-\d+$/.test(a)) {
        opts.n = parseInt(a.slice(1), 10);          // `head -5`
      } else if (a.startsWith("-") && a.length > 1) {
        for (const ch of a.slice(1)) flags.add(ch);
      } else rest.push(a);
    }
    return { flags, opts, rest };
  }

  function readFile(path) {
    const { node } = FS().resolve(path);
    if (!node) return { error: "No such file or directory" };
    if (node.type === "dir") return { error: "Is a directory" };
    return { lines: node.content || [] };
  }

  function walk(node, fn) {
    fn(node);
    if (node.type !== "dir") return;
    for (const child of Object.values(node.children)) walk(child, fn);
  }

  function bytesOf(node) {
    let total = 0;
    walk(node, n => { if (n.type !== "dir") total += n.size || 0; });
    return total;
  }

  function human(bytes) {
    if (bytes < 1024) return String(bytes);
    const units = ["K", "M", "G", "T"];
    let v = bytes / 1024, i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return (v >= 10 ? String(Math.round(v)) : v.toFixed(1)) + units[i];
  }

  // stdin wins over file operands, so `cat x | head` and `head x` both work.
  function inputs(rest, stdin, cmd) {
    if (stdin) return { sources: [{ label: null, lines: stdin }], errors: [] };
    if (!rest.length) return { usage: cmd + ": missing operand" };
    const sources = [], errors = [];
    for (const p of rest) {
      const r = readFile(p);
      if (r.error) errors.push(cmd + ": " + p + ": " + r.error);
      else sources.push({ label: p, lines: r.lines });
    }
    return { sources, errors };
  }

  // Multi-file output gets `==> name <==` headers, like head(1)/tail(1).
  function emit(res, render) {
    if (res.usage) return [err(res.usage)];
    const out = res.errors.map(err);
    const multi = res.sources.length > 1;
    res.sources.forEach((src, i) => {
      if (multi) {
        if (i) out.push(T(""));
        out.push(T("==> " + src.label + " <==", { dim: true }));
      }
      render(src, out);
    });
    return out;
  }

  const C = {};

  // ── text tools ────────────────────────────────────────────────────────────
  C.head = {
    usage: "head [-n N] [-c N] [file...]",
    hint: { ko: "앞부분 N줄 (기본 10)", en: "first N lines (default 10)" },
    run: (args, stdin) => {
      const { opts, rest } = parseArgs(args);
      const n = opts.n === undefined ? 10 : opts.n;
      if (opts.c !== undefined) return emit(inputs(rest, stdin, "head"),
        (src, out) => out.push(T(src.lines.join("\n").slice(0, opts.c))));
      return emit(inputs(rest, stdin, "head"),
        (src, out) => src.lines.slice(0, n).forEach(l => out.push(T(l))));
    },
  };

  C.tail = {
    usage: "tail [-n N] [-c N] [file...]",
    hint: { ko: "뒷부분 N줄 (기본 10)", en: "last N lines (default 10)" },
    run: (args, stdin) => {
      const { opts, rest } = parseArgs(args);
      const n = opts.n === undefined ? 10 : opts.n;
      if (opts.c !== undefined) return emit(inputs(rest, stdin, "tail"),
        (src, out) => out.push(T(src.lines.join("\n").slice(-opts.c))));
      return emit(inputs(rest, stdin, "tail"),
        (src, out) => src.lines.slice(-n).forEach(l => out.push(T(l))));
    },
  };

  C.wc = {
    usage: "wc [-l|-w|-c|-m] [file...]",
    hint: { ko: "줄/단어/바이트 세기", en: "count lines, words, bytes" },
    run: (args, stdin) => {
      const { flags, rest } = parseArgs(args);
      const only = flags.has("l") ? "l" : flags.has("w") ? "w"
                 : flags.has("c") ? "c" : flags.has("m") ? "m" : null;
      const res = inputs(rest, stdin, "wc");
      if (res.usage) return [err(res.usage)];
      const out = res.errors.map(err);
      const totals = { l: 0, w: 0, c: 0, m: 0 };
      for (const s of res.sources) {
        const l = s.lines.length;
        const w = s.lines.reduce((a, x) => {
          const t = String(x).trim();
          return a + (t ? t.split(/\s+/).length : 0);
        }, 0);
        const c = s.lines.reduce((a, x) => a + String(x).length + 1, 0);
        // -m counts characters, which differs from bytes the moment Hangul appears.
        const m = s.lines.reduce((a, x) => a + [...String(x)].length + 1, 0);
        totals.l += l; totals.w += w; totals.c += c; totals.m += m;
        const nums = only ? [{ l, w, c, m }[only]] : [l, w, c];
        out.push(T(nums.map(v => String(v).padStart(7)).join("") + (s.label ? " " + s.label : "")));
      }
      if (res.sources.length > 1) {
        const nums = only ? [totals[only]] : [totals.l, totals.w, totals.c];
        out.push(T(nums.map(v => String(v).padStart(7)).join("") + " total"));
      }
      return out;
    },
  };

  C.nl = {
    usage: "nl [file...]",
    hint: { ko: "줄 번호 붙이기", en: "number lines" },
    run: (args, stdin) => {
      const { rest } = parseArgs(args);
      let i = 0;
      return emit(inputs(rest, stdin, "nl"),
        (src, out) => src.lines.forEach(l => out.push(T(String(++i).padStart(6) + "\t" + l))));
    },
  };

  C.sort = {
    usage: "sort [-n] [-r] [-u] [file...]",
    hint: { ko: "줄 정렬 (-n 숫자, -r 역순, -u 중복 제거)", en: "sort lines (-n numeric, -r reverse, -u unique)" },
    run: (args, stdin) => {
      const { flags, rest } = parseArgs(args);
      const res = inputs(rest, stdin, "sort");
      if (res.usage) return [err(res.usage)];
      // -n compares by leading number, which is what makes `du | sort -n` useful.
      const num = (v) => { const m = String(v).trim().match(/^-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
      let lines = res.sources.flatMap(s => s.lines).map(String).sort((a, b) => {
        if (!flags.has("n")) return a.localeCompare(b);
        const x = num(a), y = num(b);
        if (Number.isNaN(x) && Number.isNaN(y)) return a.localeCompare(b);
        if (Number.isNaN(x)) return -1;
        if (Number.isNaN(y)) return 1;
        return x - y;
      });
      if (flags.has("u")) lines = [...new Set(lines)];
      if (flags.has("r")) lines.reverse();
      return res.errors.map(err).concat(lines.map(l => T(l)));
    },
  };

  C.uniq = {
    usage: "uniq [-c] [-d] [-u] [file...]",
    hint: { ko: "인접 중복 처리 (-c 개수, -d 중복만, -u 유일만)", en: "adjacent duplicates (-c count, -d only dups, -u only uniques)" },
    run: (args, stdin) => {
      const { flags, rest } = parseArgs(args);
      const res = inputs(rest, stdin, "uniq");
      if (res.usage) return [err(res.usage)];
      const out = res.errors.map(err);
      let prev = null, count = 0;
      const flush = () => {
        if (prev === null) return;
        if (flags.has("d") && count < 2) return;
        if (flags.has("u") && count > 1) return;
        out.push(T(flags.has("c") ? String(count).padStart(7) + " " + prev : (prev)));
      };
      for (const l of res.sources.flatMap(s => s.lines).map(String)) {
        if (l === prev) { count++; continue; }
        flush(); prev = l; count = 1;
      }
      flush();
      return out;
    },
  };

  // ── environment ───────────────────────────────────────────────────────────
  // export writes here and echo/env read it back, so the environment is a real
  // (if short-lived) thing rather than a fixed printout.
  const userEnv = {};

  function envMap() {
    return {
      USER: window.getPromptName ? window.getPromptName() : "anonymous",
      HOME: "/home/jeongin",
      PWD: FS().getCwd(),
      SHELL: "/bin/bash",
      TERM: "xterm-256color",
      LANG: (document.documentElement.lang === "en" ? "en_US" : "ko_KR") + ".UTF-8",
      HOSTNAME: window.SITE_DATA.site.handle,
      PATH: "/usr/local/bin:/usr/bin:/bin",
      ...userEnv,
    };
  }

  C.env = {
    usage: "env",
    hint: { ko: "환경 변수", en: "environment variables" },
    run: () => Object.entries(envMap()).map(([k, v]) => T(k + "=" + v)),
  };
  C.printenv = { hidden: true, usage: "printenv", hint: C.env.hint, run: C.env.run };

  C.echo = {
    usage: "echo [text...]",
    hint: { ko: "인자 출력 ($USER 등 확장)", en: "print arguments ($USER etc. expanded)" },
    run: (args) => {
      const env = envMap();
      const text = args.map(a => a.replace(/\$(\w+)/g, (m, k) => (k in env ? env[k] : m))).join(" ");
      return [T(text)];
    },
  };

  // ── inspection ────────────────────────────────────────────────────────────
  C.stat = {
    usage: "stat <path>",
    hint: { ko: "파일 메타데이터", en: "file metadata" },
    run: (args) => {
      if (!args.length) return [err("stat: missing operand")];
      const out = [];
      for (const a of args) {
        const { path, node } = FS().resolve(a);
        if (!node) { out.push(err("stat: cannot statx '" + a + "': No such file or directory")); continue; }
        const kind = node.type === "dir" ? "directory" : node.type === "link" ? "symbolic link" : "regular file";
        const mode = node.type === "dir" ? "drwxr-xr-x" : node.type === "link" ? "lrwxr-xr-x" : "-rw-r--r--";
        const size = node.type === "dir" ? Object.keys(node.children).length : (node.size || 0);
        if (out.length) out.push(T(""));
        out.push(T("  File: " + path + (node.type === "link" ? " -> " + node.target : "")));
        out.push(T("  Size: " + size + "\tType: " + kind));
        out.push(T("Access: (" + mode + ")  Uid: ( 1000/ jeongin)   Gid: ( 1000/  staff)"));
        out.push(T("Modify: " + new Date(node.mtime).toISOString().replace("T", " ").slice(0, 19) + " +0900"));
      }
      return out;
    },
  };

  C.file = {
    usage: "file <path>",
    hint: { ko: "파일 종류 추정", en: "guess file type" },
    run: (args) => {
      if (!args.length) return [err("file: missing operand")];
      return args.map(a => {
        const { node } = FS().resolve(a);
        if (!node) return err(a + ": cannot open (No such file or directory)");
        if (node.type === "dir") return T(a + ": directory");
        if (node.type === "link") return T(a + ": symbolic link to " + node.target);
        if (a.endsWith(".pdf")) return T(a + ": PDF document");
        if (a.endsWith(".json")) return T(a + ": JSON text data");
        if (a.endsWith(".md")) return T(a + ": Markdown document, UTF-8 text");
        if ((node.size || 0) === 0) return T(a + ": empty");
        return T(a + ": ASCII text");
      });
    },
  };

  C.du = {
    usage: "du [-s] [-h] [path]",
    hint: { ko: "디스크 사용량 (-s 합계, -h 읽기 좋게)", en: "disk usage (-s summary, -h human)" },
    run: (args) => {
      const { flags, rest } = parseArgs(args);
      const target = rest[0] || FS().getCwd();
      const { path, node } = FS().resolve(target);
      if (!node) return [err("du: cannot access '" + target + "': No such file or directory")];
      const fmt = v => (flags.has("h") ? human(v) : String(Math.ceil(v / 1024)));
      if (flags.has("s") || node.type !== "dir") {
        return [T(fmt(bytesOf(node)).padEnd(8) + path)];
      }
      const rows = [];
      const collect = (n, p) => {
        if (n.type !== "dir") return;
        for (const [name, child] of Object.entries(n.children)) {
          collect(child, p === "/" ? "/" + name : p + "/" + name);
        }
        rows.push(T(fmt(bytesOf(n)).padEnd(8) + p));
      };
      collect(node, path);
      return rows;
    },
  };

  // Capacity is the single invented number; used/available are summed from the
  // tree, so df never contradicts du.
  const CAPACITY = 1024 * 1024;
  C.df = {
    usage: "df [-h]",
    hint: { ko: "파일시스템 사용량", en: "filesystem usage" },
    run: (args) => {
      const { flags } = parseArgs(args);
      const used = bytesOf(FS().root());
      const avail = Math.max(0, CAPACITY - used);
      const pct = Math.round((used / CAPACITY) * 100);
      const h = flags.has("h");
      const f = v => (h ? human(v) : String(Math.ceil(v / 1024)));
      // Header and row share one column spec so they can't drift apart.
      const col = h ? 7 : 11;
      const row = (fs, size, u, av, use, mount) =>
        fs.padEnd(14) + size.padStart(col) + u.padStart(col) +
        av.padStart(col) + use.padStart(6) + "  " + mount;
      return [
        T(row("Filesystem", h ? "Size" : "1K-blocks", "Used", "Avail", "Use%", "Mounted on")),
        T(row("jikfs", f(CAPACITY), f(used), f(avail), pct + "%", "/")),
        T("(mounted read-only)", { dim: true }),
      ];
    },
  };

  // The only real memory figure a page can get. Chromium-only, and it says so
  // rather than inventing a total.
  C.free = {
    usage: "free [-h]",
    hint: { ko: "JS 힙 사용량 (Chromium 계열만)", en: "JS heap usage (Chromium only)" },
    run: (args) => {
      const { flags } = parseArgs(args);
      const m = typeof performance !== "undefined" && performance.memory;
      if (!m) return [
        T("free: /proc/meminfo is not exposed to this sandbox."),
        T("(only Chromium-based engines report JS heap size to the page)", { dim: true }),
      ];
      const f = v => (flags.has("h") ? human(v) : String(Math.ceil(v / 1024)));
      const total = m.jsHeapSizeLimit, used = m.usedJSHeapSize;
      return [
        T("".padEnd(10) + "total".padStart(10) + "used".padStart(10) + "free".padStart(10)),
        T("JS heap:".padEnd(10) + f(total).padStart(10) + f(used).padStart(10) + f(total - used).padStart(10)),
        T("(this tab's V8 heap, not system memory)", { dim: true }),
      ];
    },
  };

  C.which = {
    usage: "which <command>",
    hint: { ko: "명령의 경로", en: "locate a command" },
    run: (args) => {
      if (!args.length) return [err("which: missing operand")];
      const table = window.TERMINAL ? window.TERMINAL.buildCommands("en") : {};
      return args.map(a => (table[a]
        ? T("/usr/bin/" + a)
        : err("which: no " + a + " in (/usr/local/bin:/usr/bin:/bin)")));
    },
  };

  C.man = {
    usage: "man <command>",
    hint: { ko: "명령 매뉴얼", en: "command manual" },
    run: (args, stdin, lang) => {
      if (!args.length) return [err("What manual page do you want?")];
      const name = args[0];
      const table = window.TERMINAL ? window.TERMINAL.buildCommands(lang || "ko") : {};
      const cmd = table[name];
      if (!cmd) return [err("No manual entry for " + name)];
      const head = name.toUpperCase() + "(1)";
      return [
        T(head + " ".repeat(Math.max(2, 36 - head.length)) + "User Commands", { dim: true }),
        T(""),
        T("NAME", { strong: true }),
        T("    " + name + " - " + cmd.hint),
        T(""),
        T("SYNOPSIS", { strong: true }),
        T("    " + (cmd.usage || name)),
      ];
    },
  };

  C.ps = {
    usage: "ps",
    hint: { ko: "프로세스 목록", en: "process list" },
    run: () => {
      const up = Math.floor(performance.now() / 1000);
      const mmss = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      return [
        T("  PID TTY          TIME CMD"),
        T("    1 ?        00:" + mmss(0) + " init"),
        T("   42 tty1     00:" + mmss(up) + " zsh"),
        T("   57 tty1     00:" + mmss(0) + " ps"),
      ];
    },
  };

  // ── write attempts ────────────────────────────────────────────────────────
  // The tree really is immutable, so these return what Linux returns for EROFS
  // rather than a punchline.
  const EROFS = "Read-only file system";
  function readOnly(cmd, fmt) {
    return (args) => {
      const target = (args || []).find(a => !a.startsWith("-"));
      if (!target) return [err(cmd + ": missing operand")];
      // GNU rm checks --preserve-root before it touches the filesystem, so this
      // wins over EROFS.
      if (cmd === "rm" && (target === "/" || target === "/*")) return [
        err("rm: it is dangerous to operate recursively on '/'"),
        err("rm: use --no-preserve-root to override this failsafe"),
      ];
      return [
        err(fmt.replace("%s", target)),
        T("(this filesystem is mounted read-only)", { dim: true }),
      ];
    };
  }
  const RO = [
    ["mkdir", "mkdir <dir>",  { ko: "디렉토리 생성", en: "create directory" }, "mkdir: cannot create directory '%s': " + EROFS, false],
    ["touch", "touch <file>", { ko: "빈 파일 생성", en: "create empty file" }, "touch: cannot touch '%s': " + EROFS, false],
    ["rm",    "rm <file>",    { ko: "파일 삭제", en: "remove file" },          "rm: cannot remove '%s': " + EROFS, false],
    ["rmdir", "rmdir <dir>",  { ko: "디렉토리 삭제", en: "remove directory" }, "rmdir: failed to remove '%s': " + EROFS, true],
    ["cp",    "cp <src> <dst>", { ko: "복사", en: "copy" },                    "cp: cannot create regular file '%s': " + EROFS, false],
    ["mv",    "mv <src> <dst>", { ko: "이동 / 이름 변경", en: "move or rename" }, "mv: cannot move '%s': " + EROFS, false],
    ["ln",    "ln -s <target> <name>", { ko: "링크 생성", en: "create link" }, "ln: failed to create symbolic link '%s': " + EROFS, true],
    ["chmod", "chmod <mode> <file>", { ko: "권한 변경", en: "change permissions" }, "chmod: changing permissions of '%s': " + EROFS, true],
    ["chown", "chown <owner> <file>", { ko: "소유자 변경", en: "change owner" }, "chown: changing ownership of '%s': " + EROFS, true],
  ];
  for (const [name, usage, hint, fmt, hidden] of RO) {
    C[name] = { usage, hint, hidden, run: readOnly(name, fmt) };
  }

  // ── networking ────────────────────────────────────────────────────────────
  // A page has no raw sockets and no resolver of its own. These are the errors
  // those tools actually give when the capability is missing.
  C.ping = {
    hidden: true, usage: "ping <host>", hint: { ko: "ICMP (권한 없음)", en: "ICMP (not permitted)" },
    run: () => [
      err("ping: socket: Operation not permitted"),
      T("(raw sockets need CAP_NET_RAW; a browser tab has no such capability)", { dim: true }),
    ],
  };
  C.ssh = {
    hidden: true, usage: "ssh <host>", hint: { ko: "SSH (연결 불가)", en: "SSH (unreachable)" },
    run: (args) => [
      err("ssh: connect to host " + (args[0] || "host") + " port 22: Network is unreachable"),
      T("(try `chat` instead)", { dim: true }),
    ],
  };
  C.curl = {
    usage: "curl [-I] <url|path>",
    hint: { ko: "HTTP 요청 (같은 출처는 실제로 감)", en: "HTTP request (same origin actually works)" },
    run: (args) => {
      const rest = (args || []).filter(a => !a.startsWith("-"));
      const head = (args || []).some(a => /^-[a-zA-Z]*I/.test(a));
      const target = rest[0];
      if (!target) return [err("curl: try 'curl <url>'")];
      let url;
      try { url = new URL(target, location.href); }
      catch { return [err("curl: (3) URL using bad/illegal format or missing URL")]; }
      // Same origin is genuinely reachable, so go and fetch it. Everything else is
      // blocked by CORS, and saying which is more useful than refusing everything.
      if (url.origin !== location.origin) {
        return [
          err("curl: (6) Could not resolve host: " + url.hostname),
          T("(cross-origin is blocked by CORS; same-origin paths work, e.g. `curl /calendar.json`)", { dim: true }),
        ];
      }
      return [{ kind: "fetch", url: url.href, head }];
    },
  };

  C.wget = { hidden: true, usage: "wget <url|path>", hint: C.curl.hint, run: C.curl.run };
  C.ifconfig = {
    hidden: true, usage: "ifconfig", hint: { ko: "네트워크 인터페이스", en: "network interfaces" },
    run: () => [
      T("lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536"),
      T("        inet 127.0.0.1  netmask 255.0.0.0"),
      T(""),
      T("(no other interface is visible from inside a browser sandbox)", { dim: true }),
    ],
  };
  C.netstat = {
    hidden: true, usage: "netstat", hint: { ko: "소켓 목록", en: "socket list" },
    run: () => [
      T("Active Internet connections (w/o servers)"),
      T("Proto Recv-Q Send-Q Local Address     Foreign Address   State"),
      T("(none: the page cannot enumerate sockets)", { dim: true }),
    ],
  };

  // ── time and identity ─────────────────────────────────────────────────────
  C.date = {
    usage: "date [+FORMAT]",
    hint: { ko: "현재 시각 (date +%Y-%m-%d)", en: "current time (date +%Y-%m-%d)" },
    run: (args) => {
      const d = new Date();
      const spec = (args || []).find(a => a.startsWith("+"));
      if (!spec) return [T(d.toString()), T("unix: " + Math.floor(d.getTime() / 1000), { dim: true })];
      const p2 = (v) => String(v).padStart(2, "0");
      const map = {
        Y: d.getFullYear(), m: p2(d.getMonth() + 1), d: p2(d.getDate()),
        H: p2(d.getHours()), M: p2(d.getMinutes()), S: p2(d.getSeconds()),
        s: Math.floor(d.getTime() / 1000),
        F: d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()),
        T: p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()),
        A: d.toLocaleDateString("en-GB", { weekday: "long" }),
        B: d.toLocaleDateString("en-GB", { month: "long" }),
        Z: "KST", "%": "%",
      };
      return [T(spec.slice(1).replace(/%(.)/g, (m, k) => (k in map ? String(map[k]) : m)))];
    },
  };

  C.uptime = {
    usage: "uptime",
    hint: { ko: "세션 유지 시간", en: "how long this session has run" },
    run: () => {
      // performance.now() is time since the document started, which is exactly
      // how long this "machine" has been up.
      const secs = Math.floor(performance.now() / 1000);
      const hh = Math.floor(secs / 3600), mm = Math.floor((secs % 3600) / 60);
      const clock = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour12: false });
      return [T(" " + clock + "  up " + hh + ":" + String(mm).padStart(2, "0") + ",  1 user")];
    },
  };

  C.uname = {
    usage: "uname [-asrmn]",
    hint: { ko: "시스템 정보", en: "system information" },
    run: (args) => {
      // Kept consistent with /etc/os-release so the two never drift.
      const rel = FS().resolve("/etc/os-release").node;
      const line = k => {
        const hit = (rel && rel.content || []).find(l => l.startsWith(k + "="));
        return hit ? hit.slice(k.length + 1).replace(/^"|"$/g, "") : "";
      };
      const sys = line("NAME") || "JIKOS";
      const ver = line("VERSION_ID") || "1.0";
      const host = window.SITE_DATA.site.handle;
      const flags = new Set(args.join("").replace(/-/g, ""));
      if (flags.has("a")) return [T([sys, host, ver, "#1 SMP", "wasm32", "GNU/Linux"].join(" "))];
      const parts = [];
      if (flags.has("s") || !flags.size) parts.push(sys);
      if (flags.has("n")) parts.push(host);
      if (flags.has("r")) parts.push(ver);
      if (flags.has("m")) parts.push("wasm32");
      return [T(parts.join(" ") || sys)];
    },
  };

  C.yes = {
    hidden: true,
    usage: "yes [string]",
    hint: { ko: "같은 줄 반복 출력", en: "repeat a line" },
    run: (args) => {
      // Real yes(1) never stops. Ours prints a screenful, which is the useful
      // part of the behaviour without hanging the tab.
      const what = args.join(" ") || "y";
      return Array.from({ length: 12 }, () => T(what));
    },
  };

  // ── privileged operations ─────────────────────────────────────────────────
  // Nothing here is root, so these are the EPERM paths, not jokes.
  C.kill = {
    hidden: true, usage: "kill [-SIG] <pid>", hint: { ko: "시그널 전송", en: "send a signal" },
    run: (args) => {
      const pid = args.find(a => /^\d+$/.test(a));
      if (!pid) return [err("kill: usage: kill [-s sigspec] pid")];
      if (pid === "1") return [
        err("kill: (1) - Operation not permitted"),
        T("(PID 1 is init; only the kernel reaps it)", { dim: true }),
      ];
      if (pid === "42") return [err("kill: (42) - Operation not permitted"), T("(that is this shell)", { dim: true })];
      return [err("kill: (" + pid + ") - No such process")];
    },
  };

  C.shutdown = {
    hidden: true, usage: "shutdown", hint: { ko: "시스템 종료 (권한 없음)", en: "power off (not permitted)" },
    run: () => [
      err("shutdown: Operation not permitted"),
      T("(needs root; closing the tab has the same effect)", { dim: true }),
    ],
  };
  C.poweroff = { hidden: true, usage: "poweroff", hint: C.shutdown.hint, run: C.shutdown.run };
  C.halt = { hidden: true, usage: "halt", hint: C.shutdown.hint, run: C.shutdown.run };

  C.dd = {
    hidden: true, usage: "dd if=<src> of=<dst>", hint: { ko: "블록 복사", en: "block-level copy" },
    run: (args) => {
      const of = (args.find(a => a.startsWith("of=")) || "").slice(3);
      if (of.startsWith("/dev/")) return [err("dd: failed to open '" + of + "': Permission denied")];
      return [err("dd: failed to open '" + (of || "operand") + "': " + EROFS)];
    },
  };

  C.fsck = {
    hidden: true, usage: "fsck", hint: { ko: "파일시스템 검사", en: "check the filesystem" },
    run: () => {
      const files = [];
      walk(FS().root(), n => { if (n.type !== "dir") files.push(n); });
      return [
        T("fsck from util-linux 2.39"),
        T("jikfs: clean, " + files.length + " files, " + Math.ceil(bytesOf(FS().root()) / 1024) + "/" + (CAPACITY / 1024) + " blocks"),
      ];
    },
  };

  // ── field and character tools ──────────────────────────────────────────────
  // These exist so pipes have something to compose with: `cut`, `tr` and `rev`
  // are what make `ls -al | cut -c1-10` or `env | cut -d= -f1` work.
  function ranges(spec) {
    // "1,3-5" -> [1,3,4,5], 1-based, in the order given
    const out = [];
    for (const part of String(spec).split(",")) {
      const m = part.match(/^(\d+)?-(\d+)?$/);
      if (m) {
        const a = m[1] ? +m[1] : 1;
        const b = m[2] ? +m[2] : 9999;
        for (let i = a; i <= b; i++) out.push(i);
      } else if (/^\d+$/.test(part)) out.push(+part);
    }
    return out;
  }

  C.cut = {
    usage: "cut -d<char> -f<list> | -c<list> [file...]",
    hint: { ko: "열 잘라내기 (cut -d= -f1)", en: "select columns (cut -d= -f1)" },
    run: (args, stdin) => {
      let delim = "\t", fields = null, chars = null;
      const rest = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith("-d")) delim = a.length > 2 ? a.slice(2) : (args[++i] || "\t");
        else if (a.startsWith("-f")) fields = a.length > 2 ? a.slice(2) : (args[++i] || "1");
        else if (a.startsWith("-c")) chars = a.length > 2 ? a.slice(2) : (args[++i] || "1");
        else rest.push(a);
      }
      if (!fields && !chars) return [err("cut: you must specify a list of bytes, characters, or fields")];
      const pick = ranges(fields || chars);
      return emit(inputs(rest, stdin, "cut"), (src, out) => src.lines.forEach(l => {
        const s = String(l);
        if (chars) return out.push(T(pick.map(i => s[i - 1] || "").join("")));
        // cut passes lines without the delimiter through untouched, same as GNU cut
        if (!s.includes(delim)) return out.push(T(s));
        const parts = s.split(delim);
        out.push(T(pick.map(i => parts[i - 1]).filter(v => v !== undefined).join(delim)));
      }));
    },
  };

  function expandSet(s) {
    const out = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i + 1] === "-" && s[i + 2]) {
        for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) out.push(String.fromCharCode(c));
        i += 2;
      } else out.push(s[i]);
    }
    return out;
  }

  C.tr = {
    usage: "tr [-d] SET1 [SET2]",
    hint: { ko: "문자 치환/삭제 (tr a-z A-Z)", en: "translate or delete characters" },
    run: (args, stdin) => {
      const { flags, rest } = parseArgs(args);
      if (!rest.length) return [err("tr: missing operand")];
      if (!stdin) return [err("tr: reads from standard input; use it after a pipe")];
      const from = expandSet(rest[0]);
      const to = expandSet(rest[1] || "");
      const map = new Map();
      // Short SET2 repeats its last character, which is what tr does.
      from.forEach((c, i) => map.set(c, to.length ? (to[i] ?? to[to.length - 1]) : ""));
      return stdin.map(l => T([...String(l)].map(ch =>
        flags.has("d") ? (map.has(ch) ? "" : ch) : (map.has(ch) ? map.get(ch) : ch)).join("")));
    },
  };

  C.rev = {
    usage: "rev [file...]",
    hint: { ko: "각 줄을 뒤집기", en: "reverse each line" },
    run: (args, stdin) => emit(inputs(args, stdin, "rev"),
      (src, out) => src.lines.forEach(l => out.push(T([...String(l)].reverse().join(""))))),
  };

  C.tac = {
    usage: "tac [file...]",
    hint: { ko: "줄 순서를 뒤집기", en: "reverse the order of lines" },
    run: (args, stdin) => emit(inputs(args, stdin, "tac"),
      (src, out) => src.lines.slice().reverse().forEach(l => out.push(T(l)))),
  };

  C.seq = {
    usage: "seq [first [incr]] last",
    hint: { ko: "수열 출력", en: "print a sequence of numbers" },
    run: (args) => {
      const n = args.map(Number).filter(v => !Number.isNaN(v));
      if (!n.length) return [err("seq: missing operand")];
      const [first, incr, last] = n.length === 1 ? [1, 1, n[0]]
                                : n.length === 2 ? [n[0], 1, n[1]]
                                : [n[0], n[1], n[2]];
      if (!incr || (last - first) / incr < 0) return [];
      const out = [];
      for (let v = first; incr > 0 ? v <= last : v >= last; v += incr) {
        out.push(T(String(Number(v.toFixed(10)))));
        if (out.length > 1000) { out.push(T("(truncated at 1000)", { dim: true })); break; }
      }
      return out;
    },
  };

  C.tee = {
    usage: "tee <file>",
    hint: { ko: "통과시키며 파일에도 쓰기 (쓰기는 실패)", en: "pass through and also write (the write fails)" },
    run: (args, stdin) => {
      const target = (args || []).find(a => !a.startsWith("-"));
      const out = (stdin || []).map(l => T(l));
      // Real tee reports the open failure on stderr and keeps streaming stdout.
      if (target) out.unshift(err("tee: " + target + ": " + EROFS));
      return out.length ? out : [err("tee: missing operand")];
    },
  };

  // ── paths ─────────────────────────────────────────────────────────────────
  C.basename = {
    usage: "basename <path> [suffix]",
    hint: { ko: "경로의 마지막 요소", en: "strip directory from a path" },
    run: (args) => {
      if (!args.length) return [err("basename: missing operand")];
      let b = args[0].replace(/\/+$/, "").split("/").pop() || "/";
      if (args[1] && b.endsWith(args[1]) && b !== args[1]) b = b.slice(0, -args[1].length);
      return [T(b)];
    },
  };

  C.dirname = {
    usage: "dirname <path>",
    hint: { ko: "경로의 디렉토리 부분", en: "strip the last component from a path" },
    run: (args) => {
      if (!args.length) return [err("dirname: missing operand")];
      const p = args[0].replace(/\/+$/, "");
      const i = p.lastIndexOf("/");
      return [T(i > 0 ? p.slice(0, i) : i === 0 ? "/" : ".")];
    },
  };

  C.realpath = {
    usage: "realpath <path>",
    hint: { ko: "절대 경로로 해석 (링크 따라감)", en: "resolve to an absolute path, following links" },
    run: (args) => {
      if (!args.length) return [err("realpath: missing operand")];
      return args.map(a => {
        const { path, node } = FS().resolve(a);
        if (!node) return err("realpath: " + a + ": No such file or directory");
        return T(node.type === "link" ? node.target : path);
      });
    },
  };

  C.readlink = {
    usage: "readlink <path>",
    hint: { ko: "심볼릭 링크의 대상", en: "print a symlink target" },
    run: (args) => {
      if (!args.length) return [err("readlink: missing operand")];
      return args.map(a => {
        const { node } = FS().resolve(a);
        if (!node) return err("readlink: " + a + ": No such file or directory");
        if (node.type !== "link") return err("readlink: " + a + ": Invalid argument");
        return T(node.target);
      });
    },
  };

  // ── identity and mounts ───────────────────────────────────────────────────
  C.id = {
    usage: "id",
    hint: { ko: "사용자 / 그룹 ID", en: "user and group ids" },
    run: () => {
      const u = window.getPromptName ? window.getPromptName() : "anonymous";
      // Anyone who is not in /etc/passwd is a guest account, hence the high uid.
      const known = { jeongin: 1000, stlab: 1001, memo: 1002, root: 0 };
      const uid = known[u] ?? 1000;
      return [T(`uid=${uid}(${u}) gid=${uid}(${u}) groups=${uid}(${u}),100(users)`)];
    },
  };

  C.hostname = {
    usage: "hostname",
    hint: { ko: "호스트 이름", en: "print the hostname" },
    run: () => {
      const n = FS().resolve("/etc/hostname").node;
      return [T((n && n.content && n.content[0]) || window.SITE_DATA.site.handle)];
    },
  };

  C.type = {
    usage: "type <command>",
    hint: { ko: "명령의 종류", en: "how a command would be interpreted" },
    run: (args, stdin, lang) => {
      if (!args.length) return [err("type: usage: type name [name ...]")];
      const table = window.TERMINAL ? window.TERMINAL.buildCommands(lang || "ko") : {};
      return args.map(a => table[a]
        ? T(`${a} is /usr/bin/${a}`)
        : err(`bash: type: ${a}: not found`));
    },
  };

  C.mount = {
    usage: "mount",
    hint: { ko: "마운트된 파일시스템", en: "mounted filesystems" },
    run: () => [
      T("jikfs on / type jikfs (ro,relatime)"),
      T("none on /proc type proc (ro,nosuid,nodev,noexec)"),
      T("(ro: the whole tree is immutable, which is why writes return EROFS)", { dim: true }),
    ],
  };

  // ── encoding and inspection ───────────────────────────────────────────────
  C.base64 = {
    usage: "base64 [-d] [file...]",
    hint: { ko: "base64 인코딩 / 디코딩", en: "base64 encode or decode" },
    run: (args, stdin) => {
      const { flags, rest } = parseArgs(args);
      const res = inputs(rest, stdin, "base64");
      if (res.usage) return [err(res.usage)];
      const text = res.sources.flatMap(s => s.lines).join("\n");
      try {
        if (flags.has("d")) {
          const bin = atob(text.replace(/\s+/g, ""));
          const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
          return new TextDecoder().decode(bytes).split("\n").map(l => T(l));
        }
        // btoa is byte-oriented, so UTF-8 has to be encoded first or Hangul throws.
        const bin = String.fromCharCode(...new TextEncoder().encode(text));
        const b64 = btoa(bin);
        // Real base64 wraps at 76 columns.
        return (b64.match(/.{1,76}/g) || [""]).map(l => T(l));
      } catch (e) {
        return [err("base64: invalid input")];
      }
    },
  };

  C.xxd = {
    usage: "xxd [file]",
    hint: { ko: "16진 덤프", en: "hex dump" },
    run: (args, stdin) => {
      const res = inputs(args, stdin, "xxd");
      if (res.usage) return [err(res.usage)];
      const bytes = new TextEncoder().encode(res.sources.flatMap(s => s.lines).join("\n"));
      const out = [];
      for (let i = 0; i < bytes.length && i < 4096; i += 16) {
        const row = bytes.slice(i, i + 16);
        const hex = [];
        for (let j = 0; j < 16; j += 2) {
          const a = row[j], b = row[j + 1];
          hex.push((a === undefined ? "  " : a.toString(16).padStart(2, "0")) +
                   (b === undefined ? "  " : b.toString(16).padStart(2, "0")));
        }
        const ascii = [...row].map(v => (v >= 32 && v < 127) ? String.fromCharCode(v) : ".").join("");
        out.push(T(i.toString(16).padStart(8, "0") + ": " + hex.join(" ").padEnd(40) + " " + ascii));
      }
      if (bytes.length > 4096) out.push(T("(truncated at 4096 bytes)", { dim: true }));
      return out;
    },
  };

  // diff(1) normal format, off a plain longest-common-subsequence table. Small
  // files only, which is all this tree has.
  C.diff = {
    usage: "diff <file1> <file2>",
    hint: { ko: "두 파일 비교", en: "compare two files" },
    run: (args) => {
      const { rest } = parseArgs(args);
      if (rest.length < 2) return [err("diff: missing operand")];
      const read = (p) => { const r = readFile(p); return r.error ? null : r.lines.map(String); };
      const a = read(rest[0]), b = read(rest[1]);
      if (!a) return [err("diff: " + rest[0] + ": No such file or directory")];
      if (!b) return [err("diff: " + rest[1] + ": No such file or directory")];

      const m = a.length, n = b.length;
      const lcs = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = m - 1; i >= 0; i--)
        for (let j = n - 1; j >= 0; j--)
          lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

      const hunks = [];
      let i = 0, j = 0;
      while (i < m || j < n) {
        if (i < m && j < n && a[i] === b[j]) { i++; j++; continue; }
        const si = i, sj = j;
        const del = [], add = [];
        while (i < m && (j >= n || lcs[i + 1][j] >= lcs[i][j + 1])) { del.push(a[i]); i++; if (i < m && j < n && a[i] === b[j]) break; }
        while (j < n && (i >= m || lcs[i][j + 1] > lcs[i + 1][j])) { add.push(b[j]); j++; if (i < m && j < n && a[i] === b[j]) break; }
        if (!del.length && !add.length) { i++; j++; continue; }
        hunks.push({ si, sj, del, add });
      }
      if (!hunks.length) return [];

      const range = (start, len) => len === 1 ? String(start + 1) : `${start + 1},${start + len}`;
      const out = [];
      for (const h of hunks) {
        const op = h.del.length && h.add.length ? "c" : h.del.length ? "d" : "a";
        out.push(T(`${range(h.si, h.del.length || 1)}${op}${range(h.sj, h.add.length || 1)}`, { strong: true }));
        h.del.forEach(l => out.push(T("< " + l, { warn: true })));
        if (op === "c") out.push(T("---", { dim: true }));
        h.add.forEach(l => out.push(T("> " + l)));
      }
      return out;
    },
  };

  // ── trivia the shell is expected to know ──────────────────────────────────
  C.nproc = {
    usage: "nproc",
    hint: { ko: "논리 코어 수", en: "number of processing units" },
    // navigator.hardwareConcurrency is the real figure the browser exposes.
    run: () => [T(String((typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 1))],
  };
  C.arch = {
    hidden: true, usage: "arch", hint: { ko: "아키텍처", en: "machine architecture" },
    run: () => [T("wasm32")],
  };
  C.tty = {
    hidden: true, usage: "tty", hint: { ko: "터미널 장치", en: "terminal device" },
    run: () => [T("/dev/tty1")],
  };
  C.groups = {
    hidden: true, usage: "groups", hint: { ko: "소속 그룹", en: "group memberships" },
    run: () => {
      const u = window.getPromptName ? window.getPromptName() : "anonymous";
      return [T(u + " users")];
    },
  };
  // The real thing: one line, the effective user. The site introduction that used to
  // live here is `about`, which is where a visitor looking for it will end up anyway.
  C.whoami = {
    usage: "whoami",
    hint: { ko: "현재 사용자", en: "print the current user" },
    run: () => [T(window.getPromptName ? window.getPromptName() : "anonymous")],
  };
  C.logname = {
    hidden: true, usage: "logname", hint: { ko: "로그인 이름", en: "login name" },
    run: C.whoami.run,
  };

  C.export = {
    usage: "export NAME=value",
    hint: { ko: "환경변수 설정", en: "set an environment variable" },
    run: (args) => {
      if (!args.length) return Object.entries(envMap()).map(([k, v]) => T('declare -x ' + k + '="' + v + '"'));
      const out = [];
      for (const a of args) {
        const m = String(a).match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!m) { out.push(err("export: `" + a + "': not a valid identifier")); continue; }
        userEnv[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
      return out;
    },
  };

  C.unset = {
    hidden: true, usage: "unset NAME",
    hint: { ko: "환경변수 해제", en: "unset an environment variable" },
    run: (args) => {
      for (const a of args) delete userEnv[a];
      return [];
    },
  };

  C.set = {
    hidden: true, usage: "set",
    hint: { ko: "셸 변수 목록", en: "list shell variables" },
    run: () => Object.entries(envMap()).map(([k, v]) => T(k + "=" + v)),
  };

  C.true = {
    hidden: true, usage: "true", hint: { ko: "성공 종료", en: "exit successfully" },
    run: () => [],
  };
  C.false = {
    hidden: true, usage: "false", hint: { ko: "실패 종료", en: "exit with failure" },
    // The only way to signal non-zero from here is a warn block, which is what
    // sets $? to 1 in terminal-view.
    run: () => [T("", { warn: true })],
  };

  C.shuf = {
    usage: "shuf [-n N] [file...]",
    hint: { ko: "무작위 순서로", en: "shuffle lines" },
    run: (args, stdin) => {
      const { opts, rest } = parseArgs(args);
      const res = inputs(rest, stdin, "shuf");
      if (res.usage) return [err(res.usage)];
      const lines = res.sources.flatMap(s => s.lines).map(String);
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      return (opts.n === undefined ? lines : lines.slice(0, opts.n)).map(l => T(l));
    },
  };

  C.factor = {
    hidden: true, usage: "factor <number>",
    hint: { ko: "소인수분해", en: "factor a number" },
    run: (args) => args.map(a => {
      let n = parseInt(a, 10);
      if (!Number.isFinite(n) || n < 1) return err("factor: `" + a + "' is not a valid positive integer");
      const parts = [];
      for (let d = 2; d * d <= n; d++) while (n % d === 0) { parts.push(d); n /= d; }
      if (n > 1) parts.push(n);
      return T(a + ": " + parts.join(" "));
    }),
  };

  C.uuidgen = {
    hidden: true, usage: "uuidgen", hint: { ko: "UUID 생성", en: "generate a UUID" },
    run: () => {
      try { return [T(crypto.randomUUID())]; }
      catch { return [err("uuidgen: no secure random source")]; }
    },
  };

  C.fold = {
    hidden: true, usage: "fold [-w N] [file...]",
    hint: { ko: "지정 폭에서 접기", en: "wrap lines at a width" },
    run: (args, stdin) => {
      const { opts, rest } = parseArgs(args);
      const w = opts.w || 80;
      const res = inputs(rest, stdin, "fold");
      if (res.usage) return [err(res.usage)];
      const out = res.errors.map(err);
      for (const src of res.sources) {
        for (const l of src.lines) {
          const s2 = String(l);
          if (!s2.length) { out.push(T("")); continue; }
          for (let i = 0; i < s2.length; i += w) out.push(T(s2.slice(i, i + w)));
        }
      }
      return out;
    },
  };

  C.paste = {
    hidden: true, usage: "paste <file1> <file2>",
    hint: { ko: "두 파일을 나란히", en: "merge files side by side" },
    run: (args, stdin) => {
      const { rest } = parseArgs(args);
      if (rest.length < 2) return [err("paste: needs two files")];
      const a = readFile(rest[0]), b = readFile(rest[1]);
      if (a.error) return [err("paste: " + rest[0] + ": " + a.error)];
      if (b.error) return [err("paste: " + rest[1] + ": " + b.error)];
      const n = Math.max(a.lines.length, b.lines.length);
      const out = [];
      for (let i = 0; i < n; i++) out.push(T((a.lines[i] || "") + String.fromCharCode(9) + (b.lines[i] || "")));
      return out;
    },
  };

  C.printf = {
    hidden: true, usage: "printf <format> [args...]",
    hint: { ko: "형식 출력", en: "formatted output" },
    run: (args) => {
      if (!args.length) return [err("printf: usage: printf format [arguments]")];
      const fmt = args[0].replace(/^["']|["']$/g, "");
      const rest = args.slice(1);
      let i = 0;
      // Escapes are assembled from char codes: every editing pass that touched a
      // literal backslash in this file so far has eaten it.
      const BS = String.fromCharCode(92), NL = String.fromCharCode(10), TAB = String.fromCharCode(9);
      const text = fmt
        .split(BS + "n").join(NL)
        .split(BS + "t").join(TAB)
        .replace(/%[sd]/g, (m) => {
          const v = rest[i++];
          return m === "%d" ? String(parseInt(v, 10) || 0) : String(v === undefined ? "" : v);
        })
        .replace(/%%/g, "%");
      return text.split(NL).map(l => T(l));
    },
  };

  window.COREUTILS = C;
})();
