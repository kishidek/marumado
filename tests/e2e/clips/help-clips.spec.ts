/**
 * Renders the help modal's four looping clips (public/media/help-1…4.webm) frame by frame from
 * the real new-tab page (dev build): the WebGL scene is stepped with __marumado.frame(dt) and the
 * few UI pieces are driven by hand, so every frame is exact. Storyboard: plans/004 + bug log #31.
 *   npm run render:help   (needs ffmpeg)
 */
import { test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildScenario, fixedNow, openScene, sceneContext } from '../visual/scenario';

const FPS = 24;
// Outside the loop cross-fade (it blends the end into the start).
const POSTER_AT: Record<string, number> = { 'help-1.webm': 1.35, 'help-2.webm': 5.0, 'help-3.webm': 2.4, 'help-4.webm': 7.0 };
const OUT = path.resolve('public/media');
const REVIEW = path.resolve('.output/TEMP - help-clips');
/** Crop of the 1280×800 page: the window scene (clips 2–4) or the card + pot (clip 1). */
const SCENE_CROP = { x: 160, y: 160, width: 960, height: 540 };
const CARD_CROP = { x: 0, y: 200, width: 960, height: 540 };
/** Clip 4 ends on the garden seen from the close-up: frame a little higher so the hill isn't cut. */
const GARDEN_CROP = { x: 160, y: 70, width: 960, height: 540 };

type Hooks = {
  manual(on: boolean): void;
  set(p: { days?: number; health?: number; hour?: number }): void;
  cheer(kind: 'water' | 'sparkle'): void;
  frame(dt: number): void;
  garden(list: { look: number; flowers: string; generation: number }[]): void;
  fly(slot?: number): void;
};
const hooks = (page: Page) => (fn: (m: Hooks, arg: never) => void, arg?: unknown) =>
  page.evaluate(([f, a]) => new Function('m', 'a', `return (${f})(m, a)`)((window as unknown as { __marumado: Hooks }).__marumado, a), [fn.toString(), arg] as const);

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

/** Overlays used by the clips: a time tag, a cursor; UI hidden unless the clip needs it. */
async function prepare(page: Page, keepCard: boolean) {
  await page.addStyleTag({
    content: `*,*::before,*::after{transition:none!important;animation:none!important}
      #mockControls,#openHelp,#openSettings,.clock,#needs{display:none!important}
      ${keepCard ? '#toast{bottom:auto!important;top:640px!important;left:560px!important}' : '#ask,#toast{display:none!important}'}
      #clipTag{position:fixed;padding:6px 14px;border-radius:999px;background:rgba(255,252,246,.92);font:600 18px 'Shippori Mincho',Georgia,serif;color:#2b2620;box-shadow:0 6px 18px rgba(40,30,20,.15);opacity:0}
      #clipCursor{position:fixed;width:26px;height:26px;pointer-events:none;opacity:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}`,
  });
  await page.evaluate(() => {
    document.body.append(Object.assign(document.createElement('div'), { id: 'clipTag' }));
    const c = Object.assign(document.createElement('div'), { id: 'clipCursor' });
    c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.3-3.4-6.8L4 20z" fill="#fff" stroke="#222" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.append(c);
  });
}

const dom = (page: Page, js: string, arg?: unknown) => page.evaluate(([code, a]) => new Function('a', code)(a), [js, arg] as const);
const tag = (page: Page, text: string, opacity: number, at: { x: number; y: number }) =>
  dom(page, `const t=document.getElementById('clipTag');t.textContent=a.text;t.style.opacity=a.o;t.style.left=a.x+'px';t.style.top=a.y+'px'`, { text, o: opacity, x: at.x, y: at.y });

