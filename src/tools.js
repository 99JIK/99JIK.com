// Programs that ship as their own packages rather than as coreutils: awk, bc, cal,
// neofetch, xdg-open, vi. Same contract as coreutils.js, run(args, stdin, lang).
//
// Each one computes from something real. neofetch reads the filesystem, the theme
// and the actual heap; cal marks the days the calendar feed actually has events on.
(function () {
  const T = (text, opts = {}) => ({ kind: "text", text, ...opts });
  const err = (text) => T(text, { warn: true });
  const FS = () => window.FS;
  const C = {};

  // ── awk ───────────────────────────────────────────────────────────────────
  // A deliberate subset: `{print ...}` with an optional pattern. Fields ($1..$n,
  // $0), NF and NR resolve; expressions do not. It covers what people actually
  // reach for in a pipe and answers honestly when it does not understand.
  C.awk = {
    usage: "awk [-F<sep>] '[pattern] {print $1, $NF}'",
    hint: { ko: "필드 추출 (awk -F: '{print $1}')", en: "extract fields (awk -F: '{print $1}')" },
    run: (args, stdin) => {
      let sep = null;
      const rest = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith("-F")) sep = a.length > 2 ? a.slice(2) : (args[++i]);
        else rest.push(a);
      }
      const prog = rest.join(" ").replace(/^['"]|['"]$/g, "").trim();
      if (!prog) return [err("awk: no program text")];
      if (!stdin) return [err("awk: reads from standard input; use it after a pipe")];

      const m = prog.match(/^(.*?)\{\s*(.*?)\s*\}$/s);
      const pattern = (m ? m[1] : "").trim();
      const action = (m ? m[2] : prog).trim();
      if (!/^print\b/.test(action)) {
        return [err(`awk: only \`{print ...}\` is implemented, got: ${action || prog}`)];
      }
      const argList = action.replace(/^print\s*/, "").trim();

      const split = (line) => sep === null ? String(line).trim().split(/\s+/).filter(Boolean)
                                           : String(line).split(sep);

      const matches = (line, fields, nr) => {
        if (!pattern) return true;
        let p = pattern;
        const nm = p.match(/^NR\s*(==|>|<|>=|<=)\s*(\d+)$/);
        if (nm) {
          const v = +nm[2];
          return { "==": nr === v, ">": nr > v, "<": nr < v, ">=": nr >= v, "<=": nr <= v }[nm[1]];
        }
        const rm = p.match(/^\/(.*)\/$/);
        if (rm) { try { return new RegExp(rm[1]).test(line); } catch { return false; } }
        return true;
      };

      const out = [];
      stdin.forEach((line, i) => {
        const fields = split(line);
        const nr = i + 1;
        if (!matches(line, fields, nr)) return;
        if (!argList) return out.push(T(String(line)));
        const pieces = argList.split(",").map(tok => {
          const t = tok.trim();
          if (t === "$0") return String(line);
          if (t === "NF") return String(fields.length);
          if (t === "NR") return String(nr);
          const fm = t.match(/^\$(\d+|NF)$/);
          if (fm) {
            const idx = fm[1] === "NF" ? fields.length : +fm[1];
            return idx === 0 ? String(line) : (fields[idx - 1] ?? "");
          }
          return t.replace(/^["']|["']$/g, "");
        });
        out.push(T(pieces.join(" ")));
      });
      return out.length ? out : [T("(no output)", { dim: true })];
    },
  };

  // ── bc ────────────────────────────────────────────────────────────────────
  // Hand-written recursive descent rather than eval: the input is untrusted text
  // and `^` means exponent in bc but xor in JavaScript.
  function evalExpr(src) {
    let i = 0;
    const ws = () => { while (src[i] === " ") i++; };
    const peek = () => { ws(); return src[i]; };
    function primary() {
      ws();
      if (src[i] === "(") { i++; const v = expr(); ws(); if (src[i] !== ")") throw new Error("syntax error"); i++; return v; }
      if (src[i] === "-") { i++; return -primary(); }
      if (src[i] === "+") { i++; return primary(); }
      const m = /^\d+(\.\d+)?/.exec(src.slice(i));
      if (!m) throw new Error("syntax error");
      i += m[0].length;
      return parseFloat(m[0]);
    }
    function power() {
      const base = primary();
      if (peek() === "^") { i++; return Math.pow(base, power()); }   // right associative
      return base;
    }
    function term() {
      let v = power();
      for (;;) {
        const op = peek();
        if (op !== "*" && op !== "/" && op !== "%") return v;
        i++;
        const r = power();
        if ((op === "/" || op === "%") && r === 0) throw new Error("divide by zero");
        v = op === "*" ? v * r : op === "/" ? v / r : v % r;
      }
    }
    function expr() {
      let v = term();
      for (;;) {
        const op = peek();
        if (op !== "+" && op !== "-") return v;
        i++;
        v = op === "+" ? v + term() : v - term();
      }
    }
    const v = expr();
    ws();
    if (i < src.length) throw new Error("syntax error");
    return v;
  }

  C.bc = {
    usage: "bc <expression>",
    hint: { ko: "계산기 (bc '2^10 + 24')", en: "calculator (bc '2^10 + 24')" },
    run: (args, stdin) => {
      const exprs = args.length ? [args.join(" ").replace(/^['"]|['"]$/g, "")] : (stdin || []);
      if (!exprs.length) return [err("bc: no expression")];
      return exprs.filter(e => String(e).trim()).map(e => {
        if (!/^[\d\s+\-*/%^().]+$/.test(String(e))) return err("(standard_in): syntax error");
        try {
          const v = evalExpr(String(e));
          if (!Number.isFinite(v)) return err("Runtime error: number out of range");
          // bc truncates to the scale in use, which is 0 unless you set it.
          return T(Number.isInteger(v) ? String(v) : String(Number(v.toFixed(10))));
        } catch (x) {
          return err("(standard_in): " + x.message);
        }
      });
    },
  };

  // ── cal ───────────────────────────────────────────────────────────────────
  C.cal = {
    usage: "cal [month] [year]",
    hint: { ko: "달력 (일정 있는 날 표시)", en: "calendar, marking days that have events" },
    run: (args, stdin, lang) => {
      const now = new Date();
      const nums = args.map(Number).filter(v => !Number.isNaN(v));
      const month = nums.length ? nums[0] - 1 : now.getMonth();
      const year = nums.length > 1 ? nums[1] : now.getFullYear();
      if (month < 0 || month > 11) return [err("cal: " + (nums[0]) + " is neither a month number (1..12) nor a name")];

      const first = new Date(year, month, 1);
      const days = new Date(year, month + 1, 0).getDate();
      const names = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];
      const title = `${names[month]} ${year}`;
      const pad = Math.max(0, Math.floor((20 - title.length) / 2));

      // Days the synced calendar actually has something on. Falls back to none
      // when the feed has not loaded yet, rather than inventing marks.
      const busy = new Set();
      try {
        const data = window.CALENDAR && window.CALENDAR.peek && window.CALENDAR.peek();
        for (const e of (data && data.events) || []) {
          const d = new Date(e.start);
          if (d.getFullYear() === year && d.getMonth() === month) busy.add(d.getDate());
        }
      } catch {}

      const rows = [
        T(" ".repeat(pad) + title),
        T("Su Mo Tu We Th Fr Sa", { dim: true }),
      ];
      let cells = new Array(first.getDay()).fill(null);
      for (let d = 1; d <= days; d++) cells.push(d);
      while (cells.length % 7) cells.push(null);

      const isToday = (d) => year === now.getFullYear() && month === now.getMonth() && d === now.getDate();
      for (let r = 0; r < cells.length; r += 7) {
        const week = cells.slice(r, r + 7);
        const parts = [];
        week.forEach((d, i) => {
          if (i) parts.push({ t: " " });
          if (d === null) return parts.push({ t: "  " });
          parts.push({ t: String(d).padStart(2), c: isToday(d) ? "today" : busy.has(d) ? "busy" : null });
        });
        rows.push({ kind: "text", text: parts.map(p => p.t).join(""), parts });
      }
      if (busy.size) rows.push(T(lang === "en" ? "(highlighted days have events; `now --month` lists them)"
                                               : "(표시된 날에 일정이 있습니다. `now --month` 로 확인)", { dim: true }));
      return rows;
    },
  };

  // ── neofetch ──────────────────────────────────────────────────────────────
  // Every value here is read from something: /etc/os-release, the filesystem tree,
  // the stored theme, the real heap. Nothing is decorative text.
  // Pure ASCII on purpose. Box-drawing characters (U+2500-257F) are East Asian
  // "Ambiguous" width: a CJK fallback font renders them two cells wide, and this art
  // sits in a padded column next to the info block, so one wide glyph shears the
  // whole layout. ASCII cannot do that.
  const NEOFETCH_LOGO = [
    "    .------------------.",
    "    |                  |",
    "    |   99jik          |",
    "    |                  |",
    "    |   $ _            |",
    "    |                  |",
    "    |                  |",
    "    '------------------'",
    "        .----------.    ",
    "    .---'----------'---.",
    "    '------------------'",
  ];

  C.neofetch = {
    usage: "neofetch",
    hint: { ko: "시스템 정보 요약", en: "system information summary" },
    run: () => {
      const D = window.SITE_DATA;
      const osr = FS().resolve("/etc/os-release").node;
      const field = (k) => {
        const hit = ((osr && osr.content) || []).find(l => l.startsWith(k + "="));
        return hit ? hit.slice(k.length + 1).replace(/^"|"$/g, "") : "";
      };
      const secs = Math.floor(performance.now() / 1000);
      const up = secs < 60 ? `${secs} secs` : `${Math.floor(secs / 60)} mins`;

      let disk = "";
      try {
        const df = window.COREUTILS.df.run(["-h"]);
        const cells = String(df[1].text).trim().split(/\s+/);
        disk = `${cells[2]} / ${cells[1]} (${cells[4]})`;
      } catch {}

      let mem = "unavailable (browser)";
      try {
        const m = performance.memory;
        if (m) mem = `${Math.round(m.usedJSHeapSize / 1048576)}MiB / ${Math.round(m.jsHeapSizeLimit / 1048576)}MiB`;
      } catch {}

      const theme = (() => { try { return window.PREFS.load().theme; } catch { return "dark"; } })();
      const user = window.getPromptName ? window.getPromptName() : "anonymous";
      const res = (() => {
        try { return `${screen.width}x${screen.height}`; } catch { return "unknown"; }
      })();

      const info = [
        [null, `${user}@${D.site.handle}`],
        [null, "-".repeat(user.length + D.site.handle.length + 1)],
        ["OS", field("PRETTY_NAME") || "JIKOS"],
        ["Host", D.site.domain],
        ["Kernel", field("VERSION_ID") || "1.0"],
        ["Uptime", up],
        ["Shell", "bash"],
        ["Resolution", res],
        ["Terminal", "99jik-web"],
        ["Theme", theme],
        ["Locale", document.documentElement.lang === "en" ? "en_US.UTF-8" : "ko_KR.UTF-8"],
        ["Disk (/)", disk],
        ["Memory", mem],
      ];

      const rows = Math.max(NEOFETCH_LOGO.length, info.length);
      const w = Math.max(...NEOFETCH_LOGO.map(l => l.length));
      const out = [];
      for (let i = 0; i < rows; i++) {
        const art = (NEOFETCH_LOGO[i] || "").padEnd(w + 2);
        const row = info[i];
        const parts = [{ t: art, c: "logo" }];
        if (row) {
          if (row[0]) { parts.push({ t: row[0] + ": ", c: "key" }); parts.push({ t: row[1] }); }
          else parts.push({ t: row[1], c: "key" });
        }
        out.push({ kind: "text", text: parts.map(p => p.t).join(""), parts });
      }
      return out;
    },
  };

  // ── xdg-open ──────────────────────────────────────────────────────────────
  // Real xdg-open asks the desktop which application handles a thing. So does this
  // one: a URL goes to the browser, the CV to the PDF viewer, the playlist to the
  // player. The `link` fallback is for when there is no desktop to ask, which is
  // every screen too small to put windows on.
  function handlerFor(path, node) {
    if (node && node.live === "playlist") return { app: "music" };
    if (/(^|\/)cv$/.test(path) || /\.pdf$/i.test(path)) return { app: "cv", arg: path };
    if (node && node.type === "link" && /^https?:\/\//.test(node.target || "")) {
      return { app: "browser", arg: node.target };
    }
    if (/\.desktop$/.test(path) && node && node.type === "file") {
      const exec = (node.content || []).find((l) => l.startsWith("Exec="));
      if (exec) return { app: exec.slice(5).trim() };
    }
    // Anything else readable opens in the viewer, which is what a desktop does
    // with a text file. Directories are for `cd`, not for opening.
    if (node && node.type === "file") return { app: "viewer", arg: path };
    return null;
  }

  C["xdg-open"] = {
    usage: "xdg-open <path|url>",
    hint: { ko: "기본 앱으로 열기 (xdg-open ~/cv)", en: "open with its application (xdg-open ~/cv)" },
    run: (args) => {
      const a = args[0];
      if (!a) return [err("xdg-open: missing argument")];
      if (/^https?:\/\//.test(a)) {
        return [{ kind: "mode", action: "open-window", app: "browser", arg: a },
                { kind: "link", href: a, text: a }];
      }
      const { path, node } = FS().resolve(a);
      if (!node) return [err("xdg-open: " + a + ": No such file or directory")];
      const h = handlerFor(path, node);
      if (h) {
        const out = [{ kind: "mode", action: "open-window", app: h.app, arg: h.arg }];
        if (node.type === "link") out.push({ kind: "link", href: node.target, text: node.target });
        return out;
      }
      if (node.type === "link") return [{ kind: "link", href: node.target, text: node.target }];
      return [err("xdg-open: " + a + ": no application knows how to open this")];
    },
  };
  C.open = { hidden: true, usage: "open <path|url>", hint: C["xdg-open"].hint, run: C["xdg-open"].run };

  // ── mpv ──────────────────────────────────────────────────────────
  // Plays the one thing on this machine that is playable: the playlist. Anything
  // else gets the error real mpv gives, because nothing else here has audio.
  // --playlist-start is 0-based in mpv, so it is 0-based here too.
  function playlistNode(a) {
    if (!a) return null;
    const { node } = FS().resolve(a);
    return node && node.live === "playlist" ? node : null;
  }

  C.mpv = {
    usage: "mpv [--playlist-start=N] <file.m3u>",
    hint: { ko: "플레이리스트 재생 (계속 틀어둔 채로 명령 입력 가능)", en: "play a playlist; it keeps going while you type" },
    run: (args, stdin, lang) => {
      let start = 0;
      const rest = [];
      for (const a of args) {
        const m = /^--playlist-start=(\d+)$/.exec(a);
        if (m) { start = parseInt(m[1], 10); continue; }
        if (a.startsWith("-")) return [err("mpv: Error parsing option " + a + ": option not found.")];
        rest.push(a);
      }
      const target = rest[0];
      if (!target) {
        return [
          T("Usage:   mpv [options] [url|path/]filename"),
          T(""),
          T("Options: --playlist-start=<n>   start at track n (0-based)"),
          T(lang === "en"
            ? "Try:     mpv ~/.midnight/playlist.m3u"
            : "예:      mpv ~/.midnight/playlist.m3u", { dim: true }),
        ];
      }
      const node = playlistNode(target);
      if (!node) {
        const { node: any } = FS().resolve(target);
        if (!any) return [err("mpv: " + target + ": No such file or directory")];
        // Real mpv on a text file: it opens it, finds no stream, and gives up.
        return [
          err("[lavf] Format detection failed."),
          err("Failed to recognize file format."),
        ];
      }
      return [{ kind: "player", start }];
    },
  };
  C.mplayer = { hidden: true, usage: "mplayer <file.m3u>", hint: C.mpv.hint, run: C.mpv.run };

  // ── vi ────────────────────────────────────────────────────────────────────
  C.vi = {
    usage: "vi <file>",
    hint: { ko: "모달 편집기 (읽기 전용이라 저장은 실패)", en: "modal editor (read-only mount, so writes fail)" },
    run: (args) => {
      const a = args[0];
      if (!a) return [err("vi: usage: vi <file>")];
      const { path, node } = FS().resolve(a);
      if (!node) return [err(`vi: ${a}: No such file or directory (this filesystem cannot create one)`)];
      if (node.type === "dir") return [err(`vi: ${a}: Is a directory`)];
      if (node.type === "link") return [err(`vi: ${a}: is a symbolic link to ${node.target}`)];
      return [{ kind: "mode", action: "vi", path, lines: (node.content || []).slice() }];
    },
  };
  C.vim = { hidden: true, usage: "vim <file>", hint: C.vi.hint, run: C.vi.run };
  C.view = { hidden: true, usage: "view <file>", hint: C.vi.hint, run: C.vi.run };

  // ── sed ───────────────────────────────────────────────────────────────────
  // The two forms people actually type: `s/re/rep/[gi]` and a delete address.
  // Anything else says so instead of pretending.
  C.sed = {
    usage: "sed 's/re/rep/[gi]' | sed '/re/d' | sed 'Nd'",
    hint: { ko: "치환 / 삭제 (sed 's/a/b/g')", en: "substitute or delete (sed 's/a/b/g')" },
    run: (args, stdin) => {
      const script = args.join(" ").replace(/^['"]|['"]$/g, "").trim();
      if (!script) return [err("sed: no script")];
      if (!stdin) return [err("sed: reads from standard input; use it after a pipe")];

      const sub = script.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/);
      if (sub) {
        const [, , pat, rep, mods] = sub;
        let re;
        try { re = new RegExp(pat, mods.includes("g") ? "g" + (mods.includes("i") ? "i" : "") : (mods.includes("i") ? "i" : "")); }
        catch { return [err("sed: -e expression #1, char 1: invalid regex")]; }
        return stdin.map(l => T(String(l).replace(re, rep)));
      }
      const delRe = script.match(/^\/(.*)\/d$/);
      if (delRe) {
        let re;
        try { re = new RegExp(delRe[1]); } catch { return [err("sed: invalid regex")]; }
        const out = stdin.filter(l => !re.test(String(l))).map(l => T(l));
        return out.length ? out : [T("(no output)", { dim: true })];
      }
      const delN = script.match(/^(\d+)d$/);
      if (delN) {
        const n = +delN[1];
        return stdin.filter((_, i) => i + 1 !== n).map(l => T(l));
      }
      return [err(`sed: -e expression #1: unknown command: \`${script}'`)];
    },
  };

  // ── lolcat ────────────────────────────────────────────────────────────────
  // The genuine article: a filter that rainbows whatever comes through stdin.
  C.lolcat = {
    usage: "lolcat [file...]",
    hint: { ko: "출력을 무지개로", en: "rainbow the output" },
    run: (args, stdin) => {
      let lines = stdin;
      if (!lines) {
        const { node } = FS().resolve(args[0] || "");
        if (!node || node.type === "dir") return [err("lolcat: reads a file or standard input")];
        lines = node.content || [];
      }
      return lines.map((l, row) => {
        const parts = [...String(l)].map((ch, col) => ({
          t: ch,
          c: "rb" + ((row * 2 + col) % 6),
        }));
        return { kind: "text", text: String(l) || " ", parts: parts.length ? parts : [{ t: " " }] };
      });
    },
  };

  // ── shell-adjacent ────────────────────────────────────────────────────────
  C.less = {
    usage: "less <file>",
    hint: { ko: "파일 보기 (스크롤백이 곧 페이저)", en: "view a file (the scrollback is the pager)" },
    // less(1) on a non-tty just cats, which is exactly the honest behaviour here:
    // the scrollback already scrolls, so there is nothing left to page.
    run: (args, stdin, lang) => window.FS.cat(args),
  };
  C.more = { hidden: true, usage: "more <file>", hint: C.less.hint, run: C.less.run };

  C.alias = {
    usage: "alias",
    hint: { ko: "정의된 별칭", en: "list command aliases" },
    run: (args, stdin, lang) => {
      // Derived, not hand-listed: two names sharing a run function are aliases.
      const table = window.TERMINAL ? window.TERMINAL.buildCommands(lang || "ko") : {};
      const seen = new Map();
      const out = [];
      for (const [name, def] of Object.entries(table)) {
        if (!def.run) continue;
        if (seen.has(def.run)) out.push(T(`alias ${name}='${seen.get(def.run)}'`));
        else seen.set(def.run, name);
      }
      return out.length ? out : [T("(no aliases)", { dim: true })];
    },
  };

  C.time = {
    usage: "time <command>",
    hint: { ko: "명령 실행 시간 측정", en: "time a command" },
    run: (args, stdin, lang) => {
      if (!args.length) return [err("time: usage: time <command>")];
      const line = args.join(" ");
      const t0 = performance.now();
      const out = window.TERMINAL.run(line, lang) || [];
      const ms = performance.now() - t0;
      const fmt = (v) => "0m" + (v / 1000).toFixed(3) + "s";
      return [
        ...out.filter(b => b.kind !== "mode"),
        T(""),
        T("real\t" + fmt(ms), { dim: true }),
        T("user\t" + fmt(ms), { dim: true }),
        T("sys\t" + fmt(0), { dim: true }),
      ];
    },
  };

  C["lsb_release"] = {
    hidden: true, usage: "lsb_release [-a]",
    hint: { ko: "배포판 정보", en: "distribution information" },
    run: () => {
      const rel = FS().resolve("/etc/os-release").node;
      const get = (k) => {
        const hit = ((rel && rel.content) || []).find(l => l.startsWith(k + "="));
        return hit ? hit.slice(k.length + 1).replace(/^"|"$/g, "") : "";
      };
      return [
        T("Distributor ID:\t" + (get("NAME") || "JIKOS")),
        T("Description:\t" + (get("PRETTY_NAME") || "JIKOS")),
        T("Release:\t" + (get("VERSION_ID") || "1.0")),
        T("Codename:\t" + (get("ID") || "jikos")),
      ];
    },
  };

  C.who = {
    hidden: true, usage: "who", hint: { ko: "로그인한 사용자", en: "who is logged in" },
    run: () => {
      const u = window.getPromptName ? window.getPromptName() : "anonymous";
      const since = new Date(Date.now() - performance.now());
      const stamp = since.toLocaleString("en-GB", {
        timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).replace(",", "");
      return [T(u.padEnd(10) + "tty1         " + stamp)];
    },
  };
  C.w = { hidden: true, usage: "w", hint: C.who.hint, run: C.who.run };

  // ── qrencode ──────────────────────────────────────────────────────────────
  // Real qrencode has -t ASCII and -t SVG. ASCII is the default because this is a
  // terminal; the renderer measures the font advance and sets the line height so a
  // module comes out square, which is what a scanner needs. -t SVG is there for when
  // the surrounding font cannot be measured.
  function qrBlocks(text, mode) {
    const grid = window.QR.encode(text);
    if (!grid) return [err("qrencode: input too long (136 bytes at this error correction level)")];
    return [{ kind: "qr", grid, caption: text, mode: mode === "svg" ? "svg" : "ascii" }];
  }

  function qrMode(args) {
    // Token comparison rather than a regex: every editing pass that touched a
    // backslash in this file so far has silently eaten it.
    const wantsSvg = (args || []).some(a => String(a).toLowerCase() === "svg");
    if (wantsSvg) return "svg";
    return "ascii";
  }

  C.qrencode = {
    usage: "qrencode [-t ASCII|SVG] [text|url]",
    hint: { ko: "QR 코드 (기본값은 이 사이트 주소)", en: "QR code (defaults to this site)" },
    run: (args, stdin) => {
      const words = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-t") { i++; continue; }
        if (args[i].startsWith("-")) continue;
        if (/^ascii$|^svg$/i.test(args[i])) continue;
        words.push(args[i]);
      }
      // Reads stdin like the real thing, so `book | qrencode` and `cv | qrencode`
      // turn any link the site prints into something a phone can scan.
      const piped = (stdin || []).map(String).filter(l => l.trim());
      const url = piped.find(l => /^(https?:\/\/|mailto:)/.test(l.trim()));
      const text = words.join(" ")
        || (url ? url.trim() : piped.length ? piped.join(" ").trim() : "")
        || ("https://" + window.SITE_DATA.site.domain);
      return qrBlocks(text, qrMode(args));
    },
  };

  C.vcard = {
    usage: "vcard [-t ASCII|SVG]",
    hint: { ko: "연락처 QR (스캔해서 저장)", en: "contact QR you can scan into a phone" },
    run: (args) => {
      const p = window.SITE_DATA.profile;
      const NL = String.fromCharCode(10);
      // Built from data.js so the card cannot drift from the rest of the site.
      const card = [
        "BEGIN:VCARD", "VERSION:3.0",
        "N:" + p.name_en.split(" ").reverse().join(";"),
        "FN:" + p.name_en,
        "EMAIL:" + p.email,
        "URL:https://" + window.SITE_DATA.site.domain,
        "END:VCARD",
      ].join(NL);
      const out = qrBlocks(card, qrMode(args));
      if (out[0] && out[0].kind === "qr") out[0].caption = p.name_en + " · " + p.email;
      return out;
    },
  };

  window.TOOLS = C;
})();
