import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(readFileSync(path.join(root, "scripts", "maintainability.config.json"), "utf8"));
const budget = config.bundleBudget;
const failures = [];
const warnings = [];

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

function collectJsFiles(dirPath) {
  if (!existsSync(dirPath)) return [];
  const files = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(absolutePath));
    } else if (entry.name.endsWith(".js")) {
      files.push(absolutePath);
    }
  }
  return files;
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

for (const entry of budget.entries ?? []) {
  const assetDir = path.join(root, entry.dir);
  if (!existsSync(assetDir)) {
    fail(`${entry.label} build assets were not found at ${entry.dir}. Run npm run build before budget:bundle.`);
    continue;
  }

  const chunks = collectJsFiles(assetDir).map((filePath) => {
    const source = readFileSync(filePath);
    return {
      file: path.relative(root, filePath),
      rawBytes: statSync(filePath).size,
      gzipBytes: gzipSync(source).length,
    };
  });
  const totalRawBytes = chunks.reduce((sum, chunk) => sum + chunk.rawBytes, 0);
  const totalGzipBytes = chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
  const largestChunk = chunks.toSorted((a, b) => b.rawBytes - a.rawBytes)[0];

  console.log(`[bundle] ${entry.label} JS total: ${formatKb(totalRawBytes)} raw / ${formatKb(totalGzipBytes)} gzip`);
  if (largestChunk) {
    console.log(`[bundle] ${entry.label} largest JS: ${formatKb(largestChunk.rawBytes)} raw / ${formatKb(largestChunk.gzipBytes)} gzip (${largestChunk.file})`);
  }

  const maxTotalBytes = entry.maxTotalJsKb * 1024;
  const maxLargestBytes = entry.maxLargestJsKb * 1024;
  const nearBytes = budget.nearBudgetKb * 1024;
  if (totalRawBytes > maxTotalBytes) {
    fail(`${entry.label} JS total is ${formatKb(totalRawBytes)}; budget is ${entry.maxTotalJsKb.toFixed(2)} KiB.`);
  } else if (maxTotalBytes - totalRawBytes <= nearBytes) {
    warn(`${entry.label} JS total is near budget: ${formatKb(totalRawBytes)} / ${entry.maxTotalJsKb.toFixed(2)} KiB.`);
  }
  if (largestChunk && largestChunk.rawBytes > maxLargestBytes) {
    fail(`${entry.label} largest JS is ${formatKb(largestChunk.rawBytes)}; budget is ${entry.maxLargestJsKb.toFixed(2)} KiB.`);
  } else if (largestChunk && maxLargestBytes - largestChunk.rawBytes <= nearBytes) {
    warn(`${entry.label} largest JS is near budget: ${formatKb(largestChunk.rawBytes)} / ${entry.maxLargestJsKb.toFixed(2)} KiB.`);
  }
}

for (const warning of warnings) console.warn(`[bundle:warn] ${warning}`);
if (warnings.length > 0 && budget.failOnWarnings) fail("Bundle warnings are treated as failures.");
if (failures.length > 0) {
  for (const failure of failures) console.error(`[bundle:fail] ${failure}`);
  process.exit(1);
}
console.log("[bundle] Budget passed");
