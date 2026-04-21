// TerminalView — viewport-locked. Inner body scrolls; prompt stays at bottom.
// Supports bilingual (ko/en) and an in-terminal chat mode.

import * as React from "preact/compat";

function Block({ block, onRun, lang }) {
  if (block.kind === "text") {
    return (
      <div className={"t-line" + (block.dim ? " dim" : "") + (block.warn ? " warn" : "") + (block.strong ? " strong" : "")}>
        {block.text || "\u00a0"}
      </div>
    );
  }
  if (block.kind === "progressive") {
    return <ProgressiveBlock lines={block.lines} delay={block.delay} />;
  }
  if (block.kind === "live-top") {
    return <LiveTopBlock />;
  }
  if (block.kind === "weather") {
    return <WeatherBlock location={block.location} />;
  }
  if (block.kind === "now") {
    return <NowBlock view={block.view} lang={lang} />;
  }
  if (block.kind === "kv") {
    return (
      <div className="t-kv">
        {block.rows.map(([k, v], i) => (
          <div key={i} className="t-kv-row">
            <span className="t-kv-k">{k}</span>
            <span className="t-kv-v">{v}</span>
          </div>
        ))}
      </div>
    );
  }
  if (block.kind === "grid") {
    return (
      <div className="t-grid">
        {block.items.map((p, i) => (
          <div key={i} className="t-card" onClick={() => onRun && onRun("cat " + p.slug)}>
            <div className="t-card-h">
              <span className="t-card-slug">{p.slug}</span>
              <span className="t-card-year">{p.year}</span>
            </div>
            <div className="t-card-title">{lang === "en" ? p.title_en : p.title_ko}</div>
            <div className="t-card-sum">{lang === "en" ? p.summary_en : p.summary_ko}</div>
            <div className="t-card-stack">{p.stack.join(" · ")}</div>
            <div className="t-card-cta">cat {p.slug} →</div>
          </div>
        ))}
      </div>
    );
  }
  if (block.kind === "link") {
    return <a className="t-link" href={block.href} target="_blank" rel="noreferrer">{block.text}</a>;
  }
  if (block.kind === "chatmsg") {
    const who = block.role === "user" ? "you" : "jeongin";
    const colorClass = block.role === "user" ? "chat-user" : "chat-bot";
    const ck = block.contentKind || "text";
    let body;
    if (ck === "image") {
      body = (
        <a href={block.fileUrl} target="_blank" rel="noreferrer" className="chat-file-link">
          <img src={block.fileUrl} alt={block.fileName || ""} className="chat-img" />
        </a>
      );
    } else if (ck === "audio") {
      body = <audio controls src={block.fileUrl} className="chat-audio" />;
    } else if (ck === "file") {
      body = (
        <a href={block.fileUrl} target="_blank" rel="noreferrer" className="chat-file-link">
          [file] {block.fileName || "attachment"} ↗
        </a>
      );
    } else {
      body = block.text;
    }
    return (
      <div className={"chat-msg " + colorClass}>
        <span className="chat-who">[{who}]</span>
        <span className="chat-body">{body}</span>
        {block.pending && <span className="chat-pending"> ...</span>}
      </div>
    );
  }
  return null;
}

