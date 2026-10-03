import { DAILY } from './catalog';
import { isWorkday, MINUTE, parseHM, shiftDatesBetween } from './time';
import type { Answer, AnswerEvent, Settings } from './types';

/**
 * Generates realistic answer histories (dev controls, tests and deck videos).
 * - healthy:  answers almost every question with "Yes"
 * - neglect:  mostly ignores the plant, sometimes says "Not yet"
 * - mixed:    an ordinary week: some yes, some no, some ignored
 */
export type Pattern = 'healthy' | 'neglect' | 'mixed';

const DAY = 24 * 60 * MINUTE;

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(pattern: Pattern, r: number): Answer | null {
  if (pattern === 'healthy') return r < 0.92 ? 'yes' : 'later';
  if (pattern === 'neglect') return r < 0.25 ? 'no' : null;
  return r < 0.55 ? 'yes' : r < 0.8 ? 'no' : null;
}

/** Events for the `days` days that end at `endTs` (exclusive of `endTs`'s remaining hours). */
export function simulateDays(settings: Settings, endTs: number, days: number, pattern: Pattern, seed = 1): AnswerEvent[] {
  const rand = prng(seed);
  const wh = settings.workHours;
  const start = parseHM(wh.start);
  const length = ((parseHM(wh.end) - start + 1440) % 1440) || 1440;
  const out: AnswerEvent[] = [];
  let n = 0;
  for (const day of shiftDatesBetween(endTs - days * DAY, endTs - DAY, wh)) {
    if (!isWorkday(day, wh)) continue;
    const shiftStart = new Date(day);
    shiftStart.setHours(0, start, 0, 0);
    for (const habit of settings.habits) {
      const slots = habit.intervalMin >= DAILY ? [length / 2] : Array.from({ length: Math.floor(length / habit.intervalMin) }, (_, i) => (i + 0.5) * habit.intervalMin);
      for (const offset of slots) {
        const answer = pick(pattern, rand());
        if (!answer) continue;
        const ts = shiftStart.getTime() + offset * MINUTE + Math.floor(rand() * 10) * MINUTE;
        if (ts >= endTs || ts < settings.createdAt) continue;
        out.push({ id: `sim-${seed}-${n++}`, ts, tz: 'simulated', habitId: habit.id, answer });
      }
    }
  }
  return out;
}

/** Moves the whole history `days` into the past, freeing those days for new simulated events. */
export function shiftBack(settings: Settings, events: AnswerEvent[], days: number) {
  const d = days * DAY;
  return {
    settings: { ...settings, createdAt: settings.createdAt - d, vacations: settings.vacations.map((v) => ({ from: v.from - d, to: v.to === null ? null : v.to - d })) },
    events: events.map((e) => ({ ...e, ts: e.ts - d })),
  };
}
