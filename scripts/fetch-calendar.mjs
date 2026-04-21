#!/usr/bin/env node
// scripts/fetch-calendar.mjs
// Pulls the iCal secret URL, filters private events, writes public/calendar.json.
// Run by .github/workflows/calendar.yml hourly.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const ICAL_URL = process.env.ICAL_URL;
if (!ICAL_URL) {
  console.error("ICAL_URL env var missing");
  process.exit(1);
}

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

  const horizonStart = new Date(); horizonStart.setDate(horizonStart.getDate() - 1); horizonStart.setHours(0,0,0,0);
  const horizonEnd = new Date();   horizonEnd.setDate(horizonEnd.getDate() + 45);

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
      return s >= horizonStart && s <= horizonEnd;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const out = {
    updated: new Date().toISOString(),
    source: "google-calendar-ical",
    horizon_days: 45,
    count: events.length,
    events,
  };

  const path = "public/calendar.json";
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`Wrote ${events.length} events to ${path}`);
}

main().catch(e => { console.error(e); process.exit(1); });
