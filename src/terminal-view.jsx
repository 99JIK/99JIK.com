// TerminalView. The prompt is the last line of the scrollback, not a fixed bar, so
// input and output share one flow the way a real terminal does. Rendering is text
// only: no cards, no chips, no modal. Bilingual (ko/en) with an in-terminal chat mode.

import * as React from "preact/compat";
import { ViEditor } from "./vi-editor.jsx";
import { ytPlaylistItems, MpvStrip, PlayerBlock } from "./mpv.jsx";
import { hushChat } from "./chat.jsx";

function Block({ block, lang }) {
  if (block.kind === "text") {
    const cls = "t-line" + (block.dim ? " dim" : "") + (block.warn ? " warn" : "") + (block.strong ? " strong" : "");
    // `parts` paints segments of one line, the way ls --color and lolcat do. Still a
    // single monospace line: alignment lives in the text, colour only sits on top.
    if (block.parts) {
      return (
        <div className={cls}>
          {block.parts.map((p, i) => p.c ? <span key={i} className={"t-c-" + p.c}>{p.t}</span> : p.t)}
        </div>
      );
    }
    return <div className={cls}>{block.text || " "}</div>;
  }
  if (block.kind === "weather") return <WeatherBlock location={block.location} />;
  if (block.kind === "fetch") return <FetchBlock url={block.url} head={block.head} />;
  if (block.kind === "qr") return <QrBlock grid={block.grid} caption={block.caption} mode={block.mode} />;
  if (block.kind === "live") return <LiveFileBlock source={block.source} path={block.path} />;
  if (block.kind === "now") return <NowBlock view={block.view} lang={lang} />;
  if (block.kind === "player") return <PlayerBlock start={block.start} lang={lang} />;
  if (block.kind === "link") {
    return <a className="t-link" href={block.href} target="_blank" rel="noreferrer">{block.text}</a>;
  }
  if (block.kind === "chatmsg") {
    const who = block.role === "user" ? "you" : "jeongin";
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
          [file] {block.fileName || "attachment"}
        </a>
      );
    } else body = block.text;
    return (
      <div className={"chat-msg " + (block.role === "user" ? "chat-user" : "chat-bot")
                      + (block.cont ? " cont" : "")}>
        {/* The column is still there when the name is not, so the text stays lined
            up down the run instead of stepping left on the second line. */}
        <span className="chat-who">{block.cont ? "" : `[${who}]`}</span>
        <span className="chat-body">{body}</span>
        {block.pending && <span className="chat-pending"> ...</span>}
      </div>
    );
  }
  return null;
}

// PS1. Bash renders `user@host:path$ `, so the pieces are spans of one line rather
// than a laid-out row.
function Ps1({ user, host, path, chat }) {
  if (chat) return <span className="t-ps1"><span className="t-ps1-user">chat</span><span className="t-ps1-punct">&gt; </span></span>;
  return (
    <span className="t-ps1">
      <span className="t-ps1-user">{user}@{host}</span>
      <span className="t-ps1-punct">:</span>
      <span className="t-ps1-path">{path}</span>
      <span className="t-ps1-punct">$ </span>
    </span>
  );
}

function longestCommonPrefix(list) {
  if (!list.length) return "";
  let p = list[0];
  for (const s of list) {
    while (!s.startsWith(p)) p = p.slice(0, -1);
    if (!p) break;
  }
  return p;
}

// Bash prints ambiguous completions into the scrollback in columns, then redraws
// the prompt. Width is fixed at 80 because that is what the output is designed for.
function columnize(items, width = 80) {
  const w = items.reduce((m, s) => Math.max(m, s.length), 0) + 2;
  const cols = Math.max(1, Math.floor(width / w));
  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols).map(s => s.padEnd(w)).join("").trimEnd());
  }
  return rows.map(text => ({ kind: "text", text }));
}

