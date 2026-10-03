import type { AnswerEvent, Answer, Settings } from '../../src/engine/types';

/** Local-time timestamp. 2026-10-05 is a Monday. */
export const at = (day: number, hh: number, mm = 0) => new Date(2026, 9, day, hh, mm).getTime();

export function settings(over: Partial<Settings> = {}): Settings {
  return {
    plantName: 'Aoi',
    habits: [
      { id: 'water', intervalMin: 120 },
      { id: 'stretch', intervalMin: 60 },
      { id: 'eyes', intervalMin: 30 },
    ],
    workHours: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] },
    createdAt: at(5, 9),
    vacations: [],
    reduceMotion: false,
    lastExportAt: null,
    ...over,
  };
}

let n = 0;
export const ev = (ts: number, habitId: string, answer: Answer): AnswerEvent => ({ id: `e${n++}`, ts, tz: 'test', habitId, answer });
