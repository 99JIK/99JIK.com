// Terminal commands, i18n-aware. All user-facing strings exist in ko/en.
// Blocks are computed fresh each run, with `lang` passed from the view.

(function () {
  const D = () => window.SITE_DATA;

  // simple bilingual strings lookup used across commands
  const S = {
    avail:       { ko: "사용 가능한 명령", en: "Available commands" },
    shell_h:     { ko: "셸 명령", en: "Shell commands" },
    shell_tip:   { ko: "`man <명령>` 으로 사용법 · 파이프도 됩니다 (`ls | wc -l`)", en: "`man <cmd>` for usage · pipes work too (`ls | wc -l`)" },
    tip:         { ko: "Tab 자동완성 (두 번 누르면 후보) · ↑↓ 히스토리 · Alt-R 검색 · Ctrl-A/E/U/K · Alt-Backspace", en: "Tab completes (twice to list) · up/down for history · Alt-R to search · Ctrl-A/E/U/K · Alt-Backspace" },
    research_h:  { ko: "연구 관심사", en: "Research interests" },
    projects_h:  { ko: "cat <slug> 으로 자세히 봅니다.", en: "`cat <slug>` for details." },
    // `now` renders through the NowBlock component, which owns its own strings
    // (view strings live with the view, same as terminal-view.jsx's T object).
    pubs_h:      { ko: "논문 / 글", en: "Publications" },
    pat_h:       { ko: "특허", en: "Patents" },
    exp_h:       { ko: "경력 및 학력", en: "Experience & Education" },
    ls_nodir:    { ko: (d) => `ls: ${d}: 그런 디렉토리는 없습니다. try: ls projects`, en: (d) => `ls: ${d}: no such directory. try: ls projects` },
    cat_usage:   {
      ko: () => { const s = D().projects[0]?.slug || "<slug>"; return `usage: cat <slug>  - 예: cat ${s}`; },
      en: () => { const s = D().projects[0]?.slug || "<slug>"; return `usage: cat <slug>  - e.g. cat ${s}`; },
    },
    cat_nf:      { ko: (s) => `cat: ${s}: 파일을 찾지 못했어요.`, en: (s) => `cat: ${s}: not found.` },
    stack:       { ko: "스택", en: "stack" },
    read_repo:   { ko: (slug) => `github.com/${D().site.github}/${slug} 로 이동 →`, en: (slug) => `open → github.com/${D().site.github}/${slug}` },
    cv_open:     { ko: "CV 링크입니다. 한국어판과 영문판이 따로 있어요.", en: "CV is available in Korean and English." },
    cv_ko:       { ko: "CV (한국어) 열기 ↗", en: "CV (Korean) ↗" },
    cv_en:       { ko: "CV (영문) 열기 ↗", en: "CV (English) ↗" },
    book_msg:    { ko: "빈 시간을 골라 바로 잡으시면 됩니다.", en: "Pick an open slot and it books itself." },
    book_link:   { ko: "시간 예약하기 ↗", en: "Book a time ↗" },
    til_go:      { ko: () => `→ ${D().site.til} 으로 이동합니다`, en: () => `→ heading to ${D().site.til}` },
    til_link:    { ko: () => `${D().site.til} 열기 ↗`, en: () => `open ${D().site.til} ↗` },
    nf:          { ko: (c) => `명령을 찾지 못했어요: ${c}. 'help' 또는 '?' 를 눌러보세요`, en: (c) => `command not found: ${c}. try 'help' or '?'` },
    theme_usage: { ko: "usage: theme <name>  - 선택지:", en: "usage: theme <name>  - options:" },
    theme_unk:   { ko: (k) => `theme: ${k}: 모르는 테마`, en: (k) => `theme: ${k}: unknown` },
    easy_msg:    { ko: "Easy Mode 로 전환...", en: "switching to Easy Mode..." },
    lang_usage:  { ko: "usage: lang ko|en", en: "usage: lang ko|en" },
    lang_set:    { ko: (l) => `언어 → ${l}`, en: (l) => `lang → ${l}` },
    email:       { ko: "이메일", en: "email" },
    scholar_soon:{ ko: "(준비 중)", en: "(coming soon)" },
    chat_intro:  { ko: "채팅을 시작합니다. '/exit' 로 종료, '/clear' 로 비우기.", en: "Chat started. '/exit' to leave, '/clear' to reset." },
    chat_info:   {
      ko: () => `${D().profile.name_ko}에게 실시간으로 전달됩니다. 오프라인이면 조금 뒤에 답장이 올 수 있어요.`,
      en: () => `Delivered to ${D().profile.name_en.split(" ")[0]} in real time. If offline, replies may take a while.`,
    },
    hints: {
      help:     { ko: "사용 가능한 명령을 모두 보여줘요", en: "Show all available commands" },
      about:    { ko: "짧은 자기소개", en: "Short introduction" },
      research: { ko: "연구 관심사", en: "Research interests" },
      ls:       { ko: "파일 목록 보기", en: "List files" },
      projects: { ko: "프로젝트 전부 보기", en: "View all projects" },
      cat:      {
        ko: () => `특정 프로젝트 상세 (cat ${D().projects[0]?.slug || "<slug>"})`,
        en: () => `Project detail (cat ${D().projects[0]?.slug || "<slug>"})`,
      },
      publications: { ko: "논문 / 글", en: "Publications" },
      patents:  { ko: "특허", en: "Patents" },
      experience: { ko: "경력 / 학력", en: "Experience / Education" },
      skills:   { ko: "언어 · 도구 · 연구", en: "Languages · tools · research" },
      now:      { ko: "지금 무엇을 하고 있나요", en: "What I'm working on now" },
      contact:  { ko: "연락처", en: "Contact info" },
      cv:       { ko: "CV 다운로드", en: "Download CV" },
      til:      { ko: () => `TIL 사이트로 (${D().site.til})`, en: () => `Go to TIL (${D().site.til})` },
      chat:     {
        ko: () => `${D().profile.name_ko}에게 메시지 보내기`,
        en: () => `Send ${D().profile.name_en.split(" ")[0]} a message`,
      },
      book:     { ko: "만날 시간 예약하기", en: "Book a time to talk" },
      theme:    { ko: "테마 변경", en: "Change theme" },
      easy:     { ko: "Easy Mode (일반 뷰) 전환", en: "Switch to Easy Mode" },
      lang:     { ko: "언어 (ko|en) 전환", en: "Switch language (ko|en)" },
      clear:    { ko: "화면 지우기", en: "Clear screen" },
    },
  };

  // Aligned in text, coloured per segment. A div table was the wrong answer, but so
  // was flat monochrome: real terminal output uses colour to carry structure.
  function kvLines(rows, indent = "  ") {
    const w = rows.reduce((m, [k]) => Math.max(m, window.TEXT.cells(k)), 0);
    return rows.map(([k, v]) => ({
      kind: "text",
      text: indent + window.TEXT.padEnd(k, w + 2) + v,
      parts: [{ t: indent }, { t: window.TEXT.padEnd(k, w + 2), c: "key" }, { t: String(v) }],
    }));
  }

  const pick = (obj, lang, ...args) => {
    const v = obj[lang] ?? obj.ko;
    return typeof v === "function" ? v(...args) : v;
  };

  function buildCommands(lang) {
    const H = (k) => pick(S.hints[k], lang);
    const t = (k, ...args) => pick(S[k], lang, ...args);

    const C = {
      help: { usage: "help", hint: H("help"), run: () => {
        const visible = Object.entries(C).filter(([k]) => !C[k].hidden);
        const site = visible.filter(([, v]) => v.group !== "shell");
        const shell = visible.filter(([, v]) => v.group === "shell").map(([k]) => k).sort();
        return [
          { kind: "text", text: t("avail") + ":" },
          ...kvLines(site.map(([k, v]) => [k, v.hint])),
          { kind: "text", text: "" },
          { kind: "text", text: t("shell_h") + ":", strong: true },
          { kind: "text", text: "  " + shell.join("  ") },
          { kind: "text", text: t("shell_tip"), dim: true },
          { kind: "text", text: t("tip"), dim: true },
        ];
      }},
      "?": { hidden: true, usage: "?", hint: "= help", run: () => C.help.run() },

      about: { usage: "about", hint: H("about"), run: () => {
        const p = D().profile;
        const tag = D().intro.tagline[lang === "en" ? "en" : "ko"];
        const primary = lang === "ko" ? [`${p.name_ko} / ${p.name_en}`, `${p.role_ko} · ${p.affiliation_ko}`] : [`${p.name_en} / ${p.name_ko}`, `${p.role_en} · ${p.affiliation_en}`];
        const secondary = lang === "ko" ? `${p.role_en} · ${p.affiliation_en}` : `${p.role_ko} · ${p.affiliation_ko}`;
        return [
          { kind: "text", text: primary[0], strong: true },
          { kind: "text", text: primary[1] },
          { kind: "text", text: secondary, dim: true },
          { kind: "text", text: "" },
          { kind: "text", text: tag.primary },
          { kind: "text", text: tag.secondary, dim: true },
        ];
      }},

      research: { usage: "research", hint: H("research"), run: () => {
        const rows = D().research.map(r => [r.tag, lang === "ko" ? `${r.title_ko}: ${r.blurb_ko}` : `${r.title_en}: ${r.blurb_en}`]);
        return [{ kind: "text", text: t("research_h") + ":", strong: true }, ...kvLines(rows)];
      }},

      ls: { group: "shell", usage: "ls [-alrtS1] [path]", hint: H("ls"), run: (args, stdin, lang, piped) => window.FS.ls(args, piped) },
      cd: { group: "shell", usage: "cd [path]", hint: lang === "ko" ? "디렉토리 이동 (cd projects, cd .., cd ~)" : "change directory (cd projects, cd .., cd ~)", run: (args) => window.FS.cd(args) },
      pwd: { group: "shell", usage: "pwd", hint: lang === "ko" ? "현재 경로" : "print working directory", run: () => window.FS.pwd() },
      tree: { group: "shell", usage: "tree [-a] [-L N] [path]", hint: lang === "ko" ? "디렉토리 트리 (tree, tree projects, tree -a)" : "directory tree (tree, tree projects, tree -a)", run: (args) => window.FS.tree(args) },
      find: { group: "shell", usage: "find [path] [-a] [-type f|d|l] [-name <glob>]", hint: lang === "ko" ? "파일 찾기 (find /, find . -name *.md)" : "find files (find /, find . -name *.md)", run: (args) => window.FS.find(args) },
      grep: { group: "shell", usage: "grep [-inavcl] [-A N] [-B N] [-C N] <pattern> [path]", hint: lang === "ko" ? "내용 검색 (grep -i pattern /path)" : "search contents (grep -i pattern /path)", run: (args, stdin) => window.FS.grep(args, lang, stdin) },
      history: {
        group: "shell", usage: "history [-c] [N]",
        hint: lang === "ko" ? "입력한 명령 히스토리" : "show command history",
        run: (args) => {
          if (args && args[0] === "-c") return [{ kind: "mode", action: "history-clear" }];
          const limit = args && /^[0-9]+$/.test(args[0] || "") ? parseInt(args[0], 10) : null;
          let stack = window.TERM_HISTORY || [];
          if (limit) stack = stack.slice(-limit);
          if (!stack.length) return [{ kind: "text", text: lang === "ko" ? "(기록 없음)" : "(empty)", dim: true }];
          return stack.map((cmd, i) => ({ kind: "text", text: `  ${String(i + 1).padStart(4)}  ${cmd}` }));
        },
      },
      weather: {
        usage: "weather [city]",
        hint: lang === "ko" ? "현재 날씨 (weather, weather seoul)" : "current weather (weather, weather seoul)",
        run: (args) => [{ kind: "weather", location: args[0] || D().profile.weatherLocation }],
      },

      // Columns are padded by display cells, and that is only half of it: Hangul has
      // no glyphs in JetBrains Mono, so it comes from the next font in the stack,
      // whose advance is not reliably exactly twice the Latin one. Padding a Korean
      // column therefore drifts no matter how the cells are counted. The title goes
      // last instead, where nothing after it can be pushed out of line.
      projects: { usage: "projects", hint: H("projects"), run: () => {
        const P = window.TEXT.padEnd;
        const items = D().projects;
        const wSlug = items.reduce((m, p) => Math.max(m, window.TEXT.cells(p.slug)), 4);
        const wStack = items.reduce((m, p) => Math.max(m, window.TEXT.cells(p.stack.join(", "))), 5);
        return [
          { kind: "text", text: `${P("SLUG", wSlug + 2)}${P("YEAR", 6)}${P("STACK", wStack + 2)}TITLE`, dim: true },
          ...items.map(p => {
            const title = lang === "ko" ? p.title_ko : p.title_en;
            const stack = p.stack.join(", ");
            return {
              kind: "text",
              text: `${P(p.slug, wSlug + 2)}${P(p.year, 6)}${P(stack, wStack + 2)}${title}`,
              parts: [
                { t: P(p.slug, wSlug + 2), c: "key" },
                { t: P(p.year, 6), c: "num" },
                { t: P(stack, wStack + 2), c: "meta" },
                { t: title },
              ],
            };
          }),
          { kind: "text", text: "" },
          { kind: "text", text: t("projects_h"), dim: true },
        ];
      }},

      cat: { usage: "cat <slug|path...>", hint: H("cat"), run: (args) => {
        if (!args.length) return [{ kind: "text", text: t("cat_usage"), warn: true }];
        // First try as a project slug (pretty view)
        const p = D().projects.find(x => x.slug === args[0]);
        if (p && args.length === 1) {
          return [
            { kind: "text", text: `--- ${lang === "ko" ? p.title_ko : p.title_en} (${p.year}) ---`, strong: true },
            { kind: "text", text: `${t("stack")}: ${p.stack.join(", ")}`, dim: true },
            { kind: "text", text: "" },
            { kind: "text", text: lang === "ko" ? p.summary_ko : p.summary_en },
            { kind: "text", text: lang === "ko" ? p.summary_en : p.summary_ko, dim: true },
            // The detail is what the CV says. Not every project has any.
            ...(((lang === "ko" ? p.detail_ko : p.detail_en) || []).length
              ? [{ kind: "text", text: "" },
                 ...(lang === "ko" ? p.detail_ko : p.detail_en).map(d => ({ kind: "text", text: "  - " + d }))]
              : []),
            { kind: "text", text: "" },
            { kind: "link", href: `https://github.com/${D().site.github}/${p.slug}`, text: t("read_repo", p.slug) },
          ];
        }
        // Otherwise, fall through to real FS cat
        return window.FS.cat(args);
      }},

      publications: { usage: "publications", hint: H("publications"), run: () => {
        const pubs = D().publications;
        // Nothing yet is a real answer, and a bare heading with nothing under it
        // reads as something failing to load.
        if (!pubs.length) return [{ kind: "text", strong: true, text: t("pubs_h") + ":" },
          { kind: "text", dim: true, text: lang === "ko"
            ? "  아직 심사를 통과한 것이 없습니다. 진행 중인 연구는 `research` 와 `projects` 에 있습니다."
            : "  Nothing through review yet. The work in progress is under `research` and `projects`." }];
        return [{ kind: "text", text: t("pubs_h") + ":", strong: true },
          ...pubs.map(p => ({ kind: "text",
            // Pages only when there are pages: a workshop paper has none, and an
            // empty column looks like something failed to load.
            text: `  ${p.year}  ${p.venue.padEnd(11)}${(p.pages ? "pp." + p.pages : "").padEnd(12)} ${lang === "ko" ? p.title_ko : p.title_en}` })),
          { kind: "text", dim: true, text: lang === "ko"
            ? "  전부 제1저자, 국내 학술대회 (원문 한국어)"
            : "  All first author, domestic conferences, originally in Korean" }];
      }},

      patents: { usage: "patents", hint: H("patents"), run: () => {
        const pats = D().patents || [];
        if (!pats.length) return [{ kind: "text", dim: true, text: lang === "ko" ? "등록된 특허가 없습니다." : "No patents." }];
        return [{ kind: "text", text: t("pat_h") + ":", strong: true },
          ...pats.flatMap(x => [
            { kind: "text", text: `  ${x.year}  ${lang === "ko" ? x.title_ko : x.title_en}` },
            { kind: "text", dim: true, text: `        ${lang === "ko" ? x.status_ko : x.status_en} · ${lang === "ko" ? x.holder_ko : x.holder_en}` },
          ])];
      }},

      experience: { usage: "experience", hint: H("experience"), run: () => [
        { kind: "text", text: t("exp_h") + ":", strong: true },
        ...kvLines(D().experience.map(e => [e.when, lang === "ko" ? `${e.what_ko} - ${e.where_ko}` : `${e.what_en} - ${e.where_en}`])),
      ]},

      skills: { usage: "skills", hint: H("skills"), run: () => {
        const s = D().skills;
        return kvLines([
          // The CV's four rows, in its order.
          ["languages", s.languages.join(", ")],
          ["web",       s.web.join(", ")],
          ["data",      s.data.join(", ")],
          ["tools",     s.tools.join(", ")],
        ]);
      }},

      now: { usage: "now [--week|--month]", hint: H("now"), run: (args) => {
        const mode = args[0] === "--week" ? "week" : args[0] === "--month" ? "month" : "today";
        return [{ kind: "now", view: mode, lang }];
      }},

      contact: { usage: "contact", hint: H("contact"), run: () => {
        const p = D().profile;
        return kvLines([
          [t("email"),  p.email],
          ["github",    `github.com/${p.github}`],
          ["linkedin",  `linkedin.com/in/${p.linkedin}`],
          ["scholar",   p.scholar || t("scholar_soon")],
          ["til",       D().site.til],
          ["booking",   D().site.bookingUrl],
        ]);
      }},

      cv: { usage: "cv", hint: H("cv"), run: () => [
        { kind: "text", text: t("cv_open") },
        { kind: "link", href: D().site.cvKo, text: t("cv_ko") },
        { kind: "link", href: D().site.cvEn, text: t("cv_en") },
      ]},

      book: { usage: "book", hint: H("book"), run: () => [
        { kind: "text", text: t("book_msg") },
        { kind: "link", href: D().site.bookingUrl, text: t("book_link") },
      ]},

      til: { usage: "til", hint: H("til"), run: () => [
        { kind: "text", text: t("til_go") },
        { kind: "link", href: D().site.tilUrl, text: t("til_link") },
      ]},

      chat: { usage: "chat", hint: H("chat"), run: () => [
        { kind: "mode", action: "chat" },
        { kind: "text", text: t("chat_intro") },
        { kind: "text", text: t("chat_info"), dim: true },
      ]},

      theme: { usage: "theme [name]", hint: H("theme"), run: (args) => {
        const k = args[0];
        if (!k) return [
          { kind: "text", text: t("theme_usage") },
          ...kvLines(Object.entries(window.THEMES).map(([k, v]) => [k, lang === "ko" ? v.label_ko : v.name])),
        ];
        if (!window.THEMES[k]) return [{ kind: "text", text: t("theme_unk", k), warn: true }];
        return [{ kind: "mode", action: "theme", value: k }, { kind: "text", text: `theme → ${k}`, dim: true }];
      }},

      easy: { usage: "easy", hint: H("easy"), run: () => [
        { kind: "mode", action: "easy" },
        { kind: "text", text: t("easy_msg"), dim: true },
      ]},

      lang: { usage: "lang ko|en", hint: H("lang"), run: (args) => {
        const l = args[0];
        if (!["ko", "en"].includes(l)) return [{ kind: "text", text: t("lang_usage"), warn: true }];
        return [{ kind: "mode", action: "lang", value: l }, { kind: "text", text: t("lang_set", l), dim: true }];
      }},

      clear: { usage: "clear", hint: H("clear"), run: () => [{ kind: "mode", action: "clear" }] },

    };

    // coreutils.js stores hints as {ko,en}; resolve them for this language and mark
    // them as shell tools so `help` can list them apart from the site commands.
    for (const src of [window.COREUTILS, window.TOOLS]) {
      for (const [name, def] of Object.entries(src || {})) {
        C[name] = { ...def, group: "shell", hint: pick(def.hint, lang) };
      }
    }
    return C;
  }

  function parse(input) {
    const s = input.trim();
    if (!s) return null;
    const [cmd, ...args] = s.split(/\s+/);
    return { cmd, args };
  }

  // Flatten a stage's blocks into lines so the next stage can read them as stdin.
  // Rendered-component blocks (grid, now, weather) have no text form and drop out,
  // which is roughly what piping a TUI into `wc` does anyway.
  function blocksToLines(blocks) {
    const lines = [];
    for (const b of blocks || []) {
      if (b.kind === "text") lines.push(b.text || "");
      else if (b.kind === "kv") for (const [k, v] of b.rows) lines.push(`${k}  ${v}`);
      // A pipe carries data, not UI text: send the URL, not the button label.
      else if (b.kind === "link") lines.push(b.href || b.text || "");
    }
    return lines;
  }

  // `piped` tells a command its output feeds another stage, the way a real program
  // learns stdout is not a tty. ls uses it to switch to one entry per line.
  function execOne(stage, lang, C, stdin, piped) {
    const parsed = parse(stage);
    if (!parsed) return [];
    const c = C[parsed.cmd];
    // Command table first, then the free-form handlers. The old order let a joke
    // shadow any real command sharing its name.
    if (c) return c.run(parsed.args, stdin, lang, piped) || [];
    const extra = window.EXTRAS && window.EXTRAS.tryHandle(stage, { lang });
    if (extra) return extra;
    return [{ kind: "text", text: pick(S.nf, lang, parsed.cmd), warn: true }];
  }

  function run(input, lang = "ko") {
    if (!parse(input)) return null;
    const C = buildCommands(lang);
    const stages = input.split("|").map(s => s.trim());
    // A bar is not always a pipe: `:(){ :|:& };:` is a single shell construct.
    // If the head of the pipeline is not a real command, treat the input as whole.
    const piped = stages.length > 1 && stages.every(Boolean) &&
                  C[(parse(stages[0]) || {}).cmd] !== undefined;
    if (!piped) return execOne(input.trim(), lang, C, null, false);

    let blocks = [], stdin = null;
    stages.forEach((stage, i) => {
      blocks = execOne(stage, lang, C, stdin, i < stages.length - 1);
      stdin = blocksToLines(blocks);
    });
    return blocks;
  }

  // Completion is derived from each command's own `usage` string rather than a
  // hardcoded list, so a new command that documents itself gets completion for free.
  //   "...<file>" / "[path]" / "<dir>"  -> filesystem paths
  //   "...<command>"                    -> other command names
  function completionKind(cmd) {
    const u = String(cmd && cmd.usage || "");
    if (/\b(file|path|dir)\b/.test(u)) return "path";
    if (/\bcommand\b/.test(u)) return "command";
    return null;
  }

  function complete(prefix, lang = "ko") {
    const raw = String(prefix).replace(/^\s+/, "");
    if (!raw) return [];
    const C = buildCommands(lang);
    const parts = raw.split(/\s+/).filter(Boolean);   // "vi " must not yield an empty tail
    // A trailing space means "start a new word", so `vi ` lists everything.
    const trailing = /\s$/.test(prefix);

    if (parts.length === 1 && !trailing) {
      return Object.keys(C).filter(k => !C[k].hidden && k.startsWith(parts[0]));
    }

    const cmd = C[parts[0]];
    if (!cmd) return [];
    const frag = trailing ? "" : parts[parts.length - 1];
    const head = (trailing ? parts : parts.slice(0, -1)).join(" ") + " ";

    // Options are their own thing; do not offer paths for a half-typed flag.
    if (frag.startsWith("-")) return [];

    if (parts[0] === "theme") {
      return Object.keys(window.THEMES).filter(k => k.startsWith(frag)).map(k => head + k);
    }
    if (parts[0] === "lang") {
      return ["ko", "en"].filter(k => k.startsWith(frag)).map(k => head + k);
    }

    const kind = completionKind(cmd);
    if (kind === "command") {
      return Object.keys(C).filter(k => !C[k].hidden && k.startsWith(frag)).map(k => head + k);
    }
    if (kind === "path") {
      const paths = window.FS ? window.FS.complete(frag) : [];
      // `cat` also takes a project slug, which is not a real path.
      const slugs = parts[0] === "cat"
        ? window.SITE_DATA.projects.map(p => p.slug).filter(x => x.startsWith(frag))
        : [];
      return [...new Set([...paths, ...slugs])].map(x => head + x);
    }
    return [];
  }

  // Somewhere else on the desktop can hand the shell a line to run. It is a queue
  // rather than an event because there may be no terminal at the moment of asking,
  // and several once there is: the line waits, and the focused shell takes it.
  // Only `cd` is accepted, since anything on the page can call this.
  window.SHELL = {
    queue: [],
    subs: new Set(),
    run(line) {
      const l = String(line || "").trim();
      if (!/^cd (\/|~)[\w./~-]*$/.test(l)) return;
      window.SHELL.queue.push(l);
      window.SHELL.subs.forEach((f) => f());
    },
    take() { return window.SHELL.queue.splice(0); },
    sub(f) { window.SHELL.subs.add(f); return () => { window.SHELL.subs.delete(f); }; },
  };

  window.TERMINAL = { buildCommands, run, complete };
})();