function TerminalView({ onModeChange, onTheme, lang, onLang }) {
  const [history, setHistory] = React.useState([]);
  const [input, setInput] = React.useState("");
  const [cmdStack, setCmdStack] = React.useState([]);
  const [stackIdx, setStackIdx] = React.useState(-1);
  const [suggestions, setSuggestions] = React.useState([]);
  const [showHelp, setShowHelp] = React.useState(false);
  const [typedGhost, setTypedGhost] = React.useState("");
  const [chatOn, setChatOn] = React.useState(false);
  const [promptName, setPromptName] = React.useState(() => (window.getPromptName ? window.getPromptName() : "anonymous"));
  const [promptPath, setPromptPath] = React.useState(() => (window.FS ? window.FS.displayCwd() : "~"));
  const [matrixOn, setMatrixOn] = React.useState(false);
  const inputRef = React.useRef(null);
  const scrollRef = React.useRef(null);

  // Expose command history for the `history` command (read-only mirror).
  React.useEffect(() => { window.TERM_HISTORY = cmdStack; }, [cmdStack]);

  // live prompt name updates (eggs.js dispatches 'promptname')
  React.useEffect(() => {
    const h = () => setPromptName(window.getPromptName ? window.getPromptName() : "anonymous");
    window.addEventListener("promptname", h);
    return () => window.removeEventListener("promptname", h);
  }, []);

  React.useEffect(() => {
    const h = () => setPromptPath(window.FS ? window.FS.displayCwd() : "~");
    window.addEventListener("promptpath", h);
    return () => window.removeEventListener("promptpath", h);
  }, []);

  // Live-chat: surface operator messages + typing indicator into the terminal history.
  React.useEffect(() => {
    const onAgent = (e) => {
      const d = e.detail || {};
      setHistory(h => [
        ...h.filter(x => !(x.type === "chatline" && x.pending)),
        {
          type: "chatline",
          role: "bot",
          text: d.text,
          contentKind: d.kind || "text",
          fileName: d.fileName,
          fileType: d.fileType,
          fileUrl: d.fileUrl,
        },
      ]);
    };
    const onTyping = (e) => {
      setHistory(h => {
        const hasPending = h.some(x => x.type === "chatline" && x.pending);
        if (e.detail.isTyping && !hasPending) {
          return [...h, { type: "chatline", role: "bot", text: "…", pending: true }];
        }
        if (!e.detail.isTyping && hasPending) {
          return h.filter(x => !(x.type === "chatline" && x.pending));
        }
        return h;
      });
    };
    window.addEventListener("livechat-agent-message", onAgent);
    window.addEventListener("livechat-agent-typing", onTyping);
    return () => {
      window.removeEventListener("livechat-agent-message", onAgent);
      window.removeEventListener("livechat-agent-typing", onTyping);
    };
  }, []);

  // Konami code listener → unlocks matrix
  React.useEffect(() => {
    const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let idx = 0;
    const h = (e) => {
      const k = e.key;
      if (k === seq[idx]) {
        idx++;
        if (idx === seq.length) {
          idx = 0;
          window.KONAMI.unlocked = true;
          setMatrixOn(true);
          setTimeout(() => setMatrixOn(false), 3500);
        }
      } else {
        idx = (k === seq[0]) ? 1 : 0;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const T = lang === "en" ? {
    emptyAsk: "What would you like to see? Pick one:",
    suggest: "quick commands →",
    status: "⏎ run · tab: complete · ? help · ↑↓ history",
    chatPrompt: "chat ❯",
    chatEnd: "Chat ended.",
    youLabel: "you",
    jeonginLabel: "jeongin",
    easyBtn: "Easy Mode →",
    chatClear: "Chat cleared.",
    chipsLabel: "quick →",
  } : {
    emptyAsk: "무엇부터 보여드릴까요? 하나 골라보세요:",
    suggest: "추천 명령어 →",
    status: "⏎ 실행 · tab 자동완성 · ? 도움말 · ↑↓ 히스토리",
    chatPrompt: "채팅 ❯",
    chatEnd: "채팅을 종료했어요.",
    youLabel: "나",
    jeonginLabel: "jeongin",
    easyBtn: "Easy Mode →",
    chatClear: "채팅 기록을 비웠어요.",
    chipsLabel: "추천 →",
  };

  // Seed a couple of commands so the screen feels "lived-in" on first load,
  // instead of a static welcome banner. Re-seeds on lang change.
  React.useEffect(() => {
    setChatOn(false);
    const path = window.FS ? window.FS.displayCwd() : "~";
    const seed = ["about", "til"].flatMap(cmd => {
      const blocks = window.TERMINAL && window.TERMINAL.run ? (window.TERMINAL.run(cmd, lang) || []) : [];
      return [
        { type: "prompt", cmd, chat: false, path },
        { type: "out", blocks: blocks.filter(b => b.kind !== "mode") },
      ];
    });
    setHistory(seed);
    setInput("");
    setSuggestions([]);
  }, [lang]);

  // ghost typing animation
  React.useEffect(() => {
    if (input) { setTypedGhost(""); return; }
    const rotating = chatOn
      ? (lang === "en"
          ? ["coffee count today?", "how do you exit vim btw", "is the oracle up", "/exit"]
          : ["오늘 커피 몇 잔이에요?", "vim 어떻게 나가요 진짜로", "논문 잘 써지세요?", "/exit"])
      : ["about", "projects", "cat sil-harness", "chat", "easy"];
    let ci = 0, i = 0, dir = 1, tid;
    const tick = () => {
      const w = rotating[ci];
      if (dir === 1) { i++; if (i > w.length) { dir = -1; tid = setTimeout(tick, 1500); return; } }
      else { i--; if (i <= 0) { dir = 1; ci = (ci + 1) % rotating.length; tid = setTimeout(tick, 400); return; } }
      setTypedGhost(w.slice(0, i));
      tid = setTimeout(tick, dir === 1 ? 90 : 40);
    };
    tid = setTimeout(tick, 1200);
    return () => clearTimeout(tid);
  }, [input, chatOn, lang]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, suggestions]);

  const pushOut = (blocks) => setHistory(h => [...h, { type: "out", blocks }]);
  const pushPrompt = (cmd) => setHistory(h => [...h, { type: "prompt", cmd, chat: chatOn, path: window.FS ? window.FS.displayCwd() : "~" }]);

  const runCommand = async (raw) => {
    const cmd = (raw || "").trim();
    if (chatOn) return handleChat(cmd);

    if (!cmd) {
      pushPrompt("");
      pushOut([{ kind: "text", text: T.emptyAsk, dim: true }]);
      setSuggestions(window.TERMINAL.EMPTY_SUGGESTIONS);
      return;
    }
    if (cmd === "?") { setShowHelp(true); return; }
    setCmdStack(s => [...s, cmd]); setStackIdx(-1);
    const blocks = window.TERMINAL.run(cmd, lang);
    pushPrompt(cmd);
    pushOut(blocks);
    setInput(""); setSuggestions([]);
    const mode = blocks?.find(b => b.kind === "mode");
    if (mode) {
      if (mode.action === "clear") setHistory([]);
      if (mode.action === "easy") onModeChange && onModeChange("easy");
      if (mode.action === "theme") onTheme && onTheme(mode.value);
      if (mode.action === "lang") onLang && onLang(mode.value);
      if (mode.action === "chat") setChatOn(true);
      if (mode.action === "matrix") { setMatrixOn(true); setTimeout(() => setMatrixOn(false), 3500); }
    }
  };

  const handleChat = (raw) => {
    const text = (raw || "").trim();
    if (!text) return;
    if (text === "/exit") {
      setChatOn(false);
      setHistory(h => [...h, { type: "prompt", cmd: text, chat: true }, { type: "out", blocks: [{ kind: "text", text: T.chatEnd, dim: true }] }]);
      setInput(""); return;
    }
    if (text === "/clear") {
      setHistory(h => [...h, { type: "prompt", cmd: text, chat: true }, { type: "out", blocks: [{ kind: "text", text: T.chatClear, dim: true }] }]);
      setInput(""); return;
    }
    // Append visitor message + send to backend. Operator reply arrives via livechat-agent-message event.
    setHistory(h => [...h, { type: "chatline", role: "user", text }]);
    setInput("");
    if (window.LIVE_CHAT && window.LIVE_CHAT.send) window.LIVE_CHAT.send(text);
  };

  const onKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); runCommand(input); }
    else if (e.key === "Tab" && !chatOn) {
      e.preventDefault();
      const opts = window.TERMINAL.complete(input, lang);
      if (opts.length === 1) setInput(opts[0] + " ");
      else if (opts.length > 1) setSuggestions(opts);
    }
    else if (e.key === "ArrowUp" && !chatOn) {
      e.preventDefault();
      const idx = stackIdx < 0 ? cmdStack.length - 1 : Math.max(0, stackIdx - 1);
      if (cmdStack[idx]) { setInput(cmdStack[idx]); setStackIdx(idx); }
    }
    else if (e.key === "ArrowDown" && !chatOn) {
      e.preventDefault();
      if (stackIdx < 0) return;
      const idx = stackIdx + 1;
      if (idx >= cmdStack.length) { setInput(""); setStackIdx(-1); }
      else { setInput(cmdStack[idx]); setStackIdx(idx); }
    }
    else if (e.key === "l" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setHistory([]); }
    else if (e.key === "?" && !input && !chatOn) { e.preventDefault(); setShowHelp(true); }
    else if (e.key === "Escape" && chatOn) { e.preventDefault(); handleChat("/exit"); }
  };

  const COMMANDS = window.TERMINAL.buildCommands(lang);

  return (
    <div className="term-shell" onClick={() => inputRef.current && inputRef.current.focus()}>
      <TermTitleBar lang={lang} onLang={onLang} onEasy={() => onModeChange && onModeChange("easy")} chatOn={chatOn} onExitChat={() => handleChat("/exit")} />

      <div className="term-body" ref={scrollRef}>
        <div className="term-body-inner">
        <TermBanner lang={lang} />

        {history.map((h, i) => {
          if (h.type === "prompt") return (
            <div key={i} className="t-prompt-line">
              <span className="t-user">{promptName}@{window.SITE_DATA.site.handle}</span>
              <span className="t-sep"> in </span>
              <span className="t-path">{h.chat ? "~/chat" : (h.path || "~")}</span>
              <span className="t-caret"> ❯ </span>
              <span className="t-cmd">{h.cmd}</span>

            </div>
          );
          if (h.type === "chatline") return (
            <Block key={h.id || i} block={{
              kind: "chatmsg",
              role: h.role,
              text: h.text,
              pending: h.pending,
              contentKind: h.contentKind,
              fileName: h.fileName,
              fileType: h.fileType,
              fileUrl: h.fileUrl,
            }} lang={lang} />
          );
          return <div key={i} className="t-out">{h.blocks.map((b, j) => <Block key={j} block={b} onRun={runCommand} lang={lang} />)}</div>;
        })}
        </div>
      </div>

      {/* sticky prompt at bottom of viewport */}
      <div className="term-bottom">
        {suggestions.length > 0 && (
          <div className="t-suggest">
            {suggestions.map((s, i) => (
              <span key={i} className="t-chip" onClick={() => { setInput(s); setSuggestions([]); inputRef.current && inputRef.current.focus(); }}>{s}</span>
            ))}
          </div>
        )}
        <QuickChips lang={lang} onRun={runCommand} chatOn={chatOn} T={T} COMMANDS={COMMANDS} />
        <div className="t-prompt-line active sticky">
          <span className="t-user">{promptName}@{window.SITE_DATA.site.handle}</span>
          <span className="t-sep"> in </span>
          <span className="t-path">{chatOn ? "~/chat" : promptPath}</span>
          <span className="t-caret"> ❯ </span>
          <span className="t-input-wrap">
            <input
              ref={inputRef}
              autoFocus
              value={input}
              onChange={e => { setInput(e.target.value); setSuggestions([]); }}
              onKeyDown={onKey}
              className="t-input"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              aria-label="terminal input"
            />
            {!input && <span className="t-ghost">{typedGhost}<span className="t-ghost-caret">▍</span></span>}
          </span>
        </div>
        <TermStatusBar text={T.status} />
      </div>

      {showHelp && <HelpOverlay lang={lang} COMMANDS={COMMANDS} onClose={() => setShowHelp(false)} onRun={(c) => { setShowHelp(false); runCommand(c); }} />}
      {matrixOn && <MatrixRain />}
    </div>
  );
}

