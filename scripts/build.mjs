#!/usr/bin/env node
// Build script: bundles src/main.jsx with esbuild, copies static assets to dist/.
// Run: `npm run build` (one-shot) or `npm run dev` (watch).

import { build, context } from "esbuild";
import { mkdirSync, copyFileSync, readdirSync, statSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = "dist";

// Injected into the bundle so the footer year and "updated" date track the deploy
// instead of being hand-maintained in data.js.
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// Papers are real files under public/papers, so the list is whatever is on disk
// rather than a second copy of it in data.js that can drift. Drop a PDF in, rebuild,
// and it shows up in ~/papers and opens in the viewer.
const PAPERS = existsSync("public/papers")
  ? readdirSync("public/papers").filter((f) => f.toLowerCase().endsWith(".pdf")).sort()
  : [];



const esbuildOpts = {
  entryPoints: ["src/main.jsx"],
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ["es2020", "chrome100", "safari15", "firefox100"],
  format: "iife",
  outfile: `${OUT}/app.js`,
  jsx: "automatic",
  jsxImportSource: "preact",
  alias: {
    "react": "preact/compat",
    "react-dom": "preact/compat",
    "react/jsx-runtime": "preact/jsx-runtime",
  },
  loader: { ".jsx": "jsx", ".js": "js" },
  define: {
    __BUILD_DATE__: JSON.stringify(BUILD_DATE),
    __PAPERS__: JSON.stringify(PAPERS),
  },
  logLevel: "info",
};

function copyDir(src, dst) {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const sp = join(src, name);
    const dp = join(dst, name);
    if (statSync(sp).isDirectory()) copyDir(sp, dp);
    else copyFileSync(sp, dp);
  }
}

// Crawlers and link-preview scrapers get `<div id="root"></div>` and nothing else
// from a client-rendered page. This reads src/data.js the same way the browser does
// and bakes a plain-HTML version of the content into the shipped index.html. The app
// hides it via the `js` class the moment scripting is available, so a real visitor
// never sees it and it costs nothing at runtime.
function siteData() {
  const src = readFileSync("src/data.js", "utf8");
  const win = {};
  new Function("window", src)(win);
  return win.SITE_DATA;
}

const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fallbackHtml() {
  const D = siteData();
  const p = D.profile;
  const li = (items) => `<ul>${items.map(x => `<li>${x}</li>`).join("")}</ul>`;
  const sections = [
    `<h1>${esc(p.name_ko)} (${esc(p.name_en)})</h1>`,
    `<p>${esc(p.role_ko)} · ${esc(p.affiliation_ko)}</p>`,
    `<p>${esc(p.role_en)} · ${esc(p.affiliation_en)}</p>`,
    `<p>${esc(p.location_ko)} / ${esc(p.location_en)}</p>`,

    `<h2>연구 관심사 / Research interests</h2>`,
    li(D.research.map(r =>
      `<b>${esc(r.tag)}</b> ${esc(r.title_ko)} (${esc(r.title_en)}): ${esc(r.blurb_ko)} ${esc(r.blurb_en)}`)),

    `<h2>프로젝트 / Projects</h2>`,
    li(D.projects.map(x => {
      const url = x.url || `https://github.com/${D.site.github}/${x.slug}`;
      return `<a href="${esc(url)}">${esc(x.title_ko)} (${esc(x.title_en)})</a>, ${esc(x.year)}: ${esc(x.summary_ko)} ${esc(x.summary_en)}`;
    })),

    `<h2>논문 / Publications</h2>`,
    li(D.publications.map(x => `${esc(x.year)} ${esc(x.venue)}: ${esc(x.title_ko)} (${esc(x.title_en)}) - ${esc(x.role)}`)),

    `<h2>특허 / Patents</h2>`,
    li((D.patents || []).map(x =>
      `${esc(x.year)} ${esc(x.title_ko)} (${esc(x.title_en)}) - ${esc(x.status_ko)}`)),

    `<h2>경력 · 학력 / Experience</h2>`,
    li(D.experience.map(e => `${esc(e.when)} ${esc(e.what_ko)} (${esc(e.what_en)}), ${esc(e.where_ko)}`)),

    `<h2>스킬 / Skills</h2>`,
    li(Object.entries(D.skills).map(([k, v]) => `${esc(k)}: ${esc(v.join(", "))}`)),

    `<h2>연락처 / Contact</h2>`,
    li([
      `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`,
      `<a href="https://github.com/${esc(p.github)}">github.com/${esc(p.github)}</a>`,
      `<a href="https://linkedin.com/in/${esc(p.linkedin)}">linkedin</a>`,
      `<a href="${esc(D.site.tilUrl)}">${esc(D.site.til)}</a>`,
      `<a href="${esc(D.site.bookingUrl)}">시간 예약 / Book a time</a>`,
      `<a href="${esc(D.site.cvKo)}">CV (한국어)</a>`,
      `<a href="${esc(D.site.cvEn)}">CV (English)</a>`,
    ]),
  ];
  return sections.join("\n");
}

function copyStatic() {
  mkdirSync(OUT, { recursive: true });
  const html = readFileSync("index.html", "utf8").replace("<!--FALLBACK-->", fallbackHtml());
  writeFileSync(`${OUT}/index.html`, html);
  copyFileSync("src/styles.css", `${OUT}/styles.css`);
  if (existsSync("CNAME")) copyFileSync("CNAME", `${OUT}/CNAME`);
  // flatten public/* into dist/ so /calendar.json, /cv/... resolve from site root
  copyDir("public", OUT);
  // GitHub Pages skips paths starting with _ unless .nojekyll exists
  writeFileSync(`${OUT}/.nojekyll`, "");
  writeSitemap();
}

// Single-page site, so the sitemap is one URL. Generated rather than committed so
// lastmod tracks the actual deploy instead of going stale in the repo.
function writeSitemap() {
  if (!existsSync("CNAME")) return;
  const domain = readFileSync("CNAME", "utf8").trim();
  if (!domain) return;
  const lastmod = BUILD_DATE;
  writeFileSync(`${OUT}/sitemap.xml`,
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${domain}/</loc>
    <lastmod>${lastmod}</lastmod>
  </url>
</urlset>
`);
}

export { fallbackHtml, siteData };

// Only build when run as a script. Importing this file (the smoke test pulls
// fallbackHtml out of it) must not kick off a build as a side effect.
const runAsScript = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (runAsScript) {
  const watch = process.argv.includes("--watch");
  copyStatic();
  if (watch) {
    const ctx = await context(esbuildOpts);
    await ctx.watch();
    console.log("watching src/...");
  } else {
    await build(esbuildOpts);
    console.log(`built → ${OUT}/`);
  }
}
