// A file viewer window, for the files nothing else claims: notes, text, .md.
//
// The file manager already knows how to show these in its preview pane. This is the
// same thing standing on its own, so a file can be opened without opening a browser
// for it, which is what `xdg-open ~/about` should have done all along.

import * as React from "preact/compat";
import { Markdown } from "./md.jsx";

const NL = String.fromCharCode(10);

export function Viewer({ lang, wm, path }) {
  const target = path || "/home/jeongin/Desktop/README.md";
  const { node } = window.FS.resolve(target);
  const isMd = /\.md$/i.test(target);
  const [rendered, setRendered] = React.useState(isMd);

  const T = lang === "en"
    ? { title: "Viewer", missing: "no such file", raw: "rendered / source",
        live: "generated when read", save: "save", dir: "that is a directory" }
    : { title: "뷰어", missing: "파일이 없습니다", raw: "렌더 / 원문",
        live: "열 때 생성됨", save: "저장", dir: "디렉터리입니다" };

  const name = target.split("/").pop() || target;
  const lines = node && node.content ? node.content : [];

  const save = () => {
    const url = URL.createObjectURL(new Blob([lines.join(NL) + NL], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="vw">
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
        <div className="term-title-name">{`${T.title} - ${name}`}</div>
        <div className="term-title-actions" />
      </div>

      <div className="vw-bar" onPointerDown={(e) => e.stopPropagation()}>
        <span className="vw-path">{target}</span>
        {isMd && node && (
          <button type="button" className={rendered ? "on" : ""} title={T.raw}
                  aria-pressed={rendered} onClick={() => setRendered((v) => !v)}>md</button>
        )}
        {node && node.type === "file" && !node.live && (
          <button type="button" onClick={save}>{T.save}</button>
        )}
      </div>

      <div className="vw-body" onPointerDown={(e) => e.stopPropagation()}>
        {!node ? <div className="vw-msg warn">{T.missing}: {target}</div>
          : node.type === "dir" ? <div className="vw-msg">{T.dir}</div>
          : node.live ? <div className="vw-msg">{T.live}</div>
          : rendered ? <Markdown lines={lines} />
          : <pre className="vw-pre">{lines.join(NL)}</pre>}
      </div>
    </div>
  );
}
