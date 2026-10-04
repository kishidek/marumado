import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, launch, newTab, seed, storedEvents } from './fixtures';

test('first run: mandatory onboarding plants the seed; no console/CSP errors', async ({ context }) => {
  const page = await newTab(context);
  await expect(page.locator('#onboarding')).toBeVisible();
  await expect(page.locator('#needs')).toBeHidden();
  await expect(page.locator('#mockControls')).toHaveCount(0); // dev controls stripped
  await page.click('#obNext');
  await expect(page.locator('#obNext')).toBeDisabled(); // empty name
  await page.fill('.name-input', 'Sora');
  await page.click('#obNext');
  await page.click('#obNext'); // default habits
  await page.click("#obBody .days button:has-text('Sat')");
  await page.click("#obBody .days button:has-text('Sun')");
  await page.locator('#obBody input[type=time]').first().fill('00:00');
  await page.locator('#obBody input[type=time]').last().fill('23:59');
  await page.locator('#obBody input[type=time]').last().dispatchEvent('change');
  await page.click('#obNext');
  await page.click('#obNext');
  await expect(page.locator('#onboarding')).toBeHidden();
  await expect(page.locator('#plantName')).toHaveText('Sora');
  await expect(page.locator('#ask h3')).toBeVisible();
  expect(page.errors).toEqual([]);
});

test('answering everything shows "All caught up", then the card disappears', async ({ context }) => {
  const page = await newTab(context);
  await seed(page);
  for (let i = 0; i < 3; i++) {
    await page.click('#ask .btn.primary');
    await page.waitForTimeout(400);
  }
  await expect(page.locator('#ask')).toHaveClass(/done/);
  await expect(page.locator('#ask')).toHaveClass(/gone/, { timeout: 5000 });
  await expect.poll(() => storedEvents(page)).toBe(3);
});

test('two tabs answering at the same time lose nothing', async ({ context }) => {
  const a = await newTab(context);
  await seed(a);
  const b = await newTab(context);
  await expect(b.locator('#plantName')).toHaveText('Aoi');
  await Promise.all([a.click('#ask .btn.primary'), b.click('#ask .btn:has-text("Not yet")')]);
  await expect.poll(() => storedEvents(a)).toBe(2);
});

test('rename propagates to other open tabs', async ({ context }) => {
  const a = await newTab(context);
  await seed(a);
  const b = await newTab(context);
  await a.bringToFront();
  await a.click('#openSettings');
  await a.fill('.rename-input', 'Hana');
  await a.click("button:has-text('Rename')");
  await expect(a.locator('#plantName')).toHaveText('Hana');
  await expect(b.locator('#plantName')).toHaveText('Hana');
});

test('export → restore round-trips; a corrupt file changes nothing', async ({ context }, info) => {
  const page = await newTab(context);
  await seed(page, { plantName: 'Mizu' });
  await page.click('#ask .btn.primary');
  await page.click('#openSettings');
  const download = page.waitForEvent('download');
  await page.click("button:has-text('Export backup')");
  const file = info.outputPath('backup.json');
  await (await download).saveAs(file);
  const backup = JSON.parse(await readFile(file, 'utf8'));
  expect(backup).toMatchObject({ app: 'marumado', schemaVersion: 2, settings: { plantName: 'Mizu' } });

  // Wipe to a different plant, then restore the backup.
  await page.keyboard.press('Escape');
  await seed(page, { plantName: 'Other' });
  await page.click('#openSettings');
  await page.locator('#settingsBody input[type=file]').setInputFiles(file);
  await page.click('dialog.ask-dialog button:has-text("Restore")');
  await expect(page.locator('#plantName')).toHaveText('Mizu');
  await expect.poll(() => storedEvents(page)).toBe(1);

  const corrupt = path.join(info.outputDir, 'corrupt.json');
  await writeFile(corrupt, '{"app":"marumado","schemaVersion":1,"settings":{}}');
  await page.locator('#settingsBody input[type=file]').setInputFiles(corrupt);
  await expect(page.locator('#toast')).toContainText('damaged');
  await expect(page.locator('#plantName')).toHaveText('Mizu');
});

test('start over erases the plant and brings back onboarding in every tab', async ({ context }) => {
  const a = await newTab(context);
  await seed(a);
  const b = await newTab(context);
  await a.bringToFront();
  await a.click('#openSettings');
  await a.click("button:has-text('Start over')");
  await a.click('dialog.ask-dialog button:has-text("Erase without backup")');
  await expect(a.locator('#onboarding')).toBeVisible();
  await expect(b.locator('#onboarding')).toBeVisible();
});

