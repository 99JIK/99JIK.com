// A PDF window for the CV.
//
// The obvious version does not work: raw.githubusercontent.com sends
// X-Frame-Options: deny, so the file cannot go straight into an iframe. It does send
// Access-Control-Allow-Origin: *, though, which means the bytes can be fetched. The
// fetched blob gets an object URL, and a blob: URL is same-origin, so the framing
// header no longer applies and the browser's own PDF viewer renders it.
//
// That keeps the CV where it belongs, in the cv repo, with nothing copied into this
// one and nothing to go stale.

import * as React from "preact/compat";

export function PdfViewer({ lang, wm }) {
  const S = window.SITE_DATA.site;
  // An English reader gets the English CV first, and either can switch.
  const [which, setWhich] = React.useState(lang === "en" ? "en" : "ko");
  const [state, setState] = React.useState({ loading: true });

  const src = which === "en" ? S.cvEn : S.cvKo;
  // github.com/<user>/<repo>/blob/<ref>/<path> is the page; the bytes are on raw.
  const raw = src
    .replace("https://github.com/", "https://raw.githubusercontent.com/")
    .replace("/blob/", "/");

  React.useEffect(() => {
    let dead = false;
    let url = null;
    const ctl = new AbortController();
    setState({ loading: true });
    fetch(raw, { signal: ctl.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("HTTP " + r.status))))
      .then((b) => {
        if (dead) return;
        url = URL.createObjectURL(b.type === "application/pdf" ? b : new Blob([b], { type: "application/pdf" }));
        setState({ loading: false, url, bytes: b.size });
      })
      .catch((e) => { if (!dead) setState({ loading: false, error: e.message || String(e) }); });
    return () => {
      dead = true; ctl.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [raw]);

  const T = lang === "en" ? {
    title: "CV", ko: "Korean", en: "English",
    loading: "fetching...", open: "open the original", save: "save",
    failed: "could not fetch the file",
  } : {
    title: "이력서", ko: "한국어", en: "English",
    loading: "가져오는 중...", open: "원본 열기", save: "저장",
    failed: "파일을 가져오지 못했습니다",
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
        <div className="term-title-name">{`${T.title} - cv-${which}.pdf`}</div>
        <div className="term-title-actions" />
      </div>

      <div className="pdfv-bar" onPointerDown={(e) => e.stopPropagation()}>
        <div className="lang-seg" role="group" aria-label={T.title}>
          <button className={"lang-btn" + (which === "ko" ? " on" : "")}
                  onClick={() => setWhich("ko")}>{T.ko}</button>
          <button className={"lang-btn" + (which === "en" ? " on" : "")}
                  onClick={() => setWhich("en")}>{T.en}</button>
        </div>
        <span className="pdfv-size">{size}</span>
        {/* The blob is already in memory, so saving costs nothing extra. */}
        {state.url && (
          <a className="pdfv-act" href={state.url} download={`cv-${which}.pdf`}>{T.save}</a>
        )}
        <a className="pdfv-act" href={src} target="_blank" rel="noreferrer">{T.open} ↗</a>
      </div>

      <div className="pdfv-view">
        {state.loading ? (
          <div className="pdfv-msg">{T.loading}</div>
        ) : state.error ? (
          <div className="pdfv-msg warn">
            <div>{T.failed}: {state.error}</div>
            <a href={src} target="_blank" rel="noreferrer">{T.open} ↗</a>
          </div>
        ) : (
          <iframe src={state.url} title={`cv-${which}.pdf`} />
        )}
      </div>
    </div>
  );
}
