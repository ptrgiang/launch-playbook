#!/usr/bin/env node
/**
 * collect-control.mjs — pull a control set of UNFEATURED launches from the
 * same window, for baseline comparison against the featured top-N corpus.
 *
 * Answers: "did any unfeatured launch crack the top?" and "how do the best
 * unfeatured launches differ in votes/comments/taglines?"
 *
 * Usage:
 *   node tools/collect-control.mjs --days 90 --limit 30 --token-file <path>
 *   PH_API_TOKEN=xxx node tools/collect-control.mjs --days 90
 *
 * Output: data/control/<slug>.json + data/control/_index.json
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data", "control");
const API_URL = "https://api.producthunt.com/v2/api/graphql";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const DAYS = Number(arg("days", 90));
const OFFSET = Number(arg("offset", 0)); // skip newest N days
const LIMIT = Number(arg("limit", 30));
const TOKEN_FILE = arg("token-file", null);
const TOKEN =
  process.env.PH_API_TOKEN ||
  arg("token", null) ||
  (TOKEN_FILE ? readFileSync(TOKEN_FILE, "utf8").trim() : null);

const log = (...m) => console.log(...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function pstDayBoundsUTC(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 8, 0, 0));
  return [start.toISOString(), new Date(start.getTime() + 86_400_000).toISOString()];
}

async function fetchJson(url, opts = {}, retries = 6) {
  const res = await fetch(url, {
    ...opts,
    headers: { "User-Agent": UA, Accept: "application/json", ...(opts.headers || {}) },
  });
  if (res.status === 429 && retries > 0) {
    let wait = 30_000 * (7 - retries);
    try {
      const body = await res.json();
      const first = Array.isArray(body) ? body[0] : body;
      const resetIn = first?.details?.reset_in;
      if (typeof resetIn === "number" && resetIn > 0) wait = resetIn * 1000 + 3000;
    } catch {}
    log(`  rate-limited, waiting ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return fetchJson(url, opts, retries - 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

const FIELDS = `id name slug tagline url votesCount commentsCount createdAt featuredAt`;

async function gql(query, variables) {
  const data = await fetchJson(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (data.errors) throw new Error(JSON.stringify(data.errors[0]));
  return data.data;
}

function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long" });
}

function classifyTagline(t) {
  const s = (t || "").trim();
  if (!s) return null;
  if (/\bwithout\b/i.test(s)) return "contrast";
  if (/\d/.test(s)) return "number-led";
  if (/^(turn|make|build|ship|launch|create|design|track|automate|generate|write|find|get|stop|cut|record|plan|kill|fix|grow|learn|read)\b/i.test(s))
    return "verb-first";
  if (/\bfor\b/i.test(s)) return "outcome-for-audience";
  return "other";
}

function toRecord(n) {
  const dateStr = pstFormatter.format(new Date(n.createdAt));
  return {
    name: n.name,
    slug: n.slug,
    url: `https://www.producthunt.com/products/${n.slug}`,
    launch_date: dateStr,
    day_of_week: dayOfWeek(dateStr),
    tagline: n.tagline || null,
    tagline_formula: classifyTagline(n.tagline),
    rank_in_unfeatured: null, // set after global sort
    votes: n.votesCount ?? null,
    comments: n.commentsCount ?? null,
    featured: false,
    source: "api",
  };
}

// NOTE: posts(featured:false) is silently ignored by the API (returns featured
// posts anyway), and order:VOTES paging is heavily biased toward featured
// launches (800 top posts → 1 unfeatured). The reliable control set is day
// iteration: every post of every day, filtered client-side.
// Records are written incrementally so a mid-run kill still keeps raw data.
const FEATURED_DIR = join(ROOT, "data", "featured30");
const COLLECT_ALL = args.includes("--all");

async function collectUnfeatured(days, seen, seenFeatured) {
  const unfeatured = [];
  let total = 0;
  for (const dateStr of days) {
    const [after, before] = pstDayBoundsUTC(dateStr);
    try {
      let cursor = null;
      for (let page = 0; page < 6; page++) {
        const data = await gql(
          `query($after: DateTime, $before: DateTime, $first: Int, $cursor: String) {
            posts(postedAfter: $after, postedBefore: $before, first: $first, after: $cursor) {
              edges { node { ${FIELDS} } }
              pageInfo { hasNextPage endCursor }
            }
          }`,
          { after, before, first: 50, cursor }
        );
        const conn = data.posts;
        total += conn.edges.length;
        for (const e of conn.edges) {
          const isFeatured = e.node.featuredAt != null;
          const dir = isFeatured ? FEATURED_DIR : OUT_DIR;
          const seenSet = isFeatured ? seenFeatured : seen;
          if ((COLLECT_ALL || !isFeatured) && !seenSet.has(e.node.slug)) {
            seenSet.add(e.node.slug);
            if (!isFeatured) unfeatured.push(e.node);
            const rec = toRecord(e.node);
            rec.featured = isFeatured;
            writeFileSync(join(dir, `${e.node.slug}.json`), JSON.stringify(rec, null, 2) + "\n");
          }
        }
        if (!conn.pageInfo.hasNextPage) break;
        cursor = conn.pageInfo.endCursor;
        await sleep(1500);
      }
      log(`  ${dateStr}: done (${seen.size} unfeatured${COLLECT_ALL ? `, ${seenFeatured.size} featured` : ""} total)`);
    } catch (e) {
      log(`  ${dateStr}: FAIL ${e.message.slice(0, 80)}`);
    }
    await sleep(1500);
  }
  log(`  scanned ${total} posts this run`);
  return unfeatured;
}

async function main() {
  if (!TOKEN) {
    log("need PH_API_TOKEN (env, --token, or --token-file)");
    process.exit(1);
  }
  const days = [];
  for (let i = OFFSET; i < OFFSET + DAYS; i++) {
    days.push(pstFormatter.format(new Date(Date.now() - i * 86_400_000)));
  }
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(FEATURED_DIR, { recursive: true });
  // Resume-safe: slugs already on disk are skipped, so reruns don't rescan
  // the same launches (the day query still runs — API has no per-day resume).
  const { readdirSync } = await import("node:fs");
  const loadSeen = (dir) =>
    new Set(readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => f.replace(/\.json$/, "")));
  const seen = loadSeen(OUT_DIR);
  const seenFeatured = loadSeen(FEATURED_DIR);
  log(`collect-control: ${days[days.length - 1]} → ${days[0]}, top ${LIMIT} (${seen.size} unfeatured${COLLECT_ALL ? `, ${seenFeatured.size} featured` : ""} already on disk)`);

  await collectUnfeatured(days, seen, seenFeatured);

  // Rebuild index from ALL records on disk (this run + previous runs).
  const { readFileSync: rf } = await import("node:fs");
  const records = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => JSON.parse(rf(join(OUT_DIR, f), "utf8")))
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const index = records.map((rec, i) => {
    rec.rank_in_unfeatured = i + 1;
    writeFileSync(join(OUT_DIR, `${rec.slug}.json`), JSON.stringify(rec, null, 2) + "\n");
    return { slug: rec.slug, name: rec.name, rank: rec.rank_in_unfeatured, votes: rec.votes, comments: rec.comments, launch_date: rec.launch_date, day_of_week: rec.day_of_week, tagline_formula: rec.tagline_formula };
  });
  writeFileSync(join(OUT_DIR, "_index.json"), JSON.stringify(index, null, 2) + "\n");

  const max = records.length ? records[0].votes : 0;
  log(`\n${records.length} unfeatured launches on disk → data/control/`);
  log(`  top unfeatured votes: ${max} — compare with featured top-20 floor (~450)`);
}

main().catch((e) => {
  console.error(`collect-control failed: ${e.message}`);
  process.exit(1);
});
