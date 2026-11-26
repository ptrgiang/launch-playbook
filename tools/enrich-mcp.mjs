#!/usr/bin/env node
/**
 * enrich-mcp.mjs — fill fields the GraphQL API can't give, via the PH MCP
 * server (mcp.producthunt.com, no auth needed for read-only tools):
 *
 *   maker_comment_shape / maker_comment_excerpt — real badge-tagged maker
 *     comments (GraphQL redacts commenter identity; MCP returns author +
 *     badges including "maker"/"hunter")
 *   points, daily_rank — PH's official score and rank
 *   funding_usd, funding_rounds, is_bootstrapped, investors
 *   yc, rating, reviews_count, launches_total
 *
 * Launch ids come from one aliased GraphQL query: post(slug){id}.
 *
 * Usage:
 *   node tools/enrich-mcp.mjs --token-file <path> [--control 30] [--only-comments]
 *   --control N   also enrich top N unfeatured records (default 30, 0 to skip)
 *   --only-comments   skip the search_products pass (funding/rank/yc)
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MCP = "https://mcp.producthunt.com/mcp";
const GQL = "https://api.producthunt.com/v2/api/graphql";
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const TOKEN = readFileSync(arg("--token-file", "ph-token.txt"), "utf8").trim();
const CONTROL_N = Number(arg("--control", 30));
const ONLY_COMMENTS = process.argv.includes("--only-comments");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mcp(method, params) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const t = await res.text();
  const dl = t.split("\n").find((l) => l.startsWith("data:"));
  return dl ? JSON.parse(dl.slice(5)) : JSON.parse(t);
}

await mcp("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "enrich", version: "0.1" } });
await mcp("notifications/initialized", {});

async function mcpCall(name, args, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await mcp("tools/call", { name, arguments: args });
      if (r?.result?.isError) return { error: r.result.content?.[0]?.text || "tool error" };
      const sc = r?.result?.structuredContent?.data;
      if (sc) return sc;
      const blob = r?.result?.content?.[1]?.text;
      if (blob) return JSON.parse(blob).data ?? JSON.parse(blob);
      return { error: "empty response" };
    } catch (e) {
      if (i === tries - 1) return { error: String(e) };
      await sleep(1000 * (i + 1));
    }
  }
}

async function gql(query, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ query }),
    });
    const d = await res.json();
    if (!d.errors) return d.data;
    const reset = d.errors[0]?.details?.reset_in ?? 60;
    console.log(`gql rate-limited, waiting ${reset + 5}s`);
    await sleep((reset + 5) * 1000);
  }
  return null;
}

const shape = (body) => (!body ? "none" : body.length < 200 ? "short" : body.length > 1200 ? "long" : "standard");

// ---- load corpora ----
const loadDir = (dir) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => ({ file: join(ROOT, dir, f), rec: JSON.parse(readFileSync(join(ROOT, dir, f), "utf8")) }));

const featured = loadDir("data/launches");
const control = loadDir("data/control")
  .sort((a, b) => (b.rec.votes ?? 0) - (a.rec.votes ?? 0))
  .slice(0, CONTROL_N);
const all = [...featured.map((x) => ({ ...x, set: "featured" })), ...control.map((x) => ({ ...x, set: "control" }))];
console.log(`enriching ${all.length} launches (${featured.length} featured + ${control.length} control)`);

// ---- resolve launch ids via one aliased GraphQL query (skip cached ph_id) ----
const needIds = all.filter((x) => !x.rec.ph_id);
const ids = {};
if (needIds.length) {
  const aliases = needIds.map((x, i) => `p${i}: post(slug: "${x.rec.slug}") { id }`).join("\n");
  const idData = await gql(`{ ${aliases} }`);
  needIds.forEach((x, i) => {
    const id = idData?.[`p${i}`]?.id;
    if (id) ids[x.rec.slug] = String(id);
  });
}
console.log(`resolved ${Object.keys(ids).length}/${needIds.length} new launch ids (${all.length - needIds.length} cached)`);

// ---- per-launch enrichment ----
let done = 0;
for (const { file, rec, set } of all) {
  const out = { ...rec };
  const launchId = rec.ph_id ?? ids[rec.slug];
  if (ids[rec.slug]) out.ph_id = ids[rec.slug];

  if (launchId) {
    let comments = [];
    const page = await mcpCall("list_comments", { type: "launch", id: launchId, limit: 50, order: "best" });
    if (page.error) console.log(`  ${rec.slug}: comments error — ${page.error}`);
    if (!page.error) {
      comments = page.comments ?? [];
      if (!comments.some((c) => (c.badges || []).some((b) => ["maker", "hunter"].includes(b))) && page.next_cursor) {
        const p2 = await mcpCall("list_comments", { type: "launch", id: launchId, limit: 50, order: "best", cursor: page.next_cursor });
        if (!p2.error) comments = comments.concat(p2.comments ?? []);
      }
    }
    const staff = comments.filter((c) => (c.badges || []).some((b) => ["maker", "hunter"].includes(b)));
    const prefer = (b) => staff.filter((c) => (c.badges || []).includes(b)).sort((a, z) => (z.votes_count ?? 0) - (a.votes_count ?? 0));
    const top = prefer("maker")[0] ?? prefer("hunter")[0];
    if (top) {
      out.maker_comment_shape = shape(top.body);
      out.maker_comment_excerpt = (top.body || "").replace(/\s+/g, " ").trim().slice(0, 500);
      out.maker_comment_votes = top.votes_count ?? 0;
      out.maker_comment_count = staff.length;
      out.maker_comment_by = (top.badges || []).includes("maker") ? "maker" : "hunter";
    } else {
      out.maker_comment_shape = "none";
      out.maker_comment_excerpt = null;
    }
    await sleep(250);
  }

  if (!ONLY_COMMENTS) {
    const s = await mcpCall("search_products", { query: rec.slug.replace(/-/g, " ") });
    const hit = (s?.results ?? []).find((r) => r.slug === rec.slug);
    if (hit) {
      const L = (hit.launches ?? []).find((l) => l.slug === rec.slug) ?? hit.launches?.[0];
      out.points = L?.points ?? hit.top_launch_points ?? null;
      out.daily_rank = L?.daily_rank ?? null;
      out.launches_total = hit.launches_total ?? null;
      out.yc = hit.yc ?? null;
      out.rating = hit.rating ?? null;
      out.reviews_count = hit.reviews_count ?? null;
      out.open_source = hit.open_source ?? null;
      out.pricing = hit.pricing ?? null;
      out.funding_usd = hit.funding?.total_raised_usd ?? null;
      out.funding_rounds = hit.funding?.rounds_count ?? null;
      out.is_bootstrapped = hit.funding?.is_bootstrapped ?? null;
      out.investors = hit.funding?.notable_investors ?? null;
    }
    await sleep(250);
  }

  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  done++;
  if (done % 10 === 0 || done === all.length) console.log(`  ${done}/${all.length}`);
}

// ---- summary ----
const sum = (arr, f) => arr.filter((r) => r[f] != null).map((r) => r[f]);
const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? null;
const report = (name, list) => {
  const recs = list.map((x) => JSON.parse(readFileSync(x.file, "utf8")));
  const fund = sum(recs, "funding_usd").filter((v) => v > 0);
  console.log(`\n== ${name} (n=${recs.length}) ==`);
  console.log(` funded: ${fund.length}/${recs.length} | median raise: ${med(fund) ? "$" + (med(fund) / 1e6).toFixed(1) + "M" : "n/a"}`);
  console.log(` yc: ${recs.filter((r) => r.yc).length} | maker comments: ${recs.filter((r) => r.maker_comment_shape && r.maker_comment_shape !== "none").length}/${recs.length} (by maker: ${recs.filter((r) => r.maker_comment_by === "maker").length}, hunter: ${recs.filter((r) => r.maker_comment_by === "hunter").length})`);
  const shapes = {};
  recs.forEach((r) => (shapes[r.maker_comment_shape] = (shapes[r.maker_comment_shape] || 0) + 1));
  console.log(` comment shapes: ${JSON.stringify(shapes)}`);
};
report("featured top-20", featured);
if (control.length) report("unfeatured top-" + control.length, control);
