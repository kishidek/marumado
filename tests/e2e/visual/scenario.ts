/**
 * Deterministic scenes for visual tests (plans/004-release-readiness.md §4, §6).
 * Everything happens in Asia/Tokyo (UTC+9, no DST) and every timestamp derives from the frozen
 * `now`, never from the test runner's clock.
 */
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

export const TZ = 'Asia/Tokyo';
const TZ_OFFSET = 9 * 3_600_000;
const DAY = 86_400_000;
const DEV_EXTENSION = path.resolve('.output/chrome-mv3-dev');

/** A Monday in Tokyo at `hour` (fractional hours allowed). */
export const fixedNow = (hour: number) => Date.UTC(2026, 5, 15, 0, 0) - TZ_OFFSET + hour * 3_600_000;
/** Tokyo midnight `days` days before `now`'s day, plus `hour`. */
const tokyoTime = (now: number, daysAgo: number, hour: number) => {
  const midnight = Math.floor((now + TZ_OFFSET) / DAY) * DAY - TZ_OFFSET;
  return midnight - daysAgo * DAY + hour * 3_600_000;
};
const tokyoKey = (ts: number) => new Date(ts + TZ_OFFSET).toISOString().slice(0, 10);

export type History = 'none' | 'healthy' | 'thirsty' | 'wilted' | 'one-low' | 'dormant';
export type Flowers = 'blue' | 'violet' | 'pink' | 'white';

export interface ScenarioSpec {
  /** What the plant shows (§6): produced by an explicit last-days history. */
  history: History;
  /** Care days of the potted plant (current generation). */
  currentCare: number;
  /** Plants already in the garden. */
  garden?: number;
  /** The new seed waits for its name. */
  pendingSeed?: boolean;
  /** Clock hour in Tokyo. */
  hour: number;
  workHours?: { start: string; end: string };
  vacation?: boolean;
  lightMode?: boolean;
  /** Default on for still scenes. */
  reduceMotion?: boolean;
  /** Answer "Later" to everything at hour − 10 min, so no card is due (no incidental card). */
  snoozedNow?: boolean;
}

const HABITS = [
  { id: 'water', intervalMin: 120 },
  { id: 'stretch', intervalMin: 60 },
  { id: 'eyes', intervalMin: 30 },
];
const FLOWERS: Flowers[] = ['blue', 'pink', 'violet', 'white'];
const styleFor = (gen: number) => ({ flowers: FLOWERS[gen % 4]!, leaves: gen % 4, pot: gen % 5 });

