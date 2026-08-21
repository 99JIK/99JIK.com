// A browser window for the desktop. It renders real pages in an iframe, which means
// it is a real browser for exactly as much of the web as allows being framed, and
// nothing more.
//
// Most of the web refuses. github.com sends X-Frame-Options: deny, youtube.com sends
// SAMEORIGIN, and a static site has no server to proxy through. Rather than pretend,
// this ships a bookmark bar of destinations that were checked and do load, rewrites
// the YouTube links that have a supported embed form, and says plainly what is
// happening when a page comes up blank.

import * as React from "preact/compat";

// Every one of these was checked with curl and sends neither X-Frame-Options nor a
// frame-ancestors directive. The list is short because that is how much of the web
// permits it, not because it was not worth looking. The site itself is not here: a
// browser whose home page is the page it is running in is a mirror, not a bookmark.
function bookmarks(lang) {
  const S = window.SITE_DATA.site;
  const wiki = lang === "en" ? "https://en.wikipedia.org/" : "https://ko.wikipedia.org/";
  return [
    { g: "mine", label: "TIL", url: S.tilUrl },
    { g: "mine", label: lang === "en" ? "Lab" : "연구실", url: "https://selab.knu.ac.kr" },
    { g: "mine", label: "KNU", url: "https://www.knu.ac.kr/" },
    { g: "ref", label: "man7", url: "https://man7.org/linux/man-pages/" },
    { g: "ref", label: lang === "en" ? "Wikipedia" : "위키백과", url: wiki },
    { g: "ref", label: "dblp", url: "https://dblp.org/" },
    { g: "ref", label: "CARLA", url: "https://carla.readthedocs.io/en/latest/" },
    { g: "ref", label: "godbolt", url: "https://godbolt.org/" },
  ].filter((b) => b.url);
}

// youtube.com itself cannot be framed, but /embed/ is YouTube's own supported way in,
// so a watch or playlist link is rewritten rather than refused.
function resolve(raw, lang) {
  let text = String(raw || "").trim();
  if (!text) return null;
  if (!/^[a-z]+:\/\//i.test(text)) {
    // Anything without a dot in it is a search, not a host. Google, Bing and
    // DuckDuckGo all refuse to be framed, so the search that actually works here
    // is Wikipedia's.
    if (!/^[^\s/]+\.[^\s/]/.test(text)) {
      const host = lang === "en" ? "en.wikipedia.org" : "ko.wikipedia.org";
      return { url: `https://${host}/w/index.php?search=${encodeURIComponent(text)}`, note: "search" };
    }
    text = "https://" + text;
  }
  let u;
  try { u = new URL(text); } catch { return null; }

  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const list = u.searchParams.get("list");
    const v = u.searchParams.get("v");
    if (u.pathname === "/watch" && v) {
      return { url: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(v) + "?rel=0" +
                    (list ? "&list=" + encodeURIComponent(list.replace(/^VL/, "")) : ""),
               note: "embed" };
    }
    if (u.pathname === "/playlist" && list) {
      return { url: "https://www.youtube-nocookie.com/embed/videoseries?list=" +
                    encodeURIComponent(list.replace(/^VL/, "")) + "&rel=0",
               note: "embed" };
    }
  }
  if (host === "youtu.be" && u.pathname.length > 1) {
    return { url: "https://www.youtube-nocookie.com/embed" + u.pathname + "?rel=0", note: "embed" };
  }
  return { url: u.href, note: null };
}

// Known refusers, verified by their response headers. Being able to say so before
// the page goes blank is the difference between a broken window and an honest one.
const REFUSED = {
  "github.com": "X-Frame-Options: deny",
  "gist.github.com": "X-Frame-Options: deny",
  "raw.githubusercontent.com": "X-Frame-Options: deny",
  "www.google.com": "X-Frame-Options: SAMEORIGIN",
  "google.com": "X-Frame-Options: SAMEORIGIN",
  "www.youtube.com": "X-Frame-Options: SAMEORIGIN",
  "youtube.com": "X-Frame-Options: SAMEORIGIN",
  "x.com": "X-Frame-Options: deny",
  "twitter.com": "X-Frame-Options: deny",
  "www.instagram.com": "X-Frame-Options: deny",
  "www.facebook.com": "X-Frame-Options: deny",
  "mail.google.com": "X-Frame-Options: SAMEORIGIN",
  "calendar.google.com": "X-Frame-Options: SAMEORIGIN",
  "www.linkedin.com": "X-Frame-Options: deny",
  "linkedin.com": "X-Frame-Options: deny",
  "arxiv.org": "X-Frame-Options: SAMEORIGIN",
  "www.semanticscholar.org": "X-Frame-Options: SAMEORIGIN",
  "scholar.google.com": "X-Frame-Options: SAMEORIGIN",
  "huggingface.co": "X-Frame-Options: DENY",
  "developer.mozilla.org": "X-Frame-Options: DENY",
  "stackoverflow.com": "X-Frame-Options: SAMEORIGIN",
  "news.ycombinator.com": "X-Frame-Options: DENY",
  "regex101.com": "X-Frame-Options: SAMEORIGIN",
  "www.openstreetmap.org": "X-Frame-Options: SAMEORIGIN",
  "duckduckgo.com": "X-Frame-Options: SAMEORIGIN",
  "lite.duckduckgo.com": "X-Frame-Options: SAMEORIGIN",
  "www.bing.com": "X-Frame-Options: SAMEORIGIN",
};

