import { describe, expect, it } from 'vitest';
import { computeState, TUNING } from '../../src/engine/model';
import { availability, duePrompts } from '../../src/engine/scheduler';
import { at, ev, settings } from './helpers';

const due = (e: ReturnType<typeof ev>[], now: number, s = settings()) => duePrompts(s, computeState(s, e, now), now);

describe('duePrompts', () => {
  it('asks nothing outside work hours or on weekends', () => {
    expect(due([], at(5, 8))).toEqual([]);
    expect(due([], at(5, 19))).toEqual([]);
    expect(due([], at(10, 11))).toEqual([]);
    expect(availability(settings(), at(10, 11))).toBe('off-hours');
  });

  it('asks every habit on the first tab of the day', () => {
    expect(due([], at(5, 10)).sort()).toEqual(['eyes', 'stretch', 'water']);
  });

  it('respects each interval after an answer', () => {
    const e = [ev(at(5, 10), 'water', 'yes'), ev(at(5, 10), 'stretch', 'yes'), ev(at(5, 10), 'eyes', 'yes')];
    expect(due(e, at(5, 10, 20))).toEqual([]);
    expect(due(e, at(5, 10, 31))).toEqual(['eyes']);
    expect(due(e, at(5, 11, 1)).sort()).toEqual(['eyes', 'stretch']);
    expect(due(e, at(5, 12, 1))).toContain('water');
  });

  it('"Later" snoozes for 30 minutes without counting', () => {
    const e = [ev(at(5, 10), 'water', 'later')];
    expect(due(e, at(5, 10, 10))).not.toContain('water');
    expect(due(e, at(5, 10, 31))).toContain('water');
  });

  it('stops asking after the daily cap', () => {
    const e = Array.from({ length: TUNING.dailyPromptCap }, (_, i) => ev(at(5, 9, i), 'eyes', 'later'));
    expect(due(e, at(5, 12))).toEqual([]);
  });

  it('daily habits are asked once per workday', () => {
    const s = settings({ habits: [{ id: 'lunch', intervalMin: 1440 }] });
    expect(due([], at(5, 13), s)).toEqual(['lunch']);
    const e = [ev(at(5, 13), 'lunch', 'yes')];
    expect(due(e, at(5, 16), s)).toEqual([]);
    expect(due(e, at(6, 13), s)).toEqual(['lunch']);
  });

  it('pauses on vacation', () => {
    const s = settings({ vacations: [{ from: at(5, 0), to: null }] });
    expect(due([], at(6, 10), s)).toEqual([]);
  });
});
