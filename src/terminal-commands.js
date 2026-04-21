// Terminal commands, i18n-aware. All user-facing strings exist in ko/en.
// Blocks are computed fresh each run, with `lang` passed from the view.

(function () {
  const D = () => window.SITE_DATA;

  // simple bilingual strings lookup used across commands
  const S = {
    avail:       { ko: "사용 가능한 명령", en: "Available commands" },
    tip:         { ko: "Tip — Tab 자동완성 · ? 단축 도움말 · ↑/↓ 히스토리 · Enter만 누르면 다음 제안.", en: "Tip — Tab to complete · ? for help · ↑/↓ for history · press Enter alone for suggestions." },
    research_h:  { ko: "연구 관심사", en: "Research interests" },
    projects_h:  { ko: "프로젝트 — cat <slug> 로 자세히", en: "Projects — cat <slug> for details" },
    now_h:       { ko: () => `현재 하고 있는 것 — ${D().site.updatedLabel.ko}`, en: () => `Now — ${D().site.updatedLabel.en}` },
    now_today:   { ko: "오늘 일정", en: "today" },
    now_week:    { ko: "이번 주", en: "this week" },
    now_month:   { ko: "이번 달", en: "this month" },
    now_none:    { ko: "오늘은 일정이 비어 있어요. 연구할 시간이네요.", en: "nothing on today. good time to focus." },
    now_sync:    { ko: (t) => `Last sync: ${t} · \`now --week\` / \`now --month\``, en: (t) => `last sync: ${t} · \`now --week\` / \`now --month\`` },
    now_all_day: { ko: "종일", en: "all-day" },
    now_loading: { ko: "캘린더 불러오는 중...", en: "loading calendar..." },
    pubs_h:      { ko: "논문 / 글", en: "Publications" },
    exp_h:       { ko: "경력 및 학력", en: "Experience & Education" },
    ls_nodir:    { ko: (d) => `ls: ${d}: 그런 디렉토리는 없습니다. try: ls projects`, en: (d) => `ls: ${d}: no such directory. try: ls projects` },
    cat_usage:   {
      ko: () => { const s = D().projects[0]?.slug || "<slug>"; return `usage: cat <slug>  — 예: cat ${s}`; },
      en: () => { const s = D().projects[0]?.slug || "<slug>"; return `usage: cat <slug>  — e.g. cat ${s}`; },
    },
    cat_nf:      { ko: (s) => `cat: ${s}: 파일을 찾지 못했어요.`, en: (s) => `cat: ${s}: not found.` },
    stack:       { ko: "스택", en: "stack" },
    read_repo:   { ko: (slug) => `github.com/${D().site.github}/${slug} 로 이동 →`, en: (slug) => `open → github.com/${D().site.github}/${slug}` },
    cv_open:     { ko: "CV.pdf 다운로드 링크를 준비했어요.", en: "Preparing CV.pdf ..." },
    cv_link:     { ko: "CV.pdf 받기 ↓", en: "download CV.pdf ↓" },
    til_go:      { ko: () => `→ ${D().site.til} 으로 이동합니다`, en: () => `→ heading to ${D().site.til}` },
    til_link:    { ko: () => `${D().site.til} 열기 ↗`, en: () => `open ${D().site.til} ↗` },
    nf:          { ko: (c) => `명령을 찾지 못했어요: ${c} — 'help' 또는 '?' 를 눌러보세요`, en: (c) => `command not found: ${c} — try 'help' or '?'` },
    theme_usage: { ko: "usage: theme <name>  — 선택지:", en: "usage: theme <name>  — options:" },
    theme_unk:   { ko: (k) => `theme: ${k}: 모르는 테마`, en: (k) => `theme: ${k}: unknown` },
    easy_msg:    { ko: "Easy Mode 로 전환...", en: "switching to Easy Mode..." },
    lang_usage:  { ko: "usage: lang ko|en", en: "usage: lang ko|en" },
    lang_set:    { ko: (l) => `언어 → ${l}`, en: (l) => `lang → ${l}` },
    email:       { ko: "이메일", en: "email" },
    scholar_soon:{ ko: "(준비 중)", en: "(coming soon)" },
    sudo:        { ko: "좋은 시도였어요.", en: "nice try." },
    chat_intro:  { ko: "채팅을 시작합니다. '/exit' 로 종료, '/clear' 로 비우기.", en: "Chat started. '/exit' to leave, '/clear' to reset." },
    chat_info:   {
      ko: () => `${D().profile.name_ko} 에게 실시간으로 전달됩니다. 오프라인이면 조금 뒤에 답장이 올 수 있어요.`,
      en: () => `Delivered to ${D().profile.name_en.split(" ")[0]} in real time. If offline, replies may take a while.`,
    },
    hints: {
      help:     { ko: "사용 가능한 명령을 모두 보여줘요", en: "Show all available commands" },
      about:    { ko: "짧은 자기소개", en: "Short introduction" },
      whoami:   { ko: "한 줄 소개", en: "One-line intro" },
      research: { ko: "연구 관심사", en: "Research interests" },
      ls:       { ko: "파일 목록 보기", en: "List files" },
      projects: { ko: "프로젝트 전부 보기", en: "View all projects" },
      cat:      { ko: "특정 프로젝트 상세 (cat sil-harness)", en: "Project detail (cat sil-harness)" },
      publications: { ko: "논문 / 글", en: "Publications" },
      experience: { ko: "경력 / 학력", en: "Experience / Education" },
      skills:   { ko: "언어 · 도구 · 연구", en: "Languages · tools · research" },
      now:      { ko: "지금 무엇을 하고 있나요", en: "What I'm working on now" },
      contact:  { ko: "연락처", en: "Contact info" },
      cv:       { ko: "CV 다운로드", en: "Download CV" },
      til:      { ko: () => `TIL 사이트로 (${D().site.til})`, en: () => `Go to TIL (${D().site.til})` },
      chat:     {
        ko: () => `${D().profile.name_ko} 에게 메시지 보내기`,
        en: () => `Send ${D().profile.name_en.split(" ")[0]} a message`,
      },
      theme:    { ko: "테마 변경", en: "Change theme" },
      easy:     { ko: "Easy Mode (일반 뷰) 전환", en: "Switch to Easy Mode" },
      lang:     { ko: "언어 (ko|en) 전환", en: "Switch language (ko|en)" },
      clear:    { ko: "화면 지우기", en: "Clear screen" },
    },
  };

  const pick = (obj, lang, ...args) => {
    const v = obj[lang] ?? obj.ko;
    return typeof v === "function" ? v(...args) : v;
  };

  function buildCommands(lang) {
    const H = (k) => pick(S.hints[k], lang);
    const t = (k, ...args) => pick(S[k], lang, ...args);

    const C = {
      help: { hint: H("help"), run: () => [
        { kind: "text", text: t("avail") + ":" },
        { kind: "kv", rows: Object.entries(C).filter(([k]) => !C[k].hidden).map(([k, v]) => [k, v.hint]) },
        { kind: "text", text: t("tip"), dim: true },
      ]},
      "?": { hidden: true, hint: "= help", run: () => C.help.run() },

      about: { hint: H("about"), run: () => {
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

      whoami: { hint: H("whoami"), run: () => {
        const p = D().profile;
        const custom = window.getPromptName ? window.getPromptName() : "anonymous";
        if (custom && custom !== "anonymous") {
          return [
            { kind: "text", text: lang === "ko" ? `당신: ${custom}` : `you: ${custom}`, strong: true },
            { kind: "text", text: lang === "ko" ? `(이 사이트의 주인은: ${p.name_ko} / ${p.name_en} — ${p.role_ko})` : `(site owner: ${p.name_en} / ${p.name_ko} — ${p.role_en})`, dim: true },
            { kind: "text", text: lang === "ko" ? `로그아웃: 'exit'` : `log out: 'exit'`, dim: true },
          ];
        }
        return [{ kind: "text", text: lang === "ko" ? `${p.name_ko} (${p.name_en}) — ${p.role_ko}` : `${p.name_en} (${p.name_ko}) — ${p.role_en}` }];
      }},

      research: { hint: H("research"), run: () => {
        const rows = D().research.map(r => [r.tag, lang === "ko" ? `${r.title_ko} — ${r.blurb}` : `${r.title_en} — ${r.blurb}`]);
        return [{ kind: "text", text: t("research_h") + ":", strong: true }, { kind: "kv", rows }];
      }},

      ls: { hint: H("ls"), run: (args) => window.FS.ls(args) },
      cd: { hint: lang === "ko" ? "디렉토리 이동 (cd projects, cd .., cd ~)" : "change directory (cd projects, cd .., cd ~)", run: (args) => window.FS.cd(args) },
      pwd: { hint: lang === "ko" ? "현재 경로" : "print working directory", run: () => window.FS.pwd() },
      tree: { hint: lang === "ko" ? "디렉토리 트리 (tree, tree projects, tree -a)" : "directory tree (tree, tree projects, tree -a)", run: (args) => window.FS.tree(args) },
      find: { hint: lang === "ko" ? "파일 찾기 (find /, find . -name *.md)" : "find files (find /, find . -name *.md)", run: (args) => window.FS.find(args, lang) },
      grep: { hint: lang === "ko" ? "내용 검색 (grep -i pattern /path)" : "search contents (grep -i pattern /path)", run: (args) => window.FS.grep(args, lang) },
      history: {
        hint: lang === "ko" ? "입력한 명령 히스토리" : "show command history",
        run: () => {
          const stack = window.TERM_HISTORY || [];
          if (!stack.length) return [{ kind: "text", text: lang === "ko" ? "(기록 없음)" : "(empty)", dim: true }];
          return stack.map((cmd, i) => ({ kind: "text", text: `  ${String(i + 1).padStart(4)}  ${cmd}` }));
        },
      },
      weather: {
        hint: lang === "ko" ? "현재 날씨 (weather, weather seoul)" : "current weather (weather, weather seoul)",
        run: (args) => [{ kind: "weather", location: args[0] || "Daegu" }],
      },

      projects: { hint: H("projects"), run: () => [
        { kind: "text", text: t("projects_h"), strong: true },
        { kind: "grid", items: D().projects, lang },
      ]},

      cat: { hint: H("cat"), run: (args) => {
        if (!args.length) return [{ kind: "text", text: t("cat_usage"), warn: true }];
        // First try as a project slug (pretty view)
        const p = D().projects.find(x => x.slug === args[0]);
        if (p && args.length === 1) {
          return [
            { kind: "text", text: `── ${lang === "ko" ? p.title_ko : p.title_en} (${p.year}) ─────`, strong: true },
            { kind: "text", text: `${t("stack")}: ${p.stack.join(", ")}`, dim: true },
            { kind: "text", text: "" },
            { kind: "text", text: lang === "ko" ? p.summary_ko : p.summary_en },
            { kind: "text", text: lang === "ko" ? p.summary_en : p.summary_ko, dim: true },
            { kind: "text", text: "" },
            { kind: "link", href: `https://github.com/${D().site.github}/${p.slug}`, text: t("read_repo", p.slug) },
          ];
        }
        // Otherwise, fall through to real FS cat
        return window.FS.cat(args);
      }},

      publications: { hint: H("publications"), run: () => [
        { kind: "text", text: t("pubs_h") + ":", strong: true },
        ...D().publications.map(p => ({ kind: "text", text: `  ${p.year}  ${p.venue.padEnd(10)} ${p.title} (${p.role})` })),
      ]},

      experience: { hint: H("experience"), run: () => [
        { kind: "text", text: t("exp_h") + ":", strong: true },
        { kind: "kv", rows: D().experience.map(e => [e.when, lang === "ko" ? `${e.what_ko} — ${e.where}` : `${e.what_en} — ${e.where}`]) },
      ]},

      skills: { hint: H("skills"), run: () => {
        const s = D().skills;
        return [{ kind: "kv", rows: [
          ["languages", s.languages.join(", ")],
          ["tools",     s.tools.join(", ")],
          ["research",  s.research.join(", ")],
        ] }];
      }},

      now: { hint: H("now"), run: (args) => {
        const mode = args[0] === "--week" ? "week" : args[0] === "--month" ? "month" : "today";
        return [{ kind: "now", view: mode, lang }];
      }},

      contact: { hint: H("contact"), run: () => {
        const p = D().profile;
        return [{ kind: "kv", rows: [
          [t("email"),  p.email],
          ["github",    `github.com/${p.github}`],
          ["linkedin",  `linkedin.com/in/${p.linkedin}`],
          ["scholar",   p.scholar || t("scholar_soon")],
          ["til",       D().site.til],
        ] }];
      }},

      cv: { hint: H("cv"), run: () => [
        { kind: "text", text: t("cv_open") },
        { kind: "link", href: D().site.cvPath, text: t("cv_link") },
      ]},

      til: { hint: H("til"), run: () => [
        { kind: "text", text: t("til_go") },
        { kind: "link", href: D().site.tilUrl, text: t("til_link") },
      ]},

      chat: { hint: H("chat"), run: () => [
        { kind: "mode", action: "chat" },
        { kind: "text", text: t("chat_intro") },
        { kind: "text", text: t("chat_info"), dim: true },
      ]},

      theme: { hint: H("theme"), run: (args) => {
        const k = args[0];
        if (!k) return [
          { kind: "text", text: t("theme_usage") },
          { kind: "kv", rows: Object.entries(window.THEMES).map(([k, v]) => [k, lang === "ko" ? v.label_ko : v.name]) },
        ];
        if (!window.THEMES[k]) return [{ kind: "text", text: t("theme_unk", k), warn: true }];
        return [{ kind: "mode", action: "theme", value: k }, { kind: "text", text: `theme → ${k}`, dim: true }];
      }},

      easy: { hint: H("easy"), run: () => [
        { kind: "mode", action: "easy" },
        { kind: "text", text: t("easy_msg"), dim: true },
      ]},

      lang: { hint: H("lang"), run: (args) => {
        const l = args[0];
        if (!["ko", "en"].includes(l)) return [{ kind: "text", text: t("lang_usage"), warn: true }];
        return [{ kind: "mode", action: "lang", value: l }, { kind: "text", text: t("lang_set", l), dim: true }];
      }},

      clear: { hint: H("clear"), run: () => [{ kind: "mode", action: "clear" }] },

      sudo: { hidden: true, hint: "", run: () => [{ kind: "text", text: t("sudo"), warn: true }] },
    };
    return C;
  }

  const EMPTY_SUGGESTIONS = ["about", "projects", "research", "now", "chat", "contact", "easy", "help"];

  function parse(input) {
    const s = input.trim();
    if (!s) return null;
    const [cmd, ...args] = s.split(/\s+/);
    return { cmd, args };
  }

  function run(input, lang = "ko") {
    const parsed = parse(input);
    if (!parsed) return null;
    // Easter eggs run first — they handle free-form input (e.g. "i am ...")
    const egg = window.EGGS && window.EGGS.tryHandle(input, { lang });
    if (egg) return egg;
    const C = buildCommands(lang);
    const c = C[parsed.cmd];
    if (!c) return [{ kind: "text", text: pick(S.nf, lang, parsed.cmd), warn: true }];
    return c.run(parsed.args);
  }

  function complete(prefix, lang = "ko") {
    const s = prefix.trim();
    if (!s) return [];
    const parts = s.split(/\s+/);
    const C = buildCommands(lang);
    if (parts.length === 1) {
      return Object.keys(C).filter(k => !C[k].hidden && k.startsWith(parts[0]));
    }
    if (parts[0] === "cat" && parts.length === 2) {
      // combine FS completion + project slugs
      const fs = window.FS ? window.FS.complete(parts[1]) : [];
      const slugs = window.SITE_DATA.projects.map(p => p.slug).filter(s => s.startsWith(parts[1]));
      return [...new Set([...fs, ...slugs])].map(s => `cat ${s}`);
    }
    if ((parts[0] === "ls" || parts[0] === "cd" || parts[0] === "tree" || parts[0] === "find") && parts.length === 2) {
      return (window.FS ? window.FS.complete(parts[1]) : []).map(s => `${parts[0]} ${s}`);
    }
    if (parts[0] === "theme" && parts.length === 2) {
      return Object.keys(window.THEMES).filter(s => s.startsWith(parts[1])).map(s => `theme ${s}`);
    }
    if (parts[0] === "lang" && parts.length === 2) {
      return ["ko", "en"].filter(s => s.startsWith(parts[1])).map(s => `lang ${s}`);
    }
    return [];
  }

  window.TERMINAL = { buildCommands, EMPTY_SUGGESTIONS, run, complete };
})();
