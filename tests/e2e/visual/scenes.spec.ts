import { expect, test } from '@playwright/test';
import { buildScenario, fixedNow, openScene, sceneContext, settle } from './scenario';

/** Plant scenarios S01–S24 (plans/004-release-readiness.md §6). R1 pilots: S02, S05, S13. */
test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

test('S02 · fresh sprout, card + pill · 11:00', async () => {
  const now = fixedNow(11);
  const context = await sceneContext(now);
  const page = await openScene(context, buildScenario({ history: 'none', currentCare: 0, hour: 11 }, now), 'expanded');
  await expect(page).toHaveScreenshot('S02.png');
  await context.close();
});

test('S05 · wilted, no card due, night · 22:00', async () => {
  const now = fixedNow(22);
  const context = await sceneContext(now);
  const page = await openScene(context, buildScenario({ history: 'wilted', currentCare: 64, hour: 22, snoozedNow: true }, now));
  await expect(page).toHaveScreenshot('S05.png');
  await context.close();
});

test('S13 · Settings with 8 plants in the garden · 11:00', async () => {
  const now = fixedNow(11);
  const context = await sceneContext(now);
  const page = await openScene(context, buildScenario({ history: 'healthy', currentCare: 110, garden: 8, hour: 11 }, now));
  await page.click('#openSettings');
  await settle(page);
  await expect(page).toHaveScreenshot('S13.png');
  await context.close();
});
