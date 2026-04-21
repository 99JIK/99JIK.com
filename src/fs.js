// Virtual filesystem — real-feeling ls/cd/pwd/cat over site content.
// Tree is built from SITE_DATA so projects/publications/etc stay in sync with data.js.

(function () {
  const CWD_KEY = "99jik:cwd:v2"; // bumped: layout moved under /home/jeongin
  const HOME = "/home/jeongin";

  // Build the tree. Files carry { type, size, mtime, content } where content is an
  // array of text blocks returned by `cat`.
  function buildTree() {
    const D = window.SITE_DATA;
    const now = Date.now();
    const dayAgo = (n) => new Date(now - n * 86400000);

    const projectsDir = {};
    D.projects.forEach((p, i) => {
      projectsDir[p.slug + ".md"] = {
        type: "file",
        size: 512 + i * 48,
        mtime: dayAgo(i + 1),
        content: [
          `# ${p.title_en} (${p.year})`,
          `slug: ${p.slug}`,
          `stack: ${p.stack.join(", ")}`,
          `featured: ${p.featured ? "yes" : "no"}`,
          "",
          p.summary_en,
          p.summary_ko,
          "",
          `repo: github.com/${D.site.github}/${p.slug}`,
          `(tip: 'cat ${p.slug}' from the terminal gives a prettier view.)`,
        ],
      };
    });

    const researchDir = {};
    D.research.forEach((r, i) => {
      researchDir[r.tag.toLowerCase() + ".md"] = {
        type: "file",
        size: 240 + i * 30,
        mtime: dayAgo(10 + i),
        content: [
          `# ${r.title_en}`,
          `tag: ${r.tag}`,
          "",
          r.blurb,
        ],
      };
    });

    // Jeongin's home — all the personal / portfolio content lives here.
    const jeonginHome = {
      type: "dir", mtime: dayAgo(0),
      children: {
        "about": {
          type: "file", size: 420, mtime: dayAgo(0),
          content: [
            `${D.profile.name_en} (${D.profile.name_ko})`,
            `${D.profile.role_en} -- ${D.profile.affiliation_en}`,
            `${D.profile.location}`,
            "",
            "I work at the intersection of software testing and language models.",
            "Teaching both sides to reason about correctness together.",
          ],
        },
        "projects": { type: "dir", mtime: dayAgo(1), children: projectsDir },
        "research": { type: "dir", mtime: dayAgo(7), children: researchDir },
        "publications.txt": {
          type: "file", size: 180, mtime: dayAgo(3),
          content: D.publications.map(p => `${p.year}  ${p.venue.padEnd(10)} ${p.title} (${p.role})`),
        },
        "skills.json": {
          type: "file", size: 256, mtime: dayAgo(14),
          content: JSON.stringify(D.skills, null, 2).split("\n"),
        },
        "contact": {
          type: "file", size: 140, mtime: dayAgo(30),
          content: [
            `email:    ${D.profile.email}`,
            `github:   github.com/${D.profile.github}`,
            `linkedin: linkedin.com/in/${D.profile.linkedin}`,
            `til:      ${D.site.til}`,
          ],
        },
        "now.log": {
          type: "file", size: 128, mtime: dayAgo(0),
          content: D.now.map((n, i) => `[${new Date(now - i*3600000).toISOString().slice(0,16).replace("T"," ")}] ${n}`),
        },
        "cv.pdf": {
          type: "file", size: 248320, mtime: dayAgo(21),
          content: ["(binary -- use 'cv' command to download CV.pdf)"],
        },
        ".secret_todo": {
          type: "file", size: 64, mtime: dayAgo(0), hidden: true,
          content: [
            "# secret TODO",
            "- [ ] finish SLM fuzzer prototype",
            "- [ ] reply to advisor's email (3 days and counting)",
            "- [x] caffeinate",
            "- [ ] sleep (impossible sprint)",
          ],
        },
        ".lab": {
          type: "dir", mtime: dayAgo(1), hidden: true,
          children: {
            "notebook-2026-04.md": {
              type: "file", size: 512, mtime: dayAgo(0),
              content: [
                "# lab notebook — Apr 2026",
                "",
                "- tried swapping llama.cpp Q4 → Q5 for fuzzer SLM.",
                "  seed programs segfault 2x more often. good signal? or just noise?",
                "- advisor: \"the oracle is weak. tighten the differential.\"",
                "- idea: use mutation score as oracle confidence proxy.",
              ],
            },
            "submission-draft.txt": {
              type: "file", size: 240, mtime: dayAgo(6),
              content: [
                "[INTERNAL DRAFT — do not cite]",
                "Title: Small Language Models as Differential Oracles",
                "       for Underspecified Library APIs",
                "Status: section 4 (evaluation) — 40% written",
                "Deadline: tighter than it feels.",
              ],
            },
          },
        },
        ".midnight": {
          type: "dir", mtime: dayAgo(3), hidden: true,
          children: {
            "thoughts.md": {
              type: "file", size: 180, mtime: dayAgo(0),
              content: [
                "# 03:42 KST",
                "",
                "what if tests wrote themselves, but badly, on purpose,",
                "to expose what the spec was silently assuming?",
                "",
                "half-asleep idea. revisit sober.",
              ],
            },
            "playlist.m3u": {
              type: "file", size: 96, mtime: dayAgo(10),
              content: [
                "# midnight lab playlist",
                "tycho — a walk",
                "bonobo — kerala",
                "boards of canada — roygbiv",
                "jon hopkins — open eye signal",
              ],
            },
          },
        },
        ".graveyard": {
          type: "dir", mtime: dayAgo(90), hidden: true,
          children: {
            "README.md": {
              type: "file", size: 128, mtime: dayAgo(90),
              content: [
                "# projects that didn't make it",
                "each one taught me something. most of them taught me to ship faster.",
              ],
            },
            "gpt-unit-test-writer.dead": {
              type: "file", size: 72, mtime: dayAgo(240),
              content: [
                "abandoned 2025-08. ran into context limits on real codebases.",
                "lessons: scope smaller. oracle first.",
              ],
            },
            "ast-diff-visualizer.dead": {
              type: "file", size: 72, mtime: dayAgo(180),
              content: [
                "abandoned 2025-10. someone already built this better.",
                "lessons: search before coding.",
              ],
            },
          },
        },
        "dreams.txt": {
          type: "file", size: 96, mtime: dayAgo(5),
          content: [
            "a compiler that catches all bugs before I write them.",
            "an LLM that says 'I don't know' when it doesn't.",
          ],
        },
        "coffee.log": {
          type: "file", size: 0, mtime: dayAgo(0),
          content: ["(empty. typical.)"],
        },
        "til": {
          type: "link", target: D.site.tilUrl, mtime: dayAgo(1), size: 22,
          content: [`symlink -> ${D.site.tilUrl}`],
        },
      },
    };

    // The full machine: /etc, /home/{jeongin,memo,stlab}, /tmp, /var, /bin.
    return {
      type: "dir", mtime: dayAgo(0),
      children: {
        "bin": {
          type: "dir", mtime: dayAgo(365),
          children: {
            "README": {
              type: "file", size: 96, mtime: dayAgo(365),
              content: [
                "binaries live somewhere in PATH. you don't need to see them.",
                "`cd ~` or `cd /home/jeongin` to get back to the interesting stuff.",
              ],
            },
          },
        },
        "etc": {
          type: "dir", mtime: dayAgo(100),
          children: {
            "hostname": {
              type: "file", size: 6, mtime: dayAgo(500),
              content: [D.site.handle],
            },
            "motd": {
              type: "file", size: 680, mtime: dayAgo(30),
              content: [
                `=== Welcome to ${D.site.handle} ===`,
                "",
                `${D.profile.name_en}'s playful portfolio machine.`,
                "",
                "## getting around",
                "  cd ~            browse my stuff (/home/jeongin)",
                "  cd /            see the whole machine",
                "  ls -a           hidden files (there's more than you think)",
                "  tree            full layout at a glance",
                "  help  or  ?     full command list",
                "",
                "## say hi",
                "  su <name>       switch user (exit to go back)",
                "  chat            message me live",
                "",
                "## some fun",
                "  coffee          fuel",
                "  fortune         testing-flavored quotes",
                "  weather         check the sky over daegu",
                "  cowsay hello    moo",
                "  top             processes running in my head",
                "",
                "## for the curious",
                "  unix jokes exist. try what you know.",
                "  keyboard secrets too  (^ ^ v v < > < > ...)",
                "  some folders pretend to be empty.",
                "",
                "that's a start. the rest — poke around.",
              ],
            },
            "os-release": {
              type: "file", size: 180, mtime: dayAgo(60),
              content: [
                `NAME="JIKOS"`,
                `VERSION="25.04 (caffeinated)"`,
                `ID=jikos`,
                `PRETTY_NAME="JIKOS 25.04 (caffeinated)"`,
                `HOME_URL="https://${D.site.domain}"`,
                `SUPPORT_URL="type 'chat'"`,
              ],
            },
            "passwd": {
              type: "file", size: 160, mtime: dayAgo(400),
              content: [
                "# partial — only the interesting accounts",
                "jeongin:x:1000:1000:Master's candidate:/home/jeongin:/bin/zsh",
                "stlab:x:1001:1001:Software Testing Lab:/home/stlab:/bin/bash",
                "memo:x:1002:1002:scratchpad:/home/memo:/bin/zsh",
              ],
            },
          },
        },
        "home": {
          type: "dir", mtime: dayAgo(30),
          children: {
            "jeongin": jeonginHome,
            "memo": {
              type: "dir", mtime: dayAgo(0),
              children: {
                "README": {
                  type: "file", size: 160, mtime: dayAgo(0),
                  content: [
                    "# memo/",
                    "",
                    "scratchpad — thoughts I don't want to forget.",
                    "(real notes live in /home/jeongin/.midnight/thoughts.md)",
                  ],
                },
                "ideas.md": {
                  type: "file", size: 240, mtime: dayAgo(2),
                  content: [
                    "# ideas",
                    "",
                    "- [ ] write up the SLM oracle confidence experiment",
                    "- [ ] try seed mutation guided by path coverage",
                    "- [ ] ask advisor about ISSTA deadline stretch",
                    "- [ ] blog post: why unit-test LLMs are not enough",
                  ],
                },
                "reading.md": {
                  type: "file", size: 200, mtime: dayAgo(5),
                  content: [
                    "# reading queue",
                    "",
                    "- Fuzz4All (ICSE'24)",
                    "- TitanFuzz, FuzzGPT — LLM fuzzers",
                    "- Xia et al. — LLM mutation testing",
                    "- anything citing Barr et al. test oracle problem",
                  ],
                },
              },
            },
            "stlab": {
              type: "dir", mtime: dayAgo(1),
              children: {
                "homepage": {
                  type: "link", target: "https://selab.knu.ac.kr",
                  mtime: dayAgo(30), size: 26,
                  content: ["symlink -> https://selab.knu.ac.kr"],
                },
                "about.txt": {
                  type: "file", size: 160, mtime: dayAgo(60),
                  content: [
                    "# Software Testing Lab — KNU",
                    "",
                    "Principal investigator, students, papers, meetings.",
                    "homepage symlink → selab.knu.ac.kr",
                  ],
                },
                "course.md": {
                  type: "file", size: 220, mtime: dayAgo(0),
                  content: [
                    "# weekly",
                    "",
                    "- Wed 09:00 — SW Testing 3H",
                    "- Thu 09:00 — Java Programming 4H",
                    "- Sat 09:00 — SW Testing 3H",
                    "- ad-hoc — whiteboard sessions, usually 403",
                  ],
                },
                "rooms.txt": {
                  type: "file", size: 60, mtime: dayAgo(300),
                  content: [
                    "main: IT-5 523",
                    "coffee: the hallway vending machine (tragic)",
                  ],
                },
              },
            },
          },
        },
        "tmp": {
          type: "dir", mtime: dayAgo(0),
          children: {
            "nothing.txt": {
              type: "file", size: 14, mtime: dayAgo(0),
              content: ["as expected."],
            },
          },
        },
        "var": {
          type: "dir", mtime: dayAgo(10),
          children: {
            "log": {
              type: "dir", mtime: dayAgo(0),
              children: {
                "site.log": {
                  type: "file", size: 280, mtime: dayAgo(0),
                  content: [
                    `[${new Date(now).toISOString().slice(0,16).replace("T"," ")}] session started`,
                    `[${new Date(now).toISOString().slice(0,16).replace("T"," ")}] banner anim: random pick`,
                    `[${new Date(now).toISOString().slice(0,16).replace("T"," ")}] seeded scrollback: about, til`,
                    `[${new Date(now).toISOString().slice(0,16).replace("T"," ")}] calendar.json: placeholder`,
                    "",
                    "(ephemeral — regenerated on load)",
                  ],
                },
              },
            },
          },
        },
      },
    };
  }

  let ROOT = null;
  function root() { if (!ROOT) ROOT = buildTree(); return ROOT; }

  // cwd is an absolute path string like "/home/jeongin" or "/etc".
  let cwd = localStorage.getItem(CWD_KEY) || HOME;
  function getCwd() { return cwd; }
  function setCwd(p) {
    cwd = normalize(p);
    localStorage.setItem(CWD_KEY, cwd);
    window.dispatchEvent(new CustomEvent("promptpath"));
  }
  // Display: render HOME and its descendants as `~` / `~/...`; otherwise show full path.
  function displayCwd() {
    if (cwd === HOME) return "~";
    if (cwd.startsWith(HOME + "/")) return "~" + cwd.slice(HOME.length);
    return cwd;
  }

  // path utilities
  function split(p) { return p.split("/").filter(Boolean); }
  function join(parts) { return "/" + parts.join("/"); }
  function normalize(p) {
    if (!p) return cwd;
    let parts;
    if (p.startsWith("/")) parts = split(p);
    else if (p === "~" || p.startsWith("~/")) parts = [...split(HOME), ...split(p.slice(1))];
    else parts = [...split(cwd), ...split(p)];
    const out = [];
    for (const s of parts) {
      if (s === "." || s === "") continue;
      if (s === "..") out.pop();
      else out.push(s);
    }
    return out.length ? join(out) : "/";
  }

  function resolve(path) {
    const abs = normalize(path);
    if (abs === "/") return { path: "/", node: root() };
    const parts = split(abs);
    let node = root();
    for (const s of parts) {
      if (node.type !== "dir") return { path: abs, node: null };
      const child = node.children[s];
      if (!child) return { path: abs, node: null };
      node = child;
    }
    return { path: abs, node };
  }

  function parseArgs(args) {
    const flags = new Set();
    const rest = [];
    for (const a of args) {
      if (a.startsWith("-") && a.length > 1) {
        for (const ch of a.slice(1)) flags.add(ch);
      } else rest.push(a);
    }
    return { flags, rest };
  }

  // ls: supports -a -l -r -t -h (and combos like -alrt)
  function ls(args) {
    const { flags, rest } = parseArgs(args);
    const target = rest[0] || cwd;
    const { path, node } = resolve(target);
    if (!node) return [{ kind: "text", text: `ls: ${target}: No such file or directory`, warn: true }];
    if (node.type === "file" || node.type === "link") {
      return formatLs([[basename(path), node]], path, flags);
    }
    let entries = Object.entries(node.children);
    if (!flags.has("a")) entries = entries.filter(([n, e]) => !n.startsWith(".") && !e.hidden);
    if (flags.has("t")) entries.sort((a, b) => b[1].mtime - a[1].mtime);
    else entries.sort((a, b) => a[0].localeCompare(b[0]));
    if (flags.has("r")) entries.reverse();
    return formatLs(entries, path, flags);
  }

  function basename(p) { return p === "/" ? "/" : p.slice(p.lastIndexOf("/") + 1); }

  function formatLs(entries, dirPath, flags) {
    const blocks = [];
    if (flags.has("l")) {
      const totalBlocks = entries.reduce((s, [, e]) => s + Math.ceil((e.size || 0) / 512), 0);
      blocks.push({ kind: "text", text: `total ${totalBlocks}` });
      for (const [name, e] of entries) {
        const mode = e.type === "dir" ? "drwxr-xr-x" : e.type === "link" ? "lrwxr-xr-x" : "-rw-r--r--";
        const size = String(e.size || 0).padStart(7, " ");
        const when = fmtTime(e.mtime);
        const display = e.type === "dir" ? name + "/" : e.type === "link" ? `${name} -> ${e.target}` : name;
        const line = `${mode}  1 jeongin  staff ${size} ${when} ${display}`;
        blocks.push({ kind: "text", text: line, dim: e.hidden });
      }
    } else {
      // columnar
      const names = entries.map(([n, e]) => e.type === "dir" ? n + "/" : e.type === "link" ? n + "@" : n);
      blocks.push({ kind: "text", text: names.join("  ") || "(empty)" });
    }
    return blocks;
  }

  function fmtTime(d) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const m = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2," ");
    const now = new Date();
    if (now.getFullYear() !== d.getFullYear()) return `${m} ${day}  ${d.getFullYear()}`;
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${m} ${day} ${hh}:${mm}`;
  }

  function pwd() {
    return [{ kind: "text", text: cwd }];
  }

  function cd(args) {
    const target = args[0] || "~";  // bare `cd` → home
    if (target === "-") return [{ kind: "text", text: "cd: OLDPWD not set", warn: true }];
    const { path, node } = resolve(target);
    if (!node) return [{ kind: "text", text: `cd: ${target}: No such file or directory`, warn: true }];
    if (node.type !== "dir") return [{ kind: "text", text: `cd: ${target}: Not a directory`, warn: true }];
    setCwd(path);
    return [];
  }

  function cat(args) {
    if (!args.length) return [{ kind: "text", text: "cat: missing operand", warn: true }];
    const out = [];
    for (const a of args) {
      const { path, node } = resolve(a);
      if (!node) { out.push({ kind: "text", text: `cat: ${a}: No such file or directory`, warn: true }); continue; }
      if (node.type === "dir") { out.push({ kind: "text", text: `cat: ${a}: Is a directory`, warn: true }); continue; }
      if (node.type === "link") { out.push({ kind: "link", href: node.target, text: node.content[0] }); continue; }
      node.content.forEach(line => out.push({ kind: "text", text: line }));
    }
    return out;
  }

  // for Tab completion
  function complete(partial) {
    // partial is e.g. "proj" or "projects/sil" — complete the last segment
    const hasSlash = partial.includes("/");
    const dirPart = hasSlash ? partial.slice(0, partial.lastIndexOf("/") + 1) : "";
    const frag = hasSlash ? partial.slice(partial.lastIndexOf("/") + 1) : partial;
    const resolved = resolve(dirPart || ".");
    if (!resolved.node || resolved.node.type !== "dir") return [];
    const names = Object.entries(resolved.node.children)
      .filter(([n, e]) => (frag ? n.startsWith(frag) : !n.startsWith(".")))
      .map(([n, e]) => dirPart + n + (e.type === "dir" ? "/" : ""));
    return names;
  }

  // tree: recursive, Unicode box-drawing branches. `-a` to include hidden files.
  function tree(args) {
    const { flags, rest } = parseArgs(args);
    const target = rest[0] || cwd;
    const { path, node } = resolve(target);
    if (!node) return [{ kind: "text", text: `tree: ${target}: No such file or directory`, warn: true }];
    if (node.type !== "dir") return [{ kind: "text", text: basename(path) }];

    const showHidden = flags.has("a");
    const lines = [];
    const counts = { dirs: 0, files: 0 };

    const header = path === "/" ? `${window.SITE_DATA.site.domain}/` : "." + path;
    lines.push({ kind: "text", text: header });

    function walk(dirNode, prefix) {
      let entries = Object.entries(dirNode.children);
      if (!showHidden) entries = entries.filter(([n, e]) => !n.startsWith(".") && !e.hidden);
      entries.sort(([a], [b]) => a.localeCompare(b));

      entries.forEach(([name, child], i) => {
        const isLast = i === entries.length - 1;
        const branch = isLast ? "└── " : "├── ";
        const nextPrefix = prefix + (isLast ? "    " : "│   ");
        let display;
        if (child.type === "dir") { display = name + "/"; counts.dirs++; }
        else if (child.type === "link") { display = `${name} -> ${child.target}`; counts.files++; }
        else { display = name; counts.files++; }
        lines.push({ kind: "text", text: prefix + branch + display });
        if (child.type === "dir") walk(child, nextPrefix);
      });
    }

    walk(node, "");
    lines.push({ kind: "text", text: "" });
    lines.push({ kind: "text", text: `${counts.dirs} directories, ${counts.files} files.`, dim: true });
    return lines;
  }

  // Playful one-liner appended when the search term is one of these.
  const FIND_QUIPS = {
    love:      { en: "love: not indexed. try 'chat'.",                  ko: "love: 색인에 없음. 'chat' 써보세요." },
    happiness: { en: "happiness: see /home/jeongin/coffee.log",          ko: "happiness: /home/jeongin/coffee.log 참고." },
    meaning:   { en: "meaning: resolve at runtime.",                     ko: "meaning: 런타임에 해석됩니다." },
    truth:     { en: "truth: recursive — watch for cycles.",             ko: "truth: 재귀적. 순환 주의." },
    sleep:     { en: "sleep: deprecated since grad school.",             ko: "sleep: 대학원 이후 deprecated." },
  };
  const GREP_QUIPS = {
    love:        { en: "— love: still not regex-able after all these years.", ko: "— love: 여전히 정규식으로 잡히지 않음." },
    happiness:   { en: "— happiness: compile something small, watch it run.", ko: "— happiness: 작은 프로그램 컴파일하고 돌아가는 걸 보세요." },
    meaning:     { en: "— meaning: requires more than a pattern.",            ko: "— meaning: 패턴만으론 부족." },
    truth:       { en: "— truth: assumed. do not grep.",                      ko: "— truth: 전제됨. grep 하지 마세요." },
    sleep:       { en: "— sleep: scheduled after submission deadline.",       ko: "— sleep: 마감 이후로 예약됨." },
    "free-time": { en: "— free-time: deallocated.",                           ko: "— free-time: 해제됨." },
  };

  // find: walk tree under <path> (or cwd), print matching entries.
  //   find                 — everything under cwd
  //   find /etc            — everything under /etc
  //   find . -name "*.md"  — filter by name glob
  //   find / -name secret* — glob works without quotes too
  function find(args, lang) {
    const L = (lang === "en" ? "en" : "ko");
    const { flags, rest } = parseArgs(args);
    let start = rest[0] && !rest[0].startsWith("-") ? rest[0] : cwd;
    let pattern = null;
    const nameIdx = args.indexOf("-name");
    if (nameIdx >= 0 && args[nameIdx + 1]) pattern = args[nameIdx + 1].replace(/^["']|["']$/g, "");
    // `find love` (single bare arg that doesn't look like a path) → treat as name pattern.
    const bareTerm = rest.length === 1 && nameIdx < 0 && !rest[0].startsWith("/") && !rest[0].startsWith(".") && !rest[0].startsWith("~");
    if (bareTerm) { pattern = rest[0]; start = cwd; }

    const { path: startPath, node } = resolve(start);
    if (!node) return [{ kind: "text", text: `find: ${start}: No such file or directory`, warn: true }];

    const showHidden = flags.has("a") || (pattern && pattern.startsWith("."));
    const re = pattern ? globToRegex(pattern) : null;
    const results = [];

    function walk(n, p) {
      const name = p === "/" ? "/" : p.slice(p.lastIndexOf("/") + 1);
      if (!re || re.test(name)) results.push(p);
      if (n.type !== "dir") return;
      for (const [cn, ch] of Object.entries(n.children)) {
        if (!showHidden && (cn.startsWith(".") || ch.hidden)) continue;
        walk(ch, p === "/" ? "/" + cn : p + "/" + cn);
      }
    }
    walk(node, startPath);

    const qObj = pattern ? FIND_QUIPS[pattern.toLowerCase()] : null;
    const quip = qObj ? (qObj[L] || qObj.en) : null;
    const MAX = 200;
    const out = [];
    if (!results.length) out.push({ kind: "text", text: "(no matches)", dim: true });
    else {
      results.slice(0, MAX).forEach(p => out.push({ kind: "text", text: p }));
      if (results.length > MAX) out.push({ kind: "text", text: `(truncated: ${results.length - MAX} more)`, dim: true });
    }
    if (quip) out.push({ kind: "text", text: quip, dim: true });
    return out;
  }

  // grep: search file contents under <path> (recursive by default).
  //   grep <pattern>              — search under cwd
  //   grep <pattern> <path>       — search under <path>
  //   grep -i <pattern> <path>    — case insensitive
  //   grep -n <pattern> <path>    — show line numbers
  function grep(args, lang) {
    const L = (lang === "en" ? "en" : "ko");
    const { flags, rest } = parseArgs(args);
    if (rest.length < 1) return [{ kind: "text", text: "usage: grep [-i] [-n] <pattern> [path]", warn: true }];
    const pattern = rest[0];
    const target = rest[1] || cwd;
    const caseInsensitive = flags.has("i");
    const showLine = flags.has("n");

    const { path: rootPath, node } = resolve(target);
    if (!node) return [{ kind: "text", text: `grep: ${target}: No such file or directory`, warn: true }];

    let re;
    try { re = new RegExp(pattern, caseInsensitive ? "i" : ""); }
    catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseInsensitive ? "i" : ""); }

    const results = [];
    function grepFile(f, p) {
      if (!f.content) return;
      f.content.forEach((line, i) => {
        if (re.test(line)) {
          const prefix = showLine ? `${p}:${i + 1}: ` : `${p}: `;
          results.push(prefix + line);
        }
      });
    }
    function walk(n, p) {
      if (n.type === "file") grepFile(n, p);
      else if (n.type === "dir") {
        for (const [cn, ch] of Object.entries(n.children)) {
          if (cn.startsWith(".") && !flags.has("a") && !ch.hidden) { /* visible dotdir: still walk */ }
          walk(ch, p === "/" ? "/" + cn : p + "/" + cn);
        }
      }
    }
    walk(node, rootPath);

    const qObj = GREP_QUIPS[pattern.toLowerCase()];
    const quip = qObj ? (qObj[L] || qObj.en) : null;
    const MAX = 200;
    const out = [];
    if (!results.length) out.push({ kind: "text", text: "(no matches)", dim: true });
    else {
      results.slice(0, MAX).forEach(l => out.push({ kind: "text", text: l }));
      if (results.length > MAX) out.push({ kind: "text", text: `(truncated: ${results.length - MAX} more)`, dim: true });
    }
    if (quip) out.push({ kind: "text", text: quip, dim: true });
    return out;
  }

  function globToRegex(glob) {
    const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&")
                    .replace(/\*/g, ".*")
                    .replace(/\?/g, ".");
    return new RegExp("^" + esc + "$");
  }

  // Validate stored cwd against the current tree — if it points to a path
  // that no longer exists (old structure, renamed dir, etc.), reset to HOME.
  if (!resolve(cwd).node) {
    cwd = HOME;
    try { localStorage.setItem(CWD_KEY, HOME); } catch {}
  }

  window.FS = { root, getCwd, setCwd, displayCwd, normalize, resolve, ls, cd, pwd, cat, tree, find, grep, complete };
})();
