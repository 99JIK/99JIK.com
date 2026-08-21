// Settings. The things that were previously only reachable by typing a command or by
// finding the hidden Tweaks panel, plus the keyboard map, which otherwise nobody
// would ever discover.

import * as React from "preact/compat";

export function Settings({ lang, wm, theme, onTheme, onLang, onReset, apps }) {
  const T = lang === "en" ? {
    title: "Settings", look: "Appearance", theme: "Theme", language: "Language",
    keys: "Keyboard", motion: "Motion",
    motionOn: "Animations follow your system setting.",
    motionOff: "Your system asks for reduced motion, so window animations are off.",
    layout: "Layout", reset: "Reset the layout",
    resetNote: "Window positions live in this browser only. Nothing is sent anywhere.",
    confirm: "Reset and reload?",
    launch: "Launch or focus", wm: "Windows", spaces: "Workspaces",
  } : {
    title: "설정", look: "모양", theme: "테마", language: "언어",
    keys: "키보드", motion: "모션",
    motionOn: "시스템 설정을 따릅니다.",
    motionOff: "시스템이 모션 줄이기를 요청해서 창 애니메이션이 꺼져 있습니다.",
    layout: "배치", reset: "배치 초기화",
    resetNote: "창 위치는 이 브라우저에만 저장됩니다. 어디에도 전송되지 않습니다.",
    confirm: "초기화하고 새로고침할까요?",
    launch: "실행 / 포커스", wm: "창", spaces: "작업공간",
  };

  const reduced = (() => {
    try { return window.prefersReducedMotion(); } catch { return false; }
  })();
  const themes = window.THEMES || {};

  const KEYS = [
    [T.launch, Object.keys(apps || {}).map((a) => ({
      k: "Ctrl+Alt+" + apps[a].key, v: lang === "en" ? apps[a].en : apps[a].ko,
    }))],
    [T.wm, [
      { k: "Ctrl+Alt+Tab", v: lang === "en" ? "cycle windows" : "창 순환" },
      { k: "Ctrl+Alt+↑", v: lang === "en" ? "maximise" : "최대화" },
      { k: "Ctrl+Alt+↓", v: lang === "en" ? "restore, then minimise" : "복원, 다시 누르면 최소화" },
      { k: "Ctrl+Alt+Shift+←/→", v: lang === "en" ? "snap to half" : "반쪽으로 스냅" },
      { k: "Ctrl+Alt+Q", v: lang === "en" ? "close the focused window" : "포커스된 창 닫기" },
      { k: "Ctrl+Alt+D", v: lang === "en" ? "show the desktop" : "바탕화면 보기" },
      { k: "Ctrl+Alt+L", v: lang === "en" ? "lock" : "잠그기" },
    ]],
    [T.spaces, [
      { k: "Ctrl+Alt+←/→", v: lang === "en" ? "previous / next" : "이전 / 다음" },
      { k: "Ctrl+Alt+1..4", v: lang === "en" ? "go to workspace" : "해당 작업공간으로" },
    ]],
  ];

  return (
    <div className="set">
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
        <div className="term-title-name">{T.title}</div>
        <div className="term-title-actions" />
      </div>

      <div className="set-body" onPointerDown={(e) => e.stopPropagation()}>
        <h3>{T.look}</h3>
        <div className="set-row">
          <span>{T.theme}</span>
          <div className="set-chips">
            {Object.entries(themes).map(([k, v]) => (
              <button key={k} type="button" className={theme === k ? "on" : ""}
                      aria-pressed={theme === k} onClick={() => onTheme && onTheme(k)}>
                {lang === "en" ? (v.label_en || k) : (v.label_ko || k)}
              </button>
            ))}
          </div>
        </div>
        <div className="set-row">
          <span>{T.language}</span>
          <div className="set-chips">
            <button type="button" className={lang === "ko" ? "on" : ""}
                    aria-pressed={lang === "ko"} onClick={() => onLang && onLang("ko")}>한국어</button>
            <button type="button" className={lang === "en" ? "on" : ""}
                    aria-pressed={lang === "en"} onClick={() => onLang && onLang("en")}>English</button>
          </div>
        </div>
        <div className="set-row">
          <span>{T.motion}</span>
          {/* Read from the system, not set here: overriding it in the page would be
              lying to a preference the visitor already expressed. */}
          <span className="set-note">{reduced ? T.motionOff : T.motionOn}</span>
        </div>

        <h3>{T.keys}</h3>
        {KEYS.map(([head, rows]) => (
          <div key={head} className="set-keys">
            <div className="set-keys-head">{head}</div>
            {rows.map((r) => (
              <div key={r.k} className="set-key">
                <kbd>{r.k}</kbd><span>{r.v}</span>
              </div>
            ))}
          </div>
        ))}

        <h3>{T.layout}</h3>
        <div className="set-row">
          <button type="button" className="set-danger"
                  onClick={() => { if (confirm(T.confirm)) onReset && onReset(); }}>{T.reset}</button>
        </div>
        <p className="set-note">{T.resetNote}</p>
      </div>
    </div>
  );
}