async function encode(frames: string, name: string, loopFade: number) {
  const out = path.join(OUT, name);
  const input = ['-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png')];
  const vp9 = ['-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-pix_fmt', 'yuv420p', '-row-mt', '1', '-an'];
  if (loopFade > 0) {
    // Seamless loop: drop the first `loopFade` s and cross-fade the tail into them, so the last
    // frame flows into the first one.
    const n = Number(execFileSync('sh', ['-c', `ls "${frames}" | wc -l`]).toString().trim());
    const dur = n / FPS;
    const filter = `[0]split[a][b];[a]trim=start=${loopFade},setpts=PTS-STARTPTS[main];[b]trim=end=${loopFade},setpts=PTS-STARTPTS[head];[main][head]xfade=transition=fade:duration=${loopFade}:offset=${(dur - 2 * loopFade).toFixed(3)}`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...input, '-filter_complex', filter, ...vp9, out]);
  } else {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...input, ...vp9, out]);
  }
  // Still for reduce motion: a representative frame (POSTER_AT, seconds).
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(POSTER_AT[name]), '-i', out, '-frames:v', '1', '-q:v', '4', out.replace('.webm', '.jpg')]);
  mkdirSync(REVIEW, { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', path.join(REVIEW, name.replace('.webm', '.mp4'))]);
}

async function render(page: Page, name: string, seconds: number, crop: typeof SCENE_CROP, loopFade: number, step: (t: number, i: number) => Promise<void>) {
  const frames = mkdtempSync(path.join(tmpdir(), 'marumado-help-'));
  try {
    const total = Math.round(seconds * FPS);
    for (let i = 0; i < total; i++) {
      await step(i / FPS, i);
      await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, '0')}.png`), clip: crop });
    }
    await encode(frames, name, loopFade);
  } finally {
    rmSync(frames, { recursive: true, force: true });
  }
}

test.describe.configure({ mode: 'serial' });

test('help-1 · one quick question (card, cursor taps Yes, drops)', async () => {
  const now = fixedNow(11);
  const context = await sceneContext(now);
  const page = await openScene(context, buildScenario({ history: 'healthy', currentCare: 12, hour: 11, reduceMotion: false, habits: [{ id: 'water', intervalMin: 120 }] }, now), 'collapsed', '?manual=1');
  const m = hooks(page);
  await prepare(page, true);
  await m((h) => h.set({ days: 60, health: 1 }));
  const yes = await page.locator('#ask .btn.primary').boundingBox();
  const target = { x: yes!.x + yes!.width / 2, y: yes!.y + yes!.height / 2 };
  const start = { x: 760, y: 760 };
  let cheered = false;
  await render(page, 'help-1.webm', 5, CARD_CROP, 0, async (t) => {
    const k = seg(t, 0.3, 1.2);
    const pressed = t >= 1.25 && t < 1.45;
    const cardO = t < 2.8 ? 1 : t < 3.3 ? 1 - seg(t, 2.8, 3.3) : t < 4.3 ? 0 : seg(t, 4.3, 4.9);
    const toastO = t < 1.4 ? 0 : t < 1.6 ? seg(t, 1.4, 1.6) : t < 3.6 ? 1 : 1 - seg(t, 3.6, 4.0);
    await dom(
      page,
      `const c=document.getElementById('clipCursor');c.style.left=a.cx+'px';c.style.top=a.cy+'px';c.style.opacity=a.co;
       const y=document.querySelector('#ask .btn.primary');y.style.transform=a.p?'scale(.94)':'';
       document.getElementById('ask').style.opacity=a.card;
       const to=document.getElementById('toast');to.textContent='Nice. Aoi felt that water.';to.classList.add('show');to.style.opacity=a.toast;`,
      { cx: start.x + (target.x - start.x) * k, cy: start.y + (target.y - start.y) * k, co: t < 3 ? Math.min(1, t / 0.3) : 1 - seg(t, 3, 3.4), p: pressed, card: cardO, toast: toastO },
    );
    if (!cheered && t >= 1.3) {
      cheered = true;
      await m((h) => h.cheer('water'));
    }
    await m((h, dt) => h.frame(dt), 1 / FPS);
  });
  await context.close();
});

const growLabel = (look: number) => {
  const careDays = (look * 180) / 365;
  if (careDays < 14) return 'Day 1';
  if (careDays < 45) return `${Math.round(careDays / 7)} weeks`;
  return `${Math.round(careDays / 30)} months`;
};

test('help-2 · say Yes and it grows (sprout → 6 months)', async () => {
  const now = fixedNow(11);
  const context = await sceneContext(now);
  const page = await openScene(context, buildScenario({ history: 'healthy', currentCare: 1, hour: 11, reduceMotion: false }, now), 'collapsed', '?manual=1');
  const m = hooks(page);
  await prepare(page, false);
  await render(page, 'help-2.webm', 6.5, SCENE_CROP, 0.5, async (t) => {
    const look = 365 * seg(t, 0.3, 5.6);
    await m((h, d) => h.set({ days: d, health: 1 }), look);
    await tag(page, growLabel(look), 1, { x: SCENE_CROP.x + 24, y: SCENE_CROP.y + 20 });
    await m((h, dt) => h.frame(dt), 1 / FPS);
  });
  await context.close();
});

test('help-3 · skip it and it droops, care brings it back', async () => {
  const now = fixedNow(11);
  const context = await sceneContext(now);
  const page = await openScene(context, buildScenario({ history: 'healthy', currentCare: 64, hour: 11, reduceMotion: false }, now), 'collapsed', '?manual=1');
  const m = hooks(page);
  await prepare(page, false);
  await m((h) => h.set({ days: 200, health: 1 }));
  const cheers = [3.0, 3.9, 4.6];
  await render(page, 'help-3.webm', 6, SCENE_CROP, 0, async (t) => {
    const health = t < 0.5 ? 1 : t < 2.3 ? 1 - 0.92 * seg(t, 0.5, 2.3) : t < 3.0 ? 0.08 : 0.08 + 0.92 * seg(t, 3.0, 5.2);
    await m((h, x) => h.set({ health: x }), health);
    const label = t < 0.5 || t >= 5.4 ? '' : t < 3.0 ? 'Days skipped' : 'Back with care';
    await tag(page, label, label ? 1 : 0, { x: SCENE_CROP.x + 24, y: SCENE_CROP.y + 20 });
    if (cheers.length && t >= cheers[0]!) {
      cheers.shift();
      await m((h) => h.cheer('water'));
    }
    await m((h, dt) => h.frame(dt), 1 / FPS);
  });
  await context.close();
});

test('help-4 · after 6 months it moves to the garden, which keeps filling', async () => {
  const now = fixedNow(11);
  const context = await sceneContext(now);
  const page = await openScene(context, buildScenario({ history: 'healthy', currentCare: 64, hour: 11, reduceMotion: false }, now), 'collapsed', '?manual=1');
  const m = hooks(page);
  await prepare(page, false);
  await m((h) => {
    h.garden([]);
    h.set({ days: 365, health: 1 });
  });
  const flowers = ['blue', 'pink', 'violet', 'white'];
  let flown = false;
  let shown = -1;
  await render(page, 'help-4.webm', 9, GARDEN_CROP, 0.6, async (t) => {
    if (!flown && t >= 0.5) {
      flown = true;
      await m((h) => h.fly(0));
    }
    // After landing: one new generation about every 0.75 s; older plants keep growing.
    const count = t < 3.6 ? 0 : Math.min(8, 1 + Math.floor((t - 3.6) / 0.62));
    const years = t < 3.6 ? 0 : (t - 3.6) * 0.85;
    if (count > 0 && (count !== shown || Math.round(t * FPS) % 3 === 0)) {
      shown = count;
      const list = Array.from({ length: count }, (_, g) => ({ look: 365 + Math.max(0, years - g * 0.5) * 730, flowers: flowers[g % 4]!, generation: g }));
      await m((h, l) => h.garden(l), list);
    }
    const label = t < 3.6 ? (t >= 0.5 ? 'Moving day' : '6 months') : years < 1.5 ? '1 year' : years < 3 ? '2 years' : '4 years';
    await tag(page, label, 1, { x: GARDEN_CROP.x + 24, y: GARDEN_CROP.y + 20 });
    await m((h, dt) => h.frame(dt), 1 / FPS);
  });
  await context.close();
});
