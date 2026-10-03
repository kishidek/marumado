import { DAILY } from './catalog';
import { dateKey, isWorkday, MINUTE, shiftDate, shiftDatesBetween, shiftKey } from './time';
import type { Answer, AnswerEvent, HabitSetting, Settings, WorkHours } from './types';

/** Every number that shapes the game, in one place. */
export const TUNING = {
  startHealth: 0.8,
  /** 2 "Yes" bring a thirsty habit (~0.5) back to healthy. */
  yesGain: 0.26,
  /** 3 "Not yet" in a row take a healthy habit (1.0) to thirsty (~0.5). */
  noLoss: 0.17,
  /** A workday on which a habit got no counted answer at all (soft: unanswered ≠ "no"). */
  ignoredDayLoss: 0.12,
  /** After this many workdays in a row with no answers, the plant goes dormant: no further loss. */
  maxAbsenceDays: 3,
  /** A second answer counts only after this share of the interval (stops "Yes" farming). */
  countWindow: 0.75,
  laterSnoozeMin: 30,
  dailyPromptCap: 10,
  /** Care days happen on workdays only; scale so a perfect work week = a week of growth. */
  plantDaysPerCareDay: 7 / 5,
};

export interface HabitState {
  id: string;
  health: number;
  lastCountedTs: number | null;
  lastAnswerTs: number | null;
  lastAnswer: Answer | null;
  /** A counted answer (yes or no) already happened in today's shift. */
  countedToday: boolean;
}

export interface PlantState {
  habits: HabitState[];
  byId: Record<string, HabitState>;
  /** 0 = wilted, 1 = healthy. Drives the plant's look. */
  health: number;
  /** Workdays on which more than half of the active habits got a counted "Yes". */
  careDays: number;
  /** Growth fed to the plant renderer. */
  plantDays: number;
  /** Calendar day since planting, starting at 1. */
  calendarDay: number;
  dormant: boolean;
  answersToday: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function isCounted(last: number | null, habit: HabitSetting, ts: number, wh: WorkHours): boolean {
  if (last === null) return true;
  if (habit.intervalMin >= DAILY) return shiftKey(last, wh) !== shiftKey(ts, wh);
  return ts - last >= habit.intervalMin * MINUTE * TUNING.countWindow;
}

export function onVacation(settings: Settings, d: Date): boolean {
  const key = dateKey(d);
  return settings.vacations.some((v) => dateKey(new Date(v.from)) <= key && (v.to === null || key <= dateKey(new Date(v.to))));
}

/**
 * Replays the event log from planting until `now`. Pure and deterministic: the same
 * settings + events + now always give the same plant, in every tab.
 */
export function computeState(settings: Settings, events: AnswerEvent[], now: number): PlantState {
  const wh = settings.workHours;
  const active = new Map(settings.habits.map((h) => [h.id, h]));
  const habits: HabitState[] = settings.habits.map((h) => ({
    id: h.id,
    health: TUNING.startHealth,
    lastCountedTs: null,
    lastAnswerTs: null,
    lastAnswer: null,
    countedToday: false,
  }));
  const byId = Object.fromEntries(habits.map((h) => [h.id, h]));

  const byDay = new Map<string, AnswerEvent[]>();
  for (const e of [...events].sort((a, b) => a.ts - b.ts)) {
    if (e.ts > now || e.ts < settings.createdAt || !active.has(e.habitId)) continue; // removed habits are frozen
    const key = shiftKey(e.ts, wh);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  const todayKey = shiftKey(now, wh);
  const plantedKey = shiftKey(settings.createdAt, wh);
  let careDays = 0;
  let absence = 0;
  let answersToday = 0;

  for (const day of shiftDatesBetween(settings.createdAt, now, wh)) {
    const key = dateKey(day);
    const isToday = key === todayKey;
    const counted = new Set<string>();
    const yes = new Set<string>();

    for (const e of byDay.get(key) ?? []) {
      const h = byId[e.habitId]!;
      if (isToday) answersToday++;
      h.lastAnswer = e.answer;
      h.lastAnswerTs = e.ts;
      if (e.answer === 'later') continue;
      if (!isCounted(h.lastCountedTs, active.get(e.habitId)!, e.ts, wh)) continue;
      h.lastCountedTs = e.ts;
      h.health = clamp01(h.health + (e.answer === 'yes' ? TUNING.yesGain : -TUNING.noLoss));
      counted.add(e.habitId);
      if (e.answer === 'yes') yes.add(e.habitId);
    }

    if (isToday) for (const id of counted) byId[id]!.countedToday = true;

    const workday = isWorkday(day, wh) && !onVacation(settings, day);
    if (!workday) continue;
    if (yes.size > habits.length / 2) careDays++;
    if (isToday || key === plantedKey) continue; // today isn't over; planting day is a grace day

    absence = counted.size === 0 ? absence + 1 : 0;
    if (absence > TUNING.maxAbsenceDays) continue; // dormant: stop losing health
    for (const h of habits) if (!counted.has(h.id)) h.health = clamp01(h.health - TUNING.ignoredDayLoss);
  }

  const avg = habits.reduce((s, h) => s + h.health, 0) / Math.max(1, habits.length);
  const min = Math.min(...habits.map((h) => h.health));
  return {
    habits,
    byId,
    health: clamp01(0.6 * avg + 0.4 * min),
    careDays,
    plantDays: careDays * TUNING.plantDaysPerCareDay,
    calendarDay: shiftDatesBetween(settings.createdAt, now, { ...wh, start: '00:00', end: '00:00' }).length,
    dormant: absence >= TUNING.maxAbsenceDays,
    answersToday,
  };
}

/** Which pot the plant is in (matches the renderer's repotting days). */
export const potNumber = (plantDays: number) => [40, 150, 290].filter((d) => plantDays >= d).length + 1;

export { shiftDate };
