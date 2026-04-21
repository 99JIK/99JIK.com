// Calendar loader. Fetches public/calendar.json (built hourly by GH Actions from ICAL_URL).
// Gracefully falls back to an embedded mock so local dev always works.
(function () {
  const MOCK = {
    updated: new Date().toISOString(),
    source: "mock",
    events: [
      { start: isoAt(0, 10, 0),  end: isoAt(0, 11, 30), title: "Advisor 1:1",              location: "IT-3 421",       tag: "lab" },
      { start: isoAt(0, 14, 0),  end: isoAt(0, 15, 0),  title: "Paper reading — ICSE'25",   location: "zoom",           tag: "lab" },
      { start: isoAt(0, 19, 0),  end: isoAt(0, 20, 30), title: "Gym",                       location: "",               tag: "life" },
      { start: isoAt(1,  9, 30), end: isoAt(1, 11, 0),  title: "Lab seminar",               location: "IT-3 507",       tag: "lab" },
      { start: isoAt(1, 13, 0),  end: isoAt(1, 14, 0),  title: "Writing block — LLM oracle",location: "",               tag: "focus" },
      { start: isoAt(2, 15, 0),  end: isoAt(2, 16, 30), title: "Mentoring — undergrad",     location: "online",         tag: "teach" },
      { start: isoAt(3, 11, 0),  end: isoAt(3, 12, 0),  title: "TIL review",                location: "",               tag: "focus" },
      { start: isoAt(4, 18, 0),  end: isoAt(4, 21, 0),  title: "Dinner w/ lab",             location: "북구 복현동",     tag: "life" },
      { start: isoAt(6, 10, 0),  end: isoAt(6, 18, 0),  title: "Deep work — SLM fuzzer",    location: "",               tag: "focus" },
    ],
  };

  function isoAt(dayOffset, h, m) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  let CACHE = null;

  async function load() {
    if (CACHE) return CACHE;
    try {
      const r = await fetch("calendar.json", { cache: "no-store" });
      if (!r.ok) throw new Error("no file");
      const j = await r.json();
      if (!j.events || !Array.isArray(j.events)) throw new Error("bad shape");
      CACHE = j;
    } catch (e) {
      // Only on real fetch/parse failure — preserves empty state when data is valid but empty.
      CACHE = MOCK;
    }
    return CACHE;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function getToday(data) {
    const today = new Date();
    return data.events
      .map(e => ({ ...e, _start: new Date(e.start), _end: new Date(e.end) }))
      .filter(e => sameDay(e._start, today))
      .sort((a, b) => a._start - b._start);
  }

  function getWeek(data) {
    const now = new Date();
    const start = new Date(now); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    return data.events
      .map(e => ({ ...e, _start: new Date(e.start), _end: new Date(e.end) }))
      .filter(e => e._start >= start && e._start < end)
      .sort((a, b) => a._start - b._start);
  }

  function getMonth(data) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return data.events
      .map(e => ({ ...e, _start: new Date(e.start), _end: new Date(e.end) }))
      .filter(e => e._start >= start && e._start < end)
      .sort((a, b) => a._start - b._start);
  }

  function fmtTime(d) {
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  function fmtDay(d, lang) {
    const days_ko = ["일","월","화","수","목","금","토"];
    const days_en = ["sun","mon","tue","wed","thu","fri","sat"];
    const D = lang === "en" ? days_en : days_ko;
    return `${d.getMonth()+1}/${d.getDate()} ${D[d.getDay()]}`;
  }

  function relativeAgo(iso, lang) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return lang === "en" ? "just now" : "방금 전";
    if (diff < 3600) return lang === "en" ? `${Math.round(diff/60)}m ago` : `${Math.round(diff/60)}분 전`;
    if (diff < 86400) return lang === "en" ? `${Math.round(diff/3600)}h ago` : `${Math.round(diff/3600)}시간 전`;
    return lang === "en" ? `${Math.round(diff/86400)}d ago` : `${Math.round(diff/86400)}일 전`;
  }

  window.CALENDAR = { load, getToday, getWeek, getMonth, fmtTime, fmtDay, relativeAgo };
})();
