// Easy Mode — Notion-style document. Bilingual (ko/en).

import * as React from "preact/compat";

function EasyMode({ onBack, onTheme, currentTheme, lang, onLang }) {
  const d = window.SITE_DATA;
  const p = d.profile;
  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState([]);

  React.useEffect(() => {
    const onAgent = (e) => {
      const d = e.detail || {};
      setChatMessages(m => [
        ...m.filter(x => !x.pending),
        {
          role: "bot",
          kind: d.kind || "text",
          text: d.text,
          fileName: d.fileName,
          fileType: d.fileType,
          fileUrl: d.fileUrl,
          ts: d.timestamp || Date.now(),
        },
      ]);
    };
    const onTyping = (e) => {
      setChatMessages(m => {
        const hasPending = m.some(x => x.pending);
        if (e.detail.isTyping && !hasPending) return [...m, { role: "bot", text: "…", pending: true }];
        if (!e.detail.isTyping && hasPending) return m.filter(x => !x.pending);
        return m;
      });
    };
    window.addEventListener("livechat-agent-message", onAgent);
    window.addEventListener("livechat-agent-typing", onTyping);
    return () => {
      window.removeEventListener("livechat-agent-message", onAgent);
      window.removeEventListener("livechat-agent-typing", onTyping);
    };
  }, []);

  const sendChat = (text) => {
    setChatMessages(m => [...m, { role: "user", text, ts: Date.now() }]);
    if (window.LIVE_CHAT && window.LIVE_CHAT.send) window.LIVE_CHAT.send(text);
  };

  const _about = d.intro.about[lang === "en" ? "en" : "ko"];
  const T = lang === "en" ? {
    crumb: "Portfolio",
    backBtn: "⌘ Terminal Mode",
    backTitle: "Back to terminal mode",
    about: _about.primary,
    aboutSub: _about.secondary,
    research: "Research Interests",
    now: "Now",
    projects: "Projects",
    pubs: "Publications",
    exp: "Experience & Education",
    skills: "Skills",
    role: "Role", location: "Location", email: "Email", github: "GitHub", linkedin: "LinkedIn", til: "TIL", cv: "CV",
    cvAction: "download CV.pdf ↓",
    chatAction: "chat live",
    chatTitle: "chat with jeongin",
    chatLive: "online",
    chatEmpty: "say hi — I'll reply here or on my phone.",
    chatPlaceholder: "type a message…",
    chatHint: "enter to send · esc to close",
    foot: (y, name) => `© ${y} ${name} — made in Daegu, KR`,
  } : {
    crumb: "포트폴리오",
    backBtn: "⌘ Terminal Mode",
    backTitle: "터미널 모드로 돌아가기",
    about: _about.primary,
    aboutSub: _about.secondary,
    research: "연구 관심사",
    now: "지금 하는 일",
    projects: "프로젝트",
    pubs: "논문 / 글",
    exp: "경력 · 학력",
    skills: "스킬",
    role: "역할", location: "위치", email: "이메일", github: "깃허브", linkedin: "링크드인", til: "TIL", cv: "이력서",
    cvAction: "CV.pdf 받기 ↓",
    chatAction: "실시간 채팅",
    chatTitle: "Jeongin 과 채팅",
    chatLive: "online",
    chatEmpty: "아무 말이나 남겨주세요. 여기 또는 폰으로 답장드려요.",
    chatPlaceholder: "메시지 입력…",
    chatHint: "엔터 전송 · ESC 닫기",
    foot: (y, name) => `© ${y} ${name} — 대구에서 만듦`,
  };

  return (
    <div className="easy-root">
      <div className="easy-top">
        <div className="easy-crumbs">
          <span className="easy-crumb">{d.site.domain}</span>
          <span className="easy-crumb-sep">/</span>
          <span className="easy-crumb-cur">{T.crumb}</span>
        </div>
        <div className="easy-top-actions">
          <div className="lang-seg">
            <button className={"lang-btn" + (lang === "ko" ? " on" : "")} onClick={() => onLang("ko")}>한</button>
            <button className={"lang-btn" + (lang === "en" ? " on" : "")} onClick={() => onLang("en")}>EN</button>
          </div>
          <select value={currentTheme} onChange={e => onTheme(e.target.value)} className="easy-select" aria-label="theme">
            {Object.entries(window.THEMES).map(([k, v]) => <option key={k} value={k}>{lang === "en" ? v.name : v.label_ko}</option>)}
          </select>
          <button className="easy-back" onClick={onBack} title={T.backTitle}>{T.backBtn}</button>
        </div>
      </div>

      <div className="easy-doc">
        <div className="easy-cover" aria-hidden="true">
          <div className="easy-cover-grid"/>
          <div className="easy-cover-mono">{"{ software × language-models }"}</div>
        </div>

        <div className="easy-icon">◐</div>
        <h1 className="easy-title">
          {lang === "en" ? p.name_en : p.name_ko}
          <span className="easy-title-en"> / {lang === "en" ? p.name_ko : p.name_en}</span>
        </h1>
        <div className="easy-subtitle">
          {lang === "en" ? `${p.role_en} · ${p.affiliation_en}` : `${p.role_ko} · ${p.affiliation_ko}`}
        </div>

        <div className="easy-props">
          <PropRow label={T.role}     value={lang === "en" ? `${p.role_en} at ${p.affiliation_en}` : `${p.role_ko} · ${p.affiliation_ko}`} />
          <PropRow label={T.location} value={p.location} />
          <PropRow label={T.email}    value={<a href={`mailto:${p.email}`}>{p.email}</a>} />
          <PropRow label={T.github}   value={<a href={`https://github.com/${p.github}`} target="_blank" rel="noreferrer">@{p.github}</a>} />
          <PropRow label={T.linkedin} value={<a href={`https://linkedin.com/in/${p.linkedin}`} target="_blank" rel="noreferrer">jeongin-kim</a>} />
          <PropRow label={T.til}      value={<a href={p.til} target="_blank" rel="noreferrer">{d.site.til} ↗</a>} />
          <PropRow label={T.cv}       value={<a href={d.site.cvPath}>{T.cvAction}</a>} />
        </div>

        <Callout>
          {T.about}<br/>
          <span className="easy-dim">{T.aboutSub}</span>
        </Callout>

        <H2>{T.research}</H2>
        <div className="easy-research">
          {d.research.map((r, i) => (
            <div key={i} className="easy-research-item">
              <div className="easy-tag">{r.tag}</div>
              <div>
                <div className="easy-r-title">{lang === "en" ? r.title_en : r.title_ko}</div>
                <div className="easy-r-blurb">{r.blurb}</div>
              </div>
            </div>
          ))}
        </div>

        <H2>{T.now}</H2>
        <EasyCalendar lang={lang} />

        <H2>{lang === "en" ? "Highlights" : "요즘 관심사"}</H2>
        <ul className="easy-bullets">{d.now.map((n, i) => <li key={i}>{n}</li>)}</ul>

        <H2>{T.projects} <span className="easy-h-en">({d.projects.length})</span></H2>
        <div className="easy-projects">
          {d.projects.map(pr => (
            <a key={pr.slug} className="easy-proj" href={`#/projects/${pr.slug}`}>
              <div className="easy-proj-h">
                <span className="easy-proj-slug">{pr.slug}</span>
                <span className="easy-proj-year">{pr.year}</span>
              </div>
              <div className="easy-proj-title">{lang === "en" ? pr.title_en : pr.title_ko}</div>
              <div className="easy-proj-sum">{lang === "en" ? pr.summary_en : pr.summary_ko}</div>
              <div className="easy-proj-stack">{pr.stack.map((s, i) => <span key={i} className="easy-pill">{s}</span>)}</div>
              {pr.featured && <div className="easy-proj-feat">★ featured</div>}
            </a>
          ))}
        </div>

        <H2>{T.pubs}</H2>
        <div className="easy-pubs">
          {d.publications.map((pb, i) => (
            <div key={i} className="easy-pub">
              <span className="easy-pub-y">{pb.year}</span>
              <span className="easy-pub-v">{pb.venue}</span>
              <span className="easy-pub-t">{pb.title}</span>
              <span className="easy-pub-r">({pb.role})</span>
            </div>
          ))}
        </div>

        <H2>{T.exp}</H2>
        <div className="easy-exp">
          {d.experience.map((e, i) => (
            <div key={i} className="easy-exp-row">
              <div className="easy-exp-when">{e.when}</div>
              <div>
                <div className="easy-exp-what">{lang === "en" ? e.what_en : e.what_ko}</div>
                <div className="easy-dim">{lang === "en" ? e.what_ko : e.what_en} — {e.where}</div>
              </div>
            </div>
          ))}
        </div>

        <H2>{T.skills}</H2>
        <div className="easy-skills">
          {Object.entries(d.skills).map(([k, arr]) => (
            <div key={k} className="easy-skill-row">
              <div className="easy-skill-label">{k}</div>
              <div className="easy-skill-pills">{arr.map((x, i) => <span key={i} className="easy-pill">{x}</span>)}</div>
            </div>
          ))}
        </div>

        <div className="easy-foot">
          <div>{T.foot(d.site.copyrightYear, lang === "en" ? p.name_en : p.name_ko)}</div>
          <div>TIL → <a href={p.til} target="_blank" rel="noreferrer">{d.site.til}</a></div>
        </div>
      </div>

      {!chatOpen && (
        <button
          className="easy-chat-fab"
          onClick={() => setChatOpen(true)}
          aria-label={T.chatAction}
        >
          <span className="easy-chat-fab-dot" aria-hidden="true" />
          <span>{T.chatAction}</span>
        </button>
      )}
      {chatOpen && (
        <EasyChat
          T={T}
          messages={chatMessages}
          onSend={sendChat}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

function EasyChat({ T, messages, onSend, onClose }) {
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  React.useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  };

  return (
    <div className="easy-chat-panel" role="dialog" aria-label={T.chatTitle}>
      <div className="easy-chat-head">
        <span className="easy-chat-head-dot" aria-hidden="true" />
        <span className="easy-chat-head-title">{T.chatTitle}</span>
        <span className="easy-chat-head-live">● {T.chatLive}</span>
        <button className="easy-chat-close" onClick={onClose} aria-label="close">×</button>
      </div>
      <div className="easy-chat-body" ref={scrollRef}>
        {messages.length === 0 && <div className="easy-chat-empty">{T.chatEmpty}</div>}
        {messages.map((m, i) => {
          const k = m.kind || "text";
          const bubbleClass = "easy-chat-bubble" + (k === "image" ? " is-image" : "");
          return (
            <div key={i} className={"easy-chat-msg role-" + m.role + (m.pending ? " pending" : "")}>
              <div className={bubbleClass}>
                {k === "image" ? (
                  <a href={m.fileUrl} target="_blank" rel="noreferrer" className="easy-chat-img-link">
                    <img src={m.fileUrl} alt={m.fileName || ""} className="easy-chat-img" />
                  </a>
                ) : k === "audio" ? (
                  <audio controls src={m.fileUrl} className="easy-chat-audio" />
                ) : k === "file" ? (
                  <a href={m.fileUrl} target="_blank" rel="noreferrer" className="easy-chat-file">
                    <span className="easy-chat-file-ico" aria-hidden="true">↓</span>
                    <span className="easy-chat-file-name">{m.fileName || "file"}</span>
                  </a>
                ) : m.text}
              </div>
            </div>
          );
        })}
      </div>
      <form className="easy-chat-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="easy-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={T.chatPlaceholder}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="message input"
        />
        <button type="submit" className="easy-chat-send" aria-label="send">→</button>
      </form>
      <div className="easy-chat-hint">{T.chatHint}</div>
    </div>
  );
}

function PropRow({ label, value }) { return <div className="easy-prop"><div className="easy-prop-k">{label}</div><div className="easy-prop-v">{value}</div></div>; }
function H2({ children }) { return <h2 className="easy-h2">{children}</h2>; }
function Callout({ children }) { return <div className="easy-callout"><div className="easy-callout-b">{children}</div></div>; }

function EasyCalendar({ lang }) {
  const [state, setState] = React.useState({ loading: true });
  React.useEffect(() => {
    window.CALENDAR.load().then(data => setState({ loading: false, data }));
  }, []);
  if (state.loading) return <div className="easy-dim">{lang === "en" ? "loading..." : "불러오는 중..."}</div>;
  const data = state.data;
  const events = window.CALENDAR.getWeek(data);
  if (!events.length) {
    return (
      <div className="easy-cal-empty">
        <div className="easy-dim">{lang === "en" ? "no events scheduled this week." : "이번 주 일정이 비어 있어요."}</div>
        <div className="easy-dim" style={{ fontSize: 12, marginTop: 6 }}>
          {lang === "en" ? `synced ${window.CALENDAR.relativeAgo(data.updated, lang)}` : `${window.CALENDAR.relativeAgo(data.updated, lang)} 동기화`}
        </div>
      </div>
    );
  }
  const groups = {};
  events.forEach(e => {
    const k = window.CALENDAR.fmtDay(e._start, lang);
    (groups[k] = groups[k] || []).push(e);
  });
  const tagColor = { lab: "var(--t-cyan)", focus: "var(--t-accent)", teach: "var(--t-yellow)", life: "#c678dd", other: "var(--t-muted)" };
  return (
    <div className="easy-cal">
      {Object.entries(groups).map(([day, evs]) => (
        <div key={day} className="easy-cal-day">
          <div className="easy-cal-daylbl">{day}</div>
          <div className="easy-cal-events">
            {evs.map((e, i) => (
              <div key={i} className="easy-cal-ev">
                <span className="easy-cal-time">{window.CALENDAR.fmtTime(e._start)}</span>
                <span className="easy-cal-dot" style={{ background: tagColor[e.tag] || "var(--t-muted)" }} />
                <span className="easy-cal-title">{e.title}</span>
                {e.location && <span className="easy-cal-loc">@ {e.location}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="easy-cal-foot">
        {lang === "en" ? `synced ${window.CALENDAR.relativeAgo(data.updated, lang)} · source: Google Calendar (filtered)` : `${window.CALENDAR.relativeAgo(data.updated, lang)} 동기화 · 출처: Google Calendar (비공개 일정 필터됨)`}
      </div>
    </div>
  );
}

export { EasyMode };