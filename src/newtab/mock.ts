import {
  Armchair,
  Droplet,
  Eye,
  Footprints,
  Hand,
  MonitorOff,
  PersonStanding,
  Sun,
  Utensils,
  Wind,
  type IconNode,
} from 'lucide';

/**
 * Mockup data only. Nothing here is computed: the real values will come from the
 * state and scheduling engines, which are not wired yet.
 */

export interface Habit {
  id: string;
  name: string;
  question: string;
  /** Default interval, shown in onboarding and settings. */
  every: string;
  /** Which part of the plant this habit feeds. */
  plantPart: string;
  icon: IconNode;
}

/** MVP: yes/no habits only (mood scale and inverted caffeine question are post-MVP). */
export const CATALOG: Habit[] = [
  { id: 'water', name: 'Water', question: 'Did you drink water in the last 2 hours?', every: 'Every 2 h', plantPart: 'Leaves stay firm', icon: Droplet },
  { id: 'stretch', name: 'Stretch', question: 'Did you stand up or stretch in the last hour?', every: 'Every 1 h', plantPart: 'Stems stand tall', icon: PersonStanding },
  { id: 'eyes', name: 'Eye break', question: 'Did you look at something far away for 20 seconds?', every: 'Every 30 min', plantPart: 'Leaves keep their shine', icon: Eye },
  { id: 'posture', name: 'Posture', question: 'Are you sitting up straight right now?', every: 'Every 1 h', plantPart: 'Stems stand tall', icon: Armchair },
  { id: 'walk', name: 'Walk', question: 'Did you walk for at least 5 minutes?', every: 'Every 3 h', plantPart: 'Roots grow deeper', icon: Footprints },
  { id: 'daylight', name: 'Daylight', question: 'Did you get some daylight today?', every: 'Once a day', plantPart: 'Deeper colour', icon: Sun },
  { id: 'breathe', name: 'Breathe', question: 'Did you take a 1-minute breathing break?', every: 'Every 3 h', plantPart: 'Fresh new leaves', icon: Wind },
  { id: 'lunch', name: 'Real lunch', question: 'Did you have lunch away from your desk?', every: 'Once a day', plantPart: 'More blooms', icon: Utensils },
  { id: 'wrists', name: 'Wrists', question: 'Did you stretch your wrists and hands?', every: 'Every 3 h', plantPart: 'Stronger stems', icon: Hand },
  { id: 'shutdown', name: 'Shutdown', question: 'Did you close the laptop on time yesterday?', every: 'Once a day', plantPart: 'Rest overnight', icon: MonitorOff },
];

export const DEFAULT_HABITS = ['water', 'stretch', 'eyes'];
export const MAX_HABITS = 5;

export const habitById = (id: string) => CATALOG.find((h) => h.id === id)!;

/** What the main screen shows for each active habit. */
export interface NeedView {
  habitId: string;
  level: number; // 0..1
  status: string;
}

export const MOCK = {
  plantName: 'Ajisai',
  day: 42,
  health: 0.72,
  workHours: { start: '09:00', end: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  needs: [
    { habitId: 'water', level: 0.38, status: 'Getting thirsty' },
    { habitId: 'stretch', level: 0.8, status: 'Asked 25 min ago' },
    { habitId: 'eyes', level: 0.62, status: 'Due in 10 min' },
  ] as NeedView[],
  /** The single highlighted question for this tab open. */
  queue: ['water', 'eyes'],
  lastExport: '18 days ago',
};
