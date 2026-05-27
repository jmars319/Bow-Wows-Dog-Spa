#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const urls = args.filter((arg) => arg !== "--dry-run");

function parseEnvLine(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match || trimmed.startsWith("#")) return null;
  return [match[1], match[2].trim().replace(/^['"]|['"]$/g, "")];
}

async function loadEnv(path) {
  try {
    const content = await readFile(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed) process.env[parsed[0]] ||= parsed[1];
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function zoneNameForUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error(`Only https URLs can be purged: ${rawUrl}`);
  }
  return url.hostname.replace(/^cdn\./, "");
}

async function cloudflare(path, options = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required.");
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(JSON.stringify(data.errors || data, null, 2));
  }
  return data;
}

async function resolveZoneId(zoneName) {
  if (process.env.CLOUDFLARE_ZONE_ID) return process.env.CLOUDFLARE_ZONE_ID;
  const data = await cloudflare(`/zones?name=${encodeURIComponent(zoneName)}`);
  const zone = data.result?.[0];
  if (!zone?.id) throw new Error(`Could not find Cloudflare zone: ${zoneName}`);
  return zone.id;
}

await loadEnv(join(homedir(), ".config", "jamarq", "cloudflare.env"));
await loadEnv(".env.local");
await loadEnv("backend/.env");

if (urls.length === 0) {
  console.error("Usage: node scripts/purge-cdn-cache.mjs <https://cdn.example.com/path> [...] [--dry-run]");
  process.exit(1);
}

const grouped = new Map();
for (const url of urls) {
  const zoneName = zoneNameForUrl(url);
  grouped.set(zoneName, [...(grouped.get(zoneName) || []), url]);
}

for (const [zoneName, files] of grouped.entries()) {
  if (dryRun) {
    console.log(`[dry-run] ${zoneName}: ${files.length} URL(s)`);
    continue;
  }
  const zoneId = await resolveZoneId(zoneName);
  await cloudflare(`/zones/${zoneId}/purge_cache`, {
    method: "POST",
    body: JSON.stringify({ files }),
  });
  console.log(`Purged ${files.length} URL(s) for ${zoneName}.`);
}
