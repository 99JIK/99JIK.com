// The calendar, as a window rather than as a command.
//
// The month grid is drawn from the same data `now` reads, so it cannot disagree
// with the terminal. Booking is the one thing that leaves: calendar.app.google
// sends X-Frame-Options: SAMEORIGIN, so the booking page cannot be put in an
// iframe and the button opens it in a real tab instead of pretending.

import * as React from "preact/compat";
import { Icon } from "./icons.jsx";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function CalendarApp({ lang, wm }) {
  const [data, setData] = React.useState(null);
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [picked, setPicked] = React.useState(() => new Date());

  React.useEffect(() => {
    let dead = false;
    window.CALENDAR.load().then((d) => { if (!dead) setData(d); });
    return () => { dead = true; };
  }, []);

  const T = lang === "en" ? {
    title: "Calendar", today: "today", book: "Book a time",
    none: "nothing on this day", failed: "the calendar could not be read",
    loading: "loading...", live: "live", why: "opens in a new tab: Google will not allow this page in a frame",
  } : {
    title: "달력", today: "오늘", book: "약속 잡기",
    none: "이 날은 비어 있습니다", failed: "캘린더를 불러오지 못했습니다",
    loading: "불러오는 중...", live: "실시간", why: "새 탭에서 열립니다. 구글이 이 페이지를 프레임에 넣지 못하게 막습니다",
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
  const bookUrl = window.SITE_DATA.site.bookingUrl;

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

      {bookUrl && (
        <div className="cal-foot" onPointerDown={(e) => e.stopPropagation()}>
          <a className="cal-book" href={bookUrl} target="_blank" rel="noreferrer">
            <Icon name="calendar" size={16} /> {T.book}
          </a>
          <span className="set-note">{T.why}</span>
        </div>
      )}
    </div>
  );
}
