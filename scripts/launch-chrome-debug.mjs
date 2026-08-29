import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CDP_URL = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222';
const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function cdpUp() {
  try {
    const res = await fetch(`${CDP_URL.replace(/\/$/, '')}/json/version`, {
      signal: AbortSignal.timeout(800),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function chromeRunning() {
  try {
    execSync('pgrep -f "Google Chrome.app/Contents/MacOS/Google Chrome"', {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

if (await cdpUp()) {
  console.log(`Chrome DevTools is already listening at ${CDP_URL}`);
  console.log('You can run: npm run dev');
  process.exit(0);
}

if (chromeRunning()) {
  console.error('Chrome is already running WITHOUT remote debugging.');
  console.error('');
  console.error('LinkedIn will reject Node cookie requests. Use the same Chrome you are logged into:');
  console.error('  1. Quit Google Chrome completely (Cmd+Q) — closing the window is not enough');
  console.error('  2. Run this command again: npm run chrome:debug');
  console.error('  3. Then: npm run dev');
  process.exit(1);
}

if (!existsSync(CHROME_PATH)) {
  console.error(`Chrome not found at ${CHROME_PATH}`);
  console.error('Set CHROME_PATH to your Chrome binary.');
  process.exit(1);
}

console.log('Launching Chrome with --remote-debugging-port=9222 ...');
const child = spawn(
  CHROME_PATH,
  ['--remote-debugging-port=9222', '--restore-last-session'],
  { detached: true, stdio: 'ignore' }
);
child.unref();

for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 250));
  if (await cdpUp()) {
    console.log(`Chrome DevTools is ready at ${CDP_URL}`);
    console.log('Keep this Chrome window open, stay logged into LinkedIn, then run: npm run dev');
    process.exit(0);
  }
}

console.error('Chrome started but DevTools port 9222 never came up.');
process.exit(1);
