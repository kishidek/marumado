import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
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
  expect(backup).toMatchObject({ app: 'marumado', schemaVersion: 1, settings: { plantName: 'Mizu' } });

  // Wipe to a different plant, then restore the backup.
  await page.keyboard.press('Escape');
  await seed(page, { plantName: 'Other' });
  await page.click('#openSettings');
  page.once('dialog', (d) => d.accept());
  await page.locator('#settingsBody input[type=file]').setInputFiles(file);
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
  a.on('dialog', (d) => (d.message().startsWith('Start over') ? d.accept() : d.dismiss()));
  await a.click("button:has-text('Start over')");
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
