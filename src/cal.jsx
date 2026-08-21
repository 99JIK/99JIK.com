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

// Free slots on the picked day. Working hours only, weekdays only, half-hour blocks,
// minus anything the calendar already has. It is the same calendar the grid above is
// drawn from, so a slot offered here is one that is genuinely open.
//
// The hours belong to HIS clock, not the visitor's. Building them from the browser's
// local time offered someone in New York 10:00-18:00 EDT, which is the middle of the
// night in Seoul. Slots are anchored in TZ and labelled in TZ, and the visitor's own
// time is shown next to them when the two differ.
const TZ = (window.SITE_DATA.site && window.SITE_DATA.site.timezone) || "Asia/Seoul";
const HOURS = [10, 18];   // 10:00 to 18:00
const SLOT = 30;

// How far `tz` sits from UTC at that instant, in ms.
function tzOffset(ms, tz) {
  const p = {};
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  for (const x of f.formatToParts(ms)) p[x.type] = x.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
}

// The instant at which the wall clock in `tz` reads y-mo-d h:mi. Corrected twice so it
// lands right in zones that observe DST. Seoul does not, but the helper should not
// quietly depend on that.
function atZone(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo, d, h, mi);
  return new Date(guess - tzOffset(guess - tzOffset(guess, tz), tz));
}