// Headless Chromium reports every tab as visible, so the "release WebGL when hidden" path can't
// run here (verify it manually). This covers the fallback: Chrome takes contexts from the oldest
// tabs past ~16, and a tab that lost its context recovers when the user comes back to it.
test('20 open tabs: a tab that lost its 3D shows the CSS window, then recovers on return', async ({ context }) => {
  test.setTimeout(150_000);
  const first = await newTab(context);
  await seed(first);
  for (let i = 1; i < 20; i++) await newTab(context);
  await expect(first.locator('#scene')).toHaveAttribute('data-gl', 'lost');
  await expect(first.locator('#fallback')).toBeVisible();
  await expect(first.locator('#fallbackNote')).toBeHidden();
  await first.bringToFront();
  await first.mouse.click(640, 120);
  await expect(first.locator('#scene')).toHaveAttribute('data-gl', 'ready');
  await expect(first.locator('#fallback')).toBeHidden();
  await expect(first.locator('#scene canvas')).toHaveCount(1);
});

test('without WebGL the page still works with a CSS window', async () => {
  const context = await launch(['--disable-3d-apis']);
  const page = await newTab(context);
  await expect(page.locator('#scene')).toHaveAttribute('data-gl', 'unsupported');
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#fallbackNote')).toBeVisible();
  await seed(page);
  await page.click('#ask .btn.primary');
  await expect.poll(() => storedEvents(page)).toBe(1);
  await context.close();
});

test('touch: tapping the collapsed plant pill opens it', async () => {
  const context = await launch([], { hasTouch: true });
  const page = await newTab(context);
  await seed(page);
  await page.evaluate(() => document.getElementById('needs')!.classList.add('collapsed'));
  await expect(page.locator('#needsList')).toBeHidden();
  await page.locator('#needs h2').tap();
  await expect(page.locator('#needsList')).toBeVisible();
  await context.close();
});

test('help modal explains the app and plays the looping explainer video', async ({ context }, info) => {
  const page = await newTab(context);
  await seed(page, { plantName: 'Kiko' });
  await page.click('#openHelp');
  await expect(page.locator('#help')).toBeVisible();
  await expect(page.locator('#helpPoints')).toContainText('and Kiko grows');
  const video = page.locator('#helpVideo');
  await expect(video).toHaveJSProperty('loop', true);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(0.5);
  await page.waitForTimeout(3500); // land on the wilted part for the screenshot
  await page.screenshot({ path: info.outputPath('help.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#help')).toBeHidden();
  await page.click('#ask .btn.primary'); // background is interactive again
  await expect.poll(() => storedEvents(page)).toBe(1);
});

test('vacation left on for 15 days gets a gentle reminder', async ({ context }) => {
  const page = await newTab(context);
  await seed(page, { vacations: [{ from: Date.now() - 15 * 86_400_000, to: null }] });
  await page.reload();
  await expect(page.locator('#toast')).toContainText('vacation mode', { timeout: 10_000 });
});

test('cold open: report time to first 3D frame', async ({ context }) => {
  const first = await newTab(context);
  await seed(first);
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const p = await newTab(context);
    await p.waitForFunction(() => performance.getEntriesByName('marumado:first-frame').length > 0);
    times.push(await p.evaluate(() => Math.round(performance.getEntriesByName('marumado:first-frame')[0]!.startTime)));
    await p.close();
  }
  console.log(`first 3D frame (ms, software GL): ${times.join(', ')}`);
});

// On an update/reload Chrome swaps every open Marumado tab for its default new tab, so an
// "extension context invalidated" page can't exist. (Data survival across updates is Chrome's
// storage guarantee; the reloaded extension doesn't re-register under Playwright, so that half is manual.)
test('extension update: open Marumado tabs are replaced, never left with a dead context', async ({ context }) => {
  const a = await newTab(context);
  await seed(a);
  const b = await newTab(context);
  await a.evaluate(() => chrome.runtime.reload()).catch(() => {});
  await expect.poll(() => context.pages().some((p) => p.url().includes('/newtab.html')), { timeout: 10_000 }).toBe(false);
  expect(b.url()).not.toContain('chrome-extension://');
});

