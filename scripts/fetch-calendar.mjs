#!/usr/bin/env node
// scripts/fetch-calendar.mjs
// Pulls the iCal secret URL, filters private events, writes public/calendar.json.
// Run by .github/workflows/calendar.yml once a day (20:00 UTC / 05:00 KST).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// The feed URL lives in src/data.js so the site and this script cannot disagree
// about which calendar is being published. ICAL_URL still overrides it, which is
// how you point at a private feed without editing the repo.
function siteData() {
  const win = {};
  new Function("window", readFileSync("src/data.js", "utf8"))(win);
  return win.SITE_DATA;
}

const ICAL_URL = process.env.ICAL_URL || siteData().site.icalUrl;
if (!ICAL_URL) {
  console.error("no calendar URL: set ICAL_URL or site.icalUrl in src/data.js");
  process.exit(1);
}
console.log(`source: ${process.env.ICAL_URL ? "ICAL_URL env" : "src/data.js site.icalUrl"}`);

// Minimal .ics parser — handles VEVENT blocks with DTSTART/DTEND/SUMMARY/LOCATION/CATEGORIES.
// Good enough for Google Calendar's "private address → iCal" output.
function parseICS(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") { if (cur) events.push(cur); cur = null; }
    else if (cur) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const rawKey = line.slice(0, idx);
      const val = line.slice(idx + 1);
      const key = rawKey.split(";")[0];
      if (key === "DTSTART") cur.start = toISO(rawKey, val);
      else if (key === "DTEND") cur.end = toISO(rawKey, val);
      else if (key === "SUMMARY") cur.title = unescapeICS(val);
      else if (key === "LOCATION") cur.location = unescapeICS(val);
      else if (key === "CATEGORIES") cur.categories = val.split(",");
    }
  }
  return events;
}

function toISO(rawKey, val) {
  // VALUE=DATE → all-day "YYYYMMDD"
  if (/VALUE=DATE/.test(rawKey) && /^\d{8}$/.test(val)) {
    return `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}T00:00:00+09:00`;
  }
  // UTC "YYYYMMDDTHHMMSSZ"
  if (/^\d{8}T\d{6}Z$/.test(val)) {
    return `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}T${val.slice(9,11)}:${val.slice(11,13)}:${val.slice(13,15)}Z`;
  }
  // Local "YYYYMMDDTHHMMSS" — assume KST
  if (/^\d{8}T\d{6}$/.test(val)) {
    return `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}T${val.slice(9,11)}:${val.slice(11,13)}:${val.slice(13,15)}+09:00`;
  }
  return val;
}

function unescapeICS(v) {
  return v.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function tagFor(ev) {
  const title = (ev.title || "").toLowerCase();
  const cats = (ev.categories || []).map(c => c.toLowerCase());
  if (cats.includes("lab") || /lab|seminar|advisor|meeting|미팅|세미나/.test(title)) return "lab";
  if (cats.includes("focus") || /focus|writing|deep work|집중|작성/.test(title)) return "focus";
  if (cats.includes("teach") || /mentor|teach|ta|tutor|멘토|조교/.test(title)) return "teach";
  if (cats.includes("life") || /gym|dinner|lunch|birthday|운동|저녁|점심|생일/.test(title)) return "life";
  return "other";
}

async function fetchWithRetry(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) {
        const wait = 1000 * Math.pow(2, i);
        console.warn(`fetch attempt ${i + 1} failed (${e.message}), retrying in ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

async function main() {
  const ics = await fetchWithRetry(ICAL_URL);
  const raw = parseICS(ics);

  // Keep a wide window and let the browser do the date arithmetic. calendar.js
  // already filters by today for `now`, `cal` and the desktop, so slicing to a
  // few weeks here only made the snapshot go stale the moment it was written.
  // With a year on either side, a sync that does not run degrades gracefully
  // instead of emptying the site.
  const now = new Date();
  const from = new Date(now); from.setFullYear(now.getFullYear() - 1);
  const to   = new Date(now); to.setFullYear(now.getFullYear() + 1);

  const events = raw
    .filter(e => e.start && e.end && e.title)
    // privacy filter: titles tagged [private] or [비공개] are dropped entirely
    .filter(e => !/\[private\]|\[비공개\]/i.test(e.title))
    .map(e => ({
      start: e.start,
      end: e.end,
      title: e.title.replace(/\s*\[(work|personal)\]\s*/gi, "").trim(),
      location: e.location || "",
      tag: tagFor(e),
    }))
    .filter(e => {
      const s = new Date(e.start);
      return s >= from && s <= to;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const out = {
    updated: new Date().toISOString(),
    source: "google-calendar-ical",
    window: "-1y..+1y",
    count: events.length,
    events,
  };

  const path = "public/calendar.json";
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`Wrote ${events.length} events to ${path}`);
}

main().catch(e => { console.error(e); process.exit(1); });
