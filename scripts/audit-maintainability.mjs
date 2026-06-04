import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const updateSnapshots = process.argv.includes("--update-snapshots");
const config = JSON.parse(readFileSync(path.join(root, "scripts", "maintainability.config.json"), "utf8"));
const failures = [];
const warnings = [];

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function isUnderAnyRoot(filePath, roots = []) {
  return roots.some((sourceRoot) => filePath === sourceRoot || filePath.startsWith(`${sourceRoot}/`));
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function gitLsFiles() {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const trackedFiles = gitLsFiles();
const generatedPatterns = (config.generatedArtifactPatterns ?? []).map(globToRegex);
const excludedSourcePatterns = (config.excludedSourcePatterns ?? []).map(globToRegex);

function isExcluded(filePath) {
  return excludedSourcePatterns.some((pattern) => pattern.test(filePath));
}

for (const filePath of trackedFiles) {
  if (generatedPatterns.some((pattern) => pattern.test(filePath))) {
    fail(`Generated/runtime artifact is tracked: ${filePath}`);
  }
}

function lineBudgetFor(filePath) {
  if (filePath.endsWith(".css")) return config.maxStyleFileLines;
  if (filePath.endsWith(".md")) return config.maxDocFileLines;
  if (filePath.startsWith("scripts/")) return config.maxScriptFileLines;
  if (/\.(php|ts|tsx|js|jsx|mjs|cjs)$/.test(filePath)) return config.maxImplementationFileLines;
  return null;
}

for (const filePath of trackedFiles) {
  if (!isUnderAnyRoot(filePath, config.sourceRoots) || isExcluded(filePath)) continue;
  const budget = lineBudgetFor(filePath);
  if (!budget) continue;
  const lineCount = readFileSync(path.join(root, filePath), "utf8").split("\n").length;
  if (lineCount > budget) {
    fail(`${filePath} has ${lineCount} lines; budget is ${budget}.`);
  } else if (budget - lineCount <= config.nearBudgetLineWindow) {
    warn(`${filePath} is near its line budget: ${lineCount}/${budget}.`);
  }
}

const bannedImportPatterns = [
  /from\s+["'][^"']*(?:node_modules|dist|build|coverage)\//,
  /import\(["'][^"']*(?:node_modules|dist|build|coverage)\//,
  /require\(["'][^"']*(?:node_modules|dist|build|coverage)\//,
];

for (const filePath of trackedFiles) {
  if (!isUnderAnyRoot(filePath, config.sourceRoots) || isExcluded(filePath) || !/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath)) {
    continue;
  }
  const source = readFileSync(path.join(root, filePath), "utf8");
  if (bannedImportPatterns.some((pattern) => pattern.test(source))) {
    fail(`${filePath} imports from generated, dependency, or build output paths.`);
  }
}

function collectEnvKeys() {
  const envPaths = ["backend/.env.example", ".env.example"];
  const keys = new Set();
  for (const envPath of envPaths) {
    const absolutePath = path.join(root, envPath);
    if (!existsSync(absolutePath)) continue;
    for (const line of readFileSync(absolutePath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      keys.add(trimmed.split("=")[0].trim());
    }
  }
  return Array.from(keys).sort();
}

function collectPackageSurface() {
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  return {
    name: packageJson.name,
    workspaces: packageJson.workspaces ?? [],
    scripts: ["verify", "test:deploy", "deploy:make", "deploy:check", "audit:maintainability", "budget:bundle"]
      .filter((scriptName) => packageJson.scripts?.[scriptName])
      .sort(),
  };
}

function compareSnapshot(label, actual, snapshotPath) {
  const serialized = `${JSON.stringify(actual, null, 2)}\n`;
  if (updateSnapshots) {
    mkdirSync(path.dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, serialized);
    return;
  }
  if (!existsSync(snapshotPath)) {
    fail(`${label} snapshot is missing: ${normalizePath(path.relative(root, snapshotPath))}`);
    return;
  }
  if (readFileSync(snapshotPath, "utf8") !== serialized) {
    fail(`${label} snapshot drifted. Run audit with --update-snapshots only for intentional public-surface changes.`);
  }
}

const contractsDir = path.join(root, "scripts", "contracts");
compareSnapshot("Environment key", collectEnvKeys(), path.join(contractsDir, "env-keys.json"));
compareSnapshot("Static route", config.staticRoutes ?? [], path.join(contractsDir, "static-routes.json"));
compareSnapshot("Deploy surface", config.deploySurfaces ?? [], path.join(contractsDir, "deploy-surfaces.json"));
compareSnapshot("Package surface", collectPackageSurface(), path.join(contractsDir, "package-surface.json"));

for (const filePath of trackedFiles.filter((filePath) => filePath.startsWith(".github/workflows/") && /\.ya?ml$/.test(filePath))) {
  const source = readFileSync(path.join(root, filePath), "utf8");
  if (!/timeout-minutes:\s*\d+/.test(source)) fail(`${filePath} is missing an explicit timeout-minutes value.`);
  if (/actions\/checkout@v[1-5]\b/.test(source)) fail(`${filePath} uses an outdated checkout action.`);
}

const assetExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf"]);
for (const filePath of trackedFiles) {
  if (!isUnderAnyRoot(filePath, config.assetRoots) || !assetExtensions.has(path.extname(filePath).toLowerCase())) continue;
  const size = statSync(path.join(root, filePath)).size;
  if (size > config.maxAssetBytes) {
    fail(`${filePath} is ${(size / 1024).toFixed(1)} KiB; asset budget is ${(config.maxAssetBytes / 1024).toFixed(1)} KiB.`);
  } else if (config.nearAssetBytes && config.maxAssetBytes - size <= config.nearAssetBytes) {
    warn(`${filePath} is near the asset budget: ${(size / 1024).toFixed(1)} KiB.`);
  }
}

for (const warning of warnings) {
  console.warn(`[maintainability:warn] ${warning}`);
}
if (warnings.length > 0 && (strict || config.failOnWarnings)) {
  fail("Maintainability warnings are treated as failures.");
}
if (failures.length > 0) {
  for (const failure of failures) console.error(`[maintainability:fail] ${failure}`);
  process.exit(1);
}
console.log("[maintainability] Audit passed");
