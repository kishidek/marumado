import { Armchair, Droplet, Eye, Footprints, Hand, MonitorOff, PersonStanding, Sun, Utensils, Wind, type IconNode } from 'lucide';

const ICONS: Record<string, IconNode> = {
  water: Droplet,
  stretch: PersonStanding,
  eyes: Eye,
  posture: Armchair,
  walk: Footprints,
  daylight: Sun,
  breathe: Wind,
  lunch: Utensils,
  wrists: Hand,
  shutdown: MonitorOff,
};

export const habitIcon = (id: string): IconNode => ICONS[id] ?? Droplet;
