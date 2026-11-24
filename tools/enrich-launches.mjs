#!/usr/bin/env node
/**
 * enrich-launches.mjs — fetch gallery media for corpus launches and download
 * the first card image, so an agent/human can describe gallery_first_card.
 *
 * Usage:
 *   node tools/enrich-launches.mjs --token-file <path>
 *
 * Output: data/media/<slug>.<ext> + writes "media_urls" into each launch JSON.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LAUNCH_DIR = join(ROOT, "data", "launches");
const MEDIA_DIR = join(ROOT, "data", "media");
const API_URL = "https://api.producthunt.com/v2/api/graphql";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36";

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const TOKEN_FILE = arg("token-file", null);
const TOKEN = process.env.PH_API_TOKEN || (TOKEN_FILE && readFileSync(TOKEN_FILE, "utf8").trim());
if (!TOKEN) {
  console.error("needs PH_API_TOKEN or --token-file");
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MEDIA_QUERY = `query($slug: String!) {
  post(slug: $slug) {
    media { url type videoUrl }
  }
}`;

async function fetchMedia(slug) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ query: MEDIA_QUERY, variables: { slug } }),
  });
  if (res.status === 429) {
    const body = await res.json().catch(() => null);
    const first = Array.isArray(body) ? body[0] : body;
    const resetIn = first?.details?.reset_in ?? 60;
    console.log(`  rate-limited, waiting ${resetIn}s`);
    await sleep(resetIn * 1000 + 3000);
    return fetchMedia(slug);
  }
  const data = await res.json();
  if (data.errors) throw new Error(`${slug}: ${JSON.stringify(data.errors[0])}`);
  return data.data.post?.media || [];
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  mkdirSync(MEDIA_DIR, { recursive: true });
  const files = readdirSync(LAUNCH_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));

  for (const f of files) {
    const rec = JSON.parse(readFileSync(join(LAUNCH_DIR, f), "utf8"));
    try {
      const media = await fetchMedia(rec.slug);
      rec.media_urls = media.map((m) => m.url).filter(Boolean);
      const firstImage = media.find((m) => m.url && (m.type || "").toLowerCase() !== "video");
      if (firstImage) {
        const ext = extname(new URL(firstImage.url).pathname) || ".png";
        await download(firstImage.url, join(MEDIA_DIR, `${rec.slug}${ext.split("?")[0]}`));
        console.log(`${rec.slug}: ${media.length} media, first card downloaded`);
      } else {
        console.log(`${rec.slug}: ${media.length} media, no still image`);
      }
      writeFileSync(join(LAUNCH_DIR, f), JSON.stringify(rec, null, 2) + "\n");
    } catch (e) {
      console.log(`${rec.slug}: FAIL ${e.message}`);
    }
    await sleep(2000);
  }
}

main().catch((e) => {
  console.error(`enrich failed: ${e.message}`);
  process.exit(1);
});
