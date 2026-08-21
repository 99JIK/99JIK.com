// Virtual filesystem - real-feeling ls/cd/pwd/cat over site content.
// Tree is built from SITE_DATA so projects/publications/etc stay in sync with data.js.

(function () {
  const CWD_KEY = "99jik:cwd:v2"; // bumped: layout moved under /home/jeongin
  const HOME = "/home/jeongin";

  const store = window.PREFS.store;  // guarded localStorage, see prefs.js

  // ~/Desktop is a real directory holding real .desktop files, which is what a
  // desktop is on the system this is imitating. The icons are drawn from these, so
  // the file manager and the desktop cannot show different things: they are the
  // same folder. `Exec` names an app in desktop.jsx, which validates it.
  const LAUNCHERS = [
    { file: "terminal.desktop", name: "Terminal", exec: "terminal", icon: "terminal",
      comment: "The shell this whole place is shaped like" },
    { file: "files.desktop",    name: "Files",    exec: "files",    icon: "files",
      comment: "Browse this filesystem without typing" },
    { file: "browser.desktop",  name: "Browser",  exec: "browser",  icon: "browser",
      comment: "For the part of the web that permits being framed" },
    { file: "calendar.desktop", name: "Calendar", exec: "calendar", icon: "calendar",
      comment: "What the weeks look like, and how to take one of the gaps" },
    { file: "chat.desktop",     name: "Chat",     exec: "chat",     icon: "chat",
      comment: "Reaches a phone; replies come back here" },
    { file: "music.desktop",    name: "Music",    exec: "music",    icon: "music",
      comment: "The playlist, read live from YouTube" },
  ];

  // The one file on the desktop that is not a launcher. It points the way and then
  // gets out of it: what is here, and how to start looking. Not a tour of how it was
  // built, and not a list of the things that are more fun to find.
  function README(D) {
    return [
      "# 어서 오세요",
      "",
      "터미널을 흉내 낸 사이트입니다. 실제 리눅스 셸을 따라 만들었고,",
      "생각보다 많은 명령이 실제로 동작합니다. 뭐가 되는지 찾아보는 것도",
      "나름의 재미일 겁니다.",
      "",
      "## 급하시면",
      "",
      "아래 독의 **Easy Mode**. 같은 내용이 평범한 문서로 나옵니다.",
      "",
      "## 터미널",
      "",
      "궁금한 것부터 치면 됩니다.",
      "",
      "```",
      "about         짧은 소개",
      "research      연구 관심사",
      "projects      만든 것들",
      "publications  논문",
      "now           요즘 일정",
      "contact       연락처",
      "```",
      "",
      "`help` 로 전체 목록, `man <명령>` 으로 각각의 사용법을 봅니다.",
      "파이프도 됩니다. `ls | wc -l`",
      "",
      "여기부터는 직접 돌아다니는 편이 낫습니다. `ls`, `cd`, `cat`, `tree`,",
      "`find`, `grep` 이 되고, `~` 아래에 보이는 것보다 좀 더 있습니다.",
      "",
      "## 바탕화면",
      "",
      "아이콘은 `~/Desktop` 폴더입니다. 파일 창으로 들어가면 같은 게 보입니다.",
      "",
      "- 배경과 파일 창 안에서 **우클릭**",
      "- 창을 가장자리로 끌면 스냅, 아무 변이나 모서리로 크기 조절",
      "- 단축키는 **설정** 창에 (`Ctrl+Alt+,`)",
      "- 창 배치는 이 브라우저에 남아서 다음에 와도 그대로입니다",
      "",
      "---",
      "",
      "# Welcome",
      "",
      "A site shaped like a terminal. It follows a real shell closely enough that a",
      "surprising number of commands work; finding out which is part of the point.",
      "",
      "**In a hurry?** **Easy Mode** in the dock has the same content as a document.",
      "",
      "**In the terminal**, start with `about`, `research`, `projects`,",
      "`publications`, `now`, `contact`. `help` lists everything, `man <cmd>`",
      "explains one, and pipes work (`ls | wc -l`).",
      "",
      "After that, look around: `ls`, `cd`, `cat`, `tree`, `find` and `grep` all do",
      "what you would expect, and there is a little more under `~` than shows up.",
      "",
      "**The desktop.** Icons are the contents of `~/Desktop`. Right-click the",
      "wallpaper and inside Files, drag a window to an edge to snap it, and find the",
      "shortcuts in **Settings**. Your layout stays in this browser.",
      "",
      "---",
      "",
      "[" + D.site.domain + "](https://" + D.site.domain + ") · " + D.profile.email,
    ];
  }

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
        mtime: dayAgo(i + 1),
        content: [
          `# ${p.title_en} (${p.year})`,
          `slug: ${p.slug}`,
          `stack: ${p.stack.join(", ")}`,
          `featured: ${p.featured ? "yes" : "no"}`,
          "",
          p.summary_en,
          p.summary_ko,
          ...((p.detail_en || []).length ? ["", ...p.detail_en.map(d => "- " + d)] : []),
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
        mtime: dayAgo(10 + i),
        content: [
          `# ${r.title_en}`,
          `tag: ${r.tag}`,
          "",
          r.blurb_en,
        ],
      };
    });

    // Files sitting in public/home, injected at build time. The tree on disk is the
    // tree here: public/home/papers/x.pdf lands at ~/papers/x.pdf. Same origin, so
    // the PDF viewer's blob fetch always succeeds and there is nothing to negotiate.
    const drop = typeof __DROP__ !== "undefined" ? __DROP__ : [];

    // Merge one dropped file into a children map, making the directories it needs.
    // A dropped file wins over a built-in of the same name: putting a file there is
    // a deliberate act, so it should be the one that shows up.
    function graft(children, e) {
      const parts = e.path.split("/");
      const name = parts.pop();
      let at = children;
      for (const seg of parts) {
        if (!at[seg] || at[seg].type !== "dir") at[seg] = { type: "dir", mtime: e.mtime, children: {} };
        at = at[seg].children;
      }
      const url = "/home/" + e.path;
      if (e.kind === "pdf") {
        at[name] = { type: "file", mtime: e.mtime, size: e.size,
                     pdf: { ko: url }, content: ["%PDF (fetched on open)", url] };
      } else if (e.kind === "text") {
        at[name] = { type: "file", mtime: e.mtime, size: e.size, content: e.content };
      } else {
        // Nothing here can render it, so hand it to the browser instead of pretending.
        at[name] = { type: "link", mtime: e.mtime, size: e.size, target: url };
      }
    }

    // Jeongin's home - all the personal / portfolio content lives here.
    const jeonginHome = {
      type: "dir", mtime: dayAgo(0),
      children: {
        "about": {
          type: "file", mtime: dayAgo(0),
          content: [
            `${D.profile.name_en} (${D.profile.name_ko})`,
            `${D.profile.role_en} -- ${D.profile.affiliation_en}`,
            `${D.profile.location_en}`,
            "",
            "I work at the intersection of software testing and language models.",
            "Teaching both sides to reason about correctness together.",
          ],
        },
        "Desktop": {
          type: "dir", mtime: dayAgo(0),
          children: Object.assign({
            "README.md": { type: "file", mtime: dayAgo(0), content: README(D) },
            // A file, not a launcher. The PDF window is a PDF viewer, so the CV can
            // be the document it is and open the way any document opens.
            "이력서.pdf": {
              type: "file", mtime: dayAgo(2), size: 0,
              pdf: { ko: D.site.cvKo, en: D.site.cvEn },
              content: [
                "%PDF (fetched on open)",
                "ko: " + D.site.cvKo,
                "en: " + D.site.cvEn,
              ],
            },
          }, Object.fromEntries(LAUNCHERS.map((a, i) => [a.file, {
            type: "file", mtime: dayAgo(30 + i),
            content: [
              "[Desktop Entry]",
              "Type=Application",
              "Name=" + a.name,
              "Comment=" + a.comment,
              "Exec=" + a.exec,
              "Icon=" + a.icon,
              "Terminal=false",
            ],
          }]))),
        },
        "projects": { type: "dir", mtime: dayAgo(1), children: projectsDir },
        "research": { type: "dir", mtime: dayAgo(7), children: researchDir },
        "publications.txt": {
          type: "file", mtime: dayAgo(3),
          content: D.publications.flatMap(p => [
            `${p.year}  ${p.venue}${p.pages ? ", pp." + p.pages : ""}`,
            `  ${p.title_ko}`,
            `  ${p.title_en}`,
            `  ${p.authors}`,
            "",
          ]).slice(0, -1),
        },
        "patents.txt": {
          type: "file", mtime: dayAgo(3),
          content: (D.patents || []).flatMap(x => [
            `${x.year}  ${x.title_ko}`,
            `      ${x.title_en}`,
            `      ${x.status_en}. ${x.holder_en}.`,
          ]),
        },
        "skills.json": {
          type: "file", mtime: dayAgo(14),
          content: JSON.stringify(D.skills, null, 2).split("\n"),
        },
        "contact": {
          type: "file", mtime: dayAgo(30),
          content: [
            `email:    ${D.profile.email}`,
            `github:   github.com/${D.profile.github}`,
            `linkedin: linkedin.com/in/${D.profile.linkedin}`,
            `til:      ${D.site.til}`,
          ],
        },
        // Read from the calendar when opened. What I am on lately is already recorded
        // somewhere honest, so typing it a second time would only let the two drift.
        "now.log": {
          type: "file", mtime: dayAgo(0), live: "now", size: 0,
          content: ["(generated on read from the calendar)"],
        },
        // Not a stub PDF pretending to be the real thing: the CV lives in another
        // repo, so this is a link to it, the same as ~/til.
        "cv": {
          type: "link", target: D.site.cvKo, mtime: dayAgo(21),
          content: [`symlink -> ${D.site.cvKo}`],
        },
        ".lab": {
          type: "dir", mtime: dayAgo(1), hidden: true,
          children: {
            // What stays true when the topic changes.
            // grad.md is the lab as an organisation; this is the research itself.
            "principles.md": {
              type: "file", mtime: dayAgo(2),
              content: D.notes.principles,
            },
            // The lab as an organisation, as opposed to principles.md, which is
            // about the research.
            "grad.md": {
              type: "file", mtime: dayAgo(2),
              content: D.notes.grad,
            },
          },
        },
        ".midnight": {
          type: "dir", mtime: dayAgo(3), hidden: true,
          children: {
            "playlist.m3u": {
              // Read live from the YouTube Data API when opened, so it is an actual
              // playlist rather than a list of bands someone thought sounded right.
              type: "file", mtime: dayAgo(0),
              live: D.site.youtubePlaylistId ? "playlist" : null,
              size: D.site.youtubePlaylistId ? 0 : undefined,
              content: D.site.youtubePlaylistId
                ? ["(generated on read from the YouTube playlist)"]
                : ["#EXTM3U", "", "(no playlist configured)"],
            },
          },
        },
        "repos": {
          // Read from the GitHub API when opened. The `projects` command shows a
          // curated few; this is everything that actually exists.
          type: "file", mtime: dayAgo(0), live: "repos", size: 0,
          content: ["(generated on read from api.github.com)"],
        },
        "til": {
          type: "link", target: D.site.tilUrl, mtime: dayAgo(1), size: 22,
          content: [`symlink -> ${D.site.tilUrl}`],
        },
      },
    };

    for (const e of drop) graft(jeonginHome.children, e);

    // The full machine: /etc, /home/{jeongin,memo,stlab}, /tmp, /var, /bin.
    return {
      type: "dir", mtime: dayAgo(0),
      children: {
        "bin": {
          type: "dir", mtime: dayAgo(365),
          children: {
            "README": {
              type: "file", mtime: dayAgo(365),
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
              type: "file", mtime: dayAgo(500),
              content: [D.site.handle],
            },
            "motd": {
              type: "file", mtime: dayAgo(30),
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
                "  cat /var/log/deploy.log   commit history, read live",
                "  cat /home/memo/til.log    recent notes from " + D.site.til + ", read live",
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
              type: "file", mtime: dayAgo(60),
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
              type: "file", mtime: dayAgo(400),
              content: [
                "# partial: only the interesting accounts",
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
                  type: "file", mtime: dayAgo(0),
                  content: [
                    "# memo/",
                    "",
                    "Domain knowledge picked up while working. The things that cost an",
                    "afternoon to find out and would cost another one to rediscover.",
                    "",
                    "  work.md          working principles, kept out of the lab notes",
                    "  social.md        how the writing lands, mail included",
                    "",
                    "",
                    "One file per domain, listed in src/data.js under notes.memo:",
                    ...(D.notes.memo.length
                      ? D.notes.memo.map(m => `  ${m.file.padEnd(16)} ${m.title}`)
                      : ["  (none yet)"]),
                  ],
                },
                "social.md": {
                  type: "file", mtime: dayAgo(2),
                  content: D.notes.social,
                },
                "work.md": {
                  // The counterpart to ~/.lab/principles.md: the same person, the
                  // other setting.
                  type: "file", mtime: dayAgo(2),
                  content: D.notes.work,
                },
                // One file per domain rather than one notes.md for everything: a
                // simulator gotcha and something learned on the job are not the
                // same subject and do not get read at the same time.
                ...Object.fromEntries(D.notes.memo.map((m, i) => [
                  m.file,
                  { type: "file", mtime: dayAgo(i), content: m.md },
                ])),
                "til.log": {
                  // Generated on read from the live feed, so it reports zero bytes
                  // the way a /proc file does. Fetching 300KB of RSS on every page
                  // load for a file most visitors never open is not worth it.
                  type: "file", mtime: dayAgo(0), live: "til", size: 0,
                  content: ["(generated on read from " + D.site.til + ")"],
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
                  type: "file", mtime: dayAgo(60),
                  content: [
                    "# Software Testing Lab, KNU",
                    "",
                    "Principal investigator, students, papers, meetings.",
                    "homepage symlink → selab.knu.ac.kr",
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
              type: "file", mtime: dayAgo(0),
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
                "deploy.log": {
                  // Read from the GitHub API when opened. The build no longer bakes
                  // commit history in, so the log is current without a deploy.
                  type: "file", mtime: dayAgo(0), live: "commits", size: 0,
                  content: ["(generated on read from api.github.com)"],
                },
              },
            },
          },
        },
      },
    };
  }

  // Sizes come from the content, not from a number someone typed. That is what makes
  // `ls -l`, `wc -c`, `du` and `df` agree with each other and with `cat`.
  function measure(node) {
    if (node.type === "dir") {
      for (const child of Object.values(node.children)) measure(child);
      return;
    }
    if (node.type === "link") { node.size = (node.target || "").length; return; }
    // A live file has no length until something reads it, so ls -l reports 0 the way
    // it does for /proc. Measuring the placeholder would print a number that is not
    // the size of anything.
    if (node.live) { node.size = 0; return; }
    // Files end with a newline, as they do on any POSIX system, so ls -l and wc -c agree.
    const text = (node.content || []).join(String.fromCharCode(10)) + String.fromCharCode(10);
    node.size = new TextEncoder().encode(text).length;
  }

  // TIL is a separate site, but GitHub Pages serves its feed with
  // Access-Control-Allow-Origin: *, so the browser can read it directly. Live beats a
  // build-time snapshot here: notes get written far more often than this site deploys.
  function parseFeed(xml, limit) {
    const pick = (block, tag) => {
      const open = "<" + tag + ">", close = "</" + tag + ">";
      const a = block.indexOf(open);
      if (a < 0) return "";
      const b = block.indexOf(close, a + open.length);
      if (b < 0) return "";
      let v = block.slice(a + open.length, b).trim();
      const CD = "<![CDATA[";
      if (v.startsWith(CD)) v = v.slice(CD.length);
      if (v.endsWith("]]>")) v = v.slice(0, -3);
      return v.trim();
    };
    return xml.split("<item>").slice(1, limit + 1).map(block => {
      const d = new Date(pick(block, "pubDate"));
      return {
        title: pick(block, "title"),
        link: pick(block, "link"),
        date: isNaN(d) ? "" : d.toISOString().slice(0, 10),
      };
    }).filter(x => x.title);
  }

  let ROOT = null;
  function root() {
    if (!ROOT) {
      ROOT = buildTree();
      measure(ROOT);
    }
    return ROOT;
  }

  // cwd is an absolute path string like "/home/jeongin" or "/etc".
  let cwd = store.get(CWD_KEY) || HOME;
  function getCwd() { return cwd; }
  // Point the filesystem at a directory without recording it. There can be more
  // than one terminal now, each standing somewhere different, so each one sets this
  // to its own directory before it runs anything and reads it back afterwards.
  // setCwd still persists, so a new shell opens where the last `cd` left off.
  function enter(p) { cwd = normalize(p || HOME); }
  function setCwd(p) {
    cwd = normalize(p);
    store.set(CWD_KEY, cwd);
    window.dispatchEvent(new CustomEvent("promptpath"));
  }
  // Display: render HOME and its descendants as `~` / `~/...`; otherwise show full path.
  // Takes an explicit path so a terminal can render its own prompt without first
  // pointing the filesystem at itself.
  function displayCwd(p) {
    const at = p || cwd;
    if (at === HOME) return "~";
    if (at.startsWith(HOME + "/")) return "~" + at.slice(HOME.length);
    return at;
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
      // Generated on read: the content comes from the network, so it renders as a
      // component. Same trade-off as curl, and it cannot be piped.
      if (node.live) { out.push({ kind: "live", source: node.live, path }); continue; }
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
    // partial is e.g. "proj" or "projects/sil" - complete the last segment
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
  //   find                 - everything under cwd
  //   find /etc            - everything under /etc
  //   find . -name "*.md"  - filter by name glob
  //   find / -name secret* - glob works without quotes too
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
  //   grep <pattern>              - search under cwd
  //   grep <pattern> <path>       - search under <path>
  //   grep -i <pattern> <path>    - case insensitive
  //   grep -n <pattern> <path>    - show line numbers
  //   grep -a <pattern> <path>    - include hidden files
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

  // Validate stored cwd against the current tree - if it points to a path
  // that no longer exists (old structure, renamed dir, etc.), reset to HOME.
  if (!resolve(cwd).node) {
    cwd = HOME;
    store.set(CWD_KEY, HOME);
  }

  // What counts as a PDF, in one place because two openers were about to disagree.
  // An extension is the usual signal, but arXiv serves at /pdf/<id> with no
  // extension at all and that is the single most likely PDF anyone here will open.
  window.looksLikePdf = (u) => {
    const s = String(u || "");
    return /\.pdf(\?|#|$)/i.test(s) || /\/pdf\//i.test(s);
  };

  window.FS = { root, getCwd, setCwd, enter, displayCwd, normalize, resolve, ls, cd, pwd, cat, tree, find, grep, complete, parseFeed };
})();
