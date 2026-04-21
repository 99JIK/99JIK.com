// Virtual filesystem — real-feeling ls/cd/pwd/cat over site content.
// Tree is built from SITE_DATA so projects/publications/etc stay in sync with data.js.

(function () {
  const CWD_KEY = "99jik:cwd";

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

    return {
      type: "dir",
      mtime: dayAgo(0),
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
  }

  let ROOT = null;
  function root() { if (!ROOT) ROOT = buildTree(); return ROOT; }

  // cwd is a string like "/" or "/projects"
  let cwd = localStorage.getItem(CWD_KEY) || "/";
  function getCwd() { return cwd; }
  function setCwd(p) {
    cwd = normalize(p);
    localStorage.setItem(CWD_KEY, cwd);
    window.dispatchEvent(new CustomEvent("promptpath"));
  }
  function displayCwd() { return cwd === "/" ? "~" : "~" + cwd; }

  // path utilities
  function split(p) { return p.split("/").filter(Boolean); }
  function join(parts) { return "/" + parts.join("/"); }
  function normalize(p) {
    if (!p) return cwd;
    let parts;
    if (p.startsWith("/")) parts = split(p);
    else if (p === "~" || p.startsWith("~/")) parts = split(p.slice(1));
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
    return [{ kind: "text", text: cwd === "/" ? "/home/jeongin" : "/home/jeongin" + cwd }];
  }

  function cd(args) {
    const target = args[0] || "/";
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

  window.FS = { root, getCwd, setCwd, displayCwd, normalize, resolve, ls, cd, pwd, cat, tree, complete };
})();
