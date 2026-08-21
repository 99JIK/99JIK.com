// A file manager over the same virtual filesystem the terminal walks. Not a copy of
// it: it calls window.FS, so `ls`, `cd`, `du` and this window can never disagree.
//
// Opening a file does what `xdg-open` does, because it is the same decision: the CV
// goes to the PDF window, the playlist to the player, a symlink to a site to the
// browser, and anything else to a text pane here.
//
// The filesystem is mounted read-only, so the menu still offers the things a file
// manager offers and they fail the way they fail on a read-only mount. Hiding them
// would be tidier and would teach the visitor less.

import * as React from "preact/compat";
import { Markdown } from "./md.jsx";

const NL = String.fromCharCode(10);

function fmtSize(n) {
  if (n === 0 || n === undefined) return "-";
  if (n < 1024) return n + " B";
  return Math.round(n / 1024) + " K";
}

function fmtDate(d) {
  if (!d) return "";
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Same handler table as tools.js `xdg-open`. Kept in one shape so the two answers
// to "what opens this" cannot drift.
function handlerFor(path, node) {
  if (node.live === "playlist") return { app: "music" };
  if (/(^|\/)cv$/.test(path) || /\.pdf$/i.test(path)) return { app: "cv" };
  if (node.type === "link" && /^https?:\/\//.test(node.target || "")) {
    return { app: "browser", arg: node.target };
  }
  // A .desktop entry is a launcher, so opening it runs what it names.
  if (/\.desktop$/.test(path) && node.type === "file") {
    const exec = (node.content || []).find((l) => l.startsWith("Exec="));
    if (exec) return { app: exec.slice(5).trim(), launcher: true };
  }
  return null;
}

export function Files({ lang, wm, onOpen }) {
  const [cwd, setCwd] = React.useState("/home/jeongin");
  const [sel, setSel] = React.useState(null);
  const [showHidden, setShowHidden] = React.useState(false);
  const [view, setView] = React.useState(null);   // { path, lines, md } | { path, live } | { props }
  const [menu, setMenu] = React.useState(null);   // { x, y, name, node }
  const [status, setStatus] = React.useState(null);
  const rootRef = React.useRef(null);

  const T = lang === "en" ? {
    title: "Files", up: "up", hidden: "hidden files", empty: "empty",
    name: "name", size: "size", modified: "modified",
    live: "generated when read", close: "close",
    hiddenHint: "show hidden entries (ls -a)",
    items: (n) => `${n} item${n === 1 ? "" : "s"}`,
    open: "Open", openWith: "Open in the browser", openHere: "Open here",
    copyPath: "Copy the path", copyText: "Copy the contents", save: "Save a copy",
    inTerm: "Open in the terminal", props: "Properties",
    mkdir: "New folder", rename: "Rename", del: "Delete",
    copied: "copied to the clipboard", noClip: "the browser refused clipboard access",
    kind: "kind", target: "target", path: "path", lines: "lines",
    kDir: "directory", kFile: "file", kLink: "symbolic link", kLive: "generated on read",
    raw: "rendered / source",
  } : {
    title: "파일", up: "위로", hidden: "숨김 파일", empty: "비어 있음",
    name: "이름", size: "크기", modified: "수정",
    live: "열 때 생성됨", close: "닫기",
    hiddenHint: "숨김 항목 보기 (ls -a)",
    items: (n) => `${n}개 항목`,
    open: "열기", openWith: "브라우저에서 열기", openHere: "여기서 보기",
    copyPath: "경로 복사", copyText: "내용 복사", save: "사본 저장",
    inTerm: "터미널에서 열기", props: "속성",
    mkdir: "새 폴더", rename: "이름 바꾸기", del: "삭제",
    copied: "클립보드에 복사했습니다", noClip: "브라우저가 클립보드 접근을 거부했습니다",
    kind: "종류", target: "대상", path: "경로", lines: "줄 수",
    kDir: "디렉터리", kFile: "파일", kLink: "심볼릭 링크", kLive: "열 때 생성",
    raw: "렌더 / 원문",
  };

  const dir = React.useMemo(() => {
    const { node } = window.FS.resolve(cwd);
    if (!node || node.type !== "dir") return [];
    return Object.entries(node.children)
      .filter(([name, n]) => showHidden || !(n.hidden || name.startsWith(".")))
      .map(([name, n]) => ({ name, node: n }))
      .sort((a, b) => {
        const da = a.node.type === "dir", db = b.node.type === "dir";
        if (da !== db) return da ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [cwd, showHidden]);

  const join = (name) => (cwd === "/" ? "/" + name : cwd + "/" + name);
  const parts = cwd.split("/").filter(Boolean);

  // Status doubles as the error line, the way a file manager's does.
  const say = (msg, bad) => {
    setStatus({ msg, bad });
    setTimeout(() => setStatus(null), 4000);
  };

  const activate = (name, node) => {
    const path = join(name);
    if (node.type === "dir") { setCwd(path); setSel(null); setView(null); return; }
    const h = handlerFor(path, node);
    if (h && onOpen) { onOpen(h.app, h.arg); return; }
    if (node.type === "link") { window.open(node.target, "_blank", "noopener"); return; }
    // Everything else is text: its own window, the way opening a file works.
    if (onOpen) onOpen("viewer", path);
    else showText(path, node);
  };

  const showText = (path, node) => setView(node.live
    // Live files are fetched on read by the terminal, which is where that machinery
    // lives; this says so rather than showing the placeholder as if it were content.
    ? { path, live: true }
    // .md gets rendered rather than printed. `cat` still prints the bytes: that is
    // what cat is for, and this window is the one that is allowed to format.
    : { path, lines: node.content || [], md: /\.md$/i.test(path) });

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      say(T.copied);
    } catch { say(T.noClip, true); }
  };

  const saveCopy = (name, node) => {
    const body = (node.content || []).join(NL) + NL;
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // The one bridge back the other way: the terminal is told to cd, and the desktop
  // is told to bring it forward.
  // Reuse a shell if one is open rather than starting another every time; the queue
  // holds the `cd` until whichever shell ends up focused takes it.
  const inTerminal = (path) => {
    window.SHELL.run("cd " + path);
    if (onOpen) onOpen("terminal", undefined, { reuse: true });
  };

  const properties = (name, node) => {
    const path = name ? join(name) : cwd;
    setView({
      path,
      props: [
        [T.path, path],
        [T.kind, node.type === "dir" ? T.kDir : node.type === "link" ? T.kLink : node.live ? T.kLive : T.kFile],
        ...(node.type === "link" ? [[T.target, node.target]] : []),
        ...(node.type === "dir"
          ? [[T.items(Object.keys(node.children).length), ""]]
          : [[T.size, node.live ? "0 B" : fmtSize(node.size)],
             [T.lines, node.live ? "-" : String((node.content || []).length)]]),
        [T.modified, fmtDate(node.mtime)],
      ],
    });
  };

  // Every write is refused with the message the real call would produce. EROFS is
  // not an excuse here, it is what this filesystem is.
  const readOnly = (op, target) => say(`${op}: ${target}: Read-only file system`, true);

  const openMenu = (e, name, node) => {
    e.preventDefault();
    e.stopPropagation();
    const box = rootRef.current && rootRef.current.getBoundingClientRect();
    if (!box) return;
    if (name) setSel(name);
    // The window clips its own overflow, so a menu opened near an edge has to be
    // pulled back inside it rather than being cut in half.
    const W = 180, H = name ? 240 : 150;
    setMenu({
      x: Math.max(0, Math.min(box.width - W, e.clientX - box.left)),
      y: Math.max(0, Math.min(box.height - H, e.clientY - box.top)),
      name, node,
    });
  };

  React.useEffect(() => {
    if (!menu) return;
    const away = () => setMenu(null);
    const esc = (ev) => { if (ev.key === "Escape") setMenu(null); };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const menuItems = () => {
    if (!menu) return [];
    const { name, node } = menu;
    if (!name) {
      // Empty space: the menu is about the folder you are standing in.
      const { node: here } = window.FS.resolve(cwd);
      return [
        [T.inTerm, () => inTerminal(cwd)],
        [T.copyPath, () => copy(cwd)],
        [T.props, () => properties(null, here)],
        null,
        [T.mkdir, () => readOnly("mkdir", cwd + "/untitled"), true],
      ];
    }
    const path = join(name);
    const h = handlerFor(path, node);
    return [
      [T.open, () => activate(name, node)],
      ...(node.type !== "dir" && node.type !== "link" && !node.live
        ? [[T.openHere, () => showText(path, node)]] : []),
      ...(node.type === "link" && /^https?:\/\//.test(node.target || "")
        ? [[T.openWith, () => onOpen && onOpen("browser", node.target)]] : []),
      ...(node.type === "dir" ? [[T.inTerm, () => inTerminal(path)]] : []),
      null,
      [T.copyPath, () => copy(path)],
      ...(node.type === "file" && !node.live
        ? [[T.copyText, () => copy((node.content || []).join(NL))],
           [T.save, () => saveCopy(name, node)]] : []),
      [T.props, () => properties(name, node)],
      null,
      [T.rename, () => readOnly("mv", path), true],
      [T.del, () => readOnly("rm", path), true],
    ];
  };

  return (
    <div className="fm" ref={rootRef}>
      <div className="brw-title"
           onPointerDown={wm && wm.state === "windowed" ? wm.onDragStart : undefined}
           onDblClick={wm ? wm.onToggleMax : undefined}>
        <div className="term-dots">
          {wm ? (
            <>
              <button type="button" className="term-dot r" aria-label="close"
                      onPointerDown={(e) => e.stopPropagation()} onClick={wm.onClose} />
              <button type="button" className="term-dot y" aria-label="minimise"
                      onPointerDown={(e) => e.stopPropagation()} onClick={wm.onMinimise} />
              <button type="button" className="term-dot g" aria-label="maximise"
                      onPointerDown={(e) => e.stopPropagation()} onClick={wm.onToggleMax} />
            </>
          ) : (
            <><span className="term-dot r" /><span className="term-dot y" /><span className="term-dot g" /></>
          )}
        </div>
        <div className="term-title-name">{`${T.title} - ${cwd}`}</div>
        <div className="term-title-actions" />
      </div>

      <div className="fm-bar" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="fm-btn" title={T.up} aria-label={T.up}
                disabled={cwd === "/"}
                onClick={() => { setCwd("/" + parts.slice(0, -1).join("/")); setView(null); }}>↑</button>
        <nav className="fm-crumbs" aria-label={T.name}>
          <button type="button" onClick={() => { setCwd("/"); setView(null); }}>/</button>
          {parts.map((p, i) => (
            <button key={i} type="button"
                    onClick={() => { setCwd("/" + parts.slice(0, i + 1).join("/")); setView(null); }}>
              {p}
            </button>
          ))}
        </nav>
        <button type="button" className={"fm-btn fm-dot" + (showHidden ? " on" : "")}
                aria-pressed={showHidden} title={T.hiddenHint} aria-label={T.hidden}
                onClick={() => setShowHidden((v) => !v)}>-a</button>
      </div>

      <div className="fm-body" onPointerDown={(e) => e.stopPropagation()}>
        <div className="fm-list" role="listbox" aria-label={T.title}
             onContextMenu={(e) => openMenu(e, null, null)}>
          <div className="fm-head">
            <span>{T.name}</span><span>{T.size}</span><span>{T.modified}</span>
          </div>
          {dir.length === 0 && <div className="fm-none">{T.empty}</div>}
          {dir.map(({ name, node }) => (
            <div key={name} role="option" aria-selected={sel === name}
                 className={"fm-row" + (sel === name ? " on" : "") + " k-" + node.type}
                 tabIndex={0}
                 onClick={() => setSel(name)}
                 onDblClick={() => activate(name, node)}
                 onContextMenu={(e) => openMenu(e, name, node)}
                 onKeyDown={(e) => {
                   if (e.key === "Enter") { e.preventDefault(); activate(name, node); }
                   if (e.key === "ContextMenu") { openMenu(e, name, node); }
                 }}>
              <span className="fm-name">
                <span className="fm-glyph" aria-hidden="true">
                  {node.type === "dir" ? "▸" : node.type === "link" ? "→" : node.live ? "◴" : "·"}
                </span>
                {name}{node.type === "dir" ? "/" : ""}
              </span>
              <span className="fm-size">{node.type === "dir" ? "-" : fmtSize(node.size)}</span>
              <span className="fm-date">{fmtDate(node.mtime)}</span>
            </div>
          ))}
        </div>

        {view && (
          <div className="fm-view">
            <div className="fm-view-head">
              <span>{view.path}</span>
              {view.lines && /\.md$/i.test(view.path) && (
                <button type="button" className={view.md ? "on" : ""}
                        title={T.raw} aria-pressed={!!view.md}
                        onClick={() => setView((v) => ({ ...v, md: !v.md }))}>md</button>
              )}
              <button type="button" onClick={() => setView(null)} aria-label={T.close}>×</button>
            </div>
            {view.props ? (
              <dl className="fm-props">
                {view.props.map(([k, v]) => (
                  <div key={k + v}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            ) : view.live ? (
              <pre className="fm-view-body">{T.live}</pre>
            ) : view.md ? (
              <div className="fm-view-body">
                <Markdown lines={view.lines} />
              </div>
            ) : (
              <pre className="fm-view-body">{(view.lines || []).join(NL)}</pre>
            )}
          </div>
        )}
      </div>

      {menu && (
        <div className="desk-menu fm-menu"
             style={{ left: menu.x + "px", top: menu.y + "px" }}
             role="menu" onPointerDown={(e) => e.stopPropagation()}>
          {menuItems().map((item, i) => (item === null
            ? <div key={"s" + i} className="desk-menu-sep" />
            : (
              <button key={item[0]} type="button" role="menuitem"
                      className={item[2] ? "ro" : ""}
                      onClick={() => { setMenu(null); item[1](); }}>
                {item[0]}
              </button>
            )))}
        </div>
      )}

      <div className={"fm-status" + (status && status.bad ? " bad" : "")}>
        {status ? status.msg : T.items(dir.length)}
      </div>
    </div>
  );
}
