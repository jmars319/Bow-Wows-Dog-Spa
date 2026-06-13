import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, 'docs', 'deploy-archive-snapshot.json');

if (!fs.existsSync(manifestPath)) {
  console.error('[deploy-snapshot] Missing docs/deploy-archive-snapshot.json');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const archive = path.join(rootDir, manifest.archive || 'site-deploy.zip');

if (!fs.existsSync(archive)) {
  console.error(`[deploy-snapshot] Missing archive: ${path.relative(rootDir, archive)}`);
  process.exit(1);
}

const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);

function hasPattern(pattern) {
  const re = new RegExp(pattern);
  return entries.some((entry) => re.test(entry));
}

const failures = [];
for (const pattern of manifest.requiredPatterns || []) {
  if (!hasPattern(pattern)) {
    failures.push(`required pattern missing: ${pattern}`);
  }
}
for (const pattern of manifest.forbiddenPatterns || []) {
  if (hasPattern(pattern)) {
    failures.push(`forbidden pattern present: ${pattern}`);
  }
}

if (failures.length) {
  console.error('[deploy-snapshot] Deploy archive snapshot failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`[deploy-snapshot] ${path.basename(archive)} matches docs/deploy-archive-snapshot.json.`);
