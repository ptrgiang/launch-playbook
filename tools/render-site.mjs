#!/usr/bin/env node
/**
 * render-site.mjs — generate a self-contained leaderboard page into docs/
 * so GitHub Pages can serve it. Reads data/launches/, data/control/, and
 * data/featured30/ (if present).
 *
 * Usage: node tools/render-site.mjs
 * Then: enable Pages → main → /docs in repo settings (one time).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const load = (dir) =>
  existsSync(join(ROOT, dir))
    ? readdirSync(join(ROOT, dir))
        .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
        .map((f) => JSON.parse(readFileSync(join(ROOT, dir, f), "utf8")))
    : [];

const featured = load("data/launches").sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
const unfeatured = load("data/control").sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
const featured30 = load("data/featured30").sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));

const median = (arr) => {
  const v = arr.map((r) => r.votes ?? 0).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
};

// Simple bucketed distribution for the strip chart.
const buckets = (arr) => {
  const b = [0, 0, 0, 0, 0, 0]; // 0-9,10-24,25-49,50-99,100-249,250+
  for (const r of arr) {
    const v = r.votes ?? 0;
    b[v < 10 ? 0 : v < 25 ? 1 : v < 50 ? 2 : v < 100 ? 3 : v < 250 ? 4 : 5]++;
  }
  return b;
};
const LABELS = ["0-9", "10-24", "25-49", "50-99", "100-249", "250+"];

const stat = (label, value, sub) =>
  `<div class="stat"><div class="v">${value}</div><div class="l">${label}</div><div class="s">${sub}</div></div>`;

const rows = (list, n) =>
  list
    .slice(0, n)
    .map(
      (r, i) =>
        `<tr><td class="rk">${i + 1}</td><td><a href="${r.url}">${r.name}</a></td><td class="num">${r.votes ?? "—"}</td><td class="num">${r.comments ?? "—"}</td><td class="dt">${r.launch_date ?? ""}</td></tr>`
    )
    .join("\n");

const distBlock = (title, arr, color) => {
  const b = buckets(arr);
  const max = Math.max(...b, 1);
  return `<div class="dist"><h3>${title}</h3>${b
    .map(
      (c, i) =>
        `<div class="row"><span class="bl">${LABELS[i]}</span><span class="bar" style="width:${Math.max((c / max) * 100, c ? 2 : 0)}%;background:${color}"></span><span class="bc">${c}</span></div>`
    )
    .join("")}</div>`;
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const safeRows = (list, n) =>
  list
    .slice(0, n)
    .map(
      (r, i) =>
        `<tr><td class="rk">${i + 1}</td><td><a href="${r.url}">${esc(r.name)}</a></td><td class="num">${r.votes ?? "—"}</td><td class="num">${r.comments ?? "—"}</td><td class="dt">${r.launch_date ?? ""}</td></tr>`
    )
    .join("\n");

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PH launch leaderboard — launch-playbook</title>
<meta name="description" content="Top featured Product Hunt launches vs the unfeatured baseline. Auto-generated corpus, refreshed monthly.">
<style>
:root{--bg:#0d1117;--card:#161b22;--bd:#30363d;--tx:#e6edf3;--mut:#8b949e;--acc:#f78166;--grn:#3fb950}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--tx);font:15px/1.5 -apple-system,"Segoe UI",Roboto,sans-serif;padding:32px 16px}
.wrap{max-width:880px;margin:0 auto}
h1{font-size:22px;margin-bottom:4px}
.sub{color:var(--mut);font-size:13px;margin-bottom:24px}
a{color:#58a6ff;text-decoration:none}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:28px}
.stat{background:var(--card);border:1px solid var(--bd);border-radius:8px;padding:14px}
.stat .v{font-size:26px;font-weight:700}
.stat .l{font-size:12px;color:var(--tx);margin-top:2px}
.stat .s{font-size:11px;color:var(--mut);margin-top:2px}
.dists{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:28px}
.dist{background:var(--card);border:1px solid var(--bd);border-radius:8px;padding:14px}
.dist h3{font-size:13px;color:var(--mut);font-weight:600;margin-bottom:10px}
.row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px}
.bl{width:52px;color:var(--mut);text-align:right}
.bar{height:14px;border-radius:3px;min-width:0}
.bc{color:var(--mut)}
h2{font-size:16px;margin:24px 0 8px}
.note{color:var(--mut);font-size:12px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--bd);border-radius:8px;overflow:hidden;font-size:13px}
td,th{padding:8px 10px;border-bottom:1px solid var(--bd);text-align:left}
tr:last-child td{border-bottom:none}
th{color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.rk{color:var(--mut);width:34px}
.num{text-align:right;font-variant-numeric:tabular-nums}
.dt{color:var(--mut);font-size:12px}
.ftr{margin-top:28px;color:var(--mut);font-size:12px;border-top:1px solid var(--bd);padding-top:14px}
</style></head><body><div class="wrap">
<h1>Product Hunt launch leaderboard</h1>
<div class="sub">Featured top-20 vs the unfeatured baseline — from the <a href="https://github.com/ptrgiang/launch-playbook">launch-playbook</a> corpus. Generated ${new Date().toISOString().slice(0, 10)}.</div>

<div class="stats">
${stat("featured floor", featured.at(-1)?.votes ?? "?", "weakest of top 20")}
${stat("unfeatured ceiling", unfeatured[0]?.votes ?? "?", "best of " + unfeatured.length)}
${stat("unfeatured median", median(unfeatured), "votes per launch")}
${stat("unfeatured >100 votes", unfeatured.filter((r) => (r.votes ?? 0) > 100).length, "of " + unfeatured.length)}
${featured30.length ? stat("featured median (30d)", median(featured30), "of " + featured30.length + " launches") : ""}
</div>

<div class="dists">
${distBlock(`Unfeatured launches (n=${unfeatured.length})`, unfeatured, "var(--acc)")}
${featured30.length ? distBlock(`Featured launches, 30d (n=${featured30.length})`, featured30, "var(--grn)") : distBlock(`Featured top-20 (n=${featured.length})`, featured, "var(--grn)")}
</div>

<h2>Top ${featured.length} featured</h2>
<div class="note">Highest-voted launches of the last ~90 days.</div>
<table><tr><th>#</th><th>Launch</th><th style="text-align:right">Votes</th><th style="text-align:right">Comments</th><th>Date</th></tr>
${safeRows(featured, 20)}
</table>

<h2>Top ${Math.min(30, unfeatured.length)} unfeatured</h2>
<div class="note">Highest-voted launches that were never featured, last 30 days. ${unfeatured.length} total in corpus.</div>
<table><tr><th>#</th><th>Launch</th><th style="text-align:right">Votes</th><th style="text-align:right">Comments</th><th>Date</th></tr>
${safeRows(unfeatured, 30)}
</table>

<div class="ftr">Raw data: <a href="https://github.com/ptrgiang/launch-playbook/tree/main/data">data/launches</a> + <a href="https://github.com/ptrgiang/launch-playbook/tree/main/data/control">data/control</a>${featured30.length ? ` + <a href="https://github.com/ptrgiang/launch-playbook/tree/main/data/featured30">data/featured30</a>` : ""}. Methodology &amp; caveats: <a href="https://github.com/ptrgiang/launch-playbook/blob/main/docs/featured-gate.md">docs/featured-gate.md</a>. Refreshed monthly by <code>tools/collect-*.mjs</code>.</div>
</div></body></html>`;

writeFileSync(join(ROOT, "docs/index.html"), html);
writeFileSync(join(ROOT, "docs/.nojekyll"), "");
console.log(`wrote docs/index.html — featured n=${featured.length}, unfeatured n=${unfeatured.length}, featured30 n=${featured30.length}`);
