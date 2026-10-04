import { describe, expect, it } from 'vitest';
import {
  almostReady,
  GARDEN,
  gardenHealth,
  gardenLook,
  initialGarden,
  isGardenTime,
  lookDays,
  moveToGarden,
  plantNewSeed,
  pottedPlantDays,
  styleFor,
  suggestName,
  visibleGarden,
} from '../../src/engine/garden';
import { computeState } from '../../src/engine/model';
import { simulateDays } from '../../src/engine/simulate';
import type { PlantState } from '../../src/engine/model';
import { at, settings } from './helpers';

const withCare = (careDays: number) => ({ careDays }) as PlantState;
const s = settings();

describe('garden engine (plans/002-garden.md)', () => {
  it('compresses growth: the full potted look arrives at 6 months of care', () => {
    expect(lookDays(GARDEN.moveAtPlantDays)).toBeCloseTo(GARDEN.fullLook);
    expect(lookDays(-5)).toBe(0);
  });

  it('moves at 180 plant days (≈129 care days), says "almost" just before', () => {
    const g = initialGarden(s);
    expect(isGardenTime(g, withCare(128))).toBe(false);
    expect(almostReady(g, withCare(122))).toBe(true);
    expect(isGardenTime(g, withCare(129))).toBe(true);
  });

  it('a move resets potted growth, keeps the old plant, and waits for the new seed', () => {
    const g0 = initialGarden(s, 'violet');
    const g1 = moveToGarden(g0, withCare(130), at(20, 10), { id: 'a', name: 'Hana' });
    expect(g1.moved).toHaveLength(1);
    expect(g1.moved[0]!).toMatchObject({ name: 'Hana', style: { flowers: 'violet', leaves: 0, pot: 0 }, movedCareDays: 130 });
    expect(pottedPlantDays(g1, withCare(130))).toBe(0);
    expect(g1.pendingSeed).toBe(true);
    expect(isGardenTime(g1, withCare(400))).toBe(false); // never twice while pending
    const g2 = plantNewSeed(g1, 'white');
    expect(g2.current.style).toEqual({ flowers: 'white', leaves: 1, pot: 1 });
    expect(g2.pendingSeed).toBe(false);
  });

  it('garden plants start at the full look and keep growing', () => {
    const g = moveToGarden(initialGarden(s), withCare(130), 0, { id: 'a', name: 'Hana' });
    expect(gardenLook(g.moved[0]!, withCare(130))).toBe(GARDEN.fullLook);
    expect(gardenLook(g.moved[0]!, withCare(260))).toBeGreaterThan(gardenLook(g.moved[0]!, withCare(200)));
  });

  it('garden plants react softly to health and never wilt', () => {
    expect(gardenHealth(0)).toBeCloseTo(GARDEN.softBase);
    expect(gardenHealth(1)).toBe(1);
  });

  it('styles rotate per generation; the 9th plant takes the 1st slot', () => {
    expect(styleFor(5, 'pink')).toEqual({ flowers: 'pink', leaves: 1, pot: 0 });
    let g = initialGarden(s);
    for (let i = 0; i < 9; i++) g = plantNewSeed(moveToGarden(g, withCare(130 * (i + 1)), i, { id: `p${i}`, name: `P${i}` }), 'blue');
    const visible = visibleGarden(g);
    expect(visible).toHaveLength(8);
    expect(visible.at(-1)).toMatchObject({ generation: 8, slot: 0 });
    expect(suggestName(['Aoi', 'Hana'])).toBe('Mizu');
  });

  it('end to end with the real engine: six months of healthy habits trigger the move', () => {
    const now = at(30, 17);
    const base = settings({ createdAt: now - 260 * 86_400_000 });
    const state = computeState(base, simulateDays(base, now, 260, 'healthy'), now);
    expect(isGardenTime(initialGarden(base), state)).toBe(true);
  });
});

it('renderer pot glazes match the engine', async () => {
  const { GLAZES } = await import('../../src/scene/textures');
  expect(GLAZES.length).toBe(GARDEN.glazes);
});
