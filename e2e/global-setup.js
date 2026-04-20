import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const baseUrl = process.env.BOWWOW_E2E_BASE_URL || 'http://127.0.0.1:5173';

function run(command, args) {
  execFileSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

async function waitForUrl(url, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok || response.status === 302 || response.status === 304) {
        return;
      }
    } catch (error) {
      // keep retrying until the local stack is ready
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup() {
  if (process.env.BOWWOW_E2E_SKIP_SERVER_START !== '1') {
    run('bash', ['./scripts/dev-start.sh']);
  }

  await waitForUrl(baseUrl);
  await waitForUrl(`${baseUrl}/admin/login`);
  run('php', ['backend/scripts/seed_e2e_fixtures.php']);
}