export function Browser({ lang, wm, initialUrl, onOpen }) {
  const marks = bookmarks(lang);
  const first = initialUrl || (marks[0] && marks[0].url) || "https://" + window.SITE_DATA.site.domain;

  const [history, setHistory] = React.useState(() => [resolve(first, lang)].filter(Boolean));
  const [at, setAt] = React.useState(0);
  const [typed, setTyped] = React.useState(first);
  const [reloads, setReloads] = React.useState(0);
  const [slow, setSlow] = React.useState(false);

  const here = history[at] || null;

  // A cross-origin frame that was refused looks exactly like one that is still
  // loading: no error, no readable document. So the only honest signal is time.
  React.useEffect(() => {
    setSlow(false);
    const id = setTimeout(() => setSlow(true), 3500);
    return () => clearTimeout(id);
  }, [here && here.url, reloads]);

  const go = (raw) => {
    const next = resolve(raw, lang);
    if (!next) return;
    // A PDF belongs in the PDF window, which knows the two ways to show one.
    if (onOpen && window.looksLikePdf(next.url)) { onOpen("cv", next.url); return; }
    setHistory((h) => [...h.slice(0, at + 1), next]);
    setAt((n) => n + 1);
    setTyped(next.url);
  };
  const jump = (d) => {
    const n = Math.max(0, Math.min(history.length - 1, at + d));
    setAt(n);
    setTyped(history[n] ? history[n].url : "");
  };

  const T = lang === "en" ? {
    title: "Browser", back: "back", fwd: "forward", reload: "reload",
    open: "open in a real tab", go: "go", url: "address",
    blankHead: "Nothing rendered?",
    blank: "Most sites send a header that forbids being put in a frame. There is no server here to proxy around it, so those pages stay blank.",
    refused: (h, w) => `${h} refuses to be framed (${w}). Open it in a real tab instead.`,
    embed: "rewritten to YouTube's embed player: youtube.com itself cannot be framed",
    search: "searched Wikipedia: every general search engine refuses to be framed",
    ph: "address, or words to look up",
  } : {
    title: "브라우저", back: "뒤로", fwd: "앞으로", reload: "새로고침",
    open: "새 탭에서 열기", go: "이동", url: "주소",
    blankHead: "아무것도 안 뜨나요?",
    blank: "대부분의 사이트는 프레임 안에 들어가는 걸 막는 헤더를 보냅니다. 여기엔 우회할 서버가 없어서 그런 페이지는 빈 화면으로 남습니다.",
    refused: (h, w) => `${h} 는 프레임 삽입을 거부합니다 (${w}). 새 탭에서 열어주세요.`,
    embed: "YouTube 임베드 플레이어로 바꿔서 엽니다. youtube.com 자체는 프레임에 못 들어갑니다.",
    search: "위키백과에서 검색했습니다. 일반 검색엔진은 전부 프레임 삽입을 거부합니다.",
    ph: "주소, 또는 찾을 낱말",
  };

  if (!here) return <div className="brw" />;
  const host = (() => {
    try { return new URL(here.url).hostname; } catch { return ""; }
  })();
  const refusedBy = REFUSED[host];

  return (
    <div className="brw">
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
        <div className="term-title-name">{host ? `${T.title} - ${host}` : T.title}</div>
        <div className="term-title-actions" />
      </div>

      <div className="brw-chrome" onPointerDown={(e) => e.stopPropagation()}>
        <div className="brw-nav">
          <button type="button" onClick={() => jump(-1)} disabled={at === 0} title={T.back} aria-label={T.back}>{"<"}</button>
          <button type="button" onClick={() => jump(1)} disabled={at >= history.length - 1} title={T.fwd} aria-label={T.fwd}>{">"}</button>
          <button type="button" onClick={() => setReloads((n) => n + 1)} title={T.reload} aria-label={T.reload}>{"↻"}</button>
        </div>
        <form className="brw-omni" onSubmit={(e) => { e.preventDefault(); go(typed); }}>
          <input value={typed} spellcheck={false} aria-label={T.url} placeholder={T.ph}
                 onInput={(e) => setTyped(e.currentTarget.value)} />
          <button type="submit">{T.go}</button>
        </form>
        <a className="brw-out" href={here ? here.url : "#"} target="_blank" rel="noreferrer"
           title={T.open} aria-label={T.open}>{"↗"}</a>
      </div>

      <div className="brw-marks">
        {marks.map((b, i) => (
          <span key={b.url}
                className={"brw-mark" + (i > 0 && marks[i - 1].g !== b.g ? " grouped" : "")}>
            <button type="button" onClick={() => go(b.url)}>{b.label}</button>
          </span>
        ))}
      </div>

      <div className="brw-view">
        {refusedBy ? (
          <div className="brw-stop">
            <div className="brw-stop-code">ERR_BLOCKED_BY_RESPONSE</div>
            <p>{T.refused(host, refusedBy)}</p>
            <a href={here.url} target="_blank" rel="noreferrer">{T.open} {"↗"}</a>
          </div>
        ) : (
          <iframe key={here.url + ":" + reloads} src={here.url} title={host}
                  referrerPolicy="no-referrer-when-downgrade"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen" />
        )}
      </div>

      <div className="brw-status">
        {here.note === "embed"
          ? <span className="brw-note">{T.embed}</span>
          : here.note === "search"
          ? <span className="brw-note">{T.search}</span>
          : slow && !refusedBy
          ? <span className="brw-note"><strong>{T.blankHead}</strong> {T.blank}</span>
          : <span className="brw-url">{here.url}</span>}
      </div>
    </div>
  );
}
