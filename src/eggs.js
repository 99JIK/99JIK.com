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

  // Accounts that look real (listed in /etc/passwd) — can't be impersonated.
  const PROTECTED_SU = ["jeongin", "stlab", "memo", "root"];

  function su(raw, { lang }) {
    if (!/^su(\s|$)/i.test(raw)) return null;
    const parts = raw.trim().split(/\s+/);
    const args = parts.slice(1).filter(p => p !== "-");  // allow `su -` prefix
    if (args.length === 0) {
      return [text(lang === "en" ? "usage: su <name>   — e.g. su alice" : "사용법: su <name>   — 예: su alice", { warn: true })];
    }
    const name = args.join(" ").replace(/[.!?]+$/, "").slice(0, 24).trim();
    if (!name) return null;

    // Protected account? Ask for a password, then always reject.
    if (PROTECTED_SU.includes(name.toLowerCase())) {
      window.dispatchEvent(new CustomEvent("su-prompt", { detail: { user: name } }));
      return [text(lang === "en" ? `Password:` : `비밀번호:`)];
    }

    // Non-protected: just become them.
    window.setPromptName(name);
    return [
      text(lang === "en" ? `welcome, ${name}.` : `반가워요, ${name}.`, { strong: true }),
      text(lang === "en" ? `(type 'exit' to log out.)` : `('exit' 로 로그아웃.)`, { dim: true }),
    ];
  }

  function sudoRm(raw, { lang }) {
    if (!/^sudo\s+rm\s+-rf\s+\/(?:\s*\*)?\s*$/i.test(raw)) return null;
    return [
      text("Permission granted. Deleting universe..."),
      text("  rm: removing 'stars'       ... ok"),
      text("  rm: removing 'galaxies'    ... ok"),
      text("  rm: removing 'matter'      ... ok"),
      text("  rm: removing 'JIK'         ... not today."),
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

  function exitRevert(raw, { lang }) {
    if (!/^(exit|quit|logout)$/i.test(raw)) return null;
    const current = window.getPromptName ? window.getPromptName() : "anonymous";
    if (!current || current === "anonymous") {
      // Already anonymous — there's nothing to exit from. Keep the old joke.
      return [text(lang === "en" ? "you can check out any time, but you can never leave." : "나갈 수는 있지만, 떠날 수는 없어요.", { warn: true })];
    }
    window.setPromptName(null);
    return [text(lang === "en" ? `logged out ${current}. back to anonymous.` : `로그아웃 (${current}). 다시 anonymous 입니다.`, { dim: true })];
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
    return [
      text(lang === "en" ? "rm: Permission denied" : "rm: 권한 없음", { warn: true }),
      text(lang === "en" ? "(read-only filesystem. on purpose.)" : "(읽기 전용 파일시스템. 의도적.)", { dim: true }),
    ];
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

  function reboot(raw, { lang }) {
    if (!/^reboot$/i.test(raw)) return null;
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent("site-reboot")); } catch {}
    }, 600);
    return [
      text(lang === "en" ? "rebooting JIKOS..." : "JIKOS 재부팅 중...", { strong: true }),
      text(lang === "en" ? "(any key during boot to skip)" : "(부팅 중 아무 키 누르면 스킵)", { dim: true }),
    ];
  }

  function uname(raw, { lang }) {
    if (!/^uname(\s|$)/i.test(raw)) return null;
    const args = raw.split(/\s+/).slice(1);
    const flags = new Set();
    args.forEach(a => { if (a.startsWith("-")) a.slice(1).split("").forEach(c => flags.add(c)); });
    if (flags.has("a")) return [text("JIKOS 25.04 99jik 6.10-coffee #42-jik SMP KST 2026 x86_64 JIK/GNU Linux")];
    if (flags.has("r")) return [text("6.10-coffee")];
    if (flags.has("m")) return [text("x86_64")];
    if (flags.has("n")) return [text(window.SITE_DATA.site.handle)];
    if (flags.has("s") || flags.size === 0) return [text("JIKOS")];
    return [text("JIKOS")];
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

  // ── LLM research self-burns ──
  function hallucinate(raw, { lang }) {
    if (!/^hallucinate$/i.test(raw)) return null;
    return [
      text(lang === "en" ? "confident output. citations fabricated." : "자신감 넘치는 답변. 인용은 날조됨.", { strong: true }),
      text(lang === "en" ? "cognitive status: unchanged." : "인지 상태: 변함없음.", { dim: true }),
    ];
  }

  function temperature(raw, { lang }) {
    if (!/^temperature(\s|$)/i.test(raw)) return null;
    const v = raw.split(/\s+/)[1];
    if (v === "0" || v === "0.0") {
      return [text(lang === "en" ? "deterministic but boring. just like me before coffee." : "결정적이지만 지루함. 커피 전의 나와 똑같음.")];
    }
    const t = v && !isNaN(parseFloat(v)) ? parseFloat(v) : null;
    if (t !== null) {
      if (t >= 1.5) return [text(lang === "en" ? `temp ${t}: word salad mode engaged.` : `temp ${t}: 단어 샐러드 모드 진입.`, { warn: true })];
      if (t > 1) return [text(lang === "en" ? `temp ${t}: getting creative. watch out.` : `temp ${t}: 창의적으로 가는 중. 주의.`)];
      return [text(lang === "en" ? `temp ${t}: noted. shipping.` : `temp ${t}: 접수. 배포.`)];
    }
    return [text(lang === "en" ? "usage: temperature <0..2>" : "사용법: temperature <0..2>", { dim: true })];
  }

  function promptEgg(raw, { lang }) {
    if (!/^prompt$/i.test(raw)) return null;
    return [
      text(lang === "en" ? "engineering it. adding 'please' and 'you are an expert'." : "엔지니어링 중. 'please' 와 '당신은 전문가' 삽입 중."),
      text(lang === "en" ? "performance: marginally improved." : "성능: 미미하게 개선됨.", { dim: true }),
    ];
  }

  function stochasticParrot(raw, { lang }) {
    if (!/^(stochastic\s+)?parrot$/i.test(raw)) return null;
    return [
      text(">.<"),
      text(lang === "en" ? "— Bender, Gebru, McMillan-Major, Shmitchell. (FAccT 2021)" : "— Bender, Gebru, McMillan-Major, Shmitchell. (FAccT 2021)", { dim: true }),
    ];
  }

  // ── Git humor ──
  function forcePush(raw, { lang }) {
    if (!/^(git\s+push\s+(--force|-f)|force\s+push)$/i.test(raw)) return null;
    return [
      text(lang === "en" ? "pushed. hope your teammates forgive you." : "푸시 완료. 팀원들이 용서해주길.", { warn: true }),
      text(lang === "en" ? "(the rebase gods are not merciful.)" : "(rebase 의 신은 자비롭지 않다.)", { dim: true }),
    ];
  }

  // ── Unix command jokes (bilingual) ──
  function ifconfig(raw, { lang }) {
    if (!/^(ifconfig|ip\s+addr)(\s|$)/i.test(raw)) return null;
    const d = window.SITE_DATA.site.domain;
    return [
      text("lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536"),
      text("        inet 127.0.0.1  netmask 255.0.0.0"),
      text(lang === "en" ? "        (mostly talking to myself)" : "        (주로 혼잣말 중)", { dim: true }),
      text(""),
      text("eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500"),
      text(`        inet  ${d}`),
      text(lang === "en" ? "        status: caffeinated." : "        상태: 카페인 충전됨.", { dim: true }),
    ];
  }

  function netstat(raw, { lang }) {
    if (!/^netstat(\s|$)/i.test(raw)) return null;
    return [
      text(lang === "en" ? "Active connections:" : "활성 연결:", { strong: true }),
      text("tcp  localhost:8080  stlab:ssh        ESTABLISHED"),
      text("tcp  localhost:22    jeongin:zsh      LISTEN"),
      text("tcp  localhost:443   crisp:chat       ESTABLISHED"),
      text("tcp  localhost:5432  coffee.service   TIME_WAIT"),
    ];
  }

  function ps(raw, { lang }) {
    if (!/^ps(\s|$)/i.test(raw)) return null;
    return [
      text("  PID USER     CMD"),
      text("    1 jeongin  /sbin/init"),
      text("  123 jeongin  zsh"),
      text(lang === "en" ? "  456 jeongin  vim (trapped)" : "  456 jeongin  vim (갇힘)"),
      text(lang === "en" ? "  789 jeongin  writing-paper" : "  789 jeongin  논문-쓰는-중"),
      text(lang === "en" ? " 1337 jeongin  thinking-about-testing" : " 1337 jeongin  테스팅-생각-중"),
      text(" 4200 llm      hallucinate --confident", { dim: true }),
    ];
  }

  function df(raw, { lang }) {
    if (!/^df(\s|$)/i.test(raw)) return null;
    return [
      text("Filesystem       Size   Used  Avail Use%  Mounted on"),
      text("/dev/jeongin1    1.0T   978G    22G  98%  /home/jeongin"),
      text("/dev/coffee      inf    inf     0   100%  /mnt/fuel"),
      text("tmpfs             16G    0      16G   0%  /tmp"),
      text("/dev/papers      500G   500G    0   100%  /home/jeongin/.lab"),
      text(lang === "en" ? "(running out. caffeine helps.)" : "(거의 꽉참. 카페인이 도움됨.)", { dim: true }),
    ];
  }

  function freemem(raw, { lang }) {
    if (!/^free(\s|$)/i.test(raw)) return null;
    return [
      text("              total        used        free      cached"),
      text("Mem:         16384M      15800M        384M     12288M (coffee)"),
      text(lang === "en"
        ? "Swap:         2048M       1984M         64M (paging to whiteboard)"
        : "Swap:         2048M       1984M         64M (화이트보드로 페이징)"),
    ];
  }

  function envCmd(raw, { lang }) {
    if (!/^(env|printenv)(\s|$)/i.test(raw)) return null;
    return [
      text("USER=jeongin"),
      text("HOME=/home/jeongin"),
      text("SHELL=/bin/zsh"),
      text("PATH=/usr/local/bin:/usr/bin:/bin:/coffee"),
      text("LANG=ko_KR.UTF-8"),
      text(lang === "en" ? "EDITOR=vim    # don't ask how to exit" : "EDITOR=vim    # 나가는 법은 묻지 말기"),
      text("ADVISOR=watching"),
      text("MOOD=caffeinated"),
    ];
  }

  function man(raw, { lang }) {
    const m = raw.match(/^man\s+(\S+)/i);
    if (!m) return null;
    return [
      text(`No manual entry for ${m[1]}.`),
      text(lang === "en"
        ? "(RTFM stands for 'Read The Fine Manual'. alas, there is none.)"
        : "('RTFM — Read The Fine Manual' 라는데, 정작 매뉴얼이 없음.)", { dim: true }),
    ];
  }

  function curlWget(raw, { lang }) {
    const m = raw.match(/^(curl|wget)\s+(\S+)/i);
    if (!m) return null;
    const d = window.SITE_DATA.site.domain;
    return [
      text(`* connecting to ${m[2]}...`),
      text(`* curl: (6) could not resolve host of existence`, { warn: true }),
      text(lang === "en"
        ? `(the only URL that works here is ${d})`
        : `(여기서 동작하는 URL은 ${d} 뿐이에요)`, { dim: true }),
    ];
  }

  function sshCmd(raw, { lang }) {
    if (!/^ssh\s+\S+/i.test(raw)) return null;
    return [
      text("ssh: Permission denied (publickey).", { warn: true }),
      text(lang === "en"
        ? "(this isn't your machine. try 'chat' instead.)"
        : "(여긴 본인 머신이 아니에요. 'chat' 써보세요.)", { dim: true }),
    ];
  }

  function installPkg(raw, { lang }) {
    const m = raw.match(/^(apt|apt-get|pip|pip3|npm|yarn|brew|pacman|yum|dnf|cargo)\s+(install|add|i)\s+(\S+)/i);
    if (!m) return null;
    const mgr = m[1], pkg = m[3];
    if (pkg.toLowerCase() === "coffee") {
      return [text(lang === "en"
        ? "coffee: already at highest priority. cannot upgrade."
        : "coffee: 이미 최고 우선순위. 업그레이드 불가.")];
    }
    return [
      text(`${mgr}: resolving ${pkg}...`),
      text(`${mgr}: ${pkg} not in /dev/null repo.`, { warn: true }),
      text(lang === "en"
        ? "(this terminal doesn't install things. request via 'chat'.)"
        : "(이 터미널은 실제 설치 안 함. 'chat' 으로 요청해보세요.)", { dim: true }),
    ];
  }

  function touchCmd(raw, { lang }) {
    const m = raw.match(/^touch\s+(\S+)/i);
    if (!m) return null;
    return [
      text(lang === "en"
        ? `touched '${m[1]}'. symbolically.`
        : `'${m[1]}' 를 상징적으로 만짐.`),
      text(lang === "en"
        ? "(filesystem is read-only. art, not drafts.)"
        : "(파일시스템은 읽기 전용. 작품이라서.)", { dim: true }),
    ];
  }

  function mkdirCmd(raw, { lang }) {
    if (!/^mkdir(\s|$)/i.test(raw)) return null;
    return [text(lang === "en"
      ? "mkdir: cannot create directory: Read-only filesystem (by design)."
      : "mkdir: 디렉토리 생성 불가: 읽기 전용 파일시스템 (의도적).", { warn: true })];
  }

  function shutdownCmd(raw, { lang }) {
    if (!/^(shutdown|poweroff|halt)(\s|$)/i.test(raw)) return null;
    return [
      text(lang === "en"
        ? "shutdown: this terminal cannot shut down."
        : "shutdown: 이 터미널은 꺼지지 않아요.", { warn: true }),
      text(lang === "en" ? "(close the tab like a civilized person.)" : "(그냥 탭을 닫으세요.)", { dim: true }),
    ];
  }

  function chmod777(raw, { lang }) {
    if (!/^chmod\s+0?777(\s|$)/i.test(raw)) return null;
    return [
      text(lang === "en"
        ? "chmod 777: done. world-readable, world-writable, world-executable."
        : "chmod 777: 완료. 모두에게 읽기/쓰기/실행 권한."),
      text(lang === "en"
        ? "(privacy was a nice idea while it lasted.)"
        : "(프라이버시라는 개념, 좋았죠.)", { dim: true }),
    ];
  }

  function killInit(raw, { lang }) {
    if (!/^kill\s+-9\s+1\b/i.test(raw)) return null;
    return [
      text(lang === "en"
        ? "kill: cannot send signal to PID 1: Operation not permitted."
        : "kill: PID 1 에 신호 전송 불가: 권한 없음.", { warn: true }),
      text(lang === "en" ? "(that was init. nice attempt.)" : "(init 이었어요. 시도는 좋았습니다.)", { dim: true }),
    ];
  }

  function forkBomb(raw, { lang }) {
    if (!/^:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/i.test(raw)) return null;
    return [
      text(lang === "en"
        ? "bash: fork: Resource temporarily unavailable"
        : "bash: fork: 자원 일시적 사용 불가", { warn: true }),
      text(lang === "en" ? "(fork bomb. classic. noted.)" : "(fork bomb, 고전이네요.)", { dim: true }),
    ];
  }

  function ddZero(raw, { lang }) {
    if (!/^dd\s+if=\/dev\/(zero|urandom|random)\s+of=\/dev\//i.test(raw)) return null;
    return [
      text(lang === "en"
        ? "dd: failed to open '/dev/sda': Permission denied"
        : "dd: '/dev/sda' 열기 실패: 권한 없음", { warn: true }),
      text(lang === "en"
        ? "(we don't have raw disks here. also — why.)"
        : "(여긴 raw disk 없어요. 그리고 — 왜.)", { dim: true }),
    ];
  }

  function sudoBang(raw, { lang }) {
    if (!/^sudo\s+!!$/i.test(raw)) return null;
    return [
      text("sudo: bash: !!: command not found"),
      text(lang === "en" ? "(xkcd 149 not shipped yet.)" : "(xkcd 149 는 미구현.)", { dim: true }),
    ];
  }

  function historyClear(raw, { lang }) {
    if (!/^history\s+-c$/i.test(raw)) return null;
    return [
      text(lang === "en" ? "history cleared." : "기록 삭제됨."),
      text(lang === "en"
        ? "(this session. the browser still remembers.)"
        : "(이 세션만요. 브라우저는 다 기억합니다.)", { dim: true }),
    ];
  }

  function fsckCmd(raw, { lang }) {
    if (!/^fsck(\s|$)/i.test(raw)) return null;
    return [
      text(lang === "en" ? "fsck from util-linux 2.39" : "fsck from util-linux 2.39"),
      text("/dev/jeongin1: clean, 420/1048576 files, 69420/4194304 blocks"),
      text(lang === "en"
        ? "(read-only filesystem. nothing to fix, nothing to break.)"
        : "(읽기 전용. 고칠 것도, 깨질 것도 없음.)", { dim: true }),
    ];
  }

  function gitReset(raw, { lang }) {
    if (!/^git\s+reset(\s+--hard)?(\s|$)/i.test(raw)) return null;
    return [
      text("HEAD is now at 0000000 (sync)"),
      text(lang === "en"
        ? "(your work was probably fine. oh well.)"
        : "(작업물 괜찮았을 텐데요. 이제 아니고요.)", { dim: true }),
    ];
  }

  function gitBlame(raw, { lang }) {
    if (!/^git\s+blame(\s|$)/i.test(raw)) return null;
    return [
      text(lang === "en" ? "fatal: not a git repository" : "fatal: git 저장소 아님", { warn: true }),
      text(lang === "en" ? "(but yes, it was you.)" : "(근데 아마 당신이었을 거예요.)", { dim: true }),
    ];
  }

  function catUrandom(raw, { lang }) {
    if (!/^cat\s+\/dev\/(u?random|zero)(\s|$)/i.test(raw)) return null;
    return [
      text(lang === "en"
        ? "cat: /dev/urandom: permission denied"
        : "cat: /dev/urandom: 권한 없음", { warn: true }),
      text(lang === "en"
        ? "(you don't want that output. trust me.)"
        : "(그 출력 보고 싶지 않으실 거예요.)", { dim: true }),
    ];
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
    su,
    sudoRm, sandwich, rmAnything,
    coffee, fortune, date, uptime, ping, top, uname, reboot,
    hi, exitRevert, vimJoke, emacsJoke, nanoJoke,
    matrix, konamiHint,
    forty_two, hireMe,
    lolcat, lsLa, catSecret, catDreams, yes, sl, cowsay, star, god, credits,
    // LLM research self-burns
    hallucinate, temperature, promptEgg, stochasticParrot,
    // Git humor
    forcePush,
    // Unix command jokes
    ifconfig, netstat, ps, df, freemem, envCmd, man, curlWget, sshCmd,
    installPkg, touchCmd, mkdirCmd, shutdownCmd, chmod777, killInit,
    forkBomb, ddZero, sudoBang, historyClear, fsckCmd,
    gitReset, gitBlame, catUrandom,
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