// Block-only logo: every glyph is either █ (U+2588) or a space.
// Each row is EXACTLY 22 chars — no box-drawing, no sub-pixel quirks.
// Letter widths: 9(4) + sp + 9(4) + sp + J(3) + sp + I(3) + sp + K(4) = 22.
const LOGO_99JIK = [
  "████ ████  ██ ███ █  █",
  "█  █ █  █   █  █  █ █ ",
  "█  █ █  █   █  █  ██  ",
  "████ ████   █  █  ██  ",
  "   █    █ █ █  █  █ █ ",
  "   █    █  ██ ███ █  █",
].join("\n");

function TermBanner({ lang }) {
  const p = window.SITE_DATA.profile;
  const role = lang === "en" ? p.role_en : p.role_ko;
  const aff  = lang === "en" ? p.affiliation_en : p.affiliation_ko;
  const name = lang === "en" ? p.name_en : p.name_ko;
  const nameAlt = lang === "en" ? p.name_ko : p.name_en;
  return (
    <div className="term-banner">
      <div className="term-banner-head">
        <pre className="term-banner-logo">{LOGO_99JIK}</pre>
        <BannerAnim />
      </div>
      <div className="term-banner-meta">
        <span className="tbm-tag">.com</span>
        <span className="tbm-name">{name}</span>
        <span className="tbm-alt">{nameAlt}</span>
        <span className="tbm-sep">│</span>
        <span>{role} · {aff}</span>
        <span className="tbm-online">● online · KST {new Date().toLocaleTimeString("en-GB").slice(0,5)}</span>
      </div>
    </div>
  );
}

