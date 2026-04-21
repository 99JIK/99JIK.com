// Easter eggs — all self-contained so the main command dispatcher can stay clean.
// Usage from terminal-commands.js:
//   const egg = window.EGGS.tryHandle(input, { lang });
//   if (egg) return egg;   // returns an array of blocks (or null)

(function () {
  // ---- persistent prompt identity ----
  const NAME_KEY = "99jik:name";
  window.getPromptName = () => localStorage.getItem(NAME_KEY) || "anonymous";
  window.setPromptName = (n) => {
    if (!n) localStorage.removeItem(NAME_KEY);
    else localStorage.setItem(NAME_KEY, n);
    window.dispatchEvent(new CustomEvent("promptname"));
  };

  window.KONAMI = { unlocked: false };

  function text(t, opts = {}) { return { kind: "text", text: t, ...opts }; }

  // Terminal display width — measured from the actual rendered text because
  // CJK glyphs don't always render at exactly 2x ASCII width across fonts.
  // Falls back to a code-point approximation if DOM measurement fails.
  function cellWidth(str) {
    try {
      const host = document.querySelector(".term-body") || document.body;
      if (!host) throw new Error("no host");
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;top:-9999px;left:-9999px";
      host.appendChild(probe);
      probe.textContent = "M".repeat(40);
      const mCell = probe.getBoundingClientRect().width / 40;
      probe.textContent = str;
      const strPx = probe.getBoundingClientRect().width;
      host.removeChild(probe);
      if (mCell > 0) return Math.round(strPx / mCell);
    } catch {}
    // Fallback: rough code-point-based approximation.
    let w = 0;
    for (const ch of str) {
      const c = ch.codePointAt(0);
      const wide =
        (c >= 0xAC00 && c <= 0xD7A3) ||
        (c >= 0x3131 && c <= 0x318E) ||
        (c >= 0x4E00 && c <= 0x9FFF) ||
        (c >= 0x3040 && c <= 0x309F) ||
        (c >= 0x30A0 && c <= 0x30FF) ||
        (c >= 0xFF00 && c <= 0xFFEF) ||
        (c >= 0x2E80 && c <= 0x303E);
      w += wide ? 2 : 1;
    }
    return w;
  }

  // ---- handlers ----

  function iAm(raw, { lang }) {
    const m = raw.match(/^i\s+am\s+(.+)$/i) || raw.match(/^(?:나는|내가)\s+(.+?)(?:\s*(?:야|이야|입니다|다))?$/);
    if (!m) return null;
    const name = m[1].trim().replace(/[.!?]+$/, "").slice(0, 24);
    if (!name) return null;
    window.setPromptName(name);
    return [
      text(lang === "en" ? `nice to meet you, ${name}.` : `반가워요, ${name}.`, { strong: true }),
      text(lang === "en" ? `(try 'whoami' -- it knows you now.)` : `(whoami 해보세요 -- 이제 기억하고 있어요.)`, { dim: true }),
    ];
  }

  function forgetMe(raw, { lang }) {
    if (!/^forget\s+me$|^나를\s*잊/i.test(raw)) return null;
    window.setPromptName(null);
    return [text(lang === "en" ? "forgotten. back to anonymous." : "잊었어요. 다시 익명입니다.", { dim: true })];
  }

  function sudoRm(raw, { lang }) {
    if (!/^sudo\s+rm\s+-rf\s+\/(?:\s*\*)?\s*$/i.test(raw)) return null;
    return [
      text("Permission granted. Deleting universe..."),
      text("  rm: removing 'stars'       ... ok"),
      text("  rm: removing 'galaxies'    ... ok"),
      text("  rm: removing 'matter'      ... ok"),
      text("  rm: removing 'Jeongin'     ... not today."),
      text(""),
      text(lang === "en" ? "[ just kidding. your filesystem is safe. ]" : "[ 농담이에요. 시스템은 멀쩡합니다. ]", { dim: true }),
    ];
  }

  function coffee(raw, { lang }) {
    if (!/^(coffee|커피)$/i.test(raw)) return null;
    return [
      text("           (  )   (   )  )"),
      text("            ) (   )  (  ("),
      text("            ( )  (    ) )"),
      text("          _____________"),
      text("         <_____________> ___"),
      text("         |             |/ _ \\"),
      text("         |               | | |"),
      text("         |               |_| |"),
      text("      ___|             |\\___/"),
      text("     /    \\___________/    \\"),
      text("     \\_____________________/"),
      text(""),
      text(lang === "en" ? "[*] a cup of courage. +5 focus." : "[*] 용기 한 잔. 집중력 +5.", { dim: true }),
    ];
  }

  function fortune(raw, { lang }) {
    if (!/^fortune$/i.test(raw)) return null;
    const fs = (window.SITE_DATA && window.SITE_DATA.fortunes) || { ko: [], en: [] };
    const pool = (lang === "en" ? fs.en : fs.ko) || [];
    if (!pool.length) return [text(lang === "en" ? "(no fortunes configured)" : "(fortune 비어있음)", { dim: true })];
    const line = pool[Math.floor(Math.random() * pool.length)];
    const w = Math.min(cellWidth(line) + 2, 72);
    return [
      text(" +" + "-".repeat(w) + "+"),
      text(" | " + line + " |"),
      text(" +" + "-".repeat(w) + "+"),
    ];
  }

  function date(raw, { lang }) {
    if (!/^date$/i.test(raw)) return null;
    const d = new Date();
    return [text(d.toString()), text(lang === "en" ? `unix: ${Math.floor(d.getTime()/1000)}` : `유닉스 타임: ${Math.floor(d.getTime()/1000)}`, { dim: true })];
  }

  function uptime(raw, { lang }) {
    if (!/^uptime$/i.test(raw)) return null;
    const mins = Math.floor(performance.now() / 60000);
    const hh = Math.floor(mins / 60), mm = mins % 60;
    return [text(lang === "en"
      ? ` up ${hh}:${String(mm).padStart(2,"0")}, 1 user, load average: 0.42, 0.42, 0.42`
      : ` ${hh}:${String(mm).padStart(2,"0")} 동안 켜져 있음, 사용자 1명, 부하: 0.42, 0.42, 0.42`)];
  }

  function ping(raw, { lang }) {
    if (!/^ping(\s|$)/i.test(raw)) return null;
    const host = raw.split(/\s+/)[1] || window.SITE_DATA.site.domain;
    const jitter = () => (Math.random() * 0.08 + 0.02).toFixed(3);
    return [{
      kind: "progressive",
      delay: 900,
      lines: [
        `PING ${host} (127.0.0.1): 56 data bytes`,
        `64 bytes from 127.0.0.1: icmp_seq=0 ttl=64 time=${jitter()} ms`,
        `64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=${jitter()} ms`,
        `64 bytes from 127.0.0.1: icmp_seq=2 ttl=64 time=${jitter()} ms`,
        `--- ${host} ping statistics ---`,
        `3 packets transmitted, 3 received, 0% packet loss`,
      ],
    }];
  }

  function hi(raw, { lang }) {
    if (!/^(hello|hi|hey|안녕|안녕하세요)$/i.test(raw)) return null;
    const h = new Date().getHours();
    const greet = lang === "en"
      ? (h < 6 ? "you're up late." : h < 12 ? "good morning." : h < 18 ? "good afternoon." : "good evening.")
      : (h < 6 ? "늦은 시간이네요." : h < 12 ? "좋은 아침이에요." : h < 18 ? "좋은 오후예요." : "좋은 저녁이에요.");
    return [
      text(lang === "en" ? `oh, hi. ${greet}` : `안녕하세요. ${greet}`),
      text(lang === "en" ? `try 'about' or 'chat'.` : `'about' 나 'chat' 을 눌러보세요.`, { dim: true }),
    ];
  }

  function exitJoke(raw, { lang }) {
    if (!/^(exit|quit|logout)$/i.test(raw)) return null;
    return [text(lang === "en" ? "you can check out any time, but you can never leave." : "나갈 수는 있지만, 떠날 수는 없어요.", { warn: true })];
  }

  // vi, vim, :q, :wq, :q! -> all the same "how do I exit" joke
  function vimJoke(raw, { lang }) {
    if (!/^(vi|vim|:q|:wq|:q!|:x)$/i.test(raw)) return null;
    return [
      text(lang === "en" ? "[ you are now trapped in vim. ]" : "[ vim 에 갇혔습니다. ]"),
      text(lang === "en" ? "to exit: hold power button for 5 seconds." : "나가는 법: 전원 버튼 5초 꾹.", { dim: true }),
    ];
  }

  function emacsJoke(raw, { lang }) {
    if (!/^emacs$/i.test(raw)) return null;
    return [text(lang === "en" ? "emacs is a great OS. it just needs a better editor." : "emacs 는 훌륭한 OS 예요. 에디터만 있었으면 완벽했을 텐데.")];
  }

  function nanoJoke(raw, { lang }) {
    if (!/^nano$/i.test(raw)) return null;
    return [text(lang === "en" ? "nano? in this economy?" : "요즘 시대에 nano 를요?")];
  }

  function sandwich(raw, { lang }) {
    if (/^sudo\s+make\s+me\s+a\s+sandwich$/i.test(raw)) return [text(lang === "en" ? "okay. 🥪" : "알겠습니다. 🥪")];
    if (/^make\s+me\s+a\s+sandwich$/i.test(raw)) return [text(lang === "en" ? "what? make it yourself." : "뭐라고요? 직접 만드세요.", { warn: true })];
    return null;
  }

  function rmAnything(raw, { lang }) {
    if (!/^rm(\s|$)/i.test(raw) || /^sudo\s/i.test(raw)) return null;
    return [text(lang === "en" ? "rm: permission denied. (the interns are sleeping.)" : "rm: 권한이 없어요. (인턴이 자고 있거든요.)", { warn: true })];
  }

  function matrix(raw) {
    if (!/^matrix$/i.test(raw)) return null;
    return [{ kind: "mode", action: "matrix" }, text("wake up, neo...", { dim: true })];
  }

  function konamiHint(raw, { lang }) {
    if (!/^konami$/i.test(raw)) return null;
    if (window.KONAMI.unlocked) return [text(lang === "en" ? "you already know the code. try 'matrix'." : "이미 알고 있네요. 'matrix' 입력해보세요.", { dim: true })];
    return [text("^ ^ v v < > < > b a", { dim: true })];
  }

  function forty_two(raw, { lang }) {
    if (!/^(42|the answer|life|meaning of life)$/i.test(raw)) return null;
    return [text(lang === "en" ? "42. (but what was the question?)" : "42. (그런데 질문이 뭐였죠?)", { dim: true })];
  }

  function hireMe(raw, { lang }) {
    if (!/^hire\s+me$|^나를\s*고용/i.test(raw)) return null;
    return [
      text(lang === "en" ? "                +---------------------+" : "                +---------------------+"),
      text(lang === "en" ? "                |   HIRE ME, PLEASE   |" : "                |   저를 채용해주세요   |"),
      text(lang === "en" ? "                +---------------------+" : "                +---------------------+"),
      text(""),
      text(lang === "en" ? "I work cheap. I test thoroughly. I bring my own coffee." : "몸값 저렴하고, 테스트 꼼꼼하고, 커피는 제가 가져갑니다."),
      text(lang === "en" ? "references: compiler, pytest, my advisor (probably)." : "평판조회: 컴파일러, pytest, 지도교수님 (아마도).", { dim: true }),
      text(""),
      text(lang === "en" ? "-> type 'chat' to start the conversation." : "-> 'chat' 으로 대화 시작.", { dim: true }),
    ];
  }

  // new additions
  function lolcat(raw, { lang }) {
    if (!/^lolcat$|^cat\s+meme$/i.test(raw)) return null;
    return [
      text("  /\\_/\\  "),
      text(" ( o.o ) "),
      text("  > ^ <  "),
      text(""),
      text(lang === "en" ? "[ ~mrrrp~ ]" : "[ ~야옹~ ]", { dim: true }),
    ];
  }

  function lsLa(raw, { lang }) { return null; } // replaced by real FS

  function catSecret(raw) { return null; }
  function catDreams(raw) { return null; }

function yes(raw) {
    if (!/^yes(\s|$)/i.test(raw)) return null;
    const what = raw.split(/\s+/).slice(1).join(" ") || "y";
    return Array.from({ length: 8 }, () => text(what));
  }

  function top(raw) {
    if (!/^top$|^htop$/i.test(raw)) return null;
    return [{ kind: "live-top" }];
  }

  function uname(raw, { lang }) {
    if (!/^uname(\s|$)/i.test(raw)) return null;
    const args = raw.split(/\s+/).slice(1);
    const flags = new Set();
    args.forEach(a => { if (a.startsWith("-")) a.slice(1).split("").forEach(c => flags.add(c)); });
    if (flags.has("a")) return [text("JeonginOS 25.04 99jik 6.10-coffee #42-jeongin SMP KST 2026 x86_64 jeongin/GNU Linux")];
    if (flags.has("r")) return [text("6.10-coffee")];
    if (flags.has("m")) return [text("x86_64")];
    if (flags.has("n")) return [text(window.SITE_DATA.site.handle)];
    if (flags.has("s") || flags.size === 0) return [text("JeonginOS")];
    return [text("JeonginOS")];
  }

  function sl(raw) {
    if (!/^sl$/i.test(raw)) return null;
    return [
      text("      ====        ________                ___________"),
      text("  _D _|  |_______/        \\__I_I_____===__|_________|"),
      text("   |(_)---  |   H\\________/ |   |        =|___ ___|"),
      text("   /     |  |   H  |  |     |   |         ||_| |_||"),
      text("  |      |  |   H  |__----------|         |/-=|___|="),
      text("  | ________|___H__/__|_____/[][]~\\_______|        |"),
      text("  |/ |   |-----------I_____I [][] []  D   |=======|_"),
      text("__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__"),
      text(" |/-=|___|=    ||    ||    ||    |_____/~\\___/"),
      text("  \\_/      \\O=====O=====O=====O_/      \\_/"),
      text("", { dim: true }),
      text("( you typed sl instead of ls. happens to the best of us. )", { dim: true }),
    ];
  }

  function cowsay(raw) {
    if (!/^cowsay(\s|$)/i.test(raw)) return null;
    const msg = raw.split(/\s+/).slice(1).join(" ") || "moo";
    const w = cellWidth(msg);
    return [
      text(" " + "_".repeat(w + 2)),
      text("< " + msg + " >"),
      text(" " + "-".repeat(w + 2)),
      text("        \\   ^__^"),
      text("         \\  (oo)\\_______"),
      text("            (__)\\       )\\/\\"),
      text("                ||----w |"),
      text("                ||     ||"),
    ];
  }

  function star(raw, { lang }) {
    if (!/^star$|^\*$/i.test(raw)) return null;
    const gh = `github.com/${window.SITE_DATA.site.github}`;
    return [text(lang === "en" ? `thanks. consider starring ${gh} too.` : `감사합니다. ${gh} 에도 별 하나 부탁드려요.`, { dim: true })];
  }

  function god(raw, { lang }) {
    if (!/^god\s+mode$|^cheat$/i.test(raw)) return null;
    return [text(lang === "en" ? "cheat codes disabled in production. nice try." : "프로덕션 환경에서는 치트 비활성화. 좋은 시도.", { warn: true })];
  }

  function credits(raw, { lang }) {
    if (!/^credits$|^thanks$|^about\s+this\s+site$/i.test(raw)) return null;
    return [
      text(lang === "en" ? "== credits ==" : "== 크레딧 ==", { strong: true }),
      text(lang === "en" ? "built by      : Jeongin Kim" : "제작         : 김정인"),
      text(lang === "en" ? "caffeinated by: local cafe" : "카페인 공급   : 동네 개인 카페"),
      text(lang === "en" ? "inspired by   : classic unix terminals" : "영감          : 고전 유닉스 터미널"),
      text(lang === "en" ? "no bugs were harmed in the making of this site." : "이 사이트를 만드는 동안 버그는 다치지 않았어요.", { dim: true }),
    ];
  }

  const handlers = [
    iAm, forgetMe,
    sudoRm, sandwich, rmAnything,
    coffee, fortune, date, uptime, ping, top, uname,
    hi, exitJoke, vimJoke, emacsJoke, nanoJoke,
    matrix, konamiHint,
    forty_two, hireMe,
    lolcat, lsLa, catSecret, catDreams, yes, sl, cowsay, star, god, credits,
  ];

  function tryHandle(input, ctx) {
    const raw = (input || "").trim();
    if (!raw) return null;
    for (const h of handlers) {
      try { const r = h(raw, ctx); if (r) return r; } catch (e) {}
    }
    return null;
  }

  const HINT_KO = "숨겨진 명령이 여러 개 있어요... 한번 찾아보세요. [lolcat을 쳐봐요!]";
  const HINT_EN = "there are many hidden commands... poke around. [unix-friendly hints help]";
  window.EGGS = { tryHandle, HINT_KO, HINT_EN };
})();
