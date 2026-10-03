// Renders public/media/explainer.webm: the five ages side by side going
// healthy → wilted → healthy, as a seamless loop. Re-run after changing the plant:
//   node scripts/render-explainer.mjs
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const FPS = 24;
const SECONDS = 9;
const OUT = path.resolve('public/media/explainer.webm');

const ease = (t) => t * t * (3 - 2 * t);
/** Health and caption at time t (s). Starts and ends healthy so the loop is seamless. */
function timeline(t) {
  if (t < 1.5) return [1, 'Cared for'];
  if (t < 4.5) {
    const h = 1 - 0.92 * ease((t - 1.5) / 3);
    return [h, h > 0.55 ? 'Skipping habits…' : 'Wilting'];
  }
  if (t < 5.5) return [0.08, 'Wilted, never dead'];
  if (t < 8) return [0.08 + 0.92 * ease((t - 5.5) / 2.5), 'Back with care'];
  return [1, 'Cared for'];
}

const server = await createServer({ configFile: 'lab/vite.config.ts', server: { port: 5199, strictPort: true, open: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const frames = await mkdtemp(path.join(tmpdir(), 'marumado-frames-'));
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 760 } });
  await page.goto('http://localhost:5199/lab/index.html?grid=1&clean=1&capture=1&health=1');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const cap = Object.assign(document.createElement('div'), { id: 'cap' });
    cap.style.cssText =
      'position:fixed;top:28px;left:50%;transform:translateX(-50%);padding:8px 22px;border-radius:999px;background:rgba(255,252,246,.92);font:600 30px Georgia,serif;color:#2b2620';
    document.body.append(cap);
  });
  const total = FPS * SECONDS;
  for (let i = 0; i < total; i++) {
    const [h, caption] = timeline(i / FPS);
    await page.evaluate(
      ([health, text]) =>
        new Promise((resolve) => {
          const input = document.getElementById('health');
          input.value = String(Math.round(health * 100));
          input.dispatchEvent(new Event('input'));
          document.getElementById('cap').textContent = text;
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
      [h, caption],
    );
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, '0')}.png`) });
    if (i % 24 === 0) process.stdout.write(`frame ${i}/${total}\n`);
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png'), '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-pix_fmt', 'yuv420p', '-row-mt', '1', '-an', OUT]);
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
  await server.close();
  await rm(frames, { recursive: true, force: true });
}
