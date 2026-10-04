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

export type FlowerColour = 'blue' | 'violet' | 'pink' | 'white';
export const FLOWER_COLOURS: FlowerColour[] = ['blue', 'violet', 'pink', 'white'];

/** Look of one generation (plans/002-garden.md). Indices point into the renderer's palettes. */
export interface PlantStyle {
  flowers: FlowerColour;
  leaves: number;
  pot: number;
}

export interface MovedPlant {
  id: string;
  name: string;
  style: PlantStyle;
  plantedAt: number;
  movedAt: number;
  startCareDays: number;
  movedCareDays: number;
}

/** Game state of the garden; separate from Settings (preferences). */
export interface GardenState {
  current: { style: PlantStyle; plantedAt: number; startCareDays: number };
  /** Oldest first. */
  moved: MovedPlant[];
  /** The new seed hasn't been named yet (new-seed dialog pending). */
  pendingSeed: boolean;
}
