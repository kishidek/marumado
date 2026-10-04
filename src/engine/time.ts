import type { WorkHours } from './types';

/**
 * All calendar logic uses the machine's local time through `Date` (so DST and travel are
 * handled by the platform). Timestamps are stored as UTC epoch ms.
 */

export const MINUTE = 60_000;

export function parseHM(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

const isOvernight = (wh: WorkHours) => parseHM(wh.end) < parseHM(wh.start);

/** Local calendar key, e.g. "2026-10-03". */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The work "day" a moment belongs to. For an overnight shift (22:00 → 06:00),
 * 02:00 on Tuesday belongs to Monday's shift.
 */
export function shiftDate(ts: number, wh: WorkHours): Date {
  const d = new Date(ts);
  if (isOvernight(wh) && minutesOfDay(d) < parseHM(wh.end)) d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0); // noon: safe from DST edges when stepping days
  return d;
}

export const shiftKey = (ts: number, wh: WorkHours) => dateKey(shiftDate(ts, wh));

export const isWorkday = (d: Date, wh: WorkHours) => wh.days.includes(d.getDay());

export function isWorkTime(ts: number, wh: WorkHours): boolean {
  const s = parseHM(wh.start);
  const e = parseHM(wh.end);
  if (s === e || wh.days.length === 0) return false;
  const d = new Date(ts);
  const m = minutesOfDay(d);
  const inRange = s < e ? m >= s && m < e : m >= s || m < e;
  return inRange && isWorkday(shiftDate(ts, wh), wh);
}

/** Every shift date from `fromTs` to `toTs` inclusive, stepping one local day at a time. */
export function shiftDatesBetween(fromTs: number, toTs: number, wh: WorkHours): Date[] {
  const out: Date[] = [];
  const d = shiftDate(fromTs, wh);
  const last = dateKey(shiftDate(toTs, wh));
  if (dateKey(d) > last) return out; // start after end (clock went backwards): nothing to walk
  for (let guard = 0; guard < 20_000; guard++) {
    out.push(new Date(d));
    if (dateKey(d) === last) break;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** When that shift day's work ends (epoch ms): the moment an ignored day is judged. */
export function shiftEndTs(day: Date, wh: WorkHours): number {
  const start = parseHM(wh.start);
  const length = (parseHM(wh.end) - start + 1440) % 1440 || 1440;
  const d = new Date(day);
  d.setHours(0, start + length, 0, 0); // minutes past 59 roll over into hours/days
  return d.getTime();
}

/** Next moment work time starts, as "HH:MM" (for "Resting until 09:00"). */
export const workStartLabel = (wh: WorkHours) => wh.start;
