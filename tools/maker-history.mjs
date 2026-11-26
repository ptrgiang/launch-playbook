#!/usr/bin/env node
/**
 * maker-history.mjs — for each launch in data/launches/, fetch its makers'
 * launch history: prior made-posts, prior featured count, account age.
 *
 * Answers: were featured makers repeat launchers? first-timers? hunters?
 *
 * Usage: node tools/maker-history.mjs --token-file <path>
 * Output: adds `maker_history` to each data/launches/<slug>.json
 */

import { writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LAUNCH_DIR = join(ROOT, "data", "launches");
const API_URL = "https://api.producthunt.com/v2/api/graphql";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const TOKEN =
  process.env.PH_API_TOKEN || arg("token", null) ||
  (arg("token-file") ? readFileSync(arg("token-file"), "utf8").trim() : null);

const log = (...m) => console.log(...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gql(query, variables, retries = 6) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify({ query, variables }),
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
    return gql(query, variables, retries - 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors[0]));
  return data.data;
}

// Probe which connection field User exposes for made posts.
async function probeMakerField() {
  for (const field of ["makerOf", "posts", "madePosts"]) {
    try {
      await gql(
        `query($u: String!) { user(username: $u) { ${field}(first: 1) { edges { node { slug } } } } }`,
        { u: "rrhoover" }
      );
      return field;
    } catch {
      // field doesn't exist on schema
    }
  }
  return null;
}

async function main() {
  if (!TOKEN) {
    log("need PH_API_TOKEN (env, --token, or --token-file)");
    process.exit(1);
  }
  const field = await probeMakerField();
  log(`maker posts field: ${field ?? "none — will capture scalars only"}`);

  const files = readdirSync(LAUNCH_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  log(`${files.length} launches`);

  for (const f of files) {
    const rec = JSON.parse(readFileSync(join(LAUNCH_DIR, f), "utf8"));
    try {
      const data = await gql(
        `query($slug: String!) {
          post(slug: $slug) {
            makers {
              username
              name
              headline
              createdAt
              followersCount
              ${field ? `${field}(first: 20) { edges { node { slug name votesCount featuredAt createdAt } } }` : ""}
            }
          }
        }`,
        { slug: rec.slug }
      );
      const makers = (data.post?.makers || []).map((m) => {
        const made = (m[field]?.edges || []).map((e) => e.node).filter(Boolean);
        const before = made.filter((p) => p.slug !== rec.slug && new Date(p.createdAt) < new Date(rec.launch_date));
        return {
          username: m.username,
          name: m.name,
          headline: m.headline || null,
          account_created: m.createdAt || null,
          followers: m.followersCount ?? null,
          made_posts_total: made.length,
          launches_before_this: before.length,
          featured_before: before.filter((p) => p.featuredAt != null).length,
        };
      });
      rec.maker_history = makers;
      writeFileSync(join(LAUNCH_DIR, f), JSON.stringify(rec, null, 2) + "\n");
      const summary = makers.map((m) => `${m.username}(${m.launches_before_this} prior, ${m.followers}f)`).join(", ");
      log(`  ${rec.slug}: ${summary || "no makers"}`);
    } catch (e) {
      log(`  ${rec.slug}: FAIL ${e.message.slice(0, 80)}`);
    }
    await sleep(2000);
  }
  log("done");
}

main().catch((e) => {
  console.error(`maker-history failed: ${e.message}`);
  process.exit(1);
});
