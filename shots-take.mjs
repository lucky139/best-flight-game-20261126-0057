// Take the dossier screenshots for Sky Courier with Playwright.
// Serves game/ on :8091, opens each ?shot= URL at 1280x720, waits
// for the frozen frame, and writes a JPEG into screenshots/.
// Usage: node shots-take.mjs (run from the repository root)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const REPO = '/home/hatch/workspace/makefun/best-flight-game-20261126-0057';
const shots = JSON.parse(readFileSync(`${REPO}/shots.json`, 'utf8'));
const server = spawn('node', ['serve.ts', '--port', '8091'], { stdio: 'pipe', cwd: REPO });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=swiftshader', '--no-proxy-server', '--disable-features=LocalNetworkAccessChecks'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
  page.on('pageerror', (e) => console.log('PAGE ERROR:', String(e)));

  for (const shot of shots) {
    const url = `http://localhost:8091/index.html${shot.query}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${REPO}/screenshots/${shot.name}`, type: 'jpeg', quality: 82 });
    console.log('shot', shot.name);
  }
} finally {
  await browser.close();
  server.kill();
}
console.log('done');