test('diagnostics: uncaught errors are logged locally, shown in Settings and included in backups', async ({ context }, info) => {
  const page = await newTab(context);
  await seed(page);
  page.errors.length = 0;
  await page.evaluate(() => setTimeout(() => { throw new Error('boom from test'); }));
  await expect.poll(() => page.evaluate(() => chrome.storage.local.get('diagnostics:errors').then((r) => ((r['diagnostics:errors'] as unknown[] | undefined) ?? []).length))).toBe(1);
  await page.click('#openSettings');
  await expect(page.locator('#diagnostics')).toContainText('1 problem recorded');
  const download = page.waitForEvent('download');
  await page.click("button:has-text('Export backup')");
  const file = info.outputPath('backup.json');
  await (await download).saveAs(file);
  const backup = JSON.parse(await readFile(file, 'utf8'));
  expect(backup.diagnostics[0].message).toContain('boom from test');
  await page.click("#diagnostics button:has-text('Clear')");
  await expect(page.locator('#diagnostics')).toContainText('No problems recorded');
});

test('200 % zoom / short window: question and plant panel never overlap', async ({ context }) => {
  const page = await newTab(context);
  await seed(page);
  for (const size of [{ width: 720, height: 450 }, { width: 480, height: 820 }]) {
    await page.setViewportSize(size);
    await page.reload();
    await expect(page.locator('#ask h3')).toBeVisible();
    const ask = (await page.locator('#ask').boundingBox())!;
    const slot = (await page.locator('.needs-slot').boundingBox())!;
    const clock = (await page.locator('.clock').boundingBox())!;
    expect(ask.y).toBeGreaterThanOrEqual(clock.y + clock.height);
    expect(ask.y + ask.height).toBeLessThanOrEqual(slot.y);
    await page.locator('#ask .btn.primary').click({ trial: true }); // actionable, nothing on top of it
  }
});

test('old history is compacted into a checkpoint without changing the plant', async ({ context }) => {
  const { simulateDays } = await import('../../src/engine/simulate');
  const { computeState } = await import('../../src/engine/model');
  const DAY = 86_400_000;
  const now = Date.now();
  const s = {
    plantName: 'Aoi',
    habits: [{ id: 'water', intervalMin: 120 }, { id: 'stretch', intervalMin: 60 }, { id: 'eyes', intervalMin: 30 }],
    workHours: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] },
    createdAt: now - 200 * DAY,
    vacations: [],
    reduceMotion: false,
    lastExportAt: now,
  };
  const events = [...simulateDays(s, now - 60 * DAY, 140, 'healthy', 1), ...simulateDays(s, now, 60, 'mixed', 2)];
  const expected = computeState(s, events, now);

  const page = await newTab(context);
  await page.evaluate((data) => chrome.storage.local.set(data), { settings: s, events });
  await page.reload();
  await expect.poll(() => page.evaluate(() => chrome.storage.local.get('checkpoint').then((r) => !!r.checkpoint))).toBe(true);
  const left = await page.evaluate(() => chrome.storage.local.get('events').then((r) => r.events as { ts: number }[]));
  expect(left.length).toBeLessThan(events.length);
  expect(Math.min(...left.map((e) => e.ts))).toBeGreaterThan(now - 92 * DAY);

  await page.reload(); // now computed from checkpoint + recent events
  // (Day N counts from the current generation; this history is long enough to have moved to the garden.)
  const widths = await page.locator('.meter i').evaluateAll((els) => els.map((e) => (e as HTMLElement).style.width));
  expect(widths).toEqual(expected.habits.map((h) => `${Math.round(h.health * 100)}%`));
});

test('light mode rebuilds the 3D context without antialiasing', async ({ context }) => {
  const page = await newTab(context);
  await seed(page);
  const antialias = () => page.evaluate(() => (document.querySelector('#scene canvas') as HTMLCanvasElement | null)?.getContext('webgl2')?.getContextAttributes()?.antialias);
  await expect.poll(antialias).toBe(true);
  await page.click('#openSettings');
  await page.locator('label.setting-row', { hasText: 'Light mode' }).locator('input').check();
  await expect.poll(antialias).toBe(false);
  await expect(page.locator('#scene')).toHaveAttribute('data-gl', 'ready');
});

// --- Settings review regressions (bug log #17–23) -------------------------------------------

test('#18 the Settings drawer shows the saved habit list right away (remove / add)', async ({ context }) => {
  const page = await newTab(context);
  await seed(page);
  await page.click('#openSettings');
  const rows = page.locator('#settingsBody .setting-row select');
  await expect(rows).toHaveCount(3);
  await page.locator('#settingsBody .setting-row', { hasText: 'Eye break' }).locator('button:has-text("Remove")').click();
  await page.click('dialog.ask-dialog button:has-text("Remove")');
  await expect(rows).toHaveCount(2);
  await page.click('#settingsBody button.chip:has-text("Walk")');
  await expect(rows).toHaveCount(3);
  await expect(page.locator('#settingsBody')).toContainText('Walk');
});

