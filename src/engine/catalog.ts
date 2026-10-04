/** Yes/no habits for desk workers (MVP). Icons live in the UI layer. */
export interface CatalogHabit {
  id: string;
  name: string;
  /** Question template; `{since}` becomes "in the last 2 hours", "today"… from the habit's interval. */
  question: string;
  /** Hint shown when this habit is low. */
  lowHint: string;
  plantPart: string;
  defaultIntervalMin: number;
  /** Only makes sense once a day (e.g. "did you close the laptop on time yesterday?"). */
  dailyOnly?: true;
}

export const DAILY = 1440;

export const CATALOG: CatalogHabit[] = [
  { id: 'water', name: 'Water', question: 'Did you drink water {since}?', lowHint: 'Its leaves are starting to droop.', plantPart: 'Leaves stay firm', defaultIntervalMin: 120 },
  { id: 'stretch', name: 'Stretch', question: 'Did you stand up or stretch {since}?', lowHint: 'Its stems are starting to bend.', plantPart: 'Stems stand tall', defaultIntervalMin: 60 },
  { id: 'eyes', name: 'Eye break', question: 'Did you look at something far away for 20 seconds {since}?', lowHint: 'Look out the window with it for a moment.', plantPart: 'Leaves keep their shine', defaultIntervalMin: 30 },
  { id: 'posture', name: 'Posture', question: 'Are you sitting up straight right now?', lowHint: 'It’s slouching a little, like you.', plantPart: 'Stems stand tall', defaultIntervalMin: 60 },
  { id: 'walk', name: 'Walk', question: 'Did you walk for at least 5 minutes {since}?', lowHint: 'Its roots need you to move.', plantPart: 'Roots grow deeper', defaultIntervalMin: 180 },
  { id: 'daylight', name: 'Daylight', question: 'Did you get some daylight today?', lowHint: 'It misses the sun.', plantPart: 'Deeper colour', defaultIntervalMin: DAILY, dailyOnly: true },
  { id: 'breathe', name: 'Breathe', question: 'Did you take a 1-minute breathing break {since}?', lowHint: 'A slow breath helps you both.', plantPart: 'Fresh new leaves', defaultIntervalMin: 180 },
  { id: 'lunch', name: 'Real lunch', question: 'Did you have lunch away from your desk today?', lowHint: 'It wants you to take a real break.', plantPart: 'More blooms', defaultIntervalMin: DAILY, dailyOnly: true },
  { id: 'wrists', name: 'Wrists', question: 'Did you stretch your wrists and hands {since}?', lowHint: 'Its stems feel stiff.', plantPart: 'Stronger stems', defaultIntervalMin: 180 },
  { id: 'shutdown', name: 'Shutdown', question: 'Did you close the laptop on time yesterday?', lowHint: 'It needs its rest, and so do you.', plantPart: 'Rest overnight', defaultIntervalMin: DAILY, dailyOnly: true },
];

export const DEFAULT_HABITS = ['water', 'stretch', 'eyes'];
export const MAX_HABITS = 5;
export const MIN_HABITS = 1;

export const INTERVAL_OPTIONS = [30, 60, 120, 180, DAILY];

/** Interval choices that make sense for this habit. */
export const intervalOptionsFor = (id: string) => (catalogHabit(id)?.dailyOnly ? [DAILY] : INTERVAL_OPTIONS);

export const catalogHabit = (id: string) => CATALOG.find((h) => h.id === id);

export function intervalLabel(min: number) {
  if (min >= DAILY) return 'Once a day';
  if (min < 60) return `Every ${min} min`;
  return `Every ${min / 60} h`;
}

/** "in the last 2 hours" / "in the last hour" / "in the last 30 minutes" / "today". */
export function sinceLabel(intervalMin: number) {
  if (intervalMin >= DAILY) return 'today';
  if (intervalMin === 60) return 'in the last hour';
  if (intervalMin < 60) return `in the last ${intervalMin} minutes`;
  return `in the last ${intervalMin / 60} hours`;
}

/** The question for a habit, worded to match the user's interval. */
export const questionFor = (id: string, intervalMin: number) => catalogHabit(id)!.question.replace('{since}', sinceLabel(intervalMin));
