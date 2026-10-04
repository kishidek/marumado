import { describe, expect, it } from 'vitest';
import { computeState, freezePast, vacationDay } from '../../src/engine/model';
import { availability } from '../../src/engine/scheduler';
import type { Settings } from '../../src/engine/types';
import { at, ev, settings } from './helpers';

/** Apply a settings change the way storage does: freeze the past with the old settings. */
function change(before: Settings, after: Settings, events: ReturnType<typeof ev>[], now: number) {
  const cp = freezePast(before, events, null, now);
  return { was: computeState(before, events, now), now: computeState(after, events, now, cp) };
}

describe('settings apply from today on (bug log #14–16)', () => {
  const base = settings({ createdAt: at(5, 9) });

  it('#14 switching workdays to 7 days does not rewrite past weekends', () => {
    const e = [];
    for (let d = 5; d <= 16; d++) e.push(ev(at(d, 10), 'water', 'yes'), ev(at(d, 10), 'stretch', 'yes'), ev(at(d, 10), 'eyes', 'yes'));
    const r = change(base, { ...base, workHours: { ...base.workHours, days: [0, 1, 2, 3, 4, 5, 6] } }, e, at(19, 10));
    expect(r.now.health).toBeCloseTo(r.was.health, 10);
    expect(r.now.careDays).toBe(r.was.careDays);
  });

  it('#15 a new interval does not re-read old answers', () => {
    const e = [ev(at(5, 10), 'eyes', 'no'), ev(at(5, 10, 40), 'eyes', 'no'), ev(at(5, 11, 20), 'eyes', 'no')];
    const longer = { ...base, habits: base.habits.map((h) => (h.id === 'eyes' ? { ...h, intervalMin: 120 } : h)) };
    const r = change(base, longer, e, at(6, 10));
    expect(r.now.byId.eyes!.health).toBeCloseTo(r.was.byId.eyes!.health, 10);
  });

  it('#16 removing an unanswered habit does not grant past care days', () => {
    const four = { ...base, habits: [...base.habits, { id: 'walk', intervalMin: 180 }] };
    const e = [];
    for (let d = 5; d <= 9; d++) e.push(ev(at(d, 10), 'water', 'yes'), ev(at(d, 10), 'stretch', 'yes'));
    const r = change(four, { ...four, habits: four.habits.filter((h) => h.id !== 'eyes' && h.id !== 'walk') }, e, at(12, 9));
    expect(r.now.careDays).toBe(r.was.careDays);
  });
});

describe('vacation is measured in time, not whole days (bug log #17)', () => {
  const s = settings({ vacations: [{ from: at(5, 9, 0), to: at(5, 9, 30) }] });

  it('questions come back right after turning vacation off', () => {
    expect(availability(s, at(5, 9, 15))).toBe('vacation');
    expect(availability(s, at(5, 11))).toBe('working');
  });

  it('a day where vacation was turned off before work ended is a normal day', () => {
    expect(vacationDay(s, new Date(at(5, 12)))).toBe(false);
    const away = settings({ vacations: [{ from: at(5, 9), to: at(9, 20) }] });
    expect(vacationDay(away, new Date(at(7, 12)))).toBe(true);
  });

  it('care earned on a vacation day still counts', () => {
    const away = settings({ vacations: [{ from: at(5, 8), to: null }] });
    const e = [ev(at(6, 10), 'water', 'yes'), ev(at(6, 10), 'stretch', 'yes')];
    expect(computeState(away, e, at(7, 10)).careDays).toBe(1);
  });
});

describe('clock going backwards (bug log #19)', () => {
  it('a checkpoint in the future does not walk thousands of fake days', () => {
    const s = settings();
    const e = [ev(at(5, 10), 'water', 'yes'), ev(at(5, 10), 'stretch', 'yes')];
    const cp = freezePast(s, e, null, at(20, 10));
    const back = computeState(s, e, at(10, 10), cp); // system clock set 10 days back
    expect(back.careDays).toBe(cp!.careDays);
    expect(back.calendarDay).toBeLessThan(30);
  });
});