test('#17 turning vacation off brings questions back immediately', async ({ context }) => {
  const page = await newTab(context);
  await seed(page);
  await page.click('#openSettings');
  const toggle = page.locator('label.setting-row', { hasText: 'Vacation mode' }).locator('input');
  await toggle.check();
  await expect(page.locator('#greeting')).toContainText('time off');
  await toggle.uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('#greeting')).not.toContainText('time off');
  await expect(page.locator('#ask h3')).toBeVisible();
});

test('#20 a rejected workday toggle snaps back to what is saved', async ({ context }) => {
  const page = await newTab(context);
  await seed(page, { workHours: { start: '00:00', end: '23:59', days: [1] } });
  await page.click('#openSettings');
  const mon = page.locator('#settingsBody .days[role=group] button:has-text("Mon")');
  await mon.click();
  await expect(page.locator('#settingsBody')).toContainText('Keep at least one workday.');
  await expect(mon).toHaveAttribute('aria-pressed', 'true');
});

test('#21–22 questions follow the interval; daily-only habits offer only "Once a day"', async ({ context }) => {
  const page = await newTab(context);
  await seed(page, { habits: [{ id: 'water', intervalMin: 120 }, { id: 'shutdown', intervalMin: 1440 }] });
  await expect(page.locator('#ask h3')).toHaveText(/in the last 2 hours|on time yesterday/);
  await page.click('#openSettings');
  await page.locator('select[aria-label="Water interval"]').selectOption('30');
  await expect(page.locator('select[aria-label="Shutdown interval"]')).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.hover('#needs');
  await page.click('.need:has-text("Water")');
  await expect(page.locator('#ask h3')).toHaveText('Did you drink water in the last 30 minutes?');
});

test('#23 Start over: Cancel keeps the plant; nothing is erased by mistake', async ({ context }) => {
  const page = await newTab(context);
  await seed(page, { plantName: 'Kiko' });
  await page.click('#openSettings');
  await page.click("button:has-text('Start over')");
  await page.click('dialog.ask-dialog button:has-text("Cancel")');
  await expect(page.locator('dialog.ask-dialog')).toHaveCount(0);
  await expect(page.locator('#plantName')).toHaveText('Kiko');
  await page.click("button:has-text('Start over')");
  await page.keyboard.press('Escape'); // closes only the dialog
  await expect(page.locator('#settings')).toBeVisible();
  await expect(page.locator('#plantName')).toHaveText('Kiko');
});

test('#14 changing workdays in Settings does not rewrite the plant’s past', async ({ context }) => {
  const { simulateDays } = await import('../../src/engine/simulate');
  const DAY = 86_400_000;
  const now = Date.now();
  const s = {
    plantName: 'Aoi',
    habits: [{ id: 'water', intervalMin: 120 }, { id: 'stretch', intervalMin: 60 }, { id: 'eyes', intervalMin: 30 }],
    workHours: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] },
    createdAt: now - 21 * DAY,
    vacations: [],
    reduceMotion: false,
    lastExportAt: now,
  };
  const page = await newTab(context);
  await page.evaluate((data) => chrome.storage.local.set(data), { settings: s, events: simulateDays(s, now, 21, 'healthy', 4) });
  await page.reload();
  const meters = () => page.locator('.meter i').evaluateAll((els) => els.map((e) => (e as HTMLElement).style.width));
  const before = await meters();
  await page.click('#openSettings');
  await page.click('#settingsBody .days[role=group] button:has-text("Sat")');
  await page.click('#settingsBody .days[role=group] button:has-text("Sun")');
  await expect.poll(() => page.evaluate(() => chrome.storage.local.get('settings').then((r) => (r.settings as { workHours: { days: number[] } }).workHours.days.length))).toBe(7);
  await page.keyboard.press('Escape');
  await page.reload();
  expect(await meters()).toEqual(before);
  expect(await page.evaluate(() => chrome.storage.local.get('checkpoint').then((r) => !!r.checkpoint))).toBe(true);
});

// --- Garden (plans/002-garden.md) ---------------------------------------------------------------