const fmtIn = (dt, tz) => new Intl.DateTimeFormat("en-GB", {
  timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" }).format(dt);
const dateIn = (dt, tz) => new Intl.DateTimeFormat("en-CA", {
  timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
const hourIn = (dt, tz) => +fmtIn(dt, tz).slice(0, 2);

function freeSlots(day, events) {
  const out = [];
  const dow = day.getDay();
  if (dow === 0 || dow === 6) return out;
  const y = day.getFullYear(), mo = day.getMonth(), d = day.getDate();
  const now = Date.now();
  const from = atZone(y, mo, d, 0, 0, TZ).getTime();
  const to = atZone(y, mo, d + 1, 0, 0, TZ).getTime();
  const busy = events
    .filter((e) => e._e.getTime() > from && e._s.getTime() < to)
    .map((e) => [e._s.getTime(), e._e.getTime()]);

  for (let h = HOURS[0]; h < HOURS[1]; h++) {
    for (let m = 0; m < 60; m += SLOT) {
      const s = atZone(y, mo, d, h, m, TZ);
      const e = s.getTime() + SLOT * 60000;
      if (s.getTime() <= now) continue;                         // no booking the past
      if (busy.some(([bs, be]) => s.getTime() < be && e > bs)) continue;
      out.push(s);
    }
  }
  return out;
}

function BookingPanel({ lang, day, setDay, events, onClose, onOpenChat }) {
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

  // Changing the day invalidates whatever was picked on the old one.
  React.useEffect(() => { setSlot(null); }, [day]);

  const T = lang === "en" ? {
    head: "Request a time", back: "back", am: "morning", pm: "afternoon",
    none: "nothing free on this day", weekend: "weekends are not offered",
    next: "next free day", nofree: "no free day in the next two months",
    name: "Your name", contact: "Email or handle", why: "What it is about",
    whyPh: "a sentence is plenty",
    send: "Send the request", cancel: "Cancel", needSlot: "pick a time first",
    needName: "leave a name", official: "Book through Google",
    doneH: "Request sent",
    done: "This is a request, not a confirmed booking. Nothing on this page can write to his calendar. The reply comes back in the chat window.",
    openChat: "Open chat", addSelf: "Add to my calendar", close: "Done",
    noChatH: "Chat did not load",
    noChat: "The chat script is blocked, most likely by an extension. Nothing was sent. Mail carries the same request:",
    mins: "30 min", yours: "your time",
    tz: (a, b) => "Times are his (" + a + "). Yours (" + b + ") is shown next to them.",
  } : {
    head: "시간 요청", back: "뒤로", am: "오전", pm: "오후",
    none: "이 날은 비는 시간이 없습니다", weekend: "주말은 제외됩니다",
    next: "다음 빈 날로", nofree: "두 달 안에 빈 날이 없습니다",
    name: "이름", contact: "이메일 또는 연락처", why: "용건",
    whyPh: "한 문장이면 충분합니다",
    send: "요청 보내기", cancel: "취소", needSlot: "시간을 먼저 고르세요",
    needName: "이름을 적어주세요", official: "구글로 직접 예약",
    doneH: "요청을 보냈습니다",
    done: "확정된 예약이 아니라 요청입니다. 이 페이지에서 상대 캘린더에 쓸 수는 없습니다. 답장은 채팅 창으로 옵니다.",
    openChat: "채팅 열기", addSelf: "내 캘린더에 넣기", close: "닫기",
    noChatH: "채팅이 로드되지 않았습니다",
    noChat: "확장 프로그램이 채팅 스크립트를 막은 것 같습니다. 아무것도 전송되지 않았습니다. 메일로 같은 내용을 보낼 수 있습니다:",
    mins: "30분", yours: "내 시간",
    tz: (a, b) => "시간은 상대 기준(" + a + ")입니다. 내 시간(" + b + ")을 옆에 함께 적었습니다.",
  };

  const p = window.SITE_DATA.profile;
  const hhmm = (d) => fmtIn(d, TZ);
  const endOf = (s) => new Date(s.getTime() + SLOT * 60000);
  const range = (s) => dateIn(s, TZ) + " " + hhmm(s) + " - " + hhmm(endOf(s)) + " " + TZ;
  // Two clocks only when there are two. A visitor in Seoul sees one time, once.
  const elsewhere = !!zone && zone !== TZ;
  const sameDate = (s) => dateIn(s, zone) === dateIn(s, TZ);
  const mine = (s) => (sameDate(s) ? "" : dateIn(s, zone) + " ") +
                      fmtIn(s, zone) + " - " + fmtIn(endOf(s), zone) + " " + zone;
  const mineShort = (s) => (sameDate(s) ? "" : dateIn(s, zone).slice(5) + " ") + fmtIn(s, zone);

  const body = () => [
    lang === "en" ? "[Meeting request]" : "[약속 요청]",
    (lang === "en" ? "when" : "희망 시간") + ": " + range(slot) +
      (elsewhere ? "  /  " + mine(slot) : ""),
    (lang === "en" ? "name" : "이름") + ": " + name.trim(),
    contact.trim() ? (lang === "en" ? "contact" : "연락처") + ": " + contact.trim() : null,
    why.trim() ? (lang === "en" ? "about" : "용건") + ": " + why.trim() : null,
  ].filter(Boolean).join(String.fromCharCode(10));

  // A template link puts it on the *visitor's* calendar, which is the only calendar
  // this page is allowed to touch. Marked tentative for exactly that reason.
  const selfLink = (s) => {
    const z = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const q = new URLSearchParams({
      action: "TEMPLATE",
      text: p.name_en + " " + (lang === "en" ? "(tentative)" : "(가예약)"),
      dates: z(s.when) + "/" + z(endOf(s.when)),
      details: s.text,
    });
    return "https://calendar.google.com/calendar/render?" + q.toString();
  };

  const submit = (e) => {
    e.preventDefault();
    if (!slot || !name.trim()) return;
    const text = body();
    if (chatReady()) { sendChat(text); setSent({ text, when: slot, via: "chat" }); }
    else setSent({ text, when: slot, via: "mail" });
  };

  // Walk forward for a day with anything on offer. Two months is far enough that
  // coming up empty means the working-hours window is wrong, not that he is busy.
  const findFree = React.useCallback(() => {
    for (let i = 1; i <= 62; i++) {
      const d = new Date(day.getFullYear(), day.getMonth(), day.getDate() + i);
      if (freeSlots(d, events).length) return d;
    }
    return null;
  }, [day, events]);
  const nextDay = React.useMemo(() => (slots.length ? null : findFree()), [slots, findFree]);

  const stepDay = (n) => setDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() + n));

  const head = (title) => (
    <div className="book-head">
      <button type="button" className="book-back" onClick={onClose} aria-label={T.back}>←</button>
      <span className="book-title">{title}</span>
    </div>
  );

  if (sent) {
    const mail = "mailto:" + p.email +
                 "?subject=" + encodeURIComponent(lang === "en" ? "Meeting request" : "약속 요청") +
                 "&body=" + encodeURIComponent(sent.text);
    const ok = sent.via === "chat";
    return (
      <>
        <div className="cal-body book-body" onPointerDown={(e) => e.stopPropagation()}>
          {head(ok ? T.doneH : T.noChatH)}
          <div className={"book-card" + (ok ? " ok" : " warn")}>
            <Icon name="calendar" size={18} />
            <div className="book-card-x">
              <div className="book-card-t">{range(sent.when)}</div>
              <div className="book-card-s">{name.trim()}{elsewhere ? "  ·  " + mine(sent.when) : ""}</div>
            </div>
          </div>
          <p className="book-note">{ok ? T.done : T.noChat}</p>
          {!ok && <pre className="book-pre">{sent.text}</pre>}
        </div>
        <div className="cal-foot" onPointerDown={(e) => e.stopPropagation()}>
          {ok ? (
            <button type="button" className="cal-book" onClick={onOpenChat}>{T.openChat}</button>
          ) : (
            <a className="cal-book" href={mail}>{p.email}</a>
          )}
          <a className="book-link" href={selfLink(sent)} target="_blank" rel="noreferrer">{T.addSelf} ↗</a>
          <span className="book-sp" />
          <button type="button" className="book-link" onClick={onClose}>{T.close}</button>
        </div>
      </>
    );
  }

  const group = (label, list) => list.length === 0 ? null : (
    <div className="book-grp">
      <div className="book-grp-h">{label}</div>
      <div className="book-slots">
        {list.map((s) => (
          <button key={s.getTime()} type="button" role="radio"
                  aria-checked={!!slot && slot.getTime() === s.getTime()}
                  className={"book-slot" + (slot && slot.getTime() === s.getTime() ? " on" : "")}
                  onClick={() => setSlot(s)}>
            {hhmm(s)}
          </button>
        ))}
      </div>
    </div>
  );

  const weekend = day.getDay() === 0 || day.getDay() === 6;

  return (
    <>
      <div className="cal-body book-body" onPointerDown={(e) => e.stopPropagation()}>
        {head(T.head)}

        <div className="book-daybar">
          <button type="button" onClick={() => stepDay(-1)} aria-label="previous day">{"<"}</button>
          <span className="book-day">{window.CALENDAR.fmtDay(day, lang)}</span>
          <button type="button" onClick={() => stepDay(1)} aria-label="next day">{">"}</button>
          <span className="book-zone">{TZ}</span>
        </div>

        {elsewhere && <p className="book-note">{T.tz(TZ, zone)}</p>}

        <form id="bookq" className="book-form" onSubmit={submit}>
          {slots.length === 0 ? (
            <div className="book-empty">
              <span>{weekend ? T.weekend : T.none}</span>
              {nextDay
                ? <button type="button" className="book-link"
                          onClick={() => setDay(nextDay)}>{T.next} →</button>
                : <span className="book-note">{T.nofree}</span>}
            </div>
          ) : (
            <div role="radiogroup" aria-label={T.head}>
              {group(T.am, slots.filter((s) => hourIn(s, TZ) < 12))}
              {group(T.pm, slots.filter((s) => hourIn(s, TZ) >= 12))}
            </div>
          )}

          <label className="book-f">
            <span>{T.name}</span>
            <input value={name} onInput={(e) => setName(e.currentTarget.value)}
                   autoComplete="name" required />
          </label>
          <label className="book-f">
            <span>{T.contact}</span>
            <input value={contact} onInput={(e) => setContact(e.currentTarget.value)}
                   autoComplete="email" />
          </label>
          <label className="book-f">
            <span>{T.why}</span>
            <textarea rows="2" value={why} placeholder={T.whyPh}
                      onInput={(e) => setWhy(e.currentTarget.value)} />
          </label>
        </form>
      </div>

      <div className="cal-foot" onPointerDown={(e) => e.stopPropagation()}>
        <button type="submit" form="bookq" className="cal-book" disabled={!slot || !name.trim()}>
          {T.send}
        </button>
        {!slot
          ? <span className="book-note">{T.needSlot}</span>
          : !name.trim()
            ? <span className="book-note">{T.needName}</span>
            : <span className="book-sel">{hhmm(slot)}
                <span className="book-note">{T.mins}{elsewhere ? "  ·  " + mineShort(slot) + " " + T.yours : ""}</span>
              </span>}
        <span className="book-sp" />
        <button type="button" className="book-link" onClick={onClose}>{T.cancel}</button>
        {window.SITE_DATA.site.bookingUrl && (
          <a className="book-link" href={window.SITE_DATA.site.bookingUrl}
             target="_blank" rel="noreferrer">{T.official} ↗</a>
        )}
      </div>
    </>
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

      {booking ? (
        <BookingPanel lang={lang} day={picked} setDay={setPicked} events={events}
                      onClose={() => setBooking(false)}
                      onOpenChat={() => { setBooking(false); onOpen && onOpen("chat"); }} />
      ) : (
      <>
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
          <button type="button" className="cal-book" onClick={() => setBooking(true)}>
            <Icon name="calendar" size={16} /> {T.book}
          </button>
          <span className="book-note">{T.why}</span>
        </div>
      )}
      </>
      )}
    </div>
  );
}
