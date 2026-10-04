import { DAILY } from './catalog';
import { dateKey, isWorkday, MINUTE, shiftDate, shiftDatesBetween, shiftEndTs, shiftKey } from './time';
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

/** Vacation mode is on at this exact moment (turning it off takes effect immediately). */
export function vacationAt(settings: Settings, ts: number): boolean {
  return settings.vacations.some((v) => v.from <= ts && (v.to === null || ts < v.to));
}

/**
 * A workday is a vacation day if vacation was on when that day's work ended, which is when an
 * ignored day would be judged. Turning vacation off in the morning makes that day a normal one.
 */
export function vacationDay(settings: Settings, day: Date): boolean {
  return vacationAt(settings, shiftEndTs(day, settings.workHours));
}

/**
 * Everything the replay knows at the start of a day. Saved as a checkpoint so old events can be
 * dropped (see compaction in storage): replaying from a checkpoint gives exactly the same plant.
 */
export interface Checkpoint {
  /** Shift-day key; the checkpoint already includes every day before it. */
  untilKey: string;
  /** A timestamp inside that day, to restart the day loop from. */
  untilTs: number;
  careDays: number;
  absence: number;
  habits: Omit<HabitState, 'countedToday'>[];
}

interface Replay {
  state: PlantState;
  absence: number;
}

function replay(settings: Settings, events: AnswerEvent[], now: number, from: Checkpoint | null): Replay {
  const wh = settings.workHours;
  const active = new Map(settings.habits.map((h) => [h.id, h]));
  const addedTs = (h: HabitSetting) => h.addedAt ?? settings.createdAt;
  const habits: HabitState[] = settings.habits.map((h) => {
    const saved = from?.habits.find((x) => x.id === h.id);
    // A habit (re)added after the checkpoint starts fresh.
    const usable = saved && from && addedTs(h) < from.untilTs;
    return usable
      ? { ...saved, countedToday: false }
      : { id: h.id, health: TUNING.startHealth, lastCountedTs: null, lastAnswerTs: null, lastAnswer: null, countedToday: false };
  });
  const byId = Object.fromEntries(habits.map((h) => [h.id, h]));

  const byDay = new Map<string, AnswerEvent[]>();
  for (const e of [...events].sort((a, b) => a.ts - b.ts)) {
    const habit = active.get(e.habitId);
    if (!habit || e.ts > now || e.ts < addedTs(habit)) continue; // removed habits are frozen; re-added ones start over
    const key = shiftKey(e.ts, wh);
    if (from && key < from.untilKey) continue; // already inside the checkpoint
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  const todayKey = shiftKey(now, wh);
  const plantedKey = shiftKey(settings.createdAt, wh);
  const addedKey = new Map(settings.habits.map((h) => [h.id, shiftKey(addedTs(h), wh)]));
  let careDays = from?.careDays ?? 0;
  let absence = from?.absence ?? 0;
  let answersToday = 0;

  for (const day of shiftDatesBetween(from?.untilTs ?? settings.createdAt, now, wh)) {
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

    if (!isWorkday(day, wh)) continue;
    // Only habits that already existed that day count (a habit added later starts fresh).
    const existing = habits.filter((h) => addedKey.get(h.id)! <= key);
    // Care earned counts even on a vacation day ("nothing is lost"); only penalties are skipped.
    if (existing.length && yes.size > existing.length / 2) careDays++;
    // No penalties: today isn't over; planting day is a grace day; vacation days are free.
    if (isToday || key === plantedKey || vacationDay(settings, day)) continue;

    absence = counted.size === 0 ? absence + 1 : 0;
    if (absence > TUNING.maxAbsenceDays) continue; // dormant: stop losing health
    for (const h of existing) {
      if (addedKey.get(h.id) === key) continue; // the day a habit is added is a grace day too
      if (!counted.has(h.id)) h.health = clamp01(h.health - TUNING.ignoredDayLoss);
    }
  }

  const avg = habits.reduce((sum, h) => sum + h.health, 0) / Math.max(1, habits.length);
  const min = Math.min(...habits.map((h) => h.health));
  return {
    absence,
    state: {
      habits,
      byId,
      health: clamp01(0.6 * avg + 0.4 * min),
      careDays,
      plantDays: careDays * TUNING.plantDaysPerCareDay,
      calendarDay: shiftDatesBetween(settings.createdAt, now, { ...wh, start: '00:00', end: '00:00' }).length,
      dormant: absence >= TUNING.maxAbsenceDays,
      answersToday,
    },
  };
}

/**
 * Replays the event log (from planting, or from a checkpoint) until `now`. Pure and
 * deterministic: the same inputs always give the same plant, in every tab.
 */
export function computeState(settings: Settings, events: AnswerEvent[], now: number, from: Checkpoint | null = null): PlantState {
  return replay(settings, events, now, from).state;
}

/**
 * Folds every day before the shift day of `untilTs` into a checkpoint. Events before that day
 * can then be deleted without changing the plant.
 */
export function makeCheckpoint(settings: Settings, events: AnswerEvent[], untilTs: number, from: Checkpoint | null = null): Checkpoint {
  const wh = settings.workHours;
  const untilKey = shiftKey(untilTs, wh);
  const day = shiftDate(untilTs, wh);
  // Replay up to the start of that day: it is "today" in the replay, with no events yet.
  const before = events.filter((e) => shiftKey(e.ts, wh) < untilKey);
  const { state, absence } = replay(settings, before, day.getTime(), from);
  return {
    untilKey,
    untilTs: day.getTime(),
    careDays: state.careDays,
    absence,
    habits: state.habits.map(({ countedToday: _, ...h }) => h),
  };
}

/** Which pot the plant is in (matches the renderer's repotting days). */
export const potNumber = (plantDays: number) => [40, 150, 290].filter((d) => plantDays >= d).length + 1;

export { shiftDate };

/** Settings whose change would make the replay reinterpret the past. */
export function changesHistory(before: Settings, after: Settings): boolean {
  const shape = (s: Settings) => JSON.stringify([s.workHours, s.habits.map((h) => [h.id, h.intervalMin])]);
  return shape(before) !== shape(after);
}

/**
 * Settings apply from today on, never retroactively: every day before today is folded into a
 * checkpoint computed with the *old* settings. (Changing work hours, an interval or the habit
 * list used to rewrite the plant's past.)
 */
export function freezePast(before: Settings, events: AnswerEvent[], checkpoint: Checkpoint | null, now: number): Checkpoint | null {
  const cp = makeCheckpoint(before, events, now, checkpoint);
  if (checkpoint && cp.untilKey < checkpoint.untilKey) return checkpoint; // clock went backwards
  return cp;
}
