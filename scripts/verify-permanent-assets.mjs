#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'docs/permanent-assets.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const args = process.argv.slice(2);

function fail(message) {
  console.error(`[permanent-assets][error] ${message}`);
  process.exit(1);
}

function assertFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    fail(`Missing bundled asset: ${relativePath}`);
  }
}

function zipEntries(zipPath) {
  if (!fs.existsSync(zipPath)) {
    fail(`Missing deploy zip: ${zipPath}`);
  }
  return new Set(execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n').filter(Boolean));
}

function assertZipEntries(zipPath, expectedEntries, label) {
  const entries = zipEntries(zipPath);
  for (const entry of expectedEntries) {
    if (!entries.has(entry)) {
      fail(`${label} is missing permanent asset: ${entry}`);
    }
  }
}

for (const assetPath of manifest.bundled || []) {
  assertFile(assetPath);
}

const placeholderZipIndex = args.indexOf('--placeholder-zip');
if (placeholderZipIndex !== -1) {
  assertZipEntries(args[placeholderZipIndex + 1], manifest.placeholderDeployRequired || [], 'placeholder deploy');
}

const siteZipIndex = args.indexOf('--site-zip');
if (siteZipIndex !== -1) {
  assertZipEntries(args[siteZipIndex + 1], manifest.siteDeployRequired || [], 'site deploy');
}

console.log(`[permanent-assets] Verified ${(manifest.bundled || []).length} bundled assets`);
