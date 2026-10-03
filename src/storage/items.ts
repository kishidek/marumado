import { storage } from '#imports';
import type { AnswerEvent, Settings } from '../engine/types';

/**
 * Everything lives in chrome.storage.local. Writes are serialized across all open
 * new tabs with a Web Lock (same extension origin), and always re-read inside the lock,
 * so two tabs answering at once never overwrite each other.
 */
export const settingsItem = storage.defineItem<Settings | null>('local:settings', { fallback: null, version: 1 });
export const eventsItem = storage.defineItem<AnswerEvent[]>('local:events', { fallback: [], version: 1 });
/** UI memory that isn't plant data (e.g. the last day we nagged about backups). */
export const backupReminderItem = storage.defineItem<string | null>('local:ui:backupReminderDay', { fallback: null });
const previousItem = storage.defineItem<unknown>('local:backup:previous', { fallback: null });

const LOCK = 'marumado-write';
const locked = <T>(fn: () => Promise<T>) => navigator.locks.request(LOCK, fn) as Promise<T>;

export const appendEvent = (e: AnswerEvent) =>
  locked(async () => {
    const list = await eventsItem.getValue();
    if (!list.some((x) => x.id === e.id)) list.push(e);
    await eventsItem.setValue(list);
  });

export const saveSettings = (update: (s: Settings) => Settings) =>
  locked(async () => {
    const s = await settingsItem.getValue();
    if (s) await settingsItem.setValue(update(structuredClone(s)));
  });

export const plant = (settings: Settings) =>
  locked(async () => {
    await eventsItem.setValue([]);
    await settingsItem.setValue(settings);
  });

/** Restore: keep a snapshot of what was there, then replace in one locked step. */
export const replaceAll = (settings: Settings, events: AnswerEvent[]) =>
  locked(async () => {
    await previousItem.setValue({ settings: await settingsItem.getValue(), events: await eventsItem.getValue(), savedAt: Date.now() });
    await eventsItem.setValue(events);
    await settingsItem.setValue(settings);
  });

export const clearAll = () =>
  locked(async () => {
    await eventsItem.setValue([]);
    await settingsItem.setValue(null);
  });

export function watchAll(onChange: () => void) {
  const a = settingsItem.watch(onChange);
  const b = eventsItem.watch(onChange);
  return () => {
    a();
    b();
  };
}