function TerminalView({ onModeChange, onTheme, lang, onLang, wm }) {
  const [history, setHistory] = React.useState([]);
  const [input, setInput] = React.useState("");
  const [caret, setCaret] = React.useState(0);
  const [cmdStack, setCmdStack] = React.useState([]);
  const [stackIdx, setStackIdx] = React.useState(-1);
  const [chatOn, setChatOn] = React.useState(false);
  // This shell's identity. A new one starts as the stored login name; `su` after
  // that belongs to this window only.
  const nameRef = React.useRef(window.loginName ? window.loginName() : "anonymous");
  const [promptName, setPromptName] = React.useState(nameRef.current);
  // This terminal's own working directory. There can be several windows open, and
  // `cd` in one used to move all of them: the filesystem holds one cwd, so each
  // shell points it at its own before running anything.
  const cwdRef = React.useRef(window.FS ? window.FS.getCwd() : "/home/jeongin");
  const [promptPath, setPromptPath] = React.useState(() => (window.FS ? window.FS.displayCwd() : "~"));

  // Everything that reads the filesystem goes through here first.
  const atCwd = React.useCallback((fn) => {
    if (!window.FS) return fn();
    window.FS.enter(cwdRef.current);
    if (window.enterPromptName) window.enterPromptName(nameRef.current);
    try { return fn(); }
    finally {
      cwdRef.current = window.FS.getCwd();
      setPromptPath(window.FS.displayCwd());
      if (window.getPromptName) {
        nameRef.current = window.getPromptName();
        setPromptName(nameRef.current);
      }
    }
  }, []);
  const [matrixOn, setMatrixOn] = React.useState(false);
  const [suAwait, setSuAwait] = React.useState(null);   // account being authenticated
  const [rsearch, setRsearch] = React.useState(null);   // { term, skip } for Alt-R
  const [vi, setVi] = React.useState(null);             // { path, lines } while vi owns the screen
  const inputRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const tabRef = React.useRef(0);      // consecutive Tab presses
  const statusRef = React.useRef(0);   // $? of the last command

  const HOST = window.SITE_DATA.site.handle;

  React.useEffect(() => { window.TERM_HISTORY = cmdStack; }, [cmdStack]);

  // su -> Password: prompt flow. extras.js dispatches "su-prompt" for protected
  // users. The event is global, so only the shell the command was typed into
  // takes it: every other terminal would otherwise stop for a password nobody
  // asked it for.
  React.useEffect(() => {
    const h = (e) => {
      if (wm && !wm.focused) return;
      setSuAwait((e && e.detail && e.detail.user) || null);
    };
    window.addEventListener("su-prompt", h);
    return () => window.removeEventListener("su-prompt", h);
  }, [wm && wm.focused]);

  // `promptname` is global and stays that way for the chat nickname, but a shell no
  // longer listens to it: another window running `su` is not this window's business.

  // `promptpath` used to be how the prompt learned it had moved. It is global, so
  // with more than one terminal it announced every shell's `cd` to all of them;
  // atCwd() updates only the shell that ran the command.

  // Live chat: operator messages and typing indicator land in the scrollback.
  React.useEffect(() => {
    const onAgent = (e) => {
      const d = e.detail || {};
      setHistory(h => [
        ...h.filter(x => !(x.type === "chatline" && x.pending)),
        { type: "chatline", role: "bot", text: d.text, contentKind: d.kind || "text",
          fileName: d.fileName, fileType: d.fileType, fileUrl: d.fileUrl },
      ]);
    };
    const onTyping = (e) => {
      setHistory(h => {
        const pending = h.some(x => x.type === "chatline" && x.pending);
        if (e.detail.isTyping && !pending) return [...h, { type: "chatline", role: "bot", text: "…", pending: true }];
        if (!e.detail.isTyping && pending) return h.filter(x => !(x.type === "chatline" && x.pending));
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

  React.useEffect(() => {
    const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let idx = 0;
    const h = (e) => {
      if (e.key === seq[idx]) {
        if (++idx === seq.length) {
          idx = 0;
          window.KONAMI.unlocked = true;
          setMatrixOn(true);
          setTimeout(() => setMatrixOn(false), 3500);
        }
      } else idx = (e.key === seq[0]) ? 1 : 0;
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const T = lang === "en" ? {
    chatEnd: "Chat ended.", chatClear: "Chat cleared.",
    hint: "Type `help` for commands, `about` for the short version.",
    easyHint: "Prefer a normal page? Type `easy`, or open 99jik.com/?view=easy",
    lastLogin: (d) => `Last login: ${d} on tty1`,
  } : {
    chatEnd: "채팅을 종료했어요.", chatClear: "채팅 기록을 비웠어요.",
    hint: "`help` 로 명령 목록, `about` 으로 짧은 소개를 봅니다.",
    easyHint: "터미널이 낯설면 `easy` 를 입력하세요. 또는 99jik.com/?view=easy",
    lastLogin: (d) => `마지막 로그인: ${d} (tty1)`,
  };

  // Seed one command on mount so the screen has content behind the prompt.
  // Mount only: re-seeding on lang change used to wipe the visitor's scrollback.
  React.useEffect(() => {
    setChatOn(false);
    const path = window.FS ? window.FS.displayCwd() : "~";
    const blocks = (atCwd(() => window.TERMINAL.run("about", lang)) || []).filter(b => b.kind !== "mode");
    setHistory([
      { type: "prompt", cmd: "about", chat: false, path, user: "anonymous" },
      { type: "out", blocks },
    ]);
    setInput("");
  }, []);

  // The prompt is the last element in the flow, so any growth means scrolling down.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, input, rsearch]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const inner = el.firstElementChild;
    if (!inner) return;
    const obs = new ResizeObserver(() => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
    });
    obs.observe(inner);
    return () => obs.disconnect();
  }, []);

  const currentPath = () => (window.FS ? window.FS.displayCwd(cwdRef.current) : "~");
  const pushOut = (blocks) => setHistory(h => [...h, { type: "out", blocks }]);
  const setLine = (v, pos) => {
    setInput(v);
    const p = pos === undefined ? v.length : pos;
    setCaret(p);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.value = v; el.setSelectionRange(p, p); }
    });
  };

  // Bash history expansion, the two forms anyone actually types.
  function expandBang(raw) {
    const last = cmdStack[cmdStack.length - 1];
    if (!last) return { text: raw, changed: false };
    let out = raw;
    if (/(^|\s)!!(\s|$)/.test(out)) out = out.replace(/!!/g, last);
    if (/(^|\s)!\$(\s|$)/.test(out)) {
      const parts = last.trim().split(/\s+/);
      out = out.replace(/!\$/g, parts[parts.length - 1]);
    }
    return { text: out, changed: out !== raw };
  }

  const runCommand = async (raw) => {
    const typed = (raw || "").trim();

    if (suAwait) {
      const user = suAwait;
      setSuAwait(null);
      setHistory(h => [...h,
        { type: "prompt", cmd: "", chat: false, path: currentPath(), user: promptName, password: true },
        { type: "out", blocks: [
          { kind: "text", text: "su: Authentication failure", warn: true },
          { kind: "text", text: lang === "en"
            ? `(no password for ${user} will work; the account is not yours)`
            : `(${user} 계정은 열리지 않습니다. 본인 계정이 아니니까요)`, dim: true },
        ]},
      ]);
      statusRef.current = 1;
      setLine("");
      return;
    }

    if (chatOn) return handleChat(typed);

    const path = currentPath();
    const user = promptName;
    if (!typed) {
      setHistory(h => [...h, { type: "prompt", cmd: "", chat: false, path, user }]);
      setLine("");
      return;
    }

    const { text: cmd, changed } = expandBang(typed);
    setCmdStack(s => [...s, cmd]);
    setStackIdx(-1);
    // Bash echoes the expanded line before running it.
    setHistory(h => [...h, { type: "prompt", cmd: typed, chat: false, path, user },
                     ...(changed ? [{ type: "out", blocks: [{ kind: "text", text: cmd, dim: true }] }] : [])]);

    const blocks = atCwd(() => window.TERMINAL.run(cmd, lang)) || [];
    pushOut(blocks);
    setLine("");

    const notFound = blocks.some(b => b.kind === "text" && /command not found|명령을 찾지 못했어요/.test(b.text || ""));
    statusRef.current = notFound ? 127 : blocks.some(b => b.warn) ? 1 : 0;

    const mode = blocks.find(b => b.kind === "mode");
    if (mode) {
      if (mode.action === "clear") setHistory([]);
      if (mode.action === "history-clear") { setCmdStack([]); setStackIdx(-1); }
      if (mode.action === "easy") onModeChange && onModeChange("easy");
      if (mode.action === "theme") onTheme && onTheme(mode.value);
      if (mode.action === "lang") onLang && onLang(mode.value);
      if (mode.action === "chat") setChatOn(true);
      if (mode.action === "vi") setVi({ path: mode.path, lines: mode.lines });
      // `exit` from the login shell closes the window, which is what exiting a
      // login shell does on a real desktop.
      if (mode.action === "close-window" && wm && wm.onClose) setTimeout(wm.onClose, 250);
      if (mode.action === "open-window" && wm && wm.onOpen) wm.onOpen(mode.app, mode.arg);
      if (mode.action === "matrix") setMatrixOn(true);
    }
  };

  // The rest of the desktop can hand the terminal a line to run, which is how the
  // file manager's "open in the terminal" gets you a shell already in that folder.
  // The queue holds it until a shell is focused, so it works whether the window was
  // closed, on another workspace, or one of several.
  const focused = !wm || wm.focused;
  React.useEffect(() => {
    const drain = () => {
      if (!focused) return;
      for (const line of window.SHELL.take()) runCommand(line);
    };
    const off = window.SHELL.sub(drain);
    drain();
    return off;
  }, [focused, lang, chatOn]);

  // While the terminal is in chat mode the conversation is already on screen, so
  // the dock should not also announce it.
  React.useEffect(() => {
    if (!chatOn) return;
    hushChat(true);
    return () => hushChat(false);
  }, [chatOn]);

  const handleChat = (text) => {
    if (!text) return;
    if (text === "/exit" || text === "/clear") {
      setHistory(h => [...h, { type: "prompt", cmd: text, chat: true },
        { type: "out", blocks: [{ kind: "text", text: text === "/exit" ? T.chatEnd : T.chatClear, dim: true }] }]);
      if (text === "/exit") setChatOn(false);
      setLine("");
      return;
    }
    setHistory(h => [...h, { type: "chatline", role: "user", text }]);
    setLine("");
    if (window.LIVE_CHAT && window.LIVE_CHAT.send) window.LIVE_CHAT.send(text);
  };

  // ── reverse-i-search (Ctrl-R) ─────────────────────────────────────────────
  const rmatch = React.useMemo(() => {
    if (!rsearch) return "";
    const hits = cmdStack.slice().reverse().filter(c => c.includes(rsearch.term));
    return hits[Math.min(rsearch.skip, Math.max(0, hits.length - 1))] || "";
  }, [rsearch, cmdStack]);

  const syncCaret = () => {
    const el = inputRef.current;
    if (el) setCaret(el.selectionStart == null ? el.value.length : el.selectionStart);
  };

  const onKey = (e) => {
    const el = inputRef.current;
    const pos = el && el.selectionStart != null ? el.selectionStart : input.length;
    if (e.key !== "Tab") tabRef.current = 0;

    // Reverse search owns the line while it is open. It lives on Alt-R, not Ctrl-R:
    // Ctrl-R reloads the page and a web terminal does not get to take that away.
    if (rsearch) {
      if (e.key === "Enter") { e.preventDefault(); setRsearch(null); runCommand(rmatch); return; }
      if (e.key === "Escape") { e.preventDefault(); setRsearch(null); setLine(rmatch); return; }
      if (e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); setRsearch(s => ({ ...s, skip: s.skip + 1 })); return; }
    }
    if (e.altKey && e.key.toLowerCase() === "r" && !chatOn) {
      e.preventDefault(); setRsearch({ term: "", skip: 0 }); setLine(""); return;
    }

    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "c") {
        // Copy wins when there is a selection. A terminal you cannot copy out of is
        // broken, and that matters more than SIGINT.
        const sel = (() => { try { return String(window.getSelection() || ""); } catch { return ""; } })();
        if (sel.trim()) return;
        e.preventDefault();                               // otherwise cancel the line
        setHistory(h => [...h, { type: "prompt", cmd: input + "^C", chat: chatOn, path: currentPath(), user: promptName }]);
        statusRef.current = 130;
        setRsearch(null); setLine("");
        return;
      }
      if (k === "l") { e.preventDefault(); setHistory([]); return; }
      if (k === "a") { e.preventDefault(); setLine(input, 0); return; }
      if (k === "e") { e.preventDefault(); setLine(input, input.length); return; }
      if (k === "u") { e.preventDefault(); setLine(input.slice(pos), 0); return; }
      if (k === "k") { e.preventDefault(); setLine(input.slice(0, pos), pos); return; }
      // Ctrl-W is reserved by the browser for closing the tab, so word-kill is on
      // Alt-Backspace instead, which is also what readline offers.
      if (k === "d") {
        e.preventDefault();
        if (!input) runCommand("exit");
        else setLine(input.slice(0, pos) + input.slice(pos + 1), pos);
        return;
      }
      return;
    }

    if (e.altKey && e.key === "Backspace") {
      e.preventDefault();
      const head = input.slice(0, pos).replace(/\S+\s*$/, "");
      setLine(head + input.slice(pos), head.length);
      return;
    }

    if (e.key === "Enter") { e.preventDefault(); runCommand(input); return; }

    if (e.key === "Tab" && !chatOn) {
      e.preventDefault();
      // Completion reads the filesystem, so it reads this shell's directory.
      const opts = atCwd(() => window.TERMINAL.complete(input, lang));
      if (!opts.length) return;
      if (opts.length === 1) { setLine(opts[0] + " "); return; }
      const common = longestCommonPrefix(opts);
      if (common.length > input.length) { setLine(common); return; }
      // Second consecutive Tab lists the candidates, then the prompt is redrawn.
      if (++tabRef.current >= 2) {
        setHistory(h => [...h, { type: "prompt", cmd: input, chat: false, path: currentPath(), user: promptName },
                              { type: "out", blocks: columnize(opts) }]);
        tabRef.current = 0;
      }
      return;
    }

    if (e.key === "ArrowUp" && !chatOn) {
      e.preventDefault();
      const idx = stackIdx < 0 ? cmdStack.length - 1 : Math.max(0, stackIdx - 1);
      if (cmdStack[idx] !== undefined) { setLine(cmdStack[idx]); setStackIdx(idx); }
      return;
    }
    if (e.key === "ArrowDown" && !chatOn) {
      e.preventDefault();
      if (stackIdx < 0) return;
      const idx = stackIdx + 1;
      if (idx >= cmdStack.length) { setLine(""); setStackIdx(-1); }
      else { setLine(cmdStack[idx]); setStackIdx(idx); }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (chatOn) handleChat("/exit");
      else if (suAwait) { setSuAwait(null); setLine(""); }
      return;
    }
  };

  const onInput = (e) => {
    const v = e.target.value;
    if (rsearch) { setRsearch(s => ({ ...s, term: v, skip: 0 })); setInput(v); setCaret(v.length); return; }
    setInput(v);
    syncCaret();
  };

  // What the visitor sees on the active line: the raw text, or dots while a
  // password is being typed.
  const shown = suAwait ? "" : input;
  const cursorAt = Math.min(caret, shown.length);

  return (
    <div className="term-shell" onClick={() => inputRef.current && inputRef.current.focus()}>
      <TermTitleBar lang={lang} onLang={onLang} onEasy={() => onModeChange && onModeChange("easy")}
                    chatOn={chatOn} onExitChat={() => handleChat("/exit")} user={promptName} path={promptPath}
                    wm={wm} />

      <MpvStrip lang={lang} />

      {vi ? (
        <ViEditor
          path={vi.path}
          initial={vi.lines}
          lang={lang}
          onExit={(note) => {
            setVi(null);
            setHistory(h => [...h, { type: "out", blocks: [
              { kind: "text", text: note || `"${vi.path}" ${vi.lines.length}L`, dim: true },
            ]}]);
            requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
          }}
        />
      ) : (
      <div className="term-body" ref={scrollRef} role="log" aria-live="polite"
           aria-label={lang === "en" ? "terminal output" : "터미널 출력"}>
        <div className="term-body-inner">
          <TermBanner lang={lang} T={T} />

          {history.map((h, i) => {
            if (h.type === "prompt") return (
              <div key={i} className="t-prompt-line">
                <Ps1 user={h.user || "anonymous"} host={HOST} path={h.path || "~"} chat={h.chat} />
                <span className="t-cmd">{h.password ? "" : h.cmd}</span>
              </div>
            );
            if (h.type === "chatline") {
              // Repeating the name on every line of a run reads like two people
              // taking turns when it is one person still talking.
              const prev = history[i - 1];
              const same = prev && prev.type === "chatline" && prev.role === h.role;
              return (
                <Block key={i} lang={lang} block={{
                  kind: "chatmsg", role: h.role, text: h.text, pending: h.pending, cont: same,
                  contentKind: h.contentKind, fileName: h.fileName, fileType: h.fileType, fileUrl: h.fileUrl,
                }} />
              );
            }
            return <div key={i} className="t-out">{h.blocks.map((b, j) => <Block key={j} block={b} lang={lang} />)}</div>;
          })}

          {/* The live prompt is the last line of the flow, not a fixed bar. */}
          <div className="t-prompt-line active">
            {suAwait
              ? <span className="t-ps1">{lang === "en" ? "Password: " : "비밀번호: "}</span>
              : rsearch
                ? <span className="t-ps1 t-rsearch">(reverse-i-search)`{rsearch.term}': </span>
                : <Ps1 user={promptName} host={HOST} path={chatOn ? "~/chat" : promptPath} chat={chatOn} />}
            <span className="t-echo">
              {rsearch ? rmatch : (
                <>
                  {shown.slice(0, cursorAt)}
                  <span className="t-cursor">{shown[cursorAt] || " "}</span>
                  {shown.slice(cursorAt + 1)}
                </>
              )}
            </span>
            <input
              ref={inputRef}
              autoFocus
              type={suAwait ? "password" : "text"}
              value={input}
              onInput={onInput}
              onKeyDown={onKey}
              onKeyUp={syncCaret}
              onClick={syncCaret}
              className="t-input"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              aria-label={lang === "en" ? "terminal input" : "터미널 입력"}
            />
          </div>
        </div>
      </div>
      )}

      {matrixOn && <MatrixRain lang={lang} onDone={() => setMatrixOn(false)} />}
    </div>
  );
}

// Picks one of the four ASCII animations per page load. They sit beside the logo,
// so they cost horizontal space that was empty anyway, not vertical space.
function BannerAnim() {
  const ANIMS = [LorenzSpin, DonutSpin, Starfield, CubeSpin];
  const [Pick] = React.useState(() => ANIMS[Math.floor(Math.random() * ANIMS.length)]);
  // Continuous rAF loops with no meaningful still frame. Keep the empty box so
  // dropping them under reduced motion does not shift the banner.
  if (window.prefersReducedMotion()) return <pre className="term-banner-anim" aria-hidden="true" />;
  return <Pick />;
}

// Lorenz attractor - integrates the classic chaotic ODE once, then rotates the
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
        // Rotate around Lorenz z (vertical) - swings between front/side views.
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

// Andy Sloane's rotating torus - shaded via surface normal.

// Andy Sloane's rotating torus - shaded via surface normal.
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

// Starfield warp - stars stream radially outward from the center (hyperspace).
// Each frame we draw a short line from the star's previous projected position
// to its current one, so closer stars leave longer streaks.

// Starfield warp - stars stream radially outward from the center (hyperspace).
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

// Rotating wireframe cube - 8 vertices, 12 edges, Bresenham line draw.

// Rotating wireframe cube - 8 vertices, 12 edges, Bresenham line draw.
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


const LOGO_99JIK = [
  " █████╗  █████╗      ██╗██╗██╗  ██╗",
  "██╔══██╗██╔══██╗     ██║██║██║ ██╔╝",
  "╚██████║╚██████║     ██║██║█████╔╝ ",
  " ╚═══██║ ╚═══██║██   ██║██║██╔═██╗ ",
  " █████╔╝ █████╔╝╚█████╔╝██║██║  ██╗",
  " ╚════╝  ╚════╝  ╚════╝ ╚═╝╚═╝  ╚═╝",
].join("\n");

// Login banner. Identity is deliberately absent: the seeded `about` prints it
// immediately below, and having both made the first screen say the same thing three
// times over. The banner only does what a motd does, which is tell you what to type.
function TermBanner({ lang, T }) {
  const p = window.SITE_DATA.profile;
  const name = lang === "en" ? p.name_en : p.name_ko;
  const nameAlt = lang === "en" ? p.name_ko : p.name_en;
  const role = lang === "en" ? p.role_en : p.role_ko;
  const aff = lang === "en" ? p.affiliation_en : p.affiliation_ko;   // hidden <h1> only
  const stamp = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Seoul", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return (
    <div className="term-banner">
      {/* The logo is a <pre>, so the default view would otherwise have no heading. */}
      <h1 className="sr-only">{name} ({nameAlt}) - {role} · {aff}</h1>
      <div className="term-banner-head">
        <pre className="term-banner-logo" aria-hidden="true">{LOGO_99JIK}</pre>
        <BannerAnim />
      </div>
      <div className="t-line dim">{T.lastLogin(stamp)}</div>
      <div className="t-line dim">{T.hint}</div>
      <div className="t-line dim">{T.easyHint}</div>
      <div className="t-line">&nbsp;</div>
    </div>
  );
}

function TermTitleBar({ lang, onLang, onEasy, chatOn, onExitChat, user, path, wm }) {
  const live = wm && wm.canWindow;
  const label = lang === "en"
    ? { close: "close", min: "minimise", max: wm && wm.state === "max" ? "restore" : "maximise" }
    : { close: "닫기", min: "최소화", max: wm && wm.state === "max" ? "이전 크기로" : "최대화" };
  return (
    <div className={"term-title" + (live ? " live" : "")}
         onPointerDown={live && wm.state === "windowed" ? wm.onDragStart : undefined}
         onDblClick={live ? wm.onToggleMax : undefined}>
      {live ? (
        <div className="term-dots">
          <button type="button" className="term-dot r" title={label.close} aria-label={label.close}
                  onPointerDown={e => e.stopPropagation()} onClick={wm.onClose} />
          <button type="button" className="term-dot y" title={label.min} aria-label={label.min}
                  onPointerDown={e => e.stopPropagation()} onClick={wm.onMinimise} />
          <button type="button" className="term-dot g" title={label.max} aria-label={label.max}
                  onPointerDown={e => e.stopPropagation()} onClick={wm.onToggleMax} />
        </div>
      ) : (
        <div className="term-dots" aria-hidden="true">
          <span className="term-dot r" /><span className="term-dot y" /><span className="term-dot g" />
        </div>
      )}
      <div className="term-title-name">
        {chatOn ? `chat - ${window.SITE_DATA.site.handle}` : `${user}@${window.SITE_DATA.site.handle}: ${path} - bash`}
      </div>
      <div className="term-title-actions">
        {/* Language and Easy Mode live in the dock, which is always on screen, so a
            second copy in this title bar is one the window has no business owning.
            They come back only if the terminal is rendered without a desktop. */}
        {!wm && (
          <>
            <div className="lang-seg" role="group" aria-label="language">
              <button className={"lang-btn" + (lang === "ko" ? " on" : "")} onClick={() => onLang("ko")}>한</button>
              <button className={"lang-btn" + (lang === "en" ? " on" : "")} onClick={() => onLang("en")}>EN</button>
            </div>
            {!chatOn && <button className="term-easy" onClick={onEasy}>Easy Mode</button>}
          </>
        )}
        {/* Leaving chat mode is the terminal's own business, so it stays. */}
        {chatOn && <button className="term-easy" onClick={onExitChat}>exit chat</button>}
      </div>
    </div>
  );
}

// wttr.in JSON endpoint, rendered locally as ASCII.
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
    const loc = encodeURIComponent(location || window.SITE_DATA.profile.weatherLocation);
    // Third-party endpoint, no SLA. Without a deadline a hung request leaves
    // "fetching weather..." on screen forever.
    let cancelled = false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    fetch(`https://wttr.in/${loc}?format=j1`, { signal: ctl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { if (!cancelled) setState({ loading: false, data }); })
      .catch(() => { if (!cancelled) setState({ loading: false, error: true }); });
    return () => { cancelled = true; clearTimeout(timer); ctl.abort(); };
  }, [location]);

  if (state.loading) return <div className="t-line dim">fetching weather...</div>;
  if (state.error || !state.data) {
    return <div className="t-line warn">weather: could not fetch for {location || window.SITE_DATA.profile.weatherLocation}.</div>;
  }
  const cc = state.data.current_condition && state.data.current_condition[0];
  if (!cc) return <div className="t-line warn">weather: malformed response.</div>;
  const area = state.data.nearest_area?.[0]?.areaName?.[0]?.value;
  const desc = cc.weatherDesc?.[0]?.value || "Unknown";
  const art = WEATHER_ART[pickWeatherArt(desc)];
  const info = [
    `${desc.padEnd(18, " ")}  ${cc.temp_C}°C  (feels ${cc.FeelsLikeC}°C)`,
    `wind: ${cc.winddir16Point} ${cc.windspeedKmph} km/h      humidity: ${cc.humidity}%`,
  ];
  return (
    <>
      {art.map((line, i) => <div key={"a" + i} className="t-line">{line}   {info[i] || ""}</div>)}
      <div className="t-line dim">{area || location} · obs {cc.observation_time || ""}</div>
    </>
  );
}

// curl over same-origin URLs. The request is real, which is why this renders as a
// component: the shell pipeline is synchronous, so a fetch cannot be piped. `man
// curl` says so rather than letting it fail quietly.
function FetchBlock({ url, head }) {
  const [state, setState] = React.useState({ loading: true });
  React.useEffect(() => {
    let cancelled = false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const t0 = performance.now();
    fetch(url, { signal: ctl.signal, cache: "no-store" })
      .then(async (r) => {
        const body = head ? "" : await r.text();
        if (cancelled) return;
        setState({
          loading: false, status: r.status, statusText: r.statusText,
          headers: [...r.headers.entries()], body, ms: Math.round(performance.now() - t0),
        });
      })
      .catch((e) => {
        if (!cancelled) setState({ loading: false, error: e && e.name === "AbortError" ? "Operation timed out" : String(e) });
      });
    return () => { cancelled = true; clearTimeout(timer); ctl.abort(); };
  }, [url, head]);

  if (state.loading) return <div className="t-line dim">connecting...</div>;
  if (state.error) return <div className="t-line warn">curl: (28) {state.error}</div>;

  const MAX = 200;
  const lines = head
    ? state.headers.map(([k, v]) => k + ": " + v)
    : String(state.body).split(String.fromCharCode(10));
  const shown = lines.slice(0, MAX);
  return (
    <>
      {head && <div className="t-line">HTTP/1.1 {state.status} {state.statusText}</div>}
      {shown.map((l, i) => <div key={i} className="t-line">{l || " "}</div>)}
      {lines.length > MAX && <div className="t-line dim">(truncated: {lines.length - MAX} more lines)</div>}
      <div className="t-line dim">
        {"* " + state.status + " " + state.statusText + " in " + state.ms + "ms"}
      </div>
    </>
  );
}
// A QR the phone can actually read. The ASCII form is two characters per module,
// so the module is square only if the line height equals twice the font advance.
// That advance is font dependent, so it gets measured rather than guessed: at the
// default 1.7 line height a module comes out 1:1.42 and simply will not decode.
function QrBlock({ grid, caption, mode }) {
  const boxRef = React.useRef(null);
  const [lineHeight, setLineHeight] = React.useState(null);

  React.useEffect(() => {
    if (mode === "svg" || !boxRef.current) return;
    // Measure inside the element that actually holds the code, not its wrapper:
    // the two can carry different font sizes and then the module is not square.
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:inherit";
    probe.textContent = "M".repeat(50);
    boxRef.current.appendChild(probe);
    const advance = probe.getBoundingClientRect().width / 50;
    boxRef.current.removeChild(probe);
    // Whole pixels: a 16.8px row leaves sub-pixel seams on some displays, and a seam
    // through the code is enough to stop it decoding.
    if (advance > 0) setLineHeight(Math.max(2, Math.round(advance * 2)));
  }, [mode, grid]);

  const label = caption && /^https?:\/\//.test(caption)
    ? <a className="t-link" href={caption} target="_blank" rel="noreferrer">{caption}</a>
    : caption ? <span className="t-line dim">{caption}</span> : null;

  // The virtual filesystem is read-only, so `qrencode -o` cannot write anything.
  // A browser download is a different thing, and it is what a QR is usually for:
  // printing it, or dropping it into a slide.
  const QUIET = 4;
  const svgString = (s) => {
    const n = grid.length, dim = (n + QUIET * 2) * s;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!grid[r][c]) continue;
      d += "M" + ((c + QUIET) * s) + " " + ((r + QUIET) * s) +
           "h" + s + "v" + s + "h-" + s + "z";
    }
    const head = '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim +
      '" height="' + dim + '" viewBox="0 0 ' + dim + " " + dim +
      '" shape-rendering="crispEdges">';
    const body = '<rect width="' + dim + '" height="' + dim +
      '" fill="#ffffff"/><path d="' + d + '" fill="#000000"/></svg>';
    return head + body;
  };

  const save = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const saveSvg = () => save(
    new Blob([svgString(8)], { type: "image/svg+xml;charset=utf-8" }), "qr.svg");
  const savePng = () => {
    const s = 8, n = grid.length, dim = (n + QUIET * 2) * s;
    const cv = document.createElement("canvas");
    cv.width = dim; cv.height = dim;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = "#000000";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (grid[r][c]) ctx.fillRect((c + QUIET) * s, (r + QUIET) * s, s, s);
    }
    cv.toBlob((b) => b && save(b, "qr.png"), "image/png");
  };
  const saveRow = (
    <div className="qr-save">
      <button type="button" className="qr-save-btn" onClick={savePng}>qr.png</button>
      <button type="button" className="qr-save-btn" onClick={saveSvg}>qr.svg</button>
    </div>
  );

  if (mode === "svg") {
    const n = grid.length, quiet = 4, s = 6;
    const dim = (n + quiet * 2) * s;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!grid[r][c]) continue;
      d += "M" + ((c + quiet) * s) + " " + ((r + quiet) * s) + "h" + s + "v" + s + "h-" + s + "z";
    }
    return (
      <div className="qr-wrap">
        <svg className="qr-svg" width={dim} height={dim} viewBox={"0 0 " + dim + " " + dim}
             role="img" aria-label={caption || "QR code"} shapeRendering="crispEdges">
          <rect width={dim} height={dim} fill="#ffffff" />
          <path d={d} fill="#000000" />
        </svg>
        {label}
        {saveRow}
      </div>
    );
  }

  // Quiet zone of 4 modules, as the spec asks. Two was enough for some readers and
  // silently rejected by others.
  const rows = window.QR.toAscii(grid, 4);
  // Each cell is an inline-block with an explicit height. An inline span paints its
  // background over the font content box, not the line box, so at a line height
  // larger than the glyphs it leaves horizontal white seams through the code: the
  // finder patterns still resolve, and the data never decodes.
  // Width is pinned too, so the module is an exact square instead of "two glyphs
  // wide by however tall the line happens to be".
  const rowStyle = lineHeight ? { height: lineHeight + "px", lineHeight: lineHeight + "px" } : null;
  const cellStyle = lineHeight
    ? { width: lineHeight + "px", height: lineHeight + "px", lineHeight: lineHeight + "px" }
    : null;
  return (
    <div className="qr-wrap">
      <div className="qr-ascii" ref={boxRef} role="img" aria-label={caption || "QR code"}>
        {rows.map((line, i) => (
          <div key={i} className="qr-row" style={rowStyle}>
            {(() => {
              const parts = [];
              for (let j = 0; j < line.length; j += 2) {
                const pair = line.slice(j, j + 2);
                parts.push(
                  <span key={j} className={pair === "##" ? "t-c-qr1" : "t-c-qr0"} style={cellStyle}>{pair}</span>
                );
              }
              return parts;
            })()}
          </div>
        ))}
      </div>
      {label}
      {saveRow}
    </div>
  );
}
// Files whose contents come from the network: TIL entries and the commit log. They
// are fetched when the file is opened rather than baked in at build time, so the
// site is never a stale copy of another source.
const LIVE_SOURCES = {
  til: {
    url: () => window.SITE_DATA.site.tilUrl + "/blog/rss.xml",
    parse: (text) => {
      const posts = window.FS.parseFeed(text, 15);
      if (!posts.length) throw new Error("empty feed");
      const w = posts.reduce((m, p) => Math.max(m, p.title.length), 0);
      return [
        "# " + window.SITE_DATA.site.til + " -- " + posts.length + " most recent entries",
        "",
        ...posts.map(p => p.date + "  " + p.title.padEnd(w + 2) + p.link),
      ];
    },
  },
  playlist: {
    // A real .m3u: one #EXTINF line per track, then the URL. Long, because the
    // playlist is long. `mpv` renders the same list as a player instead.
    load: (signal) => ytPlaylistItems(signal).then((tracks) => [
      "#EXTM3U",
      "# " + tracks.length + " tracks. `mpv ~/.midnight/playlist.m3u` plays them here.",
      "",
      ...tracks.flatMap((t) => [
        "#EXTINF:-1," + t.title,
        "https://www.youtube.com/watch?v=" + t.id,
      ]),
    ]),
  },
  now: {
    // ~/now.log is the calendar, read as a log: what the last few days actually
    // went to, what the next few are already claimed by, and where the cursor sits
    // between them. Nothing here is typed by hand, so it cannot go stale.
    load: () => window.CALENDAR.load().then((data) => {
      const at = new Date();
      const all = (data.events || [])
        .map((e) => ({ ...e, _s: new Date(e.start), _e: new Date(e.end) }))
        .filter((e) => !isNaN(e._s))
        .sort((a, b) => a._s - b._s);
      const done = all.filter((e) => e._e < at).slice(-8);
      const live = all.filter((e) => e._s <= at && e._e >= at);
      const next = all.filter((e) => e._s > at).slice(0, 8);
      const rows = [...done, ...live, ...next];
      if (!rows.length) return ["# now.log", "", "(calendar is empty)"];

      const stamp = (d) =>
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0") + " " +
        String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      const tagW = rows.reduce((m, e) => Math.max(m, (e.tag || "other").length), 0);
      const state = (e) => (e._e < at ? "done" : e._s <= at ? "now" : "");

      // The span is spelled out rather than implied. A quiet stretch in the calendar
      // shows up as a gap between these two dates instead of old entries passing
      // themselves off as recent.
      const day = (d) => d.toISOString().slice(0, 10);
      return [
        "# now.log -- generated from the calendar, " +
          (data.live ? "read live" : "from the last snapshot"),
        "# " + day(rows[0]._s) + " .. " + day(rows[rows.length - 1]._s) +
          "  (" + done.length + " done, " + live.length + " running, " + next.length + " ahead)",
        "",
        ...rows.map((e) => {
          const st = state(e);
          return stamp(e._s) + "  " + (e.tag || "other").padEnd(tagW) + "  " +
                 (st === "now" ? "> " : "  ") + e.title +
                 (st === "done" ? "" : st === "now" ? "  (running)" : "");
        }),
      ];
    }),
  },
  repos: {
    url: () => "https://api.github.com/users/" + window.SITE_DATA.site.github +
               "/repos?per_page=100&sort=pushed",
    parse: (text) => {
      const rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error(rows.message || "unexpected response");
      const own = rows.filter(r => !r.fork);
      const w = own.reduce((m, r) => Math.max(m, r.name.length), 0);
      return [
        "# " + own.length + " public repositories",
        "",
        ...own.map(r =>
          (r.pushed_at || "").slice(0, 10) + "  " +
          r.name.padEnd(w + 2) +
          String(r.language || "-").padEnd(12) +
          (r.description || "")),
      ];
    },
  },
  commits: {
    url: () => "https://api.github.com/repos/" + window.SITE_DATA.site.github +
               "/" + window.SITE_DATA.site.domain + "/commits?per_page=15",
    parse: (text) => {
      const rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error(rows.message || "unexpected response");
      return [
        "# " + rows.length + " most recent commits",
        "",
        ...rows.map((c) => {
          const a = c.commit.author;
          return a.date.slice(0, 10) + "  " + c.sha.slice(0, 7) + "  " +
                 String(a.name).slice(0, 14).padEnd(14) + " " +
                 c.commit.message.split(String.fromCharCode(10))[0];
        }),
      ];
    },
  },
};

