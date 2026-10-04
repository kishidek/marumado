import { CATALOG } from './catalog';
import type { Checkpoint } from './model';
import { FLOWER_COLOURS, type AnswerEvent, type GardenState, type PlantStyle, type Settings } from './types';

/** 2: adds `garden` (plans/002-garden.md). v1 backups still restore. */
export const SCHEMA_VERSION = 2;

export interface Backup {
  app: 'marumado';
  schemaVersion: number;
  exportedAt: number;
  settings: Settings;
  events: AnswerEvent[];
  /** Summary of history older than the events (present once the log has been compacted). */
  checkpoint?: Checkpoint | null;
  garden?: GardenState | null;
  /** Optional local error log (see storage/error-log.ts); ignored on restore. */
  diagnostics?: { ts: number; message: string; version: string }[];
}

export function makeBackup(
  settings: Settings,
  events: AnswerEvent[],
  now: number,
  diagnostics: Backup['diagnostics'] = [],
  checkpoint: Checkpoint | null = null,
  garden: GardenState | null = null,
): Backup {
  return { app: 'marumado', schemaVersion: SCHEMA_VERSION, exportedAt: now, settings, events, checkpoint, garden, diagnostics };
}

const isStyle = (x: unknown): x is PlantStyle =>
  isObj(x) && FLOWER_COLOURS.includes(x.flowers as never) && Number.isInteger(x.leaves) && Number.isInteger(x.pot);

function parseGarden(x: unknown): GardenState | null | 'bad' {
  if (x === undefined || x === null) return null;
  if (!isObj(x) || !isObj(x.current) || !isStyle(x.current.style) || !isNum(x.current.plantedAt) || !isNum(x.current.startCareDays) || !Array.isArray(x.moved)) return 'bad';
  const ok = x.moved.every(
    (m) => isObj(m) && typeof m.id === 'string' && typeof m.name === 'string' && isStyle(m.style) && isNum(m.movedAt) && isNum(m.movedCareDays) && isNum(m.startCareDays),
  );
  return ok ? (x as unknown as GardenState) : 'bad';
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
  const garden = parseGarden(raw.garden);
  if (garden === 'bad') return { ok: false, error: 'The backup’s garden is damaged.' };
  return { ok: true, backup: { app: 'marumado', schemaVersion: SCHEMA_VERSION, exportedAt: isNum(raw.exportedAt) ? raw.exportedAt : 0, settings, events, checkpoint, garden } };
}
