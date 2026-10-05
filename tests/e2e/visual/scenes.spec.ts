import { expect, test, type Page } from '@playwright/test';
import { buildScenario, fixedNow, openScene, sceneContext, settle, type ScenarioSpec } from './scenario';

/**
 * Plant scenarios S01–S24 (plans/004-release-readiness.md §6). Each scene: data + frozen Tokyo
 * clock + viewport + UI state. Review all baselines with `npm run visual:sheet`.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

type Size = { width: number; height: number };
interface Scene {
  spec: Omit<ScenarioSpec, 'hour'> | null;
  hour: number;
  pill?: 'collapsed' | 'expanded';
  viewport?: Size;
  args?: string[];
  query?: string;
  /** Extra steps before the snapshot (open a dialog, step the flight…). */
  act?: (page: Page) => Promise<void>;
}

function scene(id: string, title: string, s: Scene) {
  test(`${id} · ${title}`, async () => {
    const now = fixedNow(s.hour);
    const context = await sceneContext(now, { viewport: s.viewport, args: s.args });
    try {
      const page = await openScene(context, s.spec ? buildScenario({ ...s.spec, hour: s.hour }, now) : null, s.pill, s.query);
      if (s.act) await s.act(page);
      await expect(page).toHaveScreenshot(`${id}.png`);
    } finally {
      await context.close();
    }
  });
}

const ALL_DAY = { start: '00:00', end: '23:59' };

scene('S01', 'onboarding: name and flower colour', {
  spec: null,
  hour: 11,
  act: async (page) => {
    await page.click('#obNext');
    await page.fill('.name-input', 'Aoi');
    await page.locator('#obBody .flower:has-text("Violet")').click();
    await page.mouse.move(1, 1);
  },
});
scene('S02', 'fresh sprout, card + pill · 11:00', { spec: { history: 'none', currentCare: 0 }, hour: 11, pill: 'expanded' });
scene('S03', 'healthy, 10 care days, dawn · 07:00', { spec: { history: 'healthy', currentCare: 10 }, hour: 7 });
scene('S04', 'thirsty, 30 care days, pill open · 18:00', { spec: { history: 'thirsty', currentCare: 30 }, hour: 18, pill: 'expanded' });
scene('S05', 'wilted, no card due, night · 22:00', { spec: { history: 'wilted', currentCare: 64, snoozedNow: true }, hour: 22 });
scene('S06', 'one habit low (water), pill collapsed · 11:00', { spec: { history: 'one-low', currentCare: 64 }, hour: 11 });
scene('S07', 'almost ready for the garden · 11:00', { spec: { history: 'healthy', currentCare: 122 }, hour: 11, pill: 'expanded' });
scene('S08', 'moving day, mid-flight through the window · 11:00', {
  spec: { history: 'healthy', currentCare: 130, reduceMotion: false },
  hour: 11,
  query: '?manual=1',
  act: async (page) => {
    // The move is saved, then the flight starts; frames only advance when we step them.
    await expect.poll(() => page.evaluate(() => chrome.storage.local.get('garden').then((r) => (r.garden as { moved: unknown[] } | null)?.moved.length ?? 0))).toBe(1);
    await page.waitForTimeout(500);
    for (let i = 0; i < 11; i++) await page.evaluate(() => (window as unknown as { __marumado: { frame(dt: number): void } }).__marumado.frame(0.1));
  },
});
scene('S09', 'new-seed dialog after the move · 11:00', { spec: { history: 'healthy', currentCare: 0, garden: 1, pendingSeed: true }, hour: 11 });
scene('S10', 'generation 2, day 1, night · 03:00', { spec: { history: 'healthy', currentCare: 1, garden: 1, workHours: ALL_DAY }, hour: 3 });
scene('S11', 'thirsty, gen 3 + 2 in the garden (dull) · 11:00', { spec: { history: 'thirsty', currentCare: 30, garden: 2 }, hour: 11 });
scene('S12', 'gen 5 + 4 in the garden · 18:00', { spec: { history: 'healthy', currentCare: 64, garden: 4 }, hour: 18 });
scene('S13', 'Settings with 8 plants in the garden · 11:00', {
  spec: { history: 'healthy', currentCare: 110, garden: 8 },
  hour: 11,
  act: async (page) => {
    await page.click('#openSettings');
    await settle(page);
  },
});
scene('S14', 'gen 10: the 9th plant takes slot 1 · 11:00', { spec: { history: 'healthy', currentCare: 10, garden: 9 }, hour: 11 });
scene('S15', 'dormant: away for 2 weeks · 11:00', { spec: { history: 'dormant', currentCare: 64, garden: 2 }, hour: 11 });
scene('S16', 'off-hours (work 09–18), resting · 22:00', { spec: { history: 'healthy', currentCare: 64, garden: 2, workHours: { start: '09:00', end: '18:00' } }, hour: 22 });
scene('S17', 'vacation mode · 11:00', { spec: { history: 'healthy', currentCare: 64, garden: 2, vacation: true }, hour: 11 });
scene('S18', 'light mode with 8 in the garden (≤ 3 shown) · 11:00', { spec: { history: 'healthy', currentCare: 64, garden: 8, lightMode: true }, hour: 11 });
scene('S19', 'no WebGL: CSS window · 11:00', { spec: { history: 'healthy', currentCare: 64, garden: 2 }, hour: 11, args: ['--disable-3d-apis'] });
scene('S20', '720×450 (200 % zoom) · 11:00', { spec: { history: 'healthy', currentCare: 64, garden: 2 }, hour: 11, viewport: { width: 720, height: 450 } });
scene('S21', '480×820 narrow · 11:00', { spec: { history: 'healthy', currentCare: 30, garden: 1 }, hour: 11, viewport: { width: 480, height: 820 } });
scene('S22', 'help modal, step 4 (stills: reduce motion) · 11:00', {
  spec: { history: 'healthy', currentCare: 64, garden: 2 },
  hour: 11,
  act: async (page) => {
    await page.click('#openHelp');
    await page.click('.help-dot >> nth=3');
    await page.waitForFunction(() => [...document.querySelectorAll('.help-step:not([hidden]) img')].every((i) => (i as HTMLImageElement).complete));
    await page.waitForTimeout(300);
  },
});
scene('S23', 'moving day with reduce motion: dialog right away · 11:00', { spec: { history: 'healthy', currentCare: 130 }, hour: 11 });
scene('S24', 'wilted gen 2 next to the garden · 18:00', { spec: { history: 'wilted', currentCare: 110, garden: 1 }, hour: 18 });
