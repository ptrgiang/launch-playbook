#!/usr/bin/env node
/**
 * maker-comments.mjs — fill maker_comment_shape / maker_comment_excerpt for
 * each launch in data/launches/ by scanning up to 50 comments for one
 * authored by a listed maker.
 *
 * Usage: node tools/maker-comments.mjs --token-file <path>
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
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": UA },
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

const shape = (body) => {
  if (!body) return "none";
  const len = body.length;
  if (len < 200) return "short";
  if (len > 1200) return "long";
  return "standard";
};

async function main() {
  if (!TOKEN) {
    log("need PH_API_TOKEN (env, --token, or --token-file)");
    process.exit(1);
  }
  const files = readdirSync(LAUNCH_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  for (const f of files) {
    const rec = JSON.parse(readFileSync(join(LAUNCH_DIR, f), "utf8"));
    try {
      const data = await gql(
        `query($slug: String!) {
          post(slug: $slug) {
            makers { id username }
            comments(first: 50) { edges { node { body user { id username } } } }
          }
        }`,
        { slug: rec.slug }
      );
      // usernames are [REDACTED] on comments — match by user.id instead
      const makerIds = new Set((data.post?.makers || []).map((m) => m.id));
      const comment = (data.post?.comments?.edges || [])
        .map((e) => e.node)
        .find((c) => c?.user?.id && makerIds.has(c.user.id));
      rec.maker_comment_shape = shape(comment?.body);
      rec.maker_comment_excerpt = comment?.body ? comment.body.slice(0, 500) : null;
      writeFileSync(join(LAUNCH_DIR, f), JSON.stringify(rec, null, 2) + "\n");
      log(`  ${rec.slug}: ${rec.maker_comment_shape} (${comment ? "found by " + comment.user.username : "no maker comment in first 50"})`);
    } catch (e) {
      log(`  ${rec.slug}: FAIL ${e.message.slice(0, 80)}`);
    }
    await sleep(2000);
  }
  log("done");
}

main().catch((e) => {
  console.error(`maker-comments failed: ${e.message}`);
  process.exit(1);
});
