export type Answer = 'yes' | 'no' | 'later';

/** One answer to one habit question. The event log is append-only. */
export interface AnswerEvent {
  id: string;
  /** Epoch ms (UTC). */
  ts: number;
  /** IANA zone at the time of answering, kept for debugging / future migrations. */
  tz: string;
  habitId: string;
  answer: Answer;
}

export interface HabitSetting {
  id: string;
  /** Minutes between questions; 1440 means "once a workday". */
  intervalMin: number;
  /** When the habit joined (epoch ms). Missing = since planting. Days before it don't count. */
  addedAt?: number;
}

export interface WorkHours {
  /** "HH:MM", local time. `end` earlier than `start` means an overnight shift. */
  start: string;
  end: string;
  /** Workdays, 0 = Sunday … 6 = Saturday. */
  days: number[];
}

export interface Vacation {
  from: number;
  to: number | null;
}

export interface Settings {
  plantName: string;
  habits: HabitSetting[];
  workHours: WorkHours;
  /** Epoch ms of planting (end of onboarding). */
  createdAt: number;
  vacations: Vacation[];
  reduceMotion: boolean;
  /** Lower resolution, no antialiasing, no answer animations: for slower computers. */
  lightMode?: boolean;
  lastExportAt: number | null;
}
