// Shell identity (su/exit/sudo) plus the handful of programs that ship as their own
// packages rather than as coreutils: sl, cowsay, fortune, cmatrix. These are real
// Unix software, so they are implemented rather than parodied.
//
// Dispatched as a fallback: terminal-commands.js checks the command table first and
// only calls tryHandle() for input that isn't a known command. That ordering matters,
// because these handlers match on free-form input (`su alice`, a fork bomb).
(function () {
  const NAME_KEY = "99jik:name";
  const store = window.PREFS.store;  // guarded localStorage, see prefs.js

  // Who the shell is. There can be several terminals now, and `su` in one is not
  // `su` in the others, so this works the way FS.enter does: whoever is running a
  // command points it at their own name first, and reads it back afterwards.
  //
  // The stored name is the one a new shell starts as, and the one a returning
  // visitor is greeted by, so `su` writes it too. What it does not do any more is
  // reach into the terminals that are already open.
  let current = store.get(NAME_KEY) || "anonymous";

  window.getPromptName = () => current;
  window.enterPromptName = (n) => { current = n || "anonymous"; };
  window.loginName = () => store.get(NAME_KEY) || "anonymous";
  window.setPromptName = (n) => {
    current = n || "anonymous";
    if (!n) store.del(NAME_KEY);
    else store.set(NAME_KEY, n);
    // crisp.js listens, because the chat nickname is one identity for the visitor
    // rather than one per window.
    window.dispatchEvent(new CustomEvent("promptname"));
  };

  window.KONAMI = { unlocked: false };

  const text = (t, opts = {}) => ({ kind: "text", text: t, ...opts });

  // Terminal display width. CJK glyphs don't render at exactly 2x ASCII in every
  // font, so measure the real thing and fall back to a code-point estimate.
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
    let w = 0;
    for (const ch of str) {
      const c = ch.codePointAt(0);
      const wide =
        (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0x3131 && c <= 0x318E) ||
        (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3040 && c <= 0x309F) ||
        (c >= 0x30A0 && c <= 0x30FF) || (c >= 0xFF00 && c <= 0xFFEF) ||
        (c >= 0x2E80 && c <= 0x303E);
      w += wide ? 2 : 1;
    }
    return w;
  }

  // ── identity ──────────────────────────────────────────────────────────────
  // Accounts listed in /etc/passwd can't be assumed; everything else is fair game.
  const PROTECTED_SU = ["jeongin", "stlab", "memo", "root"];

  function su(raw, { lang }) {
    if (!/^su(\s|$)/i.test(raw)) return null;
    const args = raw.trim().split(/\s+/).slice(1).filter(p => p !== "-");
    if (!args.length) {
      return [text(lang === "en" ? "usage: su <name>   e.g. su alice" : "사용법: su <name>   예: su alice", { warn: true })];
    }
    const name = args.join(" ").replace(/[.!?]+$/, "").slice(0, 24).trim();
    if (!name) return null;
    if (PROTECTED_SU.includes(name.toLowerCase())) {
      window.dispatchEvent(new CustomEvent("su-prompt", { detail: { user: name } }));
      return [text(lang === "en" ? "Password:" : "비밀번호:")];
    }
    window.setPromptName(name);
    return [
      text(lang === "en" ? `welcome, ${name}.` : `반가워요, ${name}.`, { strong: true }),
      text(lang === "en" ? "(type 'exit' to log out.)" : "('exit' 로 로그아웃.)", { dim: true }),
    ];
  }

  function exitRevert(raw, { lang }) {
    if (!/^(exit|quit|logout)$/i.test(raw)) return null;
    const current = window.getPromptName();
    if (!current || current === "anonymous") {
      // Nothing to log out of, so this is the login shell exiting: close the window.
      return [
        { kind: "mode", action: "close-window" },
        text("logout", { dim: true }),
      ];
    }
    window.setPromptName(null);
    return [text(lang === "en" ? `logged out ${current}. back to anonymous.` : `로그아웃 (${current}). 다시 anonymous 입니다.`, { dim: true })];
  }

  // Real sudo, for a user who isn't in the sudoers file. The message is verbatim.
  function sudo(raw, { lang }) {
    if (!/^sudo(\s|$)/i.test(raw)) return null;
    const who = window.getPromptName();
    return [
      text(`[sudo] password for ${who}: `),
      text(`${who} is not in the sudoers file.  This incident will be reported.`, { warn: true }),
    ];
  }

  // Real bash under a hit process limit. The fork bomb is a genuine shell construct,
  // so it gets the genuine failure.
  function forkBomb(raw) {
    if (!/^:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/.test(raw.trim())) return null;
    return [
      text("bash: fork: retry: Resource temporarily unavailable", { warn: true }),
      text("bash: fork: retry: Resource temporarily unavailable", { warn: true }),
      text("bash: fork: Resource temporarily unavailable", { warn: true }),
    ];
  }

  // ── packages ──────────────────────────────────────────────────────────────
  // sl(1): shows a steam locomotive when you typo `ls`. An actual Debian package.
  function sl(raw) {
    if (!/^sl$/i.test(raw.trim())) return null;
    return [
      "      ====        ________                ___________",
      "  _D _|  |_______/        \\__I_I_____===__|_________|",
      "   |(_)---  |   H\\________/ |   |        =|___ ___|",
      "   /     |  |   H  |  |     |   |         ||_| |_||",
      "  |      |  |   H  |__----------|         |/-=|___|=",
      "  | ________|___H__/__|_____/[][]~\\_______|        |",
      "  |/ |   |-----------I_____I [][] []  D   |=======|_",
      "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__",
      " |/-=|___|=    ||    ||    ||    |_____/~\\___/",
      "  \\_/      \\O=====O=====O=====O_/      \\_/",
    ].map(l => text(l));
  }

  // cowsay(1). Balloon width follows the measured cell width so CJK lines don't skew.
  function cowsay(raw) {
    if (!/^cowsay(\s|$)/i.test(raw)) return null;
    const msg = raw.split(/\s+/).slice(1).join(" ") || "moo";
    const w = cellWidth(msg);
    return [
      " " + "_".repeat(w + 2),
      "< " + msg + " >",
      " " + "-".repeat(w + 2),
      "        \\   ^__^",
      "         \\  (oo)\\_______",
      "            (__)\\       )\\/\\",
      "                ||----w |",
      "                ||     ||",
    ].map(l => text(l));
  }

  // fortune(1), reading the pool in data.js.
  function fortune(raw, { lang }) {
    if (!/^fortune$/i.test(raw.trim())) return null;
    const pools = (window.SITE_DATA && window.SITE_DATA.fortunes) || { ko: [], en: [] };
    const pool = (lang === "en" ? pools.en : pools.ko) || [];
    if (!pool.length) return [text("fortune: no fortune cookies installed", { warn: true })];
    const line = pool[Math.floor(Math.random() * pool.length)];
    const w = Math.min(cellWidth(line) + 2, 72);
    return [
      text(" +" + "-".repeat(w) + "+"),
      text(" | " + line + " |"),
      text(" +" + "-".repeat(w) + "+"),
    ];
  }

  // cmatrix(1).
  function cmatrix(raw) {
    if (!/^(cmatrix|matrix)$/i.test(raw.trim())) return null;
    return [{ kind: "mode", action: "matrix" }];
  }

  // Not a real command on a machine you don't own, but this one genuinely does
  // something here: it replays the boot log.
  function reboot(raw, { lang }) {
    if (!/^reboot$/i.test(raw.trim())) return null;
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent("site-reboot")); } catch {}
    }, 600);
    return [
      text(lang === "en" ? "Rebooting system..." : "시스템을 재시작합니다...", { strong: true }),
      text(lang === "en" ? "(press any key during boot to skip)" : "(부팅 중 아무 키나 누르면 건너뜁니다)", { dim: true }),
    ];
  }

  const handlers = [su, exitRevert, sudo, forkBomb, sl, cowsay, fortune, cmatrix, reboot];

  function tryHandle(input, ctx) {
    const raw = (input || "").trim();
    if (!raw) return null;
    for (const h of handlers) {
      try { const r = h(raw, ctx); if (r) return r; } catch (e) {}
    }
    return null;
  }

  const HINT_KO = "`man <명령>` 으로 사용법을 볼 수 있어요. `ls -a` 와 `find`, `grep` 으로 나머지를 찾아보세요.";
  const HINT_EN = "`man <command>` for usage. `ls -a`, `find` and `grep` will turn up the rest.";
  window.EXTRAS = { tryHandle, HINT_KO, HINT_EN };
})();
