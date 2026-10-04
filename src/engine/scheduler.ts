import { DAILY } from './catalog';
import { TUNING, vacationAt, type HabitState, type PlantState } from './model';
import { isWorkTime, MINUTE } from './time';
import type { HabitSetting, Settings } from './types';

export type Availability = 'working' | 'off-hours' | 'vacation';

export function availability(settings: Settings, now: number): Availability {
  if (vacationAt(settings, now)) return 'vacation';
  return isWorkTime(now, settings.workHours) ? 'working' : 'off-hours';
}

const snoozed = (h: HabitState, now: number) =>
  h.lastAnswer === 'later' && h.lastAnswerTs !== null && now - h.lastAnswerTs < TUNING.laterSnoozeMin * MINUTE;

/** Minutes until this habit is due again (0 = due now). */
export function minutesUntilDue(habit: HabitSetting, h: HabitState, now: number): number {
  if (snoozed(h, now)) return Math.ceil((h.lastAnswerTs! + TUNING.laterSnoozeMin * MINUTE - now) / MINUTE);
  if (habit.intervalMin >= DAILY) return h.countedToday ? Infinity : 0;
  if (h.lastCountedTs === null) return 0;
  return Math.max(0, Math.ceil((h.lastCountedTs + habit.intervalMin * MINUTE - now) / MINUTE));
}

/**
 * Habits due now, most overdue first. Empty outside work hours, on vacation,
 * or once the daily prompt cap is reached.
 */
export function duePrompts(settings: Settings, state: PlantState, now: number): string[] {
  if (availability(settings, now) !== 'working') return [];
  if (state.answersToday >= TUNING.dailyPromptCap) return [];
  return settings.habits
    .map((habit) => {
      const h = state.byId[habit.id]!;
      const due = minutesUntilDue(habit, h, now) === 0;
      const overdue = habit.intervalMin >= DAILY || h.lastCountedTs === null ? 0 : now - h.lastCountedTs - habit.intervalMin * MINUTE;
      return { id: habit.id, due, overdue, never: h.lastCountedTs === null };
    })
    .filter((x) => x.due)
    .sort((a, b) => Number(b.never) - Number(a.never) || b.overdue - a.overdue)
    .map((x) => x.id);
}

/** Would an answer right now change the plant, or is it inside the count window? */
export function wouldCount(habit: HabitSetting, h: HabitState, now: number): boolean {
  if (h.lastCountedTs === null) return true;
  if (habit.intervalMin >= DAILY) return !h.countedToday;
  return now - h.lastCountedTs >= habit.intervalMin * MINUTE * TUNING.countWindow;
}
