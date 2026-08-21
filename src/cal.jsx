// The calendar, as a window rather than as a command.
//
// The month grid is drawn from the same data `now` reads, so it cannot disagree
// with the terminal, and the free slots offered for booking come from that same
// data: a slot on offer is one that is genuinely open.
//
// Booking is a *request*, and the window says so. Nothing here can write to the
// calendar: the browser key is read-only, and creating an event would need OAuth
// from the owner, not from the visitor. calendar.app.google cannot be framed
// either (X-Frame-Options: SAMEORIGIN). What does work is the channel that is
// already here, so the request goes down the chat pipe and reaches a phone.

import * as React from "preact/compat";
import { Icon } from "./icons.jsx";
import { sendChat, chatReady } from "./chat.jsx";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Free slots on the picked day. Working hours only, weekdays only, half-hour
// blocks, minus anything the calendar already has. It is the same calendar the
// grid above is drawn from, so a slot offered here is one that is genuinely open.
//
// The day is read in the browser's own timezone, which is the visitor's. Someone in
// another country picking "14:00" means 14:00 where they are, and the request says
// which zone it was written in so nobody has to guess.
const HOURS = [10, 18];   // 10:00 to 18:00
const SLOT = 30;

function freeSlots(day, events) {
  const out = [];
  const dow = day.getDay();
  if (dow === 0 || dow === 6) return out;
  const now = new Date();
  const busy = events
    .filter((e) => e._e > new Date(day.getFullYear(), day.getMonth(), day.getDate()) &&
                   e._s < new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1))
    .map((e) => [e._s.getTime(), e._e.getTime()]);

  for (let h = HOURS[0]; h < HOURS[1]; h++) {
    for (let m = 0; m < 60; m += SLOT) {
      const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      const e = new Date(s.getTime() + SLOT * 60000);
      if (s <= now) continue;                                   // no booking the past
      if (busy.some(([bs, be]) => s.getTime() < be && e.getTime() > bs)) continue;
      out.push(s);
    }
  }
  return out;
}

