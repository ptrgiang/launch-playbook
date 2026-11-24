#!/usr/bin/env node
/**
 * collect-launches.mjs — build the data/launches/ corpus from Product Hunt.
 *
 * Two collectors:
 *   1. Official GraphQL API v2  — needs PH_API_TOKEN (free developer token:
 *      producthunt.com → your profile → API Dashboard → create an app → token)
 *   2. Scrape                   — parses __NEXT_DATA__ from daily leaderboard
 *      pages. No token needed, but PH bot protection may block it.
 *
 * Usage:
 *   PH_API_TOKEN=xxx  node tools/collect-launches.mjs --days 90 --limit 50
 *   node tools/collect-launches.mjs --days 30 --scrape-only
 *
 * Output: data/launches/<slug>.json + data/launches/_index.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data", "launches");

const API_URL = "https://api.producthunt.com/v2/api/graphql";
const SITE = "https://www.producthunt.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ---------- CLI args ----------

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const DAYS = Number(arg("days", 90));
const LIMIT = Number(arg("limit", 50));
const SCRAPE_ONLY = args.includes("--scrape-only");
const VERBOSE = args.includes("--verbose");
const TOKEN = process.env.PH_API_TOKEN || arg("token", null);

const log = (...m) => console.log(...m);
const dbg = (...m) => VERBOSE && console.log("  ·", ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- shared fetch ----------

async function fetchJson(url, opts = {}, retries = 1) {
  const res = await fetch(url, {
    ...opts,
    headers: { "User-Agent": UA, Accept: "application/json", ...(opts.headers || {}) },
  });
  if (res.status === 429 && retries > 0) {
    log("  rate-limited, backing off 10s");
    await sleep(10_000);
    return fetchJson(url, opts, retries - 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// ---------- dates (PH days run on Pacific time) ----------

const pstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function todayPST() {
  return pstFormatter.format(new Date()); // en-CA → YYYY-MM-DD
}

function pstDaysBack(n) {
  const days = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getTime() - i * 86_400_000);
    days.push(pstFormatter.format(d));
  }
  return days;
}

function pstDayBoundsUTC(dateStr) {
  // PST = UTC-8 (PDT -7). Use Intl round-trip to be DST-safe.
  const [y, m, d] = dateStr.split("-").map(Number);
  const startGuess = new Date(Date.UTC(y, m - 1, d, 8, 0, 0));
  const endGuess = new Date(startGuess.getTime() + 86_400_000);
  return [startGuess.toISOString(), endGuess.toISOString()];
}

function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long" });
}

// ---------- GraphQL collector ----------

const POSTS_QUERY = `query($after: DateTime, $before: DateTime, $first: Int, $cursor: String) {
  posts(postedAfter: $after, postedBefore: $before, first: $first, after: $cursor) {
    edges {
      node {
        id
        name
        slug
        tagline
        url
        votesCount
        commentsCount
        createdAt
        featuredAt
        topics(first: 5) { edges { node { name } } }
        makers(first: 5) { edges { node { username } } }
        comments(first: 5) { edges { node { body user { username } } } }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function apiDay(dateStr) {
  const [after, before] = pstDayBoundsUTC(dateStr);
  const posts = [];
  let cursor = null;
  for (let page = 0; page < 10; page++) {
    const data = await fetchJson(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: POSTS_QUERY,
        variables: { after, before, first: 50, cursor },
      }),
    });
    if (data.errors) throw new Error(`GraphQL: ${JSON.stringify(data.errors[0])}`);
    const conn = data.data.posts;
    posts.push(...conn.edges.map((e) => e.node));
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
    await sleep(300);
  }
  return posts;
}

// ---------- scrape collector (__NEXT_DATA__) ----------

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("__NEXT_DATA__ not found");
  return JSON.parse(m[1]);
}

// Recursively find post-like objects in Apollo/Next state.
function findPosts(node, found = new Map()) {
  if (node && typeof node === "object") {
    if (
      typeof node.slug === "string" &&
      typeof node.name === "string" &&
      (typeof node.votesCount === "number" || typeof node.votes_count === "number")
    ) {
      found.set(node.slug, node);
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === "object") findPosts(v, found);
    }
  }
  return found;
}

async function scrapeDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const url = `${SITE}/leaderboard/daily/${y}/${m}/${d}/all`;
  const html = await fetchText(url);
  const next = extractNextData(html);
  return [...findPosts(next).values()];
}

// ---------- normalize → corpus record ----------

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

function findMakerComment(node) {
  const makers = new Set(
    (node.makers?.edges || []).map((e) => e.node?.username).filter(Boolean)
  );
  if (makers.size === 0) return null;
  for (const e of node.comments?.edges || []) {
    const c = e.node;
    if (c?.user?.username && makers.has(c.user.username)) return c.body || null;
  }
  return null;
}

function commentShape(body) {
  if (!body) return "none";
  const len = body.length;
  if (len < 200) return "short";
  if (len > 1200) return "long";
  return "standard";
}

function normalize(node, source) {
  const dateStr = pstFormatter.format(new Date(node.createdAt || node.created_at));
  const makerComment = findMakerComment(node);
  return {
    name: node.name,
    slug: node.slug,
    url: `${SITE}/products/${node.slug}`,
    launch_date: dateStr,
    day_of_week: dayOfWeek(dateStr),
    category: null, // enrich per product domain — agents do this in /analyze-category
    topics: (node.topics?.edges || []).map((e) => e.node?.name).filter(Boolean),
    tagline: node.tagline || null,
    tagline_formula: classifyTagline(node.tagline), // heuristic — review before quoting
    maker_comment_shape: commentShape(makerComment),
    maker_comment_excerpt: makerComment ? makerComment.slice(0, 500) : null,
    gallery_first_card: null, // needs visual inspection — fill manually or via agent
    rank: null, // set after global sort
    votes: node.votesCount ?? node.votes_count ?? null,
    comments: node.commentsCount ?? node.comments_count ?? null,
    featured: node.featuredAt != null || node.featured_at != null ? true : null,
    source,
  };
}

// ---------- main ----------

async function main() {
  log(`collect-launches: last ${DAYS} days, top ${LIMIT} by votes`);
  const days = pstDaysBack(DAYS);
  const all = new Map();

  if (!TOKEN && !SCRAPE_ONLY) {
    log("  no PH_API_TOKEN — trying scrape path (may be blocked)");
  }

  const useApi = TOKEN && !SCRAPE_ONLY;
  let failures = 0;

  for (const day of days) {
    try {
      const posts = useApi ? await apiDay(day) : await scrapeDay(day);
      dbg(`${day}: ${posts.length} posts`);
      for (const p of posts) if (p.slug) all.set(p.slug, p);
    } catch (e) {
      failures++;
      dbg(`${day}: FAIL ${e.message}`);
      if (failures > 5 && failures > days.length * 0.5) {
        log(`  too many failures — giving up. ${useApi ? "check PH_API_TOKEN" : "scrape blocked; get a free PH_API_TOKEN and rerun"}`);
        process.exit(1);
      }
    }
    await sleep(useApi ? 400 : 1200); // be polite to PH
  }

  const sorted = [...all.values()].sort(
    (a, b) => (b.votesCount ?? b.votes_count ?? 0) - (a.votesCount ?? a.votes_count ?? 0)
  );
  const top = sorted.slice(0, LIMIT);

  mkdirSync(OUT_DIR, { recursive: true });
  const index = [];

  top.forEach((node, i) => {
    const rec = normalize(node, useApi ? "api" : "scraped");
    rec.rank = i + 1;
    writeFileSync(join(OUT_DIR, `${rec.slug}.json`), JSON.stringify(rec, null, 2) + "\n");
    index.push({
      slug: rec.slug,
      name: rec.name,
      rank: rec.rank,
      votes: rec.votes,
      comments: rec.comments,
      launch_date: rec.launch_date,
      day_of_week: rec.day_of_week,
      tagline_formula: rec.tagline_formula,
    });
  });

  writeFileSync(join(OUT_DIR, "_index.json"), JSON.stringify(index, null, 2) + "\n");

  const daysHit = days.length - failures;
  log(`\nwrote ${top.length} launches → data/launches/ (from ${all.size} posts across ${daysHit} days)`);
  log(`  featured: ${top.filter((p) => p.featuredAt != null || p.featured_at != null).length}/${top.length}`);
  log(`  note: tagline_formula is a heuristic guess; gallery_first_card/category need agent enrichment`);
}

main().catch((e) => {
  console.error(`collect-launches failed: ${e.message}`);
  process.exit(1);
});
