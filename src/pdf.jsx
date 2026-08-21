// A PDF window. It opens the CV, and it opens any other PDF that will let it.
//
// There are two ways to put a PDF on screen and each one is blocked by a different
// header, so this tries both:
//
//   1. Fetch the bytes and hand them to a blob: URL. A blob is same-origin, so
//      X-Frame-Options stops mattering. This needs the host to allow cross-origin
//      reads. raw.githubusercontent.com and arxiv.org both send
//      Access-Control-Allow-Origin: *; most hosts send nothing.
//   2. Point an iframe straight at the URL. No CORS involved, but the host has to
//      permit framing.
//
// A host that refuses both cannot be shown at all, and the window says so and offers
// the link rather than sitting on an empty grey rectangle.

import * as React from "preact/compat";

// github.com/<user>/<repo>/blob/<ref>/<path> is the page; the bytes are on raw.
const toRaw = (u) => u
  .replace("https://github.com/", "https://raw.githubusercontent.com/")
  .replace("/blob/", "/");

export function PdfViewer({ lang, wm, path }) {
  const S = window.SITE_DATA.site;
  const [which, setWhich] = React.useState(lang === "en" ? "en" : "ko");
  const [state, setState] = React.useState({ loading: true });

  // `path` is either somewhere in this filesystem or a URL from somewhere else.
  const target = React.useMemo(() => {
    if (path && /^https?:\/\//.test(path)) {
      return { src: path, name: decodeURIComponent(path.split("/").pop() || "document.pdf") };
    }
    if (path) {
      const { node } = window.FS.resolve(path);
      const name = path.split("/").pop();
      if (!node) return { missing: path, name };
      // A PDF file names its sources. One of them, or two when it exists in both
      // languages, which is the CV and nothing else so far.
      const pdf = node.pdf;
      if (!pdf) return { unreadable: path, name };
      const both = !!(pdf.ko && pdf.en);
      return { src: both ? (which === "en" ? pdf.en : pdf.ko) : (pdf.ko || pdf.en || pdf.url),
               name, both };
    }
    // Opened with nothing: the CV, since that is what the launcher used to be.
    return { src: which === "en" ? S.cvEn : S.cvKo, name: `cv-${which}.pdf`, both: true };
  }, [path, which, S.cvKo, S.cvEn]);

  const src = target.src;

  React.useEffect(() => {
    if (!src) { setState({ loading: false }); return; }
    let dead = false;
    let url = null;
    const ctl = new AbortController();
    setState({ loading: true });
    fetch(toRaw(src), { signal: ctl.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("HTTP " + r.status))))
      .then((b) => {
        if (dead) return;
        url = URL.createObjectURL(b.type === "application/pdf" ? b : new Blob([b], { type: "application/pdf" }));
        setState({ loading: false, url, bytes: b.size });
      })
      .catch((e) => {
        // Almost always CORS. The host may still permit framing, so the iframe gets
        // pointed at the URL directly and the note says the picture may stay empty.
        if (!dead) setState({ loading: false, direct: src, why: e.message || String(e) });
      });
    return () => {
      dead = true; ctl.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  const T = lang === "en" ? {
    title: "PDF", ko: "Korean", en: "English",
    loading: "fetching...", open: "open in a new tab", save: "save",
    missing: "no such file", unreadable: "this file names no PDF to fetch",
    direct: "the host would not hand over the bytes, so this is framed directly and may stay blank",
  } : {
    title: "PDF", ko: "한국어", en: "English",
    loading: "가져오는 중...", open: "새 탭에서 열기", save: "저장",
    missing: "파일이 없습니다", unreadable: "이 파일에는 가져올 PDF 주소가 없습니다",
    direct: "서버가 바이트를 내주지 않아 주소를 그대로 프레임에 넣었습니다. 비어 있을 수 있습니다",
  };

  const size = state.bytes ? Math.round(state.bytes / 1024) + " KB" : "";

  return (
    <div className="pdfv">
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
        <div className="term-title-name">{`${T.title} - ${target.name}`}</div>
        <div className="term-title-actions" />
      </div>

      <div className="pdfv-bar" onPointerDown={(e) => e.stopPropagation()}>
        {/* Only when the file actually has both, which is the CV. */}
        {target.both && (
          <div className="lang-seg" role="group" aria-label={T.title}>
            <button className={"lang-btn" + (which === "ko" ? " on" : "")}
                    onClick={() => setWhich("ko")}>{T.ko}</button>
            <button className={"lang-btn" + (which === "en" ? " on" : "")}
                    onClick={() => setWhich("en")}>{T.en}</button>
          </div>
        )}
        <span className="pdfv-size">{size}</span>
        {/* The blob is already in memory, so saving costs nothing extra. */}
        {state.url && <a className="pdfv-act" href={state.url} download={target.name}>{T.save}</a>}
        {src && <a className="pdfv-act" href={src} target="_blank" rel="noreferrer">{T.open} ↗</a>}
      </div>

      <div className="pdfv-view">
        {target.missing ? (
          <div className="pdfv-msg warn">{T.missing}: {target.missing}</div>
        ) : target.unreadable ? (
          <div className="pdfv-msg warn">{T.unreadable}: {target.unreadable}</div>
        ) : state.loading ? (
          <div className="pdfv-msg">{T.loading}</div>
        ) : state.url ? (
          <iframe src={state.url} title={target.name} />
        ) : (
          <iframe src={state.direct} title={target.name} />
        )}
      </div>

      {state.direct && (
        <div className="pdfv-note">{T.direct} ({state.why})</div>
      )}
    </div>
  );
}
