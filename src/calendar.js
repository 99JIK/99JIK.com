// Calendar loader. Reads the Google Calendar API directly when a browser key is
// configured, falls back to the public/calendar.json snapshot the deploy refreshes,
// and falls back again to the mock below so local development always has something.
// The mock is deliberately generic: it stands in for a calendar, and inventing
// specific work here would put words in the owner's mouth.
(function () {
  const MOCK = {
    updated: new Date().toISOString(),
    source: "mock",
    events: [
      { start: isoAt(0, 10, 0),  end: isoAt(0, 11, 30), title: "Advisor 1:1",              location: "IT-3 421",       tag: "lab" },
      { start: isoAt(0, 14, 0),  end: isoAt(0, 15, 0),  title: "Paper reading: ICSE'25",   location: "zoom",           tag: "lab" },
      { start: isoAt(0, 19, 0),  end: isoAt(0, 20, 30), title: "Gym",                       location: "",               tag: "life" },
      { start: isoAt(1,  9, 30), end: isoAt(1, 11, 0),  title: "Lab seminar",               location: "IT-3 507",       tag: "lab" },
      { start: isoAt(1, 13, 0),  end: isoAt(1, 14, 0),  title: "Writing block",             location: "",               tag: "focus" },
      { start: isoAt(2, 15, 0),  end: isoAt(2, 16, 30), title: "Mentoring: undergrad",     location: "online",         tag: "teach" },
      { start: isoAt(3, 11, 0),  end: isoAt(3, 12, 0),  title: "TIL review",                location: "",               tag: "focus" },
      { start: isoAt(4, 18, 0),  end: isoAt(4, 21, 0),  title: "Dinner w/ lab",             location: "북구 복현동",     tag: "life" },
      { start: isoAt(6, 10, 0),  end: isoAt(6, 18, 0),  title: "Deep work",                 location: "",               tag: "focus" },
    ],
  };

  function isoAt(dayOffset, h, m) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  let CACHE = null;

  // Same rules the sync script uses, so live and snapshot data get tagged alike.
  //
  // The calendar already labels most entries with a bracket prefix ([수업], [TA],
  // [Seminar]), so that is read first: it is the owner's own classification and it
  // beats guessing from keywords. The keyword pass only catches what has no prefix.
  const PREFIX_TAG = {
    "수업": "class", "class": "class", "강의": "class",
    "ta": "teach", "멘토": "teach", "조교": "teach",
    "seminar": "lab", "세미나": "lab", "lab": "lab", "미팅": "lab",
  };

  function tagFor(title) {
    const raw = String(title || "");
    const m = /^\s*\[([^\]]+)\]/.exec(raw);
    if (m) {
      const tag = PREFIX_TAG[m[1].trim().toLowerCase()];
      if (tag) return tag;
    }
    const t = raw.toLowerCase();
    if (/seminar|advisor|meeting|미팅|세미나|lab/.test(t)) return "lab";
    if (/focus|writing|deep work|집중|작성/.test(t)) return "focus";
    // ta, not `ta`: the bare substring matched any word containing those letters.
    if (/mentor|teach|tutor|ta|멘토|조교/.test(t)) return "teach";
    if (/exam|시험|수업|강의/.test(t)) return "class";
    if (/gym|dinner|lunch|birthday|운동|저녁|점심|생일/.test(t)) return "life";
    return "other";
  }

  const isPrivate = (title) =>
    String(title).includes("[private]") || String(title).includes("[비공개]");

  // Google's iCal endpoint sends no CORS headers, but the Calendar API does. Given a
  // browser key the page reads the calendar directly and nothing needs syncing.
  async function fromApi(id, key) {
    const now = new Date();
    const min = new Date(now); min.setFullYear(now.getFullYear() - 1);
    const max = new Date(now); max.setFullYear(now.getFullYear() + 1);
    const u = new URL("https://www.googleapis.com/calendar/v3/calendars/" +
                      encodeURIComponent(id) + "/events");
    u.searchParams.set("key", key);
    u.searchParams.set("singleEvents", "true");
    u.searchParams.set("orderBy", "startTime");
    u.searchParams.set("maxResults", "250");
    u.searchParams.set("timeMin", min.toISOString());
    u.searchParams.set("timeMax", max.toISOString());

    const r = await fetch(u.toString(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const events = (j.items || [])
      .filter(e => e.summary && e.start)
      .filter(e => !isPrivate(e.summary))
      .map(e => ({
        // All-day events carry `date`; timed ones carry `dateTime`.
        start: e.start.dateTime || (e.start.date + "T00:00:00+09:00"),
        end: (e.end && (e.end.dateTime || (e.end.date && e.end.date + "T00:00:00+09:00")))
             || e.start.dateTime || (e.start.date + "T23:59:59+09:00"),
        title: String(e.summary).replace(/\s*\[(work|personal)\]\s*/gi, "").trim(),
        location: e.location || "",
        tag: tagFor(e.summary),
      }));
    return {
      updated: new Date().toISOString(),
      source: "google-calendar-api", live: true,
      count: events.length, events,
    };
  }

  async function load() {
    if (CACHE) return CACHE;
    const site = window.SITE_DATA.site;
    // Live first when a key is configured. The committed snapshot stays as the
    // fallback so a bad key or a quota problem degrades instead of emptying it.
    if (site.gcalApiKey && site.calendarId) {
      try { CACHE = await fromApi(site.calendarId, site.gcalApiKey); return CACHE; }
      catch (e) { /* fall through to the snapshot */ }
    }
    try {
      const r = await fetch("calendar.json", { cache: "no-store" });
      if (!r.ok) throw new Error("no file");
      const j = await r.json();
      if (!j.events || !Array.isArray(j.events)) throw new Error("bad shape");
      CACHE = j;
    } catch (e) {
      // Only on real fetch/parse failure - preserves empty state when data is valid but empty.
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

  // Synchronous read of whatever load() already fetched. `cal` marks busy days with
  // it and simply marks nothing when the feed has not arrived yet.
  const peek = () => CACHE;

  window.CALENDAR = { load, peek, getToday, getWeek, getMonth, fmtTime, fmtDay, relativeAgo };
})();
