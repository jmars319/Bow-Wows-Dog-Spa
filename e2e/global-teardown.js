import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

export default async function globalTeardown() {
  try {
    execFileSync('php', ['backend/scripts/cleanup_e2e_fixtures.php'], {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } catch {
    // Do not mask Playwright failures with local cleanup failures.
  }

  if (process.env.BOWWOW_E2E_SKIP_SERVER_STOP === '1') {
    return;
  }

  execFileSync('bash', ['./scripts/dev-stop.sh'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
}
