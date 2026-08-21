// Live chat. The conversation is a module-level store, not component state.
//
// It was component state, and closing the chat window threw the conversation away:
// a notification would arrive, you would open chat, and it was empty. The window is
// a view of the conversation, not the place it lives. Same mistake the player had.
//
// crisp.js does the talking to the operator and re-publishes what comes back as
// `livechat-agent-message` / `livechat-agent-typing`. This subscribes once, at load,
// so messages are collected whether or not anything is on screen to show them.
//
// The terminal is deliberately not a subscriber here. Its chat is interleaved into
// the scrollback next to command output rather than kept as a list, so it reads the
// same events and builds something else out of them.

import * as React from "preact/compat";

const CHAT = {
  messages: [],
  subs: new Set(),
  // Raised while a chat view is in front. A toast for a message you are watching
  // arrive is noise.
  quiet: 0,

  sub(f) { CHAT.subs.add(f); return () => { CHAT.subs.delete(f); }; },
  notify() { CHAT.subs.forEach((f) => f()); },
  hush(on) { CHAT.quiet = Math.max(0, CHAT.quiet + (on ? 1 : -1)); },

  add(m) {
    // The typing placeholder is replaced by the message it was announcing.
    CHAT.messages = [...CHAT.messages.filter((x) => !x.pending), m];
    CHAT.notify();
  },
  typing(on) {
    const pending = CHAT.messages.some((x) => x.pending);
    if (on && !pending) CHAT.messages = [...CHAT.messages, { role: "bot", pending: true, ts: Date.now() }];
    else if (!on && pending) CHAT.messages = CHAT.messages.filter((x) => !x.pending);
    else return;
    CHAT.notify();
  },
  send(text) {
    const body = String(text || "").trim();
    if (!body) return;
    CHAT.messages = [...CHAT.messages, { role: "user", text: body, ts: Date.now() }];
    CHAT.notify();
    if (window.LIVE_CHAT && window.LIVE_CHAT.send) window.LIVE_CHAT.send(body);
  },
};

window.addEventListener("livechat-agent-message", (e) => {
  const d = e.detail || {};
  CHAT.add({
    role: "bot",
    kind: d.kind || "text",
    text: d.text,
    fileName: d.fileName,
    fileType: d.fileType,
    fileUrl: d.fileUrl,
    ts: d.timestamp || Date.now(),
  });
  // A reply can land with no chat view open at all, which is exactly when a toast
  // is worth raising. Clicking it opens the window, and the message is there.
  if (!CHAT.quiet && window.NOTIFY) {
    window.NOTIFY.push({
      app: window.SITE_DATA.profile.name_en,
      body: d.text || d.fileName || "...",
      onOpen: () => window.dispatchEvent(new CustomEvent("open-chat")),
    });
  }
});
window.addEventListener("livechat-agent-typing", (e) => {
  CHAT.typing(!!(e.detail && e.detail.isTyping));
});

// For views that are not built on the hook. The terminal's chat mode is one: it
// shows the conversation without reading this list, and while it is open a toast
// about a message already on screen is noise.
export function hushChat(on) { CHAT.hush(on); }

export function useLiveChat({ quiet } = {}) {
  const [, bump] = React.useState(0);
  React.useEffect(() => CHAT.sub(() => bump((n) => n + 1)), []);
  React.useEffect(() => {
    if (!quiet) return;
    CHAT.hush(true);
    return () => CHAT.hush(false);
  }, [quiet]);
  return { messages: CHAT.messages, send: CHAT.send };
}

// One message, in whichever of the four shapes Crisp can deliver.
export function ChatBubble({ m, className }) {
  const k = m.kind || "text";
  if (k === "image") {
    return (
      <a href={m.fileUrl} target="_blank" rel="noreferrer" className={className}>
        <img src={m.fileUrl} alt={m.fileName || ""} className="chat-img" />
      </a>
    );
  }
  if (k === "audio") return <audio controls src={m.fileUrl} className="chat-audio" />;
  if (k === "file") {
    return (
      <a href={m.fileUrl} target="_blank" rel="noreferrer" className={className}>
        <span aria-hidden="true">↓</span> {m.fileName || "file"}
      </a>
    );
  }
  return <>{m.text}</>;
}

// The desktop window. Same conversation as the terminal's `chat` command, in a
// window you can leave open next to it.
export function ChatWindow({ lang, wm, focused }) {
  const { messages, send } = useLiveChat({ quiet: focused });
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);
  React.useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const p = window.SITE_DATA.profile;
  const T = lang === "en" ? {
    title: "Chat", live: "live",
    empty: `Say hi. It reaches ${p.name_en} on their phone; a reply lands here.`,
    ph: "type a message", send: "send",
  } : {
    title: "채팅", live: "연결됨",
    empty: `메시지를 남겨주세요. ${p.name_ko}의 휴대폰으로 갑니다. 답장은 여기로 옵니다.`,
    ph: "메시지 입력", send: "보내기",
  };

  const submit = (e) => {
    e.preventDefault();
    send(input);
    setInput("");
  };

  return (
    <div className="cw">
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
        <div className="term-title-name">{`${T.title} - ${p.name_en}`}</div>
        <div className="term-title-actions">
          <span className="cw-live">● {T.live}</span>
        </div>
      </div>

      <div className="cw-body" ref={scrollRef} role="log" aria-live="polite">
        {messages.length === 0 && <div className="cw-empty">{T.empty}</div>}
        {messages.map((m, i) => {
          // One label per run. Repeating it on every line reads like two people
          // taking turns when it is one person still talking.
          const prev = messages[i - 1];
          const cont = prev && prev.role === m.role;
          return (
            <div key={i} className={"cw-msg role-" + m.role
                          + (m.pending ? " pending" : "") + (cont ? " cont" : "")}>
              {!cont && (
                <span className="cw-who">
                  {m.role === "user" ? "you" : window.SITE_DATA.site.handle}
                </span>
              )}
              <div className="cw-bubble">
                {m.pending ? <span className="cw-dots">...</span> : <ChatBubble m={m} className="cw-file" />}
              </div>
            </div>
          );
        })}
      </div>

      <form className="cw-form" onSubmit={submit} onPointerDown={(e) => e.stopPropagation()}>
        <input ref={inputRef} value={input} placeholder={T.ph} aria-label={T.ph}
               onInput={(e) => setInput(e.currentTarget.value)} />
        <button type="submit">{T.send}</button>
      </form>
    </div>
  );
}