/** Builds settings + checkpoint + events + garden for a scene. */
export function buildScenario(spec: ScenarioSpec, now: number) {
  let n = 0;
  const ev = (ts: number, habitId: string, answer: 'yes' | 'no' | 'later') => ({ id: `v${n++}`, ts, tz: TZ, habitId, answer });
  const events: ReturnType<typeof ev>[] = [];
  const yesDay = (daysAgo: number) => HABITS.forEach((h) => events.push(ev(tokyoTime(now, daysAgo, 10), h.id, 'yes')));
  const noDay = (daysAgo: number, only?: string) =>
    HABITS.filter((h) => !only || h.id === only).forEach((h) => [10, 13, 16].forEach((hr) => events.push(ev(tokyoTime(now, daysAgo, hr), h.id, 'no'))));

  // Last days (tail), newest last: decides what the plant looks like today.
  let tailDays = 0;
  let tailCare = 0;
  if (spec.history !== 'none') {
    const pattern: ('yes' | 'no' | 'water-no' | 'none')[] =
      spec.history === 'healthy' ? Array(7).fill('yes')
      : spec.history === 'thirsty' ? [...Array(6).fill('yes'), 'no']
      : spec.history === 'wilted' ? [...Array(5).fill('yes'), 'no', 'no']
      : spec.history === 'one-low' ? [...Array(6).fill('yes'), 'water-no']
      : Array(14).fill('none'); // dormant
    tailDays = pattern.length;
    pattern.forEach((p, i) => {
      const daysAgo = tailDays - i;
      if (p === 'yes') yesDay(daysAgo);
      if (p === 'no') noDay(daysAgo);
      if (p === 'water-no') {
        HABITS.filter((h) => h.id !== 'water').forEach((h) => events.push(ev(tokyoTime(now, daysAgo, 10), h.id, 'yes')));
        noDay(daysAgo, 'water');
      }
      if (p === 'yes' || p === 'water-no') tailCare++;
    });
  }
  if (spec.snoozedNow) HABITS.forEach((h) => events.push(ev(now - 10 * 60_000, h.id, 'later')));

  // Generations laid out backwards from today: with 7 workdays a week, 1 care day = 1 calendar day,
  // and each generation spent 130 care days in the pot.
  const garden = spec.garden ?? 0;
  const total = garden * 130 + spec.currentCare;
  const currentPlantedAt = spec.pendingSeed ? now - 3_600_000 : tokyoTime(now, Math.max(spec.currentCare, tailDays), 9);
  const createdAt = spec.history === 'none' ? tokyoTime(now, 0, 7) : currentPlantedAt - garden * 130 * DAY;

  // Everything before the tail is summarised in a checkpoint (exact by construction).
  const untilTs = tokyoTime(now, tailDays, 12);
  const checkpoint =
    spec.history === 'none'
      ? null
      : {
          untilKey: tokyoKey(untilTs),
          untilTs,
          careDays: Math.max(0, total - tailCare),
          absence: 0,
          habits: HABITS.map((h) => ({ id: h.id, health: 1, lastCountedTs: untilTs - DAY, lastAnswerTs: untilTs - DAY, lastAnswer: 'yes' })),
        };

  const moved = Array.from({ length: garden }, (_, g) => ({
    id: `gen${g}`,
    name: ['Hana', 'Kiko', 'Sora', 'Mizu', 'Yuki', 'Nagi', 'Tsuyu', 'Rin', 'Ume'][g % 9]!, // never the current plant's name
    style: styleFor(g),
    plantedAt: createdAt + g * 130 * DAY,
    movedAt: createdAt + (g + 1) * 130 * DAY,
    startCareDays: g * 130,
    movedCareDays: (g + 1) * 130,
  }));

  return {
    settings: {
      plantName: spec.pendingSeed ? moved.at(-1)?.name ?? 'Hana' : 'Aoi',
      habits: HABITS,
      workHours: { start: spec.workHours?.start ?? '06:00', end: spec.workHours?.end ?? '23:30', days: [0, 1, 2, 3, 4, 5, 6] },
      createdAt,
      vacations: spec.vacation ? [{ from: now - 2 * 3_600_000, to: null }] : [],
      reduceMotion: spec.reduceMotion ?? true,
      lightMode: spec.lightMode ?? false,
      lastExportAt: now,
    },
    events,
    checkpoint,
    garden: {
      current: { style: styleFor(garden), plantedAt: currentPlantedAt, startCareDays: garden * 130 },
      moved,
      pendingSeed: !!spec.pendingSeed,
    },
  };
}

/** Dev build, Tokyo time frozen at `now`, fixed viewport. */
export async function sceneContext(now: number, opts: { viewport?: { width: number; height: number }; args?: string[] } = {}) {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: opts.viewport ?? { width: 1280, height: 800 },
    timezoneId: TZ,
    args: [`--disable-extensions-except=${DEV_EXTENSION}`, `--load-extension=${DEV_EXTENSION}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(opts.args ?? [])],
  });
  await context.clock.setFixedTime(now);
  return context;
}

/** Opens the new tab, writes the scene's data, reloads, and waits until the page has settled. */
export async function openScene(
  context: BrowserContext,
  data: ReturnType<typeof buildScenario> | null,
  pill: 'collapsed' | 'expanded' = 'collapsed',
  query = '',
): Promise<Page> {
  const page = await context.newPage();
  await page.goto('chrome://newtab/');
  await page.waitForURL(/newtab\.html/);
  await expect(page.locator('#scene')).toHaveAttribute('data-gl', /.+/);
  if (data) {
    await page.evaluate((d) => chrome.storage.local.set(d), data);
    await page.goto(page.url().split('?')[0] + query);
    await expect(page.locator('#plantName')).not.toBeEmpty();
  }
  await settle(page, pill);
  return page;
}

/**
 * Removes dev-only UI, fixes the plant pill's state (the page folds it after 6 s on its own, which
 * would make snapshots depend on timing) and waits past the canvas fade-in and data loads.
 */
export async function settle(page: Page, pill: 'collapsed' | 'expanded' = 'collapsed') {
  await page.evaluate(() => {
    document.getElementById('mockControls')?.remove();
    document.getElementById('needs')?.classList.add('collapsed');
  });
  if (pill === 'expanded') await page.hover('#needs');
  else await page.mouse.move(1, 1);
  await page.waitForTimeout(1200);
}