function BookingPanel({ lang, day, events, onClose, onOpenChat }) {
  const [slot, setSlot] = React.useState(null);
  const [name, setName] = React.useState(() => {
    const n = window.getPromptName && window.getPromptName();
    return n && n !== "anonymous" ? n : "";
  });
  const [contact, setContact] = React.useState("");
  const [why, setWhy] = React.useState("");
  const [sent, setSent] = React.useState(null);

  const slots = React.useMemo(() => freeSlots(day, events), [day, events]);
  const zone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
  })();

  const T = lang === "en" ? {
    head: "Request a time", pick: "Pick a slot", none: "no free slots on this day",
    weekend: "weekends are not offered", name: "Your name", contact: "Email or handle",
    why: "What it is about", send: "Send the request", cancel: "Cancel",
    needs: "Pick a slot and leave a name.",
    doneH: "Sent.", done: "It is a request, not a confirmed booking: nothing here can write to the calendar. The reply comes back in the chat window.",
    openChat: "Open chat", addSelf: "Add to my own calendar", official: "Book through Google instead",
    noChat: "The chat script did not load, most likely blocked. Mail works:",
    zone: (z) => `times are in ${z}`,
    tentative: "(tentative)",
  } : {
    head: "시간 요청하기", pick: "시간 고르기", none: "이 날은 비는 시간이 없습니다",
    weekend: "주말은 제외됩니다", name: "이름", contact: "이메일 또는 연락처",
    why: "어떤 용건인지", send: "요청 보내기", cancel: "취소",
    needs: "시간을 고르고 이름을 적어주세요.",
    doneH: "보냈습니다.", done: "확정된 예약이 아니라 요청입니다. 여기서 캘린더에 쓸 수는 없습니다. 답장은 채팅 창으로 옵니다.",
    openChat: "채팅 열기", addSelf: "내 캘린더에 넣기", official: "구글로 직접 예약하기",
    noChat: "채팅 스크립트가 로드되지 않았습니다. 차단된 것 같습니다. 메일은 됩니다:",
    zone: (z) => `시간대: ${z}`,
    tentative: "(가예약)",
  };

  const p = window.SITE_DATA.profile;
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
                     `${String(d.getDate()).padStart(2, "0")} ` +
                     `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const body = () => {
    const end = new Date(slot.getTime() + SLOT * 60000);
    return [
      lang === "en" ? "[Meeting request]" : "[약속 요청]",
      `${lang === "en" ? "when" : "희망 시간"}: ${fmt(slot)} - ${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")} (${zone})`,
      `${lang === "en" ? "name" : "이름"}: ${name.trim()}`,
      contact.trim() ? `${lang === "en" ? "contact" : "연락처"}: ${contact.trim()}` : null,
      why.trim() ? `${lang === "en" ? "about" : "용건"}: ${why.trim()}` : null,
    ].filter(Boolean).join(String.fromCharCode(10));
  };

  // A calendar template link puts it on the *visitor's* calendar, which is the only
  // calendar this page is allowed to touch. Marked tentative for that reason.
  const selfLink = () => {
    if (!slot) return "#";
    const end = new Date(slot.getTime() + SLOT * 60000);
    const z = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const q = new URLSearchParams({
      action: "TEMPLATE",
      text: `${p.name_en} ${T.tentative}`,
      dates: `${z(slot)}/${z(end)}`,
      details: body(),
    });
    return "https://calendar.google.com/calendar/render?" + q.toString();
  };

  const submit = (e) => {
    e.preventDefault();
    if (!slot || !name.trim()) return;
    const text = body();
    if (chatReady()) { sendChat(text); setSent({ text, via: "chat" }); }
    else setSent({ text, via: "mail" });
  };

  if (sent) {
    const mail = `mailto:${p.email}?subject=${encodeURIComponent(lang === "en" ? "Meeting request" : "약속 요청")}` +
                 `&body=${encodeURIComponent(sent.text)}`;
    return (
      <div className="book">
        <div className="book-h">{T.doneH}</div>
        {sent.via === "chat" ? (
          <>
            <p className="set-note">{T.done}</p>
            <div className="book-acts">
              <button type="button" className="cal-book" onClick={onOpenChat}>{T.openChat}</button>
              <a className="pdfv-act" href={selfLink()} target="_blank" rel="noreferrer">{T.addSelf} ↗</a>
              <button type="button" className="pdfv-act" onClick={onClose}>{T.cancel}</button>
            </div>
          </>
        ) : (
          <>
            <p className="set-note">{T.noChat}</p>
            <pre className="book-pre">{sent.text}</pre>
            <div className="book-acts">
              <a className="cal-book" href={mail}>{p.email}</a>
              <a className="pdfv-act" href={selfLink()} target="_blank" rel="noreferrer">{T.addSelf} ↗</a>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <form className="book" onSubmit={submit}>
      <div className="book-h">{T.head}</div>
      <div className="book-day">
        {window.CALENDAR.fmtDay(day, lang)}
        {zone && <span className="set-note">  {T.zone(zone)}</span>}
      </div>

      {slots.length === 0 ? (
        <div className="cal-msg">{day.getDay() === 0 || day.getDay() === 6 ? T.weekend : T.none}</div>
      ) : (
        <div className="book-slots" role="radiogroup" aria-label={T.pick}>
          {slots.map((s) => (
            <button key={s.getTime()} type="button" role="radio"
                    aria-checked={slot && slot.getTime() === s.getTime()}
                    className={"book-slot" + (slot && slot.getTime() === s.getTime() ? " on" : "")}
                    onClick={() => setSlot(s)}>
              {window.CALENDAR.fmtTime(s)}
            </button>
          ))}
        </div>
      )}

      <label className="book-f"><span>{T.name}</span>
        <input value={name} onInput={(e) => setName(e.currentTarget.value)} required />
      </label>
      <label className="book-f"><span>{T.contact}</span>
        <input value={contact} onInput={(e) => setContact(e.currentTarget.value)} />
      </label>
      <label className="book-f"><span>{T.why}</span>
        <input value={why} onInput={(e) => setWhy(e.currentTarget.value)} />
      </label>

      <div className="book-acts">
        <button type="submit" className="cal-book" disabled={!slot || !name.trim()}>{T.send}</button>
        <button type="button" className="pdfv-act" onClick={onClose}>{T.cancel}</button>
        {window.SITE_DATA.site.bookingUrl && (
          <a className="pdfv-act" href={window.SITE_DATA.site.bookingUrl} target="_blank" rel="noreferrer">
            {T.official} ↗
          </a>
        )}
      </div>
      {(!slot || !name.trim()) && <p className="set-note">{T.needs}</p>}
    </form>
  );
}

export function CalendarApp({ lang, wm, onOpen }) {
  const [data, setData] = React.useState(null);
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [picked, setPicked] = React.useState(() => new Date());
  const [booking, setBooking] = React.useState(false);

  React.useEffect(() => {
    let dead = false;
    window.CALENDAR.load().then((d) => { if (!dead) setData(d); });
    return () => { dead = true; };
  }, []);

  const T = lang === "en" ? {
    title: "Calendar", today: "today", book: "Request a time",
    none: "nothing on this day", failed: "the calendar could not be read",
    loading: "loading...", live: "live", why: "pick a day above, then a free slot",
  } : {
    title: "달력", today: "오늘", book: "약속 잡기",
    none: "이 날은 비어 있습니다", failed: "캘린더를 불러오지 못했습니다",
    loading: "불러오는 중...", live: "실시간", why: "위에서 날짜를 고르고 비는 시간을 선택하세요",
  };

  const events = React.useMemo(() => {
    if (!data || !data.events) return [];
    return data.events
      .map((e) => ({ ...e, _s: new Date(e.start), _e: new Date(e.end) }))
      .filter((e) => !isNaN(e._s))
      .sort((a, b) => a._s - b._s);
  }, [data]);

  // Which days in the shown month have anything on them.
  const marks = React.useMemo(() => {
    const m = new Map();
    for (const e of events) {
      if (e._s.getFullYear() !== cursor.getFullYear() || e._s.getMonth() !== cursor.getMonth()) continue;
      const k = e._s.getDate();
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [events, cursor]);

  const onDay = events.filter((e) => sameDay(e._s, picked));
  const today = new Date();
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const lead = first.getDay();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const month = lang === "en"
    ? cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;
  const step = (n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <div className="cal">
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
        <div className="term-title-actions">
          {data && !data.failed && (
            <span className="cal-live">{data.live ? "● " + T.live : window.CALENDAR.relativeAgo(data.updated, lang)}</span>
          )}
        </div>
      </div>

      <div className="cal-body" onPointerDown={(e) => e.stopPropagation()}>
        <div className="cal-bar">
          <button type="button" onClick={() => step(-1)} aria-label="previous month">{"<"}</button>
          <span className="cal-month">{month}</span>
          <button type="button" onClick={() => step(1)} aria-label="next month">{">"}</button>
          <button type="button" className="cal-today"
                  onClick={() => { const d = new Date(); setPicked(d); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>
            {T.today}
          </button>
        </div>

        {!data ? (
          <div className="cal-msg">{T.loading}</div>
        ) : data.failed ? (
          <div className="cal-msg warn">{T.failed}</div>
        ) : (
          <>
            <div className="cal-grid" role="grid">
              {(lang === "en" ? DAY_EN : DAY_KO).map((d, i) => (
                <div key={d} className={"cal-dow" + (i === 0 ? " sun" : i === 6 ? " sat" : "")}>{d}</div>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <div key={"e" + i} className="cal-cell empty" />;
                const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
                const cls = "cal-cell"
                  + (sameDay(date, today) ? " today" : "")
                  + (sameDay(date, picked) ? " on" : "")
                  + (i % 7 === 0 ? " sun" : i % 7 === 6 ? " sat" : "");
                return (
                  <button key={d} type="button" className={cls} onClick={() => setPicked(date)}>
                    <span className="cal-n">{d}</span>
                    {marks.get(d) > 0 && (
                      <span className="cal-dots">
                        {Array.from({ length: Math.min(3, marks.get(d)) }, (_, k) => (
                          <span key={k} className="cal-dot" />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="cal-day">
              <div className="cal-day-h">{window.CALENDAR.fmtDay(picked, lang)}</div>
              {onDay.length === 0 ? (
                <div className="cal-msg">{T.none}</div>
              ) : onDay.map((e, i) => (
                <div key={i} className="cal-ev">
                  <span className="cal-ev-t">
                    {window.CALENDAR.fmtTime(e._s)}-{window.CALENDAR.fmtTime(e._e)}
                  </span>
                  <span className={"t-tag t-tag-" + (e.tag || "other")}>{e.tag || "other"}</span>
                  <span className="cal-ev-n">{e.title}{e.location ? `  @${e.location}` : ""}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {data && !data.failed && (
        <div className="cal-foot" onPointerDown={(e) => e.stopPropagation()}>
          {!booking ? (
            <>
              <button type="button" className="cal-book" onClick={() => setBooking(true)}>
                <Icon name="calendar" size={16} /> {T.book}
              </button>
              <span className="set-note">{T.why}</span>
            </>
          ) : (
            <BookingPanel lang={lang} day={picked} events={events}
                          onClose={() => setBooking(false)}
                          onOpenChat={() => { setBooking(false); onOpen && onOpen("chat"); }} />
          )}
        </div>
      )}
    </div>
  );
}
