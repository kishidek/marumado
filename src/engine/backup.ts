import { CATALOG } from './catalog';
import type { Checkpoint } from './model';
import type { AnswerEvent, Settings } from './types';

export const SCHEMA_VERSION = 1;

export interface Backup {
  app: 'marumado';
  schemaVersion: number;
  exportedAt: number;
  settings: Settings;
  events: AnswerEvent[];
  /** Summary of history older than the events (present once the log has been compacted). */
  checkpoint?: Checkpoint | null;
  /** Optional local error log (see storage/error-log.ts); ignored on restore. */
  diagnostics?: { ts: number; message: string; version: string }[];
}

export function makeBackup(
  settings: Settings,
  events: AnswerEvent[],
  now: number,
  diagnostics: Backup['diagnostics'] = [],
  checkpoint: Checkpoint | null = null,
): Backup {
  return { app: 'marumado', schemaVersion: SCHEMA_VERSION, exportedAt: now, settings, events, checkpoint, diagnostics };
}

function parseCheckpoint(x: unknown): Checkpoint | null | 'bad' {
  if (x === undefined || x === null) return null;
  if (
    !isObj(x) ||
    typeof x.untilKey !== 'string' ||
    !isNum(x.untilTs) ||
    !isNum(x.careDays) ||
    !isNum(x.absence) ||
    !Array.isArray(x.habits) ||
    !x.habits.every((h) => isObj(h) && typeof h.id === 'string' && isNum(h.health))
  ) {
    return 'bad';
  }
  return x as unknown as Checkpoint;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isHM = (x: unknown) => typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
const knownHabit = new Set(CATALOG.map((h) => h.id));

/** Validates everything before anything is written: a bad file must never touch the plant. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file isn’t valid JSON.' };
  }
  if (!isObj(raw) || raw.app !== 'marumado') return { ok: false, error: 'This isn’t a Marumado backup.' };
  if (!isNum(raw.schemaVersion)) return { ok: false, error: 'The backup has no version.' };
  if (raw.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'This backup is from a newer Marumado. Update the extension first.' };

  const s = raw.settings;
  if (
    !isObj(s) ||
    typeof s.plantName !== 'string' ||
    !s.plantName.trim() ||
    !Array.isArray(s.habits) ||
    s.habits.length === 0 ||
    !s.habits.every((h) => isObj(h) && typeof h.id === 'string' && knownHabit.has(h.id) && isNum(h.intervalMin) && h.intervalMin > 0) ||
    !isObj(s.workHours) ||
    !isHM(s.workHours.start) ||
    !isHM(s.workHours.end) ||
    !Array.isArray(s.workHours.days) ||
    !s.workHours.days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) ||
    !isNum(s.createdAt) ||
    !Array.isArray(s.vacations)
  ) {
    return { ok: false, error: 'The backup’s settings are incomplete or damaged.' };
  }

  if (!Array.isArray(raw.events)) return { ok: false, error: 'The backup has no history.' };
  const events = raw.events.filter(
    (e): e is AnswerEvent =>
      isObj(e) && typeof e.id === 'string' && isNum(e.ts) && typeof e.habitId === 'string' && ['yes', 'no', 'later'].includes(e.answer as string),
  );
  if (events.length !== raw.events.length) return { ok: false, error: 'Some history entries are damaged.' };

  const settings: Settings = {
    plantName: s.plantName.trim().slice(0, 24),
    habits: (s.habits as { id: string; intervalMin: number; addedAt?: unknown }[]).map((h) => ({ id: h.id, intervalMin: h.intervalMin, ...(isNum(h.addedAt) ? { addedAt: h.addedAt } : {}) })),
    workHours: { start: s.workHours.start as string, end: s.workHours.end as string, days: s.workHours.days as number[] },
    createdAt: s.createdAt,
    vacations: (s.vacations as unknown[]).filter((v): v is { from: number; to: number | null } => isObj(v) && isNum(v.from) && (v.to === null || isNum(v.to))),
    reduceMotion: s.reduceMotion === true,
    lightMode: s.lightMode === true,
    lastExportAt: isNum(s.lastExportAt) ? s.lastExportAt : null,
  };
  const checkpoint = parseCheckpoint(raw.checkpoint);
  if (checkpoint === 'bad') return { ok: false, error: 'The backup’s history summary is damaged.' };
  return { ok: true, backup: { app: 'marumado', schemaVersion: SCHEMA_VERSION, exportedAt: isNum(raw.exportedAt) ? raw.exportedAt : 0, settings, events, checkpoint } };
}
