import type { PlantState } from './model';
import { TUNING } from './model';
import type { FlowerColour, GardenState, MovedPlant, PlantStyle, Settings } from './types';

/** plans/002-garden.md §3–4. */
export const GARDEN = {
  /** The potted plant moves at 6 months of care. */
  moveAtPlantDays: 180,
  /** Pill says "Almost ready" from here. */
  almostAtPlantDays: 170,
  /** Renderer look reached when moving (the full potted look). */
  fullLook: 365,
  /** Palette sizes in the renderer (kept in sync by a test). */
  leafGreens: 4,
  glazes: 5,
  /** Plants visible in the garden; more replace the oldest slot. */
  slots: 8,
  /** Garden plants react softly: displayed = base + span × health. */
  softBase: 0.65,
};

/** Compressed growth: the full look (365 look days) arrives at 6 months of care (180 plant days). */
export const LOOK_PER_PLANT_DAY = GARDEN.fullLook / GARDEN.moveAtPlantDays;
export const lookDays = (plantDays: number) => Math.max(0, plantDays) * LOOK_PER_PLANT_DAY;

export function initialGarden(settings: Settings, flowers: FlowerColour = 'blue'): GardenState {
  return { current: { style: styleFor(0, flowers), plantedAt: settings.createdAt, startCareDays: 0 }, moved: [], pendingSeed: false };
}

/** Leaves and pot rotate by generation; flowers are the user's. */
export const styleFor = (generation: number, flowers: FlowerColour): PlantStyle => ({
  flowers,
  leaves: generation % GARDEN.leafGreens,
  pot: generation % GARDEN.glazes,
});

const plantDaysFromCare = (careDays: number) => Math.max(0, careDays) * TUNING.plantDaysPerCareDay;

/** Growth of the plant in the pot (plant days), clamped at 0 (clock set back). */
export const pottedPlantDays = (garden: GardenState, state: PlantState) => plantDaysFromCare(state.careDays - garden.current.startCareDays);

export const isGardenTime = (garden: GardenState, state: PlantState) => !garden.pendingSeed && pottedPlantDays(garden, state) >= GARDEN.moveAtPlantDays;

export function almostReady(garden: GardenState, state: PlantState) {
  const d = pottedPlantDays(garden, state);
  return d >= GARDEN.almostAtPlantDays && d < GARDEN.moveAtPlantDays;
}

/** Garden plants start at the full look and keep growing with every care day. */
export const gardenLook = (plant: MovedPlant, state: PlantState) => GARDEN.fullLook + lookDays(plantDaysFromCare(state.careDays - plant.movedCareDays));

export const gardenHealth = (health: number) => GARDEN.softBase + (1 - GARDEN.softBase) * health;

/** The plants on screen with their slots: the 8 most recent; slot = generation % 8. */
export function visibleGarden(garden: GardenState) {
  return garden.moved.map((plant, generation) => ({ plant, generation, slot: generation % GARDEN.slots })).slice(-GARDEN.slots);
}

/**
 * Moves the potted plant to the garden and starts a new seed. Pure: returns the new state.
 * The caller re-checks `isGardenTime` on the stored state inside the write lock.
 */
export function moveToGarden(garden: GardenState, state: PlantState, now: number, opts: { id: string; name: string }): GardenState {
  const generation = garden.moved.length + 1; // the new seed's generation (0 = first plant)
  const moved: MovedPlant = {
    id: opts.id,
    name: opts.name,
    style: garden.current.style,
    plantedAt: garden.current.plantedAt,
    movedAt: now,
    startCareDays: garden.current.startCareDays,
    movedCareDays: state.careDays,
  };
  return {
    current: { style: styleFor(generation, nextFlowers(garden.current.style.flowers)), plantedAt: now, startCareDays: state.careDays },
    moved: [...garden.moved, moved],
    pendingSeed: true,
  };
}

/** Default colour for the new seed (the user picks the real one): a different one from the last. */
const ORDER: FlowerColour[] = ['blue', 'pink', 'violet', 'white'];
const nextFlowers = (last: FlowerColour) => ORDER[(ORDER.indexOf(last) + 1) % ORDER.length]!;

/** The user named the new seed and picked its colour. */
export const plantNewSeed = (garden: GardenState, flowers: FlowerColour): GardenState => ({
  ...garden,
  current: { ...garden.current, style: { ...garden.current.style, flowers } },
  pendingSeed: false,
});

export const NAME_IDEAS = ['Aoi', 'Hana', 'Mizu', 'Sora', 'Kiko', 'Yuki', 'Tsuyu', 'Nagi'];
export const suggestName = (taken: string[]) => NAME_IDEAS.find((n) => !taken.includes(n)) ?? `Hana ${taken.length + 1}`;
