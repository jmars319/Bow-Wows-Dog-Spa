import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

export default async function globalTeardown() {
  if (process.env.BOWWOW_E2E_SKIP_SERVER_STOP === '1') {
    return;
  }

  execFileSync('bash', ['./scripts/dev-stop.sh'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
}