// Randomly picks one of N banner animations per page load.
function BannerAnim() {
  const ANIMS = [LorenzSpin, DonutSpin, Starfield, CubeSpin];
  const [Pick] = React.useState(() => ANIMS[Math.floor(Math.random() * ANIMS.length)]);
  return <Pick />;
}

// Lorenz attractor — integrates the classic chaotic ODE once, then rotates the
// butterfly around its vertical axis. Orthographic projection fills the frame so
// the two-lobed shape is actually recognizable.
function LorenzSpin() {
  const preRef = React.useRef(null);
  React.useEffect(() => {
    const W = 30, H = 13;
    const CX = W / 2, CY = H / 2;
    const SHADES = ".:-=+*#%@";

    // Integrate once. Skip initial transient, center z around 0.
    const pts = [];
    {
      const sigma = 10, rho = 28, beta = 8 / 3;
      const dt = 0.008;
      let x = 0.1, y = 0, z = 0;
      for (let i = 0; i < 6000; i++) {
        const dx = sigma * (y - x);
        const dy = x * (rho - z) - y;
        const dz = x * y - beta * z;
        x += dx * dt; y += dy * dt; z += dz * dt;
        if (i > 400) pts.push([x, y, z - 25]); // z centered ~0
      }
    }

    // Orthographic projection. Scale chosen so the butterfly fills W × H.
    // Char aspect is ~2:1 (tall:wide), so Ky is a little less than half Kx.
    const Kx = 0.70, Ky = 0.25;
    let angle = 0;
    let raf = 0, last = 0;

    const render = (t) => {
      raf = requestAnimationFrame(render);
      if (t - last < 33) return;
      last = t;

      const out = new Array(W * H).fill(" ");
      const zbuf = new Array(W * H).fill(Infinity);
      const cA = Math.cos(angle), sA = Math.sin(angle);

      for (let i = 0; i < pts.length; i++) {
        const px = pts[i][0], py = pts[i][1], pz = pts[i][2];
        // Rotate around Lorenz z (vertical) — swings between front/side views.
        const rx = px * cA - py * sA;
        const rDepth = px * sA + py * cA;
        const ry = pz;
        const sx = Math.floor(CX + rx * Kx);
        const sy = Math.floor(CY - ry * Ky);
        if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
          const o = sy * W + sx;
          if (rDepth < zbuf[o]) {
            zbuf[o] = rDepth;
            // depth ∈ roughly [-30, 30] → closer (smaller) = brighter
            const depthN = Math.floor((30 - rDepth) / 60 * SHADES.length);
            out[o] = SHADES[Math.max(0, Math.min(SHADES.length - 1, depthN))];
          }
        }
      }
      const lines = new Array(H);
      for (let r = 0; r < H; r++) lines[r] = out.slice(r * W, (r + 1) * W).join("");
      if (preRef.current) preRef.current.textContent = lines.join("\n");
      angle += 0.008;
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <pre ref={preRef} className="term-banner-anim anim-lorenz" aria-hidden="true" />;
}

// Andy Sloane's rotating torus — shaded via surface normal.
function DonutSpin() {
  const preRef = React.useRef(null);
  React.useEffect(() => {
    const W = 30, H = 13;
    const CX = W / 2, CY = H / 2;
    const K1 = 9, K2 = 4.5;
    const SHADES = ".,-~:;=!*#$@";
    let A = 0, B = 0, raf = 0, last = 0;
    const render = (t) => {
      raf = requestAnimationFrame(render);
      if (t - last < 40) return;
      last = t;
      const out = new Array(W * H).fill(" ");
      const zbuf = new Array(W * H).fill(0);
      const sA = Math.sin(A), cA = Math.cos(A);
      const sB = Math.sin(B), cB = Math.cos(B);
      for (let j = 0; j < 6.283; j += 0.12) {
        const cj = Math.cos(j), sj = Math.sin(j);
        for (let i = 0; i < 6.283; i += 0.035) {
          const ci = Math.cos(i), si = Math.sin(i);
          const h = cj + 2;
          const D = 1 / (si * h * sA + sj * cA + 5);
          const t2 = si * h * cA - sj * sA;
          const x = Math.floor(CX + K1 * D * (ci * h * cB - t2 * sB));
          const y = Math.floor(CY + K2 * D * (ci * h * sB + t2 * cB));
          const o = x + W * y;
          const N = Math.floor(8 * ((sj * sA - si * cj * cA) * cB - si * cj * sA - sj * cA - ci * cj * sB));
          if (y >= 0 && y < H && x >= 0 && x < W && D > zbuf[o]) {
            zbuf[o] = D;
            out[o] = SHADES[N > 0 ? Math.min(N, SHADES.length - 1) : 0];
          }
        }
      }
      const lines = new Array(H);
      for (let r = 0; r < H; r++) lines[r] = out.slice(r * W, (r + 1) * W).join("");
      if (preRef.current) preRef.current.textContent = lines.join("\n");
      A += 0.05; B += 0.025;
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <pre ref={preRef} className="term-banner-anim anim-donut" aria-hidden="true" />;
}

// Starfield warp — stars stream radially outward from the center (hyperspace).
// Each frame we draw a short line from the star's previous projected position
// to its current one, so closer stars leave longer streaks.
function Starfield() {
  const preRef = React.useRef(null);
  React.useEffect(() => {
    const W = 30, H = 13, CX = W / 2, CY = H / 2;
    const N = 55;
    const Kx = 24, Ky = 10;      // Ky ≈ Kx/2 to compensate for 2:1 char aspect
    const Z_NEAR = 0.35, Z_FAR = 20;
    const SPEED = 0.28;
    const SHADES = ".-+*#@";

    function spawn(s) {
      s.x = (Math.random() - 0.5) * 2;
      s.y = (Math.random() - 0.5) * 2;
      s.z = Z_FAR * (0.6 + Math.random() * 0.5);
    }
    const stars = Array.from({ length: N }, () => {
      const s = {}; spawn(s); s.z = Math.random() * Z_FAR; return s;
    });

    function plot(grid, x, y, ch) {
      if (x >= 0 && x < W && y >= 0 && y < H) grid[y * W + x] = ch;
    }
    function line(grid, x0, y0, x1, y1, ch) {
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx - dy, x = x0, y = y0, steps = 0;
      while (true) {
        plot(grid, x, y, ch);
        if (x === x1 && y === y1) break;
        const e2 = err * 2;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 <  dx) { err += dx; y += sy; }
        if (++steps > 50) break;
      }
    }

    let raf = 0, last = 0;
    const render = (t) => {
      raf = requestAnimationFrame(render);
      if (t - last < 40) return;
      last = t;
      const grid = new Array(W * H).fill(" ");

      for (const s of stars) {
        const zPrev = s.z;
        s.z -= SPEED;
        if (s.z < Z_NEAR) { spawn(s); continue; }
        const sxPrev = Math.round(CX + (s.x / zPrev) * Kx);
        const syPrev = Math.round(CY + (s.y / zPrev) * Ky);
        const sxNow  = Math.round(CX + (s.x / s.z)  * Kx);
        const syNow  = Math.round(CY + (s.y / s.z)  * Ky);
        const shadeN = Math.floor((Z_FAR - s.z) / Z_FAR * SHADES.length);
        const ch = SHADES[Math.max(0, Math.min(SHADES.length - 1, shadeN))];
        line(grid, sxPrev, syPrev, sxNow, syNow, ch);
      }

      if (preRef.current) {
        const lines = new Array(H);
        for (let r = 0; r < H; r++) lines[r] = grid.slice(r * W, (r + 1) * W).join("");
        preRef.current.textContent = lines.join("\n");
      }
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <pre ref={preRef} className="term-banner-anim anim-starfield" aria-hidden="true" />;
}

// Rotating wireframe cube — 8 vertices, 12 edges, Bresenham line draw.
function CubeSpin() {
  const preRef = React.useRef(null);
  React.useEffect(() => {
    const W = 30, H = 13, CX = W / 2, CY = H / 2;
    const V = [
      [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
      [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],
    ];
    const E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    function plot(grid, x, y, ch) {
      if (x >= 0 && x < W && y >= 0 && y < H) grid[y * W + x] = ch;
    }
    function line(grid, x0, y0, x1, y1, ch) {
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx - dy, x = x0, y = y0;
      while (true) {
        plot(grid, x, y, ch);
        if (x === x1 && y === y1) break;
        const e2 = err * 2;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 <  dx) { err += dx; y += sy; }
      }
    }
    let A = 0, B = 0, raf = 0, last = 0;
    const render = (t) => {
      raf = requestAnimationFrame(render);
      if (t - last < 33) return;
      last = t;
      const grid = new Array(W * H).fill(" ");
      const cA = Math.cos(A), sA = Math.sin(A);
      const cB = Math.cos(B), sB = Math.sin(B);
      const proj = V.map(([x, y, z]) => {
        // rotate Y
        const x1 = x * cA + z * sA, z1 = -x * sA + z * cA;
        // rotate X
        const y2 = y * cB - z1 * sB, z2 = y * sB + z1 * cB;
        const d = z2 + 4;
        const sx = Math.round(CX + (x1 / d) * 18);
        const sy = Math.round(CY - (y2 / d) * 9);
        return [sx, sy, z2];
      });
      for (const [a, b] of E) {
        const avgZ = (proj[a][2] + proj[b][2]) / 2;
        const ch = avgZ > 0 ? "#" : "*";  // far edges dimmer
        line(grid, proj[a][0], proj[a][1], proj[b][0], proj[b][1], ch);
      }
      // vertex dots
      for (const [x, y] of proj) plot(grid, x, y, "@");
      const lines = new Array(H);
      for (let r = 0; r < H; r++) lines[r] = grid.slice(r * W, (r + 1) * W).join("");
      if (preRef.current) preRef.current.textContent = lines.join("\n");
      A += 0.03; B += 0.02;
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <pre ref={preRef} className="term-banner-anim anim-cube" aria-hidden="true" />;
}

function ProgressiveBlock({ lines, delay = 700 }) {
  const [count, setCount] = React.useState(1);
  React.useEffect(() => {
    if (!lines || count >= lines.length) return;
    const id = setTimeout(() => setCount(c => c + 1), delay);
    return () => clearTimeout(id);
  }, [count, lines, delay]);
  if (!lines) return null;
  return (
    <>
      {lines.slice(0, count).map((line, i) => (
        <div key={i} className="t-line">{line || " "}</div>
      ))}
    </>
  );
}

// Live `top` — refreshes CPU% every 1.5s while mounted.
function LiveTopBlock() {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 1500);
    return () => clearInterval(id);
  }, []);
  const w = (base) => (Math.max(0, Math.min(99.9, base + (Math.random() - 0.5) * 10))).toFixed(1).padStart(5, " ");
  return (
    <>
      <div className="t-line">  PID USER      %CPU  %MEM  COMMAND</div>
      <div className="t-line">{`    1 jeongin   ${w(88)}  12.4  thinking-about-testing`}</div>
      <div className="t-line">{`    2 jeongin   ${w(42)}   8.1  writing-paper`}</div>
      <div className="t-line">{`    3 jeongin   ${w(15)}   2.2  refreshing-arxiv`}</div>
      <div className="t-line">{`    4 jeongin   ${w( 2)}   0.8  sleeping`}</div>
      <div className="t-line dim">{`    5 llm          0.3   0.1  waiting-for-oracle`}</div>
    </>
  );
}

// wttr.in JSON endpoint → local ASCII rendering. Avoids HTML being served to browsers.
const WEATHER_ART = {
  sunny:  ["    \\   /    ", "     .-.     ", "  -- (   ) --", "     `-'     ", "    /   \\    "],
  cloudy: ["             ", "     .--.    ", "  .-(    ).  ", " (___.__)__) ", "             "],
  fog:    [" _ - _ - _ - ", "  _ - _ - _  ", " _ - _ - _ - ", "  _ - _ - _  ", " _ - _ - _ - "],
  rain:   ["     .-.     ", "    (   ).   ", "   (___(__)  ", "    ' ' ' '  ", "   ' ' ' '   "],
  snow:   ["     .-.     ", "    (   ).   ", "   (___(__)  ", "    *  *  *  ", "   *  *  *   "],
  storm:  ["     .-.     ", "    (   ).   ", "   (___(__)  ", "   ,/,/,/,/  ", "  ,/,/,/     "],
  unknown:["             ", "      ?      ", "    ?   ?    ", "      ?      ", "             "],
};

function pickWeatherArt(desc) {
  const d = (desc || "").toLowerCase();
  if (d.includes("thunder") || d.includes("storm")) return "storm";
  if (d.includes("snow") || d.includes("sleet") || d.includes("blizzard")) return "snow";
  if (d.includes("rain") || d.includes("drizzle") || d.includes("shower")) return "rain";
  if (d.includes("fog") || d.includes("mist") || d.includes("haze")) return "fog";
  if (d.includes("clear") || d.includes("sunny")) return "sunny";
  if (d.includes("cloud") || d.includes("overcast") || d.includes("partly")) return "cloudy";
  return "unknown";
}

function WeatherBlock({ location }) {
  const [state, setState] = React.useState({ loading: true });
  React.useEffect(() => {
    const loc = encodeURIComponent(location || "Daegu");
    fetch(`https://wttr.in/${loc}?format=j1`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setState({ loading: false, data }))
      .catch(() => setState({ loading: false, error: true }));
  }, [location]);

  if (state.loading) return <div className="t-line dim">fetching weather…</div>;
  if (state.error || !state.data) {
    return <div className="t-line warn">weather: could not fetch for {location || "Daegu"}.</div>;
  }

  const cc = state.data.current_condition && state.data.current_condition[0];
  const area = state.data.nearest_area && state.data.nearest_area[0] && state.data.nearest_area[0].areaName[0].value;
  if (!cc) return <div className="t-line warn">weather: malformed response.</div>;

  const desc = cc.weatherDesc?.[0]?.value || "Unknown";
  const art = WEATHER_ART[pickWeatherArt(desc)];
  const temp = cc.temp_C;
  const feels = cc.FeelsLikeC;
  const wind = cc.windspeedKmph;
  const windDir = cc.winddir16Point;
  const humidity = cc.humidity;
  const obs = cc.observation_time || "";

  const info = [
    `${desc.padEnd(18, " ")}  ${temp}°C  (feels ${feels}°C)`,
    `wind: ${windDir} ${wind} km/h      humidity: ${humidity}%`,
  ];

  return (
    <>
      {art.map((line, i) => (
        <div key={"a" + i} className="t-line">
          {line}   {info[i] || ""}
        </div>
      ))}
      <div className="t-line dim">{area || location} · obs {obs}</div>
    </>
  );
}

function TermTitleBar({ lang, onLang, onEasy, chatOn, onExitChat }) {
  return (
    <div className="term-title">
      <span className="term-dot r" /><span className="term-dot y" /><span className="term-dot g" />
      <div className="term-title-name">{chatOn ? `chat — ${window.SITE_DATA.site.handle}` : `anonymous@${window.SITE_DATA.site.handle} — ~/ — zsh`}</div>
      <div className="term-title-actions">
        <div className="lang-seg" role="group" aria-label="language">
          <button className={"lang-btn" + (lang === "ko" ? " on" : "")} onClick={() => onLang("ko")}>한</button>
          <button className={"lang-btn" + (lang === "en" ? " on" : "")} onClick={() => onLang("en")}>EN</button>
        </div>
        {chatOn
          ? <button className="term-easy" onClick={onExitChat}>exit chat ✕</button>
          : <button className="term-easy" onClick={onEasy}>{lang === "en" ? "Easy Mode →" : "Easy Mode →"}</button>}
      </div>
    </div>
  );
}

function TermStatusBar({ text }) {
  return <div className="term-status"><span>{text}</span><span>daegu · kr</span></div>;
}

function QuickChips({ onRun, chatOn, T, COMMANDS, lang }) {
  if (chatOn) return (
    <div className="t-quick">
      <span className="t-quick-label">{T.suggest}</span>
      {["/exit", "/clear"].map(c => (
        <span key={c} className="t-chip" onClick={() => onRun(c)}>{c}</span>
      ))}
    </div>
  );
  const items = ["about", "projects", "research", "now", "chat", "cv", "til", "easy"];
  return (
    <div className="t-quick">
      <span className="t-quick-label">{T.chipsLabel}</span>
      {items.map(c => (
        <span key={c} className="t-chip t-chip-solid" onClick={() => onRun(c)} title={COMMANDS[c]?.hint}>
          {c}
        </span>
      ))}
    </div>
  );
}

function HelpOverlay({ lang, COMMANDS, onClose, onRun }) {
  const entries = Object.entries(COMMANDS).filter(([,v]) => !v.hidden);
  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-panel" onClick={e => e.stopPropagation()}>
        <div className="help-h">
          <div>
            <div className="help-title">{lang === "en" ? "Commands" : "명령어 목록"}</div>
            <div className="help-sub">{lang === "en" ? "Click to run. ESC or click outside to close." : "클릭하면 실행됩니다. ESC 또는 바깥 클릭으로 닫기."}</div>
          </div>
          <button className="help-close" onClick={onClose}>close ✕</button>
        </div>
        <div className="help-grid">
          {entries.map(([k, v]) => (
            <button key={k} className="help-row" onClick={() => onRun(k)}>
              <span className="help-cmd">{k}</span>
              <span className="help-hint">{v.hint}</span>
            </button>
          ))}
        </div>
        <div className="help-egghint">
          {lang === "en" ? window.EGGS.HINT_EN : window.EGGS.HINT_KO}
        </div>
      </div>
    </div>
  );
}

function NowBlock({ view, lang }) {
  const [state, setState] = React.useState({ loading: true });
  React.useEffect(() => {
    let cancelled = false;
    window.CALENDAR.load().then(data => {
      if (cancelled) return;
      setState({ loading: false, data });
    });
    return () => { cancelled = true; };
  }, []);

  if (state.loading) return <div className="t-line dim">{lang === "en" ? "loading calendar..." : "캘린더 불러오는 중..."}</div>;
  const data = state.data;
  const events = view === "month" ? window.CALENDAR.getMonth(data) : view === "week" ? window.CALENDAR.getWeek(data) : window.CALENDAR.getToday(data);
  const title = view === "month" ? (lang === "en" ? "this month" : "이번 달") : view === "week" ? (lang === "en" ? "this week" : "이번 주") : (lang === "en" ? "today" : "오늘 일정");
  const tagColor = { lab: "var(--t-cyan)", focus: "var(--t-accent)", teach: "var(--t-yellow)", life: "var(--t-magenta, #c678dd)", other: "var(--t-muted)" };

  if (!events.length) {
    return (
      <div className="t-now">
        <div className="t-now-h">── {title} ──</div>
        <div className="t-line dim">{lang === "en" ? "nothing on. good time to focus." : "비어 있어요. 집중할 시간이네요."}</div>
        <div className="t-now-foot">{lang === "en" ? `last sync: ${window.CALENDAR.relativeAgo(data.updated, lang)}` : `마지막 동기화: ${window.CALENDAR.relativeAgo(data.updated, lang)}`}</div>
      </div>
    );
  }

  // group by day for week/month view
  const groups = {};
  events.forEach(e => {
    const key = window.CALENDAR.fmtDay(e._start, lang);
    (groups[key] = groups[key] || []).push(e);
  });

  return (
    <div className="t-now">
      <div className="t-now-h">── {title} ──</div>
      {Object.entries(groups).map(([day, evs]) => (
        <div key={day} className="t-now-day">
          {view !== "today" && <div className="t-now-daylbl">{day}</div>}
          {evs.map((e, i) => (
            <div key={i} className="t-now-ev">
              <span className="t-now-time">{window.CALENDAR.fmtTime(e._start)}–{window.CALENDAR.fmtTime(e._end)}</span>
              <span className="t-now-tag" style={{ color: tagColor[e.tag] || "var(--t-muted)" }}>●</span>
              <span className="t-now-title">{e.title}</span>
              {e.location && <span className="t-now-loc">@ {e.location}</span>}
            </div>
          ))}
        </div>
      ))}
      <div className="t-now-foot">
        {lang === "en" ? `last sync: ${window.CALENDAR.relativeAgo(data.updated, lang)}` : `마지막 동기화: ${window.CALENDAR.relativeAgo(data.updated, lang)}`}
        {" · "}<span className="t-now-hint">{lang === "en" ? "try: now --week · now --month" : "try: now --week · now --month"}</span>
      </div>
    </div>
  );
}
function MatrixRain() {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const cols = Math.floor(c.width / 14);
    const drops = new Array(cols).fill(0).map(() => Math.floor(Math.random() * c.height / 14));
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]<>=+-*/";
    let raf;
    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#39ff14";
      ctx.font = "14px 'JetBrains Mono', monospace";
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, i * 14, drops[i] * 14);
        if (drops[i] * 14 > c.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="matrix-canvas" />;
}

export { TerminalView };