function LiveFileBlock({ source, path }) {
  const [state, setState] = React.useState({ loading: true });
  React.useEffect(() => {
    const spec = LIVE_SOURCES[source];
    if (!spec) { setState({ loading: false, error: "unknown source" }); return; }
    let cancelled = false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    // A source either paginates itself (load) or is one GET away (url + parse).
    const work = spec.load
      ? spec.load(ctl.signal)
      : fetch(spec.url(), { signal: ctl.signal, cache: "no-store" })
          .then((r) => r.ok ? r.text() : Promise.reject(new Error("HTTP " + r.status)))
          .then((t) => spec.parse(t));
    work
      .then((lines) => { if (!cancelled) setState({ loading: false, lines }); })
      .catch((e) => { if (!cancelled) setState({ loading: false, error: e.message || String(e) }); });
    return () => { cancelled = true; clearTimeout(timer); ctl.abort(); };
  }, [source]);

  if (state.loading) return <div className="t-line dim">reading...</div>;
  if (state.error) return <div className="t-line warn">cat: {path}: {state.error}</div>;
  return <>{state.lines.map((l, i) => <div key={i} className="t-line">{l || " "}</div>)}</>;
}
function NowBlock({ view, lang }) {
  const [state, setState] = React.useState({ loading: true });
  React.useEffect(() => {
    let cancelled = false;
    window.CALENDAR.load().then(data => { if (!cancelled) setState({ loading: false, data }); });
    return () => { cancelled = true; };
  }, []);

  if (state.loading) return <div className="t-line dim">{lang === "en" ? "loading calendar..." : "캘린더 불러오는 중..."}</div>;
  const data = state.data;
  const events = view === "month" ? window.CALENDAR.getMonth(data)
               : view === "week" ? window.CALENDAR.getWeek(data)
               : window.CALENDAR.getToday(data);
  const title = view === "month" ? (lang === "en" ? "this month" : "이번 달")
              : view === "week" ? (lang === "en" ? "this week" : "이번 주")
              : (lang === "en" ? "today" : "오늘");
  // "live" when the browser read the Calendar API directly, otherwise how old
  // the committed snapshot is.
  const synced = data.live
    ? (lang === "en" ? "live" : "실시간")
    : window.CALENDAR.relativeAgo(data.updated, lang);

  // Nothing scheduled and could not be read are different answers, and saying
  // the first when the second is true is the kind of quiet lie this site avoids.
  if (data.failed) {
    return <div className="t-line warn">
      {lang === "en" ? "calendar: could not be read." : "캘린더를 불러오지 못했습니다."}
    </div>;
  }

  if (!events.length) {
    return (
      <>
        <div className="t-line strong">{title}</div>
        <div className="t-line dim">{lang === "en" ? "nothing scheduled." : "일정이 없습니다."}</div>
        <div className="t-line dim">{lang === "en" ? `last sync: ${synced}` : `마지막 동기화: ${synced}`}</div>
      </>
    );
  }

  const rows = [];
  let lastDay = null;
  for (const e of events) {
    const day = window.CALENDAR.fmtDay(e._start, lang);
    if (view !== "today" && day !== lastDay) { rows.push({ day }); lastDay = day; }
    rows.push({ e });
  }
  return (
    <>
      <div className="t-line strong">{title}</div>
      {rows.map((r, i) => r.day
        ? <div key={i} className="t-line dim">{r.day}</div>
        : <div key={i} className="t-line">
            {`  ${window.CALENDAR.fmtTime(r.e._start)}-${window.CALENDAR.fmtTime(r.e._end)}  `}
            <span className={"t-tag t-tag-" + (r.e.tag || "other")}>{r.e.tag || "other"}</span>
            {`  ${r.e.title}${r.e.location ? "  @" + r.e.location : ""}`}
          </div>)}
      <div className="t-line dim">{lang === "en" ? `last sync: ${synced}` : `마지막 동기화: ${synced}`}</div>
    </>
  );
}

