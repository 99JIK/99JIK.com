// Virtual filesystem — real-feeling ls/cd/pwd/cat over site content.
// Tree is built from SITE_DATA so projects/publications/etc stay in sync with data.js.

(function () {
  const CWD_KEY = "99jik:cwd:v2"; // bumped: layout moved under /home/jeongin
  const HOME = "/home/jeongin";

  const store = window.PREFS.store;  // guarded localStorage, see prefs.js

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
          r.blurb_en,
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
            `${D.profile.location_en}`,
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
          content: D.now.length
            ? D.now.map((n, i) => `[${new Date(now - i*3600000).toISOString().slice(0,16).replace("T"," ")}] ${n}`)
            : ["(empty)"],
        },
        "cv.pdf": {
          type: "file", size: 248320, mtime: dayAgo(21),
          content: ["(binary -- run `cv` for the Korean and English PDFs)"],
        },
        ".secret_todo": {
          type: "file", size: 64, mtime: dayAgo(0), hidden: true,
          content: [
            "# secret TODO",
            "- [ ] finish SLM fuzzer prototype",
            "- [ ] reply to advisor's email (3 days and counting)",
            "- [x] rerun the Q5 comparison with a fixed seed",
            "- [ ] write up the oracle-confidence idea before it evaporates",
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
              type: "file", size: 720, mtime: dayAgo(30),
              content: [
                `=== ${D.site.handle} ===`,
                "",
                `${D.profile.name_en} -- ${D.profile.role_en}, ${D.profile.affiliation_en}`,
                "",
                "## the site",
                "  about  research  projects  publications  experience  skills",
                "  now             calendar, synced from Google Calendar",
                "  cv              resume, Korean and English",
                "  chat            message me; it reaches my phone",
                "",
                "## the shell",
                "  cd ~            my files live under /home/jeongin",
                "  cd /            the whole tree",
                "  ls -a           hidden entries (there are more than you think)",
                "  tree            layout at a glance",
                "  find / grep     search names and contents (-a includes hidden)",
                "  head tail wc    the usual text tools; pipes work",
                "  man <cmd>       usage for any command here",
                "  help  or  ?     everything at once",
                "",
                "This filesystem is real: du, df and ls -l are computed from the same",
                "tree, so they agree. It is mounted read-only, so writes fail honestly.",
              ],
            },
            "os-release": {
              type: "file", size: 200, mtime: dayAgo(60),
              content: [
                `NAME="JIKOS"`,
                `VERSION="1.0 (${D.site.handle})"`,
                `VERSION_ID="1.0"`,
                `ID=jikos`,
                `PRETTY_NAME="JIKOS 1.0"`,
                `HOME_URL="https://${D.site.domain}"`,
                `SUPPORT_URL="https://${D.site.domain}"`,
              ],
            },
            "passwd": {
              type: "file", size: 160, mtime: dayAgo(400),
              content: [
                "# partial — only the interesting accounts",
                "jeongin:x:1000:1000:Master's candidate:/home/jeongin:/bin/bash",
                "stlab:x:1001:1001:Software Testing Lab:/home/stlab:/bin/bash",
                "memo:x:1002:1002:scratchpad:/home/memo:/bin/bash",
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
                    "seminar: IT-5 403 (whiteboard sessions)",
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
  let cwd = store.get(CWD_KEY) || HOME;
  function getCwd() { return cwd; }
  function setCwd(p) {
    cwd = normalize(p);
    store.set(CWD_KEY, cwd);
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
  function ls(args, piped) {
    const { flags, rest } = parseArgs(args);
    const target = rest[0] || cwd;
    const { path, node } = resolve(target);
    if (!node) return [{ kind: "text", text: `ls: ${target}: No such file or directory`, warn: true }];
    if (node.type === "file" || node.type === "link") {
      return formatLs([[basename(path), node]], path, flags, piped);
    }
    let entries = Object.entries(node.children);
    if (!flags.has("a")) entries = entries.filter(([n, e]) => !n.startsWith(".") && !e.hidden);
    if (flags.has("t")) entries.sort((a, b) => b[1].mtime - a[1].mtime);
    else if (flags.has("S")) entries.sort((a, b) => (b[1].size || 0) - (a[1].size || 0));
    else entries.sort((a, b) => a[0].localeCompare(b[0]));
    if (flags.has("r")) entries.reverse();
    return formatLs(entries, path, flags, piped);
  }

  function basename(p) { return p === "/" ? "/" : p.slice(p.lastIndexOf("/") + 1); }

  function formatLs(entries, dirPath, flags, piped) {
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
        blocks.push({
          kind: "text", text: line, dim: e.hidden,
          parts: [
            { t: `${mode}  1 jeongin  staff ${size} ${when} `, c: "meta" },
            { t: display, c: e.type === "dir" ? "dir" : e.type === "link" ? "link" : null },
          ],
        });
      }
    } else {
      const decorate = ([n, e]) => ({
        t: e.type === "dir" ? n + "/" : e.type === "link" ? n + "@" : n,
        // Same convention as ls --color: directories blue, symlinks cyan, hidden dim.
        c: e.type === "dir" ? "dir" : e.type === "link" ? "link" : (n.startsWith(".") || e.hidden) ? "faint" : null,
      });
      // Real ls goes one-per-line when stdout is not a tty, which is what makes
      // `ls | wc -l` mean anything. -1 asks for it explicitly.
      if (piped || flags.has("1")) entries.forEach(en => { const d = decorate(en); blocks.push({ kind: "text", text: d.t, parts: [d] }); });
      else if (!entries.length) blocks.push({ kind: "text", text: "(empty)", dim: true });
      else {
        const parts = [];
        entries.forEach((en, i) => { if (i) parts.push({ t: "  " }); parts.push(decorate(en)); });
        blocks.push({ kind: "text", text: parts.map(p => p.t).join(""), parts });
      }
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
    const { flags, rest } = parseArgs(args);
    if (!rest.length) return [{ kind: "text", text: "cat: missing operand", warn: true }];
    const number = flags.has("n") || flags.has("b");   // -b skips blank lines
    let lineNo = 0;
    const out = [];
    for (const a of rest) {
      const { path, node } = resolve(a);
      if (!node) { out.push({ kind: "text", text: `cat: ${a}: No such file or directory`, warn: true }); continue; }
      if (node.type === "dir") { out.push({ kind: "text", text: `cat: ${a}: Is a directory`, warn: true }); continue; }
      if (node.type === "link") { out.push({ kind: "link", href: node.target, text: node.content[0] }); continue; }
      node.content.forEach(line => {
        if (!number) return out.push({ kind: "text", text: line });
        if (flags.has("b") && !String(line).trim()) return out.push({ kind: "text", text: line });
        out.push({ kind: "text", text: String(++lineNo).padStart(6) + "	" + line });
      });
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

  // tree: recursive, ASCII branches. `-a` to include hidden files.
  function tree(args) {
    // -L takes a number, which parseArgs would otherwise shred into flags.
    let maxDepth = Infinity;
    const argv = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-L" && /^[0-9]+$/.test(args[i + 1] || "")) maxDepth = parseInt(args[++i], 10);
      else argv.push(args[i]);
    }
    const { flags, rest } = parseArgs(argv);
    const target = rest[0] || cwd;
    const { path, node } = resolve(target);
    if (!node) return [{ kind: "text", text: `tree: ${target}: No such file or directory`, warn: true }];
    if (node.type !== "dir") return [{ kind: "text", text: basename(path) }];

    const showHidden = flags.has("a");
    const lines = [];
    const counts = { dirs: 0, files: 0 };

    const header = path === "/" ? `${window.SITE_DATA.site.domain}/` : "." + path;
    lines.push({ kind: "text", text: header });

    function walk(dirNode, prefix, depth = 1) {
      if (depth > maxDepth) return;
      let entries = Object.entries(dirNode.children);
      if (!showHidden) entries = entries.filter(([n, e]) => !n.startsWith(".") && !e.hidden);
      entries.sort(([a], [b]) => a.localeCompare(b));

      entries.forEach(([name, child], i) => {
        const isLast = i === entries.length - 1;
        // ASCII branches, like `tree --charset=ascii`. The Unicode ones are
        // ambiguous-width and shear the indentation under a CJK fallback font.
        const branch = isLast ? "`-- " : "|-- ";
        const nextPrefix = prefix + (isLast ? "    " : "|   ");
        let display;
        if (child.type === "dir") { display = name + "/"; counts.dirs++; }
        else if (child.type === "link") { display = `${name} -> ${child.target}`; counts.files++; }
        else { display = name; counts.files++; }
        lines.push({ kind: "text", text: prefix + branch + display });
        if (child.type === "dir") walk(child, nextPrefix, depth + 1);
      });
    }

    walk(node, "");
    lines.push({ kind: "text", text: "" });
    lines.push({ kind: "text", text: `${counts.dirs} directories, ${counts.files} files.`, dim: true });
    return lines;
  }

  // find: walk tree under <path> (or cwd), print matching entries.
  //   find                 — everything under cwd
  //   find /etc            — everything under /etc
  //   find . -name "*.md"  — filter by name glob
  //   find / -name secret* — glob works without quotes too
  function find(args) {
    // Pull `-name <pattern>` out before parseArgs. That helper splits any -xyz into
    // single-char flags, so -name used to set the `a` flag as a side effect (hidden
    // files always shown) and leave the pattern sitting in rest[0] as a bogus start path.
    const argv = [];
    let pattern = null, typeFilter = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-name" && args[i + 1] !== undefined) pattern = args[++i].replace(/^["']|["']$/g, "");
      else if (args[i] === "-type" && args[i + 1] !== undefined) typeFilter = args[++i];
      else argv.push(args[i]);
    }
    const { flags, rest } = parseArgs(argv);
    let start = rest[0] || cwd;
    // `find love` (single bare arg that doesn't look like a path) → treat as name pattern.
    const bareTerm = !pattern && rest.length === 1 && !rest[0].startsWith("/") && !rest[0].startsWith(".") && !rest[0].startsWith("~");
    if (bareTerm) { pattern = rest[0]; start = cwd; }

    const { path: startPath, node } = resolve(start);
    if (!node) return [{ kind: "text", text: `find: ${start}: No such file or directory`, warn: true }];

    const showHidden = flags.has("a") || (pattern && pattern.startsWith("."));
    const re = pattern ? globToRegex(pattern) : null;
    const results = [];

    function walk(n, p) {
      const name = p === "/" ? "/" : p.slice(p.lastIndexOf("/") + 1);
      const typeOk = !typeFilter
        || (typeFilter === "f" && n.type === "file")
        || (typeFilter === "d" && n.type === "dir")
        || (typeFilter === "l" && n.type === "link");
      if (typeOk && (!re || re.test(name))) results.push(p);
      if (n.type !== "dir") return;
      for (const [cn, ch] of Object.entries(n.children)) {
        if (!showHidden && (cn.startsWith(".") || ch.hidden)) continue;
        walk(ch, p === "/" ? "/" + cn : p + "/" + cn);
      }
    }
    walk(node, startPath);

    const MAX = 200;
    const out = [];
    if (!results.length) out.push({ kind: "text", text: "(no matches)", dim: true });
    else {
      results.slice(0, MAX).forEach(p => out.push({ kind: "text", text: p }));
      if (results.length > MAX) out.push({ kind: "text", text: `(truncated: ${results.length - MAX} more)`, dim: true });
    }
    return out;
  }

  // grep: search file contents under <path> (recursive by default).
  //   grep <pattern>              — search under cwd
  //   grep <pattern> <path>       — search under <path>
  //   grep -i <pattern> <path>    — case insensitive
  //   grep -n <pattern> <path>    — show line numbers
  //   grep -a <pattern> <path>    — include hidden files
  function grep(args, lang, stdin) {
    // -A/-B/-C take counts, so pull them out before flag splitting.
    let after = 0, before = 0;
    const argv = [];
    for (let i = 0; i < args.length; i++) {
      const m = String(args[i]).match(/^-([ABC])([0-9]*)$/);
      if (m) {
        const n = m[2] !== "" ? parseInt(m[2], 10)
                : /^[0-9]+$/.test(args[i + 1] || "") ? parseInt(args[++i], 10) : 2;
        if (m[1] !== "B") after = n;
        if (m[1] !== "A") before = n;
        continue;
      }
      argv.push(args[i]);
    }
    const { flags, rest } = parseArgs(argv);
    if (rest.length < 1) return [{ kind: "text", text: "usage: grep [-i] [-n] [-a] [-v] <pattern> [path]", warn: true }];
    const pattern = rest[0];
    const target = rest[1] || cwd;
    const showLine = flags.has("n");

    let re;
    try { re = new RegExp(pattern, flags.has("i") ? "i" : ""); }
    catch { re = new RegExp(escapeRe(pattern), flags.has("i") ? "i" : ""); }
    const hit = (line) => re.test(line) !== flags.has("v");

    // Downstream of a pipe grep filters stdin and ignores path operands, same as
    // the real thing reading from a pipe instead of walking a tree.
    if (stdin) {
      const out = stdin.filter(hit)
        .map((l, i) => ({ kind: "text", text: showLine ? `${i + 1}: ${l}` : (l) }));
      return out.length ? out : [{ kind: "text", text: "(no matches)", dim: true }];
    }

    const { path: rootPath, node } = resolve(target);
    if (!node) return [{ kind: "text", text: `grep: ${target}: No such file or directory`, warn: true }];

    const results = [];
    function grepFile(f, p) {
      if (!f.content) return;
      const marks = new Set();
      f.content.forEach((line, i) => {
        if (!hit(line)) return;
        marks.add(i);
        for (let k = 1; k <= before; k++) if (i - k >= 0) marks.add(i - k);
        for (let k = 1; k <= after; k++) if (i + k < f.content.length) marks.add(i + k);
      });
      [...marks].sort((a, b) => a - b).forEach(i => {
        // Context lines use a dash separator, matching GNU grep.
        const sep = hit(f.content[i]) ? ":" : "-";
        const prefix = showLine ? `${p}${sep}${i + 1}${sep} ` : `${p}${sep} `;
        results.push(prefix + f.content[i]);
      });
    }
    function walk(n, p) {
      if (n.type === "file") grepFile(n, p);
      else if (n.type === "dir") {
        for (const [cn, ch] of Object.entries(n.children)) {
          // -a to include hidden, matching ls/find/tree. Without it the .lab and
          // .midnight drafts would surface in plain `grep <word> /`.
          if (!flags.has("a") && (cn.startsWith(".") || ch.hidden)) continue;
          walk(ch, p === "/" ? "/" + cn : p + "/" + cn);
        }
      }
    }
    walk(node, rootPath);

    // -c counts, -l names the files. Both beat scrolling a full match list when
    // the question is "how many" or "where".
    if (flags.has("c")) return [{ kind: "text", text: String(results.length) }];
    if (flags.has("l")) {
      const files = [...new Set(results.map(r => r.slice(0, r.indexOf(":"))))];
      return files.length ? files.map(f => ({ kind: "text", text: f }))
                          : [{ kind: "text", text: "(no matches)", dim: true }];
    }

    const MAX = 200;
    const out = [];
    if (!results.length) out.push({ kind: "text", text: "(no matches)", dim: true });
    else {
      results.slice(0, MAX).forEach(l => out.push({ kind: "text", text: l }));
      if (results.length > MAX) out.push({ kind: "text", text: `(truncated: ${results.length - MAX} more)`, dim: true });
    }
    return out;
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

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
    store.set(CWD_KEY, HOME);
  }

  window.FS = { root, getCwd, setCwd, displayCwd, normalize, resolve, ls, cd, pwd, cat, tree, find, grep, complete };
})();
