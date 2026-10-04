import { storage } from '#imports';
import { initialGarden, isGardenTime, moveToGarden, plantNewSeed } from '../engine/garden';
import { changesHistory, computeState, freezePast, makeCheckpoint, type Checkpoint } from '../engine/model';
import type { AnswerEvent, FlowerColour, GardenState, Settings } from '../engine/types';

/**
 * Everything lives in chrome.storage.local. Writes are serialized across all open
 * new tabs with a Web Lock (same extension origin), and always re-read inside the lock,
 * so two tabs answering at once never overwrite each other.
 */
export const settingsItem = storage.defineItem<Settings | null>('local:settings', { fallback: null, version: 1 });
export const eventsItem = storage.defineItem<AnswerEvent[]>('local:events', { fallback: [], version: 1 });
/** Summary of everything before the oldest kept event (see compactIfNeeded). */
export const checkpointItem = storage.defineItem<Checkpoint | null>('local:checkpoint', { fallback: null, version: 1 });
/** Garden game state (plans/002-garden.md). null = first generation, nothing moved yet. */
export const gardenItem = storage.defineItem<GardenState | null>('local:garden', { fallback: null, version: 1 });
/** UI memory that isn't plant data (e.g. the last day we nagged about backups). */
export const backupReminderItem = storage.defineItem<string | null>('local:ui:backupReminderDay', { fallback: null });
export const vacationReminderItem = storage.defineItem<string | null>('local:ui:vacationReminderDay', { fallback: null });
/** Local-only diagnostics: recent uncaught errors, shipped inside backups so users can share them. */
export interface LoggedError {
  ts: number;
  message: string;
  version: string;
}
export const errorsItem = storage.defineItem<LoggedError[]>('local:diagnostics:errors', { fallback: [] });
const previousItem = storage.defineItem<unknown>('local:backup:previous', { fallback: null });

const LOCK = 'marumado-write';
const locked = <T>(fn: () => Promise<T>) => navigator.locks.request(LOCK, fn) as Promise<T>;

export const appendEvent = (e: AnswerEvent) =>
  locked(async () => {
    const list = await eventsItem.getValue();
    if (!list.some((x) => x.id === e.id)) list.push(e);
    await eventsItem.setValue(list);
  });

/**
 * Saves a settings change. If it would reinterpret history (work hours, habits, intervals), the
 * past is first frozen into a checkpoint with the old settings, so it only applies from today.
 */
export const saveSettings = (update: (s: Settings) => Settings) =>
  locked(async () => {
    const before = await settingsItem.getValue();
    if (!before) return;
    const after = update(structuredClone(before));
    if (changesHistory(before, after)) {
      const frozen = freezePast(before, await eventsItem.getValue(), await checkpointItem.getValue(), Date.now());
      await checkpointItem.setValue(frozen);
    }
    await settingsItem.setValue(after);
  });

export const plant = (settings: Settings, flowers: FlowerColour = 'blue') =>
  locked(async () => {
    await eventsItem.setValue([]);
    await checkpointItem.setValue(null);
    await gardenItem.setValue(initialGarden(settings, flowers));
    await settingsItem.setValue(settings);
  });

/**
 * Moves the potted plant to the garden if it's time, re-checked on the stored data inside the
 * lock so two tabs can't move it twice. Returns the name of the plant that moved, or null.
 */
export const moveToGardenIfDue = (now = Date.now()) =>
  locked(async () => {
    const settings = await settingsItem.getValue();
    if (!settings) return null;
    const garden = (await gardenItem.getValue()) ?? initialGarden(settings);
    const state = computeState(settings, await eventsItem.getValue(), now, await checkpointItem.getValue());
    if (!isGardenTime(garden, state)) return null;
    await gardenItem.setValue(moveToGarden(garden, state, now, { id: crypto.randomUUID(), name: settings.plantName }));
    return settings.plantName;
  });

/** The user named the new seed and picked its colour. */
export const nameNewSeed = (name: string, flowers: FlowerColour) =>
  locked(async () => {
    const settings = await settingsItem.getValue();
    const garden = await gardenItem.getValue();
    if (!settings || !garden?.pendingSeed) return;
    await gardenItem.setValue(plantNewSeed(garden, flowers));
    await settingsItem.setValue({ ...settings, plantName: name });
  });

/** Restore: keep a snapshot of what was there, then replace in one locked step. */
export const replaceAll = (settings: Settings, events: AnswerEvent[], checkpoint: Checkpoint | null = null, garden: GardenState | null = null) =>
  locked(async () => {
    await previousItem.setValue({
      settings: await settingsItem.getValue(),
      events: await eventsItem.getValue(),
      checkpoint: await checkpointItem.getValue(),
      garden: await gardenItem.getValue(),
      savedAt: Date.now(),
    });
    await eventsItem.setValue(events);
    await checkpointItem.setValue(checkpoint);
    await gardenItem.setValue(garden);
    await settingsItem.setValue(settings);
  });

export const clearAll = () =>
  locked(async () => {
    await eventsItem.setValue([]);
    await checkpointItem.setValue(null);
    await gardenItem.setValue(null);
    await settingsItem.setValue(null);
  });

const DAY = 86_400_000;
/** Keep this much recent history as raw events (it's what the UI and cooldowns look at). */
export const KEEP_DAYS = 90;
/** Only compact once there is a meaningful amount to fold in. */
const COMPACT_WHEN_OLDER_THAN_DAYS = 120;

/**
 * Folds events older than KEEP_DAYS into the checkpoint. Exact by construction (tested):
 * the plant computed afterwards is identical. Runs under the write lock.
 */
export const compactIfNeeded = (now = Date.now()) =>
  locked(async () => {
    const settings = await settingsItem.getValue();
    const events = await eventsItem.getValue();
    if (!settings || !events.length) return false;
    const oldest = Math.min(...events.map((e) => e.ts));
    if (now - oldest < COMPACT_WHEN_OLDER_THAN_DAYS * DAY) return false;
    const previous = await checkpointItem.getValue();
    const boundary = now - KEEP_DAYS * DAY;
    if (previous && previous.untilTs >= boundary - DAY) {
      // The checkpoint is already past the boundary (a settings change froze it recently):
      // just drop events it already covers; never move a checkpoint backwards.
      await eventsItem.setValue(events.filter((e) => e.ts >= boundary - DAY));
      return true;
    }
    const cp = makeCheckpoint(settings, events, boundary, previous);
    const kept = events.filter((e) => e.ts >= cp.untilTs - DAY); // slack: the replay re-filters by day
    await checkpointItem.setValue(cp);
    await eventsItem.setValue(kept);
    return true;
  });

export function watchAll(onChange: () => void) {
  const stops = [settingsItem.watch(onChange), eventsItem.watch(onChange), checkpointItem.watch(onChange), gardenItem.watch(onChange)];
  return () => stops.forEach((stop) => stop());
}
