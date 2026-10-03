// Renders the three deck videos from the real new-tab page (dev build), frame by frame:
//   deck-videos/1-growth-30-days.mp4   healthy growth over 30 days of care
//   deck-videos/2-neglect.mp4          a flowering plant wilting without care
//   deck-videos/3-recovery.mp4         coming back with care (droplets + glints)
// Usage: npm run render:deck   (builds the dev extension first; needs ffmpeg)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const FPS = 30;
const EXT = path.resolve('.output/chrome-mv3-dev');
const OUT = path.resolve('deck-videos');
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

const SCENES = [
  {
    file: '1-growth-30-days.mp4',
    seconds: 8,
    at: (t) => {
      const days = 30 * ease(clamp01((t - 0.6) / 6.6));
      return { days, health: 1, caption: `Day ${Math.round(days)} of care` };
    },
  },
  {
    file: '2-neglect.mp4',
    seconds: 8,
    at: (t) => {
      const k = ease(clamp01((t - 1) / 5.5));
      return { days: 120, health: 1 - 0.92 * k, caption: k < 0.05 ? 'Cared for' : `${Math.max(1, Math.round(k * 7))} days without care` };
    },
  },
  {
    file: '3-recovery.mp4',
    seconds: 8,
    cheers: [
      [0.6, 'water'],
      [2.4, 'sparkle'],
      [4.2, 'water'],
      [5.8, 'sparkle'],
    ],
    at: (t) => {
      const k = ease(clamp01((t - 0.6) / 6));
      return { days: 120, health: 0.08 + 0.92 * k, caption: k < 0.98 ? 'Back with care' : 'Healthy again' };
    },
  },
];

await mkdir(OUT, { recursive: true });
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  viewport: { width: 1920, height: 1080 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await context.newPage();
  await page.goto('chrome://newtab/');
  await page.waitForURL(/newtab\.html/);
  // A planted, fully answered plant: no onboarding, no question card.
  await page.evaluate(async () => {
    const now = Date.now();
    const habits = ['water', 'stretch', 'eyes'];
    await chrome.storage.local.set({
      settings: {
        plantName: 'Aoi',
        habits: habits.map((id, i) => ({ id, intervalMin: [120, 60, 30][i] })),
        workHours: { start: '00:00', end: '23:59', days: [0, 1, 2, 3, 4, 5, 6] },
        createdAt: now - 60_000,
        vacations: [],
        reduceMotion: false,
        lastExportAt: now,
      },
      events: habits.map((habitId) => ({ id: crypto.randomUUID(), ts: now - 1000, tz: 'deck', habitId, answer: 'yes' })),
    });
  });
  await page.reload();
  await page.waitForTimeout(1500);
  await page.addStyleTag({
    content: `#needs,#openHelp,#openSettings,#ask,#toast,#mockControls{display:none!important}
      #cap{position:fixed;top:40px;left:50%;transform:translateX(-50%);padding:10px 28px;border-radius:999px;
      background:rgba(255,252,246,.92);font:600 34px 'Shippori Mincho',Georgia,serif;color:#2b2620;box-shadow:0 10px 30px rgba(40,30,20,.15)}`,
  });
  await page.evaluate(() => {
    document.body.append(Object.assign(document.createElement('div'), { id: 'cap' }));
    window.__marumado.manual(true);
  });

  for (const scene of SCENES) {
    const frames = await mkdtemp(path.join(tmpdir(), 'marumado-deck-'));
    const total = scene.seconds * FPS;
    const cheers = [...(scene.cheers ?? [])];
    for (let i = 0; i < total; i++) {
      const t = i / FPS;
      const s = scene.at(t);
      const cheer = cheers[0] && t >= cheers[0][0] ? cheers.shift()[1] : null;
      await page.evaluate(
        ({ s, cheer, dt }) => {
          const m = window.__marumado;
          m.set({ days: s.days, health: s.health, hour: 10 });
          if (cheer) m.cheer(cheer);
          m.frame(dt);
          document.getElementById('cap').textContent = s.caption;
        },
        { s, cheer, dt: 1 / FPS },
      );
      await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, '0')}.png`) });
      if (i % 60 === 0) console.log(`${scene.file}: ${i}/${total}`);
    }
    const out = path.join(OUT, scene.file);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png'), '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
    await rm(frames, { recursive: true, force: true });
    console.log(`wrote ${out}`);
  }
} finally {
  await context.close();
}
