#!/usr/bin/env node
// Build script — bundles src/main.jsx with esbuild, copies static assets to dist/.
// Run: `npm run build` (one-shot) or `npm run dev` (watch).

import { build, context } from "esbuild";
import { mkdirSync, copyFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const OUT = "dist";

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

function copyStatic() {
  mkdirSync(OUT, { recursive: true });
  copyFileSync("index.html", `${OUT}/index.html`);
  copyFileSync("src/styles.css", `${OUT}/styles.css`);
  if (existsSync("CNAME")) copyFileSync("CNAME", `${OUT}/CNAME`);
  // flatten public/* into dist/ so /calendar.json, /cv/... resolve from site root
  copyDir("public", OUT);
  // GitHub Pages skips paths starting with _ unless .nojekyll exists
  writeFileSync(`${OUT}/.nojekyll`, "");
}

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