// cmatrix(1). It runs in the terminal it was started from, not over the whole
// screen, and it runs until you stop it, because that is what the program does.
//
// The canvas is sized from its own box rather than from the viewport: the terminal
// is a window now, and a window is not the screen.
function MatrixRain({ onDone, lang }) {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const CELL = 14;
    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]<>=+-*/$#@&%";
    const pick = () => CHARS[(Math.random() * CHARS.length) | 0];
    // Canvas needs a real family list, and --mono is where that list lives, so the
    // rain uses the same face as the terminal instead of its own copy of it.
    const face = (getComputedStyle(c).getPropertyValue("--mono") || "").trim()
                 || "ui-monospace, monospace";

    let cols = 0, drops = [], speed = [], box = { width: 0, height: 0 };

    const fit = () => {
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.floor(r.width * dpr);
      c.height = Math.floor(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      box = { width: r.width, height: r.height };
      cols = Math.max(1, Math.floor(r.width / CELL));
      drops.length = cols; speed.length = cols;
      for (let i = 0; i < cols; i++) {
        // Keep the columns that already existed; only seed the ones a widen added.
        if (drops[i] === undefined) drops[i] = Math.random() * (r.height / CELL);
        // A little variation per column, or every drop falls in lockstep.
        if (speed[i] === undefined) speed[i] = 0.45 + Math.random() * 0.75;
      }
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, r.width, r.height);
    };
    fit();
    // The parent, not the canvas: resizing the canvas would feed its own observer.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    if (ro && c.parentElement) ro.observe(c.parentElement);

    let raf = 0, last = 0;
    const draw = (t) => {
      raf = requestAnimationFrame(draw);
      // requestAnimationFrame is 60fps and the real thing is nowhere near that.
      if (t - last < 45) return;
      last = t;
      ctx.fillStyle = "rgba(0,0,0,0.09)";
      ctx.fillRect(0, 0, box.width, box.height);
      ctx.font = CELL + "px " + face;
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * CELL;
        // The head of each trail is nearly white, the rest green. That contrast is
        // most of what makes it read as rain rather than as noise.
        ctx.fillStyle = "#d8ffe0";
        ctx.fillText(pick(), i * CELL, y);
        ctx.fillStyle = "#2ecc40";
        ctx.fillText(pick(), i * CELL, y - CELL);
        if (y > box.height && Math.random() > 0.965) drops[i] = 0;
        drops[i] += speed[i];
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    };
  }, []);

  // Any key or click ends it, the way it ends. Capture, so the keystroke does not
  // also land in the prompt underneath.
  React.useEffect(() => {
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); onDone(); };
    window.addEventListener("keydown", stop, true);
    window.addEventListener("pointerdown", stop, true);
    return () => {
      window.removeEventListener("keydown", stop, true);
      window.removeEventListener("pointerdown", stop, true);
    };
  }, [onDone]);

  return (
    <div className="matrix" role="presentation">
      <canvas ref={canvasRef} className="matrix-canvas" />
      <div className="matrix-hint">
        {lang === "en" ? "any key to quit" : "아무 키나 누르면 종료"}
      </div>
    </div>
  );
}

export { TerminalView };