/** Settings + 260 days of healthy answers: past the 6-months-of-care threshold. */
async function seedSixMonths(page: Page, overrides: Record<string, unknown> = {}) {
  const { simulateDays } = await import('../../src/engine/simulate');
  const now = Date.now();
  const s = {
    plantName: 'Hana',
    habits: [{ id: 'water', intervalMin: 120 }, { id: 'stretch', intervalMin: 60 }, { id: 'eyes', intervalMin: 30 }],
    workHours: { start: '00:00', end: '23:59', days: [0, 1, 2, 3, 4, 5, 6] },
    createdAt: now - 260 * 86_400_000,
    vacations: [],
    reduceMotion: false,
    lastExportAt: now,
    ...overrides,
  };
  await page.evaluate((data) => chrome.storage.local.set(data), { settings: s, events: simulateDays(s, now, 260, 'healthy', 9), garden: null });
}
type StoredGarden = { moved: { name: string }[]; pendingSeed: boolean; current: { style: { flowers: string; leaves: number; pot: number } } };
const storedGarden = (page: Page) => page.evaluate(() => chrome.storage.local.get('garden').then((r) => r.garden as StoredGarden | null));

test('garden: at 6 months the plant moves on its own, then the new seed is named', async ({ context }) => {
  test.setTimeout(90_000);
  const page = await newTab(context);
  await seedSixMonths(page);
  await page.reload();
  const dialog = page.locator('dialog.new-seed');
  await expect(dialog).toBeVisible({ timeout: 15_000 }); // after the ~2.4 s flight
  await expect(dialog).toContainText('Hana moved to the garden');
  expect(await storedGarden(page)).toMatchObject({ moved: [{ name: 'Hana' }], pendingSeed: true });
  await expect(page.locator('#plantName')).toHaveText('New seed');

  await dialog.locator('.name-input').fill('Kiko');
  await dialog.locator('.flower:has-text("Pink")').click();
  await dialog.locator('button:has-text("Plant the seed")').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#plantName')).toHaveText('Kiko');
  await expect(page.locator('#plantMeta')).toContainText('1 in the garden');
  expect((await storedGarden(page))!.current.style).toEqual({ flowers: 'pink', leaves: 1, pot: 1 });

  await page.reload(); // no second move, no dialog
  await expect(page.locator('#plantName')).toHaveText('Kiko');
  await page.waitForTimeout(3000);
  await expect(page.locator('dialog.new-seed')).toHaveCount(0);
  expect((await storedGarden(page))!.moved).toHaveLength(1);
});

test('garden: two tabs at the threshold move the plant only once; closing before naming asks again', async ({ context }) => {
  test.setTimeout(90_000);
  const a = await newTab(context);
  await seedSixMonths(a, { reduceMotion: true }); // no flight: straight to the dialog
  const b = await newTab(context);
  await a.reload();
  await expect.poll(async () => (await storedGarden(a))?.moved.length ?? 0).toBe(1);
  await b.waitForTimeout(1500);
  expect((await storedGarden(a))!.moved).toHaveLength(1);

  await a.close();
  await b.close();
  const c = await newTab(context);
  await expect(c.locator('dialog.new-seed')).toBeVisible({ timeout: 10_000 });
  await c.locator('dialog.new-seed button:has-text("Plant the seed")').click(); // suggested name
  await expect(c.locator('#plantName')).not.toHaveText('New seed');
});

test('garden: backups carry the garden (schema v2)', async ({ context }, info) => {
  test.setTimeout(90_000);
  const page = await newTab(context);
  await seedSixMonths(page, { reduceMotion: true });
  await page.reload();
  await page.locator('dialog.new-seed button:has-text("Plant the seed")').click();
  await page.click('#openSettings');
  const download = page.waitForEvent('download');
  await page.click("button:has-text('Export backup')");
  const file = info.outputPath('backup.json');
  await (await download).saveAs(file);
  const backup = JSON.parse(await readFile(file, 'utf8'));
  expect(backup.schemaVersion).toBe(2);
  expect(backup.garden.moved[0].name).toBe('Hana');
});

test('garden: Settings lists the garden; texts never use the moved plant’s name for the new seed', async ({ context }) => {
  test.setTimeout(90_000);
  const page = await newTab(context);
  await seedSixMonths(page, { reduceMotion: true });
  await page.reload();
  await expect(page.locator('dialog.new-seed')).toBeVisible({ timeout: 10_000 });
  // While the seed has no name: pill and greeting don't say "Hana".
  await expect(page.locator('#plantName')).toHaveText('New seed');
  await expect(page.locator('#greeting')).not.toContainText('Hana');
  await page.locator('dialog.new-seed .name-input').fill('Yuki');
  await page.locator('dialog.new-seed button:has-text("Plant the seed")').click();
  await page.click('#openSettings');
  await expect(page.locator('#settingsBody')).toContainText('Your garden · 1');
  await expect(page.locator('#settingsBody .garden-row')).toContainText('Hana');
  await expect(page.locator('#settingsBody')).toContainText('Generation 2');
});
