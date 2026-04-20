import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(new URL('../../package.json', import.meta.url)));

export function loadFixtures() {
  const fixturePath = path.join(rootDir, '.dev', 'e2e-fixtures.json');
  const payload = fs.readFileSync(fixturePath, 'utf8');
  return JSON.parse(payload);
}

export function uniqueLabel(prefix) {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function rootAssetPath(relativePath) {
  return path.join(rootDir, relativePath);
}
