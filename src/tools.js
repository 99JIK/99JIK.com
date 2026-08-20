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
        if (a.startsWith("-F")) sep = a.length > 2 ? a.slice(2) : (args[++i] || " ");
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
        if (!argList) return out.push(T(String(line) || " "));
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
        out.push(T(pieces.join(" ") || " "));
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
  const NEOFETCH_LOGO = [
    "   ┌──────────────────┐",
    "   │                  │",
    "   │   99jik          │",
    "   │                  │",
    "   │   $ _            │",
    "   │                  │",
    "   │                  │",
    "   └──────────────────┘",
    "        ┌────────┐     ",
    "   ┌────┴────────┴────┐",
    "   └──────────────────┘",
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
  C["xdg-open"] = {
    usage: "xdg-open <path|url>",
    hint: { ko: "링크 열기 (xdg-open ~/til)", en: "open a link (xdg-open ~/til)" },
    run: (args) => {
      const a = args[0];
      if (!a) return [err("xdg-open: missing argument")];
      if (/^https?:\/\//.test(a)) return [{ kind: "link", href: a, text: a }];
      const { node } = FS().resolve(a);
      if (!node) return [err("xdg-open: " + a + ": No such file or directory")];
      if (node.type === "link") return [{ kind: "link", href: node.target, text: node.target }];
      return [err("xdg-open: " + a + ": no application knows how to open this")];
    },
  };
  C.open = { hidden: true, usage: "open <path|url>", hint: C["xdg-open"].hint, run: C["xdg-open"].run };

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

  window.TOOLS = C;
})();
