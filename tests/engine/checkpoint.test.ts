import { describe, expect, it } from 'vitest';
import { computeState, makeCheckpoint } from '../../src/engine/model';
import { simulateDays } from '../../src/engine/simulate';
import type { Settings } from '../../src/engine/types';
import { at, settings } from './helpers';

const DAY = 86_400_000;

describe('checkpoints (event-log compaction)', () => {
  const now = at(30, 15);
  const created = now - 200 * DAY;
  const s: Settings = settings({
    createdAt: created,
    habits: [
      { id: 'water', intervalMin: 120 },
      { id: 'stretch', intervalMin: 60 },
      { id: 'lunch', intervalMin: 1440, addedAt: created + 70 * DAY },
    ],
    vacations: [{ from: created + 100 * DAY, to: created + 110 * DAY }],
  });
  const events = [
    ...simulateDays(s, created + 60 * DAY, 60, 'healthy', 1),
    ...simulateDays(s, created + 120 * DAY, 60, 'mixed', 2),
    ...simulateDays(s, now, 80, 'neglect', 3),
  ];

  const same = (a: ReturnType<typeof computeState>, b: ReturnType<typeof computeState>) => {
    expect(b.careDays).toBe(a.careDays);
    expect(b.dormant).toBe(a.dormant);
    expect(b.answersToday).toBe(a.answersToday);
    expect(b.health).toBeCloseTo(a.health, 10);
    for (const h of a.habits) {
      expect(b.byId[h.id]!.health).toBeCloseTo(h.health, 10);
      expect(b.byId[h.id]!.lastCountedTs).toBe(h.lastCountedTs);
    }
  };

  it('replaying from a checkpoint gives exactly the same plant', () => {
    const full = computeState(s, events, now);
    const cp = makeCheckpoint(s, events, now - 90 * DAY);
    const kept = events.filter((e) => e.ts >= cp.untilTs - DAY); // compaction keeps only recent events (+ slack)
    same(full, computeState(s, kept, now, cp));
  });

  it('chained checkpoints stay exact', () => {
    const full = computeState(s, events, now);
    const cp1 = makeCheckpoint(s, events, now - 150 * DAY);
    const cp2 = makeCheckpoint(s, events.filter((e) => e.ts >= cp1.untilTs - DAY), now - 40 * DAY, cp1);
    same(full, computeState(s, events.filter((e) => e.ts >= cp2.untilTs - DAY), now, cp2));
  });
});
