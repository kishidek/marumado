import { test as base, chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

const EXTENSION = path.resolve('.output/chrome-mv3');

export function launch(extraArgs: string[] = [], options: { hasTouch?: boolean } = {}) {
  return chromium.launchPersistentContext('', {
    channel: 'chromium', // full Chromium: headless-shell can't load extensions
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
    ...options,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...extraArgs],
  });
}

/** Open a new tab and wait until Marumado (the override) has loaded its data. */
export async function newTab(context: BrowserContext) {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('chrome://newtab/');
  await page.waitForURL(/^chrome-extension:\/\/.+\/newtab\.html/);
  await expect(page.locator('#scene')).toHaveAttribute('data-gl', /.+/);
  return Object.assign(page, { errors });
}

/** Skip onboarding by writing settings directly. Work hours cover the whole day, every day. */
export async function seed(page: Page, overrides: Record<string, unknown> = {}) {
  await page.evaluate(async (o) => {
    await chrome.storage.local.set({
      events: [],
      settings: {
        plantName: 'Aoi',
        habits: [
          { id: 'water', intervalMin: 120 },
          { id: 'stretch', intervalMin: 60 },
          { id: 'eyes', intervalMin: 30 },
        ],
        workHours: { start: '00:00', end: '23:59', days: [0, 1, 2, 3, 4, 5, 6] },
        createdAt: Date.now() - 60_000,
        vacations: [],
        reduceMotion: false,
        lastExportAt: Date.now(),
        ...o,
      },
    });
  }, overrides);
  await expect(page.locator('#plantName')).toHaveText(String(overrides.plantName ?? 'Aoi'));
}

export const storedEvents = (page: Page) => page.evaluate(() => chrome.storage.local.get('events').then((r) => (r.events as unknown[]).length));

export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await launch();
    await use(context);
    await context.close();
  },
});
export { expect };
