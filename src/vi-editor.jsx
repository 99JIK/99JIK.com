// A modal editor over the virtual filesystem. The buffer is genuinely editable:
// motions, insert mode, dd/p, undo all work on real text. Only the write fails, and
// it fails the way vim fails on a read-only mount, so `:w` teaches you E45 and `:q`
// with unsaved changes teaches you E37.
//
// Deliberately a subset. Implemented: h j k l 0 ^ $ w b e gg G, i I a A o O, x D dd,
// u, p, ZZ, and the : commands w q wq q! w! x. Everything else answers like vim does
// when it does not know a command.

import * as React from "preact/compat";

const ROWS = 22;   // visible buffer rows; the status line sits under them

export function ViEditor({ path, initial, onExit, lang }) {
  const [lines, setLines] = React.useState(() => (initial.length ? initial.slice() : [""]));
  const [cy, setCy] = React.useState(0);
  const [cx, setCx] = React.useState(0);
  const [mode, setMode] = React.useState("normal");
  const [cmd, setCmd] = React.useState("");
  const [msg, setMsg] = React.useState(
    `"${path}" [readonly] ${initial.length}L, ${initial.reduce((a, l) => a + l.length + 1, 0)}C`);
  const [dirty, setDirty] = React.useState(false);
  const [top, setTop] = React.useState(0);       // first visible row
  const pending = React.useRef("");              // multi-key sequences: dd, gg
  const undoRef = React.useRef([]);
  const registerRef = React.useRef(null);        // last dd, for p
  const boxRef = React.useRef(null);

  React.useEffect(() => { if (boxRef.current) boxRef.current.focus(); }, []);

  // Keep the cursor inside the window, the way vim scrolls rather than clipping.
  React.useEffect(() => {
    if (cy < top) setTop(cy);
    else if (cy >= top + ROWS) setTop(cy - ROWS + 1);
  }, [cy, top]);

  const snapshot = () => { undoRef.current.push({ lines: lines.slice(), cy, cx }); };
  const clampX = (line, x, insert) => Math.max(0, Math.min(x, Math.max(0, line.length - (insert ? 0 : 1))));

  const edit = (next, ny, nx) => {
    setLines(next);
    setDirty(true);
    if (ny !== undefined) setCy(Math.max(0, Math.min(ny, next.length - 1)));
    if (nx !== undefined) setCx(Math.max(0, nx));
  };

  function runCommand(raw) {
    const c = raw.trim();
    const bang = c.endsWith("!");
    const name = (bang ? c.slice(0, -1) : c).trim();

    if (name === "q") {
      if (dirty && !bang) return setMsg("E37: No write since last change (add ! to override)");
      return onExit(dirty && bang ? "changes discarded" : null);
    }
    if (name === "w" || name === "wq" || name === "x") {
      // The mount is read-only, so vim's own two-step refusal is the accurate one.
      if (!bang) return setMsg("E45: 'readonly' option is set (add ! to override)");
      return setMsg(`"${path}" E212: Can't open file for writing`);
    }
    if (name === "") return setMsg("");
    if (/^\d+$/.test(name)) { setCy(Math.min(lines.length - 1, Math.max(0, +name - 1))); setCx(0); return setMsg(""); }
    if (name === "help" || name === "h") {
      return setMsg(lang === "en"
        ? "no help here. `:q!` leaves without saving."
        : "도움말 없음. `:q!` 로 저장 없이 나갑니다.");
    }
    setMsg(`E492: Not an editor command: ${c}`);
  }

  const onKey = (e) => {
    // The editor owns the keyboard while it is open, except for browser-reserved
    // combos, which stay with the browser.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const line = lines[cy] || "";

    if (mode === "command") {
      e.preventDefault();
      if (k === "Escape") { setMode("normal"); setCmd(""); setMsg(""); return; }
      if (k === "Enter") { const c = cmd; setMode("normal"); setCmd(""); runCommand(c); return; }
      if (k === "Backspace") {
        if (!cmd) { setMode("normal"); setCmd(""); return; }
        setCmd(cmd.slice(0, -1)); return;
      }
      if (k.length === 1) setCmd(cmd + k);
      return;
    }

    if (mode === "insert") {
      e.preventDefault();
      if (k === "Escape") { setMode("normal"); setCx(Math.max(0, cx - 1)); setMsg(""); return; }
      if (k === "Enter") {
        snapshot();
        const next = lines.slice();
        next.splice(cy, 1, line.slice(0, cx), line.slice(cx));
        edit(next, cy + 1, 0);
        return;
      }
      if (k === "Backspace") {
        snapshot();
        const next = lines.slice();
        if (cx > 0) { next[cy] = line.slice(0, cx - 1) + line.slice(cx); edit(next, cy, cx - 1); }
        else if (cy > 0) {
          const prev = next[cy - 1];
          next.splice(cy - 1, 2, prev + line);
          edit(next, cy - 1, prev.length);
        }
        return;
      }
      if (k.length === 1) {
        snapshot();
        const next = lines.slice();
        next[cy] = line.slice(0, cx) + k + line.slice(cx);
        edit(next, cy, cx + 1);
      }
      return;
    }

    // ── normal mode ──
    e.preventDefault();
    const seq = pending.current + k;
    pending.current = "";
    setMsg("");

    const go = (y, x) => { setCy(y); setCx(clampX(lines[y] || "", x)); };

    switch (seq) {
      case "h": case "ArrowLeft":  return setCx(Math.max(0, cx - 1));
      case "l": case "ArrowRight": return setCx(clampX(line, cx + 1));
      case "j": case "ArrowDown":  return cy < lines.length - 1 && go(cy + 1, cx);
      case "k": case "ArrowUp":    return cy > 0 && go(cy - 1, cx);
      case "0": return setCx(0);
      case "$": return setCx(clampX(line, line.length));
      case "^": return setCx(Math.max(0, line.search(/\S/)));
      case "G": return go(lines.length - 1, 0);
      case "w": {
        const m = line.slice(cx).match(/^\S*\s+/);
        return m ? setCx(cx + m[0].length) : (cy < lines.length - 1 && go(cy + 1, 0));
      }
      case "b": {
        const head = line.slice(0, cx).replace(/\S+\s*$/, "");
        return cx > 0 ? setCx(head.length) : (cy > 0 && go(cy - 1, 0));
      }
      case "e": {
        const m = line.slice(cx + 1).match(/^\s*\S+/);
        return m && setCx(cx + m[0].length);
      }
      case "x": {
        if (!line.length) return;
        snapshot();
        const next = lines.slice();
        next[cy] = line.slice(0, cx) + line.slice(cx + 1);
        return edit(next, cy, clampX(next[cy], cx));
      }
      case "D": {
        snapshot();
        const next = lines.slice();
        next[cy] = line.slice(0, cx);
        return edit(next, cy, clampX(next[cy], cx));
      }
      case "dd": {
        snapshot();
        registerRef.current = line;
        const next = lines.slice();
        next.splice(cy, 1);
        if (!next.length) next.push("");
        return edit(next, Math.min(cy, next.length - 1), 0);
      }
      case "p": {
        if (registerRef.current === null) return;
        snapshot();
        const next = lines.slice();
        next.splice(cy + 1, 0, registerRef.current);
        return edit(next, cy + 1, 0);
      }
      case "gg": return go(0, 0);
      case "u": {
        const prev = undoRef.current.pop();
        if (!prev) return setMsg("Already at oldest change");
        setLines(prev.lines); setCy(prev.cy); setCx(prev.cx);
        return setMsg("1 change; before");
      }
      case "i": return setMode("insert");
      case "I": { setCx(Math.max(0, line.search(/\S/))); return setMode("insert"); }
      case "a": { setCx(Math.min(line.length, cx + 1)); return setMode("insert"); }
      case "A": { setCx(line.length); return setMode("insert"); }
      case "o": {
        snapshot();
        const next = lines.slice();
        next.splice(cy + 1, 0, "");
        edit(next, cy + 1, 0);
        return setMode("insert");
      }
      case "O": {
        snapshot();
        const next = lines.slice();
        next.splice(cy, 0, "");
        edit(next, cy, 0);
        return setMode("insert");
      }
      case "ZZ": return runCommand("wq");
      case ":": { setMode("command"); setCmd(""); return; }
      default:
        if (seq === "d" || seq === "g" || seq === "Z") { pending.current = seq; return; }
        if (k === "Escape") return;
        return;
    }
  };

  const visible = lines.slice(top, top + ROWS);
  const filler = Math.max(0, ROWS - visible.length);
  const pct = lines.length <= ROWS ? "All"
            : top === 0 ? "Top"
            : top + ROWS >= lines.length ? "Bot"
            : Math.round((top / (lines.length - ROWS)) * 100) + "%";

  return (
    <div className="vi" ref={boxRef} tabIndex={-1} onKeyDown={onKey}
         role="application" aria-label={`vi ${path}`}>
      <div className="vi-buf">
        {visible.map((l, i) => {
          const row = top + i;
          if (row !== cy) return <div key={i} className="t-line">{l || " "}</div>;
          const ch = l[cx] || " ";
          return (
            <div key={i} className="t-line">
              {l.slice(0, cx)}
              <span className={"vi-cursor" + (mode === "insert" ? " ins" : "")}>{ch}</span>
              {l.slice(cx + 1)}
            </div>
          );
        })}
        {Array.from({ length: filler }, (_, i) => (
          <div key={"~" + i} className="t-line vi-tilde">~</div>
        ))}
      </div>
      <div className="vi-status">
        <span className="vi-file">&quot;{path}&quot; [readonly]{dirty ? " [+]" : ""}</span>
        <span className="vi-pos">{cy + 1},{cx + 1}{"        "}{pct}</span>
      </div>
      <div className="vi-cmdline">
        {mode === "command" ? `:${cmd}` : mode === "insert" ? "-- INSERT --" : (msg || " ")}
      </div>
    </div>
  );
}
